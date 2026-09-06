/**
 * The user's session — who is signed in, and how to sign in and out.
 *
 * The state comes from `onIdTokenChanged` (and not from `onAuthStateChanged`):
 * it also fires on the token's REFRESH, which is the moment the following calls
 * start carrying a new credential. Listening only for a change of user would
 * leave the tree unaware that the session was revalidated.
 */
import React from 'react';
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type AuthCredential,
  type User,
} from 'firebase/auth';

import { decideFromAuthError } from './auth-errors';
import { auth } from './firebase';

// The scopes are the ones SIGNING IN needs, and nothing more. Reading somebody's
// repositories is a different grant with far larger scopes, and it belongs to
// the integrations surface after the account exists (spec D-3). Asking for it
// here would put a frightening consent screen in front of a stranger, and would
// be blocked outright by organizations that restrict third-party applications.
const providers = {
  google: () => new GoogleAuthProvider(),
  github: () => {
    const p = new GithubAuthProvider();
    p.addScope('read:user');
    p.addScope('user:email');
    return p;
  },
} as const;

function credentialFromError(provider: keyof typeof providers, err: unknown) {
  const e = err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0];
  return provider === 'google'
    ? GoogleAuthProvider.credentialFromError(e)
    : GithubAuthProvider.credentialFromError(e);
}

type Session = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWith: (provider: 'google' | 'github') => Promise<void>;
  linkPending: (email: string, password: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  pendingLink: { email: string } | null;
};

const SessionContext = React.createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(auth.currentUser);
  // It starts loading even when `currentUser` already exists: the SDK is still
  // going to restore the session from storage, and showing the sign-in screen in
  // that interval would make the page flash a sign-in that was not needed.
  const [loading, setLoading] = React.useState(true);

  // When a provider sign-in collides with an existing account, Firebase hands
  // back the credential it could not use. It is kept in memory — never in
  // storage — until the person proves the provider they already have, because
  // it is a bearer credential and writing it to disk would outlive the moment
  // it is good for.
  const pending = React.useRef<AuthCredential | null>(null);
  const [pendingLink, setPendingLink] = React.useState<{ email: string } | null>(null);

  React.useEffect(() => {
    return onIdTokenChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = React.useMemo<Session>(
    () => ({
      user,
      loading,
      pendingLink,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
      signUp: async (email, password) => {
        const created = await createUserWithEmailAndPassword(auth, email, password);
        // Sent immediately, not on the next screen: if the person closes the tab
        // here, the account exists and nothing has told them what to do next.
        await sendEmailVerification(created.user);
      },
      signInWith: async (provider) => {
        try {
          await signInWithPopup(auth, providers[provider]());
        } catch (failure) {
          const decision = decideFromAuthError(failure);
          if (decision.kind === 'link-required') {
            pending.current = credentialFromError(provider, failure);
            setPendingLink({ email: decision.email });
          }
          throw failure;
        }
      },
      linkPending: async (email, password) => {
        // Signing in with the provider they ALREADY have is the proof of
        // possession. Firebase gives us that for free here, and it is stronger
        // than matching a verified e-mail: it is a demonstration, not a claim.
        const existing = await signInWithEmailAndPassword(auth, email, password);
        if (pending.current) {
          await linkWithCredential(existing.user, pending.current);
          pending.current = null;
          setPendingLink(null);
        }
      },
      sendVerification: async () => {
        if (auth.currentUser) await sendEmailVerification(auth.currentUser);
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(auth, email);
      },
    }),
    [user, loading, pendingLink],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Session {
  const context = React.useContext(SessionContext);
  if (!context)
    throw new Error('useSession has to be inside a <SessionProvider>');
  return context;
}

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
  fetchSignInMethodsForEmail,
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

// The identifiers `fetchSignInMethodsForEmail` returns — 'password' proves
// itself with a password, 'google.com'/'github.com' prove themselves by
// signing in through that provider's popup again. Both are stronger than
// matching a verified e-mail: a demonstration, not a claim.
type LinkMethod = 'password' | 'google.com' | 'github.com';

type Session = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWith: (provider: 'google' | 'github') => Promise<void>;
  linkPending: (method: LinkMethod, email: string, password?: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  // `methods` is what `fetchSignInMethodsForEmail` returned. An EMPTY array is
  // a normal answer, not a failure — it is what a project with e-mail
  // enumeration protection always returns, protection being a console setting
  // this code cannot see. The screen must treat empty as "offer every way in
  // and let the person pick", never as broken. `attempted` is the provider
  // that just failed with `account-exists-with-different-credential` — the
  // one method proven NOT to be on the account, so it must never be among the
  // ones offered back.
  pendingLink: { email: string; methods: LinkMethod[]; attempted: LinkMethod } | null;
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
  const [pendingLink, setPendingLink] = React.useState<Session['pendingLink']>(null);

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
        // The account existing is what succeeded; the message is best-effort
        // on top of it. Letting a failed send reject this call would strand a
        // created account with nobody told what to do next — and signing up
        // again would then fail as already-in-use, with no way back in. On a
        // failed send the verification screen still says "we sent a link"
        // when we did not; the resend button already on that screen is the
        // person's actual recourse, not a retry of this call.
        try {
          await sendEmailVerification(created.user);
        } catch {
          // Swallowed deliberately — see comment above.
        }
      },
      signInWith: async (provider) => {
        try {
          await signInWithPopup(auth, providers[provider]());
        } catch (failure) {
          const decision = decideFromAuthError(failure);
          if (decision.kind === 'link-required') {
            pending.current = credentialFromError(provider, failure);
            // A failure IN THIS LOOKUP must not swallow the original
            // failure below — the person still needs to reach
            // `/link-provider`, and an empty list is already a case that
            // screen treats as "offer every way in", so falling back to it
            // costs nothing extra.
            let methods: LinkMethod[] = [];
            try {
              // An empty array here is not a failed lookup — it is what a
              // project with e-mail enumeration protection always returns.
              // The screen is told to treat it as "offer every way in", so
              // this layer does not need to special-case it further.
              methods = (await fetchSignInMethodsForEmail(
                auth,
                decision.email,
              )) as LinkMethod[];
            } catch {
              // See comment above — `methods` stays empty.
            }
            const attempted: LinkMethod = provider === 'google' ? 'google.com' : 'github.com';
            setPendingLink({ email: decision.email, methods, attempted });
          }
          throw failure;
        }
      },
      linkPending: async (method, email, password) => {
        // Proof of possession takes the shape of whichever provider the
        // person already has: a password account proves it by re-entering the
        // password, a federated one by signing in through that provider's
        // popup again. Either is stronger than matching a verified e-mail —
        // a demonstration, not a claim — and this is Firebase's own check,
        // not ours.
        const existing =
          method === 'password'
            ? await signInWithEmailAndPassword(auth, email, password ?? '')
            : await signInWithPopup(
                auth,
                providers[method === 'google.com' ? 'google' : 'github'](),
              );
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

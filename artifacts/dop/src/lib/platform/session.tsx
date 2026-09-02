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
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';

import { auth } from './firebase';

type Session = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = React.createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(auth.currentUser);
  // It starts loading even when `currentUser` already exists: the SDK is still
  // going to restore the session from storage, and showing the sign-in screen in
  // that interval would make the page flash a sign-in that was not needed.
  const [loading, setLoading] = React.useState(true);

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
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    }),
    [user, loading],
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

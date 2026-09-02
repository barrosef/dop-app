/**
 * The cockpit's identity: Firebase Auth, the same verifier the BFF expects.
 *
 * The ID token from here goes as `Authorization: Bearer <token>` on every call
 * (see `backend.ts`). The SDK handles the refresh — an ID token is valid for an
 * hour, and `getIdToken()` returns a new one when the current one is close to
 * expiring.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';

import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_AUTH_EMULATOR_URL,
  FIREBASE_PROJECT_ID,
} from './config';

export const firebaseApp: FirebaseApp = initializeApp({
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
});

export const auth: Auth = getAuth(firebaseApp);

// The decision to talk to the emulator comes from the ENVIRONMENT, never from
// the token's content — the same rule the BFF applies on the other side. A token
// that declares itself unsigned must not choose its own validation path.
if (FIREBASE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(auth, FIREBASE_AUTH_EMULATOR_URL, {
    disableWarnings: false,
  });
}

/**
 * The current user's ID token, or `null` when there is no session.
 *
 * `getIdToken()` with no argument uses the SDK's cache and only goes to the
 * network when the token is expiring — calling it on every request is cheap and
 * is the recommended way never to send an expired token.
 */
export async function currentIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}

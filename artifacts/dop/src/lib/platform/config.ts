/**
 * The cockpit's configuration — everything that changes between environments
 * comes from `import.meta.env`.
 *
 * Nothing here has a production value baked in: a silent default pointing at
 * the wrong environment is the kind of mistake that only shows up after the
 * deploy.
 */

/** The BFF's origin (dop-api). Locally: `http://localhost:8000`. */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/**
 * The Firebase project. It has to be the SAME as the BFF's
 * (`FIREBASE_PROJECT`): it is what the token's audience is checked against in
 * production.
 */
export const FIREBASE_PROJECT_ID: string =
  import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'dop-local';

/**
 * Firebase's public API key. It is not a secret (it goes into the bundle); it
 * only identifies the project in the Identity Toolkit. Against the emulator,
 * any non-empty value will do.
 */
export const FIREBASE_API_KEY: string =
  import.meta.env.VITE_FIREBASE_API_KEY ?? 'fake-api-key';

export const FIREBASE_AUTH_DOMAIN: string =
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ??
  `${FIREBASE_PROJECT_ID}.firebaseapp.com`;

/**
 * The Firebase Auth emulator, when there is one (e.g.
 * `http://auth.localtest.me:8080`).
 *
 * Empty in production — and that is the only configuration difference between
 * the two worlds. The emulator issues an `alg: none` token, with no signature;
 * the real Firebase signs and the BFF VERIFIES. That is why nothing in this
 * cockpit may depend on the token not being verified: the same screen runs
 * against both.
 */
export const FIREBASE_AUTH_EMULATOR_URL: string =
  import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? '';

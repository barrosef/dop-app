/**
 * What a Firebase Auth failure MEANS, decided in one place.
 *
 * The screens used to collapse anything containing `auth/` into "invalid
 * e-mail or password". That is right for a wrong credential and wrong for
 * everything else — most damagingly for the case where the person already has
 * an account under another provider, who would be told their password is wrong
 * when they never had one.
 *
 * The cost of this file is one indirection between an SDK call and a message.
 * What it buys is that the decision is testable without a browser, which is the
 * only way this logic gets exercised at all.
 */

export type AuthDecision =
  | { kind: 'invalid-credential' }
  | { kind: 'link-required'; email: string }
  | { kind: 'misconfigured-domain' }
  | { kind: 'abandoned' }
  | { kind: 'weak-password' }
  | { kind: 'rate-limited' }
  | { kind: 'popup-blocked' }
  | { kind: 'unknown'; code: string };

function codeOf(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
}

function emailOf(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'customData' in err) {
    const data = (err as { customData?: { email?: unknown } }).customData;
    if (data && typeof data.email === 'string') return data.email;
  }
  return '';
}

export function decideFromAuthError(err: unknown): AuthDecision {
  const code = codeOf(err);
  switch (code) {
    // Three codes, one answer. Which of them Firebase returns depends on the
    // project's e-mail-enumeration protection, and the person must not be able
    // to tell the difference either way.
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return { kind: 'invalid-credential' };

    case 'auth/account-exists-with-different-credential':
    case 'auth/email-already-in-use':
      return { kind: 'link-required', email: emailOf(err) };

    // This means the current origin is missing from OUR project's Authorized
    // Domains list in the Firebase console — nothing the person or their
    // organization did. Neither they nor an administrator on their side can
    // fix it, so whatever message the UI attaches to this kind must not send
    // them to ask anybody: it is an alert for whoever runs this platform.
    case 'auth/unauthorized-domain':
      return { kind: 'misconfigured-domain' };

    // A GitHub organization that blocks third-party applications shows its own
    // restriction page inside the popup, not a Firebase error. If the person
    // closes that popup we only ever see `popup-closed-by-user` — the same
    // code as someone simply changing their mind. There is no error code that
    // tells the two apart, so resist the urge to guess: `abandoned` means "we
    // don't know why", not "they gave up".
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return { kind: 'abandoned' };

    case 'auth/weak-password':
      return { kind: 'weak-password' };

    // Retrying immediately will not help — Firebase is asking for a cool-down,
    // not a correction.
    case 'auth/too-many-requests':
      return { kind: 'rate-limited' };

    // Distinct from `abandoned`: the browser stopped the popup from opening at
    // all, so nothing was ever shown to the person. Reporting it as "you
    // changed your mind" would read as a dead button — this is the one case
    // among the popup failures the person can actually fix (allow popups).
    case 'auth/popup-blocked':
      return { kind: 'popup-blocked' };

    default:
      return { kind: 'unknown', code };
  }
}

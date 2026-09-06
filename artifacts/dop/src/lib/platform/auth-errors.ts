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
  | { kind: 'blocked-by-organization' }
  | { kind: 'abandoned' }
  | { kind: 'weak-password' }
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

    // Firebase reports an organization's third-party-application restriction as
    // an unauthorized domain. Retrying cannot help — an administrator has to act.
    case 'auth/unauthorized-domain':
      return { kind: 'blocked-by-organization' };

    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return { kind: 'abandoned' };

    case 'auth/weak-password':
      return { kind: 'weak-password' };

    default:
      return { kind: 'unknown', code };
  }
}

import { describe, expect, it } from 'vitest';

import { decideFromAuthError } from './auth-errors';

describe('decideFromAuthError', () => {
  it('collapses a wrong credential into one indistinguishable answer', () => {
    // Telling "no such account" from "wrong password" hands the user list to
    // whoever asks. All three codes Firebase can return here are one answer.
    for (const code of [
      'auth/wrong-password',
      'auth/user-not-found',
      'auth/invalid-credential',
    ]) {
      expect(decideFromAuthError({ code })).toEqual({ kind: 'invalid-credential' });
    }
  });

  it('does NOT collapse an account that exists under another provider', () => {
    // This is not a failure — it is the linking path. Collapsing it into
    // "invalid credential" is the bug this function exists to prevent: the
    // person would be told their password is wrong when they have no password.
    const decision = decideFromAuthError({
      code: 'auth/account-exists-with-different-credential',
      customData: { email: 'ana@example.com' },
    });
    expect(decision).toEqual({ kind: 'link-required', email: 'ana@example.com' });
  });

  it('recognises an organization that blocks third-party applications', () => {
    // The person did nothing wrong and retrying will not help: an administrator
    // has to approve. A generic message would send them round the loop forever.
    expect(decideFromAuthError({ code: 'auth/unauthorized-domain' })).toEqual({
      kind: 'blocked-by-organization',
    });
  });

  it('reports a closed popup as an abandonment, not an error', () => {
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']) {
      expect(decideFromAuthError({ code })).toEqual({ kind: 'abandoned' });
    }
  });

  it('names a weak password so the person knows what to change', () => {
    expect(decideFromAuthError({ code: 'auth/weak-password' })).toEqual({
      kind: 'weak-password',
    });
  });

  it('keeps an unknown failure distinguishable instead of guessing', () => {
    expect(decideFromAuthError({ code: 'auth/network-request-failed' })).toEqual({
      kind: 'unknown',
      code: 'auth/network-request-failed',
    });
    expect(decideFromAuthError(new Error('boom'))).toEqual({
      kind: 'unknown',
      code: '',
    });
  });

  it('treats an e-mail already in use as the linking path, not a refusal', () => {
    expect(
      decideFromAuthError({ code: 'auth/email-already-in-use' }),
    ).toEqual({ kind: 'link-required', email: '' });
  });
});

/**
 * The verification gate — for a PASSWORD-ONLY account, and only that one.
 *
 * `App.tsx` sends a signed-in user here when every entry in
 * `providerData` is `password` and `emailVerified` is false. Gating on
 * `emailVerified` alone, with no regard for the provider, would lock out
 * every GitHub user: GitHub frequently reports an unverified address for an
 * account nobody doubts is real, because somebody already authenticated that
 * person by way of the popup. This screen exists for the one method that
 * proves nothing on its own — a password anyone could have typed for any
 * address.
 */
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, MailCheck } from 'lucide-react';

import { useSession } from '../lib/platform/session';
import { decideFromAuthError, type AuthDecision } from '../lib/platform/auth-errors';
import { auth } from '../lib/platform/firebase';
import { useI18n } from '../lib/i18n';

type T = ReturnType<typeof useI18n.getState>['t'];

// The resend is rate-limited by design (`auth/too-many-requests`), so THAT
// kind is the one the person will realistically hit; anything else still
// gets a real message instead of leaving the click looking like it did
// nothing.
function messageFor(t: T, decision: AuthDecision): string {
  if (decision.kind === 'rate-limited') return t('auth.error.rateLimited');
  return t('auth.error.unknown', {
    code: decision.kind === 'unknown' ? decision.code : decision.kind,
  });
}

export default function VerifyEmail() {
  const { sendVerification, signOut } = useSession();
  const navigate = useNavigate();
  const t = useI18n((s) => s.t);
  const [resent, setResent] = React.useState(false);
  const [resendError, setResendError] = React.useState('');
  const [notYet, setNotYet] = React.useState(false);
  const [checking, setChecking] = React.useState(false);

  const user = auth.currentUser;
  if (!user) return <Navigate to="/sign-in" replace />;

  async function onResend() {
    setResent(false);
    setResendError('');
    try {
      await sendVerification();
      setResent(true);
    } catch (failure) {
      // Unlike `signUp`'s own send, this button IS the person's recourse —
      // letting the rejection (routinely `auth/too-many-requests`, since the
      // resend is deliberately rate-limited) go unhandled would make that
      // recourse fail as silently as the thing it exists to fix.
      setResendError(messageFor(t, decideFromAuthError(failure)));
    }
  }

  // Somebody who mistyped their address at sign-up can neither receive the
  // verification mail nor reach any other screen — `App.tsx` routes `/` back
  // to `/verify-email` and `/sign-in` back to `/` for as long as this session
  // is signed in. Signing out is the only way off this screen for them.
  async function onSignOut() {
    await signOut();
    navigate('/sign-in');
  }

  async function onCheck() {
    setNotYet(false);
    setChecking(true);
    try {
      // `emailVerified` on a cached `User` object is a snapshot from the
      // last token refresh — the SDK does not learn about a click on a link
      // in another tab by itself. `reload()` is what actually asks Firebase
      // again before this code re-reads the field. Read `auth.currentUser`
      // fresh rather than the `user` captured above: TypeScript's narrowing
      // of that `const` does not reach into this nested function, and
      // `reload()` mutates the SDK's own object in place regardless.
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        navigate('/');
      } else {
        setNotYet(true);
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4 text-foreground">
      <div
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        data-testid="form-verify-email"
      >
        <div className="flex items-center gap-2">
          <MailCheck className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">{t('auth.verify.title')}</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('auth.verify.sent', { email: user.email ?? '' })}
        </p>

        {notYet ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span data-testid="text-verify-error">{t('auth.verify.notYet')}</span>
          </div>
        ) : null}

        {resendError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span data-testid="text-verify-resend-error">{resendError}</span>
          </div>
        ) : null}

        {resent ? (
          <p className="text-xs text-muted-foreground" data-testid="text-verify-resent">
            {t('auth.verify.resent')}
          </p>
        ) : null}

        <button
          type="button"
          disabled={checking}
          onClick={onCheck}
          className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          data-testid="button-verify-check"
        >
          {t('auth.verify.check')}
        </button>

        <button
          type="button"
          onClick={onResend}
          className="h-9 w-full rounded-md border border-border bg-background text-sm font-medium transition-opacity hover:opacity-90"
          data-testid="button-verify-resend"
        >
          {t('auth.verify.resend')}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          <button
            type="button"
            onClick={onSignOut}
            className="underline-offset-2 hover:underline"
            data-testid="link-verify-sign-out"
          >
            {t('auth.verify.signOut')}
          </button>
        </p>
      </div>
    </div>
  );
}

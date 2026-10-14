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
import { AlertTriangle, MailCheck, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { resendDelaySeconds } from '@/lib/platform/welcome';

import { useSession } from '../lib/platform/session';
import { decideFromAuthError, type AuthDecision } from '../lib/platform/auth-errors';
import { auth } from '../lib/platform/firebase';
import { useI18n } from '../lib/i18n';
import {
  verificationErrorDetail,
  isVerificationRateLimited,
  verificationErrorCode,
  verificationRetryAfterSeconds,
} from '../lib/platform/verification-errors';

type T = ReturnType<typeof useI18n.getState>['t'];

// The resend is rate-limited by design (`auth/too-many-requests`), so THAT
// kind is the one the person will realistically hit; anything else still
// gets a real message instead of leaving the click looking like it did
// nothing.
function messageFor(t: T, decision: AuthDecision, failure: unknown): string {
  if (isVerificationRateLimited(failure)) return t('auth.error.rateLimited');
  if (decision.kind === 'rate-limited') return t('auth.error.rateLimited');
  return t('auth.error.unknown', {
    code: decision.kind === 'unknown' ? verificationErrorCode(failure) : decision.kind,
  });
}

function applyResendFailure(
  t: T,
  failure: unknown,
  setResendError: (message: string) => void,
  setResendDetail: (detail: string) => void,
  setRetryAfterSeconds: (seconds: number | null) => void,
) {
  const rateLimited = isVerificationRateLimited(failure);
  const detail = rateLimited ? verificationErrorDetail(failure) : null;
  setResendError(messageFor(t, decideFromAuthError(failure), failure));
  setResendDetail(detail ?? '');
  setRetryAfterSeconds(verificationRetryAfterSeconds(failure));
}

export default function VerifyEmail() {
  const {
    sendVerification,
    signOut,
    verificationSent,
    verificationEmail,
    verificationError,
  } = useSession();
  const navigate = useNavigate();
  const t = useI18n((s) => s.t);
  const [resent, setResent] = React.useState(false);
  const [resendError, setResendError] = React.useState('');
  const [resendDetail, setResendDetail] = React.useState('');
  const [retryAfterSeconds, setRetryAfterSeconds] = React.useState<number | null>(null);
  const [notYet, setNotYet] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  // The visible countdown: sign-up already sent one message, so the first
  // resend waits too; each later send waits longer. A `Retry-After` from the
  // server always wins when it is longer.
  const [sends, setSends] = React.useState(1);
  const [cooldown, setCooldown] = React.useState(() => resendDelaySeconds(1));

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  React.useEffect(() => {
    if (retryAfterSeconds !== null) setCooldown((c) => Math.max(c, retryAfterSeconds));
  }, [retryAfterSeconds]);

  const user = auth.currentUser;

  React.useEffect(() => {
    if (!verificationError) {
      setResendError('');
      setResendDetail('');
      setRetryAfterSeconds(null);
      return;
    }
    setResent(false);
    applyResendFailure(
      t,
      verificationError,
      setResendError,
      setResendDetail,
      setRetryAfterSeconds,
    );
  }, [t, verificationError]);

  if (!user) return <Navigate to="/sign-in" replace />;

  async function onResend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    setResent(false);
    setResendError('');
    setResendDetail('');
    setRetryAfterSeconds(null);
    try {
      const response = await sendVerification();
      // A null response means the Firebase identity changed while the
      // request was in flight. Session state was discarded; do not claim a
      // resend for the new identity.
      if (response) {
        setResent(true);
        const next = sends + 1;
        setSends(next);
        setCooldown(resendDelaySeconds(next));
      }
    } catch (failure) {
      // Unlike `signUp`'s own send, this button IS the person's recourse —
      // letting the rejection (routinely `auth/too-many-requests`, since the
      // resend is deliberately rate-limited) go unhandled would make that
      // recourse fail as silently as the thing it exists to fix.
      applyResendFailure(
        t,
        failure,
        setResendError,
        setResendDetail,
        setRetryAfterSeconds,
      );
    } finally {
      setResending(false);
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

  // *I typed the wrong address*: the address is the credential's, so the way
  // to fix it is to leave this session and sign up again with the right one.
  async function onWrongAddress() {
    await signOut();
    navigate('/sign-up');
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 text-foreground">
      <div
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        data-testid="form-verify-email"
      >
        <div className="flex items-center gap-2">
          <MailCheck className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">{t('auth.verify.title')}</h1>
        </div>
        {verificationSent || resent ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid={resent ? 'text-verify-resent' : 'text-verify-sent'}
          >
            {resent
              ? t('auth.verify.resent')
              : t('auth.verify.sent', {
                  email: verificationEmail ?? user.email ?? '',
                })}
          </p>
        ) : null}

        {notYet ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span data-testid="text-verify-error">{t('auth.verify.notYet')}</span>
          </div>
        ) : null}

        {resendError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              <span data-testid="text-verify-resend-error">{resendError}</span>
              {resendDetail ? (
                <span className="block" data-testid="text-verify-resend-detail">
                  {resendDetail}
                </span>
              ) : null}
              {retryAfterSeconds !== null ? (
                <span className="block" data-testid="text-verify-retry-after">
                  {t('welcome.error.retryAfter', {
                    s: retryAfterSeconds,
                  })}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <Button
          disabled={checking}
          onClick={onCheck}
          className="w-full"
          data-testid="button-verify-check"
        >
          {t('auth.verify.check')}
        </Button>

        <Button
          variant="outline"
          onClick={onResend}
          disabled={cooldown > 0 || resending}
          className="w-full"
          data-testid="button-verify-resend"
        >
          <RotateCw />
          {cooldown > 0 ? (
            <span className="tabular-nums" data-testid="text-verify-countdown">
              {t('auth.verify.resendIn', { s: cooldown })}
            </span>
          ) : (
            t('auth.verify.resend')
          )}
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Button
            variant="link"
            size="sm"
            onClick={onWrongAddress}
            className="h-auto p-0 text-muted-foreground"
            data-testid="link-verify-wrong-address"
          >
            {t('auth.verify.wrongAddress')}
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={onSignOut}
            className="h-auto p-0 text-muted-foreground"
            data-testid="link-verify-sign-out"
          >
            {t('auth.verify.signOut')}
          </Button>
        </div>
      </div>
    </div>
  );
}

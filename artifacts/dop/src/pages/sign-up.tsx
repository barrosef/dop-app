/**
 * Creating an account — e-mail and password, or a provider popup.
 *
 * Modelled on `sign-in.tsx`: same card, same layout, same `data-testid`
 * convention. The provider buttons here and on `sign-in.tsx` are the SAME
 * call (`signInWith`) — a provider sign-in creates the account when there is
 * none, so one control does both jobs.
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Chrome, Github, TerminalSquare } from 'lucide-react';

import { useSession } from '../lib/platform/session';
import { decideFromAuthError, type AuthDecision } from '../lib/platform/auth-errors';
import { FIREBASE_AUTH_EMULATOR_URL } from '../lib/platform/config';
import { useI18n } from '../lib/i18n';

type T = ReturnType<typeof useI18n.getState>['t'];

// Shared between the password form and the provider buttons: both end up with
// an `AuthDecision` and both display it the same way, except for
// `link-required`, which is not a message at all — it sends the person
// somewhere instead — and is handled by the caller before this runs.
function messageFor(t: T, decision: AuthDecision): string {
  switch (decision.kind) {
    case 'invalid-credential':
      return t('auth.invalid');
    case 'weak-password':
      return t('auth.error.weakPassword');
    case 'misconfigured-domain':
      return t('auth.error.misconfigured');
    case 'abandoned':
      // Firebase reports a deliberate cancel and an org blocking third-party
      // apps with the SAME code — see `auth-errors.ts`. This line has to
      // read true for both without claiming to know which one happened.
      return t('auth.error.abandoned');
    case 'rate-limited':
      return t('auth.error.rateLimited');
    case 'popup-blocked':
      return t('auth.error.popupBlocked');
    case 'unknown':
      return t('auth.error.unknown', { code: decision.code });
    default:
      return t('auth.error.unknown', { code: decision.kind });
  }
}

export default function SignUp() {
  const { signUp, signInWith } = useSession();
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Read the decision from the CAUGHT ERROR, never from `pendingLink` state:
  // `signInWith` sets that state and then rethrows in the same tick, and a
  // `catch` running right after still sees the value from before the update
  // (React state, not a ref). `/link-provider` is the right place to read
  // `pendingLink` — its own render happens after the update has landed.
  //
  // `viaProvider` tells the two callers apart: `onProvider`'s `signInWith`
  // always captures a credential to attach before rethrowing, so a
  // `link-required` from there belongs on `/link-provider`. `onSubmit`'s
  // `signUp` (typing an e-mail that already has an account) never captures
  // one — `pendingLink` stays null for it — so sending it to
  // `/link-provider` would only bounce it straight back here with nothing
  // shown. Landing on `/sign-in` directly, with the reason carried in router
  // state, is the one redirect instead of two.
  function handleFailure(failure: unknown, viaProvider: boolean): void {
    const decision = decideFromAuthError(failure);
    if (decision.kind === 'link-required') {
      if (viaProvider) {
        navigate('/link-provider');
      } else {
        navigate('/sign-in', { state: { linkEmail: decision.email } });
      }
      return;
    }
    setError(messageFor(t, decision));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signUp(email, password);
      navigate('/verify-email');
    } catch (failure) {
      handleFailure(failure, false);
    } finally {
      setSubmitting(false);
    }
  }

  async function onProvider(provider: 'google' | 'github') {
    setError('');
    try {
      await signInWith(provider);
      // A provider account is never password-only, so the verification gate
      // never sends it to `/verify-email` — landing on `/` is always right.
      navigate('/');
    } catch (failure) {
      handleFailure(failure, true);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4 text-foreground">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        data-testid="form-sign-up"
      >
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">{t('auth.signUp.title')}</h1>
        </div>
        <p className="text-xs text-muted-foreground">{t('auth.signUp.subtitle')}</p>

        <label className="block space-y-1">
          <span className="text-xs font-medium">{t('auth.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
            data-testid="input-email"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium">{t('auth.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
            data-testid="input-password"
          />
        </label>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span data-testid="text-sign-up-error">{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          data-testid="button-sign-up"
        >
          {submitting ? t('auth.signUp.submitting') : t('auth.signUp.submit')}
        </button>

        <div className="flex items-center gap-2 text-[10px] uppercase text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          {t('auth.or')}
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={() => onProvider('google')}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium transition-opacity hover:opacity-90"
          data-testid="button-google"
        >
          <Chrome className="h-4 w-4" />
          {t('auth.with.google')}
        </button>

        <button
          type="button"
          onClick={() => onProvider('github')}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium transition-opacity hover:opacity-90"
          data-testid="button-github"
        >
          <Github className="h-4 w-4" />
          {t('auth.with.github')}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/sign-in" data-testid="link-sign-in">
            {t('auth.signUp.haveAccount')}
          </Link>
        </p>

        {FIREBASE_AUTH_EMULATOR_URL ? (
          <p className="text-center text-[10px] text-amber-400/80">
            {t('auth.emulator', { url: FIREBASE_AUTH_EMULATOR_URL })}
          </p>
        ) : null}
      </form>
    </div>
  );
}

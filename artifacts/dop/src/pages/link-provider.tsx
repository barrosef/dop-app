/**
 * Landing in the account you already have.
 *
 * Reached after a provider popup (or a sign-up) collides with an e-mail that
 * already has an account under a different method. `session.tsx` keeps the
 * blocked credential in a `useRef`, never in storage — it is a bearer
 * credential, and writing it to disk would outlive the moment it is good
 * for. That is also this screen's one hard limit: `pendingLink` lives only
 * in memory, so a reload — or opening this URL directly — has already lost
 * it, and there is nothing here to recover it from. Bouncing to `/sign-in`
 * is a deliberate response to that limit, not an oversight.
 */
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, Chrome, Github, KeyRound } from 'lucide-react';

import { useSession } from '../lib/platform/session';
import { decideFromAuthError, type AuthDecision } from '../lib/platform/auth-errors';
import { useI18n } from '../lib/i18n';

type T = ReturnType<typeof useI18n.getState>['t'];
type LinkMethod = 'password' | 'google.com' | 'github.com';

// `weak-password` is not reachable from THIS screen — `linkPending` only ever
// calls `signInWithEmailAndPassword` (proving a password that already
// exists) or `signInWithPopup`, never `createUserWithEmailAndPassword`,
// which is the only call that can produce it. No case for it here; the
// default below still gives it a real message rather than an empty box, in
// case that ever changes.
function messageFor(t: T, decision: AuthDecision): string {
  switch (decision.kind) {
    case 'invalid-credential':
      return t('auth.invalid');
    case 'link-required':
      // Excluding the just-attempted provider from `offered` (below) removes
      // the one collision we know about, but not every one there could ever
      // be — an empty error box would still read as a dead button for
      // whichever edge case remains.
      return t('auth.error.linkRequired');
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

// `fetchSignInMethodsForEmail` returns an EMPTY array when the project has
// e-mail enumeration protection on — a normal answer, not a failure. Offering
// all three ways in when that happens is the only choice that never
// dead-ends: the alternative (showing nothing) would strand the person with
// a screen that has no button on it at all. The provider the person just
// tried is dropped from the result regardless (see `offered` below): that is
// the one method `account-exists-with-different-credential` just proved is
// NOT on this account.
const ALL_METHODS: LinkMethod[] = ['password', 'google.com', 'github.com'];

export default function LinkProvider() {
  const { pendingLink, linkPending } = useSession();
  const navigate = useNavigate();
  const t = useI18n((s) => s.t);
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  if (!pendingLink) return <Navigate to="/sign-in" replace />;

  const { email, methods, attempted } = pendingLink;
  const offered = (methods.length > 0 ? methods : ALL_METHODS).filter(
    (method) => method !== attempted,
  );

  async function connect(method: LinkMethod, methodPassword?: string) {
    setError('');
    setSubmitting(true);
    try {
      await linkPending(method, email, methodPassword);
      navigate('/');
    } catch (failure) {
      const decision = decideFromAuthError(failure);
      setError(messageFor(t, decision));
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmitPassword(event: React.FormEvent) {
    event.preventDefault();
    void connect('password', password);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4 text-foreground">
      <div
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        data-testid="form-link-provider"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">{t('auth.link.title')}</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('auth.link.explain', { email })}
        </p>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span data-testid="text-link-provider-error">{error}</span>
          </div>
        ) : null}

        {offered.includes('password') ? (
          <form onSubmit={onSubmitPassword} className="space-y-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium">{t('auth.password')}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                data-testid="input-password"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              data-testid="button-link-submit"
            >
              {t('auth.link.submit')}
            </button>
          </form>
        ) : null}

        {offered.includes('google.com') ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => connect('google.com')}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            data-testid="button-google"
          >
            <Chrome className="h-4 w-4" />
            {t('auth.with.google')}
          </button>
        ) : null}

        {offered.includes('github.com') ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => connect('github.com')}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            data-testid="button-github"
          >
            <Github className="h-4 w-4" />
            {t('auth.with.github')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

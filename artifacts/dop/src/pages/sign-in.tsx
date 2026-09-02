/**
 * Signing in — e-mail and password against Firebase Auth.
 *
 * The same code runs against the emulator (locally) and against the real
 * Firebase (production): only the address changes, in
 * `VITE_FIREBASE_AUTH_EMULATOR_URL`. The emulator's token comes with
 * `alg: none`, with no signature — in production it is signed and the BFF checks
 * the signature, the issuer and the audience. Nothing on this screen may assume
 * the difference.
 */
import React from 'react';
import { AlertTriangle, TerminalSquare } from 'lucide-react';

import { useSession } from '../lib/platform/session';
import { FIREBASE_AUTH_EMULATOR_URL } from '../lib/platform/config';
import { useI18n } from '../lib/i18n';

export default function SignIn() {
  const { signIn } = useSession();
  const t = useI18n((s) => s.t);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (failure) {
      // A single message for a wrong credential: telling "this e-mail does not
      // exist" from "wrong password" hands the user list to whoever asks.
      setError(
        failure instanceof Error && failure.message.includes('auth/')
          ? t('auth.invalid')
          : t('auth.failed', { reason: (failure as Error).message }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4 text-foreground">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        data-testid="form-sign-in"
      >
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">{t('auth.title')}</h1>
        </div>
        <p className="text-xs text-muted-foreground">{t('auth.subtitle')}</p>

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
            autoComplete="current-password"
            required
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
            data-testid="input-password"
          />
        </label>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span data-testid="text-sign-in-error">{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          data-testid="button-sign-in"
        >
          {submitting ? t('auth.submitting') : t('auth.submit')}
        </button>

        {FIREBASE_AUTH_EMULATOR_URL ? (
          <p className="text-center text-[10px] text-amber-400/80">
            {t('auth.emulator', { url: FIREBASE_AUTH_EMULATOR_URL })}
          </p>
        ) : null}
      </form>
    </div>
  );
}

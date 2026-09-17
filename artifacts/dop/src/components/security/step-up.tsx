/**
 * The second factor's challenge — the screen that stands between the sign-in and
 * the cockpit (ADR-0020).
 *
 * The rule is NOT here. Which factor answers, how many attempts are left and
 * for how long the session stays stepped up are the core's answers; this screen
 * asks, shows and repeats what came back. Recomputing any of it here would be
 * the second ruler this platform keeps refusing.
 *
 * What it does own is the choice of WHAT to say: "check your e-mail" and "check
 * your phone" are different screens, and guessing between them is what makes
 * people wait for a message that is not coming.
 */
import React from 'react';
import { AlertTriangle, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import {
  getSecondFactorStateQueryKey,
  useChallengeSecondFactor,
  useVerifyRecoveryCode,
  useVerifySecondFactor,
  type ChallengeResponse,
  type FactorSummary,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../lib/i18n';

type Props = {
  factors: FactorSummary[];
  onVerified: () => void;
};

export function StepUp({ factors, onVerified }: Props) {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();

  const active = factors.filter((f) => f.status === 'active');
  const [factorId, setFactorId] = React.useState(
    active.length === 1 ? active[0].id : '',
  );
  const [challenge, setChallenge] = React.useState<ChallengeResponse | null>(null);
  const [code, setCode] = React.useState('');
  const [recovery, setRecovery] = React.useState(false);
  const [error, setError] = React.useState('');

  const start = useChallengeSecondFactor();
  const verify = useVerifySecondFactor();
  const useRecovery = useVerifyRecoveryCode();

  // The challenge starts as soon as the factor is known. For e-mail and SMS
  // that SENDS the code — which is why it does not fire while the person is
  // still choosing: it would send a message (and spend money) for a factor they
  // did not pick.
  React.useEffect(() => {
    if (!factorId || challenge || recovery) return;
    start.mutate(
      { data: { factor_id: factorId } },
      {
        onSuccess: (c) => setChallenge(c),
        onError: (e) => setError((e as Error).message),
      },
    );
  }, [factorId, challenge, recovery]);

  function done() {
    // The state is what says whether the session is stepped up; invalidating it
    // is what makes the shell let the person through.
    queryClient.invalidateQueries({ queryKey: getSecondFactorStateQueryKey() });
    onVerified();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (recovery) {
      useRecovery.mutate(
        { data: { code } },
        { onSuccess: done, onError: (e) => setError((e as Error).message) },
      );
      return;
    }
    if (!challenge) return;
    verify.mutate(
      { data: { challenge_id: challenge.challenge_id, code } },
      { onSuccess: done, onError: (e) => setError((e as Error).message) },
    );
  }

  const working = verify.isPending || useRecovery.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        data-testid="step-up"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">{t('twofa.title')}</h1>
        </div>
        <p className="text-xs text-muted-foreground">{t('twofa.subtitle')}</p>

        {/* With more than one factor the person chooses. The core refuses to
            choose for them — it would send an SMS to somebody who wanted TOTP. */}
        {!recovery && active.length > 1 && !challenge ? (
          <div className="space-y-2">
            <p className="text-xs font-medium">{t('twofa.chooseFactor')}</p>
            {active.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFactorId(f.id)}
                className="w-full rounded-md border border-border/60 px-3 py-2 text-left text-xs hover:border-primary/40 hover:bg-muted/40"
              >
                <span className="font-medium">{t(`twofa.method.${f.kind}` as never)}</span>
                {f.masked_destination ? (
                  <span className="ml-2 text-muted-foreground">{f.masked_destination}</span>
                ) : null}
                <span className="ml-2 text-muted-foreground">· {f.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {recovery ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="recovery-code">
              {t('twofa.recovery.label')}
            </label>
            <input
              id="recovery-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder="XXXXXXXX-XXXXXXXX"
            />
            <p className="text-[11px] text-muted-foreground">{t('twofa.recovery.hint')}</p>
          </div>
        ) : challenge ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {challenge.kind === 'totp'
                ? t('twofa.code.totp')
                : t(`twofa.code.sent.${challenge.kind}` as never, {
                    destination: challenge.masked_destination ?? '',
                  })}
            </p>
            <label className="text-xs font-medium" htmlFor="otp">
              {t('twofa.code.label')}
            </label>
            <input
              id="otp"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.4em]"
              placeholder="000000"
            />
            {challenge.kind !== 'totp' ? (
              <p className="text-[11px] text-muted-foreground">{t('twofa.code.expires')}</p>
            ) : null}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> {t('twofa.verifying')}
          </p>
        )}

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t('twofa.failed', { reason: error })}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={working || !code || (!challenge && !recovery)}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {working ? t('twofa.verifying') : t('twofa.verify')}
        </button>

        <div className="flex items-center justify-between text-[11px]">
          {/* Resending is only offered where there is something to resend: a
              TOTP has no message to send again. */}
          {challenge && challenge.kind !== 'totp' && !recovery ? (
            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setCode('');
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              {t('twofa.resend')}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => {
              setRecovery((v) => !v);
              setCode('');
              setError('');
            }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <KeyRound className="h-3 w-3" />
            {recovery ? t('twofa.useFactor') : t('twofa.useRecovery')}
          </button>
        </div>
      </form>
    </div>
  );
}

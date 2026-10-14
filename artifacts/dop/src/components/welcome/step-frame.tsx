import type { ReactNode } from 'react';
import { CornerDownRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useI18n } from '@/lib/i18n';
import { useJourney } from '@/hooks/use-welcome-step';
import { ApiErrorNotice } from './api-error';

/** The header every step shares: a channel index, a title and one line. */
export function StepHeader({
  kicker,
  title,
  lead,
}: {
  kicker: string;
  title: string;
  lead: string;
}) {
  return (
    <header className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{kicker}</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{title}</h1>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{lead}</p>
    </header>
  );
}

/**
 * The action bar: the primary action names what it does, *skip* is offered on
 * every step and the API decides whether it is accepted. Its refusal is
 * rendered here, with the step it names linked.
 */
export function StepActions({
  primaryLabel,
  onPrimary,
  primaryPending,
  primaryDisabled,
  onSkip,
  skipPending,
  error,
  extra,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryPending?: boolean;
  primaryDisabled?: boolean;
  onSkip?: () => void;
  skipPending?: boolean;
  error?: unknown;
  extra?: ReactNode;
}) {
  const t = useI18n((s) => s.t);
  const journey = useJourney();
  const stepKeys = journey.data?.steps.map((s) => s.step) ?? [];
  const busy = Boolean(primaryPending || skipPending);

  return (
    <div className="space-y-4">
      <Separator />
      {error ? <ApiErrorNotice error={error} stepKeys={stepKeys} testId="status-step-error" /> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onSkip ? (
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={busy}
            className="text-muted-foreground"
            data-testid="button-step-skip"
          >
            {skipPending ? <Loader2 className="animate-spin" /> : <CornerDownRight />}
            {t('welcome.action.skip')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {extra}
          <Button
            onClick={onPrimary}
            disabled={busy || primaryDisabled}
            className="min-w-44"
            data-testid="button-step-primary"
          >
            {primaryPending ? <Loader2 className="animate-spin" /> : null}
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

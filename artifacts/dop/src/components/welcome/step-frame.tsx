import type { ReactNode } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useJourney } from '@/hooks/use-welcome-step';
import { ApiErrorNotice } from './api-error';
import { narrativeFor } from './step-copy';

/**
 * The header every step shares: where this step sits in the API's order, a
 * question as the title, one line that answers it, and — folded — why the
 * platform asks. The position is read from `OnboardingState.steps`; a step
 * the API does not list (the final "ready" screen) shows no position.
 */
export function StepHeader({ step, title, lead }: { step: string; title: string; lead: string }) {
  const t = useI18n((s) => s.t);
  const journey = useJourney();
  const steps = journey.data?.steps ?? [];
  const index = steps.findIndex((s) => s.step === step);
  const why = narrativeFor(step);

  return (
    <header className="space-y-3">
      {index >= 0 ? (
        <p className="text-sm font-medium text-primary" data-testid="text-step-position">
          {t('welcome.header.position', { n: index + 1, total: steps.length })}
        </p>
      ) : null}
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
        {title}
      </h1>
      <p className="text-base leading-relaxed text-muted-foreground">{lead}</p>
      {why ? (
        <Collapsible className="pt-1">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="button-step-why"
            >
              {t('welcome.header.why')}
              <ChevronDown
                className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-foreground/90">
            <p>{t(why.what)}</p>
            <p>{t(why.does)}</p>
            {why.skip ? <p className="text-muted-foreground">{t(why.skip)}</p> : null}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </header>
  );
}

/** The surface a step's form lives on. One per step, never nested. */
export function StepPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 sm:p-6', className)}>{children}</div>
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
            {skipPending ? <Loader2 className="animate-spin" /> : null}
            {t('welcome.action.skip')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {extra}
          <Button
            size="lg"
            onClick={onPrimary}
            disabled={busy || primaryDisabled}
            className="min-w-48"
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

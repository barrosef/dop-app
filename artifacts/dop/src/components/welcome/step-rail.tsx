import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import type { OnboardingState } from '@workspace/api-client-react';

import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { welcomePathFor } from '@/lib/platform/welcome';
import { stepLabel } from './step-copy';

type Visual = 'done' | 'skipped' | 'current' | 'pending';

function visualOf(step: string, status: string, current: string): Visual {
  if (step === current) return 'current';
  if (status === 'done') return 'done';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function Dot({ visual, index }: { visual: Visual; index: number }) {
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors',
        visual === 'done' && 'border-primary bg-primary text-primary-foreground',
        visual === 'current' && 'border-primary text-primary',
        visual === 'skipped' && 'border-dashed border-muted-foreground/60 text-muted-foreground',
        visual === 'pending' && 'border-border text-muted-foreground',
      )}
      aria-hidden="true"
    >
      {visual === 'done' ? (
        <Check className="h-3.5 w-3.5" />
      ) : visual === 'skipped' ? (
        <Minus className="h-3.5 w-3.5" />
      ) : (
        index + 1
      )}
    </span>
  );
}

/**
 * The stepper: every step the API lists, in the API's order, as a row across
 * the top. `viewing` is the step on screen (the URL), which may differ from
 * the API's `current` when the person walks back to revisit one. Skipped is
 * a choice, drawn as such — not as an error.
 */
export function StepRail({ state, viewing }: { state: OnboardingState; viewing: string }) {
  const t = useI18n((s) => s.t);
  return (
    <ol className="flex items-center gap-1" data-testid="rail-steps">
      {state.steps.map((s, index) => {
        const visual = visualOf(s.step, s.status, state.current);
        const onScreen = s.step === viewing;
        return (
          <li key={s.step} className="flex items-center gap-1">
            {index > 0 ? (
              <span
                className={cn('h-px w-5 xl:w-8', visual === 'pending' ? 'bg-border' : 'bg-primary/50')}
                aria-hidden="true"
              />
            ) : null}
            <Link
              to={welcomePathFor(s.step)}
              aria-current={onScreen ? 'step' : undefined}
              data-testid={`rail-step-${s.step}`}
              data-state={visual}
              title={
                visual === 'done'
                  ? t('welcome.rail.done')
                  : visual === 'skipped'
                    ? t('welcome.rail.skipped')
                    : visual === 'current'
                      ? t('welcome.rail.current')
                      : t('welcome.rail.pending')
              }
              className={cn(
                'flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                onScreen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <Dot visual={visual} index={index} />
              <span className={cn('hidden xl:inline', (onScreen || visual === 'current') && 'font-medium')}>
                {stepLabel(t, s.step)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Phone width: the stepper collapses to a position line and a progress bar. */
export function StepStrip({ state, viewing }: { state: OnboardingState; viewing: string }) {
  const t = useI18n((s) => s.t);
  const index = state.steps.findIndex((s) => s.step === viewing);
  const done = state.steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const percent = state.steps.length ? Math.round((done / state.steps.length) * 100) : 0;
  return (
    <div className="space-y-2" data-testid="strip-steps">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium text-foreground">{stepLabel(t, viewing)}</span>
        {index >= 0 ? (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {t('welcome.rail.position', { n: index + 1, total: state.steps.length })}
          </span>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

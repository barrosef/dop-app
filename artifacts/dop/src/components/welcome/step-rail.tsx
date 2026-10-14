import { Link } from 'react-router-dom';
import { Check, CornerDownRight } from 'lucide-react';
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

/**
 * The rail: every step the API lists, in the API's order. `viewing` is the
 * step on screen (the URL), which may differ from the API's `current` when the
 * person walks back to revisit one.
 */
export function StepRail({ state, viewing }: { state: OnboardingState; viewing: string }) {
  const t = useI18n((s) => s.t);
  return (
    <ol className="space-y-px" data-testid="rail-steps">
      {state.steps.map((s, index) => {
        const visual = visualOf(s.step, s.status, state.current);
        const onScreen = s.step === viewing;
        return (
          <li key={s.step}>
            <Link
              to={welcomePathFor(s.step)}
              aria-current={onScreen ? 'step' : undefined}
              data-testid={`rail-step-${s.step}`}
              data-state={visual}
              className={cn(
                'group relative flex items-center gap-3 border-l-2 py-2.5 pl-4 pr-3 text-sm outline-none transition-colors focus-visible:bg-muted',
                onScreen ? 'border-primary bg-muted/60' : 'border-transparent hover:bg-muted/40',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] tabular-nums',
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
                  <CornerDownRight className="h-3 w-3" />
                ) : (
                  String(index + 1).padStart(2, '0')
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate',
                    visual === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                    visual === 'current' && 'font-medium',
                  )}
                >
                  {stepLabel(t, s.step)}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {visual === 'done' && t('welcome.rail.done')}
                  {visual === 'skipped' && t('welcome.rail.skipped')}
                  {visual === 'current' && t('welcome.rail.current')}
                  {visual === 'pending' && t('welcome.rail.pending')}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Phone width: the rail collapses to a progress strip at the top. */
export function StepStrip({ state, viewing }: { state: OnboardingState; viewing: string }) {
  const t = useI18n((s) => s.t);
  const index = state.steps.findIndex((s) => s.step === viewing);
  return (
    <div className="space-y-2" data-testid="strip-steps">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate font-medium text-foreground">{stepLabel(t, viewing)}</span>
        {index >= 0 ? (
          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
            {t('welcome.rail.position', { n: index + 1, total: state.steps.length })}
          </span>
        ) : null}
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {state.steps.map((s) => {
          const visual = visualOf(s.step, s.status, state.current);
          return (
            <Link
              key={s.step}
              to={welcomePathFor(s.step)}
              tabIndex={-1}
              className={cn(
                'h-1 flex-1 rounded-full',
                visual === 'done' && 'bg-primary',
                visual === 'current' && 'bg-primary/60',
                visual === 'skipped' && 'bg-muted-foreground/40',
                visual === 'pending' && 'bg-border',
                s.step === viewing && 'ring-1 ring-primary ring-offset-1 ring-offset-background',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

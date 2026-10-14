import { useEffect, useState } from 'react';
import { Check, Mail } from 'lucide-react';
import {
  getListPlansQueryKey,
  getListAccountsQueryKey,
  useListPlans,
  useSetPlan,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { ApiErrorNotice } from '@/components/welcome/api-error';
import { StepActions, StepHeader } from '@/components/welcome/step-frame';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useAccount } from '@/lib/platform/account';
import { ENTERPRISE_CONTACT_EMAIL } from '@/lib/platform/config';
import { useJourney, useWelcomeStep } from '@/hooks/use-welcome-step';

/**
 * The API has no field that marks a plan as "talk to us". The enterprise
 * plan is recognised by its key until the catalogue says so itself.
 */
const CONTACT_PLAN_KEY = 'enterprise';

/**
 * Every plan the API lists, in the API's order, no price and no hole where a
 * price would go (spec D-6). The first listed plan is preselected unless the
 * journey already recorded one. Which plans exist is the catalogue's call —
 * nothing is filtered here.
 */
export default function WelcomePlan() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { activeAccount } = useAccount();
  const journey = useJourney();
  const plans = useListPlans({
    query: { queryKey: getListPlansQueryKey(), enabled: Boolean(activeAccount) },
  });
  const setPlan = useSetPlan();
  const step = useWelcomeStep('plan');
  const [selected, setSelected] = useState('');
  const listed = plans.data;

  useEffect(() => {
    if (selected || !listed?.length) return;
    const recorded = journey.data?.plan_key;
    setSelected(recorded && listed.some((p) => p.key === recorded) ? recorded : listed[0].key);
  }, [listed, journey.data?.plan_key, selected]);

  const chosen = listed?.find((p) => p.key === selected);

  async function choose() {
    if (!chosen) return;
    try {
      await setPlan.mutateAsync({ data: { plan_key: chosen.key } });
      void queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    } catch {
      return;
    }
    await step.record('done');
  }

  return (
    <div className="space-y-8">
      <StepHeader step="plan" title={t('welcome.plan.title')} lead={t('welcome.plan.lead')} />

      {plans.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : plans.error ? (
        <ApiErrorNotice error={plans.error} onRetry={() => void plans.refetch()} />
      ) : !listed?.length ? (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyTitle>{t('welcome.plan.empty.title')}</EmptyTitle>
            <EmptyDescription>{t('welcome.plan.empty.body')}</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => void plans.refetch()}>
            {t('welcome.error.retry')}
          </Button>
        </Empty>
      ) : (
        <RadioGroup
          value={selected}
          onValueChange={setSelected}
          className="grid gap-3"
          aria-label={t('welcome.plan.title')}
        >
          {listed.map((plan) => {
            const isSelected = plan.key === selected;
            const isContact = plan.key === CONTACT_PLAN_KEY;
            return (
              <Label
                key={plan.key}
                htmlFor={`plan-${plan.key}`}
                data-testid={`card-plan-${plan.key}`}
                className={cn(
                  'flex cursor-pointer items-start gap-4 rounded-lg border bg-card p-4 font-normal transition-colors sm:p-5',
                  isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-foreground/25',
                )}
              >
                <RadioGroupItem id={`plan-${plan.key}`} value={plan.key} className="mt-1" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-base font-semibold text-foreground">{plan.name}</p>
                    {plan.tagline ? (
                      <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                    ) : null}
                  </div>
                  {plan.features?.length ? (
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-sm text-foreground/85">
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {isContact ? (
                    ENTERPRISE_CONTACT_EMAIL ? (
                      <Button asChild variant="outline" size="sm" className="mt-1" data-testid="link-plan-contact">
                        <a href={`mailto:${ENTERPRISE_CONTACT_EMAIL}`}>
                          <Mail />
                          {t('welcome.plan.contact')}
                        </a>
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground" data-testid="text-plan-contact-unavailable">
                        {t('welcome.plan.contactUnavailable')}
                      </p>
                    )
                  ) : null}
                </div>
              </Label>
            );
          })}
        </RadioGroup>
      )}

      {setPlan.error ? <ApiErrorNotice error={setPlan.error} testId="status-plan-error" /> : null}

      <StepActions
        primaryLabel={chosen ? t('welcome.plan.primary', { name: chosen.name }) : t('welcome.plan.primaryNone')}
        onPrimary={() => void choose()}
        primaryPending={setPlan.isPending || step.pendingStatus === 'done'}
        primaryDisabled={!chosen}
        onSkip={() => void step.record('skipped')}
        skipPending={step.pendingStatus === 'skipped'}
        error={step.error}
      />
    </div>
  );
}

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
  // Current product scope: only the API's Community plan is offered.
  const availablePlans = plans.data?.filter((plan) => plan.key === 'community');

  useEffect(() => {
    if (selected || !availablePlans?.length) return;
    const recorded = journey.data?.plan_key;
    setSelected(
      recorded && availablePlans.some((p) => p.key === recorded) ? recorded : availablePlans[0].key,
    );
  }, [availablePlans, journey.data?.plan_key, selected]);

  const chosen = availablePlans?.find((p) => p.key === selected);

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
      <StepHeader
        kicker={t('welcome.plan.kicker')}
        title={t('welcome.plan.title')}
        lead={t('welcome.plan.lead')}
      />

      {plans.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : plans.error ? (
        <ApiErrorNotice error={plans.error} onRetry={() => void plans.refetch()} />
      ) : !availablePlans?.length ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyTitle>{t('welcome.plan.empty.title')}</EmptyTitle>
            <EmptyDescription>{t('welcome.plan.empty.body')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <RadioGroup
          value={selected}
          onValueChange={setSelected}
          className="grid gap-3 md:grid-cols-2"
          aria-label={t('welcome.plan.title')}
        >
          {availablePlans.map((plan) => {
            const isSelected = plan.key === selected;
            const isContact = plan.key === CONTACT_PLAN_KEY;
            return (
              <Label
                key={plan.key}
                htmlFor={`plan-${plan.key}`}
                data-testid={`card-plan-${plan.key}`}
                className={cn(
                  'relative flex cursor-pointer flex-col gap-3 border p-4 font-normal transition-colors',
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
                )}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem id={`plan-${plan.key}`} value={plan.key} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">{plan.name}</p>
                    {plan.tagline ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">{plan.tagline}</p>
                    ) : null}
                  </div>
                </div>
                {plan.features?.length ? (
                  <ul className="space-y-1.5 pl-7">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-foreground/85">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {isContact ? (
                  <div className="mt-auto pl-7 pt-1">
                    {ENTERPRISE_CONTACT_EMAIL ? (
                      <Button asChild variant="outline" size="sm" data-testid="link-plan-contact">
                        <a href={`mailto:${ENTERPRISE_CONTACT_EMAIL}`}>
                          <Mail />
                          {t('welcome.plan.contact')}
                        </a>
                      </Button>
                    ) : (
                      <p className="text-[11px] text-muted-foreground" data-testid="text-plan-contact-unavailable">
                        {t('welcome.plan.contactUnavailable')}
                      </p>
                    )}
                  </div>
                ) : null}
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

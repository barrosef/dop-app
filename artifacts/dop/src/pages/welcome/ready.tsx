import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Circle, Loader2, Minus, ShieldCheck } from 'lucide-react';
import {
  getListPlansQueryKey,
  getMeQueryKey,
  getOnboardingQueryKey,
  useCompleteOnboarding,
  useListPlans,
} from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorNotice } from '@/components/welcome/api-error';
import { StepHeader } from '@/components/welcome/step-frame';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useAccount } from '@/lib/platform/account';
import { welcomePathFor, type JourneyExit } from '@/lib/platform/welcome';
import { useJourneyExit } from '@/components/welcome/journey-exit';
import { useJourney } from '@/hooks/use-welcome-step';

type Tone = 'done' | 'open' | 'skipped';

function Row({
  tone,
  label,
  value,
  to,
  testId,
}: {
  tone: Tone;
  label: string;
  value: string;
  to: string;
  testId: string;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0" data-testid={testId}>
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
          tone === 'done' && 'border-primary bg-primary text-primary-foreground',
          tone === 'skipped' && 'border-dashed border-muted-foreground/60 text-muted-foreground',
          tone === 'open' && 'border-border text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {tone === 'done' ? (
          <Check className="h-3.5 w-3.5" />
        ) : tone === 'skipped' ? (
          <Minus className="h-3 w-3" />
        ) : (
          <Circle className="h-2 w-2" />
        )}
      </span>
      <span className="flex-1 text-sm text-foreground">{label}</span>
      <Link
        to={to}
        className="text-right text-sm tabular-nums text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {value}
      </Link>
    </li>
  );
}

/**
 * Ready to fly. The checklist reads `OnboardingState`; the primary action
 * calls `complete` first and, on a 412, shows the API's detail with the named
 * step linked. On success the welcome gate reverses and sends the person to
 * the exit chosen here — project creation lives outside the journey.
 */
export default function WelcomeReady() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { activeAccount } = useAccount();
  const journey = useJourney();
  const plans = useListPlans({
    query: { queryKey: getListPlansQueryKey(), enabled: Boolean(activeAccount) },
  });
  const complete = useCompleteOnboarding();
  const [pendingExit, setPendingExit] = useState<string | null>(null);

  const exitStore = useJourneyExit();

  // Complete first; the exit is recorded only once the API accepted, and the
  // gate reverses only when the refetched `/me` says onboarded.
  async function finish(exit: JourneyExit, action: string) {
    setPendingExit(action);
    try {
      const state = await complete.mutateAsync();
      exitStore.set(exit);
      queryClient.setQueryData(getOnboardingQueryKey(), state);
      await queryClient.invalidateQueries({ queryKey: getMeQueryKey() });
    } catch {
      exitStore.set(null);
    } finally {
      setPendingExit(null);
    }
  }

  if (journey.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (journey.error || !journey.data) {
    return <ApiErrorNotice error={journey.error} onRetry={() => void journey.refetch()} />;
  }

  const s = journey.data;
  const statusOf = (key: string) => s.steps.find((x) => x.step === key)?.status ?? '';
  const toneOf = (key: string): Tone =>
    statusOf(key) === 'done' ? 'done' : statusOf(key) === 'skipped' ? 'skipped' : 'open';
  const planName = !s.plan_key
    ? t('welcome.ready.planNone')
    : plans.isLoading
      ? t('welcome.ready.planLoading')
      : plans.data?.find((p) => p.key === s.plan_key)?.name ?? s.plan_key;
  const phoneValue = !s.phone
    ? t('welcome.ready.phoneNone')
    : s.phone_verified
      ? t('welcome.ready.phoneVerified')
      : t('welcome.ready.phoneUnverified');
  const hasCode = s.code_connections > 0;
  const stepKeys = s.steps.map((x) => x.step);

  return (
    <div className="space-y-8">
      <StepHeader step="ready" title={t('welcome.ready.title')} lead={t('welcome.ready.lead')} />

      <ul className="overflow-hidden rounded-xl border border-border bg-card" data-testid="list-ready-checklist">
        <Row tone={toneOf('profile')} label={t('welcome.ready.profile')} value={t('welcome.ready.profileValue')} to={welcomePathFor('profile')} testId="row-ready-profile" />
        <Row tone={s.phone_verified ? 'done' : toneOf('contact')} label={t('welcome.ready.phone')} value={phoneValue} to={welcomePathFor('contact')} testId="row-ready-phone" />
        <Row
          tone={hasCode ? 'done' : toneOf('code')}
          label={t('welcome.ready.code')}
          value={t('welcome.ready.connections', { n: s.code_connections })}
          to={welcomePathFor('code')}
          testId="row-ready-code"
        />
        <Row
          tone={s.task_connections > 0 ? 'done' : toneOf('tasks')}
          label={t('welcome.ready.tasks')}
          value={s.task_connections > 0 ? t('welcome.ready.connections', { n: s.task_connections }) : t('welcome.ready.tasksNone')}
          to={welcomePathFor('tasks')}
          testId="row-ready-tasks"
        />
        <Row tone={s.plan_key ? 'done' : toneOf('plan')} label={t('welcome.ready.plan')} value={planName} to={welcomePathFor('plan')} testId="row-ready-plan" />
      </ul>

      {plans.error ? (
        <ApiErrorNotice error={plans.error} onRetry={() => void plans.refetch()} testId="status-ready-plans-error" />
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4 sm:flex-row sm:items-center">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="flex-1 space-y-0.5">
          <p className="text-sm font-medium text-foreground">{t('welcome.ready.protect.title')}</p>
          <p className="text-xs text-muted-foreground">{t('welcome.ready.protect.body')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pendingExit !== null}
          onClick={() => finish({ path: '/account', state: { tab: 'security' } }, 'security')}
          data-testid="button-ready-security"
        >
          {pendingExit === 'security' ? <Loader2 className="animate-spin" /> : null}
          {t('welcome.ready.protect.action')}
        </Button>
      </div>

      {complete.error ? (
        <ApiErrorNotice error={complete.error} stepKeys={stepKeys} testId="status-complete-error" />
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          disabled={pendingExit !== null}
          onClick={() => finish({ path: '/' }, 'cockpit')}
          data-testid="button-ready-cockpit"
        >
          {pendingExit === 'cockpit' ? <Loader2 className="animate-spin" /> : null}
          {t('welcome.ready.cockpit')}
        </Button>
        <Button
          size="lg"
          className="min-w-56"
          disabled={pendingExit !== null}
          onClick={() =>
            finish(
              hasCode
                ? { path: '/projects/new', state: { firstProject: true } }
                : { path: welcomePathFor('code') },
              'primary',
            )
          }
          data-testid="button-ready-primary"
        >
          {pendingExit === 'primary' ? (
            <Loader2 className="animate-spin" />
          ) : null}
          {hasCode ? t('welcome.ready.createProject') : t('welcome.ready.connectCode')}
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

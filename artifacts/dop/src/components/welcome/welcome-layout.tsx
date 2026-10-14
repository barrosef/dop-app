import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, TerminalSquare } from 'lucide-react';
import { getMeQueryKey, useMe } from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { useI18n } from '@/lib/i18n';
import { useAccount } from '@/lib/platform/account';
import { getActiveAccount } from '@/lib/platform/active-account';
import { useSession } from '@/lib/platform/session';
import { onboardingComplete, safeJourneyExit, welcomePathFor } from '@/lib/platform/welcome';
import { useJourneyExit } from './journey-exit';
import { useJourney } from '@/hooks/use-welcome-step';
import { GateRefusal } from '@/components/platform/gate-refusal';
import { ApiErrorNotice } from './api-error';
import { StepRail, StepStrip } from './step-rail';

/**
 * The journey's own surface. The cockpit's tokens stay; only the corner
 * radius is widened here, because a first conversation is not an instrument
 * panel — it is read once, slowly, by someone who has not yet decided to stay.
 */
const JOURNEY_SURFACE = 'min-h-[100dvh] bg-background text-foreground [--radius:0.75rem]';

export function WelcomeSkeleton() {
  return (
    <div className={JOURNEY_SURFACE}>
      <div className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="mx-auto hidden h-7 w-80 md:block" />
          <Skeleton className="ml-auto h-7 w-14" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[640px] space-y-4 px-5 py-12">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-full max-w-lg" />
        <Skeleton className="mt-8 h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className={`flex items-center justify-center p-6 ${JOURNEY_SURFACE}`}>
      <div className="w-full max-w-md space-y-4">{children}</div>
    </div>
  );
}

/**
 * The journey writes to the PERSONAL account only. Until that account is the
 * active one — after the account cache settled — nothing below renders, so an
 * organization selected earlier never receives onboarding data.
 */
export function PersonalAccountGuard({ children }: { children: ReactNode }) {
  const t = useI18n((s) => s.t);
  const { signOut } = useSession();
  const { accounts, activeAccount, loading, error, switchAccount } = useAccount();
  const personal = accounts.find((a) => a.kind === 'personal');

  useEffect(() => {
    if (loading || error || !personal) return;
    if (getActiveAccount() !== personal.id) switchAccount(personal.id);
  }, [loading, error, personal, switchAccount]);

  if (error) return <GateRefusal error={error} onRetry={() => window.location.reload()} />;
  if (!loading && !personal) {
    return (
      <CenteredState>
        <Empty className="rounded-xl border border-border">
          <EmptyHeader>
            <EmptyTitle>{t('welcome.guard.noPersonal.title')}</EmptyTitle>
            <EmptyDescription>{t('welcome.guard.noPersonal.body')}</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut />
            {t('welcome.layout.signOut')}
          </Button>
        </Empty>
      </CenteredState>
    );
  }
  if (loading || !personal || activeAccount !== personal.id) return <WelcomeSkeleton />;
  return <>{children}</>;
}

/** An onboarded person never sees `/welcome/*`: they go where they asked. */
export function WelcomeGate({ children }: { children: ReactNode }) {
  const { activeAccount } = useAccount();
  const me = useMe({ query: { queryKey: getMeQueryKey(), enabled: Boolean(activeAccount) } });
  const journey = useJourney();
  const exitStore = useJourneyExit();

  if (me.error) return <GateRefusal error={me.error} onRetry={() => void me.refetch()} />;
  if (me.isLoading || !me.data) return <WelcomeSkeleton />;
  if (me.data.onboarded === undefined && journey.error) {
    return <GateRefusal error={journey.error} onRetry={() => void journey.refetch()} />;
  }
  if (onboardingComplete(me.data.onboarded, journey.data?.complete) === undefined) {
    return <WelcomeSkeleton />;
  }
  // Prefer the explicit profile flag; older responses may omit it, in which
  // case the journey's server-owned completion is authoritative.
  if (onboardingComplete(me.data.onboarded, journey.data?.complete) === true) {
    const exit = safeJourneyExit(exitStore.get());
    return <Navigate to={exit.path} state={exit.state} replace />;
  }
  return <>{children}</>;
}

/** `/welcome` with no step: wherever the API says `current` is. */
export function WelcomeIndex() {
  const t = useI18n((s) => s.t);
  const location = useLocation();
  const journey = useJourney();
  if (journey.data) {
    const target = welcomePathFor(journey.data.current);
    // A step the API names but this cockpit has no screen for: say so
    // instead of redirecting to the same address forever.
    if (target === location.pathname) {
      return (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyTitle>{t('welcome.unknownStep.title')}</EmptyTitle>
            <EmptyDescription>
              {t('welcome.unknownStep.body', { step: journey.data.current })}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }
    return <Navigate to={target} replace />;
  }
  if (journey.error) {
    return <ApiErrorNotice error={journey.error} onRetry={() => void journey.refetch()} />;
  }
  return <Skeleton className="h-40 w-full rounded-xl" />;
}

/**
 * A slim bar with the stepper, and one centred column for the step. The step
 * on screen comes from the URL, so a hard reload stays where it was; the
 * stepper's states come from the API.
 */
export function WelcomeLayout() {
  const t = useI18n((s) => s.t);
  const { signOut } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const journey = useJourney();
  const { activeAccount } = useAccount();
  const me = useMe({ query: { queryKey: getMeQueryKey(), enabled: Boolean(activeAccount) } });
  const viewing = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] ?? '');

  async function onSignOut() {
    await signOut();
    navigate('/sign-in');
  }

  return (
    <div className={JOURNEY_SURFACE}>
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-5">
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-semibold tracking-tight">DOP</span>
          </div>
          <nav className="hidden flex-1 justify-center md:flex" aria-label={t('welcome.layout.railLabel')}>
            {journey.data ? (
              <StepRail state={journey.data} viewing={viewing} />
            ) : journey.error ? null : (
              <Skeleton className="h-7 w-80" />
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {me.data ? (
              <span className="hidden max-w-56 truncate text-sm text-muted-foreground lg:inline">{me.data.email}</span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="text-muted-foreground"
              data-testid="button-welcome-sign-out"
            >
              <LogOut />
              {t('welcome.layout.signOut')}
            </Button>
          </div>
        </div>
        <div className="border-t border-border px-5 py-3 md:hidden">
          {journey.data ? <StepStrip state={journey.data} viewing={viewing} /> : <Skeleton className="h-8 w-full" />}
        </div>
      </header>

      {journey.error ? (
        <div className="mx-auto w-full max-w-[640px] px-5 pt-6">
          <ApiErrorNotice error={journey.error} onRetry={() => void journey.refetch()} />
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[640px] px-5 py-10 sm:py-14">
        <div key={viewing} className="animate-in fade-in duration-300">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

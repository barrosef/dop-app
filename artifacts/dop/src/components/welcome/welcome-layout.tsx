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
import { ApiErrorNotice } from './api-error';
import { Narrative } from './narrative';
import { StepRail, StepStrip } from './step-rail';

export function WelcomeSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <div className="hidden space-y-3 border-r border-border p-5 lg:block">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="space-y-4 p-6 sm:p-10">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="mt-8 h-48 w-full max-w-2xl" />
      </div>
    </div>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
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

  if (error) {
    return (
      <CenteredState>
        <ApiErrorNotice error={error} onRetry={() => window.location.reload()} />
      </CenteredState>
    );
  }
  if (!loading && !personal) {
    return (
      <CenteredState>
        <Empty className="border border-border">
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

  if (me.error) {
    return (
      <CenteredState>
        <ApiErrorNotice error={me.error} onRetry={() => void me.refetch()} />
      </CenteredState>
    );
  }
  if (me.isLoading || !me.data) return <WelcomeSkeleton />;
  if (me.data.onboarded === undefined && journey.error) {
    return (
      <CenteredState>
        <ApiErrorNotice error={journey.error} onRetry={() => void journey.refetch()} />
      </CenteredState>
    );
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
        <Empty className="border border-dashed border-border">
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
  return <Skeleton className="h-40 w-full max-w-2xl" />;
}

/**
 * Rail + narrative + content. The step on screen comes from the URL, so a
 * hard reload stays where it was; the rail's states come from the API.
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
    <div className="min-h-[100dvh] bg-background text-foreground lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border lg:flex lg:min-h-[100dvh] lg:flex-col">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <TerminalSquare className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-semibold tracking-tight">DOP</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {t('welcome.layout.preflight')}
          </span>
        </div>
        <nav className="flex-1 py-3" aria-label={t('welcome.layout.railLabel')}>
          {journey.data ? (
            <StepRail state={journey.data} viewing={viewing} />
          ) : journey.error ? (
            <div className="px-4">
              <ApiErrorNotice error={journey.error} onRetry={() => void journey.refetch()} />
            </div>
          ) : (
            <div className="space-y-2 px-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
        </nav>
        <div className="space-y-2 border-t border-border px-5 py-4">
          {me.data ? (
            <p className="truncate font-mono text-[11px] text-muted-foreground">{me.data.email}</p>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="-ml-2 text-muted-foreground"
            data-testid="button-welcome-sign-out"
          >
            <LogOut />
            {t('welcome.layout.signOut')}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-background px-5 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold">DOP</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {t('welcome.layout.preflight')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="ml-auto text-muted-foreground"
              aria-label={t('welcome.layout.signOut')}
            >
              <LogOut />
            </Button>
          </div>
          {journey.data ? <StepStrip state={journey.data} viewing={viewing} /> : <Skeleton className="h-6 w-full" />}
        </div>

        <div className="flex-1 xl:grid xl:grid-cols-[300px_minmax(0,1fr)]">
          <section
            className="border-b border-border bg-muted/30 px-5 py-6 sm:px-10 xl:border-b-0 xl:border-r xl:px-7 xl:py-12"
            aria-label={t('welcome.layout.narrativeLabel')}
          >
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t('welcome.layout.briefing')}
            </p>
            <Narrative key={viewing} step={viewing} />
          </section>
          <main className="min-w-0 px-5 py-8 sm:px-10 xl:py-12">
            <div
              key={viewing}
              className="mx-auto w-full max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

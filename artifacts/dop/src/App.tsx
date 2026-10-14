import type React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useParams,
} from 'react-router-dom';
import type { User } from 'firebase/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/ThemeProvider';

import { Shell } from '@/components/platform/shell';
import { SecondFactorGate } from '@/components/security/gate';
import { AccountProvider } from '@/lib/platform/account';
import { SessionProvider, useSession } from '@/lib/platform/session';
import { useI18n } from '@/lib/i18n';
import SignIn from '@/pages/sign-in';
import SignUp from '@/pages/sign-up';
import LinkProvider from '@/pages/link-provider';
import VerifyEmail from '@/pages/verify-email';
import Start from '@/pages/start';
import Project from '@/pages/project';
import Demand from '@/pages/demand';
import Invite from '@/pages/invite';
import Account from '@/pages/account';

import WorkspaceCockpit from '@/pages/workspace-cockpit';
import WorkspaceCreate from '@/pages/workspace-create';
import NotFound from '@/pages/not-found';
import ProjectCreate from '@/pages/project-create';
import WelcomeProfile from '@/pages/welcome/profile';
import WelcomeContact from '@/pages/welcome/contact';
import WelcomeCode from '@/pages/welcome/code';
import WelcomeTasks from '@/pages/welcome/tasks';
import WelcomePlan from '@/pages/welcome/plan';
import WelcomeReady from '@/pages/welcome/ready';
import {
  PersonalAccountGuard,
  WelcomeGate,
  WelcomeIndex,
  WelcomeLayout,
  WelcomeSkeleton,
} from '@/components/welcome/welcome-layout';
import { ApiErrorNotice } from '@/components/welcome/api-error';
import { JourneyExitScope } from '@/components/welcome/journey-exit';
import { useJourney } from '@/hooks/use-welcome-step';
import { useAccount } from '@/lib/platform/account';
import { onboardingComplete, welcomePathFor } from '@/lib/platform/welcome';
import { getMeQueryKey, useMe } from '@workspace/api-client-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // An authentication error does not improve with insistence: retrying a
      // 401 three times only delays the sign-in screen.
      retry: (attempts, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (status === 401 || status === 403) return false;
        return attempts < 2;
      },
    },
  },
});

/**
 * The spinner shared by every screen that has to wait for
 * `onIdTokenChanged`'s first callback before it can decide anything —
 * duplicating the same three lines per guard would drift out of sync with
 * `auth.restoring`'s wording sooner or later.
 */
function Restoring() {
  const t = useI18n((s) => s.t);
  return (
    <div className="flex h-screen items-center justify-center bg-background text-xs text-muted-foreground">
      {t('auth.restoring')}
    </div>
  );
}

/**
 * Whether a signed-in user's credential still needs confirming before they
 * reach anything behind the gate — decided in this ONE place so no route can
 * forget it (see `AuthenticatedShell` and `InviteRoute` below, the only two
 * places a session turns into a screen behind the gate).
 *
 * `providerData` carries one entry per linked provider. Gating on
 * `emailVerified` alone, with no regard for it, would lock out every GitHub
 * user — GitHub frequently reports an unverified address for an account
 * nobody doubts is real, because a popup already authenticated that person.
 * The gate is for the one method that proves nothing on its own: a password
 * anyone could have typed for any address (spec D-5).
 */
function needsEmailVerification(user: User): boolean {
  const providerIds = user.providerData.map((p) => p.providerId);
  return (
    providerIds.length > 0 &&
    providerIds.every((id) => id === 'password') &&
    !user.emailVerified
  );
}

/**
 * `/sign-up` and `/sign-in` are for someone who is NOT signed in yet — a
 * signed-in person landing here (a stale bookmark, a link opened twice) goes
 * to `/`, and from there `AuthenticatedShell` decides the rest (including
 * whether they still owe us a verified e-mail).
 */
function SignUpRoute() {
  const { user, loading } = useSession();
  if (loading) return <Restoring />;
  if (user) return <Navigate to="/" replace />;
  return <SignUp />;
}

function SignInRoute() {
  const { user, loading } = useSession();
  if (loading) return <Restoring />;
  if (user) return <Navigate to="/" replace />;
  return <SignIn />;
}

/**
 * `/link-provider` needs no guard of its own: `LinkProvider` reads
 * `pendingLink` and bounces to `/sign-in` itself when there is none (a
 * reload, or the URL opened cold) — see the comment on that file for why
 * that limit is deliberate.
 *
 * `/verify-email` does need one: it requires a signed-in user, and it is
 * pointless (not wrong, just a dead screen) for anyone who is not gated —
 * already verified, or authenticated by a provider that never needed this.
 */
function VerifyEmailRoute() {
  const { user, loading } = useSession();
  if (loading) return <Restoring />;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (!needsEmailVerification(user)) return <Navigate to="/" replace />;
  return <VerifyEmail />;
}

function CardsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/workspaces/${id}`} replace />;
}

function WorkspaceEditRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/workspaces/${id}` : '/'} replace />;
}

function CardRedirect() {
  const { cardId, demandId } = useParams();
  // A legacy card id is not a demand id. Do not silently send it to the
  // cockpit and make the BFF request look like a valid demand lookup.
  if (cardId) return <Navigate to="/" replace />;
  return <Navigate to={demandId ? `/demands/${demandId}` : '/'} replace />;
}

/**
 * The onboarding gate, in the same place as the session gate: an account whose
 * `/me` says `onboarded === false` sees only the journey, at the step the API
 * calls `current`. If the optional flag is absent, use the journey's completion.
 * With no active account there is nothing to ask `/me` (it
 * needs one) and nothing to onboard into, so the shell decides as before.
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { activeAccount, loading } = useAccount();
  const me = useMe({ query: { queryKey: getMeQueryKey(), enabled: Boolean(activeAccount) } });
  const journey = useJourney();

  if (loading) return <WelcomeSkeleton />;
  if (!activeAccount) return <>{children}</>;
  if (me.error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <ApiErrorNotice error={me.error} onRetry={() => void me.refetch()} />
        </div>
      </div>
    );
  }
  if (me.isLoading || !me.data) return <WelcomeSkeleton />;
  if (onboardingComplete(me.data.onboarded, journey.data?.complete) === true) return <>{children}</>;
  if (journey.error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <ApiErrorNotice error={journey.error} onRetry={() => void journey.refetch()} />
        </div>
      </div>
    );
  }
  if (!journey.data) return <WelcomeSkeleton />;
  return <Navigate to={welcomePathFor(journey.data.current)} replace />;
}

/**
 * `/welcome/*`: outside the shell (no sidebar, no tree), behind the same
 * session and e-mail gates, inside the personal account.
 */
function WelcomeRoute() {
  const { user, loading } = useSession();

  if (loading) return <Restoring />;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (needsEmailVerification(user)) return <Navigate to="/verify-email" replace />;

  return (
    <JourneyExitScope key={user.uid}>
      <AccountProvider>
        <PersonalAccountGuard>
          <SecondFactorGate>
            <WelcomeGate>
              <WelcomeLayout />
            </WelcomeGate>
          </SecondFactorGate>
        </PersonalAccountGuard>
      </AccountProvider>
    </JourneyExitScope>
  );
}

/**
 * The shell of the screens wired to the real BFF. They only exist after the
 * session: with no token there is no active account, and with no active account
 * the BFF refuses everything — which is its right behaviour (the SP-0 rule), not
 * an obstacle to work around.
 */
function AuthenticatedShell() {
  const { user, loading } = useSession();

  if (loading) return <Restoring />;
  if (!user) return <SignIn />;
  if (needsEmailVerification(user)) return <Navigate to="/verify-email" replace />;

  return (
    <AccountProvider>
      {/* The second factor stands BETWEEN the session and the cockpit: a
          stepped-up session goes through, one that has not answered sees the
          challenge, and somebody with no factor in an account that requires one
          is sent to register it (ADR-0020 §5). */}
      <SecondFactorGate>
        <OnboardingGate>
          <Shell>
            <Outlet />
          </Shell>
        </OnboardingGate>
      </SecondFactorGate>
    </AccountProvider>
  );
}

/**
 * The invite's route: it needs a SESSION (the core refuses to read an invite
 * without one) and it does NOT need an active account.
 */
function InviteRoute() {
  const { user, loading } = useSession();

  if (loading) return <Restoring />;
  if (!user) return <SignIn />;
  // The same gate as `AuthenticatedShell`, applied here too: an invite link
  // is its own route, outside that shell, so it would otherwise let a
  // password-only, unverified user straight through to the invite's content.
  if (needsEmailVerification(user)) return <Navigate to="/verify-email" replace />;
  return <Invite />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <SessionProvider>
              <Routes>
                <Route element={<AuthenticatedShell />}>
                  <Route path="/" element={<Start />} />
                  <Route path="/workspaces" element={<Navigate to="/" replace />} />
                  <Route path="/demands" element={<Navigate to="/" replace />} />
                  <Route path="/projects/new" element={<ProjectCreate />} />
                  <Route path="/projects/:projectId" element={<Project />} />
                  <Route path="/demands/:demandId" element={<Demand />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/workspaces/new" element={<WorkspaceCreate />} />
                  <Route path="/workspaces/:id/edit" element={<WorkspaceEditRedirect />} />
                  <Route path="/workspaces/:id" element={<WorkspaceCockpit />} />
                  <Route path="/workspaces/:id/cards" element={<CardsRedirect />} />
                  <Route path="/workspaces/:id/cards/:cardId" element={<CardRedirect />} />
                  <Route path="/workspaces/:id/demands" element={<CardsRedirect />} />
                  <Route path="/workspaces/:id/demands/:demandId" element={<CardRedirect />} />
                </Route>

                <Route path="/welcome" element={<WelcomeRoute />}>
                  <Route index element={<WelcomeIndex />} />
                  <Route path="profile" element={<WelcomeProfile />} />
                  <Route path="contact" element={<WelcomeContact />} />
                  <Route path="code" element={<WelcomeCode />} />
                  <Route path="tasks" element={<WelcomeTasks />} />
                  <Route path="plan" element={<WelcomePlan />} />
                  <Route path="ready" element={<WelcomeReady />} />
                  <Route path="*" element={<WelcomeIndex />} />
                </Route>

                {/* The invite's link lands here, and it is OUTSIDE the shell:
                    whoever opens it may not be a member of any account yet, and
                    the shell assumes an active account. It is what P-32 was
                    missing — until today the e-mail led to a 404. */}
                <Route path="/invites/:inviteId" element={<InviteRoute />} />

                {/* Sign-up, sign-in and the two screens after them are all
                    OUTSIDE the shell, for the same reason the invite route is:
                    none of them has an active account yet, and some of them
                    (link-provider) do not even have a session. */}
                <Route path="/sign-up" element={<SignUpRoute />} />
                <Route path="/sign-in" element={<SignInRoute />} />
                <Route path="/link-provider" element={<LinkProvider />} />
                <Route path="/verify-email" element={<VerifyEmailRoute />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </SessionProvider>
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useParams,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Layout } from '@/components/layout';

import { Shell } from '@/components/platform/shell';
import { SecondFactorGate } from '@/components/security/gate';
import { AccountProvider } from '@/lib/platform/account';
import { SessionProvider, useSession } from '@/lib/platform/session';
import { useI18n } from '@/lib/i18n';
import SignIn from '@/pages/sign-in';
import Start from '@/pages/start';
import Project from '@/pages/project';
import Demand from '@/pages/demand';
import Invite from '@/pages/invite';
import Account from '@/pages/account';

import Home from '@/pages/home';
import WorkspaceWizard from '@/pages/workspace-wizard';
import WorkspaceCockpit from '@/pages/workspace-cockpit';
import NotFound from '@/pages/not-found';

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

function CardsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/workspaces/${id}`} replace />;
}

function CardRedirect() {
  const { id, cardId, demandId } = useParams();
  const selectedCardId = cardId ?? demandId;
  return (
    <Navigate
      to={`/workspaces/${id}${selectedCardId ? `?card=${selectedCardId}` : ''}`}
      replace
    />
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
  const t = useI18n((s) => s.t);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-xs text-muted-foreground">
        {t('auth.restoring')}
      </div>
    );
  }
  if (!user) return <SignIn />;

  return (
    <AccountProvider>
      {/* The second factor stands BETWEEN the session and the cockpit: a
          stepped-up session goes through, one that has not answered sees the
          challenge, and somebody with no factor in an account that requires one
          is sent to register it (ADR-0027 §5). */}
      <SecondFactorGate>
        <Shell>
          <Outlet />
        </Shell>
      </SecondFactorGate>
    </AccountProvider>
  );
}

/**
 * The old screens, which still talk to the MOCK client (`lib/api/mockClient`).
 * They stay under `/workspaces/*`, with the old shell, until they migrate to the
 * API — and their sidebar says, on the screen, that the data is an example.
 */
function MockupShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

/**
 * The invite's route: it needs a SESSION (the core refuses to read an invite
 * without one) and it does NOT need an active account.
 */
function InviteRoute() {
  const { user, loading } = useSession();
  const t = useI18n((s) => s.t);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-xs text-muted-foreground">
        {t('auth.restoring')}
      </div>
    );
  }
  if (!user) return <SignIn />;
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
                  <Route path="/projects/:projectId" element={<Project />} />
                  <Route path="/demands/:demandId" element={<Demand />} />
                  <Route path="/account" element={<Account />} />
                </Route>

                {/* The invite's link lands here, and it is OUTSIDE the shell:
                    whoever opens it may not be a member of any account yet, and
                    the shell assumes an active account. It is what P-32 was
                    missing — until today the e-mail led to a 404. */}
                <Route path="/invites/:inviteId" element={<InviteRoute />} />

                <Route element={<MockupShell />}>
                  <Route path="/workspaces/new" element={<WorkspaceWizard />} />
                  <Route
                    path="/workspaces/:id/edit"
                    element={<WorkspaceWizard />}
                  />
                  <Route
                    path="/workspaces/:id"
                    element={<WorkspaceCockpit />}
                  />
                  <Route
                    path="/workspaces/:id/cards"
                    element={<CardsRedirect />}
                  />
                  <Route
                    path="/workspaces/:id/cards/:cardId"
                    element={<CardRedirect />}
                  />
                  <Route
                    path="/workspaces/:id/demands"
                    element={<CardsRedirect />}
                  />
                  <Route
                    path="/workspaces/:id/demands/:demandId"
                    element={<CardRedirect />}
                  />
                  <Route path="/mockup" element={<Home />} />
                </Route>

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

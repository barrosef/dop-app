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

import { Casco } from '@/components/plataforma/casco';
import { ContaProvider } from '@/lib/plataforma/conta';
import { SessaoProvider, useSessao } from '@/lib/plataforma/sessao';
import Entrar from '@/pages/entrar';
import Inicio from '@/pages/inicio';
import Projeto from '@/pages/projeto';
import Demanda from '@/pages/demanda';

import Home from '@/pages/home';
import WorkspaceWizard from '@/pages/workspace-wizard';
import WorkspaceCockpit from '@/pages/workspace-cockpit';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Erro de autenticação não melhora com insistência: repetir um 401 três
      // vezes só atrasa a tela de login.
      retry: (tentativas, erro) => {
        const status = (erro as { status?: number } | null)?.status;
        if (status === 401 || status === 403) return false;
        return tentativas < 2;
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
 * O casco das telas ligadas ao BFF real. Elas só existem depois da sessão: sem
 * token não há conta ativa, e sem conta ativa o BFF recusa tudo — que é o
 * comportamento certo dele (regra do SP-0), não um obstáculo a contornar.
 */
function CascoAutenticado() {
  const { usuario, carregando } = useSessao();

  if (carregando) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-xs text-muted-foreground">
        Restaurando sessão…
      </div>
    );
  }
  if (!usuario) return <Entrar />;

  return (
    <ContaProvider>
      <Casco>
        <Outlet />
      </Casco>
    </ContaProvider>
  );
}

/**
 * As telas antigas, que ainda falam com o cliente de MOCK
 * (`lib/api/mockClient`). Continuam em `/workspaces/*`, com o casco antigo, até
 * migrarem para a API — e a barra lateral delas diz, na tela, que o dado é de
 * exemplo.
 */
function CascoDeMockup() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <SessaoProvider>
              <Routes>
                <Route element={<CascoAutenticado />}>
                  <Route path="/" element={<Inicio />} />
                  <Route path="/projetos/:projectId" element={<Projeto />} />
                  <Route path="/demandas/:demandId" element={<Demanda />} />
                </Route>

                <Route element={<CascoDeMockup />}>
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
            </SessaoProvider>
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

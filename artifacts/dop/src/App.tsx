import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/layout";

import Home from "@/pages/home";
import WorkspaceWizard from "@/pages/workspace-wizard";
import WorkspaceCockpit from "@/pages/workspace-cockpit";
import CardsList from "@/pages/cards-list";
import CardExecution from "@/pages/card-execution";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function DemandsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/workspaces/${id}/cards`} replace />;
}

function DemandRedirect() {
  const { id, demandId } = useParams();
  return <Navigate to={`/workspaces/${id}/cards/${demandId}`} replace />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/workspaces/new" element={<WorkspaceWizard />} />
                <Route path="/workspaces/:id/edit" element={<WorkspaceWizard />} />
                <Route path="/workspaces/:id" element={<WorkspaceCockpit />} />
                <Route path="/workspaces/:id/cards" element={<CardsList />} />
                <Route path="/workspaces/:id/cards/:cardId" element={<CardExecution />} />

                {/* Fallbacks for older routes */}
                <Route path="/workspaces/:id/demands" element={<DemandsRedirect />} />
                <Route path="/workspaces/:id/demands/:demandId" element={<DemandRedirect />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

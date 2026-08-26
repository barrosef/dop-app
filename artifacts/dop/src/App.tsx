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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function CardsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/workspaces/${id}`} replace />;
}

function CardRedirect() {
  const { id, cardId, demandId } = useParams();
  const selectedCardId = cardId ?? demandId;
  return <Navigate to={`/workspaces/${id}${selectedCardId ? `?card=${selectedCardId}` : ''}`} replace />;
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
                <Route path="/workspaces/:id/cards" element={<CardsRedirect />} />
                <Route path="/workspaces/:id/cards/:cardId" element={<CardRedirect />} />

                {/* Fallbacks for older routes */}
                <Route path="/workspaces/:id/demands" element={<CardsRedirect />} />
                <Route path="/workspaces/:id/demands/:demandId" element={<CardRedirect />} />

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

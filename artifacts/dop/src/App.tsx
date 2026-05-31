import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/layout";

import Home from "@/pages/home";
import WorkspaceWizard from "@/pages/workspace-wizard";
import WorkspaceDetail from "@/pages/workspace-detail";
import DemandsList from "@/pages/demands-list";
import DemandExecution from "@/pages/demand-execution";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

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
                <Route path="/workspaces/:id" element={<WorkspaceDetail />} />
                <Route path="/workspaces/:id/demands" element={<DemandsList />} />
                <Route path="/workspaces/:id/demands/:demandId" element={<DemandExecution />} />
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

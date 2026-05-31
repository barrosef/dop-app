import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace, useDemands } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Play, Settings, Database, Github, Server, Puzzle, LayoutGrid } from 'lucide-react';

export default function WorkspaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: workspace, isLoading: wsLoading } = useWorkspace(id);
  const { data: demands, isLoading: demandsLoading } = useDemands(id);

  if (wsLoading || demandsLoading) return <div className="p-8 text-center">Carregando workspace...</div>;
  if (!workspace) return <div className="p-8 text-center">Workspace não encontrado.</div>;

  const activeDemands = demands?.filter(d => ['new', 'doing'].includes(d.dopStatus)).length || 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground mb-4 text-sm flex items-center gap-1">
            ← Voltar para Workspaces
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{workspace.name}</h1>
            <Badge variant={workspace.status === 'active' ? 'default' : 'secondary'}>{workspace.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-2 font-mono text-sm">{workspace.root}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/workspaces/${workspace.id}/edit`)}>
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
          <Button onClick={() => navigate(`/workspaces/${workspace.id}/demands`)} disabled={workspace.status !== 'active'}>
            <Play className="w-4 h-4 mr-2" />
            Abrir Painel de Demandas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-card/50">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Github className="w-4 h-4"/> Repositórios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workspace.repos.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <LayoutGrid className="w-4 h-4"/> Demandas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{activeDemands}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4"/> Jira Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{workspace.taskManager.project}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5"/> Aplicações Runtime</CardTitle>
          </CardHeader>
          <CardContent>
            {workspace.runtime.apps.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma aplicação configurada.</p>
            ) : (
              <div className="space-y-3">
                {workspace.runtime.apps.map(app => (
                  <div key={app.name} className="flex justify-between items-center p-2 rounded border border-border/50 bg-muted/20">
                    <span className="font-medium text-sm">{app.name}</span>
                    <Badge variant="outline" className="font-mono text-xs">porta {app.port}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Puzzle className="w-5 h-5"/> Extensões do Claude</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Regras de Contexto</h4>
                {workspace.rules.length === 0 ? (
                   <p className="text-xs text-muted-foreground italic">Nenhuma regra definida.</p>
                ) : (
                  <ul className="list-disc pl-4 text-sm space-y-1">
                    {workspace.rules.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

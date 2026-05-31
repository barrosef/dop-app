import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Settings, Play, AlertCircle, FolderGit2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useWorkspaces, useAllDemands } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function Home() {
  const { data: workspaces, isLoading: isLoadingWs } = useWorkspaces();
  const { data: demands, isLoading: isLoadingDemands } = useAllDemands();
  const navigate = useNavigate();

  const needsAttention = useMemo(() => {
    if (!demands) return [];
    return demands.filter(d => 
      d.dopStatus === 'doing' && 
      d.stages.some(s => s.status === 'blocked' || (s.key === 'val' && s.status === 'running'))
    );
  }, [demands]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {needsAttention.length > 0 && (
        <div className="mb-8 p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-destructive font-bold mb-1">Onde sou necessário</h3>
            <div className="space-y-2">
              {needsAttention.map(d => {
                const ws = workspaces?.find(w => w.id === d.workspaceId);
                const blockedStage = d.stages.find(s => s.status === 'blocked');
                const valStage = d.stages.find(s => s.key === 'val' && s.status === 'running');
                const reason = blockedStage ? `Bloqueado em: ${blockedStage.title}` : valStage ? 'Aguardando validação humana' : 'Atenção necessária';
                
                return (
                  <div key={d.id} className="flex items-center justify-between bg-background/50 p-2 rounded border border-border/50">
                    <div>
                      <span className="font-semibold">{ws?.name}</span>
                      <span className="text-muted-foreground mx-2">›</span>
                      <span className="font-mono text-xs">{d.jiraKey}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{reason}</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => navigate(`/workspaces/${d.workspaceId}/demands/${d.id}`)}>
                      Resolver <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus ambientes de desenvolvimento dopados por IA.</p>
        </div>
        <Button onClick={() => navigate('/workspaces/new')} data-testid="button-new-workspace">
          <Plus className="w-4 h-4 mr-2" />
          Nova Workspace
        </Button>
      </div>

      {isLoadingWs ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50 rounded-t-lg" />
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces?.map(ws => {
            const wsDemands = demands?.filter(d => d.workspaceId === ws.id) || [];
            const activeCount = wsDemands.filter(d => ['new', 'doing'].includes(d.dopStatus)).length;
            
            return (
              <Card key={ws.id} className="flex flex-col border-border/50 shadow-sm hover:shadow-md transition-shadow dark:bg-card/50">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={ws.status === 'active' ? 'default' : 'secondary'} className={ws.status === 'active' ? 'bg-primary/20 text-primary hover:bg-primary/30' : ''}>
                      {ws.status === 'active' ? 'Ativo' : 'Rascunho'}
                    </Badge>
                    <FolderGit2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-xl">{ws.name}</CardTitle>
                  <CardDescription className="font-mono text-xs truncate" title={ws.root}>{ws.root}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-bold text-foreground">{ws.repos.length}</span> repositórios
                    </div>
                    {ws.status === 'active' && (
                      <div>
                        <span className="font-bold text-foreground">{activeCount}</span> demandas ativas
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-border/50 gap-2 flex-wrap">
                  {ws.status === 'active' ? (
                    <Button className="flex-1" onClick={() => navigate(`/workspaces/${ws.id}/demands`)} data-testid={`button-develop-${ws.id}`}>
                      <Play className="w-4 h-4 mr-2" />
                      Desenvolver
                    </Button>
                  ) : (
                    <Button variant="secondary" className="flex-1" onClick={() => navigate(`/workspaces/${ws.id}/edit`)} data-testid={`button-continue-${ws.id}`}>
                      Continuar Configuração
                    </Button>
                  )}
                  <Button variant="outline" size="icon" onClick={() => navigate(`/workspaces/${ws.id}`)} data-testid={`button-settings-${ws.id}`}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

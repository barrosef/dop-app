import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Settings, Play, FolderGit2, AlertTriangle, ArrowRight, LayoutGrid } from 'lucide-react';
import { useWorkspaces, useAllCards } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useI18n } from '../lib/i18n';

export default function Home() {
  const { data: workspaces, isLoading: isLoadingWs } = useWorkspaces();
  const { data: cards, isLoading: isLoadingCards } = useAllCards();
  const navigate = useNavigate();
  const { t } = useI18n();

  const needsAttention = useMemo(() => {
    if (!cards) return [];
    return cards.filter(c =>
      c.dopStatus === 'doing' &&
      c.stages.some(s => s.status === 'blocked' || (s.key === 'val' && s.status === 'running'))
    );
  }, [cards]);

  return (
    <div className="container mx-auto py-8 px-6 max-w-7xl h-full overflow-y-auto">
      {needsAttention.length > 0 && (
        <div className="mb-8 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-destructive font-bold mb-3">{t('attention.title')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {needsAttention.map(c => {
                const ws = workspaces?.find(w => w.id === c.workspaceId);
                const blockedStage = c.stages.find(s => s.status === 'blocked');
                const valStage = c.stages.find(s => s.key === 'val' && s.status === 'running');
                const reason = blockedStage
                  ? `${t('attention.blocked')}: ${blockedStage.title}`
                  : valStage ? t('attention.validation') : t('attention.generic');
                
                return (
                  <div key={c.id} className="flex items-center justify-between bg-background/60 p-3 rounded-md border border-border/50 group hover:border-destructive/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-xs truncate">{ws?.name}</span>
                        <span className="text-muted-foreground text-xs">›</span>
                        <Badge variant="outline" className="font-mono text-[10px] py-0 px-1 border-destructive/30 text-destructive">
                          {c.externalKey}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate" title={reason}>{reason}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => navigate(`/workspaces/${c.workspaceId}/cards/${c.id}`)}
                    >
                      {t('attention.resolve')} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <LayoutGrid className="w-7 h-7 text-primary" />
            {t('workspace.list.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('workspace.list.subtitle')}</p>
        </div>
        <Button onClick={() => navigate('/workspaces/new')} size="sm" className="h-9">
          <Plus className="w-4 h-4 mr-2" />
          {t('workspace.new')}
        </Button>
      </div>

      {isLoadingWs ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse bg-muted/20">
              <CardHeader className="h-24 bg-muted/30 rounded-t-lg border-b border-border/50" />
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces?.map(ws => {
            const wsCards = cards?.filter(c => c.workspaceId === ws.id) || [];
            const activeCount = wsCards.filter(c => ['new', 'doing'].includes(c.dopStatus)).length;
            
            return (
              <Card key={ws.id} className="flex flex-col border-border shadow-sm hover:border-primary/50 transition-colors bg-card/60 overflow-hidden group">
                <CardHeader className="pb-4 relative">
                  <div className="absolute top-4 right-4 text-muted-foreground/30 group-hover:text-primary/20 transition-colors">
                    <FolderGit2 className="w-16 h-16" />
                  </div>
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <Badge variant="outline" className={
                      ws.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-muted/50 text-muted-foreground'
                    }>
                      {ws.status === 'active' ? t('workspace.status.active') : t('workspace.status.draft')}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg relative z-10">{ws.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">{ws.repos.length}</span>
                      <span>{t('workspace.repos')}</span>
                    </div>
                    {ws.status === 'active' && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">{activeCount}</span>
                        <span>{t('workspace.cards.active')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-border/50 gap-2 flex-wrap bg-muted/10">
                  {ws.status === 'active' ? (
                    <Button size="sm" className="flex-1 h-8 text-xs font-medium" onClick={() => navigate(`/workspaces/${ws.id}`)}>
                      <Play className="w-3.5 h-3.5 mr-2" />
                      {t('workspace.action.develop')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs font-medium" onClick={() => navigate(`/workspaces/${ws.id}/edit`)}>
                      {t('workspace.action.continue')}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="w-8 h-8 p-0" onClick={() => navigate(`/workspaces/${ws.id}/edit`)} title={t('sidebar.configure')}>
                    <Settings className="w-3.5 h-3.5" />
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

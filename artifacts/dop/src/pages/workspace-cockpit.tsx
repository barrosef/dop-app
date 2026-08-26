import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace, useCards } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Card as UICard } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Search, Loader2, GitBranch, GitPullRequest, Settings, TerminalSquare, AlertCircle, PlayCircle, FolderGit2, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Card, PullRequest } from '../lib/api/types';

export default function WorkspaceCockpit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const { data: workspace, isLoading: wsLoading } = useWorkspace(id);
  const { data: cards, isLoading: cardsLoading } = useCards(id);

  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [expandedRepos, setExpandedRepos] = useState<Record<string, boolean>>({});
  const [repoTabs, setRepoTabs] = useState<Record<string, 'overview' | 'branches' | 'prs'>>({});

  useEffect(() => {
    if (searchParams.get('tab') === 'repos' && workspace) {
      setExpandedRepos(Object.fromEntries(workspace.repos.map(repo => [repo.name, true])));
    }
  }, [searchParams, workspace]);

  if (wsLoading || cardsLoading) return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-3" /> {t('common.loading')}
    </div>
  );
  if (!workspace || !cards) return <div className="p-8 text-center">{t('common.empty')}</div>;

  const activeCards = cards.filter(c => ['new', 'doing'].includes(c.dopStatus));
  const filteredCards = activeCards.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.externalKey.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCardSelection = (cardId: string) => {
    const next = new Set(selectedCardIds);
    if (next.has(cardId)) next.delete(cardId);
    else next.add(cardId);
    setSelectedCardIds(next);
  };

  // Aggregation logic
  const cardsToAggregate = selectedCardIds.size > 0
    ? cards.filter(c => selectedCardIds.has(c.id))
    : cards;

  const repoAggregates: Record<string, {
    name: string;
    newBranches: Set<string>;
    modifiedBranches: Set<string>;
    prs: PullRequest[];
    relatedCards: Card[];
  }> = {};

  workspace.repos.forEach(r => {
    repoAggregates[r.name] = { name: r.name, newBranches: new Set(), modifiedBranches: new Set(), prs: [], relatedCards: [] };
  });

  cardsToAggregate.forEach(c => {
    if (c.repositoryOverview) {
      const o = c.repositoryOverview;
      o.repos.forEach(rName => {
        if (!repoAggregates[rName]) {
          repoAggregates[rName] = { name: rName, newBranches: new Set(), modifiedBranches: new Set(), prs: [], relatedCards: [] };
        }
        if (!repoAggregates[rName].relatedCards.some(rc => rc.id === c.id)) {
          repoAggregates[rName].relatedCards.push(c);
        }
      });
      o.branches.forEach(b => {
        const parts = b.split('|');
        if (parts.length === 2) {
          const [rName, bName] = parts;
          if (repoAggregates[rName]) {
            // Simple heuristic to differentiate new from modified: assume 'feature' / 'bug' or 'fix' prefixed is new, others are modified
            // This is mocked since we don't have deep git history
            if (bName.includes('feature') || bName.includes('bug')) repoAggregates[rName].newBranches.add(bName);
            else repoAggregates[rName].modifiedBranches.add(bName);
          }
        }
      });
      o.prs.forEach(pr => {
        if (repoAggregates[pr.repo]) {
          if (!repoAggregates[pr.repo].prs.some(p => p.id === pr.id)) {
            repoAggregates[pr.repo].prs.push(pr);
          }
        }
      });
    }
  });

  const aggregateList = Object.values(repoAggregates).sort((a, b) => b.relatedCards.length - a.relatedCards.length);

  const toggleRepo = (name: string) => {
    setExpandedRepos(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const setTab = (name: string, tab: 'overview' | 'branches' | 'prs') => {
    setRepoTabs(prev => ({ ...prev, [name]: tab }));
  };

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* LEFT PANEL: Compact Cards Selection */}
      <div className="w-80 border-r border-border bg-card/30 flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <TerminalSquare className="w-4 h-4 text-primary" />
            {workspace.name}
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('card.search')}
              className="w-full h-8 pl-8 pr-3 text-xs bg-muted/50 border border-border/50 rounded focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
        <div className="px-4 py-2 bg-muted/20 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
          <span>{t('cockpit.cards', { count: filteredCards.length })}</span>
          {selectedCardIds.size > 0 && (
            <button onClick={() => setSelectedCardIds(new Set())} className="text-primary hover:underline">
              {t('cockpit.repo.clearSelection')}
            </button>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredCards.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">{t('common.empty')}</div>
            ) : (
              filteredCards.map(c => {
                const isSelected = selectedCardIds.has(c.id);
                const needsAttention = c.stages.some(s => s.status === 'blocked' || (s.key === 'val' && s.status === 'running'));
                
                return (
                  <div 
                    key={c.id}
                    onClick={() => toggleCardSelection(c.id)}
                    className={`p-2.5 rounded-md border text-sm cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-primary/10 border-primary/40' 
                        : 'bg-card border-border/40 hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                        {c.externalKey}
                      </span>
                      {needsAttention && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                    </div>
                    <div className="font-medium text-xs leading-tight mb-2 line-clamp-2">{c.title}</div>
                    <div className="flex justify-between items-center">
                      <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${c.dopStatus === 'doing' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : ''}`}>
                        {c.dopStatus === 'doing' ? t('card.status.doing') : t('card.status.new')}
                      </Badge>
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/workspaces/${id}/cards/${c.id}`); }}
                        className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        <PlayCircle className="w-3 h-3" /> {t('card.action.open')}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
        <div className="p-3 border-t border-border bg-muted/10">
          <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => navigate(`/workspaces/${id}/cards`)}>
            {t('cockpit.repo.seeAll')}
          </Button>
        </div>
      </div>

      {/* MAIN AREA: Repositories Exploration */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-card/20">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-muted-foreground" />
            {t('repo.overview')}
          </h1>
          <div className="flex gap-2">
             <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate(`/workspaces/${id}/edit`)}>
               <Settings className="w-3.5 h-3.5 mr-1.5" /> {t('cockpit.repo.configure')}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 max-w-5xl mx-auto space-y-4">
            {aggregateList.map(repo => {
              const isExpanded = !!expandedRepos[repo.name];
              const currentTab = repoTabs[repo.name] || 'overview';
              const allBranchesCount = repo.newBranches.size + repo.modifiedBranches.size;

              return (
                <UICard key={repo.name} className="overflow-hidden border-border/60 shadow-sm transition-all">
                  <div 
                    className="bg-muted/20 hover:bg-muted/30 px-4 py-3 cursor-pointer flex items-center justify-between transition-colors"
                    onClick={() => toggleRepo(repo.name)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <GitBranch className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-mono font-bold text-sm">{repo.name}</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {repo.relatedCards.length > 0 ? (
                            <>{t('cockpit.repo.involvedIn', { count: repo.relatedCards.length })} {repo.relatedCards.map(c => c.externalKey).join(', ')}</>
                          ) : (
                            <>{t('cockpit.repo.emptySelection')}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div className="flex flex-col items-center">
                        <span className="text-foreground font-bold">{repo.modifiedBranches.size}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">{t('cockpit.repo.modifiedBranches')}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-emerald-400 font-bold">{repo.newBranches.size}</span>
                        <span className="text-[9px] text-emerald-400/60 uppercase">{t('cockpit.repo.newBranches')}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-primary font-bold">{repo.prs.length}</span>
                        <span className="text-[9px] text-primary/60 uppercase">{t('cockpit.repo.createdPrs')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="border-t border-border/50 bg-card">
                      <div className="flex border-b border-border/40 px-2 bg-muted/10">
                        <button 
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${currentTab === 'overview' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setTab(repo.name, 'overview')}
                        >{t('cockpit.tabs.overview')}</button>
                        <button 
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${currentTab === 'branches' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setTab(repo.name, 'branches')}
                        >{t('cockpit.tabs.branches')} <Badge variant="secondary" className="text-[9px] py-0 px-1">{allBranchesCount}</Badge></button>
                        <button 
                          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${currentTab === 'prs' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setTab(repo.name, 'prs')}
                        >{t('cockpit.tabs.prs')} <Badge variant="secondary" className="text-[9px] py-0 px-1">{repo.prs.length}</Badge></button>
                      </div>

                      <div className="p-4">
                        {currentTab === 'overview' && (
                          <div className="space-y-4">
                            <p className="text-xs text-muted-foreground">{t('cockpit.repo.summary')}</p>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 border border-border/50 rounded bg-muted/10">
                                <h5 className="text-[10px] uppercase font-bold text-muted-foreground mb-2">{t('cockpit.repo.metrics')}</h5>
                                <p className="text-xs">
                                  {t('cockpit.repo.newBranchesTitle')}: <span className="font-mono font-bold text-blue-400">{repo.newBranches.size}</span>
                                </p>
                                <p className="text-xs">
                                  {t('cockpit.repo.modifiedBranchesTitle')}: <span className="font-mono font-bold text-amber-400">{repo.modifiedBranches.size}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentTab === 'branches' && (
                          <div className="space-y-3">
                            {allBranchesCount === 0 ? (
                              <p className="text-xs text-muted-foreground italic">{t('cockpit.repo.noBranches')}</p>
                            ) : (
                              <>
                                {repo.newBranches.size > 0 && (
                                  <div>
                                    <h5 className="text-[10px] uppercase font-bold text-emerald-500 mb-2">{t('cockpit.repo.newBranchesTitle')}</h5>
                                    <div className="space-y-1.5">
                                      {Array.from(repo.newBranches).map(b => (
                                        <div key={b} className="flex items-center gap-2 p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                          <span className="font-mono text-xs">{b}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {repo.modifiedBranches.size > 0 && (
                                  <div>
                                    <h5 className="text-[10px] uppercase font-bold text-muted-foreground mb-2 mt-4">{t('cockpit.repo.modifiedBranchesTitle')}</h5>
                                    <div className="space-y-1.5">
                                      {Array.from(repo.modifiedBranches).map(b => (
                                        <div key={b} className="flex items-center gap-2 p-2 rounded bg-muted/10 border border-border/40">
                                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                                          <span className="font-mono text-xs">{b}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {currentTab === 'prs' && (
                          <div>
                            {repo.prs.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">{t('cockpit.repo.noPrs')}</p>
                            ) : (
                              <div className="space-y-2">
                                {repo.prs.map(pr => (
                                  <div key={pr.id} className="p-3 rounded bg-muted/10 border border-border/40 hover:bg-muted/20 transition-colors">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="font-mono text-xs font-semibold">{pr.sourceBranch}</span>
                                      <Badge variant="outline" className={`text-[9px] py-0 px-1 font-semibold ${
                                        pr.merged ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' :
                                        pr.hasConflict ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                                        'border-primary/30 text-primary bg-primary/10'
                                      }`}>
                                        {pr.merged ? t('cockpit.pr.merged') : pr.hasConflict ? t('cockpit.pr.conflict') : t('cockpit.pr.open')}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                                      <span>&rarr; {pr.targetBranch}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </UICard>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

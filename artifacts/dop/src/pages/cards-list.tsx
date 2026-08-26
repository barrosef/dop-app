import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCards, useWorkspace } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { PlayCircle, Search, AlertCircle, Clock, LayoutList, ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useI18n } from '../lib/i18n';

export default function CardsList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: workspace } = useWorkspace(id);
  const { data: cards, isLoading } = useCards(id);
  
  const [filterDop, setFilterDop] = useState<string>('all');
  const [search, setSearch] = useState('');

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>;

  const filteredCards = cards?.filter(c => {
    if (filterDop !== 'all' && c.dopStatus !== filterDop) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.externalKey.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="container mx-auto py-8 px-6 max-w-6xl h-full overflow-y-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate(`/workspaces/${id}`)} className="text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> {t('cockpit.back')}
          </button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutList className="w-7 h-7 text-primary" />
            {t('sidebar.cards')} — <span className="text-muted-foreground font-normal ml-2">{workspace?.name}</span>
          </h1>
        </div>
      </div>

      <div className="flex gap-4 mb-6 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={t('card.search')} 
            className="pl-9 h-9 text-sm bg-card/50"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterDop} onValueChange={setFilterDop}>
          <SelectTrigger className="w-[180px] h-9 text-sm bg-card/50">
            <SelectValue placeholder={t('card.filter.all')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('card.filter.all')}</SelectItem>
            <SelectItem value="new">{t('card.status.new')}</SelectItem>
            <SelectItem value="doing">{t('card.status.doing')}</SelectItem>
            <SelectItem value="done">{t('card.status.done')}</SelectItem>
            <SelectItem value="delivered">{t('card.status.delivered')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {filteredCards?.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-border/50 rounded-lg text-muted-foreground bg-card/20">
            {t('common.empty')}
          </div>
        ) : (
          filteredCards?.map(card => {
            const isBlocked = card.stages.some(s => s.status === 'blocked');
            const needsVal = card.stages.some(s => s.key === 'val' && s.status === 'running');
            const needsAttention = isBlocked || needsVal;
            
            const totalStages = 7;
            const completedStages = card.stages.filter(s => s.status === 'done').length;
            
            return (
              <Card 
                key={card.id} 
                className={`hover:border-primary/50 transition-colors cursor-pointer bg-card/60 group overflow-hidden ${needsAttention ? 'border-destructive/50' : 'border-border/60'}`} 
                onClick={() => navigate(`/workspaces/${id}/cards/${card.id}`)}
              >
                <CardHeader className="py-3 px-4">
                  <div className="flex flex-col md:flex-row justify-between md:items-start gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                        {card.externalKey}
                      </span>
                      <CardTitle className="text-base font-medium">{card.title}</CardTitle>
                      {needsAttention && (
                        <Badge variant="outline" className="ml-2 border-destructive/30 text-destructive bg-destructive/10 text-[10px] py-0 px-1.5 font-semibold">
                          <AlertCircle className="w-3 h-3 mr-1" /> {t('card.attention')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground border-border/50 bg-muted/20">
                        {card.provider} · {card.type} · {card.providerStatus}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 font-semibold
                        ${card.dopStatus === 'new' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
                        ${card.dopStatus === 'doing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : ''}
                        ${card.dopStatus === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
                        ${card.dopStatus === 'delivered' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : ''}
                      `}>
                        {t(`card.status.${card.dopStatus}` as 'card.status.new' | 'card.status.doing' | 'card.status.done' | 'card.status.delivered')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-2.5 px-4 border-t border-border/50 text-xs flex justify-between items-center bg-muted/10">
                  <div className="flex items-center gap-6">
                    <span className="text-muted-foreground">{t('card.assignee')} <strong className="text-foreground/90 font-medium">{card.assignee}</strong></span>
                    {card.dopStatus === 'doing' && (
                      <span className="flex items-center gap-1.5 text-muted-foreground font-mono">
                        <Clock className="w-3 h-3" />
                        {t('card.stage')} {completedStages + 1}/{totalStages}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('card.action.open')} <PlayCircle className="w-4 h-4"/> 
                  </span>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDemands, useWorkspace } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { PlayCircle, Search, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function DemandsList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace(id);
  const { data: demands, isLoading } = useDemands(id);
  
  const [filterDop, setFilterDop] = useState<string>('all');
  const [search, setSearch] = useState('');

  if (isLoading) return <div className="p-8 text-center">Carregando demandas...</div>;

  const filteredDemands = demands?.filter(d => {
    if (filterDop !== 'all' && d.dopStatus !== filterDop) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.jiraKey.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground text-sm">
          ← Workspaces
        </button>
        <h1 className="text-3xl font-bold">Demandas — <span className="text-muted-foreground font-normal">{workspace?.name}</span></h1>
      </div>

      <div className="flex gap-4 mb-6 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por ID ou título..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterDop} onValueChange={setFilterDop}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status DOP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="new">Novas (New)</SelectItem>
            <SelectItem value="doing">Em andamento (Doing)</SelectItem>
            <SelectItem value="done">Concluídas (Done)</SelectItem>
            <SelectItem value="delivered">Entregues (Delivered)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredDemands?.length === 0 ? (
          <div className="text-center p-12 border border-dashed rounded-lg text-muted-foreground">
            Nenhuma demanda encontrada com os filtros atuais.
          </div>
        ) : (
          filteredDemands?.map(demand => {
            const isBlocked = demand.stages.some(s => s.status === 'blocked');
            const needsVal = demand.stages.some(s => s.key === 'val' && s.status === 'running');
            const needsAttention = isBlocked || needsVal;
            
            const totalStages = 7;
            const completedStages = demand.stages.filter(s => s.status === 'done').length;
            
            return (
              <Card 
                key={demand.id} 
                className={`hover:border-primary/50 transition-colors cursor-pointer ${needsAttention ? 'border-destructive/50 shadow-[0_0_10px_rgba(255,0,0,0.1)]' : ''}`} 
                onClick={() => navigate(`/workspaces/${id}/demands/${demand.id}`)}
              >
                <CardHeader className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded">{demand.jiraKey}</span>
                      <CardTitle className="text-lg">{demand.title}</CardTitle>
                      {needsAttention && (
                        <Badge variant="destructive" className="ml-2">
                          <AlertCircle className="w-3 h-3 mr-1" /> Ação Necessária
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="font-normal text-muted-foreground border-muted-foreground/30">Jira: {demand.jiraStatus}</Badge>
                      <Badge className={`
                        ${demand.dopStatus === 'new' ? 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30' : ''}
                        ${demand.dopStatus === 'doing' ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : ''}
                        ${demand.dopStatus === 'done' ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : ''}
                        ${demand.dopStatus === 'delivered' ? 'bg-purple-500/20 text-purple-500 hover:bg-purple-500/30' : ''}
                      `}>
                        {demand.dopStatus.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="py-3 border-t border-border/50 text-sm flex justify-between items-center bg-muted/5">
                  <div className="flex items-center gap-6">
                    <span className="text-muted-foreground">Responsável: <strong className="text-foreground">{demand.assignee}</strong></span>
                    {demand.dopStatus === 'doing' && (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        Etapa {completedStages + 1}/{totalStages}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-primary font-medium group-hover:underline">
                    <PlayCircle className="w-4 h-4"/> Abrir Cockpit
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

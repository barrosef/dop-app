import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDemand, useSendChatMessage } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { CheckCircle2, Circle, AlertCircle, Loader2, PlayCircle, Code, FileText, GitPullRequest, GitCommit, Search } from 'lucide-react';
import { LogLine } from '../lib/api/types';
import { api } from '../lib/api/mockClient';

export default function DemandExecution() {
  const { id, demandId } = useParams();
  const navigate = useNavigate();
  const { data: demand, isLoading } = useDemand(id, demandId);
  const sendChat = useSendChatMessage();
  
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logSource, setLogSource] = useState<'app'|'test'|'infra'>('app');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const logsScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [demand?.chat]);

  // Simulate logs streaming
  useEffect(() => {
    if (!demandId) return;
    setLogs([]); // clear on source change
    
    let active = true;
    const stream = api.streamLogs(demandId, logSource);
    
    const consumeStream = async () => {
      for await (const line of stream) {
        if (!active) break;
        setLogs(prev => [...prev, line]);
        if (logsScrollRef.current) {
          logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
        }
      }
    };
    consumeStream();
    
    return () => { active = false; };
  }, [demandId, logSource]);

  if (isLoading || !demand) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !demandId) return;
    sendChat.mutate({ demandId, text: message });
    setMessage('');
  };

  const getStageIcon = (status: string) => {
    switch(status) {
      case 'done': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'running': return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'blocked': return <AlertCircle className="w-5 h-5 text-destructive" />;
      default: return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const STAGES = [
    { key: 'init', title: 'Iniciar a demanda' },
    { key: 'context', title: 'Contextualização' },
    { key: 'plan', title: 'Plano' },
    { key: 'exec', title: 'Execução do plano' },
    { key: 'test', title: 'Execução dos testes' },
    { key: 'val', title: 'Validação humana' },
    { key: 'fin', title: 'Finalização' }
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col md:flex-row bg-background overflow-hidden">
      
      {/* Panel A: Chat */}
      <div className="flex-1 flex flex-col min-w-[300px] border-r border-border">
        <div className="h-12 border-b border-border flex items-center px-4 gap-3 bg-card shrink-0">
          <button onClick={() => navigate(`/workspaces/${id}/demands`)} className="text-muted-foreground hover:text-foreground text-sm">
            ← Voltar
          </button>
          <div className="h-4 w-px bg-border"></div>
          <Badge variant="outline" className="font-mono">{demand.jiraKey}</Badge>
          <span className="font-medium truncate text-sm">{demand.title}</span>
        </div>
        
        <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
          <div className="space-y-6 pb-4">
            {demand.chat.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-10">
                Nenhuma mensagem ainda. Inicie a demanda.
              </div>
            )}
            {demand.chat.map((msg) => (
              <div key={msg.id} className={`flex ${msg.author === 'dev' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-4 ${msg.author === 'dev' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 border border-border/50 shadow-sm'}`}>
                  <div className="text-sm whitespace-pre-wrap font-sans">{msg.text}</div>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.actions.map((action, i) => (
                        <span key={i} className="text-[11px] bg-background text-foreground px-2 py-1 rounded-md border border-border flex items-center gap-1 shadow-sm">
                          <PlayCircle className="w-3 h-3 text-primary" /> {action}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={`text-[10px] mt-2 opacity-50 text-right`}>
                    {new Date(msg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {sendChat.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted/50 border border-border/50 max-w-[85%] rounded-lg p-4 text-sm flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-muted-foreground">Claude trabalhando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-border bg-card">
          <form onSubmit={handleSend} className="relative">
            <Input 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
              placeholder="Comande o Claude... (use / para atalhos)" 
              className="pr-20 py-6 text-sm bg-background"
              disabled={sendChat.isPending}
            />
            <Button 
              type="submit" 
              size="sm" 
              className="absolute right-2 top-1/2 -translate-y-1/2"
              disabled={sendChat.isPending || !message.trim()}
            >
              Enviar
            </Button>
          </form>
        </div>
      </div>

      {/* Right Column: Panels B & C */}
      <div className="w-full md:w-[400px] xl:w-[480px] flex flex-col bg-card shrink-0">
        
        {/* Panel B: Stage Wizard */}
        <div className="h-1/2 border-b border-border flex flex-col">
          <div className="p-3 border-b border-border bg-muted/20 font-semibold text-xs tracking-wider uppercase flex items-center justify-between">
            <span>Progresso</span>
            <Badge variant="outline" className="bg-background">{demand.dopStatus}</Badge>
          </div>
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {STAGES.map((def, i) => {
                const stage = demand.stages.find(s => s.key === def.key);
                const status = stage ? stage.status : 'pending';
                const isCurrent = status === 'running' || status === 'blocked';
                
                return (
                  <div key={def.key} className={`flex items-start gap-3 p-3 rounded-md transition-colors ${isCurrent ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'} ${status === 'pending' ? 'opacity-60' : ''}`}>
                    <div className="mt-0.5">{getStageIcon(status)}</div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${isCurrent ? 'text-primary' : ''}`}>
                        {i + 1}. {def.title}
                      </div>
                      {stage?.summary && (
                        <div className="text-xs text-muted-foreground mt-1 leading-snug">{stage.summary}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Panel C: Dossier / Logs */}
        <div className="h-1/2 flex flex-col">
          <Tabs defaultValue="dossier" className="w-full h-full flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-border h-12 bg-muted/20 px-4">
              <TabsTrigger value="dossier" className="text-xs uppercase tracking-wider">Dossiê</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs uppercase tracking-wider">Logs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="dossier" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-6">
                  
                  {/* Git Info */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2"><GitCommit className="w-4 h-4"/> Git</h4>
                    <div className="bg-muted/30 rounded border border-border/50 p-3 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Repositórios:</span>
                        <div className="flex gap-1">{demand.dossier.repos.map(r => <Badge key={r} variant="secondary" className="text-[10px] font-mono">{r}</Badge>)}</div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Branches:</span>
                        <div className="flex flex-col items-end gap-1">{demand.dossier.branches.map(b => <span key={b} className="text-[11px] font-mono">{b}</span>)}</div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Commits:</span>
                        <span className="font-mono">{demand.dossier.commits}</span>
                      </div>
                    </div>
                  </div>

                  {/* PRs */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2"><GitPullRequest className="w-4 h-4"/> Pull Requests</h4>
                    {demand.dossier.prs.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Nenhum PR aberto.</div>
                    ) : (
                      demand.dossier.prs.map(pr => (
                        <div key={pr.id} className="bg-muted/30 rounded border border-border/50 p-3 text-sm flex items-center justify-between">
                          <span className="font-mono text-xs truncate max-w-[150px]">{pr.sourceBranch}</span>
                          {pr.merged ? <Badge className="bg-purple-500 hover:bg-purple-600">Merged</Badge> : <Badge variant="outline">Open</Badge>}
                        </div>
                      ))
                    )}
                  </div>

                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="logs" className="flex-1 m-0 flex flex-col overflow-hidden bg-[#0A0A0A]">
              <div className="flex gap-1 p-2 border-b border-[#222]">
                <Button size="sm" variant={logSource === 'app' ? 'default' : 'secondary'} className="h-6 text-[10px]" onClick={() => setLogSource('app')}>App</Button>
                <Button size="sm" variant={logSource === 'test' ? 'default' : 'secondary'} className="h-6 text-[10px]" onClick={() => setLogSource('test')}>Tests</Button>
                <Button size="sm" variant={logSource === 'infra' ? 'default' : 'secondary'} className="h-6 text-[10px]" onClick={() => setLogSource('infra')}>Infra</Button>
              </div>
              <ScrollArea className="flex-1 p-2" ref={logsScrollRef}>
                <div className="font-mono text-[11px] leading-relaxed text-[#00FF00]">
                  {logs.map((log, i) => (
                    <div key={i} className="mb-1 opacity-80 hover:opacity-100 flex gap-2">
                      <span className="text-[#666] shrink-0">{log.at.substring(11, 19)}</span>
                      <span className="text-[#888] shrink-0">[{log.service}]</span>
                      <span className="break-all">{log.line}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-[#555] italic">Aguardando logs...</div>}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
    </div>
  );
}

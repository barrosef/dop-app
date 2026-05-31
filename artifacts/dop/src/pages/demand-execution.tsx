import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDemand, useSendChatMessage, useWorkspace } from '../hooks/use-api';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Progress } from '../components/ui/progress';
import {
  CheckCircle2, Circle, AlertCircle, Loader2,
  GitBranch, GitMerge, ScrollText, Server, MessageSquare,
  Send, ArrowLeft, FileCode, FileText, FlaskConical,
  Clock, Terminal, AlertTriangle, Package, Layers, X,
  ChevronRight
} from 'lucide-react';
import { LogLine, Stage } from '../lib/api/types';
import { api } from '../lib/api/mockClient';

type SectionKey = 'chat' | 'repos' | 'branches' | 'dossier' | 'infra';

const STAGE_DEFS = [
  { key: 'init',    short: 'Iniciar',   title: 'Iniciar a demanda',   hasLogs: false },
  { key: 'context', short: 'Contexto',  title: 'Contextualização',    hasLogs: false },
  { key: 'plan',    short: 'Plano',     title: 'Plano',               hasLogs: false },
  { key: 'exec',    short: 'Execução',  title: 'Execução do plano',   hasLogs: false },
  { key: 'test',    short: 'Testes',    title: 'Execução dos testes', hasLogs: true  },
  { key: 'val',     short: 'Validação', title: 'Validação humana',    hasLogs: false },
  { key: 'fin',     short: 'Finalizar', title: 'Finalização',         hasLogs: false },
];

const SERVICE_COLORS: Record<string, string> = {
  mysql:    'text-orange-400',
  mongodb:  'text-green-400',
  redis:    'text-red-400',
  postgres: 'text-blue-400',
  rabbitmq: 'text-amber-400',
};

function StatusIcon({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  switch (status) {
    case 'done':    return <CheckCircle2 className={`${cls} text-emerald-500`} />;
    case 'running': return <Loader2     className={`${cls} text-primary animate-spin`} />;
    case 'blocked': return <AlertCircle className={`${cls} text-red-500`} />;
    default:        return <Circle      className={`${cls} text-muted-foreground/40`} />;
  }
}

function DopStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new:       'bg-slate-500/20 text-slate-300 border-slate-500/30',
    doing:     'bg-primary/20 text-primary border-primary/30',
    done:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    delivered: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  const labels: Record<string, string> = {
    new: 'Novo', doing: 'Em andamento', done: 'Concluído', delivered: 'Entregue',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${map[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  );
}

function FileKindIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'plan':    return <FileText     className="w-3 h-3 text-blue-400" />;
    case 'context': return <Layers       className="w-3 h-3 text-indigo-400" />;
    case 'adr':     return <ScrollText   className="w-3 h-3 text-amber-400" />;
    case 'source':  return <FileCode     className="w-3 h-3 text-emerald-400" />;
    case 'test':    return <FlaskConical className="w-3 h-3 text-purple-400" />;
    default:        return <FileText     className="w-3 h-3 text-muted-foreground" />;
  }
}

/** Parse "repoName|branchName" convention → { repo, branch } */
function parseBranch(raw: string): { repo: string; branch: string } {
  const sep = raw.indexOf('|');
  if (sep === -1) return { repo: '', branch: raw };
  return { repo: raw.slice(0, sep), branch: raw.slice(sep + 1) };
}

/** Group branch strings by repo */
function groupBranchesByRepo(branches: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const raw of branches) {
    const { repo, branch } = parseBranch(raw);
    const key = repo || '(sem repo)';
    if (!groups[key]) groups[key] = [];
    groups[key].push(branch);
  }
  return groups;
}

export default function DemandExecution() {
  const { id, demandId } = useParams();
  const navigate = useNavigate();
  const { data: demand, isLoading } = useDemand(id, demandId);
  const { data: workspace } = useWorkspace(id);
  const sendChat = useSendChatMessage();

  const [activeSection, setActiveSection]         = useState<SectionKey>('chat');
  const [selectedStage, setSelectedStage]         = useState<string | null>(null);
  const [logSource, setLogSource]                 = useState<'app' | 'test' | 'infra'>('test');
  const [stageLogs, setStageLogs]                 = useState<LogLine[]>([]);
  const [infraLogService, setInfraLogService]     = useState<string | null>(null);
  const [infraLogs, setInfraLogs]                 = useState<LogLine[]>([]);
  const [message, setMessage]                     = useState('');
  const [showSlash, setShowSlash]                 = useState(false);

  const chatScrollRef  = useRef<HTMLDivElement>(null);
  const stageLogsEnd   = useRef<HTMLDivElement>(null);
  const infraLogsEnd   = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  const COMMANDS = [
    { name: '/plan',   description: 'Solicitar plano de execução' },
    { name: '/test',   description: 'Executar testes' },
    { name: '/status', description: 'Ver status da demanda' },
    { name: '/commit', description: 'Commitar e abrir PR' },
    ...(workspace?.claudeExtensions?.commands ?? []).map(c => ({
      name: `/${c.name}`, description: c.description,
    })),
  ];

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [demand?.chat, sendChat.isPending]);

  // Stage logs streaming
  useEffect(() => {
    if (!demandId) return;
    setStageLogs([]);
    let active = true;
    const consume = async () => {
      for await (const line of api.streamLogs(demandId, logSource)) {
        if (!active) break;
        setStageLogs(prev => [...prev, line]);
        setTimeout(() => stageLogsEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    consume();
    return () => { active = false; };
  }, [demandId, logSource]);

  // Infra overlay log streaming
  useEffect(() => {
    if (!infraLogService) return;
    setInfraLogs([]);
    let active = true;
    const consume = async () => {
      for await (const line of api.streamServiceLogs(infraLogService)) {
        if (!active) break;
        setInfraLogs(prev => [...prev, line]);
        setTimeout(() => infraLogsEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    consume();
    return () => { active = false; };
  }, [infraLogService]);

  if (isLoading || !demand) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !demandId) return;
    sendChat.mutate({ demandId, text: message });
    setMessage('');
    setShowSlash(false);
  };

  const handleInputChange = (v: string) => {
    setMessage(v);
    setShowSlash(v.startsWith('/') && v.length >= 1);
  };

  const getStage = (key: string): Stage | undefined =>
    demand.stages.find(s => s.key === key);

  const currentStageKey = selectedStage ??
    STAGE_DEFS.find(d => {
      const s = demand.stages.find(st => st.key === d.key);
      return s?.status === 'running' || s?.status === 'blocked';
    })?.key ??
    STAGE_DEFS.find(d => !demand.stages.find(st => st.key === d.key))?.key ??
    STAGE_DEFS[0].key;

  const currentStageDef  = STAGE_DEFS.find(d => d.key === currentStageKey)!;
  const currentStageData = getStage(currentStageKey);

  const unitTests = demand.dossier.tests.filter(t => t.type === 'unit');
  const e2eTests  = demand.dossier.tests.filter(t => t.type === 'e2e');
  const passUnit  = unitTests.filter(t => t.status === 'success').length;
  const passE2e   = e2eTests.filter(t => t.status === 'success').length;
  const failUnit  = unitTests.filter(t => t.status === 'fail').length;
  const failE2e   = e2eTests.filter(t => t.status === 'fail').length;

  const elapsed    = demand.dossier.elapsedSeconds;
  const elapsedStr = elapsed
    ? `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m ${elapsed % 60}s`
    : null;

  const branchesByRepo = groupBranchesByRepo(demand.dossier.branches);
  const infraServices  = workspace?.runtime?.infra ?? [];
  const infraApps      = workspace?.runtime?.apps  ?? [];

  const NAV_ITEMS: { key: SectionKey; icon: React.ReactNode; label: string }[] = [
    { key: 'chat',     icon: <MessageSquare className="w-5 h-5" />, label: 'Chat'         },
    { key: 'repos',    icon: <GitBranch     className="w-5 h-5" />, label: 'Repositórios' },
    { key: 'branches', icon: <GitMerge      className="w-5 h-5" />, label: 'Branches & PRs'},
    { key: 'dossier',  icon: <ScrollText    className="w-5 h-5" />, label: 'Dossiê'       },
    { key: 'infra',    icon: <Server        className="w-5 h-5" />, label: 'Infra'        },
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden bg-background">

      {/* ── Icon sidebar ── */}
      <div className="w-12 shrink-0 border-r border-border bg-card flex flex-col items-center py-3 gap-1">
        <button
          onClick={() => navigate(`/workspaces/${id}/demands`)}
          className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors mb-2"
          title="Voltar"
          data-testid="button-back-demands"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-full px-1.5"><div className="h-px bg-border/60" /></div>

        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => setActiveSection(item.key)}
            title={item.label}
            data-testid={`button-section-${item.key}`}
            className={`relative w-9 h-9 flex items-center justify-center rounded-md transition-colors
              ${activeSection === item.key
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
          >
            {item.icon}
            {activeSection === item.key && (
              <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary rounded-r-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Side panel ── */}
      <div className="w-72 xl:w-80 shrink-0 border-r border-border flex flex-col bg-card min-h-0">
        <div className="h-10 border-b border-border flex items-center px-3 gap-2 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {NAV_ITEMS.find(i => i.key === activeSection)?.label}
          </span>
          {activeSection === 'chat' && sendChat.isPending && (
            <span className="flex items-center gap-1 text-[10px] text-primary ml-auto">
              <Loader2 className="w-3 h-3 animate-spin" /> Claude...
            </span>
          )}
        </div>

        {/* CHAT */}
        {activeSection === 'chat' && (
          <>
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {demand.chat.length === 0 && (
                <div className="text-center text-muted-foreground text-xs mt-10 leading-relaxed px-4">
                  Nenhuma mensagem ainda.<br />Inicie a conversa com o Claude.
                </div>
              )}
              {demand.chat.map(msg => (
                <div key={msg.id} className={`flex flex-col ${msg.author === 'dev' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[95%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.author === 'dev'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted/50 border border-border/50 text-foreground rounded-bl-sm'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {msg.actions.map((action, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-[10px] bg-background/20 rounded px-2 py-1 font-mono">
                            <Terminal className="w-2.5 h-2.5 shrink-0" />{action}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 mt-0.5 px-1">
                    {new Date(msg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {sendChat.isPending && (
                <div className="flex items-start">
                  <div className="bg-muted/50 border border-border/50 rounded-xl rounded-bl-sm px-3 py-2 text-xs flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    <span className="text-muted-foreground">Claude trabalhando...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-2 border-t border-border shrink-0 relative">
              {showSlash && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-20">
                  {COMMANDS.filter(c => c.name.startsWith(message.split(' ')[0])).map(cmd => (
                    <button
                      key={cmd.name}
                      onClick={() => { setMessage(cmd.name + ' '); setShowSlash(false); inputRef.current?.focus(); }}
                      data-testid={`command-${cmd.name.slice(1)}`}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted/60 transition-colors text-left"
                    >
                      <span className="font-mono text-primary font-semibold">{cmd.name}</span>
                      <span className="text-muted-foreground">{cmd.description}</span>
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-1.5">
                <input
                  ref={inputRef}
                  value={message}
                  onChange={e => handleInputChange(e.target.value)}
                  placeholder="Comande... (/ para atalhos)"
                  className="flex-1 bg-muted/40 border border-border/60 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
                  disabled={sendChat.isPending}
                  data-testid="input-chat"
                />
                <button
                  type="submit"
                  disabled={sendChat.isPending || !message.trim()}
                  data-testid="button-chat-send"
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </>
        )}

        {/* REPOS */}
        {activeSection === 'repos' && (
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-2">
              {demand.dossier.repos.length === 0
                ? <p className="text-xs text-muted-foreground italic">Nenhum repositório impactado ainda.</p>
                : demand.dossier.repos.map(r => (
                  <div key={r} className="flex items-center gap-2 p-2.5 rounded-md bg-muted/30 border border-border/40">
                    <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-mono truncate">{r}</span>
                  </div>
                ))
              }
              <div className="pt-3 mt-1 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Commits totais</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{demand.dossier.commits}</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* BRANCHES — grouped by repo */}
        {activeSection === 'branches' && (
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-4">
              {demand.dossier.branches.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma branch criada ainda.</p>
              ) : (
                Object.entries(branchesByRepo).map(([repo, repoBranches]) => (
                  <div key={repo}>
                    {/* Repo header */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-[11px] font-semibold text-foreground font-mono">{repo}</span>
                    </div>
                    {/* Branches indented under repo */}
                    <div className="ml-4 border-l border-border/40 pl-3 space-y-1.5">
                      {repoBranches.map(b => (
                        <div key={b} className="flex items-center gap-2 py-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronRight className="w-3 h-3 shrink-0 text-border" />
                          <span className="break-all leading-tight">{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {/* PRs */}
              {demand.dossier.prs.length > 0 && (
                <div className="pt-3 border-t border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Pull Requests</p>
                  {demand.dossier.prs.map(pr => (
                    <div key={pr.id} className="mb-2 p-2.5 rounded-md bg-muted/30 border border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-foreground truncate">{pr.sourceBranch}</span>
                        {pr.merged
                          ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">Merged</span>
                          : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 shrink-0">Open</span>
                        }
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">→ {pr.targetBranch}</p>
                      {pr.hasConflict && (
                        <div className="flex items-center gap-1 text-[10px] text-red-400">
                          <AlertTriangle className="w-3 h-3" /> Conflito detectado
                        </div>
                      )}
                      {pr.approver && (
                        <p className="text-[10px] text-muted-foreground">Aprovado: <span className="text-foreground">{pr.approver}</span></p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* DOSSIER */}
        {activeSection === 'dossier' && (
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Arquivos tocados</p>
                {demand.dossier.files.length === 0
                  ? <p className="text-xs text-muted-foreground italic">Nenhum arquivo ainda.</p>
                  : demand.dossier.files.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
                      <FileKindIcon kind={f.kind} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono break-all leading-tight">{f.path}</p>
                        <p className="text-[9px] text-muted-foreground">{f.change === 'created' ? 'criado' : 'modificado'} · {f.kind}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
              {elapsedStr && (
                <div className="pt-2 border-t border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Tempo gasto</p>
                  <div className="flex items-center gap-1.5 text-sm font-mono">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />{elapsedStr}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-border/40">
                <button disabled className="w-full text-xs py-2 px-3 rounded-md border border-border/40 text-muted-foreground cursor-not-allowed opacity-50 flex items-center gap-2 justify-center">
                  <FlaskConical className="w-3.5 h-3.5" /> Ver relatório Allure
                  <span className="text-[9px] bg-muted/50 px-1.5 py-0.5 rounded">em breve</span>
                </button>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* INFRA */}
        {activeSection === 'infra' && (
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-4">
              {infraApps.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Aplicações</p>
                  {infraApps.map(app => (
                    <div key={app.name} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border/40 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className={`w-3.5 h-3.5 shrink-0 ${
                          app.role === 'frontend' ? 'text-blue-400' : 'text-amber-400'
                        }`} />
                        <div className="min-w-0">
                          <span className="text-xs font-mono block truncate">{app.name}</span>
                          <span className="text-[9px] text-muted-foreground">:{app.port} · {app.role}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setInfraLogService(app.name); setInfraLogs([]); }}
                        data-testid={`button-app-logs-${app.name}`}
                        className="text-[10px] px-2 py-1 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10 transition-colors flex items-center gap-1 shrink-0"
                      >
                        <Terminal className="w-3 h-3" /> Ver logs
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {infraServices.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Serviços</p>
                  {infraServices.map(svc => (
                    <div key={svc} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border/40 mb-1.5">
                      <div className="flex items-center gap-2">
                        <Package className={`w-3.5 h-3.5 shrink-0 ${SERVICE_COLORS[svc] ?? 'text-muted-foreground'}`} />
                        <span className="text-xs font-mono">{svc}</span>
                      </div>
                      <button
                        onClick={() => { setInfraLogService(svc); setInfraLogs([]); }}
                        data-testid={`button-infra-logs-${svc}`}
                        className="text-[10px] px-2 py-1 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10 transition-colors flex items-center gap-1"
                      >
                        <Terminal className="w-3 h-3" /> Ver logs
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {infraServices.length === 0 && infraApps.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sem infra configurada.</p>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ── Central panel ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Demand header */}
        <div className="h-10 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-card">
          <Badge variant="outline" className="font-mono text-[11px] shrink-0">{demand.jiraKey}</Badge>
          <span className="text-sm font-medium truncate flex-1">{demand.title}</span>
          <DopStatusBadge status={demand.dopStatus} />
          <span className="text-[10px] text-muted-foreground shrink-0">{demand.jiraStatus}</span>
        </div>

        {/* ── Infra logs overlay ── */}
        {infraLogService ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Overlay header */}
            <div className="h-10 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-muted/20">
              <Package className={`w-4 h-4 shrink-0 ${SERVICE_COLORS[infraLogService] ?? 'text-muted-foreground'}`} />
              <span className="text-sm font-semibold font-mono">{infraLogService}</span>
              <span className="text-[10px] text-muted-foreground">— logs em tempo real</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-400">ao vivo</span>
              </div>
              <button
                onClick={() => setInfraLogService(null)}
                data-testid="button-close-infra-logs"
                className="ml-3 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Fechar logs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Log terminal */}
            <div className="flex-1 bg-[#0a0a0c] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed min-h-0">
              {infraLogs.length === 0 && (
                <div className="flex items-center gap-2 text-[#555]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="italic">Conectando ao serviço {infraLogService}...</span>
                </div>
              )}
              {infraLogs.map((log, i) => (
                <div key={i} className="flex gap-3 mb-0.5 hover:bg-white/[0.03] px-1 rounded group">
                  <span className="text-[#444] shrink-0 select-none">{log.at.substring(11, 19)}</span>
                  <span className={`shrink-0 font-bold ${SERVICE_COLORS[log.service] ?? 'text-[#888]'}`}>[{log.service}]</span>
                  <span className="text-[#d4d8f0] break-all">{log.line}</span>
                </div>
              ))}
              <div ref={infraLogsEnd} />
            </div>
          </div>
        ) : (
          /* ── Normal stage execution view ── */
          <>
            {/* Horizontal stages bar */}
            <div className="border-b border-border bg-card/60 shrink-0">
              <div className="flex items-stretch h-14 px-2 gap-1 overflow-x-auto">
                {STAGE_DEFS.map((def, i) => {
                  const stageData  = getStage(def.key);
                  const status     = stageData?.status ?? 'pending';
                  const isSelected = currentStageKey === def.key;
                  return (
                    <button
                      key={def.key}
                      onClick={() => setSelectedStage(def.key)}
                      data-testid={`stage-tab-${def.key}`}
                      className={`flex items-center gap-2 px-3 my-2 rounded-md shrink-0 transition-all relative
                        ${isSelected
                          ? 'bg-primary/15 border border-primary/30 text-foreground'
                          : 'text-muted-foreground hover:bg-muted/40 border border-transparent'
                        }
                        ${status === 'pending' ? 'opacity-50' : ''}
                      `}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[9px] text-muted-foreground font-mono">{i + 1}</span>
                        <StatusIcon status={status} size="sm" />
                      </div>
                      <span className="text-xs font-medium whitespace-nowrap">{def.short}</span>
                      {isSelected && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage detail */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5">
              <div className="flex items-center gap-3">
                <StatusIcon status={currentStageData?.status ?? 'pending'} />
                <div>
                  <h2 className="text-base font-semibold">{currentStageDef?.title}</h2>
                  {currentStageData?.startedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Iniciado {new Date(currentStageData.startedAt).toLocaleString()}
                      {currentStageData.finishedAt && <> · Concluído {new Date(currentStageData.finishedAt).toLocaleString()}</>}
                    </p>
                  )}
                </div>
                {(currentStageData?.status === 'running' || currentStageData?.status === 'blocked') && (
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium border ${
                    currentStageData.status === 'blocked'
                      ? 'bg-red-500/15 text-red-400 border-red-500/25'
                      : 'bg-primary/15 text-primary border-primary/25'
                  }`}>
                    {currentStageData.status === 'blocked' ? 'Bloqueado' : 'Em andamento'}
                  </span>
                )}
              </div>

              {currentStageData?.summary && (
                <div className="bg-muted/30 border border-border/50 rounded-lg p-4 text-sm leading-relaxed text-foreground/80">
                  {currentStageData.summary}
                </div>
              )}

              {!currentStageData && (
                <p className="text-sm text-muted-foreground italic">Esta etapa ainda não foi iniciada.</p>
              )}

              {currentStageDef?.key === 'val' && currentStageData?.status === 'running' && (
                <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Sua atenção é necessária</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O Claude aguarda sua validação funcional. Teste a feature e responda no chat.
                    </p>
                  </div>
                </div>
              )}

              {/* Test stage extras */}
              {currentStageDef?.hasLogs && (
                <div className="space-y-4">
                  {(unitTests.length > 0 || e2eTests.length > 0) && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <FlaskConical className="w-3.5 h-3.5" /> Resultados dos testes
                      </h3>
                      {unitTests.length > 0 && (
                        <div className="bg-muted/20 border border-border/40 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">Testes unitários</span>
                            <span className="text-muted-foreground font-mono">{passUnit}/{unitTests.length}</span>
                          </div>
                          <Progress value={(passUnit / unitTests.length) * 100} className="h-1.5" />
                          <div className="flex gap-3 text-[10px]">
                            <span className="text-emerald-400">{passUnit} passou</span>
                            <span className="text-red-400">{failUnit} falhou</span>
                            <span className="text-muted-foreground">{unitTests.filter(t => t.status === 'skipped').length} pulado</span>
                          </div>
                        </div>
                      )}
                      {e2eTests.length > 0 && (
                        <div className="bg-muted/20 border border-border/40 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">Testes e2e</span>
                            <span className="text-muted-foreground font-mono">{passE2e}/{e2eTests.length}</span>
                          </div>
                          <Progress value={(passE2e / e2eTests.length) * 100} className="h-1.5" />
                          <div className="flex gap-3 text-[10px]">
                            <span className="text-emerald-400">{passE2e} passou</span>
                            <span className="text-red-400">{failE2e} falhou</span>
                            <span className="text-muted-foreground">{e2eTests.filter(t => t.status === 'skipped').length} pulado</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stage log streaming */}
                  <div className="border border-border/40 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/40">
                      <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Logs</span>
                      <div className="flex gap-1 ml-auto">
                        {(['test', 'app', 'infra'] as const).map(src => (
                          <button key={src} onClick={() => setLogSource(src)} data-testid={`log-source-${src}`}
                            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                              logSource === src ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                            }`}>
                            {src === 'test' ? 'Testes' : src === 'app' ? 'App' : 'Infra'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[#0d0d0f] h-56 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
                      {stageLogs.length === 0 && <span className="text-[#555] italic">Aguardando logs...</span>}
                      {stageLogs.map((log, i) => (
                        <div key={i} className="flex gap-2 mb-0.5 hover:bg-white/5 px-1 rounded">
                          <span className="text-[#555] shrink-0 select-none">{log.at.substring(11, 19)}</span>
                          <span className={`shrink-0 font-semibold ${
                            log.source === 'test'  ? 'text-purple-400' :
                            log.source === 'infra' ? 'text-amber-400'  : 'text-blue-400'
                          }`}>[{log.service}]</span>
                          <span className="text-[#c8d3f5] break-all">{log.line}</span>
                        </div>
                      ))}
                      <div ref={stageLogsEnd} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

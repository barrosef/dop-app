import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDemand, useSendChatMessage, useWorkspace } from '../hooks/use-api';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  CheckCircle2, Circle, AlertCircle, Loader2,
  GitBranch, GitMerge, ScrollText, Server, MessageSquare,
  Send, ArrowLeft, FileCode, FileText, FlaskConical,
  Clock, Terminal, AlertTriangle, Package, Layers, X,
  ChevronRight, ChevronDown, ExternalLink, GitPullRequest,
  CreditCard, XCircle, SkipForward, Search, Minus, Plus, Cloud,
} from 'lucide-react';
import { marked } from 'marked';
import { LogLine, Stage, FileTouched, PullRequest, TestResult, Demand, Workspace } from '../lib/api/types';
import { api } from '../lib/api/mockClient';
import { DocViewer } from '../components/doc-viewer';
import { ExecStageView } from '../components/exec-stage-view';
import { TestStageView } from '../components/test-stage-view';
import { PlanStageView, TestPlan } from '../components/plan-stage-view';

type SectionKey = 'chat' | 'repos' | 'branches' | 'dossier' | 'infra';

type CentralOverlay =
  | { kind: 'file-diff'; file: FileTouched }
  | { kind: 'jira-card' }
  | { kind: 'time-detail' }
  | { kind: 'allure' }
  | { kind: 'manage-repos' }
  | { kind: 'pr-diff'; pr: PullRequest };

const MOCK_AZURE_EXTRA_REPOS: Record<string, { name: string; url: string }[]> = {
  'ws-1': [
    { name: 'portal-admin', url: 'https://org@dev.azure.com/org/portal-cliente/_git/portal-admin' },
    { name: 'shared-ui',    url: 'https://org@dev.azure.com/org/portal-cliente/_git/shared-ui' },
    { name: 'portal-docs',  url: 'https://org@dev.azure.com/org/portal-cliente/_git/portal-docs' },
  ],
  'ws-2': [
    { name: 'api-relatorios',      url: 'https://org@dev.azure.com/org/api-pagamentos/_git/api-relatorios' },
    { name: 'worker-notificacoes', url: 'https://org@dev.azure.com/org/api-pagamentos/_git/worker-notificacoes' },
    { name: 'billing-service',     url: 'https://org@dev.azure.com/org/api-pagamentos/_git/billing-service' },
  ],
};

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

function parseBranch(raw: string): { repo: string; branch: string } {
  const sep = raw.indexOf('|');
  if (sep === -1) return { repo: '', branch: raw };
  return { repo: raw.slice(0, sep), branch: raw.slice(sep + 1) };
}

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

function DiffLine({ line }: { line: string }) {
  const isAdd  = line.startsWith('+') && !line.startsWith('+++');
  const isDel  = line.startsWith('-') && !line.startsWith('---');
  const isHunk = line.startsWith('@@');
  const cls = isAdd  ? 'bg-emerald-500/10 text-emerald-300'
             : isDel  ? 'bg-red-500/10 text-red-300'
             : isHunk ? 'text-purple-400/80'
             : 'text-[#c8d3f5]/60';
  return (
    <div className={`${cls} px-3 min-h-[1.4rem] font-mono text-[11px] leading-snug select-text whitespace-pre`}>
      {line || '\u00A0'}
    </div>
  );
}

function FilesByRepoBranch({ files, onDiff }: {
  files: FileTouched[];
  onDiff: (file: FileTouched) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => openGroups[k] !== false;

  const groups = useMemo(() => {
    const map: Record<string, FileTouched[]> = {};
    for (const f of files) {
      const key = f.repo
        ? `${f.repo}|${f.branch ?? ''}`
        : f.path.split('/')[0];
      if (!map[key]) map[key] = [];
      map[key].push(f);
    }
    return Object.entries(map);
  }, [files]);

  return (
    <div className="space-y-1.5">
      {groups.map(([groupKey, groupFiles]) => {
        const [repo, branch] = groupKey.split('|');
        const open = isOpen(groupKey);
        return (
          <div key={groupKey} className="rounded-md border border-border/30 overflow-hidden">
            <button
              onClick={() => setOpenGroups(prev => ({ ...prev, [groupKey]: !open }))}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-muted/20 hover:bg-muted/30 transition-colors text-left"
            >
              {open
                ? <ChevronDown  className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                : <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
              <GitBranch className="w-3 h-3 text-primary shrink-0" />
              <span className="text-[10px] font-mono font-bold">{repo}</span>
              {branch && (
                <span className="text-[9px] text-muted-foreground font-mono truncate flex-1">⎇ {branch}</span>
              )}
              <span className="ml-auto text-[9px] text-muted-foreground shrink-0">{groupFiles.length}</span>
            </button>
            {open && (
              <div className="divide-y divide-border/20">
                {groupFiles.map((f, i) => {
                  const parts    = f.path.split('/');
                  const filename = parts.pop() ?? f.path;
                  const dirPath  = parts.join('/');
                  return (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted/10 group">
                      <FileKindIcon kind={f.kind} />
                      <div className="flex-1 min-w-0">
                        {dirPath && <span className="text-[9px] text-muted-foreground/40 font-mono">{dirPath}/</span>}
                        <span className="text-[10px] font-mono font-semibold block truncate">{filename}</span>
                      </div>
                      <span className={`text-[8px] px-1 py-0.5 rounded border shrink-0 ${
                        f.change === 'created'
                          ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                          : 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                      }`}>
                        {f.change === 'created' ? '+novo' : '~mod'}
                      </span>
                      {f.diff && (
                        <button
                          onClick={() => onDiff(f)}
                          className="text-[9px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          diff
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PrCard({ pr }: { pr: PullRequest }) {
  return (
    <div className="p-2.5 rounded-md bg-muted/30 border border-border/40 space-y-2">
      <div className="flex items-center gap-2">
        <GitPullRequest className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-[10px] font-mono truncate flex-1 font-semibold">{pr.sourceBranch}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 font-semibold ${
          pr.merged       ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
          pr.hasConflict  ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                            'bg-primary/15 text-primary border-primary/25'
        }`}>
          {pr.merged ? 'Merged' : pr.hasConflict ? 'Conflito' : 'Aberto'}
        </span>
      </div>
      <div className="flex items-center gap-1.5 ml-5">
        <ChevronRight className="w-3 h-3 text-border shrink-0" />
        <span className="text-[9px] text-muted-foreground font-mono">{pr.targetBranch}</span>
      </div>
      {pr.hasConflict && (
        <div className="flex items-center gap-1 text-[9px] text-red-400 ml-5">
          <AlertTriangle className="w-3 h-3" /> Conflito detectado
        </div>
      )}
      {pr.reviewers && pr.reviewers.length > 0 && (
        <div className="flex items-center gap-2 ml-5 flex-wrap">
          <div className="flex items-center gap-0.5">
            {pr.reviewers.map((r, i) => (
              <div
                key={i}
                className="relative"
                title={`${r.name} — ${
                  r.status === 'approved' ? 'aprovado' :
                  r.status === 'rejected' ? 'rejeitou' : 'pendente'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${
                  r.status === 'approved' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' :
                  r.status === 'rejected' ? 'bg-red-500/20 border-red-500 text-red-300' :
                  'bg-muted/50 border-border/60 text-muted-foreground'
                }`}>
                  {r.initials}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full flex items-center justify-center border border-background ${
                  r.status === 'approved' ? 'bg-emerald-500' :
                  r.status === 'rejected' ? 'bg-red-500' :
                  'bg-muted-foreground/30'
                }`}>
                  {r.status === 'approved' && <CheckCircle2 className="w-1.5 h-1.5 text-white" />}
                  {r.status === 'rejected' && <X className="w-1.5 h-1.5 text-white" />}
                </div>
              </div>
            ))}
          </div>
          <span className="text-[9px] text-muted-foreground">
            {pr.reviewers.filter(r => r.status === 'approved').length}/{pr.reviewers.length} aprovaram
          </span>
        </div>
      )}
    </div>
  );
}

function JiraCardOverlay({ demand }: { demand: Demand }) {
  const [tab, setTab] = useState<'card' | 'rfc'>('card');
  const initStage = demand.stages.find(s => s.key === 'init');
  const isSecurity = demand.title.toLowerCase().includes('cve') || demand.title.toLowerCase().includes('segurança');

  return (
    <div className="p-5 space-y-4 max-w-3xl">
      <div className="flex gap-1 border-b border-border/40 mb-4">
        {(['card', 'rfc'] as const).map(k => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === k
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {k === 'card' ? '📋 Card Jira' : '📄 RFC / PRD'}
          </button>
        ))}
      </div>

      {tab === 'card' && (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border/40">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono font-bold text-primary">{demand.jiraKey}</span>
              {isSecurity
                ? <>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">🐛 Bug</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/25">🔴 Crítica</span>
                  </>
                : <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">✨ Melhoria</span>
              }
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">{demand.jiraStatus}</span>
            </div>
            <h3 className="text-sm font-semibold">{demand.title}</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px]">
              {[
                ['Responsável', demand.assignee],
                ['Sprint',      'Sprint 42'],
                ['Reporter',    'Dev Team'],
                ['Tipo',        isSecurity ? 'Security Bug' : 'Story'],
              ].map(([label, val]) => (
                <div key={label} className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">{label}</span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Descrição</p>
              <p className="text-xs text-foreground/80 leading-relaxed bg-muted/20 border border-border/30 rounded p-3">
                {isSecurity
                  ? 'CVE-2026-1234 foi identificada no pacote jsonwebtoken utilizado nos repos portal-frontend e portal-backend. Versões < 9.0.2 são vulneráveis a ataques de falsificação de tokens JWT. Atualização urgente necessária antes do próximo deploy.'
                  : demand.title + '. Consulte a RFC/PRD gerada na aba ao lado para detalhes técnicos completos.'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {(isSecurity ? ['security', 'CVE', 'dependencies', 'urgent'] : ['feature', 'backend', 'sprint-42']).map(l => (
                  <span key={l} className="text-[9px] px-2 py-0.5 rounded-full bg-muted/50 border border-border/50 text-muted-foreground">{l}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'rfc' && (
        initStage?.document
          ? <div
              className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: marked.parse(initStage.document) as string }}
            />
          : <p className="text-sm text-muted-foreground italic py-8 text-center">Nenhum documento RFC/PRD disponível para esta demanda.</p>
      )}
    </div>
  );
}

function TimeDetailOverlay({ demand }: { demand: Demand }) {
  function stageDuration(stage: Stage): string | null {
    if (!stage.startedAt) return null;
    const end  = stage.finishedAt ? new Date(stage.finishedAt) : new Date();
    const secs = Math.max(0, Math.floor((end.getTime() - new Date(stage.startedAt).getTime()) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const elapsed = demand.dossier.elapsedSeconds;
  const elapsedStr = elapsed
    ? `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m ${elapsed % 60}s`
    : null;

  return (
    <div className="p-5 max-w-2xl space-y-4">
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="px-4 py-2 bg-muted/30 border-b border-border/40">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo por etapa</p>
        </div>
        {STAGE_DEFS.map(def => {
          const stage  = demand.stages.find(s => s.key === def.key);
          const status = stage?.status ?? 'pending';
          const dur    = stage ? stageDuration(stage) : null;
          return (
            <div key={def.key} className="flex items-center gap-3 px-4 py-3 border-b border-border/20 last:border-0 hover:bg-muted/10">
              <StatusIcon status={status} size="sm" />
              <span className="text-xs flex-1">{def.title}</span>
              {status === 'pending'
                ? <span className="text-[10px] text-muted-foreground/30">—</span>
                : <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    {dur ?? <Loader2 className="w-3 h-3 animate-spin inline" />}
                    {status === 'running' && <span className="text-[9px] text-primary">em curso</span>}
                  </span>
              }
            </div>
          );
        })}
      </div>
      {elapsedStr && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30 border border-border/40">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Total acumulado</span>
          </div>
          <span className="text-sm font-mono font-bold">{elapsedStr}</span>
        </div>
      )}
    </div>
  );
}

function AllureOverlay({ tests }: { tests: TestResult[] }) {
  const total = tests.length;
  const pass  = tests.filter(t => t.status === 'success').length;
  const fail  = tests.filter(t => t.status === 'fail').length;
  const skip  = tests.filter(t => t.status === 'skipped').length;
  const run   = tests.filter(t => t.status === 'running').length;
  const pct   = total > 0 ? Math.round((pass / total) * 100) : 0;

  return (
    <div className="p-5 max-w-3xl space-y-4">
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Passou',    val: pass, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Falhou',    val: fail, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
          { label: 'Pulado',    val: skip, cls: 'text-muted-foreground bg-muted/30 border-border/40' },
          { label: 'Rodando',   val: run,  cls: 'text-primary bg-primary/10 border-primary/20' },
          { label: '% Sucesso', val: pct,  cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', suffix: '%' },
        ].map(({ label, val, cls, suffix }) => (
          <div key={label} className={`text-center p-3 rounded-lg border ${cls}`}>
            <div className="text-2xl font-bold">{val}{suffix}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {(['unit', 'e2e'] as const).map(type => {
        const typeTests = tests.filter(t => t.type === type);
        if (typeTests.length === 0) return null;
        return (
          <div key={type} className="rounded-lg border border-border/40 overflow-hidden">
            <div className="px-3 py-2 bg-muted/25 border-b border-border/40 text-xs font-bold">
              {type === 'unit' ? '⚗ Testes Unitários' : '🌐 Testes E2E'}
            </div>
            <div className="divide-y divide-border/20">
              {typeTests.map((t, i) => (
                <div key={i} className={`flex items-center gap-2.5 px-3 py-2 ${t.status === 'fail' ? 'bg-red-500/5' : ''}`}>
                  {t.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  {t.status === 'fail'    && <XCircle      className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                  {t.status === 'skipped' && <SkipForward  className="w-3.5 h-3.5 text-muted-foreground/35 shrink-0" />}
                  {t.status === 'running' && <Loader2      className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
                  <span className="text-[11px] flex-1 truncate">{t.name}</span>
                  {t.repo && <span className="text-[9px] text-muted-foreground font-mono shrink-0">{t.repo}</span>}
                  {t.durationMs != null && <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">{t.durationMs}ms</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button
        disabled
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border/40 text-sm text-muted-foreground cursor-not-allowed opacity-60"
      >
        <ExternalLink className="w-3.5 h-3.5" /> Ver relatório completo no CI / CD (Allure)
        <span className="text-[9px] bg-muted/50 px-1.5 py-0.5 rounded ml-1">em breve</span>
      </button>
    </div>
  );
}

function RepoManagerOverlay({
  workspace,
  workspaceId,
  currentRepos,
  onAdd,
  onRemove,
}: {
  workspace: Workspace;
  workspaceId: string;
  currentRepos: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const q = search.toLowerCase();
  const inDemandSet     = new Set(currentRepos);
  const wsRepoNameSet   = new Set(workspace.repos.map(r => r.name));

  const inDemand        = currentRepos.filter(r => r.toLowerCase().includes(q));
  const addableFromWs   = workspace.repos.filter(r => !inDemandSet.has(r.name) && r.name.toLowerCase().includes(q));
  const extraInAzure    = (MOCK_AZURE_EXTRA_REPOS[workspaceId] ?? []).filter(
    r => !wsRepoNameSet.has(r.name) && !inDemandSet.has(r.name) && r.name.toLowerCase().includes(q),
  );

  return (
    <div className="p-5 max-w-3xl space-y-5">
      {/* ── Azure DevOps connection banner ── */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
        <div className="w-9 h-9 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
          <Cloud className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Azure DevOps</p>
          <p className="text-[10px] text-muted-foreground font-mono truncate">
            {workspace.taskManager.baseUrl.replace('https://', '')} · {workspace.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-400">Conectado</span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar repositórios..."
          className="w-full bg-muted/40 border border-border/60 rounded-lg pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {loading ? (
        /* ── Loading skeleton ── */
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-11 rounded-md bg-muted/20 border border-border/20 animate-pulse" />
          ))}
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            Buscando repositórios no Azure DevOps...
          </p>
        </div>
      ) : (
        <>
          {/* ── Section 1: Nesta demanda ── */}
          {inDemand.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Conectados ({inDemand.length})
              </p>
              <div className="space-y-1.5">
                {inDemand.map(r => {
                  const wsRepo = workspace.repos.find(wr => wr.name === r);
                  return (
                    <div key={r} className="flex items-center gap-3 p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/15 group">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono font-semibold">{r}</span>
                        {wsRepo && (
                          <p className="text-[9px] text-muted-foreground font-mono truncate">{wsRepo.remoteUrl}</p>
                        )}
                      </div>
                      <button
                        onClick={() => onRemove(r)}
                        className="flex items-center gap-1 text-[9px] px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <Minus className="w-3 h-3" /> Remover
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Section 2: Disponíveis no workspace ── */}
          {addableFromWs.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Package className="w-3 h-3" />
                Disponíveis
              </p>
              <div className="space-y-1.5">
                {addableFromWs.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 border border-border/40 hover:bg-muted/40 transition-colors group">
                    <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono font-semibold">{r.name}</span>
                      <p className="text-[9px] text-muted-foreground font-mono truncate">{r.remoteUrl}</p>
                    </div>
                    <div className="text-[9px] text-muted-foreground shrink-0">
                      ⎇ {r.baseBranch}
                    </div>
                    <button
                      onClick={() => onAdd(r.name)}
                      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors shrink-0"
                    >
                      <Plus className="w-3 h-3" /> Adicionar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section 3: Outros no Azure DevOps ── */}
          {extraInAzure.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Cloud className="w-3 h-3" />
                Outros
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted/50 border border-border/40 normal-case font-normal tracking-normal">
                  não configurados no workspace
                </span>
              </p>
              <div className="space-y-1.5">
                {extraInAzure.map(r => (
                  <div key={r.name} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/15 border border-border/25 opacity-60">
                    <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono">{r.name}</span>
                      <p className="text-[9px] text-muted-foreground/60 font-mono truncate">{r.url}</p>
                    </div>
                    <span className="text-[9px] px-2 py-1 rounded border border-border/30 text-muted-foreground/60 shrink-0 cursor-default">
                      Adicionar ao workspace primeiro
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inDemand.length === 0 && addableFromWs.length === 0 && extraInAzure.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              Nenhum repositório encontrado para "{search}"
            </p>
          )}
        </>
      )}
    </div>
  );
}

function GitStatusBadge({ status }: { status?: FileTouched['gitStatus'] }) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    staged:    { label: 'A', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    modified:  { label: 'M', cls: 'text-yellow-400  bg-yellow-500/10  border-yellow-500/30'  },
    deleted:   { label: 'D', cls: 'text-red-400     bg-red-500/10     border-red-500/30'     },
    untracked: { label: '?', cls: 'text-muted-foreground/60 bg-muted/20 border-border/30'   },
  };
  const { label, cls } = map[status] ?? map.modified;
  return (
    <span className={`w-4 h-4 shrink-0 flex items-center justify-center rounded text-[9px] font-mono font-bold border ${cls}`}>
      {label}
    </span>
  );
}

const prFileId = (path: string) => `pr-file-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

function PrDiffOverlay({ pr, files, scrollToFile }: { pr: PullRequest; files: FileTouched[]; scrollToFile?: string | null }) {
  const totalAdded   = files.reduce((s, f) => s + (f.linesAdded   ?? 0), 0);
  const totalRemoved = files.reduce((s, f) => s + (f.linesRemoved  ?? 0), 0);

  useEffect(() => {
    if (!scrollToFile) return;
    const el = document.getElementById(prFileId(scrollToFile));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollToFile]);

  return (
    <div>
      {/* PR info header */}
      <div className="px-5 py-3 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-semibold text-foreground">{pr.sourceBranch}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-mono text-xs text-muted-foreground">{pr.targetBranch}</span>
          {pr.merged
            ? <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold">MERGED</span>
            : <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold">OPEN</span>
          }
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
          <span className="font-mono">{pr.repo}</span>
          <span>{files.length} arquivo{files.length !== 1 ? 's' : ''}</span>
          {totalAdded   > 0 && <span className="text-emerald-400">+{totalAdded}</span>}
          {totalRemoved > 0 && <span className="text-red-400">-{totalRemoved}</span>}
        </div>
      </div>

      {/* File diffs */}
      {files.length === 0 && (
        <div className="px-5 py-6 text-xs text-muted-foreground italic">Nenhum arquivo associado a este PR.</div>
      )}
      {files.map((file, i) => (
        <div key={i} id={prFileId(file.path)}>
          <div className={`px-4 py-2 bg-muted/15 border-b border-t border-border/25 flex items-center gap-2.5 sticky top-0 z-10 transition-colors ${scrollToFile === file.path ? 'border-l-2 border-l-primary bg-primary/5' : ''}`}>
            <FileCode className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-xs font-semibold flex-1 truncate">{file.path}</span>
            {file.linesAdded   != null && <span className="text-[10px] text-emerald-400 shrink-0">+{file.linesAdded}</span>}
            {file.linesRemoved != null && <span className="text-[10px] text-red-400    shrink-0">-{file.linesRemoved}</span>}
            <GitStatusBadge status={file.gitStatus} />
          </div>
          {file.diff ? (
            <div className="bg-[#080b10] py-2">
              {file.diff.split('\n').map((line, j) => <DiffLine key={j} line={line} />)}
            </div>
          ) : (
            <div className="px-5 py-3 text-xs text-muted-foreground/60 italic bg-[#080b10]">Diff não disponível</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DemandExecution() {
  const { id, demandId } = useParams();
  const navigate = useNavigate();
  const { data: demand, isLoading } = useDemand(id, demandId);
  const { data: workspace } = useWorkspace(id);
  const sendChat = useSendChatMessage();

  const [activeSection, setActiveSection]     = useState<SectionKey>('chat');
  const [selectedStage, setSelectedStage]     = useState<string | null>(null);
  const [infraLogService, setInfraLogService] = useState<string | null>(null);
  const [infraLogs, setInfraLogs]             = useState<LogLine[]>([]);
  const [message, setMessage]                 = useState('');
  const [showSlash, setShowSlash]             = useState(false);
  const [editedDocs, setEditedDocs]           = useState<Record<string, string>>({});
  const [editedTestPlan, setEditedTestPlan]   = useState<Record<string, Partial<TestPlan>>>({});
  const [centralOverlay, setCentralOverlay]   = useState<CentralOverlay | null>(null);
  const [editedRepos, setEditedRepos]         = useState<string[] | null>(null);
  const [branchTab, setBranchTab]             = useState<'branches' | 'prs'>('branches');
  const [expandedPrId, setExpandedPrId]       = useState<string | null>(null);
  const [selectedPrFilePath, setSelectedPrFilePath] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const infraLogsEnd  = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);

  const COMMANDS = [
    { name: '/plan',   description: 'Solicitar plano de execução' },
    { name: '/test',   description: 'Executar testes' },
    { name: '/status', description: 'Ver status da demanda' },
    { name: '/commit', description: 'Commitar e abrir PR' },
    ...(workspace?.claudeExtensions?.commands ?? []).map(c => ({
      name: `/${c.name}`, description: c.description,
    })),
  ];

  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [demand?.chat, sendChat.isPending]);

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

  const DOC_STAGE_KEYS = ['init', 'context'] as const;

  const handleDocSave = (stageKey: string, newContent: string) => {
    setEditedDocs(prev => ({ ...prev, [stageKey]: newContent }));
  };

  const handleDocChatRequest = (stageKey: string) => {
    const labels: Record<string, string> = {
      init: 'PRD/RFC', context: 'documento de contexto', plan: 'plano de desenvolvimento',
    };
    setMessage(`/edit Ajuste o ${labels[stageKey] ?? 'documento'}: `);
    setActiveSection('chat');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleTestPlanSave = (stageKey: string, type: 'unit' | 'e2e', content: string) => {
    setEditedTestPlan(prev => ({ ...prev, [stageKey]: { ...prev[stageKey], [type]: content } }));
  };

  const handleTestPlanChatRequest = (type: 'unit' | 'e2e') => {
    const label = type === 'unit' ? 'plano de testes unitários' : 'plano de testes e2e';
    setMessage(`/edit Ajuste o ${label}: `);
    setActiveSection('chat');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const isDemandEditable = !['done', 'delivered'].includes(demand.dopStatus);
  const currentRepos     = editedRepos ?? demand.dossier.repos;
  const addRepo    = (name: string) => setEditedRepos(prev => [...(prev ?? demand.dossier.repos), name]);
  const removeRepo = (name: string) => setEditedRepos(prev => (prev ?? demand.dossier.repos).filter(r => r !== name));

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

  const elapsed    = demand.dossier.elapsedSeconds;
  const elapsedStr = elapsed
    ? `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m ${elapsed % 60}s`
    : null;

  const branchesByRepo = groupBranchesByRepo(demand.dossier.branches);
  const infraServices  = workspace?.runtime?.infra ?? [];
  const infraApps      = workspace?.runtime?.apps  ?? [];

  const trackedFiles = demand.dossier.files.filter(f => f.gitStatus !== 'untracked' && f.repo && f.branch);
  const untrackedFiles = demand.dossier.files.filter(f => f.gitStatus === 'untracked');
  const filesByRepoBranch = trackedFiles.reduce<Record<string, Record<string, FileTouched[]>>>((acc, f) => {
    if (!acc[f.repo!]) acc[f.repo!] = {};
    if (!acc[f.repo!][f.branch!]) acc[f.repo!][f.branch!] = [];
    acc[f.repo!][f.branch!].push(f);
    return acc;
  }, {});
  const prsByRepo = demand.dossier.prs.reduce<Record<string, PullRequest[]>>((acc, pr) => {
    if (!acc[pr.repo]) acc[pr.repo] = [];
    acc[pr.repo].push(pr);
    return acc;
  }, {});

  const NAV_ITEMS: { key: SectionKey; icon: React.ReactNode; label: string }[] = [
    { key: 'chat',     icon: <MessageSquare className="w-5 h-5" />, label: 'Chat'          },
    { key: 'repos',    icon: <GitBranch     className="w-5 h-5" />, label: 'Repositórios'  },
    { key: 'branches', icon: <GitMerge      className="w-5 h-5" />, label: 'Branches'     },
    { key: 'dossier',  icon: <ScrollText    className="w-5 h-5" />, label: 'Dossiê'        },
    { key: 'infra',    icon: <Server        className="w-5 h-5" />, label: 'Infra'         },
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
          {activeSection === 'branches' ? (
            <div className="flex items-center gap-0.5">
              {(['branches', 'prs'] as const).map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setBranchTab(tab)}
                  className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${branchTab === tab ? 'text-foreground bg-muted/60' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'}`}
                >
                  {tab === 'branches' ? 'Branches' : 'PRs'}
                  {i === 0 && <span className="inline-block mx-1.5 text-border select-none">|</span>}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {NAV_ITEMS.find(i => i.key === activeSection)?.label}
            </span>
          )}
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
              {currentRepos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum repositório impactado ainda.</p>
              ) : (
                currentRepos.map(r => (
                  <div key={r} className="flex items-center gap-2 p-2.5 rounded-md bg-muted/30 border border-border/40 group">
                    <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs font-mono truncate flex-1">{r}</span>
                    {isDemandEditable && (
                      <button
                        onClick={() => removeRepo(r)}
                        title="Remover repositório"
                        className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}

              <div className="pt-3 mt-1 border-t border-border/40 space-y-2.5">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Commits totais</p>
                  <span className="text-2xl font-bold">{demand.dossier.commits}</span>
                </div>

                {isDemandEditable && (
                  <button
                    onClick={() => setCentralOverlay({ kind: 'manage-repos' })}
                    className="w-full flex items-center gap-2 py-2 px-3 rounded-md border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    Gerenciar repositórios
                  </button>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        {/* BRANCHES */}
        {activeSection === 'branches' && (
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">

              {/* ── Branches tab ── */}
              {branchTab === 'branches' && (
                trackedFiles.length === 0 && untrackedFiles.length === 0
                  ? (
                    demand.dossier.branches.length === 0
                      ? <p className="text-xs text-muted-foreground italic">Nenhuma branch criada ainda.</p>
                      : Object.entries(branchesByRepo).map(([repo, repoBranches]) => (
                          <div key={repo}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="text-[11px] font-semibold font-mono">{repo}</span>
                            </div>
                            <div className="ml-4 border-l border-border/40 pl-3 space-y-1">
                              {repoBranches.map(b => (
                                <div key={b} className="flex items-center gap-2 py-1 text-[10px] font-mono text-muted-foreground">
                                  <ChevronRight className="w-3 h-3 shrink-0 text-border" />
                                  <span className="break-all">{b}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                  ) : (
                    <>
                      {Object.entries(filesByRepoBranch).map(([repo, branches]) => (
                        <div key={repo}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-[11px] font-semibold font-mono">{repo}</span>
                          </div>
                          <div className="ml-4 border-l border-border/40 pl-3 space-y-3">
                            {Object.entries(branches).map(([branch, bFiles]) => (
                              <div key={branch}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ChevronRight className="w-3 h-3 shrink-0 text-border" />
                                  <span className="text-[10px] font-mono text-muted-foreground truncate">{branch}</span>
                                </div>
                                <div className="ml-4 space-y-0.5">
                                  {bFiles.map((f, i) => (
                                    <div key={i} className="flex items-center gap-1.5 py-0.5 text-[10px] font-mono text-foreground/80 hover:text-foreground transition-colors">
                                      <GitStatusBadge status={f.gitStatus} />
                                      <span className="truncate">{f.path}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {untrackedFiles.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50">
                            <div className="flex-1 h-px border-t border-dashed border-border/40" />
                            <span className="uppercase tracking-wider shrink-0">não rastreados</span>
                            <div className="flex-1 h-px border-t border-dashed border-border/40" />
                          </div>
                          <div className="space-y-0.5">
                            {untrackedFiles.map((f, i) => (
                              <div key={i} className="flex items-center gap-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
                                <GitStatusBadge status="untracked" />
                                <span className="truncate flex-1">{f.path}</span>
                                {f.repo && <span className="text-muted-foreground/40 shrink-0 text-[9px]">{f.repo}</span>}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )
              )}

              {/* ── PRs tab ── */}
              {branchTab === 'prs' && (
                demand.dossier.prs.length === 0
                  ? <p className="text-xs text-muted-foreground italic">Nenhum PR criado ainda.</p>
                  : Object.entries(prsByRepo).map(([repo, prs]) => (
                      <div key={repo}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <GitPullRequest className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[11px] font-semibold font-mono">{repo}</span>
                        </div>
                        <div className="ml-4 border-l border-border/40 pl-3 space-y-2">
                          {prs.map(pr => {
                            const isExpanded = expandedPrId === pr.id;
                            const prFiles = demand.dossier.files.filter(
                              f => f.repo === pr.repo && f.branch === pr.sourceBranch && f.gitStatus !== 'untracked',
                            );
                            return (
                              <div key={pr.id}>
                                <button
                                  onClick={() => {
                                    const next = isExpanded ? null : pr.id;
                                    setExpandedPrId(next);
                                    if (next) setCentralOverlay({ kind: 'pr-diff', pr });
                                    else if (centralOverlay?.kind === 'pr-diff') setCentralOverlay(null);
                                  }}
                                  className="w-full text-left p-2 rounded-md bg-muted/30 border border-border/40 hover:bg-muted/40 hover:border-primary/25 transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 mb-1">
                                    {pr.merged
                                      ? <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0 font-semibold">MERGED</span>
                                      : pr.hasConflict
                                        ? <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 shrink-0 font-semibold">CONFLITO</span>
                                        : <span className="text-[8px] px-1 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0 font-semibold">OPEN</span>
                                    }
                                    <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{pr.sourceBranch}</span>
                                    <ChevronDown className={`w-3 h-3 text-muted-foreground shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                  </div>
                                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground/70">
                                    <span>→ {pr.targetBranch}</span>
                                    {prFiles.length > 0 && (
                                      <span className="ml-1 text-muted-foreground/50">· {prFiles.length} arq.</span>
                                    )}
                                  </div>
                                  {pr.reviewers && pr.reviewers.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1.5">
                                      {pr.reviewers.map(rev => (
                                        <span key={rev.initials} title={`${rev.name} — ${rev.status}`}
                                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0 border ${
                                            rev.status === 'approved' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' :
                                            rev.status === 'rejected' ? 'bg-red-500/15 border-red-500/40 text-red-400' :
                                            'bg-muted/40 border-border/50 text-muted-foreground'
                                          }`}>{rev.initials}</span>
                                      ))}
                                    </div>
                                  )}
                                </button>

                                {isExpanded && prFiles.length > 0 && (
                                  <div className="ml-2 mt-1 space-y-0.5 border-l border-primary/20 pl-2.5">
                                    {prFiles.map((f, i) => (
                                      <button
                                        key={i}
                                        onClick={() => {
                                          setSelectedPrFilePath(f.path);
                                          if (centralOverlay?.kind !== 'pr-diff' || centralOverlay.pr.id !== pr.id) {
                                            setCentralOverlay({ kind: 'pr-diff', pr });
                                          }
                                        }}
                                        className={`w-full flex items-center gap-1.5 py-0.5 text-[10px] font-mono text-left rounded transition-colors cursor-pointer
                                          ${selectedPrFilePath === f.path
                                            ? 'text-primary'
                                            : 'text-foreground/70 hover:text-primary'
                                          }`}
                                      >
                                        <GitStatusBadge status={f.gitStatus} />
                                        <span className="truncate flex-1">{f.path}</span>
                                        {f.linesAdded   != null && <span className="text-emerald-400/70 shrink-0">+{f.linesAdded}</span>}
                                        {f.linesRemoved != null && <span className="text-red-400/70    shrink-0">-{f.linesRemoved}</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
              )}

            </div>
          </ScrollArea>
        )}

        {/* DOSSIER */}
        {activeSection === 'dossier' && (
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-4">

              {/* 1 — Card Jira / RFC */}
              <div>
                <button
                  onClick={() => setCentralOverlay({ kind: 'jira-card' })}
                  className="w-full p-2.5 rounded-md bg-muted/30 border border-border/40 hover:bg-muted/50 hover:border-primary/30 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold text-foreground">{demand.jiraKey}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors ml-auto shrink-0" />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1 ml-5 truncate">{demand.title}</p>
                  <p className="text-[8px] text-muted-foreground/50 mt-0.5 ml-5">Card Jira · RFC / PRD</p>
                </button>
              </div>

              {/* 2 — Arquivos tocados */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Arquivos tocados ({demand.dossier.files.length})
                </p>
                {demand.dossier.files.length === 0
                  ? <p className="text-xs text-muted-foreground italic">Nenhum arquivo ainda.</p>
                  : <FilesByRepoBranch
                      files={demand.dossier.files}
                      onDiff={file => setCentralOverlay({ kind: 'file-diff', file })}
                    />
                }
              </div>

              {/* 3 — PRs criados */}
              {demand.dossier.prs.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                    PRs criados ({demand.dossier.prs.length})
                  </p>
                  <div className="space-y-2">
                    {demand.dossier.prs.map(pr => <PrCard key={pr.id} pr={pr} />)}
                  </div>
                </div>
              )}

              {/* 4 — Testes / Allure */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Testes</p>
                <button
                  onClick={() => setCentralOverlay({ kind: 'allure' })}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-md border border-border/40 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-primary/30 transition-colors"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  Ver relatório Allure
                  <ExternalLink className="w-3 h-3 ml-auto shrink-0" />
                </button>
              </div>

              {/* 5 — Tempo gasto */}
              {elapsedStr && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Tempo gasto</p>
                  <button
                    onClick={() => setCentralOverlay({ kind: 'time-detail' })}
                    className="flex items-center gap-1.5 text-sm font-mono hover:text-primary transition-colors group"
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    {elapsedStr}
                    <ChevronRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary ml-1" />
                  </button>
                </div>
              )}
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

        ) : centralOverlay ? (
          /* ── Dossier overlay ── */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Overlay header */}
            <div className="h-10 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-muted/20">
              {centralOverlay.kind === 'file-diff' && (
                <>
                  <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-semibold font-mono flex-1 truncate">
                    {centralOverlay.file.repo ? `${centralOverlay.file.repo} / ` : ''}{centralOverlay.file.path}
                  </span>
                  {centralOverlay.file.linesAdded   != null && <span className="text-[11px] font-mono text-emerald-400 shrink-0">+{centralOverlay.file.linesAdded}</span>}
                  {centralOverlay.file.linesRemoved != null && <span className="text-[11px] font-mono text-red-400 shrink-0 ml-0.5">-{centralOverlay.file.linesRemoved}</span>}
                </>
              )}
              {centralOverlay.kind === 'jira-card' && (
                <>
                  <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm font-semibold flex-1">{demand.jiraKey} — Card & RFC</span>
                </>
              )}
              {centralOverlay.kind === 'time-detail' && (
                <>
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold flex-1">Tempo gasto — detalhe por etapa</span>
                </>
              )}
              {centralOverlay.kind === 'allure' && (
                <>
                  <FlaskConical className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-sm font-semibold flex-1">Relatório de Testes — Allure</span>
                </>
              )}
              {centralOverlay.kind === 'manage-repos' && (
                <>
                  <GitBranch className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold flex-1">Gerenciar Repositórios</span>
                  <span className="text-[10px] text-muted-foreground">
                    {currentRepos.length} adicionado{currentRepos.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
              {centralOverlay.kind === 'pr-diff' && (
                <>
                  <GitPullRequest className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold flex-1 truncate">
                    {centralOverlay.pr.sourceBranch}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{centralOverlay.pr.repo}</span>
                </>
              )}
              <button
                onClick={() => setCentralOverlay(null)}
                className="ml-auto w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Overlay body */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {centralOverlay.kind === 'file-diff' && centralOverlay.file.diff && (
                <div className="bg-[#080b10] min-h-full py-2">
                  {centralOverlay.file.diff.split('\n').map((line, i) => (
                    <DiffLine key={i} line={line} />
                  ))}
                </div>
              )}
              {centralOverlay.kind === 'jira-card' && (
                <JiraCardOverlay demand={demand} />
              )}
              {centralOverlay.kind === 'time-detail' && (
                <TimeDetailOverlay demand={demand} />
              )}
              {centralOverlay.kind === 'allure' && (
                <AllureOverlay tests={demand.dossier.tests} />
              )}
              {centralOverlay.kind === 'manage-repos' && workspace && (
                <RepoManagerOverlay
                  workspace={workspace}
                  workspaceId={id ?? ''}
                  currentRepos={currentRepos}
                  onAdd={addRepo}
                  onRemove={removeRepo}
                />
              )}
              {centralOverlay.kind === 'manage-repos' && !workspace && (
                <div className="p-6 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando workspace...
                </div>
              )}
              {centralOverlay.kind === 'pr-diff' && (
                <PrDiffOverlay
                  pr={centralOverlay.pr}
                  scrollToFile={selectedPrFilePath}
                  files={demand.dossier.files.filter(
                    f => f.repo === centralOverlay.pr.repo &&
                         f.branch === centralOverlay.pr.sourceBranch &&
                         f.gitStatus !== 'untracked',
                  )}
                />
              )}
            </div>
          </div>

        ) : (
          /* ── Normal stage execution view ── */
          <>
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
                <div className="bg-muted/30 border border-border/50 rounded-lg p-3 text-xs leading-relaxed text-foreground/70 italic">
                  {currentStageData.summary}
                </div>
              )}

              {currentStageKey === 'exec' && currentStageData && (
                currentStageData.execData ? (
                  <ExecStageView execData={currentStageData.execData} stageStatus={currentStageData.status} />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground italic py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Claude preparando execução do plano...
                  </div>
                )
              )}

              {currentStageKey === 'plan' && currentStageData && (
                <PlanStageView
                  document={editedDocs[currentStageKey] ?? currentStageData.document}
                  testPlan={{
                    unit: editedTestPlan[currentStageKey]?.unit ?? currentStageData.testPlan?.unit ?? '',
                    e2e:  editedTestPlan[currentStageKey]?.e2e  ?? currentStageData.testPlan?.e2e  ?? '',
                  }}
                  onDocSave={content => handleDocSave(currentStageKey, content)}
                  onDocChatRequest={() => handleDocChatRequest(currentStageKey)}
                  onTestPlanSave={(type, content) => handleTestPlanSave(currentStageKey, type, content)}
                  onTestPlanChatRequest={handleTestPlanChatRequest}
                />
              )}

              {currentStageData && DOC_STAGE_KEYS.includes(currentStageKey as typeof DOC_STAGE_KEYS[number]) && (
                currentStageData.document ? (
                  <DocViewer
                    content={editedDocs[currentStageKey] ?? currentStageData.document}
                    onSave={newContent => handleDocSave(currentStageKey, newContent)}
                    onChatRequest={() => handleDocChatRequest(currentStageKey)}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground italic py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Claude está gerando o documento...
                  </div>
                )
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

              {currentStageKey === 'test' && currentStageData && demandId && (
                <TestStageView
                  tests={demand.dossier.tests}
                  demandId={demandId}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCard, useSendChatMessage, useWorkspace } from '../hooks/use-api';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  CheckCircle2, Circle, AlertCircle, Loader2,
  GitBranch, GitMerge, ScrollText, Server, MessageSquare,
  Send, ArrowLeft, FileCode, FileText, FlaskConical,
  Clock, Terminal, AlertTriangle, Package, Layers, X,
  ChevronRight, ChevronDown, ExternalLink, GitPullRequest,
  CreditCard, XCircle, SkipForward, Search, Minus, Plus, Cloud, Settings,
} from 'lucide-react';
import { marked } from 'marked';
import { LogLine, Stage, FileTouched, PullRequest, TestResult, Card, Workspace } from '../lib/api/types';
import { api } from '../lib/api/mockClient';
import { DocViewer } from '../components/doc-viewer';
import { ExecStageView } from '../components/exec-stage-view';
import { TestStageView } from '../components/test-stage-view';
import { PlanStageView, TestPlan } from '../components/plan-stage-view';
import { useI18n } from '../lib/i18n';

type SectionKey = 'chat' | 'repos' | 'branches' | 'repositoryOverview' | 'infra';

type CentralOverlay =
  | { kind: 'file-diff'; file: FileTouched }
  | { kind: 'provider-card' }
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

const getStageDefs = (t: any) => [
  { key: 'init',    short: t('exec.stage.init.short'),   title: t('exec.stage.init.title'),   hasLogs: false },
  { key: 'context', short: t('exec.stage.context.short'),  title: t('exec.stage.context.title'),    hasLogs: false },
  { key: 'plan',    short: t('exec.stage.plan.short'),     title: t('exec.stage.plan.title'),               hasLogs: false },
  { key: 'exec',    short: t('exec.stage.exec.short'),  title: t('exec.stage.exec.title'),   hasLogs: false },
  { key: 'test',    short: t('exec.stage.test.short'),    title: t('exec.stage.test.title'), hasLogs: true  },
  { key: 'val',     short: t('exec.stage.val.short'), title: t('exec.stage.val.title'),    hasLogs: false },
  { key: 'fin',     short: t('exec.stage.fin.short'), title: t('exec.stage.fin.title'),         hasLogs: false },
];

type E2eTestStatus = 'pending' | 'passed' | 'failed';
interface ParsedE2eTest { id: string; title: string; body: string; }
type FinStepStatus = 'idle' | 'running' | 'done' | 'warn' | 'error';
interface FinItem { label: string; status: FinStepStatus; detail?: string; }
interface FinStep { id: string; label: string; status: FinStepStatus; items: FinItem[]; visible: boolean; }
function parseE2eTests(md: string): ParsedE2eTest[] {
  return md.split(/^### /m).slice(1).map((s, i) => {
    const nl = s.indexOf('\n');
    return {
      id:    `e2e-${i + 1}`,
      title: nl >= 0 ? s.slice(0, nl).trim() : s.trim(),
      body:  nl >= 0 ? s.slice(nl + 1).trim() : '',
    };
  });
}

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
  const { t } = useI18n();
  const map: Record<string, string> = {
    new:       'bg-slate-500/20 text-slate-300 border-slate-500/30',
    doing:     'bg-primary/20 text-primary border-primary/30',
    done:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    delivered: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  const labels: Record<string, string> = {
    new: t('card.status.new'),
    doing: t('card.status.doing'),
    done: t('card.status.done'),
    delivered: t('card.status.delivered'),
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
  const { t } = useI18n();
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
            {pr.reviewers.filter(r => r.status === 'approved').length}/{pr.reviewers.length} {t('exec.review.approved')}
          </span>
        </div>
      )}
    </div>
  );
}

function ProviderCardOverlay({ card }: { card: Card }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'card' | 'rfc'>('card');
  const initStage = card.stages.find(s => s.key === 'init');
  const isSecurity = card.title.toLowerCase().includes('cve') || card.title.toLowerCase().includes('segurança');

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
            {k === 'card' ? t('exec.provider.card') : 'RFC / PRD'}
          </button>
        ))}
      </div>

      {tab === 'card' && (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border/40">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono font-bold text-primary">{card.externalKey}</span>
              {isSecurity
                ? <>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">{card.type}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/25">{t('exec.provider.critical')}</span>
                  </>
                : <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">{card.type}</span>
              }
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">{card.providerStatus}</span>
            </div>
            <h3 className="text-sm font-semibold">{card.title}</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px]">
              {[
                [t('card.assignee'), card.assignee],
                [t('exec.provider.sprint'), 'Sprint 42'],
                [t('exec.provider.reporter'), 'Dev Team'],
                [t('exec.provider.type'), card.type],
              ].map(([label, val]) => (
                <div key={label} className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">{label}</span>
                  <span className="font-medium">{val}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{t('exec.provider.description')}</p>
              <p className="text-xs text-foreground/80 leading-relaxed bg-muted/20 border border-border/30 rounded p-3">
                {isSecurity
                  ? 'CVE-2026-1234 foi identificada no pacote jsonwebtoken utilizado nos repos portal-frontend e portal-backend. Versões < 9.0.2 são vulneráveis a ataques de falsificação de tokens JWT. Atualização urgente necessária antes do próximo deploy.'
                  : `${card.title}. ${t('exec.provider.rfcHint')}`}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{t('exec.provider.labels')}</p>
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
          : <p className="text-sm text-muted-foreground italic py-8 text-center">{t('exec.provider.noRfc')}</p>
      )}
    </div>
  );
}

function TimeDetailOverlay({ card }: { card: Card }) {
  const { t } = useI18n();
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

  const elapsed = card.repositoryOverview.elapsedSeconds;
  const elapsedStr = elapsed
    ? `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m ${elapsed % 60}s`
    : null;

  return (
    <div className="p-5 max-w-2xl space-y-4">
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="px-4 py-2 bg-muted/30 border-b border-border/40">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('exec.time.byStage')}</p>
        </div>
        {getStageDefs(t).map(def => {
          const stage  = card.stages.find(s => s.key === def.key);
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
                    {status === 'running' && <span className="text-[9px] text-primary">{t('exec.view.inProgress')}</span>}
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
            <span className="text-sm font-semibold">{t('exec.time.total')}</span>
          </div>
          <span className="text-sm font-mono font-bold">{elapsedStr}</span>
        </div>
      )}
    </div>
  );
}

function AllureOverlay({ tests }: { tests: TestResult[] }) {
  const { t } = useI18n();
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
          { label: t('test.status.passed'), val: pass, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { label: t('test.status.failed'), val: fail, cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
          { label: t('test.status.skipped'), val: skip, cls: 'text-muted-foreground bg-muted/30 border-border/40' },
          { label: t('test.status.running'), val: run, cls: 'text-primary bg-primary/10 border-primary/20' },
          { label: t('exec.tests.successRate'), val: pct, cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', suffix: '%' },
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
              {type === 'unit' ? t('plan.tests.unit') : t('plan.tests.e2e')}
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
        <ExternalLink className="w-3.5 h-3.5" /> {t('exec.tests.fullReport')}
        <span className="text-[9px] bg-muted/50 px-1.5 py-0.5 rounded ml-1">{t('exec.tests.soon')}</span>
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
  const { t } = useI18n();
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const q = search.toLowerCase();
  const inCardSet     = new Set(currentRepos);
  const wsRepoNameSet   = new Set(workspace.repos.map(r => r.name));

  const inCard        = currentRepos.filter(r => r.toLowerCase().includes(q));
  const addableFromWs   = workspace.repos.filter(r => !inCardSet.has(r.name) && r.name.toLowerCase().includes(q));
  const extraInAzure    = (MOCK_AZURE_EXTRA_REPOS[workspaceId] ?? []).filter(
    r => !wsRepoNameSet.has(r.name) && !inCardSet.has(r.name) && r.name.toLowerCase().includes(q),
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
          <span className="text-[10px] text-emerald-400">{t('exec.repo.connected')}</span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('exec.repo.filter')}
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
            {t('exec.repo.searching')}
          </p>
        </div>
      ) : (
        <>
          {/* ── Section 1: Nesto card ── */}
          {inCard.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                {t('exec.repo.connectedCount', { count: inCard.length })}
              </p>
              <div className="space-y-1.5">
                {inCard.map(r => {
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
                        <Minus className="w-3 h-3" /> {t('exec.repo.remove')}
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
                {t('exec.repo.available')}
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
                      <Plus className="w-3 h-3" /> {t('exec.repo.add')}
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
                {t('exec.repo.others')}
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted/50 border border-border/40 normal-case font-normal tracking-normal">
                  {t('exec.repo.notConfigured')}
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
                      {t('exec.repo.addWorkspaceFirst')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inCard.length === 0 && addableFromWs.length === 0 && extraInAzure.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              {t('exec.repo.notFound', { search })}
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

function ValidationStageView({
  testPlan,
  statuses,
  onStatusChange,
  onMarkAll,
  onChatRequest,
}: {
  testPlan: { unit: string; e2e: string } | undefined;
  statuses: Record<string, E2eTestStatus>;
  onStatusChange: (id: string, status: E2eTestStatus) => void;
  onMarkAll: (status: E2eTestStatus) => void;
  onChatRequest: (testTitle: string) => void;
}) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const tests = React.useMemo(() => parseE2eTests(testPlan?.e2e ?? ''), [testPlan?.e2e]);

  const passed  = tests.filter(t => statuses[t.id] === 'passed').length;
  const failed  = tests.filter(t => statuses[t.id] === 'failed').length;
  const pending = tests.length - passed - failed;

  if (tests.length === 0) {
    return (
      <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-300">{t('card.attention')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('exec.validation.noTests')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold">{t('plan.tests.e2e')}</span>
        <div className="flex items-center gap-1.5">
          {passed  > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">{passed} ok</span>}
          {failed  > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 font-medium">{failed} {t('test.status.failed')}</span>}
          {pending > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/50 font-medium">{pending} {t('exec.view.pending')}</span>}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => onMarkAll('passed')}
            className="text-[10px] px-2 py-1 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" /> {t('exec.validation.markAll')}
          </button>
          <button
            onClick={() => onMarkAll('pending')}
            className="text-[10px] px-2 py-1 rounded border border-border/50 text-muted-foreground hover:bg-muted/30 transition-colors"
            title={t('exec.validation.resetAll')}
          >
            ↺
          </button>
        </div>
      </div>

      {/* Test list */}
      <div className="space-y-2">
        {tests.map(test => {
          const status = statuses[test.id] ?? 'pending';
          const isExpanded = expandedId === test.id;
          return (
            <div
              key={test.id}
              className={`rounded-lg border transition-colors ${
                status === 'passed' ? 'border-emerald-500/25 bg-emerald-500/5'
                : status === 'failed' ? 'border-red-500/25 bg-red-500/5'
                : 'border-border/40 bg-muted/10'
              }`}
            >
              <div className="flex items-center gap-3 p-3">
                {/* Status toggle */}
                <button
                  onClick={() => {
                    const next: E2eTestStatus = status === 'pending' ? 'passed'
                      : status === 'passed' ? 'failed' : 'pending';
                    onStatusChange(test.id, next);
                  }}
                  className="shrink-0"
                  title={t('exec.validation.toggleStatus')}
                >
                  {status === 'passed'
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    : status === 'failed'
                    ? <XCircle className="w-5 h-5 text-red-400" />
                    : <Circle className="w-5 h-5 text-muted-foreground/30" />
                  }
                </button>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground/50 uppercase shrink-0">{test.id}</span>
                    <span className={`text-xs font-medium truncate ${
                      status === 'failed' ? 'text-red-300'
                      : status === 'passed' ? 'text-emerald-300'
                      : 'text-foreground'
                    }`}>
                      {test.title}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {status === 'pending' && (
                    <>
                      <button
                        onClick={() => onStatusChange(test.id, 'passed')}
                        className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      >Passou</button>
                      <button
                        onClick={() => onStatusChange(test.id, 'failed')}
                        className="text-[10px] px-2 py-0.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                      >Falhou</button>
                    </>
                  )}
                  {status !== 'pending' && (
                    <button
                      onClick={() => onStatusChange(test.id, 'pending')}
                      title="Desfazer"
                      className="text-[10px] px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground hover:bg-muted/30 transition-colors"
                    >↺</button>
                  )}
                  {status === 'failed' && (
                    <button
                      onClick={() => onChatRequest(test.title)}
                      className="text-[10px] px-2 py-0.5 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1"
                    >
                      <MessageSquare className="w-2.5 h-2.5" /> Ajuda
                    </button>
                  )}
                  {test.body && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : test.id)}
                      className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded body */}
              {isExpanded && test.body && (
                <div className="px-11 pb-3 pt-1 border-t border-border/20 space-y-0.5">
                  {test.body.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground/70 leading-relaxed">
                      {line.replace(/\*\*(.+?)\*\*/g, '$1')}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <p className="text-[10px] text-muted-foreground/50 italic leading-relaxed">
          Chat: <span className="font-mono">"teste e2e-1 realizado com sucesso"</span> · <span className="font-mono">"teste e2e-2 falhou"</span>
          <br />O Claude pode continuar codando via chat mesmo durante a validação.
        </p>
        {failed === 0 && pending === 0 && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" /> Todos validados
          </span>
        )}
        {failed > 0 && (
          <span className="text-[10px] text-red-400 shrink-0 italic">
            {failed} com falha — peça ajuda ao Claude
          </span>
        )}
      </div>
    </div>
  );
}

function PrDiffOverlay({ pr, files, scrollToFile }: { pr: PullRequest; files: FileTouched[]; scrollToFile?: string | null }) {
  const { t } = useI18n();
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
        <div className="px-5 py-6 text-xs text-muted-foreground italic">{t('exec.pr.noFiles')}</div>
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
            <div className="px-5 py-3 text-xs text-muted-foreground/60 italic bg-[#080b10]">{t('exec.pr.noDiff')}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function FinalizationStageView({
  card,
  autoStart,
  onStart,
}: {
  card: Card;
  autoStart: boolean;
  onStart: () => void;
}) {
  const { t } = useI18n();
  const [started, setStarted] = useState(false);
  const [steps,   setSteps]   = useState<FinStep[]>([]);
  const [phase,   setPhase]   = useState<'idle' | 'running' | 'done'>('idle');
  const cancelRef              = useRef(false);

  useEffect(() => { return () => { cancelRef.current = true; }; }, []);

  const upd = (id: string, patch: Partial<FinStep>) =>
    setSteps(p => p.map(s => s.id === id ? { ...s, ...patch } : s));
  const updItem = (stepId: string, idx: number, patch: Partial<FinItem>) =>
    setSteps(p => p.map(s => s.id === stepId
      ? { ...s, items: s.items.map((it, j) => j === idx ? { ...it, ...patch } : it) }
      : s));
  const d = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  const run = async () => {
    cancelRef.current = false;
    setStarted(true);
    setPhase('running');

    const repos = card.repositoryOverview.repos;
    const prs   = card.repositoryOverview.prs;
    const commitCounts: Record<string, number> = {};
    repos.forEach(r => {
      commitCounts[r] = Math.max(1, card.repositoryOverview.files.filter(f => f.repo === r && f.gitStatus !== 'untracked').length);
    });
    const conflictIdx = prs.length > 0 ? prs.length - 1 : -1; // last PR gets conflict for demo
    const repositoryOverviewLabels = [
      t('exec.fin.overview.pr') || 'PRs e branches',
      t('exec.fin.overview.commits') || 'Commits e pushes',
      t('exec.fin.overview.files') || 'Arquivos modificados',
      t('exec.fin.overview.tests') || 'Testes implementados',
      t('exec.fin.overview.e2e') || 'Resultados E2E',
      t('exec.fin.overview.finalizing') || 'Finalizando visão geral'
    ];

    const init: FinStep[] = [
      { id: 'repos',     label: t('exec.fin.repos'), status: 'idle', visible: true,
        items: repos.map(r => ({ label: r, status: 'idle' as FinStepStatus })) },
      { id: 'prs',       label: t('exec.fin.prs'),    status: 'idle', visible: true,
        items: prs.map(p => ({ label: `${p.repo} — ${p.sourceBranch} → ${p.targetBranch}`, status: 'idle' as FinStepStatus })) },
      { id: 'conflicts', label: t('exec.fin.conflicts'),     status: 'idle', visible: true,
        items: prs.map(p => ({ label: p.repo, status: 'idle' as FinStepStatus })) },
      { id: 'resolve',   label: t('exec.fin.resolve'),       status: 'idle', visible: false,
        items: conflictIdx >= 0 ? [{ label: prs[conflictIdx].repo, status: 'idle' as FinStepStatus }] : [] },
      { id: 'repositoryOverview',   label: t('exec.fin.overview'),    status: 'idle', visible: true,
        items: repositoryOverviewLabels.map(l => ({ label: l, status: 'idle' as FinStepStatus })) },
    ];
    setSteps(init);
    await d(350);

    /* ── repos ── */
    upd('repos', { status: 'running' });
    for (let i = 0; i < repos.length; i++) {
      if (cancelRef.current) return;
      updItem('repos', i, { status: 'running', detail: 'verificando...' });
      await d(550);
      const c = commitCounts[repos[i]];
      updItem('repos', i, { detail: `${c} commit${c !== 1 ? 's' : ''}, pushing...` });
      await d(500);
      updItem('repos', i, { status: 'done', detail: `${c} commit${c !== 1 ? 's' : ''} · pushed ✓` });
      await d(200);
    }
    upd('repos', { status: 'done' });
    await d(350);

    /* ── PRs ── */
    if (prs.length === 0) {
      upd('prs', { status: 'done' });
    } else {
      upd('prs', { status: 'running' });
      for (let i = 0; i < prs.length; i++) {
        if (cancelRef.current) return;
        updItem('prs', i, { status: 'running', detail: 'criando PR...' });
        await d(700);
        updItem('prs', i, { status: 'done', detail: 'criado ✓' });
        await d(200);
      }
      upd('prs', { status: 'done' });
    }
    await d(350);

    /* ── conflicts ── */
    if (prs.length === 0) {
      upd('conflicts', { status: 'done' });
    } else {
      upd('conflicts', { status: 'running' });
      let hasConflict = false;
      for (let i = 0; i < prs.length; i++) {
        if (cancelRef.current) return;
        updItem('conflicts', i, { status: 'running', detail: 'verificando...' });
        await d(600);
        const isConflict = i === conflictIdx;
        if (isConflict) hasConflict = true;
        updItem('conflicts', i, {
          status: isConflict ? 'warn' : 'done',
          detail: isConflict ? 'conflito detectado' : 'sem conflitos ✓',
        });
        await d(200);
      }
      upd('conflicts', { status: hasConflict ? 'warn' : 'done' });

      /* ── resolve ── */
      if (hasConflict && conflictIdx >= 0) {
        await d(300);
        upd('resolve', { status: 'running', visible: true });
        updItem('resolve', 0, { status: 'running', detail: 'analisando diff...' });
        await d(800);
        updItem('resolve', 0, { detail: 'resolvendo conflito...' });
        await d(900);
        updItem('resolve', 0, { status: 'done', detail: 'conflito resolvido ✓' });
        await d(300);
        upd('resolve', { status: 'done' });
      }
    }
    await d(400);

    /* ── repositoryOverview ── */
    upd('repositoryOverview', { status: 'running' });
    for (let i = 0; i < repositoryOverviewLabels.length; i++) {
      if (cancelRef.current) return;
      updItem('repositoryOverview', i, { status: 'running', detail: 'gerando...' });
      await d(380 + Math.random() * 300);
      updItem('repositoryOverview', i, { status: 'done', detail: 'gerado ✓' });
      await d(120);
    }
    upd('repositoryOverview', { status: 'done' });
    await d(500);
    setPhase('done');
  };

  useEffect(() => {
    if (autoStart && !started) run();
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Idle state: trigger button ── */
  if (!started) {
    return (
      <div className="space-y-4">
        <div className="border border-border/40 rounded-lg p-4 flex items-start gap-3 bg-muted/10">
          <GitMerge className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{t('exec.fin.ready')}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {t('exec.fin.desc') || 'Irá verificar os repos, criar PRs, resolver conflitos e gerar a visão geral final.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { onStart(); run(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <GitMerge className="w-4 h-4" /> {t('exec.fin.start') || 'Finalizar card'}
          </button>
          <p className="text-[10px] text-muted-foreground/50 italic"></p>
        </div>
      </div>
    );
  }

  /* ── Running / done state ── */
  return (
    <div className="space-y-2.5">
      {steps.filter(s => s.visible).map(step => {
        const doneCount   = step.items.filter(it => ['done','warn','error'].includes(it.status)).length;
        const progressPct = step.items.length > 0
          ? Math.round((doneCount / step.items.length) * 100)
          : step.status !== 'idle' ? 100 : 0;

        return (
          <div
            key={step.id}
            className={`rounded-lg border transition-all overflow-hidden ${
              step.status === 'idle'    ? 'border-border/25 bg-muted/5 opacity-40'
              : step.status === 'running' ? 'border-primary/30 bg-primary/5'
              : step.status === 'done'    ? 'border-emerald-500/20 bg-emerald-500/5'
              : step.status === 'warn'    ? 'border-amber-500/25 bg-amber-500/5'
              : 'border-red-500/20 bg-red-500/5'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2.5">
              {step.status === 'idle'    ? <Circle        className="w-4 h-4 text-muted-foreground/25 shrink-0" />
               : step.status === 'running' ? <Loader2      className="w-4 h-4 text-primary animate-spin shrink-0" />
               : step.status === 'done'    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
               : step.status === 'warn'    ? <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
               : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span className={`text-sm font-medium flex-1 ${step.status === 'idle' ? 'text-muted-foreground/50' : ''}`}>
                {step.label}
              </span>
              {step.status !== 'idle' && (
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{progressPct}%</span>
              )}
            </div>

            {/* Progress bar */}
            {step.status !== 'idle' && (
              <div className="h-0.5 bg-border/30 mx-4 rounded-full overflow-hidden mb-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    step.status === 'done' ? 'bg-emerald-500'
                    : step.status === 'warn' ? 'bg-amber-500'
                    : step.status === 'error' ? 'bg-red-500'
                    : 'bg-primary'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}

            {/* Sub-items */}
            {step.status !== 'idle' && step.items.length > 0 && (
              <div className="px-4 pt-1.5 pb-3 space-y-1">
                {step.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="w-3.5 shrink-0 flex justify-center">
                      {item.status === 'done'    && <CheckCircle2   className="w-3 h-3 text-emerald-400" />}
                      {item.status === 'warn'    && <AlertTriangle  className="w-3 h-3 text-amber-400" />}
                      {item.status === 'running' && <Loader2        className="w-3 h-3 text-primary animate-spin" />}
                      {item.status === 'error'   && <XCircle        className="w-3 h-3 text-red-400" />}
                      {item.status === 'idle'    && <span className="w-3 h-3 rounded-full border border-muted-foreground/20 inline-block" />}
                    </span>
                    <span className={`font-mono truncate ${
                      item.status === 'idle'    ? 'text-muted-foreground/40'
                      : item.status === 'running' ? 'text-foreground'
                      : item.status === 'warn'    ? 'text-amber-300'
                      : item.status === 'done'    ? 'text-foreground/70'
                      : 'text-red-300'
                    }`}>{item.label}</span>
                    {item.detail && (
                      <span className="text-muted-foreground/60 shrink-0 ml-0.5">{item.detail}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {phase === 'done' && (
        <div className="flex items-center gap-3 mt-1 py-3 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">{t('exec.fin.success')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('exec.fin.successDetail')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CardExecution() {
  const { t } = useI18n();
  const { id, cardId } = useParams();
  const navigate = useNavigate();
  const { data: card, isLoading } = useCard(id, cardId);
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
  const [valTestStatuses, setValTestStatuses]       = useState<Record<string, E2eTestStatus>>({});
  const [finTriggered,    setFinTriggered]           = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const infraLogsEnd  = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);

  const COMMANDS = [
    { name: '/plan',   description: 'Solicitar plano de execução' },
    { name: '/test',   description: 'Executar testes' },
    { name: '/status', description: 'Ver status do card' },
    { name: '/commit', description: 'Commitar e abrir PR' },
    ...(workspace?.claudeExtensions?.commands ?? []).map(c => ({
      name: `/${c.name}`, description: c.description,
    })),
  ];

  useEffect(() => {
    if (chatScrollRef.current)
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [card?.chat, sendChat.isPending]);

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

  if (isLoading || !card) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !cardId) return;

    if (currentStageKey === 'val') {
      const valE2eMd = getStage('plan')?.testPlan?.e2e ?? '';
      const valTests = parseE2eTests(valE2eMd);
      const msgLower = message.toLowerCase();
      for (const t of valTests) {
        if (msgLower.includes(t.id)) {
          if (/realiz|sucesso|passou|\bok\b/.test(msgLower)) {
            setValTestStatuses(prev => ({ ...prev, [t.id]: 'passed' }));
          } else if (/falh|failed|erro/.test(msgLower)) {
            setValTestStatuses(prev => ({ ...prev, [t.id]: 'failed' }));
          }
        }
      }
    }

    if (/finaliz/i.test(message)) setFinTriggered(true);

    sendChat.mutate({ cardId, text: message });
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

  const handleValMarkAll = (status: E2eTestStatus) => {
    const valTests = parseE2eTests(getStage('plan')?.testPlan?.e2e ?? '');
    if (status === 'pending') { setValTestStatuses({}); return; }
    const next: Record<string, E2eTestStatus> = {};
    for (const t of valTests) next[t.id] = status;
    setValTestStatuses(next);
  };

  const handleValTestChatRequest = (testTitle: string) => {
    setMessage(`O teste "${testTitle}" falhou. Preciso de ajuda para investigar e corrigir. `);
    setActiveSection('chat');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const isCardEditable = !['done', 'delivered'].includes(card.dopStatus);
  const currentRepos     = editedRepos ?? card.repositoryOverview.repos;
  const addRepo    = (name: string) => setEditedRepos(prev => [...(prev ?? card.repositoryOverview.repos), name]);
  const removeRepo = (name: string) => setEditedRepos(prev => (prev ?? card.repositoryOverview.repos).filter(r => r !== name));

  const handleInputChange = (v: string) => {
    setMessage(v);
    setShowSlash(v.startsWith('/') && v.length >= 1);
  };

  const getStage = (key: string): Stage | undefined =>
    card.stages.find(s => s.key === key);

  const currentStageKey = selectedStage ??
    getStageDefs(t).find(d => {
      const s = card.stages.find(st => st.key === d.key);
      return s?.status === 'running' || s?.status === 'blocked';
    })?.key ??
    getStageDefs(t).find(d => !card.stages.find(st => st.key === d.key))?.key ??
    getStageDefs(t)[0].key;

  const currentStageDef  = getStageDefs(t).find(d => d.key === currentStageKey)!;
  const currentStageData = getStage(currentStageKey);

  const elapsed    = card.repositoryOverview.elapsedSeconds;
  const elapsedStr = elapsed
    ? `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m ${elapsed % 60}s`
    : null;

  const branchesByRepo = groupBranchesByRepo(card.repositoryOverview.branches);
  const infraServices  = workspace?.runtime?.infra ?? [];
  const infraApps      = workspace?.runtime?.apps  ?? [];

  const trackedFiles = card.repositoryOverview.files.filter(f => f.gitStatus !== 'untracked' && f.repo && f.branch);
  const untrackedFiles = card.repositoryOverview.files.filter(f => f.gitStatus === 'untracked');
  const filesByRepoBranch = trackedFiles.reduce<Record<string, Record<string, FileTouched[]>>>((acc, f) => {
    if (!acc[f.repo!]) acc[f.repo!] = {};
    if (!acc[f.repo!][f.branch!]) acc[f.repo!][f.branch!] = [];
    acc[f.repo!][f.branch!].push(f);
    return acc;
  }, {});
  const prsByRepo = card.repositoryOverview.prs.reduce<Record<string, PullRequest[]>>((acc, pr) => {
    if (!acc[pr.repo]) acc[pr.repo] = [];
    acc[pr.repo].push(pr);
    return acc;
  }, {});

  const NAV_ITEMS: { key: SectionKey; icon: React.ReactNode; label: string }[] = [
    { key: 'chat', icon: <MessageSquare className="w-5 h-5" />, label: t('exec.nav.chat') },
    { key: 'repos', icon: <GitBranch className="w-5 h-5" />, label: t('exec.nav.repos') },
    { key: 'branches', icon: <GitMerge className="w-5 h-5" />, label: t('exec.nav.branches') },
    { key: 'repositoryOverview', icon: <ScrollText className="w-5 h-5" />, label: t('exec.nav.overview') },
    { key: 'infra', icon: <Server className="w-5 h-5" />, label: t('exec.nav.infra') },
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden bg-background">

      {/* ── Icon sidebar ── */}
      <div className="w-12 shrink-0 border-r border-border bg-card flex flex-col items-center py-3 gap-1">
        <button
          onClick={() => navigate(`/workspaces/${id}/cards`)}
          className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors mb-2"
          title={t('exec.action.back')}
          data-testid="button-back-cards"
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
                  {tab === 'branches' ? t('repo.branches') : t('repo.prs')}
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
          {activeSection === 'repos' && isCardEditable && (
            <button
              onClick={() => setCentralOverlay({ kind: 'manage-repos' })}
               title={t('exec.repo.manage')}
              className="ml-auto w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* CHAT */}
        {activeSection === 'chat' && (
          <>
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {card.chat.length === 0 && (
                <div className="text-center text-muted-foreground text-xs mt-10 leading-relaxed px-4">
                   {t('exec.chat.empty')}<br />{t('exec.chat.start')}
                </div>
              )}
              {card.chat.map(msg => (
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
                    <span className="text-muted-foreground">{t('exec.chat.working')}</span>
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
                  placeholder={t('exec.chat.command')}
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
                <p className="text-xs text-muted-foreground italic">{t('exec.repo.noneImpacted')}</p>
              ) : (
                currentRepos.map(r => {
                  const branch = card.repositoryOverview.branches
                    .find(b => b.startsWith(r + '|'))?.split('|')[1];
                  const fileCount = card.repositoryOverview.files
                    .filter(f => f.repo === r && f.gitStatus !== 'untracked').length;
                  return (
                    <div key={r} className="flex items-start gap-2 p-2.5 rounded-md bg-muted/30 border border-border/40 group">
                      <GitBranch className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono truncate block">{r}</span>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-[9px] font-mono text-muted-foreground/60 truncate">
                            {branch ?? '—'}
                          </span>
                          {fileCount > 0 && (
                            <span className="text-[9px] text-muted-foreground/60 shrink-0">
                               {fileCount} {t('exec.files.abbr')}
                            </span>
                          )}
                        </div>
                      </div>
                      {isCardEditable && (
                        <button
                          onClick={() => removeRepo(r)}
                           title={t('exec.repo.remove')}
                          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}

              <div className="pt-3 mt-1 border-t border-border/40">
                 <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('cockpit.repo.commits')}</p>
                <span className="text-2xl font-bold">{card.repositoryOverview.commits}</span>
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
                    card.repositoryOverview.branches.length === 0
                       ? <p className="text-xs text-muted-foreground italic">{t('exec.branches.none')}</p>
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
                             <span className="uppercase tracking-wider shrink-0">{t('exec.files.untracked')}</span>
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
                card.repositoryOverview.prs.length === 0
                  ? <p className="text-xs text-muted-foreground italic">{t('exec.pr.none')}</p>
                  : Object.entries(prsByRepo).map(([repo, prs]) => (
                      <div key={repo}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <GitPullRequest className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[11px] font-semibold font-mono">{repo}</span>
                        </div>
                        <div className="ml-4 border-l border-border/40 pl-3 space-y-2">
                          {prs.map(pr => {
                            const isExpanded = expandedPrId === pr.id;
                            const prFiles = card.repositoryOverview.files.filter(
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
                                         ? <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 shrink-0 font-semibold">{t('cockpit.pr.conflict').toUpperCase()}</span>
                                         : <span className="text-[8px] px-1 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 shrink-0 font-semibold">{t('cockpit.pr.open').toUpperCase()}</span>
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
        {activeSection === 'repositoryOverview' && (
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-4">

              {/* 1 — Card Provider / RFC */}
              <div>
                <button
                  onClick={() => setCentralOverlay({ kind: 'provider-card' })}
                  className="w-full p-2.5 rounded-md bg-muted/30 border border-border/40 hover:bg-muted/50 hover:border-primary/30 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold text-foreground">{card.externalKey}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors ml-auto shrink-0" />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1 ml-5 truncate">{card.title}</p>
                  <p className="text-[8px] text-muted-foreground/50 mt-0.5 ml-5">Card Provider · RFC / PRD</p>
                </button>
              </div>

              {/* 2 — Arquivos tocados */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                   {t('exec.overview.files', { count: card.repositoryOverview.files.length })}
                </p>
                {card.repositoryOverview.files.length === 0
                   ? <p className="text-xs text-muted-foreground italic">{t('exec.overview.noFiles')}</p>
                  : <FilesByRepoBranch
                      files={card.repositoryOverview.files}
                      onDiff={file => setCentralOverlay({ kind: 'file-diff', file })}
                    />
                }
              </div>

              {/* 3 — PRs criados */}
              {card.repositoryOverview.prs.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                     {t('exec.overview.prs', { count: card.repositoryOverview.prs.length })}
                  </p>
                  <div className="space-y-2">
                    {card.repositoryOverview.prs.map(pr => <PrCard key={pr.id} pr={pr} />)}
                  </div>
                </div>
              )}

              {/* 4 — Testes / Allure */}
              <div>
                 <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{t('exec.stage.test.short')}</p>
                <button
                  onClick={() => setCentralOverlay({ kind: 'allure' })}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-md border border-border/40 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-primary/30 transition-colors"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                   {t('exec.tests.viewAllure')}
                  <ExternalLink className="w-3 h-3 ml-auto shrink-0" />
                </button>
              </div>

              {/* 5 — Tempo gasto */}
              {elapsedStr && (
                <div>
                   <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{t('exec.time.elapsed')}</p>
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
                   <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{t('exec.infra.apps')}</p>
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
                         <Terminal className="w-3 h-3" /> {t('exec.logs.view')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {infraServices.length > 0 && (
                <div>
                   <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">{t('exec.infra.services')}</p>
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
                         <Terminal className="w-3 h-3" /> {t('exec.logs.view')}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {infraServices.length === 0 && infraApps.length === 0 && (
                 <p className="text-xs text-muted-foreground italic">{t('exec.infra.none')}</p>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ── Central panel ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Card header */}
        <div className="h-10 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-card">
          <Badge variant="outline" className="font-mono text-[11px] shrink-0">{card.externalKey}</Badge>
          <span className="text-sm font-medium truncate flex-1">{card.title}</span>
          <DopStatusBadge status={card.dopStatus} />
          <span className="text-[10px] text-muted-foreground shrink-0">{card.providerStatus}</span>
        </div>

        {/* ── Infra logs overlay ── */}
        {infraLogService ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="h-10 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-muted/20">
              <Package className={`w-4 h-4 shrink-0 ${SERVICE_COLORS[infraLogService] ?? 'text-muted-foreground'}`} />
              <span className="text-sm font-semibold font-mono">{infraLogService}</span>
               <span className="text-[10px] text-muted-foreground">— {t('exec.logs.realtime')}</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] text-emerald-400">{t('exec.logs.live')}</span>
              </div>
              <button
                onClick={() => setInfraLogService(null)}
                data-testid="button-close-infra-logs"
                className="ml-3 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                 title={t('exec.logs.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-[#0a0a0c] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed min-h-0">
              {infraLogs.length === 0 && (
                <div className="flex items-center gap-2 text-[#555]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                   <span className="italic">{t('exec.logs.connecting', { service: infraLogService })}</span>
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
          /* ── RepositoryOverview overlay ── */
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
              {centralOverlay.kind === 'provider-card' && (
                <>
                  <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm font-semibold flex-1">{card.externalKey} — Card & RFC</span>
                </>
              )}
              {centralOverlay.kind === 'time-detail' && (
                <>
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                   <span className="text-sm font-semibold flex-1">{t('exec.time.detail')}</span>
                </>
              )}
              {centralOverlay.kind === 'allure' && (
                <>
                  <FlaskConical className="w-4 h-4 text-purple-400 shrink-0" />
                   <span className="text-sm font-semibold flex-1">{t('exec.tests.allureTitle')}</span>
                </>
              )}
              {centralOverlay.kind === 'manage-repos' && (
                <>
                  <GitBranch className="w-4 h-4 text-primary shrink-0" />
                   <span className="text-sm font-semibold flex-1">{t('exec.repo.manage')}</span>
                  <span className="text-[10px] text-muted-foreground">
                     {t('exec.repo.addedCount', { count: currentRepos.length })}
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
                 title={t('exec.view.close')}
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
              {centralOverlay.kind === 'provider-card' && (
                <ProviderCardOverlay card={card} />
              )}
              {centralOverlay.kind === 'time-detail' && (
                <TimeDetailOverlay card={card} />
              )}
              {centralOverlay.kind === 'allure' && (
                <AllureOverlay tests={card.repositoryOverview.tests} />
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
                   <Loader2 className="w-4 h-4 animate-spin" /> {t('exec.workspace.loading')}
                </div>
              )}
              {centralOverlay.kind === 'pr-diff' && (
                <PrDiffOverlay
                  pr={centralOverlay.pr}
                  scrollToFile={selectedPrFilePath}
                  files={card.repositoryOverview.files.filter(
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
                {getStageDefs(t).map((def, i) => {
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
                       {t('exec.time.started')} {new Date(currentStageData.startedAt).toLocaleString()}
                       {currentStageData.finishedAt && <> · {t('exec.stage.done')} {new Date(currentStageData.finishedAt).toLocaleString()}</>}
                    </p>
                  )}
                </div>
                {(currentStageData?.status === 'running' || currentStageData?.status === 'blocked') && (
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium border ${
                    currentStageData.status === 'blocked'
                      ? 'bg-red-500/15 text-red-400 border-red-500/25'
                      : 'bg-primary/15 text-primary border-primary/25'
                  }`}>
                     {currentStageData.status === 'blocked' ? t('exec.status.blocked') : t('exec.view.inProgress')}
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
                     {t('exec.stage.preparing')}
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
                     {t('exec.stage.generatingDocument')}
                  </div>
                )
              )}

              {!currentStageData && (
                 <p className="text-sm text-muted-foreground italic">{t('exec.stage.notStarted')}</p>
              )}

              {currentStageDef?.key === 'val' && currentStageData && (
                <ValidationStageView
                  testPlan={getStage('plan')?.testPlan}
                  statuses={valTestStatuses}
                  onStatusChange={(id, status) => setValTestStatuses(prev => ({ ...prev, [id]: status }))}
                  onMarkAll={handleValMarkAll}
                  onChatRequest={handleValTestChatRequest}
                />
              )}

              {currentStageKey === 'test' && currentStageData && cardId && (
                <TestStageView
                  tests={card.repositoryOverview.tests}
                  cardId={cardId}
                />
              )}

              {currentStageDef?.key === 'fin' && (
                <FinalizationStageView
                  card={card}
                  autoStart={finTriggered}
                  onStart={() => setFinTriggered(true)}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

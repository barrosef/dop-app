import { useState, useEffect, useRef, useMemo } from 'react';
import { Progress } from './ui/progress';
import { api } from '../lib/api/mockClient';
import { TestResult, LogLine } from '../lib/api/types';
import {
  CheckCircle2, XCircle, SkipForward, Loader2,
  FlaskConical, Terminal, GitBranch,
  ChevronDown, ChevronRight
} from 'lucide-react';

interface Props { tests: TestResult[]; demandId: string; }

type LogSource = 'test' | 'app' | 'infra';
type PanelTab  = 'results' | 'logs';

function isDone(t: TestResult) {
  return t.status === 'success' || t.status === 'fail' || t.status === 'skipped';
}

function StatusIcon({ status }: { status: TestResult['status'] }) {
  if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  if (status === 'fail')    return <XCircle      className="w-3.5 h-3.5 text-red-500 shrink-0" />;
  if (status === 'skipped') return <SkipForward  className="w-3.5 h-3.5 text-muted-foreground/35 shrink-0" />;
  return <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />;
}

function TestRow({ test }: { test: TestResult }) {
  const isRunning = test.status === 'running';
  const isFail    = test.status === 'fail';
  const isSkip    = test.status === 'skipped';
  return (
    <div className={`flex items-center gap-2.5 px-5 py-1.5 hover:bg-muted/10 transition-colors ${isFail ? 'bg-red-500/5' : ''}`}>
      <StatusIcon status={test.status} />
      <span className={`text-[11px] flex-1 truncate ${
        isFail    ? 'text-red-300 font-medium' :
        isSkip    ? 'text-muted-foreground/40 line-through' :
        isRunning ? 'text-primary' :
        'text-foreground/90'
      }`}>
        {test.name}
      </span>
      {test.durationMs != null && isDone(test) && !isSkip && (
        <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">{test.durationMs}ms</span>
      )}
      {isRunning && (
        <span className="text-[9px] text-primary bg-primary/10 border border-primary/25 rounded px-1.5 py-0.5 shrink-0">rodando</span>
      )}
    </div>
  );
}

function RepoStatusIcon({ failCount, runCount, finished }: { failCount: number; runCount: number; finished: boolean }) {
  if (runCount > 0) return <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />;
  if (finished)     return failCount > 0
    ? <XCircle      className="w-3 h-3 text-red-500 shrink-0" />
    : <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />;
  return null;
}

function RepoGroup({ repo, tests }: { repo: string; tests: TestResult[] }) {
  const [open, setOpen] = useState(true);

  const doneCount = tests.filter(isDone).length;
  const failCount = tests.filter(t => t.status === 'fail').length;
  const skipCount = tests.filter(t => t.status === 'skipped').length;
  const runCount  = tests.filter(t => t.status === 'running').length;
  const pct = tests.length > 0 ? (doneCount / tests.length) * 100 : 0;
  const repoFinished = runCount === 0 && doneCount === tests.length;

  return (
    <div className="border-t border-border/20 first:border-0">
      {/* Repo header — clickable to collapse */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 pt-2 pb-1.5 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {open
            ? <ChevronDown  className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
          <GitBranch className="w-3 h-3 text-primary shrink-0" />
          <span className="text-[11px] font-mono font-bold">{repo}</span>
          <RepoStatusIcon failCount={failCount} runCount={runCount} finished={repoFinished} />
          {failCount > 0 && (
            <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
              {failCount} falhou
            </span>
          )}
          {skipCount > 0 && (
            <span className="text-[9px] text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded border border-border/30">
              {skipCount} pulado
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">{doneCount}/{tests.length}</span>
        </div>
        {!repoFinished && open && <Progress value={pct} className="h-0.5 mt-1" />}
      </button>
      {open && (
        <div className="divide-y divide-border/10">
          {tests.map((t, i) => <TestRow key={i} test={t} />)}
        </div>
      )}
    </div>
  );
}

function TestTypeSection({ title, icon, tests }: {
  title: string; icon: React.ReactNode; tests: TestResult[];
}) {
  const [open, setOpen] = useState(true);

  if (tests.length === 0) return null;

  const byRepo = useMemo(() => {
    const map: Record<string, TestResult[]> = {};
    for (const t of tests) {
      const key = t.repo ?? 'geral';
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return Object.entries(map);
  }, [tests]);

  const doneCount = tests.filter(isDone).length;
  const passCount = tests.filter(t => t.status === 'success').length;
  const failCount = tests.filter(t => t.status === 'fail').length;
  const skipCount = tests.filter(t => t.status === 'skipped').length;
  const runCount  = tests.filter(t => t.status === 'running').length;
  const pct = tests.length > 0 ? (doneCount / tests.length) * 100 : 0;
  const sectionFinished = runCount === 0 && doneCount === tests.length;

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      {/* Section header — clickable to collapse */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2.5 bg-muted/25 hover:bg-muted/35 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {open
            ? <ChevronDown  className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />}
          {icon}
          <span className="text-xs font-bold">Testes {title}</span>
          {sectionFinished && (failCount > 0
            ? <XCircle      className="w-3.5 h-3.5 text-red-500 shrink-0" />
            : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />)}
          <span className="text-[10px] text-muted-foreground font-mono">{passCount}/{tests.length}</span>
          {failCount > 0 && <span className="text-[10px] text-red-400 font-semibold ml-1">{failCount} falhou</span>}
          {runCount  > 0 && <span className="text-[10px] text-primary ml-1">{runCount} rodando</span>}
          {skipCount > 0 && <span className="text-[10px] text-muted-foreground/60 ml-1">{skipCount} pulado</span>}
        </div>
      </button>

      {open && (
        <>
          {/* Section progress bar — only while running */}
          {!sectionFinished && (
            <div className="px-3 pt-2 pb-1.5 bg-muted/10 border-t border-border/30">
              <Progress value={pct} className="h-1.5" />
              <div className="flex items-center gap-3 text-[10px] mt-1.5">
                <span className="text-emerald-400">✓ {passCount} passou</span>
                <span className="text-red-400">✗ {failCount} falhou</span>
                <span className="text-muted-foreground/60">⊘ {skipCount} pulado</span>
              </div>
            </div>
          )}
          {/* Repo groups */}
          <div className="divide-y divide-border/20 border-t border-border/30">
            {byRepo.map(([repo, repoTests]) => (
              <RepoGroup key={repo} repo={repo} tests={repoTests} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const LOG_SOURCES: { key: LogSource; label: string }[] = [
  { key: 'test',  label: 'Testes' },
  { key: 'app',   label: 'App'    },
  { key: 'infra', label: 'Infra'  },
];

export function TestStageView({ tests, demandId }: Props) {
  const [tab,       setTab]       = useState<PanelTab>('results');
  const [logSource, setLogSource] = useState<LogSource>('test');
  const [stageLogs, setStageLogs] = useState<LogLine[]>([]);
  const logsEndRef                = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStageLogs([]);
    let active = true;
    const consume = async () => {
      for await (const line of api.streamLogs(demandId, logSource)) {
        if (!active) break;
        setStageLogs(prev => [...prev, line]);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    consume();
    return () => { active = false; };
  }, [demandId, logSource]);

  const unitTests = tests.filter(t => t.type === 'unit');
  const e2eTests  = tests.filter(t => t.type === 'e2e');

  const totalDone    = tests.filter(isDone).length;
  const totalPass    = tests.filter(t => t.status === 'success').length;
  const totalFail    = tests.filter(t => t.status === 'fail').length;
  const totalSkip    = tests.filter(t => t.status === 'skipped').length;
  const totalRunning = tests.filter(t => t.status === 'running').length;
  const overallPct   = tests.length > 0 ? (totalDone / tests.length) * 100 : 0;

  return (
    <div className="space-y-4">

      {/* ── Overall progress ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">Progresso geral</span>
          <span className="text-muted-foreground font-mono">{totalDone} / {tests.length} testes</span>
        </div>
        <Progress value={overallPct} className="h-2.5" />
        <div className="flex items-center gap-3 text-[10px] flex-wrap">
          <span className="text-emerald-400">✓ {totalPass} passou</span>
          <span className="text-red-400">✗ {totalFail} falhou</span>
          <span className="text-muted-foreground/60">⊘ {totalSkip} pulado</span>
          {totalRunning > 0 && (
            <span className="flex items-center gap-1 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" /> {totalRunning} rodando
            </span>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-border/40">
        {([
          { key: 'results' as PanelTab, Icon: FlaskConical, label: 'Resultados' },
          { key: 'logs'    as PanelTab, Icon: Terminal,     label: 'Logs'        },
        ]).map(({ key, Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── Resultados ── */}
      {tab === 'results' && (
        <div className="space-y-3">
          <TestTypeSection
            title="Unitários"
            icon={<FlaskConical className="w-3.5 h-3.5 text-purple-400" />}
            tests={unitTests}
          />
          <TestTypeSection
            title="E2E"
            icon={<span className="text-sm leading-none">🌐</span>}
            tests={e2eTests}
          />
          {tests.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-4">Nenhum resultado de teste ainda.</p>
          )}
        </div>
      )}

      {/* ── Logs ── */}
      {tab === 'logs' && (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/40">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">Logs</span>
            <div className="flex gap-1">
              {LOG_SOURCES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setLogSource(key)}
                  data-testid={`log-source-${key}`}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    logSource === key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-[#0d0d0f] h-72 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
            {stageLogs.length === 0 && (
              <span className="text-[#555] italic">Aguardando logs...</span>
            )}
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
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

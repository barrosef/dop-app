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

function RepoGroup({ repo, tests }: { repo: string; tests: TestResult[] }) {
  const [open, setOpen] = useState(true);

  const doneCount = tests.filter(isDone).length;
  const passCount = tests.filter(t => t.status === 'success').length;
  const failCount = tests.filter(t => t.status === 'fail').length;
  const skipCount = tests.filter(t => t.status === 'skipped').length;
  const runCount  = tests.filter(t => t.status === 'running').length;
  const pct = tests.length > 0 ? (doneCount / tests.length) * 100 : 0;
  const repoFinished = runCount === 0 && doneCount === tests.length;

  return (
    <div className="border-t border-border/20 first:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 pt-2 pb-1.5 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {open
            ? <ChevronDown  className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />}
          <GitBranch className="w-3 h-3 text-primary shrink-0" />
          <span className="text-[11px] font-mono font-bold">{repo}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{doneCount}/{tests.length}</span>

          {/* Status badges */}
          {failCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
              <XCircle className="w-2.5 h-2.5" /> {failCount} falhou
            </span>
          )}
          {passCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              <CheckCircle2 className="w-2.5 h-2.5" /> {passCount} passou
            </span>
          )}
          {skipCount > 0 && (
            <span className="text-[9px] text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded border border-border/30">
              {skipCount} pulado
            </span>
          )}

          {/* Right-aligned status */}
          {repoFinished && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> concluído
            </span>
          )}
          {!repoFinished && runCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-primary">
              <Loader2 className="w-3 h-3 animate-spin" /> rodando
            </span>
          )}
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
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2.5 bg-muted/25 hover:bg-muted/35 transition-colors text-left"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {open
            ? <ChevronDown  className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />}
          {icon}
          <span className="text-xs font-bold">Testes {title}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{doneCount}/{tests.length}</span>

          {/* Status badges */}
          {failCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 font-semibold">
              <XCircle className="w-3 h-3" /> {failCount} falhou
            </span>
          )}
          {passCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-semibold">
              <CheckCircle2 className="w-3 h-3" /> {passCount} passou
            </span>
          )}
          {skipCount > 0 && (
            <span className="text-[10px] text-muted-foreground/60 ml-0.5">{skipCount} pulado</span>
          )}
          {runCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-primary ml-0.5">
              <Loader2 className="w-3 h-3 animate-spin" /> {runCount} rodando
            </span>
          )}

          {/* Right-aligned concluído */}
          {sectionFinished && (
            <span className={`ml-auto flex items-center gap-1 text-[10px] font-semibold ${failCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {failCount > 0
                ? <XCircle className="w-3 h-3" />
                : <CheckCircle2 className="w-3 h-3" />}
              {failCount > 0 ? 'com falhas' : 'concluído'}
            </span>
          )}
        </div>
      </button>

      {open && (
        <>
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
  const [logType,   setLogType]   = useState<'unit' | 'e2e' | null>(null);
  const [logRepo,   setLogRepo]   = useState<string | null>(null);
  const [stageLogs, setStageLogs] = useState<LogLine[]>([]);
  const logsEndRef                = useRef<HTMLDivElement>(null);

  // Unique repos from test results for filter pills
  const allRepos = useMemo(() => {
    const repos = new Set<string>();
    for (const t of tests) { if (t.repo) repos.add(t.repo); }
    return [...repos];
  }, [tests]);

  // Repos that have a specific test type (for disabling irrelevant combos)
  const reposForType = useMemo(() => {
    if (!logType) return new Set(allRepos);
    const s = new Set<string>();
    for (const t of tests) { if (t.type === logType && t.repo) s.add(t.repo); }
    return s;
  }, [tests, logType, allRepos]);

  // Only stream when source is chosen + (for test source: type+repo also chosen)
  const logsReady = logSource !== 'test' || (logType !== null && logRepo !== null);

  useEffect(() => {
    if (!logsReady) { setStageLogs([]); return; }
    setStageLogs([]);
    let active = true;
    const filter = logSource === 'test'
      ? { testType: logType ?? undefined, testRepo: logRepo ?? undefined }
      : undefined;
    const consume = async () => {
      for await (const line of api.streamLogs(demandId, logSource, filter)) {
        if (!active) break;
        setStageLogs(prev => [...prev, line]);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    consume();
    return () => { active = false; };
  }, [demandId, logSource, logType, logRepo, logsReady]);

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

          {/* Source row */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/40">
            <Terminal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fonte</span>
            <div className="flex gap-1 ml-1">
              {LOG_SOURCES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setLogSource(key); setLogType(null); setLogRepo(null); }}
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

          {/* Test sub-filters (type + repo) — only for test source */}
          {logSource === 'test' && (
            <div className="px-3 py-2 bg-muted/15 border-b border-border/30 space-y-2">

              {/* Type filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground w-10 shrink-0">Tipo</span>
                {(['unit', 'e2e'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setLogType(prev => prev === type ? null : type)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      logType === type
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-semibold'
                        : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    {type === 'unit' ? '⚗ Unitários' : '🌐 E2E'}
                  </button>
                ))}
              </div>

              {/* Repo filter */}
              {allRepos.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground w-10 shrink-0">Repo</span>
                  {allRepos.map(repo => {
                    const available = reposForType.has(repo);
                    const selected  = logRepo === repo;
                    return (
                      <button
                        key={repo}
                        disabled={!available}
                        onClick={() => setLogRepo(prev => prev === repo ? null : repo)}
                        className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-colors ${
                          !available
                            ? 'border-border/20 text-muted-foreground/30 cursor-not-allowed'
                            : selected
                              ? 'bg-primary/20 border-primary/50 text-primary font-semibold'
                              : 'border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        }`}
                      >
                        {repo}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Log panel */}
          <div className="bg-[#0d0d0f] h-72 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
            {!logsReady ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                <Terminal className="w-5 h-5 text-muted-foreground/30" />
                <p className="text-[#555] italic text-xs">
                  Selecione o tipo de teste e o repositório<br/>para visualizar os logs
                </p>
              </div>
            ) : stageLogs.length === 0 ? (
              <span className="text-[#555] italic">Aguardando logs...</span>
            ) : (
              stageLogs.map((log, i) => (
                <div key={i} className="flex gap-2 mb-0.5 hover:bg-white/5 px-1 rounded">
                  <span className="text-[#555] shrink-0 select-none">{log.at.substring(11, 19)}</span>
                  <span className={`shrink-0 font-semibold ${
                    log.source === 'test'  ? 'text-purple-400' :
                    log.source === 'infra' ? 'text-amber-400'  : 'text-blue-400'
                  }`}>[{log.service}]</span>
                  {log.testType && (
                    <span className="shrink-0 text-[10px] text-muted-foreground/50">
                      {log.testType === 'unit' ? '⚗' : '🌐'}
                    </span>
                  )}
                  <span className="text-[#c8d3f5] break-all">{log.line}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

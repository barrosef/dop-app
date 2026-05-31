import { useState, useEffect, useRef, useMemo } from 'react';
import { Progress } from './ui/progress';
import { ExecData, ExecFile, StageStatus } from '../lib/api/types';
import {
  CheckCircle2, Clock, Loader2, GitBranch, AlertCircle,
  ChevronDown, ChevronRight, Zap, FileCode
} from 'lucide-react';

interface Props { execData: ExecData; stageStatus: StageStatus; }

type FileStatus = 'pending' | 'active' | 'done' | 'fail';

function fk(f: ExecFile) { return `${f.repo}::${f.path}`; }

function DiffLine({ line }: { line: string }) {
  const isAdd = line.startsWith('+') && !line.startsWith('+++');
  const isDel = line.startsWith('-') && !line.startsWith('---');
  const isHunk = line.startsWith('@@');
  const cls = isAdd  ? 'bg-emerald-500/10 text-emerald-300'
             : isDel  ? 'bg-red-500/10 text-red-300'
             : isHunk ? 'text-purple-400/80'
             : 'text-[#c8d3f5]/60';
  return (
    <div className={`${cls} px-2 min-h-[1.3rem] font-mono text-[11px] leading-snug select-text whitespace-pre`}>
      {line || '\u00A0'}
    </div>
  );
}

function DiffViewer({ diff, path, repo, linesAdded, linesRemoved }: {
  diff: string; path: string; repo: string; linesAdded: number; linesRemoved: number;
}) {
  return (
    <div className="mx-3 mb-2 rounded-md border border-border/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b border-border/30 text-[10px] text-muted-foreground">
        <span className="font-mono truncate flex-1">{repo} / {path}</span>
        <span className="font-mono shrink-0">
          <span className="text-emerald-400">+{linesAdded}</span>{' '}
          <span className="text-red-400">-{linesRemoved}</span>
        </span>
      </div>
      <div className="bg-[#080b10] overflow-x-auto max-h-72 overflow-y-auto p-1">
        {diff.split('\n').map((line, i) => <DiffLine key={i} line={line} />)}
      </div>
    </div>
  );
}

export function ExecStageView({ execData, stageStatus }: Props) {
  const isDone = stageStatus === 'done';

  const filesByRepo = useMemo(() => {
    const map: Record<string, ExecFile[]> = {};
    for (const f of execData.files) {
      if (!map[f.repo]) map[f.repo] = [];
      map[f.repo].push(f);
    }
    return map;
  }, [execData]);

  const [statuses, setStatuses] = useState<Record<string, FileStatus>>(() => {
    if (isDone) return Object.fromEntries(execData.files.map(f => [fk(f), (f.error ? 'fail' : 'done') as FileStatus]));
    const s: Record<string, FileStatus> = {};
    for (const files of Object.values(filesByRepo))
      files.forEach((f, i) => { s[fk(f)] = i === 0 ? 'active' : 'pending'; });
    return s;
  });

  // Streaming simulation — one file per repo advances simultaneously (parallel)
  const repoIdxRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (isDone) return;
    for (const repo of Object.keys(filesByRepo)) repoIdxRef.current[repo] = 0;
    const tick = setInterval(() => {
      setStatuses(prev => {
        const next = { ...prev };
        let anyRunning = false;
        for (const [repo, files] of Object.entries(filesByRepo)) {
          const idx = repoIdxRef.current[repo] ?? 0;
          if (idx >= files.length) continue;
          anyRunning = true;
          const k = fk(files[idx]);
          if (prev[k] === 'active') {
            if (files[idx].error) {
              next[k] = 'fail';
              repoIdxRef.current[repo] = files.length; // a failure halts this repo
            } else {
              next[k] = 'done';
              repoIdxRef.current[repo] = idx + 1;
              if (idx + 1 < files.length) next[fk(files[idx + 1])] = 'active';
            }
          }
        }
        if (!anyRunning) clearInterval(tick);
        return next;
      });
    }, 1100);
    return () => clearInterval(tick);
  }, [isDone, filesByRepo]);

  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());
  const toggleDiff = (k: string) =>
    setExpandedDiffs(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // Collapsible repos — default all open (missing key = open)
  const [closedRepos, setClosedRepos] = useState<Set<string>>(new Set());
  const isRepoOpen   = (repo: string) => !closedRepos.has(repo);
  const toggleRepo   = (repo: string) =>
    setClosedRepos(prev => { const n = new Set(prev); n.has(repo) ? n.delete(repo) : n.add(repo); return n; });

  const totalFiles  = execData.files.length;
  const doneCount   = Object.values(statuses).filter(s => s === 'done').length;
  const activeFiles = execData.files.filter(f => statuses[fk(f)] === 'active');
  const numRepos    = Object.keys(filesByRepo).length;
  const isParallel  = execData.tasks.some((t, _, arr) =>
    arr.some(t2 => t2.id !== t.id && t2.parallelGroup === t.parallelGroup));

  return (
    <div className="space-y-4">

      {/* ── Overall progress ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">Progresso geral</span>
          <span className="text-muted-foreground font-mono">{doneCount} / {totalFiles} arquivos</span>
        </div>
        <Progress value={totalFiles > 0 ? (doneCount / totalFiles) * 100 : 0} className="h-2.5" />
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          <span>{execData.tasks.length} tarefas</span>
          <span>·</span>
          <span>{numRepos} repositório{numRepos !== 1 ? 's' : ''}</span>
          {isParallel && (
            <span className="flex items-center gap-1 text-primary font-semibold ml-1">
              <Zap className="w-3 h-3" /> repos em paralelo
            </span>
          )}
        </div>
      </div>

      {/* ── Active file indicator ── */}
      {activeFiles.length > 0 && (
        <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-primary/10 border border-primary/20 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Modificando:</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {activeFiles.map(f => (
              <span key={fk(f)} className="text-xs font-mono text-primary font-semibold">
                {f.repo}<span className="text-primary/50">/</span>{f.path.split('/').pop()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Repo sections ── */}
      {Object.entries(filesByRepo).map(([repo, files]) => {
        const repoDone     = files.filter(f => statuses[fk(f)] === 'done').length;
        const repoActive   = files.some(f => statuses[fk(f)] === 'active');
        const repoFailed   = files.some(f => statuses[fk(f)] === 'fail');
        const branch       = files[0]?.branch ?? '';
        const repoPct      = files.length > 0 ? (repoDone / files.length) * 100 : 0;
        const repoFinished = repoFailed || repoDone === files.length;

        return (
          <div key={repo} className="rounded-lg border border-border/40 overflow-hidden">

            {/* Repo header — clickable to collapse/expand */}
            <button
              onClick={() => toggleRepo(repo)}
              className="w-full px-3 py-2.5 bg-muted/25 border-b border-border/30 flex items-center gap-2 flex-wrap hover:bg-muted/35 transition-colors text-left"
            >
              {isRepoOpen(repo)
                ? <ChevronDown  className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-bold font-mono">{repo}</span>
              <span className="text-[10px] text-muted-foreground font-mono">⎇ {branch}</span>
              <div className="flex-1" />
              {repoActive && (
                <span className="flex items-center gap-1 text-[10px] text-primary">
                  <Loader2 className="w-3 h-3 animate-spin" /> em andamento
                </span>
              )}
              {!repoActive && repoFailed && (
                <span className="flex items-center gap-1 text-[10px] text-red-400">
                  <AlertCircle className="w-3 h-3" /> falhou
                </span>
              )}
              {!repoActive && !repoFailed && repoDone === files.length && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> concluído
                </span>
              )}
              <span className="text-[10px] text-muted-foreground font-mono">{repoDone}/{files.length}</span>
            </button>

            {isRepoOpen(repo) && (
              <>
            {/* Per-repo progress bar — visible only during runtime */}
            {!repoFinished && (
              <div className="px-3 pt-2 pb-1.5 bg-muted/10">
                <Progress value={repoPct} className="h-1" />
              </div>
            )}

            {/* File list */}
            <div className="divide-y divide-border/20">
              {files.map(file => {
                const k        = fk(file);
                const st       = statuses[k] ?? 'pending';
                const expanded = expandedDiffs.has(k);
                const parts    = file.path.split('/');
                const filename = parts.pop() ?? file.path;
                const dirPath  = parts.join('/');

                return (
                  <div key={k}>
                    {/* File row */}
                    <div className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/10 transition-colors group">
                      {st === 'done'    && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      {st === 'active'  && <Loader2      className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
                      {st === 'pending' && <Clock        className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                      {st === 'fail'    && <AlertCircle  className="w-3.5 h-3.5 text-red-500 shrink-0" />}

                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <FileCode className={`w-3 h-3 shrink-0 ${
                          st === 'pending' ? 'text-muted-foreground/25' :
                          st === 'fail'    ? 'text-red-400/70' :
                          'text-muted-foreground/70'
                        }`} />
                        {dirPath && (
                          <span className="text-[10px] text-muted-foreground/40 font-mono truncate max-w-[140px]">{dirPath}/</span>
                        )}
                        <span className={`text-xs font-mono font-semibold truncate ${
                          st === 'pending' ? 'text-muted-foreground/35' :
                          st === 'fail'    ? 'text-red-300' :
                          'text-foreground'
                        }`}>
                          {filename}
                        </span>
                        {st === 'active' && (
                          <span className="text-[9px] text-primary bg-primary/10 border border-primary/25 rounded px-1 ml-1">
                            escrevendo...
                          </span>
                        )}
                        {st === 'pending' && (
                          <span className="text-[9px] text-muted-foreground/50 bg-muted/40 border border-border/40 rounded px-1 ml-1">
                            na fila
                          </span>
                        )}
                        {st === 'fail' && (
                          <span className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/25 rounded px-1 ml-1">
                            falhou
                          </span>
                        )}
                      </div>

                      {/* Lines +/- */}
                      {st === 'done' && (
                        <span className="text-[10px] font-mono shrink-0 tabular-nums">
                          {file.linesAdded   > 0 && <span className="text-emerald-400">+{file.linesAdded}</span>}
                          {file.linesRemoved > 0 && <span className="text-red-400 ml-1">-{file.linesRemoved}</span>}
                          {file.linesAdded === 0 && file.linesRemoved === 0 && <span className="text-muted-foreground/40">~</span>}
                        </span>
                      )}

                      {/* Diff toggle */}
                      {st === 'done' && file.diff && (
                        <button
                          onClick={() => toggleDiff(k)}
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        >
                          {expanded
                            ? <><ChevronDown  className="w-3 h-3" /> Fechar</>
                            : <><ChevronRight className="w-3 h-3" /> Ver diff</>}
                        </button>
                      )}
                    </div>

                    {/* Failure detail */}
                    {st === 'fail' && file.error && (
                      <div className="px-9 pb-2">
                        <p className="text-[11px] text-red-300 font-mono bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5 break-words">
                          {file.error}
                        </p>
                      </div>
                    )}

                    {/* Diff panel */}
                    {expanded && (
                      <DiffViewer
                        diff={file.diff}
                        path={file.path}
                        repo={repo}
                        linesAdded={file.linesAdded}
                        linesRemoved={file.linesRemoved}
                      />
                    )}
                  </div>
                );
              })}
            </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

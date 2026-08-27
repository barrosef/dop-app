import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCard, useCards, useSendChatMessage, useWorkspace } from '../hooks/use-api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { InfraTerminal } from '../components/infra-terminal';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CircleDot,
  ExternalLink,
  FileCode2,
  FileText,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Layers3,
  Loader2,
  MessageSquare,
  Send,
  Server,
  Settings,
  TestTube2,
  Terminal,
  X,
} from 'lucide-react';
import { dictionaries, useI18n } from '../lib/i18n';
import { api } from '../lib/api/mockClient';
import { Card, FileTouched, LogLine, PullRequest, RepoConfig, TestResult, Workspace } from '../lib/api/types';
import { ContextualOverview, OverviewPanelKey } from '../components/contextual-overview';

type NodeKind = 'overview' | 'branches' | 'branch' | 'prs' | 'pr';
type SelectedNode = { repo: string; kind: NodeKind; id?: string };
type BranchItem = { name: string; category: 'new' | 'modified'; files: FileTouched[] };
type Translator = (key: keyof typeof dictionaries['pt-BR'], params?: Record<string, string | number>) => string;

type RepoAggregate = {
  name: string;
  config?: RepoConfig;
  relatedCards: Card[];
  branches: BranchItem[];
  prs: PullRequest[];
  files: FileTouched[];
  tests: TestResult[];
  commits: number;
};

function parseBranch(raw: string) {
  const separator = raw.indexOf('|');
  return separator === -1
    ? { repo: '', branch: raw }
    : { repo: raw.slice(0, separator), branch: raw.slice(separator + 1) };
}

function branchCategory(name: string): BranchItem['category'] {
  return /(^|[/_-])(feature|bug|fix)([/_-]|$)/i.test(name) ? 'new' : 'modified';
}

function fileKey(file: FileTouched) {
  return `${file.repo ?? ''}|${file.branch ?? ''}|${file.path}`;
}

function fileIcon(kind: FileTouched['kind']) {
  if (kind === 'source') return <FileCode2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (kind === 'test') return <TestTube2 className="h-3.5 w-3.5 text-purple-400" />;
  if (kind === 'adr') return <Layers3 className="h-3.5 w-3.5 text-amber-400" />;
  return <FileText className="h-3.5 w-3.5 text-blue-400" />;
}

function changeBadge(change: FileTouched['change'], t: Translator) {
  return change === 'created'
    ? { label: t('cockpit.file.created'), className: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10' }
    : { label: t('cockpit.file.modified'), className: 'text-amber-400 border-amber-500/25 bg-amber-500/10' };
}

function cardStatusIcon(status: Card['dopStatus']) {
  if (status === 'new') return <CircleDot className="h-3 w-3" />;
  if (status === 'doing') return <Activity className="h-3 w-3" />;
  return <CheckCircle2 className="h-3 w-3" />;
}

function DiffViewer({ file, onBack }: { file: FileTouched; onBack: () => void }) {
  const { t } = useI18n();
  const lines = file.diff?.split('\n') ?? [];
  const badge = changeBadge(file.change, t);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="panel-file-diff">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          data-testid="button-back-from-diff"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('cockpit.file.back')}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs font-semibold" data-testid="text-diff-file">{file.path}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {file.repo} {file.branch ? `· ${file.branch}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1 bg-[#0d1117]">
        {lines.length > 0 ? (
          <div className="py-3" data-testid="diff-content">
            {lines.map((line, index) => {
              const added = line.startsWith('+') && !line.startsWith('+++');
              const removed = line.startsWith('-') && !line.startsWith('---');
              const hunk = line.startsWith('@@');
              return (
                <div
                  key={`${index}-${line}`}
                  className={`min-h-[1.45rem] whitespace-pre px-4 font-mono text-[11px] leading-snug ${
                    added ? 'bg-emerald-500/10 text-emerald-300' :
                    removed ? 'bg-red-500/10 text-red-300' :
                    hunk ? 'bg-purple-500/10 text-purple-300' :
                    'text-slate-300/75'
                  }`}
                >
                  {line || '\u00a0'}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center px-6 text-center text-xs italic text-muted-foreground" data-testid="text-no-diff">
            {t('cockpit.file.noDiff')}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function FileList({
  files,
  onFileClick,
}: {
  files: FileTouched[];
  onFileClick: (file: FileTouched) => void;
}) {
  const { t } = useI18n();

  if (files.length === 0) {
    return <p className="rounded-md border border-dashed border-border/50 px-3 py-5 text-center text-xs italic text-muted-foreground">{t('cockpit.file.none')}</p>;
  }

  return (
    <div className="divide-y divide-border/30 overflow-hidden rounded-md border border-border/50" data-testid="list-repository-files">
      {files.map(file => {
        const badge = changeBadge(file.change, t);
        return (
          <button
            type="button"
            key={fileKey(file)}
            onClick={() => onFileClick(file)}
            className="group flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-primary/5"
            data-testid={`button-file-${file.repo}-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
          >
            {fileIcon(file.kind)}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[11px] font-medium">{file.path}</span>
              {file.branch && <span className="block truncate font-mono text-[9px] text-muted-foreground">{file.branch}</span>}
            </span>
            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badge.className}`}>{badge.label}</span>
            <span className="text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">{t('cockpit.file.openDiff')}</span>
          </button>
        );
      })}
    </div>
  );
}

function statusLabel(pr: PullRequest, t: Translator) {
  if (pr.merged) return { label: t('cockpit.pr.merged'), className: 'text-purple-400 border-purple-500/30 bg-purple-500/10' };
  if (pr.hasConflict) return { label: t('cockpit.pr.conflict'), className: 'text-red-400 border-red-500/30 bg-red-500/10' };
  return { label: t('cockpit.pr.open'), className: 'text-primary border-primary/30 bg-primary/10' };
}

function PullRequestList({
  prs,
  onPrClick,
}: {
  prs: PullRequest[];
  onPrClick: (pr: PullRequest) => void;
}) {
  const { t } = useI18n();

  if (prs.length === 0) {
    return <p className="rounded-md border border-dashed border-border/50 px-3 py-5 text-center text-xs italic text-muted-foreground">{t('cockpit.repo.noPrs')}</p>;
  }

  return (
    <div className="space-y-2" data-testid="list-repository-prs">
      {prs.map(pr => {
        const status = statusLabel(pr, t);
        return (
          <button
            type="button"
            key={pr.id}
            onClick={() => onPrClick(pr)}
            className="w-full rounded-md border border-border/50 bg-muted/15 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            data-testid={`button-pr-${pr.id}`}
          >
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">{pr.sourceBranch}</span>
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${status.className}`}>{status.label}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
              <ChevronRight className="h-3 w-3" />
              <span className="font-mono">{pr.targetBranch}</span>
              {pr.reviewers && <span className="ml-auto">{pr.reviewers.filter(r => r.status === 'approved').length}/{pr.reviewers.length} {t('exec.review.approved')}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function OverviewPanel({
  repo,
  onFileClick,
}: {
  repo: RepoAggregate;
  onFileClick: (file: FileTouched) => void;
}) {
  const { t } = useI18n();
  const openPrs = repo.prs.filter(pr => !pr.merged).length;
  const failedTests = repo.tests.filter(test => test.status === 'fail').length;

  return (
    <div className="space-y-5 p-5" data-testid={`panel-repository-overview-${repo.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md border border-primary/25 bg-primary/10 p-1.5"><GitBranch className="h-4 w-4 text-primary" /></span>
            <h2 className="font-mono text-lg font-bold">{repo.name}</h2>
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {repo.config?.description || t('cockpit.repo.summary')}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">{t('cockpit.repository.context')}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: t('cockpit.repo.commits'), value: repo.commits, icon: GitCommitHorizontal, className: 'text-foreground' },
          { label: t('cockpit.repository.branches'), value: repo.branches.length, icon: GitBranch, className: 'text-emerald-400' },
          { label: t('cockpit.repository.openPrs'), value: openPrs, icon: GitPullRequest, className: 'text-primary' },
          { label: t('cockpit.repository.files'), value: repo.files.length, icon: FileText, className: 'text-blue-400' },
        ].map(metric => (
          <div key={metric.label} className="rounded-md border border-border/50 bg-muted/15 p-3" data-testid={`metric-${repo.name}-${metric.label}`}>
            <metric.icon className={`mb-2 h-3.5 w-3.5 ${metric.className}`} />
            <p className="font-mono text-lg font-bold">{metric.value}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)]">
        <section className="rounded-md border border-border/50">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider">{t('cockpit.repository.files')}</h3>
            <span className="font-mono text-[10px] text-muted-foreground">{repo.files.length}</span>
          </div>
          <div className="p-2"><FileList files={repo.files} onFileClick={onFileClick} /></div>
        </section>
        <section className="space-y-3">
          <div className="rounded-md border border-border/50 bg-muted/10 p-3">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('cockpit.repository.metadata')}</h3>
            <dl className="space-y-2 text-[11px]">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('cockpit.repository.baseBranch')}</dt><dd className="font-mono font-semibold">{repo.config?.baseBranch || 'main'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('cockpit.repository.provider')}</dt><dd className="font-mono font-semibold">{repo.config?.provider || 'Git'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('cockpit.repository.cards')}</dt><dd className="font-mono font-semibold">{repo.relatedCards.length}</dd></div>
            </dl>
          </div>
          <div className={`rounded-md border p-3 ${failedTests > 0 ? 'border-red-500/25 bg-red-500/5' : 'border-border/50 bg-muted/10'}`}>
            <div className="flex items-center gap-2">
              {failedTests > 0 ? <AlertCircle className="h-3.5 w-3.5 text-red-400" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              <span className="text-xs font-semibold">{t('cockpit.repository.tests')}</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {failedTests > 0 ? t('cockpit.repository.testFailures', { count: failedTests }) : t('cockpit.repository.testsHealthy')}
            </p>
          </div>
        </section>
      </div>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('cockpit.repository.cardsLinked')}</h3>
        {repo.relatedCards.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">{t('cockpit.repo.emptySelection')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {repo.relatedCards.map(card => (
              <Badge key={card.id} variant="outline" className="font-mono text-[10px]" data-testid={`badge-related-card-${card.id}`}>{card.externalKey}</Badge>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BranchPanel({
  repo,
  branch,
  onFileClick,
}: {
  repo: RepoAggregate;
  branch?: BranchItem;
  onFileClick: (file: FileTouched) => void;
}) {
  const { t } = useI18n();
  const branches = branch ? [branch] : repo.branches;

  return (
    <div className="space-y-5 p-5" data-testid={`panel-branches-${repo.name}`}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{t('cockpit.tree.branches')}</p>
        <h2 className="mt-1 text-lg font-semibold">{branch?.name || t('cockpit.repository.allBranches')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('cockpit.repository.branchHint')}</p>
      </div>
      {branches.length === 0 ? <p className="text-xs italic text-muted-foreground">{t('cockpit.repo.noBranches')}</p> : (
        branches.map(item => (
          <section key={item.name} className="rounded-md border border-border/50">
            <div className="flex items-center gap-2 border-b border-border/40 bg-muted/15 px-3 py-2.5">
              {item.category === 'new' ? <CircleDot className="h-3.5 w-3.5 text-emerald-400" /> : <GitBranch className="h-3.5 w-3.5 text-amber-400" />}
              <span className="flex-1 font-mono text-xs font-semibold">{item.name}</span>
              <Badge variant="outline" className="text-[9px]">{item.category === 'new' ? t('cockpit.branch.new') : t('cockpit.branch.modified')}</Badge>
              <span className="font-mono text-[10px] text-muted-foreground">{item.files.length} {t('cockpit.branch.files')}</span>
            </div>
            <div className="p-2"><FileList files={item.files} onFileClick={onFileClick} /></div>
          </section>
        ))
      )}
    </div>
  );
}

function PrPanel({
  repo,
  pr,
  onPrClick,
  onFileClick,
}: {
  repo: RepoAggregate;
  pr?: PullRequest;
  onPrClick: (pr: PullRequest) => void;
  onFileClick: (file: FileTouched) => void;
}) {
  const { t } = useI18n();
  const prs = pr ? [pr] : repo.prs;

  return (
    <div className="space-y-5 p-5" data-testid={`panel-prs-${repo.name}`}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{t('cockpit.tree.pullRequests')}</p>
        <h2 className="mt-1 text-lg font-semibold">{pr ? pr.sourceBranch : t('cockpit.repository.allPullRequests')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('cockpit.repository.prHint')}</p>
      </div>
      {prs.length === 0 ? <p className="text-xs italic text-muted-foreground">{t('cockpit.repo.noPrs')}</p> : (
        prs.map(item => {
          const status = statusLabel(item, t);
          const files = repo.files.filter(file => file.repo === repo.name && file.branch === item.sourceBranch);
          return (
            <section key={item.id} className="rounded-md border border-border/50">
              <button type="button" onClick={() => onPrClick(item)} className="flex w-full items-center gap-2 border-b border-border/40 bg-muted/15 px-3 py-2.5 text-left hover:bg-muted/25" data-testid={`button-pr-panel-${item.id}`}>
                <GitPullRequest className="h-3.5 w-3.5 text-primary" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">{item.sourceBranch}</span>
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${status.className}`}>{status.label}</span>
              </button>
              <div className="space-y-3 p-3">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><span>{t('cockpit.pr.target')}</span><span className="font-mono text-foreground">{item.targetBranch}</span>{item.url !== '#' && <ExternalLink className="ml-auto h-3 w-3" />}</div>
                <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('cockpit.pr.files')}</p><FileList files={files} onFileClick={onFileClick} /></div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function TaskReader({
  cards,
  isLoading,
  hasError,
  selectedCardId,
  onSelect,
  onRetry,
}: {
  cards: Card[];
  isLoading: boolean;
  hasError: boolean;
  selectedCardId: string | null;
  onSelect: (cardId: string) => void;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  if (isLoading) {
    return <div className="flex min-w-48 items-center gap-2 px-2 text-[11px] text-muted-foreground" data-testid="task-reader-loading"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />{t('cockpit.cards.loading')}</div>;
  }
  if (hasError) {
    return <div className="flex min-w-0 items-center gap-2 px-2 text-[11px] text-destructive" data-testid="task-reader-error"><AlertCircle className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{t('cockpit.cards.loadError')}</span><button type="button" onClick={onRetry} className="shrink-0 font-medium text-primary hover:underline" data-testid="button-retry-task-reader">{t('common.retry')}</button></div>;
  }
  if (cards.length === 0) {
    return <div className="min-w-0 px-2 text-[11px] text-muted-foreground" data-testid="task-reader-empty">{t('cockpit.cards.emptyWorkspace')}</div>;
  }

  return (
    <div className="min-w-0 flex-1 overflow-x-auto" data-testid="task-reader-cards">
      <div className="flex min-w-max gap-1.5">
        {cards.map(card => {
          const selected = selectedCardId === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelect(card.id)}
              aria-pressed={selected}
              className={`flex max-w-[18rem] items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${selected ? 'border-primary/60 bg-primary/15 ring-1 ring-primary/20' : 'border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/5'}`}
              data-testid={`reader-card-${card.id}`}
            >
              <span className="shrink-0 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{card.externalKey}</span>
              <span className="max-w-36 truncate text-[11px] font-medium">{card.title}</span>
              <Badge variant="outline" className={`inline-flex shrink-0 items-center gap-1 px-1.5 py-0 text-[9px] ${card.dopStatus === 'doing' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : card.dopStatus === 'done' || card.dopStatus === 'delivered' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : ''}`}>
                {cardStatusIcon(card.dopStatus)}
                <span className="hidden lg:inline">{t(`card.status.${card.dopStatus}` as 'card.status.new' | 'card.status.doing' | 'card.status.done' | 'card.status.delivered')}</span>
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type CockpitSection = 'overview' | 'chat' | 'repos' | 'infra';
const EMPTY_CARDS: Card[] = [];

function sectionFromQuery(tab: string | null): CockpitSection {
  if (tab === 'overview' || tab === 'chat' || tab === 'repos' || tab === 'infra') return tab;
  return 'overview';
}

function WorkspaceOverviewPanel({
  workspace,
  cards,
  aggregates,
  selectedCard,
}: {
  workspace: Workspace;
  cards: Card[];
  aggregates: RepoAggregate[];
  selectedCard?: Card;
}) {
  const { t } = useI18n();
  const branchCount = aggregates.reduce((total, repo) => total + repo.branches.length, 0);
  const prCount = aggregates.reduce((total, repo) => total + repo.prs.length, 0);
  const fileCount = aggregates.reduce((total, repo) => total + repo.files.length, 0);
  const testCount = aggregates.reduce((total, repo) => total + repo.tests.length, 0);

  return (
    <ScrollArea className="min-h-0 flex-1" data-testid="workspace-overview-panel">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="rounded-xl border border-border/60 bg-card/60 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{t('cockpit.nav.overview')}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">{workspace.name}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {workspace.context || t('cockpit.workspace.summary')}
              </p>
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {selectedCard ? `${t('cockpit.cards.focused')}: ${selectedCard.externalKey}` : t('cockpit.cards.allScope')}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: t('cockpit.workspace.repositories'), value: aggregates.length, icon: FolderGit2, color: 'text-primary' },
            { label: t('cockpit.workspace.branches'), value: branchCount, icon: GitBranch, color: 'text-emerald-400' },
            { label: t('cockpit.workspace.pullRequests'), value: prCount, icon: GitPullRequest, color: 'text-blue-400' },
            { label: t('cockpit.workspace.files'), value: fileCount, icon: FileText, color: 'text-amber-400' },
          ].map(metric => (
            <div key={metric.label} className="rounded-lg border border-border/50 bg-muted/15 p-4">
              <metric.icon className={`mb-3 h-4 w-4 ${metric.color}`} />
              <p className="font-mono text-2xl font-bold">{metric.value}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
          <section className="rounded-lg border border-border/50 bg-card/40">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold">{t('cockpit.workspace.cardsTitle')}</h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{t('cockpit.workspace.cardsHint')}</p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{cards.length}</span>
            </div>
            <div className="divide-y divide-border/30">
              {cards.length === 0 ? (
                <p className="p-5 text-center text-xs italic text-muted-foreground">{t('common.empty')}</p>
              ) : cards.slice(0, 6).map(card => (
                <div
                  key={card.id}
                  className={`flex items-center gap-3 px-4 py-3 ${selectedCard?.id === card.id ? 'bg-primary/10' : ''}`}
                  data-testid={`overview-card-${card.id}`}
                >
                  <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{card.externalKey}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{card.title}</span>
                  <Badge variant="outline" className="shrink-0 text-[9px]">{t(`card.status.${card.dopStatus}` as 'card.status.new' | 'card.status.doing' | 'card.status.done' | 'card.status.delivered')}</Badge>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border/50 bg-card/40 p-4">
            <h3 className="text-sm font-semibold">{t('cockpit.workspace.health')}</h3>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('cockpit.workspace.tests')}</span>
                <span className="font-mono font-semibold">{testCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('cockpit.workspace.runtime')}</span>
                <span className="font-mono font-semibold">{workspace.runtime.apps.length + workspace.runtime.infra.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t('cockpit.workspace.cardTypes')}</span>
                <span className="font-mono font-semibold">{workspace.cardTypes.length}</span>
              </div>
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>{t('cockpit.workspace.generalContext')}</span>
            </div>
          </section>
        </div>
      </div>
    </ScrollArea>
  );
}

function CockpitChat({
  workspaceId,
  selectedCard,
  onOpenReader,
  mobileOpen,
  onClose,
}: {
  workspaceId?: string;
  selectedCard?: Card;
  onOpenReader: () => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { data: focusedCard, isLoading } = useCard(workspaceId, selectedCard?.id);
  const sendChat = useSendChatMessage();
  const [message, setMessage] = useState('');
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const card = focusedCard ?? selectedCard;
  const messages = card?.chat ?? [];

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, sendChat.isPending]);

  const handleSend = (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || !card) return;
    sendChat.mutate({ cardId: card.id, text: message.trim() });
    setMessage('');
  };

  if (!selectedCard) {
    return (
      <aside className={`${mobileOpen ? 'absolute inset-y-0 left-12 z-30 flex w-[min(22rem,calc(100vw-6.5rem))] shadow-2xl' : 'hidden'} min-h-0 shrink-0 flex-col border-r border-border bg-card sm:static sm:z-auto sm:flex sm:w-80 sm:shadow-none`} data-testid="cockpit-chat-sidebar">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('cockpit.nav.chat')}</h2>
          <button type="button" onClick={onClose} aria-label={t('cockpit.sidebar.close')} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden" data-testid="button-close-chat-sidebar"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6" data-testid="cockpit-chat-disabled">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/30"><MessageSquare className="h-5 w-5 text-muted-foreground" /></div>
            <h2 className="text-sm font-semibold">{t('cockpit.chat.noSelection')}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('cockpit.chat.selectHint')}</p>
            <Button variant="outline" size="sm" className="mt-5 h-8 text-xs" onClick={onOpenReader} data-testid="button-chat-open-reader"><ListTodoIcon /> {t('cockpit.cards.openReader')}</Button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={`${mobileOpen ? 'absolute inset-y-0 left-12 z-30 flex w-[min(22rem,calc(100vw-6.5rem))] shadow-2xl' : 'hidden'} min-h-0 shrink-0 flex-col border-r border-border bg-card sm:static sm:z-auto sm:flex sm:w-80 sm:shadow-none`} data-testid="cockpit-chat-sidebar">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/50 bg-card/30 px-3 py-3">
        <MessageSquare className="h-4 w-4 text-primary" />
        <div className="min-w-0">
          <p className="text-xs font-semibold">{t('cockpit.nav.chat')}</p>
          <p className="truncate text-[10px] text-muted-foreground">{t('cockpit.chat.cardContext')} <span className="font-mono text-foreground">{selectedCard.externalKey}</span> · {selectedCard.title}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('cockpit.sidebar.close')} className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden" data-testid="button-close-chat-sidebar"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('common.loading')}</div>
        ) : messages.length === 0 ? (
          <div className="mx-auto mt-10 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
            {t('exec.chat.empty')}<br />{t('exec.chat.start')}
          </div>
        ) : messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.author === 'dev' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.author === 'dev' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border border-border/50 bg-muted/50'}`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.actions.map(action => <span key={action} className="flex items-center gap-1.5 rounded bg-background/20 px-2 py-1 font-mono text-[10px]"><Terminal className="h-2.5 w-2.5" />{action}</span>)}
                </div>
              )}
              <p className="mt-1 text-[9px] opacity-60">{new Date(msg.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        {sendChat.isPending && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin text-primary" />{t('exec.chat.working')}</div>}
      </div>
      <form onSubmit={handleSend} className="flex shrink-0 gap-2 border-t border-border/50 bg-card/30 p-3">
        <input
          value={message}
          onChange={event => setMessage(event.target.value)}
          placeholder={t('cockpit.chat.placeholder')}
          disabled={sendChat.isPending}
          className="min-w-0 flex-1 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs outline-none transition-colors focus:border-primary/50"
          data-testid="input-cockpit-chat"
        />
        <button type="submit" disabled={sendChat.isPending || !message.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-cockpit-chat-send">
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </aside>
  );
}

function ListTodoIcon() {
  return <Activity className="mr-1.5 h-3.5 w-3.5" />;
}

type InfraResource = {
  kind: 'app' | 'service';
  id: string;
  name: string;
  port?: number;
  taskId?: string;
  status?: 'running' | 'stopped';
  dependsOn?: string[];
};

function InfraResourcePanel({
  resource,
  workspaceId,
  onBack,
}: {
  resource: InfraResource;
  workspaceId: string;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'logs' | 'terminal'>('logs');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([]);
    let active = true;
    const consumeLogs = async () => {
      for await (const line of api.streamServiceLogs(resource.name)) {
        if (!active) break;
        setLogs(previous => [...previous, line]);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    void consumeLogs();
    return () => { active = false; };
  }, [resource.id, resource.name]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="infra-resource-panel">
      <div className="border-b border-border/50 px-3 py-3">
        <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground" data-testid="button-back-infra-resource">
          <ArrowLeft className="h-3 w-3" /> {t('cockpit.infrastructure.back')}
        </button>
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${resource.status === 'stopped' ? 'bg-muted-foreground' : 'bg-emerald-400'}`} />
          <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{resource.name}</span>
          {resource.port && <span className="font-mono text-[10px] text-muted-foreground">:{resource.port}</span>}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="px-1.5 py-0 text-[9px]">{resource.kind === 'app' ? t('cockpit.infrastructure.application') : t('cockpit.infrastructure.service')}</Badge>
          <span>{resource.status === 'stopped' ? t('exec.infra.stopped') : t('exec.infra.running')}</span>
        </div>
      </div>
      <div className="flex shrink-0 border-b border-border/50 px-2 pt-2">
        {([
          { key: 'logs' as const, label: t('cockpit.infrastructure.logs'), icon: Activity },
          { key: 'terminal' as const, label: t('cockpit.infrastructure.terminal'), icon: Terminal },
        ]).map(item => (
          <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-[10px] font-medium transition-colors ${tab === item.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`} aria-selected={tab === item.key} role="tab" data-testid={`button-infra-tab-${item.key}`}>
            <item.icon className="h-3 w-3" />{item.label}
          </button>
        ))}
      </div>
      {tab === 'logs' ? (
        <div className="flex min-h-0 flex-1 flex-col" data-testid="infra-logs-panel">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2 text-[10px] text-muted-foreground"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />{t('exec.logs.live')}</div>
          <ScrollArea className="min-h-0 flex-1 bg-[#0a0d12] px-3 py-2">
            {logs.length === 0 && <p className="py-6 text-center font-mono text-[10px] italic text-muted-foreground">{t('exec.logs.connecting', { service: resource.name })}</p>}
            <div className="space-y-1 font-mono text-[10px] leading-relaxed">
              {logs.map((log, index) => <div key={`${log.at}-${index}`} className="flex gap-2"><span className="shrink-0 text-muted-foreground/50">{new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span className="break-all text-foreground/80">{log.line}</span></div>)}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>
      ) : (
        <InfraTerminal workspaceId={workspaceId} resourceId={resource.id} resourceName={resource.name} />
      )}
    </div>
  );
}

function InfrastructureSidebar({
  workspace,
  cards,
  selectedCard,
  mobileOpen,
  onClose,
  onSelectResource,
}: {
  workspace: Workspace;
  cards: Card[];
  selectedCard?: Card;
  mobileOpen: boolean;
  onClose: () => void;
  onSelectResource: (resource: InfraResource) => void;
}) {
  const { t } = useI18n();
  const cardById = new Map(cards.map(card => [card.id, card]));
  const apps = selectedCard
    ? workspace.runtime.apps.filter(app => app.taskId === selectedCard.id)
    : workspace.runtime.apps;
  const services = selectedCard
    ? workspace.runtime.infra.filter(service => !service.taskIds?.length || service.taskIds.includes(selectedCard.id))
    : workspace.runtime.infra;

  return (
    <aside className={`${mobileOpen ? 'absolute inset-y-0 left-12 z-30 flex w-[min(22rem,calc(100vw-6.5rem))] shadow-2xl' : 'hidden'} min-h-0 shrink-0 flex-col border-r border-border bg-card sm:static sm:z-auto sm:flex sm:w-80 sm:shadow-none`} data-testid="infrastructure-sidebar">
      <div className="border-b border-border/50 px-3 py-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <h2 className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('cockpit.infrastructure.title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('cockpit.sidebar.close')} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden" data-testid="button-close-infrastructure-sidebar"><X className="h-3.5 w-3.5" /></button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">{selectedCard ? `${t('cockpit.cards.focused')}: ${selectedCard.externalKey}` : t('cockpit.cards.scopeAll')}</p>
      </div>
      <ScrollArea className="min-h-0 flex-1" data-testid="cockpit-infrastructure">
        <div className="space-y-4 p-3">
          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('exec.infra.apps')}</h3><span className="font-mono text-[10px] text-muted-foreground">{apps.length}</span></div>
            {apps.length === 0 ? <p className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-xs italic text-muted-foreground">{selectedCard ? t('cockpit.infrastructure.emptyForCard') : t('exec.infra.none')}</p> : (
              <div className="space-y-2">{apps.map(app => {
                const appCard = app.taskId ? cardById.get(app.taskId) : undefined;
                return <button type="button" onClick={() => onSelectResource({ kind: 'app', id: app.id, name: app.name, port: app.port, taskId: app.taskId, status: app.status, dependsOn: app.dependsOn })} key={app.id} className="block w-full rounded-md border border-border/50 bg-muted/15 p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5" data-testid={`infra-app-${app.id}`}>
                  <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${app.status === 'stopped' ? 'bg-muted-foreground' : 'bg-emerald-400'}`} /><span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">{app.name}</span><span className="font-mono text-[10px] text-muted-foreground">:{app.port}</span></div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {appCard && <Badge variant="outline" className="border-primary/30 bg-primary/10 font-mono text-[9px] text-primary" data-testid={`badge-infra-card-${appCard.id}`}>{appCard.externalKey}</Badge>}
                    <Badge variant="outline" className="text-[9px]">{app.status === 'stopped' ? t('exec.infra.stopped') : t('exec.infra.running')}</Badge>
                    {app.dependsOn?.map(dependency => <span key={dependency} className="font-mono text-[9px] text-muted-foreground">→ {dependency}</span>)}
                  </div>
                </button>;
              })}</div>
            )}
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('exec.infra.services')}</h3><span className="font-mono text-[10px] text-muted-foreground">{services.length}</span></div>
            {services.length === 0 ? <p className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-xs italic text-muted-foreground">{selectedCard ? t('cockpit.infrastructure.emptyForCard') : t('exec.infra.none')}</p> : (
              <div className="space-y-1.5">{services.map(service => <button type="button" onClick={() => onSelectResource({ kind: 'service', id: service.id, name: service.name, status: service.status })} key={service.id} className="flex w-full items-center gap-2 rounded-md border border-border/40 bg-muted/15 px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-primary/5" data-testid={`infra-service-${service.id}`}><span className={`h-1.5 w-1.5 rounded-full ${service.status === 'stopped' ? 'bg-muted-foreground' : 'bg-emerald-400'}`} /><span className="min-w-0 flex-1 truncate">{service.name}</span><span className="text-[9px] text-muted-foreground">{service.status === 'stopped' ? t('exec.infra.stopped') : t('exec.infra.running')}</span></button>)}</div>
            )}
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}

export default function WorkspaceCockpit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace(id);
  const {
    data: cards,
    isLoading: cardsLoading,
    isError: cardsError,
    refetch: refetchCards,
  } = useCards(id);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<CockpitSection>('overview');
  const [activeOverviewPanel, setActiveOverviewPanel] = useState<OverviewPanelKey>('kpis');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [expandedRepos, setExpandedRepos] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileTouched | null>(null);
  const [selectedInfraResource, setSelectedInfraResource] = useState<InfraResource | null>(null);
  const allCards = cards ?? EMPTY_CARDS;

  useEffect(() => {
    if (!workspace) return;
    const repoNames = workspace.repos.map(repo => repo.name);
    setExpandedRepos(previous => Object.keys(previous).length > 0 ? previous : Object.fromEntries(repoNames.map(name => [name, true])));
    setSelectedNode(previous => previous ?? (repoNames[0] ? { repo: repoNames[0], kind: 'overview' } : null));
    if (searchParams.get('tab') === 'repos') {
      setExpandedRepos(Object.fromEntries(repoNames.map(name => [name, true])));
    }
  }, [workspace, searchParams]);

  useEffect(() => {
    if (!cards) return;
    const requestedCardId = searchParams.get('card');
    const validCardId = requestedCardId && allCards.some(card => card.id === requestedCardId)
      ? requestedCardId
      : null;
    setSelectedCardIds(validCardId ? new Set([validCardId]) : new Set());
    setActiveCardId(validCardId);
    setActiveSection(sectionFromQuery(searchParams.get('tab')));
  }, [allCards, cards, searchParams]);

  const cardsToAggregate = useMemo(() =>
    selectedCardIds.size > 0 ? allCards.filter(card => selectedCardIds.has(card.id)) : allCards,
  [allCards, selectedCardIds]);

  const aggregates = useMemo(() => {
    if (!workspace) return [] as RepoAggregate[];
    const byName: Record<string, RepoAggregate> = {};
    workspace.repos.forEach(config => {
      byName[config.name] = { name: config.name, config, relatedCards: [], branches: [], prs: [], files: [], tests: [], commits: 0 };
    });

    cardsToAggregate.forEach(card => {
      const overview = card.repositoryOverview;
      overview.repos.forEach(repoName => {
        if (!byName[repoName]) byName[repoName] = { name: repoName, relatedCards: [], branches: [], prs: [], files: [], tests: [], commits: 0 };
        const repo = byName[repoName];
        if (!repo.relatedCards.some(related => related.id === card.id)) repo.relatedCards.push(card);
        repo.commits += overview.commitsByRepo?.[repoName] ?? (overview.repos.length === 1 ? overview.commits : 0);
        repo.tests.push(...overview.tests.filter(test => !repo.tests.some(existing => existing.name === test.name && existing.repo === test.repo)));
      });

      overview.branches.forEach(rawBranch => {
        const parsed = parseBranch(rawBranch);
        if (!parsed.repo) return;
        if (!byName[parsed.repo]) byName[parsed.repo] = { name: parsed.repo, relatedCards: [], branches: [], prs: [], files: [], tests: [], commits: 0 };
        const repo = byName[parsed.repo];
        if (!repo.branches.some(branch => branch.name === parsed.branch)) repo.branches.push({ name: parsed.branch, category: branchCategory(parsed.branch), files: [] });
      });

      overview.prs.forEach(pr => {
        if (!byName[pr.repo]) byName[pr.repo] = { name: pr.repo, relatedCards: [], branches: [], prs: [], files: [], tests: [], commits: 0 };
        const repo = byName[pr.repo];
        if (!repo.prs.some(existing => existing.id === pr.id)) repo.prs.push(pr);
      });

      overview.files.forEach(rawFile => {
        const inferredRepo = rawFile.repo || (overview.repos.length === 1 ? overview.repos[0] : rawFile.path.split('/')[0]);
        if (!inferredRepo) return;
        if (!byName[inferredRepo]) byName[inferredRepo] = { name: inferredRepo, relatedCards: [], branches: [], prs: [], files: [], tests: [], commits: 0 };
        const repo = byName[inferredRepo];
        const inferredBranch = rawFile.branch || repo.branches.find(branch => branch.name)?.name;
        const file = { ...rawFile, repo: inferredRepo, branch: inferredBranch };
        if (!repo.files.some(existing => fileKey(existing) === fileKey(file))) repo.files.push(file);
      });
    });

    Object.values(byName).forEach(repo => {
      repo.files.forEach(file => {
        if (!file.branch) return;
        const branch = repo.branches.find(item => item.name === file.branch);
        if (branch && !branch.files.some(existing => fileKey(existing) === fileKey(file))) branch.files.push(file);
      });
    });

    return Object.values(byName)
      .filter(repo => selectedCardIds.size === 0 || repo.relatedCards.length > 0)
      .sort((a, b) => b.relatedCards.length - a.relatedCards.length || a.name.localeCompare(b.name));
  }, [workspace, cardsToAggregate, selectedCardIds]);

  const selectedRepo = aggregates.find(repo => repo.name === selectedNode?.repo) ?? aggregates[0];
  const selectedBranch = selectedRepo?.branches.find(branch => branch.name === selectedNode?.id);
  const selectedPr = selectedRepo?.prs.find(pr => pr.id === selectedNode?.id);
  const activeNode = selectedNode && selectedRepo ? selectedNode : selectedRepo ? { repo: selectedRepo.name, kind: 'overview' as const } : null;
  const selectedCard = allCards.find(card => card.id === activeCardId && selectedCardIds.has(card.id));

  useEffect(() => {
    if (aggregates.length === 0) {
      if (selectedNode) setSelectedNode(null);
      if (selectedFile) setSelectedFile(null);
      return;
    }
    if (!selectedNode || !aggregates.some(repo => repo.name === selectedNode.repo)) {
      setSelectedNode({ repo: aggregates[0].name, kind: 'overview' });
      setSelectedFile(null);
      return;
    }
    if (selectedFile && !aggregates.some(repo => repo.name === selectedFile.repo)) setSelectedFile(null);
  }, [aggregates, selectedFile, selectedNode]);

  useEffect(() => {
    setSelectedInfraResource(null);
  }, [activeCardId]);

  if (workspaceLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="mr-3 h-5 w-5 animate-spin" />{t('common.loading')}</div>;
  }
  if (!workspace) return <div className="p-8 text-center text-sm text-muted-foreground">{t('common.empty')}</div>;

  const toggleRepo = (name: string) => {
    setExpandedRepos(previous => ({ ...previous, [name]: !previous[name] }));
    setSelectedNode({ repo: name, kind: 'overview' });
    setSelectedFile(null);
    setCockpitSection('repos');
    setMobileSidebarOpen(false);
  };
  const selectNode = (node: SelectedNode) => {
    setSelectedNode(node);
    setSelectedFile(null);
    setCockpitSection('repos');
    setMobileSidebarOpen(false);
  };
  const toggleNode = (key: string) => setExpandedNodes(previous => ({ ...previous, [key]: !previous[key] }));
  const setCockpitSection = (section: CockpitSection) => {
    setActiveSection(section);
    setMobileSidebarOpen(true);
    const next = new URLSearchParams(searchParams);
    next.set('tab', section);
    if (next.toString() !== searchParams.toString()) setSearchParams(next);
  };
  const setCardScope = (cardId: string | null, section?: CockpitSection) => {
    const next = new URLSearchParams(searchParams);
    next.delete('card');
    next.delete('focus');
    if (cardId) next.set('card', cardId);
    if (section) next.set('tab', section);
    setSearchParams(next);
  };
  const toggleCard = (cardId: string) => {
    const nextCardId = activeCardId === cardId ? null : cardId;
    setCardScope(nextCardId);
    setSelectedFile(null);
    setMobileSidebarOpen(Boolean(nextCardId));
  };
  const clearCards = () => setCardScope(null);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background" data-testid="workspace-cockpit">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/40 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <button type="button" onClick={() => { setCockpitSection('repos'); setMobileSidebarOpen(true); }} aria-label={t('cockpit.repositoryTree')} className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground sm:hidden" data-testid="button-toggle-repository-tree" title={t('cockpit.repositoryTree')}>
            <GitBranch className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 shrink-0 text-primary" />
              <h1 className="truncate text-sm font-semibold sm:text-base">{t('cockpit.title')}</h1>
            </div>
            <p className="hidden truncate text-[10px] text-muted-foreground sm:block">{workspace.name} · {t('cockpit.subtitle')}</p>
          </div>
          <Badge variant="outline" className={`hidden shrink-0 text-[9px] sm:inline-flex ${selectedCardIds.size > 0 ? 'border-primary/40 bg-primary/10 text-primary' : ''}`} data-testid="status-cockpit-scope">
            {selectedCardIds.size > 0 ? t('cockpit.cards.filterActive', { count: selectedCardIds.size }) : t('cockpit.cards.allScope')}
          </Badge>
        </div>
        <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => navigate(`/workspaces/${id}/edit`)} data-testid="button-configure-workspace">
          <Settings className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">{t('cockpit.repo.configure')}</span>
        </Button>
      </header>

      <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border/50 bg-muted/10 px-3 py-2 sm:px-5" data-testid="cockpit-reader">
        <div className="flex shrink-0 items-center gap-2 px-2 py-1 text-xs font-medium" data-testid="button-open-card-reader">
          <Activity className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{t('cockpit.cards.reader')}</span>
        </div>
        <span className="h-5 shrink-0 border-l border-border/70" />
        <TaskReader cards={allCards} isLoading={cardsLoading} hasError={cardsError} selectedCardId={activeCardId} onSelect={toggleCard} onRetry={() => void refetchCards()} />
        {selectedCard && <button type="button" onClick={clearCards} className="shrink-0 text-[10px] text-muted-foreground hover:text-primary" data-testid="button-clear-card-filter">{t('cockpit.repo.clearSelection')}</button>}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {mobileSidebarOpen && <div className="absolute inset-0 z-20 bg-black/30 sm:hidden" onClick={() => setMobileSidebarOpen(false)} aria-hidden="true" />}

        <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-3">
          {[
            { key: 'overview' as const, icon: ClipboardList, label: t('cockpit.nav.overview') },
            { key: 'chat' as const, icon: MessageSquare, label: t('cockpit.nav.chat') },
            { key: 'repos' as const, icon: GitBranch, label: t('cockpit.nav.repos') },
            { key: 'infra' as const, icon: Server, label: t('cockpit.nav.infra') },
          ].map(item => (
            <button key={item.key} type="button" title={item.label} onClick={() => setCockpitSection(item.key)} className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors ${activeSection === item.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} data-testid={`button-cockpit-section-${item.key}`}>
              <item.icon className="h-4 w-4" />
              {activeSection === item.key && <span className="absolute bottom-1 left-0 top-1 w-0.5 rounded-r bg-primary" />}
            </button>
          ))}
        </aside>

        {activeSection === 'overview' && (
          <ContextualOverview
            workspace={workspace}
            cards={cardsToAggregate}
            aggregates={aggregates}
            selectedCard={selectedCard}
            activePanel={activeOverviewPanel}
            mobileOpen={mobileSidebarOpen}
            onSelectPanel={panel => {
              setActiveOverviewPanel(panel);
              setMobileSidebarOpen(false);
            }}
            onClose={() => setMobileSidebarOpen(false)}
          />
        )}

        {activeSection !== 'overview' && (
          <>
        {activeSection === 'repos' && (
          <aside className={`${mobileSidebarOpen ? 'absolute inset-y-0 left-12 z-30 flex w-[min(18rem,calc(100vw-6.5rem))] shadow-2xl' : 'hidden'} min-h-0 shrink-0 flex-col border-r border-border bg-card sm:static sm:z-auto sm:flex sm:w-60 sm:shadow-none lg:w-72`} data-testid="repository-tree">
            <div className="border-b border-border/50 px-3 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('cockpit.repositoryTree')}</h2>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{aggregates.length}</span>
                  <button type="button" onClick={() => setMobileSidebarOpen(false)} aria-label={t('cockpit.tree.close')} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden" data-testid="button-close-repository-tree"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{selectedCardIds.size > 0 ? t('cockpit.cards.scopeCards', { count: selectedCardIds.size }) : t('cockpit.cards.scopeAll')}</p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-1 p-2">
                {aggregates.map(repo => {
                  const repoOpen = !!expandedRepos[repo.name];
                  const branchesOpen = !!expandedNodes[`${repo.name}:branches`];
                  const prsOpen = !!expandedNodes[`${repo.name}:prs`];
                  const isSelectedRepo = activeNode?.repo === repo.name;
                  return (
                    <div key={repo.name} className="rounded-md border border-border/40 bg-muted/10" data-testid={`tree-repository-${repo.name}`}>
                      <button type="button" onClick={() => toggleRepo(repo.name)} aria-expanded={repoOpen} className={`flex w-full items-center gap-1.5 rounded-t-md px-2 py-2 text-left transition-colors hover:bg-muted/30 ${isSelectedRepo ? 'bg-primary/10' : ''}`} data-testid={`button-tree-repository-${repo.name}`}>
                        {repoOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        <GitBranch className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate font-mono text-[11px] font-bold">{repo.name}</span><span className="font-mono text-[9px] text-muted-foreground">{repo.files.length}</span>
                      </button>
                      {repoOpen && <div className="border-t border-border/30 p-1">
                        <button type="button" onClick={() => selectNode({ repo: repo.name, kind: 'overview' })} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] transition-colors ${activeNode?.repo === repo.name && activeNode.kind === 'overview' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/25 hover:text-foreground'}`} data-testid={`button-tree-overview-${repo.name}`}><FolderGit2 className="h-3 w-3" />{t('cockpit.tree.overview')}</button>
                        <button type="button" onClick={() => { toggleNode(`${repo.name}:branches`); selectNode({ repo: repo.name, kind: 'branches' }); }} aria-expanded={branchesOpen} className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[10px] transition-colors ${activeNode?.repo === repo.name && (activeNode.kind === 'branches' || activeNode.kind === 'branch') ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/25 hover:text-foreground'}`} data-testid={`button-tree-branches-${repo.name}`}>{branchesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}<GitBranch className="h-3 w-3" /><span className="flex-1">{t('cockpit.tree.branches')}</span><span className="font-mono text-[9px]">{repo.branches.length}</span></button>
                        {branchesOpen && repo.branches.map(branch => <button type="button" key={branch.name} onClick={() => selectNode({ repo: repo.name, kind: 'branch', id: branch.name })} className={`ml-5 flex w-[calc(100%-1.25rem)] items-center gap-1.5 rounded px-2 py-1.5 text-left text-[9px] transition-colors ${activeNode?.kind === 'branch' && activeNode.id === branch.name ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/25 hover:text-foreground'}`} data-testid={`button-tree-branch-${repo.name}-${branch.name.replace(/[^a-zA-Z0-9]/g, '-')}`}>{branch.category === 'new' ? <CircleDot className="h-3 w-3 text-emerald-400" /> : <GitBranch className="h-3 w-3 text-amber-400" />}<span className="min-w-0 flex-1 truncate font-mono">{branch.name}</span><span className="font-mono text-[8px]">{branch.files.length}</span></button>)}
                        <button type="button" onClick={() => { toggleNode(`${repo.name}:prs`); selectNode({ repo: repo.name, kind: 'prs' }); }} aria-expanded={prsOpen} className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[10px] transition-colors ${activeNode?.repo === repo.name && (activeNode.kind === 'prs' || activeNode.kind === 'pr') ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/25 hover:text-foreground'}`} data-testid={`button-tree-prs-${repo.name}`}>{prsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}<GitPullRequest className="h-3 w-3" /><span className="flex-1">{t('cockpit.tree.pullRequests')}</span><span className="font-mono text-[9px]">{repo.prs.length}</span></button>
                        {prsOpen && repo.prs.map(pr => <button type="button" key={pr.id} onClick={() => selectNode({ repo: repo.name, kind: 'pr', id: pr.id })} className={`ml-5 flex w-[calc(100%-1.25rem)] items-center gap-1.5 rounded px-2 py-1.5 text-left text-[9px] transition-colors ${activeNode?.kind === 'pr' && activeNode.id === pr.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/25 hover:text-foreground'}`} data-testid={`button-tree-pr-${pr.id}`}><GitPullRequest className="h-3 w-3 text-primary" /><span className="min-w-0 flex-1 truncate font-mono">{pr.sourceBranch}</span></button>)}
                      </div>}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>
        )}
        {activeSection === 'chat' && <CockpitChat workspaceId={id} selectedCard={selectedCard} onOpenReader={() => { setMobileSidebarOpen(false); document.querySelector<HTMLElement>('[data-testid="cockpit-reader"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }} mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />}
        {activeSection === 'infra' && <InfrastructureSidebar workspace={workspace} cards={allCards} selectedCard={selectedCard} mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} onSelectResource={resource => { setSelectedInfraResource(resource); setMobileSidebarOpen(false); }} />}

        <main className="flex min-w-0 flex-1 flex-col bg-background" data-testid="cockpit-central-panel">
          {activeSection === 'infra' && selectedInfraResource ? <InfraResourcePanel resource={selectedInfraResource} workspaceId={workspace.id} onBack={() => { setSelectedInfraResource(null); setMobileSidebarOpen(true); }} /> : (activeSection === 'chat' || activeSection === 'infra') && <WorkspaceOverviewPanel workspace={workspace} cards={cardsToAggregate} aggregates={aggregates} selectedCard={selectedCard} />}
          {activeSection === 'repos' && (selectedFile ? <DiffViewer file={selectedFile} onBack={() => setSelectedFile(null)} /> : (
            <>
              <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-border bg-card/20 px-4"><FolderGit2 className="h-4 w-4 text-primary" /><span className="font-mono text-xs font-semibold">{selectedRepo?.name || t('repo.none')}</span>{activeNode && activeNode.kind !== 'overview' && <><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">{activeNode.kind === 'branch' ? selectedBranch?.name : activeNode.kind === 'pr' ? selectedPr?.sourceBranch : activeNode.kind === 'branches' ? t('cockpit.tree.branches') : t('cockpit.tree.pullRequests')}</span></>}<span className="ml-auto text-[10px] text-muted-foreground">{selectedCardIds.size > 0 ? t('cockpit.cards.filterActive', { count: selectedCardIds.size }) : t('cockpit.cards.allScope')}</span></div>
              <ScrollArea className="min-h-0 flex-1">{!selectedRepo ? <div className="p-8 text-center text-sm text-muted-foreground">{t('repo.none')}</div> : activeNode?.kind === 'overview' ? <OverviewPanel repo={selectedRepo} onFileClick={setSelectedFile} /> : activeNode?.kind === 'branches' || activeNode?.kind === 'branch' ? <BranchPanel repo={selectedRepo} branch={selectedBranch} onFileClick={setSelectedFile} /> : <PrPanel repo={selectedRepo} pr={selectedPr} onPrClick={pr => selectNode({ repo: selectedRepo.name, kind: 'pr', id: pr.id })} onFileClick={setSelectedFile} />}</ScrollArea>
            </>
          ))}
        </main>
          </>
        )}
      </div>
    </div>
  );
}
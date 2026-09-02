import { useMemo } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  ExternalLink,
  FileBarChart2,
  FileText,
  FlaskConical,
  GitBranch,
  GitPullRequest,
  Link2,
  Server,
  ShieldCheck,
  SquareStack,
  TestTube2,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { AllureReport } from './allure-report';
import { Card, FileTouched, PullRequest, RepoConfig, RuntimeApp, RuntimeService, TestResult, Workspace } from '../lib/api/types';
import { useI18n } from '../lib/i18n';

export type OverviewPanelKey = 'status' | 'kpis' | 'qa' | 'infra' | 'allure' | 'access';

type OverviewAggregate = {
  name: string;
  config?: RepoConfig;
  branches: { name: string }[];
  prs: PullRequest[];
  files: FileTouched[];
  tests: TestResult[];
  // `null` = the count is not available (the provider did not answer), and it
  // is different from zero commits. The type of whoever assembles the aggregate
  // (`workspace-cockpit.tsx`) already said so; here it was missing agreement.
  commits: number | null;
};

type ContextualOverviewProps = {
  workspace: Workspace;
  cards: Card[];
  aggregates: OverviewAggregate[];
  selectedCard?: Card;
  onSelectPanel: (panel: OverviewPanelKey) => void;
  activePanel: OverviewPanelKey;
  mobileOpen: boolean;
  onClose: () => void;
};

function scopeText(t: (key: any, params?: Record<string, string | number>) => string, selectedCard?: Card) {
  return selectedCard
    ? `${t('cockpit.cards.focused')}: ${selectedCard.externalKey}`
    : t('cockpit.cards.scopeAll');
}

function uniqueTests(aggregates: OverviewAggregate[]) {
  const seen = new Set<string>();
  return aggregates.flatMap(repo => repo.tests).filter(test => {
    const key = `${test.repo ?? ''}|${test.type}|${test.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function OverviewSidebar({
  workspace,
  selectedCard,
  activePanel,
  mobileOpen,
  onSelectPanel,
  onClose,
}: Pick<ContextualOverviewProps, 'workspace' | 'selectedCard' | 'activePanel' | 'mobileOpen' | 'onSelectPanel' | 'onClose'>) {
  const { t } = useI18n();
  const items: { key: OverviewPanelKey; label: string; icon: typeof ClipboardList }[] = [
    { key: 'status', label: t('cockpit.overview.status'), icon: ClipboardList },
    { key: 'kpis', label: t('cockpit.overview.kpis'), icon: BarChart3 },
    { key: 'qa', label: t('cockpit.overview.qa'), icon: ShieldCheck },
    { key: 'infra', label: t('cockpit.overview.infra'), icon: Server },
    { key: 'allure', label: t('cockpit.overview.allure'), icon: FlaskConical },
    { key: 'access', label: t('cockpit.overview.access'), icon: Link2 },
  ];

  return (
    <aside
      className={`${mobileOpen ? 'absolute inset-y-0 left-12 z-30 flex w-[min(22rem,calc(100vw-6.5rem))] shadow-2xl' : 'hidden'} min-h-0 shrink-0 flex-col border-r border-border bg-card sm:static sm:z-auto sm:flex sm:w-64 sm:shadow-none`}
      data-testid="contextual-overview-sidebar"
    >
      <div className="border-b border-border/50 px-3 py-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('cockpit.nav.overview')}</h2>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">{workspace.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('cockpit.sidebar.close')} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden" data-testid="button-close-overview-sidebar">
            <span className="text-base leading-none">×</span>
          </button>
        </div>
        <p className="mt-2 text-[10px] text-primary" data-testid="overview-scope-label">{scopeText(t, selectedCard)}</p>
      </div>
      <nav className="space-y-1 p-2" aria-label={t('cockpit.nav.overview')} data-testid="overview-panel-navigation">
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectPanel(item.key)}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] transition-colors ${activePanel === item.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'}`}
            aria-current={activePanel === item.key ? 'page' : undefined}
            data-testid={`button-overview-panel-${item.key}`}
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.key === 'allure' && <span className="font-mono text-[9px] text-muted-foreground">{t('cockpit.overview.full')}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function PanelHeader({ title, description, scope }: { title: string; description: string; scope: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 px-4 py-4 sm:px-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">{scope}</Badge>
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: { key: string; label: string; value: number; icon: typeof GitBranch; className: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 lg:grid-cols-4 sm:p-6" data-testid="overview-kpi-grid">
      {metrics.map(metric => (
        <div key={metric.key} className="rounded-lg border border-border/50 bg-muted/15 p-3.5" data-testid={`overview-kpi-${metric.key}`}>
          <metric.icon className={`mb-3 h-4 w-4 ${metric.className}`} />
          <p className="font-mono text-2xl font-bold">{metric.value}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</p>
        </div>
      ))}
    </div>
  );
}

function StatusPanel({ scope }: { scope: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-full items-center justify-center p-6" data-testid="overview-status-panel">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/30">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold">{t('cockpit.overview.statusReserved')}</h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('cockpit.overview.statusReservedHint')}</p>
        <Badge variant="outline" className="mt-4 text-[9px]">{scope}</Badge>
      </div>
    </div>
  );
}

function KpisPanel({ aggregates, scope }: { aggregates: OverviewAggregate[]; scope: string }) {
  const { t } = useI18n();
  const metrics = useMemo(() => {
    const allPrs = aggregates.flatMap(repo => repo.prs);
    const allFiles = aggregates.flatMap(repo => repo.files);
    const allTests = uniqueTests(aggregates);
    return [
      { key: 'repos', label: t('cockpit.overview.kpiRepos'), value: aggregates.length, icon: SquareStack, className: 'text-primary' },
      { key: 'branches', label: t('cockpit.overview.kpiBranches'), value: aggregates.reduce((sum, repo) => sum + repo.branches.length, 0), icon: GitBranch, className: 'text-emerald-400' },
      { key: 'prs-conflict', label: t('cockpit.overview.kpiPrsConflict'), value: allPrs.filter(pr => pr.hasConflict).length, icon: GitPullRequest, className: 'text-red-400' },
      { key: 'prs-clear', label: t('cockpit.overview.kpiPrsClear'), value: allPrs.filter(pr => !pr.hasConflict).length, icon: GitPullRequest, className: 'text-blue-400' },
      { key: 'files-modified', label: t('cockpit.overview.kpiFiles'), value: allFiles.filter(file => file.change === 'modified').length, icon: FileText, className: 'text-amber-400' },
      { key: 'tests-aaa', label: t('cockpit.overview.kpiAaa'), value: allTests.filter(test => test.type === 'unit').length, icon: TestTube2, className: 'text-purple-400' },
      { key: 'tests-e2e', label: t('cockpit.overview.kpiE2e'), value: allTests.filter(test => test.type === 'e2e').length, icon: FlaskConical, className: 'text-cyan-400' },
    ];
  }, [aggregates, t]);

  return (
    <ScrollArea className="min-h-0 flex-1" data-testid="overview-kpis-panel">
      <PanelHeader title={t('cockpit.overview.kpis')} description={t('cockpit.overview.kpisHint')} scope={scope} />
      <MetricGrid metrics={metrics} />
    </ScrollArea>
  );
}

function QaPanel({ aggregates, scope, onOpenAllure }: { aggregates: OverviewAggregate[]; scope: string; onOpenAllure: () => void }) {
  const { t } = useI18n();
  const tests = uniqueTests(aggregates);
  const passed = tests.filter(test => test.status === 'success').length;
  const failed = tests.filter(test => test.status === 'fail').length;
  const running = tests.filter(test => test.status === 'running').length;
  const skipped = tests.filter(test => test.status === 'skipped').length;
  const passRate = tests.length > 0 ? Math.round((passed / tests.length) * 100) : 0;
  const quality = failed === 0 && running === 0 ? 'good' : 'attention';

  return (
    <ScrollArea className="min-h-0 flex-1" data-testid="overview-qa-panel">
      <PanelHeader title={t('cockpit.overview.qa')} description={t('cockpit.overview.qaHint')} scope={scope} />
      <div className="space-y-4 p-4 sm:p-6">
        <div className={`flex items-center gap-3 rounded-lg border p-4 ${quality === 'good' ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`} data-testid="overview-qa-health">
          {quality === 'good' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <ShieldCheck className="h-5 w-5 shrink-0 text-amber-400" />}
          <div>
            <p className="text-sm font-semibold">{quality === 'good' ? t('cockpit.overview.qaHealthy') : t('cockpit.overview.qaAttention')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('cockpit.overview.qaHealthHint')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { key: 'pass-rate', label: t('cockpit.overview.qaPassRate'), value: `${passRate}%`, className: 'text-emerald-400' },
            { key: 'failed', label: t('cockpit.overview.qaFailed'), value: failed, className: 'text-red-400' },
            { key: 'running', label: t('cockpit.overview.qaRunning'), value: running, className: 'text-primary' },
            { key: 'skipped', label: t('cockpit.overview.qaSkipped'), value: skipped, className: 'text-muted-foreground' },
          ].map(metric => (
            <div key={metric.key} className="rounded-lg border border-border/50 bg-muted/15 p-3" data-testid={`overview-qa-${metric.key}`}>
              <p className={`font-mono text-xl font-bold ${metric.className}`}>{metric.value}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onOpenAllure} className="flex w-full items-center justify-between rounded-lg border border-purple-500/25 bg-purple-500/5 px-4 py-3 text-left transition-colors hover:border-purple-400/50 hover:bg-purple-500/10" data-testid="button-qa-open-allure">
          <span className="flex items-center gap-2 text-xs font-medium"><FileBarChart2 className="h-4 w-4 text-purple-400" />{t('cockpit.overview.openAllure')}</span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </ScrollArea>
  );
}

function countService(services: RuntimeService[], name: string) {
  return services.filter(service => service.name.toLowerCase() === name).length;
}

function InfraPanel({ workspace, cards, selectedCard, scope }: { workspace: Workspace; cards: Card[]; selectedCard?: Card; scope: string }) {
  const { t } = useI18n();
  const scopedIds = new Set(cards.map(card => card.id));
  const apps: RuntimeApp[] = selectedCard
    ? workspace.runtime.apps.filter(app => !app.taskId || scopedIds.has(app.taskId))
    : workspace.runtime.apps;
  const services = selectedCard
    ? workspace.runtime.infra.filter(service => !service.taskIds?.length || service.taskIds.some(taskId => scopedIds.has(taskId)))
    : workspace.runtime.infra;
  const types = [
    { key: 'containers', label: t('cockpit.overview.infraContainers'), value: apps.length + services.length, icon: SquareStack },
    { key: 'services', label: t('cockpit.overview.infraServices'), value: services.length, icon: Server },
    { key: 'mysql', label: 'MySQL', value: countService(services, 'mysql'), icon: Database },
    { key: 'mongodb', label: 'MongoDB', value: countService(services, 'mongodb'), icon: Database },
    { key: 'backend', label: t('cockpit.overview.infraBackend'), value: apps.filter(app => app.role === 'backend').length, icon: Server },
    { key: 'frontend', label: t('cockpit.overview.infraFrontend'), value: apps.filter(app => app.role === 'frontend').length, icon: SquareStack },
  ];

  return (
    <ScrollArea className="min-h-0 flex-1" data-testid="overview-infra-panel">
      <PanelHeader title={t('cockpit.overview.infra')} description={t('cockpit.overview.infraHint')} scope={scope} />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-6">
        {types.map(type => (
          <div key={type.key} className="rounded-lg border border-border/50 bg-muted/15 p-3.5" data-testid={`overview-infra-${type.key}`}>
            <type.icon className="mb-3 h-4 w-4 text-primary" />
            <p className="font-mono text-2xl font-bold">{type.value}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{type.label}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function AccessPanel({ workspace, cards, selectedCard, scope }: { workspace: Workspace; cards: Card[]; selectedCard?: Card; scope: string }) {
  const { t } = useI18n();
  const scopedIds = new Set(cards.map(card => card.id));
  const apps = selectedCard
    ? workspace.runtime.apps.filter(app => !app.taskId || scopedIds.has(app.taskId))
    : workspace.runtime.apps;

  return (
    <ScrollArea className="min-h-0 flex-1" data-testid="overview-access-panel">
      <PanelHeader title={t('cockpit.overview.access')} description={t('cockpit.overview.accessHint')} scope={scope} />
      <div className="space-y-2 p-4 sm:p-6">
        {apps.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/50 px-3 py-10 text-center text-xs italic text-muted-foreground" data-testid="overview-access-empty">
            {t('cockpit.overview.accessEmpty')}
          </div>
        ) : apps.map(app => {
          const isFrontend = app.role === 'frontend';
          const url = `http://localhost:${app.port}${isFrontend ? '' : '/swagger'}`;
          return (
            <a key={app.id} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/15 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5" data-testid={`link-overview-access-${app.id}`}>
              <span className="rounded-md border border-primary/20 bg-primary/10 p-2"><Link2 className="h-4 w-4 text-primary" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{app.name}</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{isFrontend ? t('cockpit.overview.frontendAccess') : t('cockpit.overview.swaggerAccess')} · :{app.port}</span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </a>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export function ContextualOverview({
  workspace,
  cards,
  aggregates,
  selectedCard,
  onSelectPanel,
  activePanel,
  mobileOpen,
  onClose,
}: ContextualOverviewProps) {
  const { t } = useI18n();
  const scope = scopeText(t, selectedCard);
  const allTests = uniqueTests(aggregates);

  return (
    <>
      <OverviewSidebar
        workspace={workspace}
        selectedCard={selectedCard}
        activePanel={activePanel}
        mobileOpen={mobileOpen}
        onSelectPanel={panel => { onSelectPanel(panel); }}
        onClose={onClose}
      />
      <main className="flex min-w-0 flex-1 flex-col bg-background" data-testid="contextual-overview-content">
        {activePanel === 'status' && <StatusPanel scope={scope} />}
        {activePanel === 'kpis' && <KpisPanel aggregates={aggregates} scope={scope} />}
        {activePanel === 'qa' && <QaPanel aggregates={aggregates} scope={scope} onOpenAllure={() => onSelectPanel('allure')} />}
        {activePanel === 'infra' && <InfraPanel workspace={workspace} cards={cards} selectedCard={selectedCard} scope={scope} />}
        {activePanel === 'allure' && (
          <ScrollArea className="min-h-0 flex-1" data-testid="overview-allure-panel">
            <PanelHeader title={t('cockpit.overview.allure')} description={t('cockpit.overview.allureHint')} scope={scope} />
            <AllureReport tests={allTests} />
          </ScrollArea>
        )}
        {activePanel === 'access' && <AccessPanel workspace={workspace} cards={cards} selectedCard={selectedCard} scope={scope} />}
      </main>
    </>
  );
}
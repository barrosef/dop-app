/**
 * Workspace resources and the separate local developer terminal.
 *
 * Resources come from GET /api/v1/resources. They are account integrations,
 * not runtime containers, so this screen does not infer health, logs, ports or
 * deployment state from their kind/config. The terminal is intentionally a
 * local preview supplied by the dev server and remains available without an
 * API resource.
 */
import React from 'react';
import { AlertTriangle, ArrowLeft, ExternalLink, KeyRound, Server, Terminal } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  getListResourcesQueryKey,
  getListWorkspacesQueryKey,
  useListResources,
  useListWorkspaces,
  type ResourceSummary,
} from '@workspace/api-client-react';

import { InfraTerminal } from '../components/infra-terminal';
import { useI18n } from '../lib/i18n';
import { useAccount } from '../lib/platform/account';

type CockpitTab = 'resources' | 'terminal';

const LOCAL_TERMINAL_ID = 'local-preview';

function isTab(value: string | null): value is CockpitTab {
  return value === 'resources' || value === 'terminal';
}

function ResourceRow({
  resource,
  selected,
  onSelect,
}: {
  resource: ResourceSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useI18n((s) => s.t);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors last:border-b-0 ${
        selected
          ? 'bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
      }`}
      data-testid={`resource-${resource.id}`}
    >
      <Server className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{resource.name}</span>
        <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
          {resource.kind}
          {resource.version === undefined ? '' : ` · v${resource.version}`}
        </span>
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {resource.credential_ref
          ? t('cockpit.resources.credentialConfigured')
          : t('cockpit.resources.credentialMissing')}
      </span>
    </button>
  );
}

function ResourceDetails({ resource }: { resource: ResourceSummary }) {
  const t = useI18n((s) => s.t);
  const configKeys = Object.keys(resource.config ?? {});
  return (
    <section className="max-w-2xl space-y-4" data-testid="resource-details">
      <div className="flex items-start gap-3">
        <Server className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{resource.name}</h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {resource.kind}
            {resource.version === undefined ? '' : ` · v${resource.version}`}
          </p>
        </div>
      </div>

      <dl className="divide-y divide-border/60 rounded-md border border-border/60 bg-card/40 text-xs">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted-foreground">{t('cockpit.resources.credential')}</dt>
          <dd className="flex items-center gap-1.5 font-mono text-[10px]">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            {resource.credential_ref
              ? t('cockpit.resources.credentialConfigured')
              : t('cockpit.resources.credentialMissing')}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-muted-foreground">{t('cockpit.resources.config')}</dt>
          <dd className="font-mono text-[10px]">
            {t('cockpit.resources.configKeys', { count: configKeys.length })}
          </dd>
        </div>
      </dl>

      <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>{t('cockpit.resources.detailHint')}</p>
      </div>
    </section>
  );
}

function LocalTerminal({
  workspaceId,
  onBack,
}: {
  workspaceId: string;
  onBack: () => void;
}) {
  const t = useI18n((s) => s.t);
  return (
    <section className="flex min-h-0 flex-1 flex-col" data-testid="local-terminal">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('cockpit.resources.back')}
          data-testid="button-back-resources"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{t('cockpit.resources.localTerminal')}</h2>
          <p className="text-[10px] text-muted-foreground">
            {t('cockpit.resources.localTerminalHint')}
          </p>
        </div>
      </div>
      <InfraTerminal
        workspaceId={workspaceId}
        resourceId={LOCAL_TERMINAL_ID}
        resourceName={LOCAL_TERMINAL_ID}
      />
    </section>
  );
}

export default function WorkspaceCockpit() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const t = useI18n((s) => s.t);
  const { activeAccount } = useAccount();
  const workspaces = useListWorkspaces({
    query: {
      queryKey: getListWorkspacesQueryKey(),
      enabled: Boolean(id && activeAccount),
    },
  });
  const resources = useListResources(undefined, {
    query: {
      queryKey: getListResourcesQueryKey(),
      enabled: Boolean(activeAccount),
    },
  });
  const [selectedResourceId, setSelectedResourceId] = React.useState<string | null>(null);

  const workspace = workspaces.data?.find((candidate) => candidate.id === id);
  const requestedTab = searchParams.get('tab');
  const activeTab: CockpitTab = isTab(requestedTab)
    ? requestedTab
    : 'resources';
  const selectedResource =
    resources.data?.find((resource) => resource.id === selectedResourceId) ?? null;

  React.useEffect(() => {
    if (!selectedResourceId || resources.data?.some((resource) => resource.id === selectedResourceId)) {
      return;
    }
    setSelectedResourceId(null);
  }, [resources.data, selectedResourceId]);

  const setTab = (tab: CockpitTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  if (!activeAccount || workspaces.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
        {t('cockpit.resources.loadingWorkspace')}
      </div>
    );
  }

  if (workspaces.error || !workspace) {
    return (
      <div className="m-6 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t('cockpit.resources.workspaceError', {
            reason: workspaces.error
              ? (workspaces.error as Error).message
              : t('cockpit.resources.workspaceMissing'),
          })}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid="workspace-cockpit">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('cockpit.resources.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{workspace.name}</h1>
          <p className="font-mono text-[10px] text-muted-foreground">
            {workspace.key} · {t('cockpit.resources.subtitle')}
          </p>
        </div>
      </header>

      <nav className="flex shrink-0 gap-1 border-b border-border px-3 pt-2" aria-label={t('cockpit.resources.title')}>
        <button
          type="button"
          onClick={() => setTab('resources')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium ${
            activeTab === 'resources'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          aria-selected={activeTab === 'resources'}
          role="tab"
          data-testid="tab-resources"
        >
          <Server className="h-3.5 w-3.5" />
          {t('cockpit.resources.title')}
        </button>
        <button
          type="button"
          onClick={() => setTab('terminal')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium ${
            activeTab === 'terminal'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          aria-selected={activeTab === 'terminal'}
          role="tab"
          data-testid="tab-local-terminal"
        >
          <Terminal className="h-3.5 w-3.5" />
          {t('cockpit.resources.localTerminal')}
        </button>
      </nav>

      {activeTab === 'terminal' ? (
        <LocalTerminal workspaceId={id} onBack={() => setTab('resources')} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-border bg-card/30">
            <div className="border-b border-border px-3 py-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('cockpit.resources.title')}
              </h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {t('cockpit.resources.hint')}
              </p>
            </div>
            {resources.isLoading ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                {t('cockpit.resources.loading')}
              </p>
            ) : resources.error ? (
              <div className="m-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{(resources.error as Error).message}</span>
              </div>
            ) : (resources.data?.length ?? 0) === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                {t('cockpit.resources.empty')}
              </p>
            ) : (
              resources.data?.map((resource) => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  selected={resource.id === selectedResourceId}
                  onSelect={() => setSelectedResourceId(resource.id)}
                />
              ))
            )}
            <button
              type="button"
              onClick={() => setTab('terminal')}
              className="m-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
              data-testid="button-open-local-terminal"
            >
              <Terminal className="h-3.5 w-3.5" />
              {t('cockpit.resources.openLocalTerminal')}
            </button>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
            {selectedResource ? (
              <ResourceDetails resource={selectedResource} />
            ) : (
              <div className="flex min-h-full items-center justify-center">
                <div className="max-w-sm text-center">
                  <Server className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{t('cockpit.resources.selectTitle')}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {t('cockpit.resources.selectHint')}
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
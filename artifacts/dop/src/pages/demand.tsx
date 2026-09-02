/**
 * The demand's cockpit — `GET /api/v1/demands/{id}/cockpit`, a single response
 * carrying the demand, its stages and its threads.
 *
 * The anatomy follows the navigation-and-cockpit spec §3/§5 in the part the real
 * data already supports: a panel on the left (the demand's threads — the Chat
 * function) and, at the centre, the **stage ruler of the effective flow**, whose
 * TYPE picks the renderer.
 *
 * What the centre does NOT do: invent a stage, deduce a state or reorder. The
 * ruler is the effective flow frozen when the demand started (`flow_id` +
 * `flow_version`), and the order is the one that arrived. No rule of the core is
 * reproduced here.
 *
 * A renderer per stage type: the rich components that already exist in dop-app
 * (plan-stage-view, test-stage-view, exec-stage-view, doc-viewer) were written
 * over the MOCK model and expect data the API does not deliver yet (the stage's
 * document, the files touched, a test result). Wiring them now would mean
 * filling the difference with invention — so this slice shows what the API
 * really gives (type, status, gate, artifacts) and the report records what is
 * missing for each of them to come up.
 */
import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileText,
  Lock,
  MessageSquare,
  Play,
} from 'lucide-react';
import {
  getGetCockpitQueryKey,
  useGetCockpit,
  type Stage,
  type Thread,
} from '@workspace/api-client-react';

import { useI18n } from '../lib/i18n';

function StageIcon({ status }: { status: string }) {
  if (status === 'done')
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === 'running') return <Play className="h-4 w-4 text-primary" />;
  if (status === 'blocked') return <Lock className="h-4 w-4 text-amber-400" />;
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
}

function ThreadPanel({
  threads,
  selected,
  onSelect,
}: {
  threads: Thread[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const t = useI18n((s) => s.t);
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider">
          {t('demand.threads')}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {threads.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground">
            {t('demand.threads.emptyHere')}
          </p>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelect(thread.id)}
              className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                selected === thread.id
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              data-testid={`thread-${thread.id}`}
            >
              <span className="font-mono">
                #{thread.key || thread.id.slice(0, 8)}
              </span>
              {thread.blocked ? (
                <span className="ml-2 rounded border border-amber-500/25 bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold text-amber-400">
                  {t('demand.thread.blocked')}
                </span>
              ) : null}
              {thread.card?.purpose ? (
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80">
                  {thread.card.purpose}
                </p>
              ) : null}
            </button>
          ))
        )}
      </div>
      <p className="border-t border-border px-3 py-2 text-[10px] italic text-muted-foreground/70">
        {t('demand.threads.noHistory')}
      </p>
    </aside>
  );
}

function StageCentre({ stage }: { stage: Stage }) {
  const t = useI18n((s) => s.t);
  return (
    <div className="space-y-4 px-6 py-5" data-testid="stage-centre">
      <div className="flex items-center gap-3">
        <StageIcon status={stage.status ?? ''} />
        <div>
          <h2 className="text-base font-semibold">{stage.name || stage.key}</h2>
          <p className="text-[11px] font-mono text-muted-foreground">
            {t('demand.stage.meta', {
              type: stage.type || '—',
              status: stage.status || '—',
              gate: stage.gate || 'none',
            })}
          </p>
        </div>
      </div>

      {stage.awaiting_decision ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('demand.stage.awaiting')}</span>
        </div>
      ) : null}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          {t('demand.stage.artifacts')}
        </h3>
        {(stage.artifacts?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('demand.stage.artifacts.empty')}
          </p>
        ) : (
          <ul className="space-y-1">
            {(stage.artifacts ?? []).map((artifact) => (
              <li
                key={artifact.id}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-xs"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {artifact.name || artifact.id}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {artifact.kind} v{artifact.version}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function Demand() {
  const { demandId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const t = useI18n((s) => s.t);
  const { data, isLoading, error } = useGetCockpit(demandId, {
    query: {
      queryKey: getGetCockpitQueryKey(demandId),
      enabled: Boolean(demandId),
    },
  });

  const stages = data?.demand.stages ?? [];
  const stageFromUrl = params.get('stage') ?? '';
  const selectedStage =
    stages.find((s) => s.key === stageFromUrl) ??
    stages.find((s) => s.key === data?.demand.current_stage_key) ??
    stages[0];

  const threadFromUrl = params.get('thread') ?? '';
  const [selectedThread, setSelectedThread] = React.useState(threadFromUrl);
  React.useEffect(() => {
    if (threadFromUrl) setSelectedThread(threadFromUrl);
  }, [threadFromUrl]);

  if (isLoading) {
    return (
      <p className="px-6 py-6 text-xs text-muted-foreground">
        {t('demand.loading.cockpit')}
      </p>
    );
  }
  if (error) {
    return (
      <div className="m-6 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t('demand.error', { reason: (error as Error).message })}</span>
      </div>
    );
  }
  if (!data) return null;

  const demand = data.demand;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The demand's strip: identification and the double status (provider ×
          DOP). */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]">
            {demand.external_key}
          </span>
          <h1
            className="text-base font-semibold tracking-tight"
            data-testid="demand-title"
          >
            {demand.title || demand.external_key}
          </h1>
          {demand.dop_status ? (
            <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {demand.dop_status}
            </span>
          ) : null}
          {demand.provider_status ? (
            <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {t('demand.providerStatus', { status: demand.provider_status })}
            </span>
          ) : null}
          {demand.awaiting_decision ? (
            <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
              {t('demand.awaiting')}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {t('demand.flow', {
            id: (demand.flow_id ?? '').slice(0, 8),
            version: demand.flow_version ?? '',
          })}
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <ThreadPanel
          threads={data.threads ?? []}
          selected={selectedThread}
          onSelect={(id) => {
            setSelectedThread(id);
            const next = new URLSearchParams(params);
            next.set('thread', id);
            setParams(next, { replace: true });
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* The stage ruler: the order is the effective flow's, with no
              reordering. */}
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 py-2">
            {stages.map((stage) => {
              const active = stage.key === selectedStage?.key;
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('stage', stage.key);
                    setParams(next, { replace: true });
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  data-testid={`stage-${stage.key}`}
                >
                  <StageIcon status={stage.status ?? ''} />
                  <span>{stage.name || stage.key}</span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedStage ? (
              <StageCentre stage={selectedStage} />
            ) : (
              <p className="px-6 py-6 text-xs text-muted-foreground">
                {t('demand.stages.empty')}
              </p>
            )}
          </div>

          {(data.findings?.length ?? 0) > 0 ? (
            <div className="shrink-0 border-t border-border px-6 py-3">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t('demand.findings')}
              </h3>
              <ul className="space-y-1">
                {(data.findings ?? []).map((finding) => (
                  <li key={finding.id} className="text-xs">
                    {finding.title || finding.id}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

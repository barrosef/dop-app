/**
 * The demand's cockpit — `GET /api/v1/demands/{id}/cockpit`, a single response
 * carrying the demand, its stages and its threads.
 *
 * The anatomy follows the navigation-and-cockpit spec §3/§5 in the part the real
 * data already supports: a panel on the left (the demand's threads and the
 * generated turn runner) and, at the centre, the **stage ruler of the effective
 * flow**, whose TYPE picks the renderer.
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
import { useQueryClient } from '@tanstack/react-query';
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
  getGetDemandQueryKey,
  getGetCockpitQueryKey,
  getListAttentionQueryKey,
  useGetCockpit,
  useRunTurn,
  type TurnOutcome,
  type Stage,
  type Thread,
} from '@workspace/api-client-react';

import { useI18n } from '../lib/i18n';
import { useAccount } from '../lib/platform/account';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

type LogicalTurnSubmission = {
  demandId: string;
  threadId: string;
  text: string;
  idempotencyKey: string;
};

function createIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  throw new Error('This browser cannot create a secure idempotency key.');
}

function TurnOutcomePanel({ outcome }: { outcome: TurnOutcome }) {
  const t = useI18n((s) => s.t);
  const values = [
    [t('demand.turn.provider'), outcome.provider],
    [t('demand.turn.concluded'), outcome.concluded],
    [t('demand.turn.paused'), outcome.paused],
    [t('demand.turn.contextTruncated'), outcome.context_truncated],
    [t('demand.turn.messageIds'), outcome.message_ids?.join(', ')],
    [t('demand.turn.notice'), outcome.notice],
  ] as const;

  return (
    <section className="space-y-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs" data-testid="turn-outcome">
      <h4 className="font-semibold text-primary">{t('demand.turn.outcome')}</h4>
      {outcome.reply ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('demand.turn.reply')}
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{outcome.reply}</p>
        </div>
      ) : (
        <p className="text-muted-foreground">{t('demand.turn.noReply')}</p>
      )}
      <dl className="grid gap-x-4 gap-y-1 text-[10px] sm:grid-cols-2">
        {values.map(([label, value]) =>
          value === undefined || value === null || value === '' ? null : (
            <div key={label} className="flex min-w-0 gap-1">
              <dt className="shrink-0 text-muted-foreground">{label}:</dt>
              <dd className="min-w-0 break-words font-mono">
                {typeof value === 'boolean' ? String(value) : value}
              </dd>
            </div>
          ),
        )}
      </dl>
      {outcome.routing ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('demand.turn.routing')}
          </p>
          <dl className="grid gap-x-4 gap-y-1 text-[10px] sm:grid-cols-2">
            {(
              [
                [t('demand.turn.taskKind'), outcome.routing.task_kind],
                [t('demand.turn.model'), outcome.routing.model],
                [t('demand.turn.effort'), outcome.routing.effort],
                [t('demand.turn.effortApplied'), outcome.routing.effort_applied],
                [t('demand.turn.reason'), outcome.routing.reason],
              ] as const
            ).map(([label, value]) =>
              value ? (
                <div key={label} className="flex min-w-0 gap-1">
                  <dt className="shrink-0 text-muted-foreground">{label}:</dt>
                  <dd className="min-w-0 break-words font-mono">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </div>
      ) : null}
      {outcome.finding ? (
        <p className="text-[10px]">
          <span className="text-muted-foreground">{t('demand.turn.finding')}: </span>
          {outcome.finding.title || outcome.finding.id}
        </p>
      ) : null}
      {outcome.usage ? (
        <p className="text-[10px] text-muted-foreground">
          {t('demand.turn.usage')}: {t('demand.turn.tokens', {
            input: outcome.usage.input_tokens ?? 0,
            output: outcome.usage.output_tokens ?? 0,
          })}
          {outcome.usage.cost
            ? ` · ${t('demand.turn.cost', {
                amount: outcome.usage.cost.amount_micros ?? 0,
                currency: outcome.usage.cost.currency ?? '',
              })}`
            : ''}
        </p>
      ) : null}
    </section>
  );
}

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
  const queryClient = useQueryClient();
  const { activeAccount } = useAccount();
  const { data, isLoading, error } = useGetCockpit(demandId, {
    query: {
      queryKey: getGetCockpitQueryKey(demandId),
      enabled: Boolean(demandId && activeAccount),
    },
  });
  const requestHeaders = React.useRef<Record<string, string>>({});
  const runTurn = useRunTurn({ request: { headers: requestHeaders.current } });
  const [message, setMessage] = React.useState('');
  const [turnOutcomes, setTurnOutcomes] = React.useState<Record<string, TurnOutcome[]>>({});
  const submissions = React.useRef<Map<string, LogicalTurnSubmission>>(new Map());

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

  const selectedThreadData = data?.threads?.find((thread) => thread.id === selectedThread);

  const sendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || !selectedThreadData || selectedThreadData.blocked || runTurn.isPending || !activeAccount) return;
    const submissionId = JSON.stringify([demandId, selectedThreadData.id, text]);
    const logicalSubmission =
      submissions.current.get(submissionId) ??
      ({
        demandId,
        threadId: selectedThreadData.id,
        text,
        idempotencyKey: createIdempotencyKey(),
      } satisfies LogicalTurnSubmission);
    submissions.current.set(submissionId, logicalSubmission);
    requestHeaders.current['Idempotency-Key'] = logicalSubmission.idempotencyKey;

    runTurn.mutate(
      {
        demandId: logicalSubmission.demandId,
        threadId: logicalSubmission.threadId,
        data: { text: logicalSubmission.text },
      },
      {
        onSuccess: (outcome) => {
          setTurnOutcomes((current) => ({
            ...current,
            [logicalSubmission.threadId]: [
              ...(current[logicalSubmission.threadId] ?? []),
              outcome,
            ],
          }));
          setMessage('');
          submissions.current.delete(submissionId);
          void Promise.all([
            queryClient.invalidateQueries({
              queryKey: getGetCockpitQueryKey(demandId),
            }),
            queryClient.invalidateQueries({
              queryKey: getGetDemandQueryKey(demandId),
            }),
            queryClient.invalidateQueries({
              queryKey: getListAttentionQueryKey(),
            }),
          ]);
        },
      },
    );
  };

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

          {selectedThreadData ? (
            <section className="shrink-0 border-t border-border px-6 py-3" data-testid="thread-composer">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t('demand.thread.messages')}
              </h3>
              {(turnOutcomes[selectedThreadData.id]?.length ?? 0) > 0 ? (
                <div className="mb-3 max-h-28 space-y-1 overflow-y-auto">
                  {turnOutcomes[selectedThreadData.id].map((outcome, index) => (
                    <TurnOutcomePanel
                      key={`${outcome.thread_id}-${index}`}
                      outcome={outcome}
                    />
                  ))}
                </div>
              ) : null}
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    if (runTurn.error) runTurn.reset();
                  }}
                  disabled={runTurn.isPending || selectedThreadData.blocked}
                  placeholder={t('demand.thread.messagePlaceholder')}
                  className="min-w-0 flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs outline-none transition-colors focus:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="input-thread-message"
                />
                <Button
                  type="submit"
                  disabled={
                    runTurn.isPending ||
                    selectedThreadData.blocked ||
                    !message.trim()
                  }
                  className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="button-thread-message"
                >
                  {runTurn.isPending
                    ? t('demand.thread.sending')
                    : t('demand.thread.send')}
                </Button>
              </form>
              {runTurn.error ? (
                <p className="mt-2 text-[10px] text-destructive">
                  {t('demand.thread.sendError', {
                    reason: (runTurn.error as Error).message,
                  })}
                </p>
              ) : null}
              <p className="mt-2 text-[10px] text-muted-foreground/70">
                {t('demand.thread.historyNote')}
              </p>
            </section>
          ) : null}

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

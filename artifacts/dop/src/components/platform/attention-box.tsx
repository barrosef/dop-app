/**
 * The attention box — the single queue of "where am I needed, and in what
 * order" (the conversation-and-attention spec §3). It is not the chat: it is
 * what leads to the right chat.
 *
 * **Nothing is recomputed here.** The items' order, the groups' order and the
 * badge (`open_total`) come ready from `GET /api/v1/attention`. There is no
 * `sort`, no `filter` and no local counting on this screen — on purpose: the
 * priority is DERIVED by the core (the kind's impact, with age breaking ties
 * within the band), and a second ruler on the front end would make the queue
 * stop having a single order, which is exactly what it exists to offer. The
 * badge is the core's too: it counts the WHOLE account, and counting what is on
 * the screen would give a number that changes when the dev paginates — a badge
 * that goes down on its own is a badge nobody trusts.
 *
 * There is no "mark as read": an item is born of an event and dies of an event.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, Radio, RefreshCw, X } from 'lucide-react';
import {
  getListAttentionQueryKey,
  useListAttention,
  type AttentionItem,
} from '@workspace/api-client-react';

import {
  useAttentionStream,
  type StreamState,
} from '../../hooks/use-attention-stream';
import { useAccount } from '../../lib/platform/account';
import { useI18n } from '../../lib/i18n';

/**
 * Where the click leads.
 *
 * The BFF sends the (`target_kind`, `target_id`) pair and leaves the route to
 * the cockpit on purpose — keeping the finished route on the server would tie
 * the edge to the screen's design. When there is no screen for the target yet,
 * we return `null` and the item shows up without a click: better an honest,
 * inert item than a click that leads nowhere.
 */
function routeForItem(item: AttentionItem): string | null {
  if (!item.demand_id) return null;
  const base = `/demands/${item.demand_id}`;
  if (item.target_kind === 'thread' && item.target_id) {
    return `${base}?thread=${encodeURIComponent(item.target_id)}`;
  }
  if (item.target_kind === 'stage' && item.target_id) {
    return `${base}?stage=${encodeURIComponent(item.target_id)}`;
  }
  return base;
}

function AttentionItemCard({ item }: { item: AttentionItem }) {
  const navigate = useNavigate();
  const t = useI18n((s) => s.t);
  const route = routeForItem(item);

  // The kind's vocabulary is the core's; only the label is localized.
  const kindKey = `attention.kind.${item.kind ?? ''}` as Parameters<
    typeof t
  >[0];
  const label =
    item.kind && t(kindKey) !== kindKey
      ? t(kindKey)
      : (item.kind ?? t('attention.box.pending'));

  function age(iso: string | null | undefined): string {
    if (!iso) return '';
    const opened = new Date(iso).getTime();
    if (Number.isNaN(opened)) return '';
    const minutes = Math.max(0, Math.round((Date.now() - opened) / 60000));
    if (minutes < 1) return t('attention.age.now');
    if (minutes < 60) return t('attention.age.minutes', { n: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t('attention.age.hours', { n: hours });
    return t('attention.age.days', { n: Math.round(hours / 24) });
  }

  const content = (
    <>
      <div className="flex items-center gap-2">
        <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {age(item.opened_at)}
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-medium">{item.title || label}</p>
      {item.summary ? (
        <p className="truncate text-xs text-muted-foreground">{item.summary}</p>
      ) : null}
      {!route ? (
        <p className="mt-1 text-[10px] italic text-muted-foreground">
          {t('attention.box.noScreen')}
        </p>
      ) : null}
    </>
  );

  if (!route) {
    return (
      <div
        className="rounded-md border border-border/60 bg-card/60 px-3 py-2"
        data-testid="attention-item"
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate(route)}
      className="w-full rounded-md border border-border/60 bg-card/60 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
      data-testid="attention-item"
    >
      {content}
    </button>
  );
}

function LiveIndicator({ state }: { state: StreamState }) {
  const t = useI18n((s) => s.t);

  if (state === 'live') {
    return (
      <span
        className="flex items-center gap-1 text-[10px] text-emerald-400"
        title={t('attention.live.on.title')}
      >
        <Radio className="h-3 w-3" /> {t('attention.live.on')}
      </span>
    );
  }
  if (state === 'connecting') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Radio className="h-3 w-3 animate-pulse" />{' '}
        {t('attention.live.connecting')}
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1 text-[10px] text-amber-400"
      title={t('attention.live.off.title')}
    >
      <RefreshCw className="h-3 w-3" /> {t('attention.live.off')}
    </span>
  );
}

/**
 * One SSE subscription per session, and not one per box drawn.
 *
 * The box appears in two places at once (the bell's panel and the start
 * screen). If each opened its own `EventSource`, there would be two long
 * connections for the same stream, two replays in the core and two cursors
 * moving separately. The shell mounts this provider ONCE; the boxes only read
 * the state.
 */
const LiveContext = React.createContext<StreamState>('unavailable');

export function AttentionLiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeAccount } = useAccount();
  const queryClient = useQueryClient();

  const onUpdate = React.useCallback(() => {
    // The notice says something CHANGED; what says what it became is the box's
    // endpoint.
    queryClient.invalidateQueries({ queryKey: getListAttentionQueryKey() });
  }, [queryClient]);

  const state = useAttentionStream(onUpdate, Boolean(activeAccount));

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

/**
 * The box's content. Used both in the bell's panel and on the start screen —
 * one box, in one place in the code.
 */
export function AttentionList() {
  const { activeAccount } = useAccount();
  const streamState = React.useContext(LiveContext);
  const t = useI18n((s) => s.t);

  const { data, isLoading, error, refetch, isFetching } = useListAttention(
    undefined,
    {
      query: {
        queryKey: getListAttentionQueryKey(),
        enabled: Boolean(activeAccount),
        // While the stream is not up, the box keeps itself honest by rereading
        // the endpoint. It is no substitute for live — it is what stops the
        // screen from showing old data as if it were new.
        refetchInterval: streamState === 'live' ? false : 20_000,
      },
    },
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="attention-box">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t('attention.box.title')}</h2>
          <span
            className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary"
            data-testid="attention-badge"
          >
            {data?.open_total ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator state={streamState} />
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-muted-foreground transition-colors hover:text-foreground"
            title={t('attention.box.reload')}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {t('attention.box.loading')}
          </p>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {t('attention.box.error', { reason: (error as Error).message })}
            </span>
          </div>
        ) : (data?.groups?.length ?? 0) === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {t('attention.box.empty')}
          </p>
        ) : (
          <div className="space-y-4">
            {data?.groups?.map((group, index) => (
              <section
                key={group.demand_id || `account-${index}`}
                className="space-y-1.5"
              >
                <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.demand_id
                    ? t('attention.box.group.demand', {
                        id: group.demand_id.slice(0, 8),
                      })
                    : t('attention.box.group.account')}
                </h3>
                {(group.items ?? []).map((item) => (
                  <AttentionItemCard
                    key={item.id || `${item.kind}-${item.target_id}`}
                    item={item}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The header's bell: the badge always visible, an overlaid panel on click. */
export function AttentionBell() {
  const { activeAccount } = useAccount();
  const t = useI18n((s) => s.t);
  const [open, setOpen] = React.useState(false);
  const { data } = useListAttention(undefined, {
    query: {
      queryKey: getListAttentionQueryKey(),
      enabled: Boolean(activeAccount),
    },
  });
  const total = data?.open_total ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        title={t('attention.box.title')}
        data-testid="button-bell"
      >
        <Bell className="h-4 w-4" />
        {total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {total}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-xl">
            <div className="flex items-center justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <AttentionList />
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}

/**
 * Cockpit da demanda — `GET /api/v1/demands/{id}/cockpit`, uma resposta só com
 * demanda, etapas e threads.
 *
 * A anatomia segue a spec navegação-e-cockpit §3/§5 na parte que o dado real já
 * sustenta: painel à esquerda (as threads da demanda — a função Chat) e centro
 * com a **régua de etapas do fluxo efetivo**, cujo TIPO escolhe o renderizador.
 *
 * O que o centro NÃO faz: inventar etapa, deduzir estado ou reordenar. A régua
 * é o fluxo efetivo congelado quando a demanda iniciou (`flow_id` +
 * `flow_version`), e a ordem é a que veio. Nenhuma regra do núcleo é reproduzida
 * aqui.
 *
 * Renderizador por tipo de etapa: os componentes ricos que já existem no
 * dop-app (plan-stage-view, test-stage-view, exec-stage-view, doc-viewer) foram
 * escritos sobre o modelo de MOCK e esperam dados que a API ainda não entrega
 * (documento da etapa, arquivos tocados, resultado de teste). Ligá-los agora
 * exigiria preencher a diferença com invenção — então esta fatia mostra o que a
 * API dá de verdade (tipo, status, portão, artefatos) e o relatório registra o
 * que falta para cada um deles subir.
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

function IconeDaEtapa({ status }: { status: string }) {
  if (status === 'done')
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === 'running') return <Play className="h-4 w-4 text-primary" />;
  if (status === 'blocked') return <Lock className="h-4 w-4 text-amber-400" />;
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
}

function PainelDeThreads({
  threads,
  selecionada,
  aoSelecionar,
}: {
  threads: Thread[];
  selecionada: string;
  aoSelecionar: (id: string) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider">
          Threads
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {threads.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground">
            Nenhuma thread aberta nesta demanda.
          </p>
        ) : (
          threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => aoSelecionar(thread.id)}
              className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                selecionada === thread.id
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
                  bloqueada
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
        O histórico de mensagens da thread não é lido por esta API — só há rota
        de escrita (`POST /threads/{'{'}id{'}'}/messages`).
      </p>
    </aside>
  );
}

function CentroDaEtapa({ etapa }: { etapa: Stage }) {
  return (
    <div className="space-y-4 px-6 py-5" data-testid="centro-etapa">
      <div className="flex items-center gap-3">
        <IconeDaEtapa status={etapa.status ?? ''} />
        <div>
          <h2 className="text-base font-semibold">{etapa.name || etapa.key}</h2>
          <p className="text-[11px] text-muted-foreground">
            tipo <span className="font-mono">{etapa.type || '—'}</span> · status{' '}
            <span className="font-mono">{etapa.status || '—'}</span> · portão{' '}
            <span className="font-mono">{etapa.gate || 'none'}</span>
          </p>
        </div>
      </div>

      {etapa.awaiting_decision ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Esta etapa está esperando decisão humana. Ela é o portão do fluxo
            efetivo — a decisão em si (`POST .../gate`) entra numa próxima
            fatia.
          </span>
        </div>
      ) : null}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Artefatos
        </h3>
        {(etapa.artifacts?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum artefato nesta etapa.
          </p>
        ) : (
          <ul className="space-y-1">
            {(etapa.artifacts ?? []).map((artefato) => (
              <li
                key={artefato.id}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-xs"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {artefato.name || artefato.id}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {artefato.kind} v{artefato.version}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function Demanda() {
  const { demandId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error } = useGetCockpit(demandId, {
    query: {
      queryKey: getGetCockpitQueryKey(demandId),
      enabled: Boolean(demandId),
    },
  });

  const etapas = data?.demand.stages ?? [];
  const etapaDaUrl = params.get('etapa') ?? '';
  const etapaSelecionada =
    etapas.find((e) => e.key === etapaDaUrl) ??
    etapas.find((e) => e.key === data?.demand.current_stage_key) ??
    etapas[0];

  const threadDaUrl = params.get('thread') ?? '';
  const [threadSelecionada, setThreadSelecionada] = React.useState(threadDaUrl);
  React.useEffect(() => {
    if (threadDaUrl) setThreadSelecionada(threadDaUrl);
  }, [threadDaUrl]);

  if (isLoading) {
    return (
      <p className="px-6 py-6 text-xs text-muted-foreground">
        Carregando cockpit…
      </p>
    );
  }
  if (error) {
    return (
      <div className="m-6 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{(error as Error).message}</span>
      </div>
    );
  }
  if (!data) return null;

  const demanda = data.demand;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Faixa da demanda: identificação e duplo status (provedor × DOP). */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]">
            {demanda.external_key}
          </span>
          <h1
            className="text-base font-semibold tracking-tight"
            data-testid="titulo-demanda"
          >
            {demanda.title || demanda.external_key}
          </h1>
          {demanda.dop_status ? (
            <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {demanda.dop_status}
            </span>
          ) : null}
          {demanda.provider_status ? (
            <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              provedor: {demanda.provider_status}
            </span>
          ) : null}
          {demanda.awaiting_decision ? (
            <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
              aguardando decisão
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          fluxo efetivo {(demanda.flow_id ?? '').slice(0, 8)} · versão{' '}
          {demanda.flow_version} (congelado no início da demanda)
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <PainelDeThreads
          threads={data.threads ?? []}
          selecionada={threadSelecionada}
          aoSelecionar={(id) => {
            setThreadSelecionada(id);
            const proximos = new URLSearchParams(params);
            proximos.set('thread', id);
            setParams(proximos, { replace: true });
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* A régua de etapas: a ordem é a do fluxo efetivo, sem reordenação. */}
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 py-2">
            {etapas.map((etapa) => {
              const ativa = etapa.key === etapaSelecionada?.key;
              return (
                <button
                  key={etapa.key}
                  type="button"
                  onClick={() => {
                    const proximos = new URLSearchParams(params);
                    proximos.set('etapa', etapa.key);
                    setParams(proximos, { replace: true });
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    ativa
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                  data-testid={`etapa-${etapa.key}`}
                >
                  <IconeDaEtapa status={etapa.status ?? ''} />
                  <span>{etapa.name || etapa.key}</span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {etapaSelecionada ? (
              <CentroDaEtapa etapa={etapaSelecionada} />
            ) : (
              <p className="px-6 py-6 text-xs text-muted-foreground">
                Esta demanda não tem etapas.
              </p>
            )}
          </div>

          {(data.findings?.length ?? 0) > 0 ? (
            <div className="shrink-0 border-t border-border px-6 py-3">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Achados
              </h3>
              <ul className="space-y-1">
                {(data.findings ?? []).map((achado) => (
                  <li key={achado.id} className="text-xs">
                    {achado.title || achado.id}
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

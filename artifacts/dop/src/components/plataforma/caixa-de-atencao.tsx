/**
 * A caixa de atenção — a fila única de "onde eu sou necessário, e em que ordem"
 * (spec conversação-e-atenção §3). Não é o chat: é o que leva ao chat certo.
 *
 * **Nada é recalculado aqui.** A ordem dos itens, a ordem dos grupos e o badge
 * (`open_total`) vêm prontos de `GET /api/v1/attention`. Não há `sort`, não há
 * `filter` e não há contagem local nesta tela — de propósito: a prioridade é
 * DERIVADA pelo núcleo (impacto do tipo, idade desempatando dentro da faixa), e
 * uma segunda régua no front faria a fila deixar de ter uma ordem só, que é
 * exatamente o que ela existe para oferecer. O badge também é do núcleo: ele
 * conta a conta INTEIRA, e contar o que está na tela daria um número que muda
 * quando o dev pagina — badge que diminui sozinho é badge em que ninguém
 * confia.
 *
 * Não existe "marcar como lido": item nasce de evento e morre de evento.
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
  useStreamAtencao,
  type EstadoStream,
} from '../../hooks/use-stream-atencao';
import { useConta } from '../../lib/plataforma/conta';

/** Rótulo de cada tipo — o vocabulário é o do núcleo, traduzido só na tela. */
const ROTULO_POR_TIPO: Record<string, string> = {
  thread_blocked: 'Agente aguardando resposta',
  gate_pending: 'Portão aguardando decisão',
  pr_review: 'PR aguardando revisão',
  merge_conflict: 'Conflito na fila de merge',
  directive: 'Decisão de coordenação',
  budget_exceeded: 'Orçamento estourado',
  integration_broken: 'Integração quebrada',
};

/**
 * Para onde o clique leva.
 *
 * O BFF manda o par (`target_kind`, `target_id`) e deixa a rota para o cockpit
 * de propósito — guardar a rota pronta no servidor amarraria a borda ao desenho
 * da tela. Quando ainda não existe tela para o alvo, devolvemos `null` e o item
 * aparece sem clique: melhor um item honesto e inerte que um clique que leva a
 * lugar nenhum.
 */
function rotaDoItem(item: AttentionItem): string | null {
  if (!item.demand_id) return null;
  const base = `/demandas/${item.demand_id}`;
  if (item.target_kind === 'thread' && item.target_id) {
    return `${base}?thread=${encodeURIComponent(item.target_id)}`;
  }
  if (item.target_kind === 'stage' && item.target_id) {
    return `${base}?etapa=${encodeURIComponent(item.target_id)}`;
  }
  return base;
}

function quandoAbriu(iso: string | null | undefined): string {
  if (!iso) return '';
  const aberto = new Date(iso).getTime();
  if (Number.isNaN(aberto)) return '';
  const minutos = Math.max(0, Math.round((Date.now() - aberto) / 60000));
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.round(horas / 24)} d`;
}

function ItemDaCaixa({ item }: { item: AttentionItem }) {
  const navigate = useNavigate();
  const rota = rotaDoItem(item);
  const rotulo = ROTULO_POR_TIPO[item.kind ?? ''] ?? item.kind ?? 'Pendência';

  const conteudo = (
    <>
      <div className="flex items-center gap-2">
        <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
          {rotulo}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {quandoAbriu(item.opened_at)}
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-medium">
        {item.title || rotulo}
      </p>
      {item.summary ? (
        <p className="truncate text-xs text-muted-foreground">{item.summary}</p>
      ) : null}
      {!rota ? (
        <p className="mt-1 text-[10px] italic text-muted-foreground">
          Sem tela para este alvo ainda
        </p>
      ) : null}
    </>
  );

  if (!rota) {
    return (
      <div
        className="rounded-md border border-border/60 bg-card/60 px-3 py-2"
        data-testid="item-atencao"
      >
        {conteudo}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate(rota)}
      className="w-full rounded-md border border-border/60 bg-card/60 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
      data-testid="item-atencao"
    >
      {conteudo}
    </button>
  );
}

function Indicador({ estado }: { estado: EstadoStream }) {
  if (estado === 'ao-vivo') {
    return (
      <span
        className="flex items-center gap-1 text-[10px] text-emerald-400"
        title="Recebendo mudanças pelo SSE"
      >
        <Radio className="h-3 w-3" /> ao vivo
      </span>
    );
  }
  if (estado === 'conectando') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Radio className="h-3 w-3 animate-pulse" /> conectando
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1 text-[10px] text-amber-400"
      title="O stream não conectou; a caixa está sendo relida periodicamente"
    >
      <RefreshCw className="h-3 w-3" /> releitura periódica
    </span>
  );
}

/**
 * Uma assinatura SSE por sessão, e não uma por caixa desenhada.
 *
 * A caixa aparece em dois lugares ao mesmo tempo (o painel do sino e a tela
 * inicial). Se cada um abrisse o próprio `EventSource`, seriam duas conexões
 * longas para o mesmo fluxo, dois replays no núcleo e dois cursores andando em
 * separado. O casco monta este provedor UMA vez; as caixas só leem o estado.
 */
const AoVivoContext = React.createContext<EstadoStream>('indisponivel');

export function AtencaoAoVivoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { contaAtiva } = useConta();
  const queryClient = useQueryClient();

  const aoAtualizar = React.useCallback(() => {
    // O aviso diz que MUDOU; quem diz o que virou é o endpoint da caixa.
    queryClient.invalidateQueries({ queryKey: getListAttentionQueryKey() });
  }, [queryClient]);

  const estado = useStreamAtencao(aoAtualizar, Boolean(contaAtiva));

  return (
    <AoVivoContext.Provider value={estado}>{children}</AoVivoContext.Provider>
  );
}

/**
 * O conteúdo da caixa. Usado tanto no painel do sino quanto na tela inicial —
 * uma caixa só, num lugar só do código.
 */
export function ListaDeAtencao() {
  const { contaAtiva } = useConta();
  const estadoStream = React.useContext(AoVivoContext);

  const { data, isLoading, error, refetch, isFetching } = useListAttention(
    undefined,
    {
      query: {
        queryKey: getListAttentionQueryKey(),
        enabled: Boolean(contaAtiva),
        // Enquanto o stream não está de pé, a caixa se mantém honesta relendo o
        // endpoint. Não é substituto do ao vivo — é o que impede a tela de
        // mostrar dado velho como se fosse novo.
        refetchInterval: estadoStream === 'ao-vivo' ? false : 20_000,
      },
    },
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="caixa-atencao">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Caixa de atenção</h2>
          <span
            className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary"
            data-testid="badge-atencao"
          >
            {data?.open_total ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Indicador estado={estadoStream} />
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Reler a caixa agora"
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
            Carregando…
          </p>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Não foi possível ler a caixa: {(error as Error).message}
            </span>
          </div>
        ) : (data?.groups?.length ?? 0) === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Nada esperando por você.
          </p>
        ) : (
          <div className="space-y-4">
            {data?.groups?.map((grupo, indice) => (
              <section
                key={grupo.demand_id || `conta-${indice}`}
                className="space-y-1.5"
              >
                <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {grupo.demand_id
                    ? `Demanda ${grupo.demand_id.slice(0, 8)}`
                    : 'Da conta'}
                </h3>
                {(grupo.items ?? []).map((item) => (
                  <ItemDaCaixa
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

/** O sino do header: badge sempre visível, painel sobreposto ao clicar. */
export function SinoDeAtencao() {
  const { contaAtiva } = useConta();
  const [aberto, setAberto] = React.useState(false);
  const { data } = useListAttention(undefined, {
    query: {
      queryKey: getListAttentionQueryKey(),
      enabled: Boolean(contaAtiva),
    },
  });
  const total = data?.open_total ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        title="Caixa de atenção"
        data-testid="botao-sino"
      >
        <Bell className="h-4 w-4" />
        {total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {total}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/60"
            onClick={() => setAberto(false)}
            aria-hidden
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-xl">
            <div className="flex items-center justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ListaDeAtencao />
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}

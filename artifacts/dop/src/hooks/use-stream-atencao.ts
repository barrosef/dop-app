/**
 * A caixa de atenção AO VIVO — `GET /api/v1/stream/attention`.
 *
 * **Por que um leitor com `fetch` e não o `EventSource` nativo.** A primeira
 * versão usava o nativo, pela retomada de graça: o browser guarda o último
 * `id:` e o reenvia como `Last-Event-ID`. Mas o `EventSource` **não sabe enviar
 * cabeçalho**, e o BFF exige `Authorization: Bearer` e `x-account-id` — a
 * conexão voltava 401, sempre.
 *
 * As saídas eram três. Cookie de sessão e ticket de curta duração resolvem, e
 * ambas criam um SEGUNDO caminho de autenticação para a mesma credencial. Um
 * ticket assinado ainda exigiria uma chave de assinatura no BFF, que é
 * justamente o que a ADR-0023 proíbe: **o BFF não tem segredo**.
 *
 * Então: um caminho só. O leitor manda os mesmos cabeçalhos de toda chamada, e
 * a retomada — que era o motivo de usar o nativo — vira ~40 linhas aqui, com o
 * cursor vindo do `id:` que o servidor emite.
 *
 * **O cursor agora existe.** `AttentionUpdate` do núcleo carrega `event_id`, a
 * POSIÇÃO no log; o BFF o emite como `id:` e nós o devolvemos em
 * `?since_event_id=`. Continua valendo a regra antiga: só se guarda cursor que
 * o servidor mandou — cursor inventado pede ao núcleo uma posição que não
 * existe.
 *
 * O que chega aqui NÃO é aplicado sobre a lista local. O aviso dispara uma
 * releitura de `GET /api/v1/attention`, e a ordem continua sendo a que o núcleo
 * mandou. Costurar `opened`/`resolved` na lista da tela seria uma segunda régua
 * de prioridade — exatamente o que a caixa existe para não ter.
 */
import React from 'react';

import { API_BASE_URL } from '../lib/plataforma/config';
import { obterContaAtiva } from '../lib/plataforma/conta-ativa';
import { idTokenAtual } from '../lib/plataforma/firebase';

export type EstadoStream = 'conectando' | 'ao-vivo' | 'indisponivel';

/** O que o BFF emite em `event: attention` — uma MUDANÇA, não a caixa inteira. */
export type AtualizacaoAtencao = {
  change?: string;
  item?: { id?: string; demand_id?: string; kind?: string };
};

/** Quadro SSE já separado em nome, id e dados. */
type Quadro = { evento: string; id: string; dados: string };

/**
 * Separa o buffer em quadros completos, devolvendo o resto.
 *
 * SSE separa quadros por linha em branco, e um `read()` pode entregar meio
 * quadro: processar o que chegou sem esperar o terminador produziria JSON
 * cortado a cada leitura — e o erro apareceria como "quadro ilegível", que
 * manda procurar no lugar errado.
 */
function separarQuadros(buffer: string): { quadros: Quadro[]; resto: string } {
  const partes = buffer.split('\n\n');
  const resto = partes.pop() ?? '';
  const quadros: Quadro[] = [];

  for (const bruto of partes) {
    let evento = 'message';
    let id = '';
    const dados: string[] = [];
    for (const linha of bruto.split('\n')) {
      if (linha.startsWith(':')) continue; // comentário; o heartbeat vem assim
      const sep = linha.indexOf(':');
      const campo = sep === -1 ? linha : linha.slice(0, sep);
      const valor = sep === -1 ? '' : linha.slice(sep + 1).replace(/^ /, '');
      if (campo === 'event') evento = valor;
      else if (campo === 'id') id = valor;
      else if (campo === 'data') dados.push(valor);
    }
    if (dados.length > 0) quadros.push({ evento, id, dados: dados.join('\n') });
  }
  return { quadros, resto };
}

export function useStreamAtencao(
  aoAtualizar: (atualizacao: AtualizacaoAtencao) => void,
  ativo: boolean,
): EstadoStream {
  const [estado, setEstado] = React.useState<EstadoStream>('conectando');
  const cursor = React.useRef<string>('');

  // A referência evita reabrir a conexão a cada render só porque o callback é
  // uma função nova — reconectar de graça perderia eventos no intervalo.
  const callback = React.useRef(aoAtualizar);
  React.useEffect(() => {
    callback.current = aoAtualizar;
  }, [aoAtualizar]);

  React.useEffect(() => {
    if (!ativo) {
      setEstado('indisponivel');
      return;
    }

    const controle = new AbortController();
    let vivo = true;
    // Recuo crescente: contra um 401 ou um núcleo fora do ar, tentar a cada
    // segundo é tempestade sem chance de sucesso.
    let esperaMs = 1000;

    async function conectar(): Promise<void> {
      while (vivo) {
        setEstado('conectando');
        try {
          const url = new URL('/api/v1/stream/attention', API_BASE_URL);
          if (cursor.current) {
            url.searchParams.set('since_event_id', cursor.current);
          }

          const token = await idTokenAtual();
          const conta = obterContaAtiva();
          const resposta = await fetch(url.toString(), {
            method: 'GET',
            signal: controle.signal,
            headers: {
              Accept: 'text/event-stream',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(conta ? { 'x-account-id': conta } : {}),
            },
          });

          if (!resposta.ok || !resposta.body) {
            // 401/403 não melhoram com insistência rápida; deixa o recuo agir.
            setEstado('indisponivel');
            throw new Error(`stream recusado: ${resposta.status}`);
          }

          setEstado('ao-vivo');
          esperaMs = 1000; // conectou: zera o recuo

          const leitor = resposta.body.getReader();
          const decodificador = new TextDecoder();
          let buffer = '';

          while (vivo) {
            const { done, value } = await leitor.read();
            if (done) break;
            buffer += decodificador.decode(value, { stream: true });
            const { quadros, resto } = separarQuadros(buffer);
            buffer = resto;

            for (const q of quadros) {
              // Só se guarda cursor que o SERVIDOR mandou.
              if (q.id) cursor.current = q.id;

              if (q.evento === 'error') {
                try {
                  const corpo = JSON.parse(q.dados) as {
                    retryable?: boolean;
                    since_event_id?: string;
                  };
                  if (corpo.since_event_id) cursor.current = corpo.since_event_id;
                  if (corpo.retryable === false) {
                    vivo = false;
                    setEstado('indisponivel');
                  }
                } catch {
                  /* quadro de erro ilegível não piora a situação */
                }
                continue;
              }

              if (q.evento !== 'attention') continue;
              try {
                callback.current(JSON.parse(q.dados) as AtualizacaoAtencao);
              } catch {
                // Quadro ilegível não derruba o stream: o próximo aviso
                // corrige a tela, e a caixa é relida do endpoint de qualquer
                // forma.
              }
            }
          }
        } catch (erro) {
          if (controle.signal.aborted) return;
          // Queda de rede é normal num stream longo; o recuo evita martelar.
        }

        if (!vivo) return;
        await new Promise((r) => setTimeout(r, esperaMs));
        esperaMs = Math.min(esperaMs * 2, 30000);
      }
    }

    void conectar();
    return () => {
      vivo = false;
      controle.abort();
    };
  }, [ativo]);

  return estado;
}

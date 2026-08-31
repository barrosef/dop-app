/**
 * A conta ativa, do lado do React: lista as contas do usuário e mantém a
 * seleção coerente com a loja que o `customFetch` lê.
 *
 * Trocar de conta LIMPA o cache do react-query. As chaves de consulta geradas
 * pelo orval são o caminho da rota (`['/api/v1/tree']`) e não incluem a conta —
 * sem a limpeza, a árvore da conta anterior ficaria na tela como se fosse a
 * desta. Limpar é a resposta certa: nada do que está em cache pertence à conta
 * nova.
 */
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListAccountsQueryKey,
  useListAccounts,
  type AccountSummary,
} from '@workspace/api-client-react';

import {
  assinarContaAtiva,
  definirContaAtiva,
  obterContaAtiva,
} from './conta-ativa';
import { useSessao } from './sessao';

type EstadoConta = {
  contas: AccountSummary[];
  contaAtiva: string;
  carregando: boolean;
  erro: unknown;
  trocarConta: (id: string) => void;
};

const ContaContext = React.createContext<EstadoConta | null>(null);

export function ContaProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useSessao();
  const queryClient = useQueryClient();

  const contaAtiva = React.useSyncExternalStore(
    assinarContaAtiva,
    obterContaAtiva,
  );

  // `/api/v1/accounts` é a única rota que responde sem conta ativa — é ela que
  // diz quais contas existem para escolher.
  // `queryKey` explícito: o tipo do react-query v5 o exige, e o gerador expõe
  // o mesmo helper que ele usaria por padrão — nenhuma chave inventada aqui.
  const { data, isLoading, error } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey(), enabled: Boolean(usuario) },
  });

  const contas = React.useMemo(() => data ?? [], [data]);

  // Seleção automática só quando a guardada não vale mais (primeiro acesso,
  // vínculo removido). Nunca por cima de uma escolha válida do usuário.
  React.useEffect(() => {
    if (contas.length === 0) return;
    const valida = contas.some((c) => c.id === contaAtiva);
    if (!valida) definirContaAtiva(contas[0].id);
  }, [contas, contaAtiva]);

  const trocarConta = React.useCallback(
    (id: string) => {
      if (id === obterContaAtiva()) return;
      definirContaAtiva(id);
      queryClient.clear();
    },
    [queryClient],
  );

  const valor = React.useMemo<EstadoConta>(
    () => ({
      contas,
      contaAtiva,
      carregando: isLoading,
      erro: error,
      trocarConta,
    }),
    [contas, contaAtiva, isLoading, error, trocarConta],
  );

  return (
    <ContaContext.Provider value={valor}>{children}</ContaContext.Provider>
  );
}

export function useConta(): EstadoConta {
  const contexto = React.useContext(ContaContext);
  if (!contexto)
    throw new Error('useConta precisa estar dentro de <ContaProvider>');
  return contexto;
}

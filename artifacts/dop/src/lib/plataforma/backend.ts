/**
 * Liga o cliente gerado (orval) ao BFF real.
 *
 * Importado uma vez em `main.tsx`, antes de qualquer requisição. Três ajustes,
 * e nenhum deles é decisão de negócio:
 *
 *  1. **Base**: as rotas geradas são absolutas (`/api/v1/...`); a origem do BFF
 *     vem do ambiente.
 *  2. **Token**: `Authorization: Bearer <token de ID do Firebase>`.
 *  3. **Conta ativa**: `x-account-id`, lido da loja a CADA requisição — trocar
 *     de conta não recarrega a página, e um cabeçalho congelado devolveria o
 *     dado de outra conta sem dar erro nenhum.
 */
import {
  setAuthTokenGetter,
  setBaseUrl,
  setHeadersProvider,
} from '@workspace/api-client-react';

import { API_BASE_URL } from './config';
import { obterContaAtiva } from './conta-ativa';
import { idTokenAtual } from './firebase';

setBaseUrl(API_BASE_URL);
setAuthTokenGetter(idTokenAtual);
setHeadersProvider((): Record<string, string> => {
  const conta = obterContaAtiva();
  return conta ? { 'x-account-id': conta } : {};
});

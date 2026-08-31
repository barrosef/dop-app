/**
 * Configuração do cockpit — tudo que muda entre ambientes vem do `import.meta.env`.
 *
 * Nada aqui tem valor de produção embutido: um padrão silencioso apontando para
 * o ambiente errado é o tipo de erro que só aparece depois do deploy.
 */

/** Origem do BFF (dop-api). Local: `http://localhost:8000`. */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/**
 * Projeto do Firebase. Precisa ser o MESMO do BFF (`FIREBASE_PROJECT`): é
 * contra ele que a audiência do token é conferida em produção.
 */
export const FIREBASE_PROJECT_ID: string =
  import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'dop-local';

/**
 * Chave pública da API do Firebase. Não é segredo (vai no bundle); ela apenas
 * identifica o projeto no Identity Toolkit. Contra o emulador, qualquer valor
 * não vazio serve.
 */
export const FIREBASE_API_KEY: string =
  import.meta.env.VITE_FIREBASE_API_KEY ?? 'fake-api-key';

export const FIREBASE_AUTH_DOMAIN: string =
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ??
  `${FIREBASE_PROJECT_ID}.firebaseapp.com`;

/**
 * Emulador do Firebase Auth, quando existir (ex.: `http://auth.localtest.me:8080`).
 *
 * Vazio em produção — e essa é a única diferença de configuração entre os dois
 * mundos. O emulador emite token `alg: none`, sem assinatura; o Firebase de
 * verdade assina e o BFF VERIFICA. Por isso nada neste cockpit pode depender de
 * o token não ser verificado: a mesma tela roda contra os dois.
 */
export const FIREBASE_AUTH_EMULATOR_URL: string =
  import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? '';

/**
 * Identidade do cockpit: Firebase Auth, o mesmo verificador que o BFF espera.
 *
 * O token de ID daqui vai como `Authorization: Bearer <token>` em toda chamada
 * (ver `backend.ts`). O SDK cuida da renovação — um token de ID vale uma hora,
 * e `getIdToken()` devolve um novo quando o atual está perto de vencer.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';

import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_AUTH_EMULATOR_URL,
  FIREBASE_PROJECT_ID,
} from './config';

export const firebaseApp: FirebaseApp = initializeApp({
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
});

export const auth: Auth = getAuth(firebaseApp);

// A decisão de falar com o emulador vem do AMBIENTE, nunca do conteúdo do
// token — a mesma regra que o BFF aplica do outro lado. Um token que se declara
// não assinado não pode escolher o próprio caminho de validação.
if (FIREBASE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(auth, FIREBASE_AUTH_EMULATOR_URL, {
    disableWarnings: false,
  });
}

/**
 * O token de ID do usuário atual, ou `null` quando não há sessão.
 *
 * `getIdToken()` sem argumento usa o cache do SDK e só vai à rede quando o
 * token está vencendo — chamá-lo a cada requisição é barato e é o jeito
 * recomendado de nunca mandar token expirado.
 */
export async function idTokenAtual(): Promise<string | null> {
  const usuario = auth.currentUser;
  return usuario ? usuario.getIdToken() : null;
}

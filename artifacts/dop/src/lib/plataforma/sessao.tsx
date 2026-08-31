/**
 * A sessão do usuário — quem está logado, e como entrar e sair.
 *
 * O estado vem de `onIdTokenChanged` (e não de `onAuthStateChanged`): ele
 * dispara também na RENOVAÇÃO do token, que é o momento em que as chamadas
 * seguintes passam a levar credencial nova. Escutar só a troca de usuário
 * deixaria a árvore sem saber que a sessão foi revalidada.
 */
import React from 'react';
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

import { auth } from './firebase';

type Sessao = {
  usuario: User | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const SessaoContext = React.createContext<Sessao | null>(null);

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = React.useState<User | null>(auth.currentUser);
  // Começa carregando mesmo quando `currentUser` já existe: o SDK ainda vai
  // restaurar a sessão do armazenamento, e mostrar a tela de login nesse
  // intervalo faria a página piscar um login que não era necessário.
  const [carregando, setCarregando] = React.useState(true);

  React.useEffect(() => {
    return onIdTokenChanged(auth, (proximo) => {
      setUsuario(proximo);
      setCarregando(false);
    });
  }, []);

  const valor = React.useMemo<Sessao>(
    () => ({
      usuario,
      carregando,
      entrar: async (email, senha) => {
        await signInWithEmailAndPassword(auth, email, senha);
      },
      sair: async () => {
        await signOut(auth);
      },
    }),
    [usuario, carregando],
  );

  return (
    <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>
  );
}

export function useSessao(): Sessao {
  const contexto = React.useContext(SessaoContext);
  if (!contexto)
    throw new Error('useSessao precisa estar dentro de <SessaoProvider>');
  return contexto;
}

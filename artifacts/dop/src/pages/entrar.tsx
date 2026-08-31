/**
 * Entrada — e-mail e senha contra o Firebase Auth.
 *
 * O mesmo código roda contra o emulador (local) e contra o Firebase de verdade
 * (produção): muda só o endereço, em `VITE_FIREBASE_AUTH_EMULATOR_URL`. O token
 * do emulador vem com `alg: none`, sem assinatura — em produção ele é assinado
 * e o BFF confere a assinatura, o emissor e a audiência. Nada nesta tela pode
 * supor a diferença.
 */
import React from 'react';
import { AlertTriangle, TerminalSquare } from 'lucide-react';

import { useSessao } from '../lib/plataforma/sessao';
import { FIREBASE_AUTH_EMULATOR_URL } from '../lib/plataforma/config';

export default function Entrar() {
  const { entrar } = useSessao();
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [erro, setErro] = React.useState('');
  const [enviando, setEnviando] = React.useState(false);

  async function aoEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (falha) {
      // Mensagem única para credencial errada: distinguir "e-mail não existe"
      // de "senha errada" entrega a lista de usuários a quem perguntar.
      setErro(
        falha instanceof Error && falha.message.includes('auth/')
          ? 'E-mail ou senha inválidos.'
          : `Não foi possível entrar: ${(falha as Error).message}`,
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4 text-foreground">
      <form
        onSubmit={aoEnviar}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        data-testid="form-entrar"
      >
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">DOP</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Entre para abrir o cockpit da sua conta.
        </p>

        <label className="block space-y-1">
          <span className="text-xs font-medium">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
            data-testid="input-email"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
            data-testid="input-senha"
          />
        </label>

        {erro ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span data-testid="texto-erro-login">{erro}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={enviando}
          className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          data-testid="botao-entrar"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        {FIREBASE_AUTH_EMULATOR_URL ? (
          <p className="text-center text-[10px] text-amber-400/80">
            Emulador do Firebase Auth em uso ({FIREBASE_AUTH_EMULATOR_URL}). Em
            produção a assinatura do token é verificada de verdade.
          </p>
        ) : null}
      </form>
    </div>
  );
}

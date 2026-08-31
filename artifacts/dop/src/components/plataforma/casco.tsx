/**
 * O chrome global (spec navegação-e-cockpit §2): header fino com seletor de
 * conta ativa e a caixa de atenção, e a árvore lateral workspaces→projetos.
 *
 * O que ainda NÃO está aqui, e é proposital não fingir que está: breadcrumb
 * completo, ⌘K e os painéis deslizantes de configuração. Esta fatia liga as
 * três telas do dado real; o resto do chrome entra quando tiver o que mostrar.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Moon, Sun, TerminalSquare } from 'lucide-react';

import { useUiStore } from '../../store/uiStore';
import { useConta } from '../../lib/plataforma/conta';
import { useSessao } from '../../lib/plataforma/sessao';
import { ArvoreDeNavegacao } from './arvore-de-navegacao';
import { AtencaoAoVivoProvider, SinoDeAtencao } from './caixa-de-atencao';

function SeletorDeConta() {
  const { contas, contaAtiva, trocarConta, carregando } = useConta();

  if (carregando) {
    return (
      <span className="text-xs text-muted-foreground">carregando contas…</span>
    );
  }
  if (contas.length === 0) {
    return <span className="text-xs text-muted-foreground">sem contas</span>;
  }

  return (
    <select
      value={contaAtiva}
      onChange={(e) => trocarConta(e.target.value)}
      className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none"
      title="Conta ativa — toda chamada à API carrega uma"
      data-testid="seletor-conta"
    >
      {contas.map((conta) => (
        <option key={conta.id} value={conta.id}>
          {conta.display_name || conta.handle}
        </option>
      ))}
    </select>
  );
}

export function Casco({ children }: { children: React.ReactNode }) {
  const { usuario, sair } = useSessao();
  const { theme, setTheme } = useUiStore();

  return (
    <AtencaoAoVivoProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
          <Link to="/" className="flex items-center gap-2">
            <TerminalSquare className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold tracking-tight">DOP</span>
          </Link>

          <div className="ml-2">
            <SeletorDeConta />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <SinoDeAtencao />
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <span
              className="hidden text-xs text-muted-foreground sm:inline"
              data-testid="texto-usuario"
            >
              {usuario?.email}
            </span>
            <button
              type="button"
              onClick={() => void sair()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title="Sair"
              data-testid="botao-sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
            <ArvoreDeNavegacao />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </AtencaoAoVivoProvider>
  );
}

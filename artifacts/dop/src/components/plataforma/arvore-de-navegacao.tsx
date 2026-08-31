/**
 * A árvore da barra lateral: workspaces → projetos da conta ativa.
 *
 * Uma chamada só (`GET /api/v1/tree`) desenha a coluna inteira — é assim que o
 * BFF a serve, agregada por tela, e não em N consultas por nível.
 *
 * Vocabulário (GLOSSARIO.md): **workspace** é o nível 1 do DOP, o agrupador de
 * projetos. Não é o espaço do provedor — o "workspace do ClickUp" é outra coisa
 * e sempre aparece qualificado.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Folder,
  Layers,
  Search,
} from 'lucide-react';
import { getGetTreeQueryKey, useGetTree } from '@workspace/api-client-react';

import { useConta } from '../../lib/plataforma/conta';

export function ArvoreDeNavegacao() {
  const { contaAtiva } = useConta();
  const { data, isLoading, error } = useGetTree({
    query: { queryKey: getGetTreeQueryKey(), enabled: Boolean(contaAtiva) },
  });
  const [busca, setBusca] = React.useState('');
  const [recolhidos, setRecolhidos] = React.useState<Record<string, boolean>>(
    {},
  );

  const termo = busca.trim().toLowerCase();
  // Filtro de TELA, sobre o que já veio: encolher a árvore visível é conforto
  // de navegação, não regra de negócio.
  const arvore = React.useMemo(() => {
    if (!data) return [];
    if (!termo) return data;
    return data
      .map((no) => ({
        ...no,
        projects: (no.projects ?? []).filter((p) =>
          p.name.toLowerCase().includes(termo),
        ),
      }))
      .filter(
        (no) =>
          no.workspace.name.toLowerCase().includes(termo) ||
          no.projects.length > 0,
      );
  }, [data, termo]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="arvore-navegacao"
    >
      <div className="px-3 pb-2 pt-3">
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar workspace ou projeto"
            className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/70"
            data-testid="input-busca-arvore"
          />
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Carregando árvore…
          </p>
        ) : error ? (
          <div className="mx-1 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{(error as Error).message}</span>
          </div>
        ) : arvore.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {termo
              ? 'Nada com esse nome.'
              : 'Esta conta ainda não tem workspaces.'}
          </p>
        ) : (
          arvore.map((no) => {
            const recolhido = recolhidos[no.workspace.id] ?? false;
            return (
              <div key={no.workspace.id} className="mb-1">
                <button
                  type="button"
                  onClick={() =>
                    setRecolhidos((atual) => ({
                      ...atual,
                      [no.workspace.id]: !recolhido,
                    }))
                  }
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-foreground/90 transition-colors hover:bg-muted/50"
                >
                  {recolhido ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <Layers className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                  <span className="truncate">{no.workspace.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                    {no.workspace.key}
                  </span>
                </button>

                {!recolhido ? (
                  <div className="ml-4 border-l border-border/50 pl-2">
                    {(no.projects ?? []).length === 0 ? (
                      <p className="px-2 py-1 text-[11px] italic text-muted-foreground/70">
                        sem projetos
                      </p>
                    ) : (
                      (no.projects ?? []).map((projeto) => (
                        <NavLink
                          key={projeto.id}
                          to={`/projetos/${projeto.id}`}
                          className={({ isActive }) =>
                            `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                              isActive
                                ? 'bg-primary/15 text-primary'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`
                          }
                          data-testid={`link-projeto-${projeto.id}`}
                        >
                          <Folder className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{projeto.name}</span>
                        </NavLink>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}

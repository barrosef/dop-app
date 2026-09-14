/**
 * The sidebar's tree: the active account's workspaces → projects.
 *
 * A single call (`GET /api/v1/tree`) draws the whole column — that is how the
 * BFF serves it, aggregated per screen, and not in N queries per level.
 *
 * Vocabulary (GLOSSARY.md): a **workspace** is DOP's level 1, the grouper of
 * projects. It is not the provider's space — the "ClickUp workspace" is another
 * thing and always appears qualified.
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

import { useAccount } from '../../lib/platform/account';
import { useI18n } from '../../lib/i18n';
import { Button } from '../ui/button';

export function NavigationTree() {
  const { activeAccount } = useAccount();
  const t = useI18n((s) => s.t);
  const { data, isLoading, error } = useGetTree({
    query: { queryKey: getGetTreeQueryKey(), enabled: Boolean(activeAccount) },
  });
  const [search, setSearch] = React.useState('');
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const term = search.trim().toLowerCase();
  // A SCREEN filter, over what already arrived: shrinking the visible tree is a
  // navigation convenience, not a business rule.
  const tree = React.useMemo(() => {
    if (!data) return [];
    if (!term) return data;
    return data
      .map((node) => ({
        ...node,
        projects: (node.projects ?? []).filter((p) =>
          p.name.toLowerCase().includes(term),
        ),
      }))
      .filter(
        (node) =>
          node.workspace.name.toLowerCase().includes(term) ||
          node.projects.length > 0,
      );
  }, [data, term]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="navigation-tree">
      <div className="px-3 pb-2 pt-3">
        <Button asChild variant="outline" size="sm" className="mb-2 w-full">
          <NavLink to="/workspaces/new">{t('workspace.new')}</NavLink>
        </Button>
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('tree.search')}
            className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/70"
            data-testid="input-tree-search"
          />
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {t('tree.loading')}
          </p>
        ) : error ? (
          <div className="mx-1 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{(error as Error).message}</span>
          </div>
        ) : tree.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {term ? t('tree.empty.search') : t('tree.empty')}
          </p>
        ) : (
          tree.map((node) => {
            const isCollapsed = collapsed[node.workspace.id] ?? false;
            return (
              <div key={node.workspace.id} className="mb-1">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((current) => ({
                      ...current,
                      [node.workspace.id]: !isCollapsed,
                    }))
                  }
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-foreground/90 transition-colors hover:bg-muted/50"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <Layers className="h-3.5 w-3.5 shrink-0 text-primary/80" />
                  <span className="truncate">{node.workspace.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                    {node.workspace.key}
                  </span>
                </button>

                {!isCollapsed ? (
                  <div className="ml-4 border-l border-border/50 pl-2">
                    <NavLink
                      to={`/workspaces/${encodeURIComponent(node.workspace.id)}`}
                      className="block rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      data-testid={`link-workspace-${node.workspace.id}`}
                    >
                      {t('cockpit.resources.title')}
                    </NavLink>
                    {(node.projects ?? []).length === 0 ? (
                      <p className="px-2 py-1 text-[11px] italic text-muted-foreground/70">
                        {t('tree.noProjects')}
                      </p>
                    ) : (
                      (node.projects ?? []).map((project) => (
                        <NavLink
                          key={project.id}
                          to={`/projects/${project.id}`}
                          className={({ isActive }) =>
                            `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                              isActive
                                ? 'bg-primary/15 text-primary'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`
                          }
                          data-testid={`link-project-${project.id}`}
                        >
                          <Folder className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{project.name}</span>
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

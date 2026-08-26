import React from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import {
  LayoutGrid, Plus, Settings, ChevronLeft, ChevronRight,
  TerminalSquare, Sun, Moon, ListTodo, Globe, Folders
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useUiStore } from '../store/uiStore';
import { useWorkspace } from '../hooks/use-api';
import { useI18n } from '../lib/i18n';

/* ── helper ────────────────────────────────────────────────────── */
function NavItem({
  icon: Icon, label, to, open, active,
}: {
  icon: React.ElementType; label: string; to: string; open: boolean; active: boolean;
}) {
  const base = `flex items-center h-9 rounded-md transition-colors text-sm font-medium ${
    active
      ? 'bg-primary/15 text-primary border border-primary/25'
      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
  }`;

  const el = (
    <Link to={to} className={open ? `${base} gap-3 px-3 w-full` : `${base} w-9 justify-center`}>
      <Icon className="w-4 h-4 shrink-0" />
      {open && <span className="truncate">{label}</span>}
    </Link>
  );

  if (open) return el;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{el}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

function ActionItem({
  icon: Icon, label, open, active, onClick,
}: {
  icon: React.ElementType; label: string; open: boolean; active?: boolean; onClick?: () => void;
}) {
  const base = `flex items-center h-9 rounded-md transition-colors text-sm font-medium cursor-pointer ${
    active
      ? 'bg-primary/15 text-primary border border-primary/25'
      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
  }`;

  const el = (
    <button onClick={onClick} className={open ? `${base} gap-3 px-3 w-full` : `${base} w-9 justify-center`}>
      <Icon className="w-4 h-4 shrink-0" />
      {open && <span className="truncate">{label}</span>}
    </button>
  );

  if (open) return el;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{el}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

/* ── sidebar ────────────────────────────────────────────────────── */
export function AppSidebar() {
  const { theme, setTheme, sidebarOpen, toggleSidebar } = useUiStore();
  const { lang, setLang, t } = useI18n();
  const location = useLocation();

  const wsMatch = useMatch({ path: '/workspaces/:id', end: false });
  const rawId    = wsMatch?.params?.id;
  const wsId     = rawId && rawId !== 'new' ? rawId : undefined;
  const { data: workspace } = useWorkspace(wsId);

  const at = (to: string, exact = false) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const open = sidebarOpen;

  return (
    <div
      className={`${open ? 'w-64' : 'w-14'} shrink-0 flex flex-col bg-card border-r border-border transition-[width] duration-200 ease-in-out overflow-hidden`}
    >
      {/* ── logo + toggle ── */}
      <div className={`h-14 flex items-center border-b border-border shrink-0 ${open ? 'px-3 gap-2' : 'justify-center'}`}>
        {open ? (
          <>
            <TerminalSquare className="w-5 h-5 text-primary shrink-0" />
            <span className="font-bold tracking-tight flex-1 truncate text-sm">DOP IDE</span>
            <button
              onClick={toggleSidebar}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Expand</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── nav ── */}
      <nav className={`flex-1 overflow-y-auto py-3 space-y-0.5 ${open ? 'px-3' : 'flex flex-col items-center px-0 gap-0.5 py-3'}`}>
        <NavItem icon={LayoutGrid} label={t('sidebar.workspaces')}     to="/"               open={open} active={at('/', true)} />
        <NavItem icon={Plus}       label={t('sidebar.newWorkspace')} to="/workspaces/new"  open={open} active={at('/workspaces/new')} />

        {/* workspace context */}
        {wsId && workspace && (
          <>
            <div className={`${open ? 'mx-1' : 'w-8'} my-4 border-t border-border/50`} />
            {open && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-2 truncate">
                {workspace.name}
              </p>
            )}
            <NavItem
              icon={TerminalSquare}
              label={t('sidebar.overview')}
              to={`/workspaces/${wsId}`}
              open={open}
              active={at(`/workspaces/${wsId}`, true) && !location.search}
            />
            <NavItem
              icon={ListTodo}
              label={t('sidebar.cards')}
              to={`/workspaces/${wsId}/cards`}
              open={open}
              active={at(`/workspaces/${wsId}/cards`)}
            />
            <NavItem
              icon={Folders}
              label={t('sidebar.repositories')}
              to={`/workspaces/${wsId}?tab=repos`}
              open={open}
              active={location.search.includes('tab=repos')}
            />
            <NavItem
              icon={Settings}
              label={t('sidebar.configure')}
              to={`/workspaces/${wsId}/edit`}
              open={open}
              active={at(`/workspaces/${wsId}/edit`)}
            />
          </>
        )}
      </nav>

      {/* ── bottom: tools ── */}
      <div className={`border-t border-border py-3 space-y-1 shrink-0 ${open ? 'px-3' : 'flex flex-col items-center px-0'}`}>
        <ActionItem
          icon={Globe}
          label={lang === 'pt-BR' ? 'English' : 'Português'}
          open={open}
          onClick={() => setLang(lang === 'pt-BR' ? 'en' : 'pt-BR')}
        />
        <ActionItem
          icon={theme === 'dark' ? Sun : Moon}
          label={theme === 'dark' ? t('sidebar.theme.light') : t('sidebar.theme.dark')}
          open={open}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
      </div>
    </div>
  );
}

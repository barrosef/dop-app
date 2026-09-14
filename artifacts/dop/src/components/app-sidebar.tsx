import { ChevronLeft, ChevronRight, Globe, Moon, Sun, TerminalSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useUiStore } from '../store/uiStore';
import { useI18n } from '../lib/i18n';
import { NavigationTree } from './platform/navigation-tree';

/**
 * Legacy layout chrome kept for compatibility with embedders that still
 * import Layout. The authenticated application uses platform/Shell directly;
 * this sidebar deliberately uses the same generated-hook navigation tree and
 * never renders the retired mock workspace catalogue.
 */
export function AppSidebar() {
  const { theme, setTheme, sidebarOpen, toggleSidebar } = useUiStore();
  const { lang, setLang, t } = useI18n();
  const open = sidebarOpen;

  return (
    <div
      className={`${open ? 'w-64' : 'w-14'} flex shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-200 ease-in-out`}
      data-testid="app-sidebar"
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b border-border ${
          open ? 'gap-2 px-3' : 'justify-center'
        }`}
      >
        {open ? (
          <>
            <TerminalSquare className="h-5 w-5 shrink-0 text-primary" />
            <span className="flex-1 truncate text-sm font-bold tracking-tight">DOP</span>
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label={t('sidebar.collapse')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                aria-label={t('sidebar.expand')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {t('sidebar.expand')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {open ? (
          <NavigationTree />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center px-2 py-4">
                <TerminalSquare className="h-4 w-4 text-primary" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {t('sidebar.workspaces')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div
        className={`shrink-0 space-y-1 border-t border-border py-3 ${
          open ? 'px-3' : 'flex flex-col items-center px-0'
        }`}
      >
        <button
          type="button"
          onClick={() => setLang(lang === 'pt-BR' ? 'en' : 'pt-BR')}
          className={`${open ? 'w-full gap-3 px-3' : 'w-9 justify-center'} flex h-9 items-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground`}
          aria-label={lang === 'pt-BR' ? 'English' : 'Português'}
        >
          <Globe className="h-4 w-4 shrink-0" />
          {open && <span>{lang === 'pt-BR' ? 'English' : 'Português'}</span>}
        </button>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={`${open ? 'w-full gap-3 px-3' : 'w-9 justify-center'} flex h-9 items-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground`}
          aria-label={theme === 'dark' ? t('sidebar.theme.light') : t('sidebar.theme.dark')}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          {open && (
            <span>
              {theme === 'dark' ? t('sidebar.theme.light') : t('sidebar.theme.dark')}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
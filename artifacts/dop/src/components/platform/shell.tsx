/**
 * The global chrome (the navigation-and-cockpit spec §2): a thin header with
 * the active-account selector and the attention box, and the sidebar tree
 * workspaces→projects.
 *
 * What is NOT here yet, and it is deliberate not to pretend it is: the full
 * breadcrumb, ⌘K and the sliding configuration panels. This slice wires up the
 * three screens of real data; the rest of the chrome comes in when there is
 * something to show.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Moon, ShieldCheck, Sun, TerminalSquare } from 'lucide-react';

import { useUiStore } from '../../store/uiStore';
import { useAccount } from '../../lib/platform/account';
import { useSession } from '../../lib/platform/session';
import { useI18n } from '../../lib/i18n';
import { accountRoleTranslationKey } from './account-role';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { NavigationTree } from './navigation-tree';
import { AttentionLiveProvider, AttentionBell } from './attention-box';

function AccountSelector() {
  const { accounts, activeAccount, switchAccount, loading } = useAccount();
  const t = useI18n((s) => s.t);

  if (loading) {
    return (
      <span className="text-xs text-muted-foreground">
        {t('shell.accounts.loading')}
      </span>
    );
  }
  if (accounts.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {t('shell.accounts.none')}
      </span>
    );
  }

  const selectedAccount = accounts.some((account) => account.id === activeAccount)
    ? activeAccount
    : accounts[0].id;

  return (
    <Select
      value={selectedAccount}
      onValueChange={switchAccount}
    >
      <SelectTrigger
        className="h-8 w-[220px] border-border bg-background text-xs"
        title={t('shell.accounts.title')}
        data-testid="account-selector"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => {
          const roleKey = accountRoleTranslationKey(account.role);
          const name = account.display_name || account.handle;

          return (
            <SelectItem
              key={account.id}
              value={account.id}
              data-testid={`account-option-${account.id}`}
            >
              <span className="flex items-center gap-2">
                <span>{name}</span>
                {roleKey ? (
                  <span
                    className="text-[10px] text-muted-foreground"
                    data-testid={`account-role-${account.id}`}
                  >
                    {t(roleKey)}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useSession();
  const { theme, setTheme } = useUiStore();
  const t = useI18n((s) => s.t);

  return (
    <AttentionLiveProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
          <Link to="/" className="flex items-center gap-2">
            <TerminalSquare className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold tracking-tight">DOP</span>
          </Link>

          <div className="ml-2">
            <AccountSelector />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <AttentionBell />
            <Link
              to="/account"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title={t('account.title')}
              data-testid="link-account"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title={
                theme === 'dark' ? t('shell.theme.light') : t('shell.theme.dark')
              }
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <span
              className="hidden text-xs text-muted-foreground sm:inline"
              data-testid="text-user"
            >
              {user?.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title={t('shell.signOut')}
              data-testid="button-sign-out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
            <NavigationTree />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </AttentionLiveProvider>
  );
}

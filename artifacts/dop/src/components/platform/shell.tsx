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
import { Menu, TerminalSquare } from 'lucide-react';

import { useUiStore } from '../../store/uiStore';
import { useAccount } from '../../lib/platform/account';
import { ProfileMenu } from './profile-menu';
import { Button } from '../ui/button';
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
        className="h-8 w-full min-w-0 border-border bg-background text-xs sm:w-[220px] [&>span]:truncate"
        aria-label={t('shell.accounts.title')}
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
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{name}</span>
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
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const t = useI18n((s) => s.t);

  return (
    <AttentionLiveProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:gap-3 sm:px-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden"
            onClick={toggleSidebar} aria-expanded={sidebarOpen} aria-controls="shell-navigation"
            aria-label={t(sidebarOpen ? 'sidebar.collapse' : 'sidebar.expand')}>
            <Menu className="h-4 w-4" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <TerminalSquare className="h-5 w-5 text-primary" />
            <span className="hidden text-sm font-bold tracking-tight sm:inline">DOP</span>
          </Link>

          <div className="min-w-0 flex-1 sm:ml-2 sm:flex-none">
            <AccountSelector />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <AttentionBell />
            <ProfileMenu />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside id="shell-navigation" className={`${sidebarOpen ? 'flex' : 'hidden'} max-h-[35vh] w-full shrink-0 flex-col overflow-y-auto border-b border-border bg-card md:flex md:max-h-none md:w-64 md:border-b-0 md:border-r`}>
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

/**
 * The active account, on React's side: it lists the user's accounts and keeps
 * the selection consistent with the store `customFetch` reads.
 *
 * Switching account CLEARS the react-query cache. The query keys the orval
 * generator produces are the route's path (`['/api/v1/tree']`) and do not
 * include the account — without the clearing, the previous account's tree would
 * stay on the screen as if it were this one's. Clearing is the right answer:
 * nothing in the cache belongs to the new account.
 */
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListAccountsQueryKey,
  useListAccounts,
  type AccountSummary,
} from '@workspace/api-client-react';

import {
  subscribeToActiveAccount,
  setActiveAccount,
  getActiveAccount,
} from './active-account';
import { useSession } from './session';

type AccountState = {
  accounts: AccountSummary[];
  activeAccount: string;
  loading: boolean;
  error: unknown;
  switchAccount: (id: string) => void;
};

const AccountContext = React.createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const activeAccount = React.useSyncExternalStore(
    subscribeToActiveAccount,
    getActiveAccount,
  );

  // `/api/v1/accounts` is the only route that answers with no active account —
  // it is the one that says which accounts there are to choose from.
  // An explicit `queryKey`: react-query v5's type requires it, and the
  // generator exposes the same helper it would use by default — no key invented
  // here.
  const { data, isLoading, error } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey(), enabled: Boolean(user) },
  });

  const accounts = React.useMemo(() => data ?? [], [data]);

  // An automatic selection only when the stored one no longer holds (a first
  // visit, a membership removed). Never over a valid choice by the user.
  React.useEffect(() => {
    if (accounts.length === 0) return;
    const valid = accounts.some((a) => a.id === activeAccount);
    if (!valid) setActiveAccount(accounts[0].id);
  }, [accounts, activeAccount]);

  const switchAccount = React.useCallback(
    (id: string) => {
      if (id === getActiveAccount()) return;
      setActiveAccount(id);
      queryClient.clear();
    },
    [queryClient],
  );

  const value = React.useMemo<AccountState>(
    () => ({
      accounts,
      activeAccount,
      loading: isLoading,
      error,
      switchAccount,
    }),
    [accounts, activeAccount, isLoading, error, switchAccount],
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount(): AccountState {
  const context = React.useContext(AccountContext);
  if (!context)
    throw new Error('useAccount has to be inside an <AccountProvider>');
  return context;
}

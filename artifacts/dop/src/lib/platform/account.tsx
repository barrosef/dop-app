/**
 * The active account, on React's side: it lists the user's accounts and keeps
 * the selection consistent with the store `customFetch` reads.
 *
 * Switching account clears the react-query cache through the active-account
 * store. The query keys the orval generator produces are the route's path
 * (`['/api/v1/tree']`) and do not include the account — without the clearing,
 * the previous account's tree would stay on the screen as if it were this one's.
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
  isActiveAccountCacheReady,
  registerActiveAccountCache,
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
  registerActiveAccountCache(queryClient);

  const storedActiveAccount = React.useSyncExternalStore(
    subscribeToActiveAccount,
    getActiveAccount,
  );
  const cacheReady = React.useSyncExternalStore(
    subscribeToActiveAccount,
    isActiveAccountCacheReady,
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
  const membershipValidated = data !== undefined && !isLoading && !error;
  const membershipContainsStoredAccount = accounts.some(
    (account) => account.id === storedActiveAccount,
  );

  // An automatic selection only when the stored one no longer holds (a first
  // visit, a membership removed). Never over a valid choice by the user.
  React.useEffect(() => {
    if (data !== undefined && accounts.length === 0 && storedActiveAccount) {
      setActiveAccount('');
      return;
    }
    if (accounts.length === 0) return;
    if (!membershipContainsStoredAccount) setActiveAccount(accounts[0].id);
  }, [accounts, data, membershipContainsStoredAccount, storedActiveAccount]);

  // Consumers only receive an account after both membership and cache
  // boundaries are settled. This prevents an accountless generated key from
  // replaying the previous account while the stored selection is corrected.
  const activeAccount =
    cacheReady && membershipValidated && membershipContainsStoredAccount
      ? storedActiveAccount
      : '';

  const switchAccount = React.useCallback(
    (id: string) => {
      if (id === getActiveAccount()) return;
      setActiveAccount(id);
    },
    [],
  );

  const value = React.useMemo<AccountState>(
    () => ({
      accounts,
      activeAccount,
      loading:
        isLoading ||
        !cacheReady ||
        (!error && Boolean(storedActiveAccount) && !membershipContainsStoredAccount),
      error,
      switchAccount,
    }),
    [accounts, activeAccount, isLoading, cacheReady, storedActiveAccount, membershipContainsStoredAccount, error, switchAccount],
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

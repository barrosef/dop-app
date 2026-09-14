/**
 * The active account — the account the user is operating under right now.
 *
 * Every call to the BFF carries one (the `x-account-id` header), and it is what
 * decides the role, the grants and WHICH data comes back. That is why it has to
 * be readable from two places: from inside React (to draw the selector) and
 * from OUTSIDE it (`customFetch`, which is not a component). Hence the minimal
 * store below, with `useSyncExternalStore` on React's side.
 *
 * Persisted in `localStorage` so an F5 does not throw the user back into the
 * wrong account.
 */

const KEY = 'dop.active-account';

type Listener = () => void;

let activeAccount: string = readFromStorage();
const listeners = new Set<Listener>();
type CacheClient = {
  cancelQueries: () => Promise<unknown>;
  clear: () => void;
};
let cacheClient: CacheClient | null = null;
let cacheReady = true;
let transition = 0;

function readFromStorage(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    // Private browsing or blocked storage: we carry on without persisting.
    return '';
  }
}

export function getActiveAccount(): string {
  return activeAccount;
}

export function isActiveAccountCacheReady(): boolean {
  return cacheReady;
}

/**
 * The generated query keys do not include the account. The one place that can
 * see every account transition therefore owns cancellation and cache eviction.
 * Registration intentionally has no cleanup: the QueryClient lives for the
 * lifetime of the app, including while the invite route is outside
 * AccountProvider.
 */
export function registerActiveAccountCache(client: CacheClient): void {
  cacheClient = client;
}

function beginCacheTransition(): void {
  cacheReady = false;
  const currentTransition = ++transition;
  const cancellation = cacheClient?.cancelQueries();

  // cancelQueries aborts active requests synchronously before returning its
  // promise. Clear immediately after that call so no observer can reuse old
  // account data while cancellation finishes.
  cacheClient?.clear();

  void Promise.resolve(cancellation)
    .catch(() => undefined)
    .then(() => {
      if (currentTransition !== transition) return;
      cacheReady = true;
      for (const listener of listeners) listener();
    });
}

export function setActiveAccount(id: string, options?: { force?: boolean }): void {
  if (id === activeAccount && !options?.force) return;
  activeAccount = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // the same
  }
  beginCacheTransition();
  for (const listener of listeners) listener();
}

/** Reset the account boundary even when no account was selected. */
export function resetActiveAccount(): void {
  setActiveAccount('', { force: true });
}

export function subscribeToActiveAccount(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

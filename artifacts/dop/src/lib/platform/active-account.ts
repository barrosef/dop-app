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

export function setActiveAccount(id: string): void {
  if (id === activeAccount) return;
  activeAccount = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // the same
  }
  for (const listener of listeners) listener();
}

export function subscribeToActiveAccount(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

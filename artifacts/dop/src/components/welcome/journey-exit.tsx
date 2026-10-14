import { createContext, useContext, useRef, type ReactNode } from 'react';

import type { JourneyExit } from '@/lib/platform/welcome';

interface ExitStore {
  get: () => JourneyExit | null;
  set: (exit: JourneyExit | null) => void;
}

const JourneyExitContext = createContext<ExitStore | null>(null);

/**
 * The completion exit lives as long as the mounted welcome route — leaving it
 * (or a new identity, which remounts it by key) forgets the choice, so a later
 * visit to `/welcome/*` by an onboarded person goes to `/`.
 */
export function JourneyExitScope({ children }: { children: ReactNode }) {
  const ref = useRef<JourneyExit | null>(null);
  const store = useRef<ExitStore>({
    get: () => ref.current,
    set: (exit) => {
      ref.current = exit;
    },
  });
  return <JourneyExitContext.Provider value={store.current}>{children}</JourneyExitContext.Provider>;
}

export function useJourneyExit(): ExitStore {
  const store = useContext(JourneyExitContext);
  if (!store) throw new Error('useJourneyExit has to be inside a <JourneyExitScope>');
  return store;
}

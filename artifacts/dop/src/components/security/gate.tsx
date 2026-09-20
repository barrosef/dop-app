/**
 * The second factor's gate in the cockpit (ADR-0020 §5).
 *
 * It decides between three screens, and the decision is NOT its own: the core
 * answers `required`, `enrolled` and `stepped_up` in one call, precisely so the
 * three questions cannot be asked separately and disagree.
 *
 *   - stepped up, or nothing required and no factor → straight through;
 *   - has a factor and has not answered → the challenge;
 *   - the account requires one and there is no factor → set it up.
 *
 * While the state is loading it lets NOTHING through: a gate that renders the
 * cockpit for an instant before deciding is a gate that leaked.
 */
import React from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  getSecondFactorStateQueryKey,
  useSecondFactorState,
} from '@workspace/api-client-react';

import { SecondFactorSettings } from './second-factor-settings';
import { StepUp } from './step-up';
import { useAccount } from '../../lib/platform/account';
import { useI18n } from '../../lib/i18n';

export function SecondFactorGate({ children }: { children: React.ReactNode }) {
  const t = useI18n((s) => s.t);
  const { activeAccount, loading: accountLoading, error: accountError } = useAccount();
  const { data, isLoading, error, refetch } = useSecondFactorState({
    query: {
      queryKey: getSecondFactorStateQueryKey(),
      enabled: Boolean(activeAccount),
      retry: false,
    },
  });

  if (accountLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-xs text-muted-foreground">
        {t('auth.restoring')}
      </div>
    );
  }

  if (accountError) {
    return <p role="alert" className="p-6 text-sm text-destructive">{(accountError as Error).message}</p>;
  }

  // A failure reading the state does NOT block the cockpit. The gate that
  // matters is the core's — it refuses the sensitive operations on its own —
  // and locking everybody out because one query failed would turn a hiccup into
  // an outage.
  if (error || !data) return <>{children}</>;

  const active = (data.factors ?? []).filter((f) => f.status === 'active');

  if (data.needs_setup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p className="text-sm">{t('twofa.required.setup')}</p>
          </div>
          <SecondFactorSettings />
        </div>
      </div>
    );
  }

  if (active.length > 0 && !data.stepped_up) {
    return <StepUp factors={active} onVerified={() => void refetch()} />;
  }

  return <>{children}</>;
}

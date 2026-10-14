import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMeQueryKey,
  getOnboardingQueryKey,
  useOnboarding,
  useRecordStep,
} from '@workspace/api-client-react';

import { useAccount } from '@/lib/platform/account';
import { welcomePathFor } from '@/lib/platform/welcome';

/** The journey's state, read only once the personal account is active. */
export function useJourney() {
  const { activeAccount } = useAccount();
  return useOnboarding({
    query: { queryKey: getOnboardingQueryKey(), enabled: Boolean(activeAccount) },
  });
}

/**
 * Records a step and moves to wherever the API now says `current` is. The
 * refusal (a 412 for a required step) stays in `error` to be rendered.
 */
export function useWelcomeStep(step: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const recordStep = useRecordStep();
  const [pendingStatus, setPendingStatus] = useState<'done' | 'skipped' | null>(null);

  async function record(status: 'done' | 'skipped'): Promise<boolean> {
    setPendingStatus(status);
    try {
      const state = await recordStep.mutateAsync({ step, data: { status } });
      queryClient.setQueryData(getOnboardingQueryKey(), state);
      void queryClient.invalidateQueries({ queryKey: getOnboardingQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getMeQueryKey() });
      navigate(welcomePathFor(state.current));
      return true;
    } catch {
      return false;
    } finally {
      setPendingStatus(null);
    }
  }

  return {
    record,
    pendingStatus,
    error: recordStep.error,
    reset: recordStep.reset,
  };
}

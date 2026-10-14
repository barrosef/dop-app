/**
 * Copy lookups for the API's step keys. The keys and their order come from
 * `OnboardingState.steps`; this only finds words for them. A key the API adds
 * later still renders — as itself — instead of breaking.
 */
import type { useI18n } from '@/lib/i18n';

type T = ReturnType<typeof useI18n.getState>['t'];
type Key = Parameters<T>[0];

const LABELS: Record<string, Key> = {
  profile: 'welcome.step.profile',
  contact: 'welcome.step.contact',
  code: 'welcome.step.code',
  tasks: 'welcome.step.tasks',
  plan: 'welcome.step.plan',
  ready: 'welcome.step.ready',
};

export interface NarrativeKeys {
  what: Key;
  does: Key;
  skip?: Key;
}

/** Narrative copy per step. `skip` exists only where skipping has a cost to tell. */
const NARRATIVE: Record<string, NarrativeKeys> = {
  profile: { what: 'welcome.narrative.profile.what', does: 'welcome.narrative.profile.does' },
  contact: {
    what: 'welcome.narrative.contact.what',
    does: 'welcome.narrative.contact.does',
    skip: 'welcome.narrative.contact.skip',
  },
  code: { what: 'welcome.narrative.code.what', does: 'welcome.narrative.code.does' },
  tasks: {
    what: 'welcome.narrative.tasks.what',
    does: 'welcome.narrative.tasks.does',
    skip: 'welcome.narrative.tasks.skip',
  },
  plan: { what: 'welcome.narrative.plan.what', does: 'welcome.narrative.plan.does' },
  ready: { what: 'welcome.narrative.ready.what', does: 'welcome.narrative.ready.does' },
};

export function stepLabel(t: T, step: string): string {
  const key = LABELS[step];
  return key ? t(key) : step;
}

export function narrativeFor(step: string): NarrativeKeys | null {
  return NARRATIVE[step] ?? null;
}

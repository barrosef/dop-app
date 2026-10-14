/**
 * Pure helpers of the onboarding journey. None of them decides a step, an
 * order or whether something may be skipped — that is `OnboardingState`'s.
 */
import type { MeResponse, ProfilePatch } from '@workspace/api-client-react';

/** The route of one of the API's steps. An empty `current` means the end. */
export function welcomePathFor(current: string | null | undefined): string {
  const step = (current ?? '').trim();
  return `/welcome/${step ? encodeURIComponent(step) : 'ready'}`;
}

/**
 * Where the journey goes once `complete` has been accepted. Held by the
 * welcome route for its lifetime only (see `journey-exit.tsx`), never globally.
 */
export interface JourneyExit {
  path: string;
  state?: Record<string, unknown>;
}

/**
 * The exit as the welcome gate may use it: once onboarded, a `/welcome/*`
 * target would bounce off the gate forever, so it degrades to `/`.
 */
export function safeJourneyExit(exit: JourneyExit | null): JourneyExit {
  if (!exit || exit.path === '/welcome' || exit.path.startsWith('/welcome/')) return { path: '/' };
  return exit;
}

export interface ProfileDraft {
  name: string;
  locale: string;
  timezone: string;
  birthDate: string;
}

/** Only the fields that changed against what `/me` returned (spec §3.1). */
export function profilePatchFrom(me: MeResponse, draft: ProfileDraft): ProfilePatch {
  const patch: ProfilePatch = {};
  if (draft.name.trim() !== (me.name ?? '')) patch.name = draft.name.trim();
  if (draft.locale !== (me.locale ?? '')) patch.locale = draft.locale;
  if (draft.timezone !== (me.timezone ?? '')) patch.timezone = draft.timezone;
  if (draft.birthDate !== (me.birth_date ?? '')) patch.birth_date = draft.birthDate;
  return patch;
}

/** The account patch, only when handle or display name changed. */
export function accountPatchFrom(
  current: { handle: string; display_name: string },
  handle: string,
  displayName: string,
): { handle?: string; display_name?: string } | null {
  const patch: { handle?: string; display_name?: string } = {};
  if (handle.trim() && handle.trim() !== current.handle) patch.handle = handle.trim();
  if (displayName.trim() && displayName.trim() !== current.display_name) {
    patch.display_name = displayName.trim();
  }
  return Object.keys(patch).length ? patch : null;
}

/** UTF-8 safe base64 for `secret_base64`. */
export function toBase64(secret: string): string {
  const bytes = new TextEncoder().encode(secret);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/** Two letters for a provider mark (no logo files). */
export function providerInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return '';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  return (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase();
}

/** Resend delays that grow visibly: 30s, 60s, 120s, 240s, capped at 300s. */
export function resendDelaySeconds(sends: number): number {
  return Math.min(300, 30 * 2 ** Math.max(0, sends - 1));
}

/** The browser's language and time zone, for confirmation (never imposed). */
export function detectedLocale(): string {
  return typeof navigator !== 'undefined' && navigator.language ? navigator.language : '';
}
export function detectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}
export function supportedTimezones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    return intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

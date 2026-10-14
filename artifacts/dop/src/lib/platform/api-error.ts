/**
 * Reading what the BFF answered when it refused something.
 *
 * Pure helpers — no React, no i18n — so they can be tested in isolation. They
 * READ the API's answer; they never decide what a refusal means. The message,
 * the `detail` of a 412, the attempts left and the `Retry-After` are all the
 * server's words, rendered as they arrived.
 */

type ErrorRecord = Record<string, unknown>;

interface ApiErrorLike {
  message?: string;
  status?: number;
  data?: unknown;
  headers?: Headers;
  response?: { headers?: Headers };
}

function asRecord(value: unknown): ErrorRecord | null {
  return typeof value === 'object' && value !== null ? (value as ErrorRecord) : null;
}

/** The HTTP status of a failed generated-hook call, when there is one. */
export function apiErrorStatus(error: unknown): number | null {
  const status = (asRecord(error) as ApiErrorLike | null)?.status;
  return typeof status === 'number' ? status : null;
}

/** The `detail` string of the API's answer (a 412 names its reason there). */
export function apiErrorDetail(error: unknown): string | null {
  const data = asRecord((asRecord(error) as ApiErrorLike | null)?.data);
  const detail = data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const first = asRecord(detail[0]);
    if (typeof first?.msg === 'string') return first.msg;
  }
  return null;
}

/** The best human message the API gave, or `fallback` when it gave none. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const apiError = asRecord(error) as ApiErrorLike | null;
  const data = asRecord(apiError?.data);
  const detail = apiErrorDetail(error);
  if (detail) return detail;
  for (const candidate of [
    data?.message,
    data?.title,
    data?.error_description,
    data?.error,
    apiError?.message,
  ]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return fallback;
}

/** Attempts left on a wrong code, when the API says. */
export function remainingAttempts(error: unknown): number | null {
  const data = asRecord((asRecord(error) as ApiErrorLike | null)?.data);
  for (const value of [data?.remaining_attempts, data?.attempts_remaining]) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

/** Seconds to wait on a 429, from the body or the `Retry-After` header. */
export function retryAfterSeconds(error: unknown, now: number = Date.now()): number | null {
  const apiError = asRecord(error) as ApiErrorLike | null;
  if (apiError?.status !== 429) return null;

  const data = asRecord(apiError.data);
  for (const value of [data?.retry_after_seconds, data?.retry_after]) {
    const seconds = typeof value === 'string' ? Number(value) : value;
    if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds);
    }
  }

  const headers = apiError.response?.headers ?? apiError.headers;
  const value = headers?.get?.('retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;
  return Math.max(1, Math.ceil((retryAt - now) / 1000));
}

/**
 * Which of the API's own steps a refusal names — a structured `step` field
 * when the body carries one, otherwise the first listed step key that the
 * `detail` mentions. Only keys the API listed can come back.
 */
export function stepNamedInError(error: unknown, stepKeys: readonly string[]): string | null {
  const data = asRecord((asRecord(error) as ApiErrorLike | null)?.data);
  for (const candidate of [data?.step, data?.missing_step]) {
    if (typeof candidate === 'string' && stepKeys.includes(candidate)) return candidate;
  }
  const detail = apiErrorDetail(error);
  if (!detail) return null;
  const lower = detail.toLowerCase();
  for (const key of stepKeys) {
    if (new RegExp(`\\b${key.toLowerCase()}\\b`, 'u').test(lower)) return key;
  }
  return null;
}

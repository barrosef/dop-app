/**
 * Errors from the verification endpoint are not Firebase Auth errors.
 *
 * The generated client exposes HTTP failures with a `status` and an Error
 * message. Keeping this small boundary helper independent of the screen lets
 * both the screen and its regression tests preserve the distinction between a
 * backend rate limit and an arbitrary failure.
 */
export function verificationErrorStatus(failure: unknown): number | null {
  if (typeof failure !== 'object' || failure === null || !('status' in failure)) {
    return null;
  }

  const status = (failure as { status?: unknown }).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

export function isVerificationRateLimited(failure: unknown): boolean {
  if (verificationErrorStatus(failure) === 429) return true;

  if (typeof failure !== 'object' || failure === null || !('code' in failure)) {
    return false;
  }

  return (failure as { code?: unknown }).code === 'auth/too-many-requests';
}

function headerValue(failure: unknown, name: string): string | null {
  if (typeof failure !== 'object' || failure === null || !('headers' in failure)) {
    return null;
  }

  const headers = (failure as { headers?: unknown }).headers;
  if (!headers) return null;

  if (
    typeof headers === 'object' &&
    'get' in headers &&
    typeof (headers as { get?: unknown }).get === 'function'
  ) {
    const value = (headers as { get: (key: string) => unknown }).get(name);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  if (typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === name.toLowerCase() && typeof value === 'string') {
        return value.trim() || null;
      }
    }
  }

  return null;
}

/**
 * Parse Retry-After without inventing a cooldown. The header may be a number
 * of seconds or an HTTP date; an expired date has no useful timing to render.
 */
export function verificationRetryAfterSeconds(
  failure: unknown,
  now = Date.now(),
): number | null {
  const raw = headerValue(failure, 'retry-after');
  if (!raw) return null;

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return Math.max(0, Math.ceil(Number(raw)));
  }

  const retryAt = Date.parse(raw);
  if (Number.isNaN(retryAt)) return null;

  const seconds = Math.ceil((retryAt - now) / 1000);
  return seconds > 0 ? seconds : null;
}

/**
 * Prefer the API's structured detail over the generated ApiError prefix. The
 * returned text is server-authored detail, not a client-side success claim.
 */
export function verificationErrorDetail(failure: unknown): string | null {
  if (typeof failure !== 'object' || failure === null) {
    return failure instanceof Error && failure.message ? failure.message : null;
  }

  const data = (failure as { data?: unknown }).data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (typeof data === 'object' && data !== null) {
    for (const key of ['detail', 'message', 'error_description', 'error', 'title']) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }

  const message = (failure as { message?: unknown }).message;
  return typeof message === 'string' && message ? message : null;
}

/**
 * Return a useful, honest interpolation value for the existing generic auth
 * error copy. The generated ApiError message includes the status and server
 * detail; retaining it is more useful than pretending the failure was a
 * Firebase error.
 */
export function verificationErrorCode(failure: unknown): string {
  if (typeof failure === 'object' && failure !== null && 'code' in failure) {
    const code = (failure as { code?: unknown }).code;
    if (typeof code === 'string' && code) return code;
  }

  if (typeof failure === 'object' && failure !== null && 'message' in failure) {
    const message = (failure as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }

  if (failure instanceof Error && failure.message) return failure.message;

  const status = verificationErrorStatus(failure);
  if (status !== null) return `HTTP ${status}`;

  return 'unknown';
}
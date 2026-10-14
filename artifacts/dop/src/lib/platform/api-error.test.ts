import { describe, expect, it } from 'vitest';
import {
  apiErrorDetail, apiErrorMessage, apiErrorStatus, remainingAttempts,
  retryAfterSeconds, stepNamedInError,
} from './api-error';

describe('welcome backend errors', () => {
  it('keeps the server refusal detail instead of a generic transport message', () => {
    const error = { status: 412, message: 'Precondition failed', data: { detail: 'Missing plan step' } };
    expect(apiErrorStatus(error)).toBe(412);
    expect(apiErrorDetail(error)).toBe('Missing plan step');
    expect(apiErrorMessage(error, 'fallback')).toBe('Missing plan step');
    expect(stepNamedInError(error, ['profile', 'code', 'plan'])).toBe('plan');
  });
  it('links only a step present in the API-provided rail', () => {
    expect(stepNamedInError({ data: { missing_step: 'future' } }, ['plan'])).toBeNull();
    expect(stepNamedInError({ data: { step: 'code' } }, ['code'])).toBe('code');
    expect(stepNamedInError({ data: { detail: 'platform unavailable' } }, ['plan'])).toBeNull();
  });
  it('reads validation arrays and handles missing error bodies', () => {
    expect(apiErrorMessage({ data: { detail: [{ msg: 'Invalid phone' }] } }, 'fallback')).toBe('Invalid phone');
    expect(apiErrorMessage(null, 'fallback')).toBe('fallback');
    expect(remainingAttempts({ data: { remaining_attempts: 0 } })).toBe(0);
    expect(remainingAttempts({ data: { attempts_remaining: 2 } })).toBe(2);
    expect(remainingAttempts({})).toBeNull();
  });
  it('uses numeric, body and HTTP-date rate limit delays', () => {
    expect(retryAfterSeconds({ status: 429, data: { retry_after_seconds: '42' } })).toBe(42);
    expect(retryAfterSeconds({ status: 429, headers: new Headers({ 'Retry-After': '90' }) })).toBe(90);
    const now = Date.parse('2026-10-14T12:00:00Z');
    expect(retryAfterSeconds({
      status: 429, response: { headers: new Headers({ 'Retry-After': 'Wed, 14 Oct 2026 12:01:00 GMT' }) },
    }, now)).toBe(60);
    expect(retryAfterSeconds({ status: 500, headers: new Headers({ 'Retry-After': '90' }) })).toBeNull();
  });
});

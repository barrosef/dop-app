import { describe, expect, it } from 'vitest';

import {
  isVerificationRateLimited,
  verificationErrorCode,
  verificationErrorDetail,
  verificationRetryAfterSeconds,
} from './verification-errors';

describe('verification endpoint errors', () => {
  it('recognizes backend rate limiting as a rate limit', () => {
    expect(isVerificationRateLimited({ status: 429, message: 'Too many requests' })).toBe(true);
    expect(isVerificationRateLimited({ code: 'auth/too-many-requests' })).toBe(true);
  });

  it('keeps non-rate-limit backend detail visible to the caller', () => {
    const failure = {
      status: 503,
      message: 'HTTP 503 Service Unavailable: mail provider unavailable',
    };
    expect(verificationErrorCode(failure)).toBe(failure.message);
    expect(isVerificationRateLimited(failure)).toBe(false);
  });

  it('reads a numeric Retry-After header without guessing a delay', () => {
    expect(
      verificationRetryAfterSeconds(
        { headers: new Headers({ 'Retry-After': '17' }) },
        1_000,
      ),
    ).toBe(17);
    expect(
      verificationRetryAfterSeconds(
        { headers: { 'retry-after': 'not-a-duration' } },
        1_000,
      ),
    ).toBeNull();
  });

  it('reads an HTTP-date Retry-After header relative to the current time', () => {
    const now = Date.parse('Wed, 21 Oct 2015 07:28:00 GMT');
    expect(
      verificationRetryAfterSeconds(
        {
          headers: {
            'Retry-After': 'Wed, 21 Oct 2015 07:28:17 GMT',
          },
        },
        now,
      ),
    ).toBe(17);
    expect(
      verificationRetryAfterSeconds(
        {
          headers: {
            'Retry-After': 'Wed, 21 Oct 2015 07:27:59 GMT',
          },
        },
        now,
      ),
    ).toBeNull();
  });

  it('prefers the backend detail over an ApiError prefix', () => {
    expect(
      verificationErrorDetail({
        data: { detail: 'mail provider is cooling down' },
        message: 'HTTP 429 Too Many Requests: mail provider is cooling down',
      }),
    ).toBe('mail provider is cooling down');
  });

  it('does not invent a success code for an unknown failure', () => {
    expect(verificationErrorCode({})).toBe('unknown');
  });
});
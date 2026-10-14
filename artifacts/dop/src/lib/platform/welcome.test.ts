import { describe, expect, it } from 'vitest';
import type { MeResponse } from '@workspace/api-client-react';
import {
  accountPatchFrom, profilePatchFrom, providerInitials, resendDelaySeconds,
  toBase64, welcomePathFor, onboardingComplete,
} from './welcome';

const me: MeResponse = {
  subject: 'subject', user_id: 'user', account_id: 'personal', role: 'owner',
  email: 'person@example.test', name: 'Person', providers: ['google'],
  locale: 'pt-BR', timezone: 'America/Cuiaba', birth_date: '2000-01-01',
};
const draft = {
  name: me.name, locale: me.locale!, timezone: me.timezone!, birthDate: me.birth_date!,
};

describe('welcome presentation and request helpers', () => {
  it('does not bypass the journey when the optional profile flag is absent', () => {
    expect(onboardingComplete(undefined, false)).toBe(false);
    expect(onboardingComplete(undefined, undefined)).toBeUndefined();
    expect(onboardingComplete(undefined, true)).toBe(true);
  });
  it('honors explicit profile completion flags in both route gates', () => {
    expect(onboardingComplete(false, true)).toBe(false);
    expect(onboardingComplete(true, false)).toBe(true);
  });
  it('uses the API current step without imposing an order', () => {
    expect(welcomePathFor('code')).toBe('/welcome/code');
    expect(welcomePathFor('future-step')).toBe('/welcome/future-step');
    expect(welcomePathFor('')).toBe('/welcome/ready');
    expect(welcomePathFor('../code')).toBe('/welcome/..%2Fcode');
  });
  it('sends no unchanged profile fields', () => {
    expect(profilePatchFrom(me, draft)).toEqual({});
    expect(profilePatchFrom(me, { ...draft, name: ' New Name ' })).toEqual({ name: 'New Name' });
  });
  it('keeps explicit clearing of optional fields in the patch', () => {
    expect(profilePatchFrom(me, { ...draft, birthDate: '', locale: '', timezone: '' }))
      .toEqual({ birth_date: '', locale: '', timezone: '' });
  });
  it('only patches personal account values that changed', () => {
    const account = { handle: 'person', display_name: 'Person' };
    expect(accountPatchFrom(account, 'person', 'Person')).toBeNull();
    expect(accountPatchFrom(account, 'new-person', 'Person')).toEqual({ handle: 'new-person' });
  });
  it('encodes credential bytes as UTF-8 rather than Latin-1', () => {
    expect(toBase64('token-ação')).toBe(Buffer.from('token-ação').toString('base64'));
  });
  it('grows the visible resend delay and caps it', () => {
    expect([1, 2, 3, 4, 5, 20].map(resendDelaySeconds)).toEqual([30, 60, 120, 240, 300, 300]);
  });
  it('derives provider initials without logo assets', () => {
    expect(providerInitials(' Git Hub ')).toBe('GH');
    expect(providerInitials('GitHub')).toBe('GI');
    expect(providerInitials('')).toBe('');
  });
});

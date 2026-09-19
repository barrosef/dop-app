import { describe, expect, it } from 'vitest';
import { profileInitials } from './profile-initials';

describe('profile initials', () => {
  it('prefers the name and uses first and last words', () => {
    expect(profileInitials('  Ana Maria Silva ', 'other@example.com')).toBe('AS');
    expect(profileInitials('Érica')).toBe('É');
  });
  it('falls back to the email local part, then a neutral empty fallback', () => {
    expect(profileInitials(' ', 'ana.silva@example.com')).toBe('AS');
    expect(profileInitials(null, 'ana@example.com')).toBe('A');
    expect(profileInitials(null, null)).toBe('');
  });
});
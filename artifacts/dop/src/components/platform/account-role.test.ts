import { describe, expect, it } from 'vitest';

import { accountRoleTranslationKey } from './account-role';

describe('accountRoleTranslationKey', () => {
  it('maps every API role to its existing translated label', () => {
    expect(accountRoleTranslationKey('owner')).toBe('account.role.owner');
    expect(accountRoleTranslationKey('admin')).toBe('account.role.admin');
    expect(accountRoleTranslationKey('developer')).toBe('account.role.developer');
    expect(accountRoleTranslationKey('viewer')).toBe('account.role.viewer');
  });

  it('omits empty and unknown roles instead of exposing a raw key', () => {
    expect(accountRoleTranslationKey('')).toBeNull();
    expect(accountRoleTranslationKey('auditor')).toBeNull();
    expect(accountRoleTranslationKey(undefined)).toBeNull();
  });
});
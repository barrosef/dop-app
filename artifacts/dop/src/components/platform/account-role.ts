/**
 * Account roles are labels supplied by the API, not a permissions model.
 *
 * Keeping the finite translation map here means an unexpected API value is
 * omitted instead of becoming a raw i18n key in the account selector.
 */
export type AccountRoleTranslationKey =
  | 'account.role.owner'
  | 'account.role.admin'
  | 'account.role.developer'
  | 'account.role.viewer';

const accountRoleTranslationKeys: Record<string, AccountRoleTranslationKey> = {
  owner: 'account.role.owner',
  admin: 'account.role.admin',
  developer: 'account.role.developer',
  viewer: 'account.role.viewer',
};

export function accountRoleTranslationKey(
  role: string | null | undefined,
): AccountRoleTranslationKey | null {
  if (!role) return null;
  return accountRoleTranslationKeys[role] ?? null;
}
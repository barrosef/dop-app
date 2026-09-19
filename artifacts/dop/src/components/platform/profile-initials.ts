/** Initials are presentation only, never an identity or permission check. */
export function profileInitials(name?: string | null, email?: string | null): string {
  const words = (name?.trim() || email?.split('@')[0]?.trim() || '')
    .split(/[\s._-]+/u)
    .filter(Boolean);
  if (!words.length) return '';
  return (Array.from(words[0])[0] + (words.length > 1 ? Array.from(words.at(-1)!)[0] : ''))
    .toLocaleUpperCase();
}
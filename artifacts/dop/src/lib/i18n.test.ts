import { beforeAll, describe, expect, it, vi } from 'vitest';

describe('translations', () => {
  beforeAll(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
  });
  it('keeps Portuguese and English keys and interpolation parameters in parity', async () => {
    const { dictionaries } = await import('./i18n');
    const pt = dictionaries['pt-BR'];
    const en = dictionaries.en;
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(pt) as (keyof typeof pt)[]) {
      expect(pt[key].trim()).not.toBe('');
      expect(en[key].trim()).not.toBe('');
      expect(pt[key].match(/\{\w+\}/g)?.sort() ?? []).toEqual(en[key].match(/\{\w+\}/g)?.sort() ?? []);
    }
  });
});
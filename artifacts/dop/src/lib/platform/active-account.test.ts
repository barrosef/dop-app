import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getActiveAccount,
  isActiveAccountCacheReady,
  registerActiveAccountCache,
  setActiveAccount,
} from './active-account';

describe('active account cache boundary', () => {
  const cache = {
    cancelQueries: vi.fn(() => Promise.resolve()),
    clear: vi.fn(),
  };

  afterEach(() => {
    setActiveAccount('', { force: true });
    cache.cancelQueries.mockClear();
    cache.clear.mockClear();
  });

  it('cancels and clears before publishing a changed account', async () => {
    registerActiveAccountCache(cache);

    setActiveAccount('account-a', { force: true });

    expect(cache.cancelQueries).toHaveBeenCalledTimes(1);
    expect(cache.clear).toHaveBeenCalledTimes(1);
    expect(getActiveAccount()).toBe('account-a');
    expect(isActiveAccountCacheReady()).toBe(false);

    await vi.waitFor(() => expect(isActiveAccountCacheReady()).toBe(true));
  });

  it('forces the boundary when membership changes without changing account id', () => {
    registerActiveAccountCache(cache);
    setActiveAccount('account-a', { force: true });
    cache.cancelQueries.mockClear();
    cache.clear.mockClear();

    setActiveAccount('account-a', { force: true });

    expect(cache.cancelQueries).toHaveBeenCalledTimes(1);
    expect(cache.clear).toHaveBeenCalledTimes(1);
  });
});
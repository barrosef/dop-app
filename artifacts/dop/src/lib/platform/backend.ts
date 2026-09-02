/**
 * It wires the generated client (orval) to the real BFF.
 *
 * Imported once in `main.tsx`, before any request. Three adjustments, and none
 * of them is a business decision:
 *
 *  1. **The base**: the generated routes are absolute (`/api/v1/...`); the BFF's
 *     origin comes from the environment.
 *  2. **The token**: `Authorization: Bearer <the Firebase ID token>`.
 *  3. **The active account**: `x-account-id`, read from the store on EVERY
 *     request — switching account does not reload the page, and a frozen header
 *     would return another account's data with no error at all.
 */
import {
  setAuthTokenGetter,
  setBaseUrl,
  setHeadersProvider,
} from '@workspace/api-client-react';

import { API_BASE_URL } from './config';
import { getActiveAccount } from './active-account';
import { currentIdToken } from './firebase';

setBaseUrl(API_BASE_URL);
setAuthTokenGetter(currentIdToken);
setHeadersProvider((): Record<string, string> => {
  const account = getActiveAccount();
  return account ? { 'x-account-id': account } : {};
});

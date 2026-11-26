/**
 * @file queryClientWrapper.tsx
 * @description Helper for testing TanStack Query hooks.
 *
 * Every QueryClient created here is tracked, and a root-level `afterEach`
 * registered when this module is imported unmounts the rendered components
 * then clears each tracked client. Without it, the unmount (RTL auto-cleanup,
 * which runs after a test file's own `afterEach(() => jest.useRealTimers())`)
 * makes TanStack arm one real garbage-collection timer per query (gcTime is
 * 5 min by default, 10 min in usePOIQuery), which keeps the Jest process alive
 * ("Jest did not exit one second after the test run has completed").
 * `clear()` destroys every query and cancels those timers.
 *
 * Constraints:
 * - Import this module at the top level of a test file (or from a `jest.mock` factory that
 *   runs while the file's top-level imports load), never for the first time inside a test
 *   (`it`, `jest.isolateModules` or `jest.resetModules` run in a test): Jest throws "Hooks
 *   cannot be defined inside tests" on the `afterEach` registered at import.
 * - Create one client per test: a client created once for the whole file is only tracked
 *   until the first `afterEach`.
 *
 * @module test-utils/queryClientWrapper
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup } from '@testing-library/react-native';
import React from 'react';

/** QueryClients created since the last cleanup, cleared after each test. */
const trackedClients: QueryClient[] = [];

/**
 * Unmounts the rendered components, then clears every tracked QueryClient.
 *
 * The order matters: clearing first would let the unmount re-arm a GC timer
 * on queries that are still observed. `cleanup()` is idempotent, so the RTL
 * auto-cleanup that runs afterwards has nothing left to do.
 */
export const clearTrackedQueryClients = (): void => {
  cleanup();
  for (const client of trackedClients) {
    client.clear();
  }
  trackedClients.length = 0;
};

afterEach(clearTrackedQueryClients);

/**
 * Creates a test QueryClient (retry disabled), tracked so that it is cleared
 * after each test.
 *
 * @returns Test-configured QueryClient
 */
export const createTestQueryClient = (): QueryClient => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  trackedClients.push(client);
  return client;
};

/**
 * React wrapper for TanStack Query hook tests.
 *
 * @returns Wrapper with QueryClientProvider around a tracked test QueryClient
 */
export const createQueryClientWrapper = () => {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

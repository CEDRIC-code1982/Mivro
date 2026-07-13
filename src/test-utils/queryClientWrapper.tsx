/**
 * @file queryClientWrapper.tsx
 * @description Helper pour tester les hooks TanStack Query.
 *              Helper for testing TanStack Query hooks.
 *
 * @module test-utils/queryClientWrapper
 */

// [ADDED] Helper QueryClient pour tests TanStack Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

/**
 * Crée un QueryClient de test (retry désactivé).
 * Creates a test QueryClient (retry disabled).
 *
 * @returns QueryClient configuré pour les tests / Test-configured QueryClient
 */
export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

/**
 * Wrapper React pour les tests de hooks TanStack Query.
 * React wrapper for TanStack Query hook tests.
 *
 * @param children - Composants enfants / Child components
 * @returns Wrapper avec QueryClientProvider / Wrapper with QueryClientProvider
 */
export const createQueryClientWrapper = () => {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

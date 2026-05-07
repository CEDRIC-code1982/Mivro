/**
 * @file queryClient.ts
 * @description QueryClient TanStack Query, configuré avec les defaults Mivro.
 *              TanStack Query QueryClient, configured with Mivro defaults.
 *
 *              Defaults : staleTime 1min, gcTime 5min, retry 2x queries / 1x mutations.
 *
 * @module di/queryClient
 */

// [ADDED] QueryClient factory avec defaults Mivro
import { QueryClient } from '@tanstack/react-query';

/**
 * Crée un QueryClient avec la configuration par défaut Mivro.
 * Creates a QueryClient with Mivro default configuration.
 *
 * @returns QueryClient configuré / Configured QueryClient
 */
export const createQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000, // 1 min par défaut / 1 min default
        gcTime: 5 * 60_000, // 5 min en cache / 5 min cache
        retry: 2,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
};

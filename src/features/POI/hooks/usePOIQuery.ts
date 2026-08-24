/**
 * Hook TanStack Query pour la recherche de POI autour d'un midpoint.
 * TanStack Query hook for POI search around a midpoint.
 *
 * - Cache 5 min (POI statiques, OSM ne bouge pas vite)
 * - Retry 2x (sauf rate_limited / invalid_input / parse_error)
 * - enabled si midpoint + radius + categories.length >= 1
 * - placeholderData pour transition fluide
 *
 * @file usePOIQuery.ts
 * @module features/POI/hooks/usePOIQuery
 *
 * @example
 *   const { data, isLoading, error } = usePOIQuery({
 *     center: midpoint,
 *     radiusMeters: 5000,
 *     categories: ['restaurant', 'cafe'],
 *   });
 */

// [ADDED] Hook usePOIQuery
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Coordinates } from '@entities/Location';
import type { POICategory } from '@entities/POICategory';
import type { PointOfInterest } from '@entities/PointOfInterest';
import { POIError } from '@services/domain/poi/IPOIService';
import { getContainer } from '@services/serviceContainer';

/**
 * Paramètres d'entrée du hook usePOIQuery.
 * Input parameters for the usePOIQuery hook.
 *
 * @param center — Coordonnées du midpoint (null si pas encore calculé)
 * @param radiusMeters — Rayon de recherche en mètres (null si pas encore calculé)
 * @param categories — Catégories à rechercher
 * @param language — Langue préférée pour les noms
 * @param enabled — Contrôle externe pour activer/désactiver le fetch
 */
export interface UsePOIQueryInput {
  /** Centre de recherche (null si pas encore calculé) / Search center */
  center: Coordinates | null;
  /** Rayon en mètres (null si pas encore calculé) / Radius in meters */
  radiusMeters: number | null;
  /** Catégories à rechercher / Categories to search */
  categories: readonly POICategory[];
  /** Langue préférée / Preferred language */
  language?: string;
  /** Contrôle externe d'activation / External enable control */
  enabled?: boolean;
}

/**
 * Hook TanStack Query pour la recherche de POI.
 * TanStack Query hook for POI search.
 *
 * @param input — Paramètres de recherche
 * @returns Résultat TanStack Query avec data, isLoading, error
 */
export const usePOIQuery = (
  input: UsePOIQueryInput,
): UseQueryResult<PointOfInterest[], POIError> => {
  const { center, radiusMeters, categories, language, enabled: externalEnabled } = input;

  const isReady =
    center !== null && radiusMeters !== null && radiusMeters > 0 && categories.length > 0;

  return useQuery<PointOfInterest[], POIError>({
    queryKey: ['poi', center, radiusMeters, [...categories].sort(), language],
    queryFn: async ({ signal }) => {
      if (!center || !radiusMeters) {
        throw new POIError('Missing center or radius', 'invalid_input');
      }
      const { searchPOIUseCase } = getContainer();
      return searchPOIUseCase.execute({
        center,
        radiusMeters,
        categories,
        options: {
          ...(language !== undefined ? { language } : {}),
          signal,
        },
      });
    },
    enabled: isReady && (externalEnabled ?? true),
    staleTime: 5 * 60_000, // 5 min
    gcTime: 10 * 60_000, // 10 min
    retry: (failureCount, error) => {
      // [ADDED] Pas de retry sur ces cas / No retry for these cases
      if (error instanceof POIError) {
        if (error.code === 'rate_limited') return false;
        if (error.code === 'invalid_input') return false;
        if (error.code === 'parse_error') return false;
      }
      return failureCount < 2;
    },
    placeholderData: (previousData) => previousData,
  });
};

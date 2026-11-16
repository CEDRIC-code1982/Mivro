/**
 * TanStack Query hook for POI search around a midpoint.
 *
 * - 5 min cache (static POIs, OSM does not change quickly)
 * - Retry 2x (except rate_limited / invalid_input / parse_error / query_timeout)
 * - Enabled when midpoint + radius + categories.length >= 1
 * - placeholderData for a smooth transition
 * - Search radius capped at {@link MAX_POI_SEARCH_RADIUS_M}: the zone radius of very distant
 *   participants (e.g. Paris + Tokyo, ~4,900 km) was rejected by SearchPOIUseCase above 100 km
 *   (`invalid_input`), and made Overpass time out between 25 and 100 km
 * - Search radius floored at {@link MIN_POI_SEARCH_RADIUS_M}: the zone radius of participants
 *   less than ~200 m apart was rejected by SearchPOIUseCase below 100 m (`invalid_input`), and a
 *   100 m search would only return a handful of places
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

// [ADDED] usePOIQuery hook
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Coordinates } from '@entities/Location';
import type { POICategory } from '@entities/POICategory';
import type { PointOfInterest } from '@entities/PointOfInterest';
import { POIError } from '@services/domain/poi/IPOIService';
import { getContainer } from '@services/serviceContainer';

/**
 * Maximum POI search radius in meters. Only the POI search is capped: the zone radius (map
 * circle, sharing) is left unchanged.
 */
export const MAX_POI_SEARCH_RADIUS_M = 25_000; // [ADDED] "POI rayon géant" fix

/**
 * Minimum POI search radius in meters (~6 min walk). Only the POI search is floored: the zone
 * radius (map circle, sharing) is left unchanged.
 */
export const MIN_POI_SEARCH_RADIUS_M = 500; // [ADDED] "POI rayon minuscule" fix

/**
 * Input parameters for the usePOIQuery hook.
 *
 * @param center — Midpoint coordinates (null when not computed yet)
 * @param radiusMeters — Search radius in meters (null when not computed yet), clamped between
 *   {@link MIN_POI_SEARCH_RADIUS_M} and {@link MAX_POI_SEARCH_RADIUS_M}
 * @param categories — Categories to search
 * @param language — Preferred language for names
 * @param enabled — External control to enable/disable the fetch
 */
export interface UsePOIQueryInput {
  /** Search center (null when not computed yet) */
  center: Coordinates | null;
  /** Radius in meters (null when not computed yet) */
  radiusMeters: number | null;
  /** Categories to search */
  categories: readonly POICategory[];
  /** Preferred language */
  language?: string;
  /** External enable control */
  enabled?: boolean;
}

/**
 * TanStack Query hook for POI search.
 *
 * @param input — Search parameters
 * @returns TanStack Query result with data, isLoading, error
 */
export const usePOIQuery = (
  input: UsePOIQueryInput,
): UseQueryResult<PointOfInterest[], POIError> => {
  const { center, radiusMeters, categories, language, enabled: externalEnabled } = input;

  const isReady =
    center !== null && radiusMeters !== null && radiusMeters > 0 && categories.length > 0;

  // [FIXED] Clamp the search radius between the floor and the cap; the clamped value is also the
  // cache key, so every zone narrower than the floor (or wider than the cap) shares the same cache
  // entry for a given center
  const searchRadius =
    radiusMeters === null
      ? null
      : Math.min(Math.max(radiusMeters, MIN_POI_SEARCH_RADIUS_M), MAX_POI_SEARCH_RADIUS_M);

  return useQuery<PointOfInterest[], POIError>({
    queryKey: ['poi', center, searchRadius, [...categories].sort(), language],
    queryFn: async ({ signal }) => {
      if (!center || !searchRadius) {
        throw new POIError('Missing center or radius', 'invalid_input');
      }
      const { searchPOIUseCase } = getContainer();
      return searchPOIUseCase.execute({
        center,
        radiusMeters: searchRadius,
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
      // [ADDED] No retry for these cases
      if (error instanceof POIError) {
        if (error.code === 'rate_limited') return false;
        if (error.code === 'invalid_input') return false;
        if (error.code === 'parse_error') return false;
        // [FIXED] A query that timed out would time out again: retrying only stretches the
        // loading state (up to ~75 s with 2 retries)
        if (error.code === 'query_timeout') return false;
      }
      return failureCount < 2;
    },
    placeholderData: (previousData) => previousData,
  });
};

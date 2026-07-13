/**
 * @file useGeocodeQuery.ts
 * @description Hook TanStack Query pour la recherche d'adresse.
 *              TanStack Query hook for address search.
 *
 *              - Debouncing 400ms intégré / Built-in 400ms debouncing
 *              - Cache 1 min / 1 min cache
 *              - Retry 2x (sauf 429 / invalid_query / parse_error)
 *              - enabled si query.length >= 3 après debounce
 *              - placeholderData pour autocomplete fluide / for smooth autocomplete
 *
 * @module presentation/hooks/useGeocodeQuery
 *
 * @example
 *   const { data, isLoading, error } = useGeocodeQuery({
 *     query: 'Tour Eiffel',
 *     options: { language: 'fr' },
 *   });
 */

// [ADDED] Hook useGeocodeQuery
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { GeocodeResult } from '@entities/GeocodeResult';
import { useDebounce } from '@hooks/useDebounce';
import type { SearchAddressOptions } from '@services/domain/geocode/IGeocodeService';
import { GeocodeError } from '@services/domain/geocode/IGeocodeService';
import { getContainer } from '@services/serviceContainer';

/**
 * Paramètres d'entrée du hook useGeocodeQuery.
 * Input parameters for the useGeocodeQuery hook.
 *
 * @param query - Texte de recherche brut (sera trimmé et debouncé) / Raw search text
 * @param options - Options de recherche (sans signal, géré par TanStack Query) / Search options
 * @param debounceMs - Délai de debouncing en ms (défaut 400ms) / Debounce delay
 * @param minLength - Longueur minimum après debounce (défaut 3) / Minimum length after debounce
 */
export interface UseGeocodeQueryInput {
  /** Texte de recherche brut / Raw search text */
  query: string;
  /** Options de recherche (sans signal) / Search options (without signal) */
  options?: Omit<SearchAddressOptions, 'signal'>;
  /** Délai de debouncing en ms (défaut 400ms) / Debounce delay in ms (default 400ms) */
  debounceMs?: number;
  /** Longueur minimum après debounce pour déclencher la requête (défaut 3) / Min length */
  minLength?: number;
}

/**
 * Hook TanStack Query pour la recherche d'adresse via Nominatim.
 * TanStack Query hook for address search via Nominatim.
 *
 * @param input - Paramètres de recherche / Search parameters
 * @returns Résultat TanStack Query / TanStack Query result
 */
export const useGeocodeQuery = (
  input: UseGeocodeQueryInput,
): UseQueryResult<GeocodeResult[], GeocodeError> => {
  const { query, options, debounceMs = 400, minLength = 3 } = input;
  const debouncedQuery = useDebounce(query.trim(), debounceMs);

  return useQuery<GeocodeResult[], GeocodeError>({
    queryKey: ['geocode', debouncedQuery, options],
    queryFn: async ({ signal }) => {
      const { searchAddressUseCase } = getContainer();
      return searchAddressUseCase.execute({
        query: debouncedQuery,
        options: { ...options, signal },
      });
    },
    enabled: debouncedQuery.length >= minLength,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      // [ADDED] Pas de retry sur ces cas / No retry for these cases
      if (error instanceof GeocodeError) {
        if (error.code === 'rate_limited') return false;
        if (error.code === 'invalid_query') return false;
        if (error.code === 'parse_error') return false;
      }
      return failureCount < 2;
    },
    placeholderData: (previousData) => previousData,
  });
};

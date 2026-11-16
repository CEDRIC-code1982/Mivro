/**
 * @file poiErrorKey.ts
 * @description Maps a POI search error to its i18n message key (poi namespace). Shared by the
 *              list view and the map view, so both show the same message for the same error.
 *
 * @module features/POI/utils/poiErrorKey
 */

import { POIError } from '@services/domain/poi/IPOIService';

/**
 * Maps a POI search error to a dedicated i18n message key (poi namespace).
 *
 * [FIXED] "POI rayon géant": the error state used to show the raw technical message
 * (`error.message`, in English) under a generic title. `invalid_input` has no dedicated
 * message: it comes from inputs the user cannot fix (missing center or radius, or a radius
 * outside the bounds of SearchPOIUseCase — no longer produced by the app since the search radius
 * is clamped between 500 m and 25 km in usePOIQuery).
 *
 * @param error — Error surfaced by usePOIQuery
 * @returns i18n key (poi namespace)
 */
export const poiErrorKey = (error: Error): string => {
  if (error instanceof POIError) {
    switch (error.code) {
      case 'rate_limited':
        return 'errors.rate_limited';
      case 'network':
        return 'errors.network';
      case 'server_error':
        return 'errors.server_error';
      case 'query_timeout':
        return 'errors.query_timeout';
      case 'parse_error':
        return 'errors.parse_error';
      default:
        return 'errors.unknown';
    }
  }
  return 'errors.unknown';
};

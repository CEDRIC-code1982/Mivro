/**
 * @file IGeocodeService.ts
 * @description Port abstrait pour la résolution adresse → coordonnées.
 *              Abstract port for address → coordinates resolution.
 *
 *              Permet de swapper Nominatim pour Google Geocoding, Mapbox, etc.
 *              sans toucher au code métier.
 *              Allows swapping Nominatim for Google Geocoding, Mapbox, etc.
 *              without touching business logic.
 *
 * @module core/ports/IGeocodeService
 */

// [ADDED] Port IGeocodeService + GeocodeError + types
import type { GeocodeResult } from '@core/entities/GeocodeResult';
import type { Coordinates } from '@core/entities/Location'; // [ADDED]

/**
 * Options de recherche d'adresse.
 * Address search options.
 *
 * @param limit - Limite de résultats (défaut 5, max 10) / Result limit (default 5, max 10)
 * @param countryCode - Code pays ISO 3166-1 alpha-2 (ex: 'fr') / Country code filter
 * @param language - Langue préférée pour les résultats (ex: 'fr', 'en') / Preferred language
 * @param signal - Signal pour annuler la requête (utile avec debouncing) / Abort signal
 */
export interface SearchAddressOptions {
  /** Limite de résultats (défaut 5, max 10) / Result limit (default 5, max 10) */
  limit?: number;
  /** Code pays ISO 3166-1 alpha-2 pour filtrer (ex: 'fr') / Country code filter */
  countryCode?: string;
  /** Langue préférée pour les résultats (ex: 'fr', 'en') / Preferred language */
  language?: string;
  /** Signal pour annuler la requête (utile avec debouncing) / Abort signal */
  signal?: AbortSignal;
}

/**
 * Port abstrait pour le service de géocodage.
 * Abstract port for geocoding service.
 *
 * Implémentations : NominatimGeocodeService (infrastructure/).
 * Implementations: NominatimGeocodeService (infrastructure/).
 *
 * @example
 *   const results = await geocodeService.search('Tour Eiffel', { language: 'fr' });
 */
export interface IGeocodeService {
  /**
   * Recherche des lieux correspondant à la requête textuelle.
   * Searches for places matching the text query.
   *
   * @param query - Texte de recherche (min 3 caractères) / Search text (min 3 chars)
   * @param options - Paramètres optionnels / Optional parameters
   * @returns Liste de résultats triés par pertinence / Results sorted by relevance
   * @throws GeocodeError pour erreur métier identifiée / for identified business error
   * @throws Error pour erreur inattendue / for unexpected error
   */
  search(query: string, options?: SearchAddressOptions): Promise<GeocodeResult[]>;

  /**
   * Reverse geocoding : coordonnées → adresse formatée.
   * Reverse geocoding: coordinates → formatted address.
   *
   * @param coordinates - Coordonnées GPS / GPS coordinates
   * @param options - Options de reverse geocoding / Reverse geocoding options
   * @returns Résultat ou null si aucun résultat / Result or null if no result
   * @throws GeocodeError pour erreur métier identifiée / for identified business error
   */
  reverseGeocode(
    coordinates: Coordinates,
    options?: ReverseGeocodeOptions,
  ): Promise<GeocodeResult | null>; // [ADDED]
}

/**
 * Options de reverse geocoding.
 * Reverse geocoding options.
 *
 * @param language - Langue préférée (ex: 'fr', 'en') / Preferred language
 * @param zoom - Niveau de zoom 0-18 (ville=10, rue=18, défaut 18) / Zoom level
 * @param signal - Signal d'annulation / Abort signal
 */
export interface ReverseGeocodeOptions {
  /** Langue préférée (ex: 'fr', 'en') / Preferred language */
  language?: string;
  /** Niveau de zoom 0-18 (ville=10, rue=18, défaut 18) / Zoom level 0-18 */
  zoom?: number;
  /** Signal d'annulation / Abort signal */
  signal?: AbortSignal;
}

/**
 * Codes d'erreur métier pour le géocodage.
 * Business error codes for geocoding.
 *
 * - rate_limited : HTTP 429, le provider limite les requêtes
 * - network : pas de connexion / DNS / timeout
 * - invalid_query : query trop courte ou vide
 * - parse_error : réponse provider non conforme au schéma Zod
 * - server_error : HTTP 5xx du provider
 * - no_results : aucun résultat (notamment reverse geocoding)
 */
export type GeocodeErrorCode =
  | 'rate_limited'
  | 'network'
  | 'invalid_query'
  | 'parse_error'
  | 'server_error'
  | 'no_results'; // [ADDED]

/**
 * Erreur métier de géocodage avec code typé.
 * Typed geocoding business error.
 *
 * @param message - Message d'erreur lisible / Human-readable error message
 * @param code - Code d'erreur typé / Typed error code
 * @param cause - Erreur originale (optionnel) / Original error (optional)
 */
export class GeocodeError extends Error {
  constructor(
    message: string,
    public readonly code: GeocodeErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GeocodeError';
  }
}

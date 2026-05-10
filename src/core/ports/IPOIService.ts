/**
 * Port abstrait pour la recherche de POI autour d'un point.
 * Permet de swapper Overpass pour Google Places, Foursquare, etc.
 * sans toucher au code métier.
 *
 * Abstract port for searching POI around a point.
 * Allows swapping Overpass for Google Places, Foursquare, etc.
 * without touching business logic.
 *
 * @file IPOIService.ts
 * @module core/ports/IPOIService
 */

// [ADDED] Port IPOIService — interface + types POI search

import type { Coordinates } from '@core/entities/Location';
import type { POICategory } from '@core/entities/POICategory';
import type { PointOfInterest } from '@core/entities/PointOfInterest';

/**
 * Options de recherche de POI.
 * POI search options.
 *
 * @param limitPerCategory — Limite de résultats par catégorie (défaut 50, max 200)
 * @param language — Langue préférée pour les noms (ex: 'fr', 'en')
 * @param signal — Signal d'annulation (utile avec debouncing)
 */
export interface SearchNearbyOptions {
  /** Limite de résultats par catégorie (défaut 50, max 200) / Limit per category */
  limitPerCategory?: number;
  /** Langue préférée pour les noms (ex: 'fr', 'en') / Preferred language for names */
  language?: string;
  /** Signal d'annulation (utile avec debouncing) / Cancellation signal */
  signal?: AbortSignal;
}

/**
 * Interface du service de recherche de POI.
 * POI search service interface.
 */
export interface IPOIService {
  /**
   * Recherche les POI autour d'un point central dans un rayon donné.
   * Searches for POI around a central point within a given radius.
   *
   * @param center — Coordonnées du centre de recherche (midpoint)
   * @param radiusMeters — Rayon de recherche en mètres
   * @param categories — Catégories à inclure (au moins 1)
   * @param options — Paramètres optionnels
   * @returns Liste de POI
   * @throws POIError pour erreur métier identifiée
   */
  searchNearby(
    center: Coordinates,
    radiusMeters: number,
    categories: readonly POICategory[],
    options?: SearchNearbyOptions,
  ): Promise<PointOfInterest[]>;
}

/**
 * Codes d'erreur typés pour le service POI.
 * Typed error codes for the POI service.
 */
export type POIErrorCode =
  | 'rate_limited' // HTTP 429 ou retry-after
  | 'network' // Pas de connexion / DNS / timeout
  | 'invalid_input' // radius ≤ 0, categories vide, etc.
  | 'parse_error' // Réponse Overpass non conforme
  | 'server_error' // HTTP 5xx
  | 'query_timeout'; // Overpass [timeout] dépassé

/**
 * Erreur métier pour le service POI.
 * Business error for the POI service.
 *
 * @param message — Message d'erreur lisible
 * @param code — Code d'erreur typé
 * @param cause — Erreur sous-jacente éventuelle
 */
export class POIError extends Error {
  constructor(
    message: string,
    public readonly code: POIErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'POIError';
  }
}

/**
 * @file GetCurrentLocationUseCase.ts
 * @description Orchestrateur pour récupérer la position GPS courante
 *              ENRICHIE avec une adresse formatée (reverse geocoding).
 *              Orchestrator for getting the current GPS position
 *              ENRICHED with a formatted address (reverse geocoding).
 *
 *              Stratégie / Strategy:
 *              1. Récupère coordinates via IGeolocationService
 *              2. Tente un reverse geocode via IGeocodeService
 *              3. Si reverse échoue : renvoie quand même la Location
 *                 avec coordinates valides + displayName fallback
 *
 *              Génère un ID unique (uuid) pour la Location créée.
 *              Generates a unique ID (uuid) for the created Location.
 *
 * @example
 *   const useCase = new GetCurrentLocationUseCase(geoService, geocodeService);
 *   const location = await useCase.execute({ language: 'fr' });
 *
 * @module core/usecases/GetCurrentLocationUseCase
 */

// [ADDED] Use case GetCurrentLocationUseCase
import { v4 as uuidv4 } from 'uuid';
import type { Location } from '@core/entities/Location';
import type { IGeocodeService } from '@core/ports/IGeocodeService';
import type { IGeolocationService } from '@core/ports/IGeolocationService';

/**
 * Paramètres d'entrée pour la récupération de position.
 * Input parameters for position retrieval.
 *
 * @param language - Langue préférée pour le reverse geocoding (défaut 'fr') / Preferred language
 * @param accuracyMeters - Précision GPS maximale en mètres (défaut 100) / Max GPS accuracy
 * @param timeoutMs - Timeout GPS en ms (défaut 10000) / GPS timeout in ms
 */
export interface GetCurrentLocationInput {
  /** Langue préférée pour le reverse geocoding (défaut: 'fr') / Preferred language */
  language?: string;
  /** Précision GPS maximale en mètres (défaut 100) / Max GPS accuracy in meters */
  accuracyMeters?: number;
  /** Timeout GPS en ms (défaut 10000) / GPS timeout in ms */
  timeoutMs?: number;
}

/**
 * Use case : récupérer la position GPS courante enrichie d'une adresse.
 * Use case: get current GPS position enriched with an address.
 *
 * @param geolocationService - Service GPS injecté / Injected GPS service
 * @param geocodeService - Service de géocodage injecté / Injected geocoding service
 */
export class GetCurrentLocationUseCase {
  constructor(
    private readonly geolocationService: IGeolocationService,
    private readonly geocodeService: IGeocodeService,
  ) {}

  /**
   * Exécute la récupération de position enrichie.
   * Executes enriched position retrieval.
   *
   * @param input - Paramètres optionnels / Optional parameters
   * @returns Location complète (coords + adresse) / Complete Location (coords + address)
   * @throws GeolocationError si le GPS échoue / if GPS fails
   */
  async execute(input: GetCurrentLocationInput = {}): Promise<Location> {
    const { language = 'fr', accuracyMeters = 100, timeoutMs = 10_000 } = input;

    // [ADDED] 1. Récupération GPS (peut throw GeolocationError)
    const coordinates = await this.geolocationService.getCurrentPosition({
      accuracyMeters,
      timeoutMs,
    });

    // [ADDED] 2. Tentative de reverse geocoding (fallback graceful)
    let formattedAddress: string;
    try {
      const reverseResult = await this.geocodeService.reverseGeocode(coordinates, { language });

      formattedAddress = reverseResult?.displayName ?? this.fallbackAddress(coordinates);
    } catch {
      // Reverse geocoding échoue → fallback graceful sans bloquer
      console.warn(
        `[WARN][GetCurrentLocationUseCase][execute][?][${new Date()
          .toISOString()
          .slice(11, 19)}] ` + 'Reverse geocoding failed, using coordinates fallback',
      );
      formattedAddress = this.fallbackAddress(coordinates);
    }

    return {
      id: uuidv4(),
      coordinates,
      formattedAddress,
    };
  }

  /**
   * Génère une adresse de fallback à partir des coordonnées.
   * Generates a fallback address from coordinates.
   *
   * @param coords - Coordonnées / Coordinates
   * @returns Adresse formatée "lat, lon" / Formatted address "lat, lon"
   */
  private fallbackAddress(coords: { latitude: number; longitude: number }): string {
    const lat = coords.latitude.toFixed(4);
    const lon = coords.longitude.toFixed(4);
    return `${lat}, ${lon}`;
  }
}

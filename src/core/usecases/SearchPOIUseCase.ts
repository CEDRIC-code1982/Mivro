/**
 * Orchestrateur métier pour la recherche de POI.
 * Validation des entrées + appel du port.
 *
 * Business orchestrator for POI search.
 * Input validation + port call.
 *
 * @file SearchPOIUseCase.ts
 * @module core/usecases/SearchPOIUseCase
 *
 * @example
 *   const useCase = new SearchPOIUseCase(poiService);
 *   const pois = await useCase.execute({
 *     center: { latitude: 48.85, longitude: 2.35 },
 *     radiusMeters: 5000,
 *     categories: ['restaurant', 'cafe'],
 *   });
 */

// [ADDED] UseCase SearchPOIUseCase — validation + orchestration

import type { Coordinates } from '@core/entities/Location';
import type { POICategory } from '@core/entities/POICategory';
import type { PointOfInterest } from '@core/entities/PointOfInterest';
import { POIError } from '@core/ports/IPOIService';
import type { IPOIService, SearchNearbyOptions } from '@core/ports/IPOIService';

/** Rayon minimum en mètres / Minimum radius in meters */
const MIN_RADIUS_METERS = 100;
/** Rayon maximum en mètres / Maximum radius in meters */
const MAX_RADIUS_METERS = 100_000;

/**
 * Entrée du use case de recherche de POI.
 * Input for the POI search use case.
 *
 * @param center — Coordonnées du centre de recherche (midpoint)
 * @param radiusMeters — Rayon de recherche en mètres (100–100 000)
 * @param categories — Catégories à inclure (au moins 1)
 * @param options — Paramètres optionnels (limite, langue, signal)
 */
export interface SearchPOIInput {
  center: Coordinates;
  radiusMeters: number;
  categories: readonly POICategory[];
  options?: SearchNearbyOptions;
}

/**
 * Use case de recherche de POI.
 * Valide les entrées puis délègue au port IPOIService.
 *
 * POI search use case.
 * Validates inputs then delegates to IPOIService port.
 *
 * @param poiService — Service de recherche de POI injecté
 * @throws POIError avec code 'invalid_input' si entrées invalides
 */
export class SearchPOIUseCase {
  constructor(private readonly poiService: IPOIService) {}

  /**
   * Exécute la recherche de POI.
   * Executes the POI search.
   *
   * @param input — Paramètres de recherche
   * @returns Liste de POI trouvés
   * @throws POIError si entrées invalides ou erreur service
   */
  async execute(input: SearchPOIInput): Promise<PointOfInterest[]> {
    if (input.radiusMeters < MIN_RADIUS_METERS) {
      throw new POIError(`Radius must be at least ${MIN_RADIUS_METERS}m`, 'invalid_input');
    }

    if (input.radiusMeters > MAX_RADIUS_METERS) {
      throw new POIError(`Radius must not exceed ${MAX_RADIUS_METERS}m`, 'invalid_input');
    }

    if (input.categories.length === 0) {
      throw new POIError('At least one category required', 'invalid_input');
    }

    return this.poiService.searchNearby(
      input.center,
      input.radiusMeters,
      input.categories,
      input.options,
    );
  }
}

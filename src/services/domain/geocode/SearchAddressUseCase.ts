/**
 * @file SearchAddressUseCase.ts
 * @description Orchestrateur métier pour la recherche d'adresse.
 *              Business orchestrator for address search.
 *
 *              Responsabilités / Responsibilities:
 *              - Validation entrée (length, trim) / Input validation (length, trim)
 *              - Appel du port IGeocodeService / Calls IGeocodeService port
 *              - Aucune dépendance React, TanStack Query, ou lib UI
 *                No dependency on React, TanStack Query, or UI libs
 *
 * @example
 *   const useCase = new SearchAddressUseCase(geocodeService);
 *   const results = await useCase.execute({ query: 'Tour Eiffel' });
 *
 * @module services/domain/geocode/SearchAddressUseCase
 */

// [ADDED] Use case SearchAddressUseCase
import type { GeocodeResult } from '@entities/GeocodeResult';
import type {
  IGeocodeService,
  SearchAddressOptions,
} from '@services/domain/geocode/IGeocodeService';
import { GeocodeError } from '@services/domain/geocode/IGeocodeService';

/**
 * Paramètres d'entrée pour la recherche d'adresse.
 * Input parameters for address search.
 *
 * @param query - Texte de recherche (min 3 caractères après trim) / Search text
 * @param options - Options de recherche optionnelles / Optional search options
 */
export interface SearchAddressInput {
  /** Texte de recherche (min 3 caractères après trim) / Search text */
  query: string;
  /** Options de recherche optionnelles / Optional search options */
  options?: SearchAddressOptions;
}

/**
 * Use case : recherche d'adresse via le port IGeocodeService.
 * Use case: address search via the IGeocodeService port.
 *
 * @param geocodeService - Service de géocodage injecté / Injected geocoding service
 */
export class SearchAddressUseCase {
  constructor(private readonly geocodeService: IGeocodeService) {}

  /**
   * Exécute la recherche d'adresse.
   * Executes the address search.
   *
   * @param input - Paramètres de recherche / Search parameters
   * @returns Liste de résultats triés par pertinence / Results sorted by relevance
   * @throws GeocodeError code 'invalid_query' si query.trim().length < 3
   * @throws GeocodeError (codes variés) selon les retours du port
   */
  async execute(input: SearchAddressInput): Promise<GeocodeResult[]> {
    const trimmed = input.query.trim();

    if (trimmed.length < 3) {
      throw new GeocodeError('Query must be at least 3 characters', 'invalid_query');
    }

    const results = await this.geocodeService.search(trimmed, {
      ...input.options,
      limit: input.options?.limit ?? 5,
    });

    return results;
  }
}

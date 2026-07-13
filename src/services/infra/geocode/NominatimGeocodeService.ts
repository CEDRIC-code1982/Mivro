/**
 * @file NominatimGeocodeService.ts
 * @description Implémentation IGeocodeService basée sur Nominatim/OSM.
 *              IGeocodeService implementation based on Nominatim/OSM.
 *
 *              Politique d'usage Nominatim respectée :
 *              Nominatim usage policy respected:
 *              - User-Agent custom obligatoire / Custom User-Agent required
 *              - 1 req/sec max par IP (géré par debouncing + cache côté hook)
 *              - Pas de bulk geocoding / No bulk geocoding
 *
 * @see https://operations.osmfoundation.org/policies/nominatim/
 * @module infrastructure/geocode/NominatimGeocodeService
 */

// [ADDED] Adapter NominatimGeocodeService
import { z } from 'zod';
import type { GeocodeResult } from '@entities/GeocodeResult';
import type { Coordinates } from '@entities/Location'; // [ADDED]
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import type {
  IGeocodeService,
  ReverseGeocodeOptions, // [ADDED]
  SearchAddressOptions,
} from '@services/domain/geocode/IGeocodeService';
import { GeocodeError } from '@services/domain/geocode/IGeocodeService';

/** URL de base de l'API Nominatim / Nominatim API base URL */
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

/** User-Agent obligatoire (politique Nominatim) / Required User-Agent (Nominatim policy) */
const USER_AGENT = 'Mivro/0.0.1 (https://mivro.app)';

/**
 * Schéma DTO Nominatim — validation runtime (TS-004).
 * Nominatim DTO schema — runtime validation (TS-004).
 *
 * Valide la réponse JSON brute de l'API Nominatim avant mapping.
 * Validates the raw Nominatim API JSON response before mapping.
 */
const NominatimResponseSchema = z.array(
  z.object({
    place_id: z.number(),
    osm_id: z.number().optional(),
    osm_type: z.string().optional(),
    lat: z.string(),
    lon: z.string(),
    display_name: z.string(),
    type: z.string().optional(),
    importance: z.number().optional(),
  }),
);

/**
 * Schéma DTO Nominatim /reverse succès — validation runtime (TS-004).
 * Nominatim /reverse success DTO schema — runtime validation (TS-004).
 */
const NominatimReverseSuccessSchema = z.object({
  place_id: z.number(),
  osm_id: z.number().optional(),
  osm_type: z.string().optional(),
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  type: z.string().optional(),
  importance: z.number().optional(),
});

/**
 * Schéma DTO Nominatim /reverse erreur — { error: "Unable to geocode" }.
 * Nominatim /reverse error DTO schema.
 */
const NominatimReverseErrorSchema = z.object({ error: z.string() });

/**
 * Implémentation Nominatim du port IGeocodeService.
 * Nominatim implementation of the IGeocodeService port.
 *
 * @param crashReporter - Crash reporter optionnel pour Sentry / Optional crash reporter for Sentry
 *
 * @example
 *   const service = new NominatimGeocodeService(crashReporter);
 *   const results = await service.search('Tour Eiffel', { language: 'fr' });
 */
export class NominatimGeocodeService implements IGeocodeService {
  constructor(private readonly crashReporter?: ICrashReporter) {}

  /**
   * Recherche des lieux via l'API Nominatim.
   * Searches for places via the Nominatim API.
   *
   * @param query - Texte de recherche / Search text
   * @param options - Options de recherche / Search options
   * @returns Liste de GeocodeResult / List of GeocodeResult
   * @throws GeocodeError avec code typé / with typed code
   */
  async search(query: string, options: SearchAddressOptions = {}): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: String(Math.min(options.limit ?? 5, 10)),
      addressdetails: '0',
    });

    if (options.countryCode) {
      params.append('countrycodes', options.countryCode);
    }
    if (options.language) {
      params.append('accept-language', options.language);
    }

    const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        // [MODIFIED] Cast AbortSignal — RN global types differ from DOM types
        signal: options.signal as RequestInit['signal'],
      });

      const duration = Date.now() - start;

      // [ADDED] HTTP 429 — rate limited by Nominatim
      if (response.status === 429) {
        console.warn(
          `[WARN][NominatimGeocodeService][search][?][${this.timestamp()}] ` +
            `Rate limited by Nominatim (HTTP 429) | duration: ${duration}ms`,
        );
        this.crashReporter?.captureMessage('Nominatim rate limited', {
          level: 'warning',
          tags: { service: 'geocode', provider: 'nominatim' },
        });
        throw new GeocodeError('Rate limited by Nominatim', 'rate_limited');
      }

      // [ADDED] HTTP 5xx — server error
      if (response.status >= 500) {
        console.error(
          `[ERROR][NominatimGeocodeService][search][?][${this.timestamp()}] ` +
            `Nominatim server error (HTTP ${response.status}) | duration: ${duration}ms`,
        );
        throw new GeocodeError(`Nominatim server error: ${response.status}`, 'server_error');
      }

      // [ADDED] Other non-OK statuses
      if (!response.ok) {
        console.error(
          `[ERROR][NominatimGeocodeService][search][?][${this.timestamp()}] ` +
            `Nominatim unexpected status: ${response.status} | duration: ${duration}ms`,
        );
        throw new GeocodeError(`Nominatim unexpected status: ${response.status}`, 'server_error');
      }

      // [ADDED] Zod validation of Nominatim response (TS-004)
      const json: unknown = await response.json();
      const parsed = NominatimResponseSchema.safeParse(json);

      if (!parsed.success) {
        console.error(
          `[ERROR][NominatimGeocodeService][search][?][${this.timestamp()}] ` +
            'Failed to parse Nominatim response',
          parsed.error,
        );
        this.crashReporter?.captureException(new Error('Nominatim response parse failed'), {
          level: 'error',
          tags: { service: 'geocode', provider: 'nominatim' },
          extra: { issues: parsed.error.issues.length },
        });
        throw new GeocodeError('Failed to parse Nominatim response', 'parse_error', parsed.error);
      }

      console.log(
        `[INFO][NominatimGeocodeService][search][?][${this.timestamp()}] ` +
          `Nominatim returned ${parsed.data.length} results | duration: ${duration}ms`,
      );

      return parsed.data.map(this.mapToGeocodeResult);
    } catch (error) {
      // [ADDED] Re-throw GeocodeError as-is
      if (error instanceof GeocodeError) {
        throw error;
      }

      // [ADDED] AbortError = user cancellation (debounce), not a real error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GeocodeError('Request aborted', 'network', error);
      }

      // [ADDED] Network error (offline, DNS, timeout, etc.)
      console.error(
        `[ERROR][NominatimGeocodeService][search][?][${this.timestamp()}] ` +
          'Network error during Nominatim call',
        error,
      );
      this.crashReporter?.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          level: 'error',
          tags: { service: 'geocode', provider: 'nominatim' },
        },
      );
      throw new GeocodeError('Network error', 'network', error);
    }
  }

  /**
   * Reverse geocoding : coordonnées → adresse formatée via Nominatim /reverse.
   * Reverse geocoding: coordinates → formatted address via Nominatim /reverse.
   *
   * @param coordinates - Coordonnées GPS / GPS coordinates
   * @param options - Options de reverse geocoding / Reverse geocoding options
   * @returns GeocodeResult ou null si aucun résultat / GeocodeResult or null if no result
   * @throws GeocodeError avec code typé / with typed code
   */
  async reverseGeocode(
    coordinates: Coordinates,
    options: ReverseGeocodeOptions = {},
  ): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({
      lat: String(coordinates.latitude),
      lon: String(coordinates.longitude),
      format: 'json',
      zoom: String(options.zoom ?? 18),
      addressdetails: '0',
    });

    if (options.language) {
      params.append('accept-language', options.language);
    }

    const url = `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: options.signal as RequestInit['signal'],
      });

      const duration = Date.now() - start;

      // [ADDED] HTTP 429 — rate limited
      if (response.status === 429) {
        console.warn(
          `[WARN][NominatimGeocodeService][reverseGeocode][?][${this.timestamp()}] ` +
            `Rate limited by Nominatim | duration: ${duration}ms`,
        );
        this.crashReporter?.captureMessage('Nominatim rate limited (reverse)', {
          level: 'warning',
          tags: { service: 'geocode', provider: 'nominatim' },
        });
        throw new GeocodeError('Rate limited by Nominatim', 'rate_limited');
      }

      // [ADDED] HTTP 5xx — server error
      if (response.status >= 500) {
        throw new GeocodeError(`Nominatim server error: ${response.status}`, 'server_error');
      }

      // [ADDED] Other non-OK statuses
      if (!response.ok) {
        throw new GeocodeError(`Nominatim unexpected status: ${response.status}`, 'server_error');
      }

      // [ADDED] Zod validation of Nominatim reverse response (TS-004)
      const json: unknown = await response.json();

      // [ADDED] Cas erreur : Nominatim renvoie { error: "Unable to geocode" }
      const errorParsed = NominatimReverseErrorSchema.safeParse(json);
      if (errorParsed.success) {
        console.log(
          `[INFO][NominatimGeocodeService][reverseGeocode][?][${this.timestamp()}] ` +
            `No reverse result | duration: ${duration}ms`,
        );
        return null;
      }

      // [ADDED] Cas succès : objet avec display_name
      const parsed = NominatimReverseSuccessSchema.safeParse(json);
      if (!parsed.success) {
        console.error(
          `[ERROR][NominatimGeocodeService][reverseGeocode][?][${this.timestamp()}] ` +
            'Failed to parse Nominatim reverse response',
          parsed.error,
        );
        throw new GeocodeError(
          'Failed to parse Nominatim reverse response',
          'parse_error',
          parsed.error,
        );
      }

      const dto = parsed.data;

      console.log(
        `[INFO][NominatimGeocodeService][reverseGeocode][?][${this.timestamp()}] ` +
          `Reverse OK | duration: ${duration}ms`,
      );

      return {
        externalId: String(dto.osm_id ?? dto.place_id),
        coordinates: {
          latitude: parseFloat(dto.lat),
          longitude: parseFloat(dto.lon),
        },
        displayName: dto.display_name,
        placeType: dto.type,
        importance: dto.importance,
      };
    } catch (error) {
      // [ADDED] Re-throw GeocodeError as-is
      if (error instanceof GeocodeError) {
        throw error;
      }

      // [ADDED] AbortError = user cancellation
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GeocodeError('Request aborted', 'network', error);
      }

      // [ADDED] Network error
      console.error(
        `[ERROR][NominatimGeocodeService][reverseGeocode][?][${this.timestamp()}] ` +
          'Network error during reverse geocode',
        error,
      );
      this.crashReporter?.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          level: 'error',
          tags: { service: 'geocode', provider: 'nominatim' },
        },
      );
      throw new GeocodeError('Network error', 'network', error);
    }
  }

  /**
   * Mappe un DTO Nominatim vers un GeocodeResult.
   * Maps a Nominatim DTO to a GeocodeResult.
   *
   * @param dto - DTO Nominatim validé par Zod / Zod-validated Nominatim DTO
   * @returns GeocodeResult mappé / Mapped GeocodeResult
   */
  private mapToGeocodeResult = (
    dto: z.infer<typeof NominatimResponseSchema>[number],
  ): GeocodeResult => {
    return {
      externalId: String(dto.osm_id ?? dto.place_id),
      coordinates: {
        latitude: parseFloat(dto.lat),
        longitude: parseFloat(dto.lon),
      },
      displayName: dto.display_name,
      placeType: dto.type,
      importance: dto.importance,
    };
  };

  /**
   * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
   * Generates an HH:mm:ss timestamp for logging (LOG-001).
   *
   * @returns Timestamp formaté / Formatted timestamp
   */
  private timestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }
}

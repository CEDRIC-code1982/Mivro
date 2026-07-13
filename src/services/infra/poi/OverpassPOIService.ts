/**
 * Implémentation IPOIService basée sur Overpass API / OSM.
 *
 * IPOIService implementation based on Overpass API / OSM.
 *
 * Politique d'usage Overpass respectée :
 * - User-Agent custom obligatoire
 * - Pas de bulk queries
 * - Timeout query [out:json][timeout:25]
 * - Cache client 5 min (gérée par TanStack Query)
 *
 * Overpass usage policy respected:
 * - Custom User-Agent required
 * - No bulk queries
 * - Query timeout [out:json][timeout:25]
 * - Client-side cache 5 min (handled by TanStack Query)
 *
 * @file OverpassPOIService.ts
 * @module infrastructure/poi
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API
 */

// [ADDED] Adapter OverpassPOIService — Overpass API integration

import { z } from 'zod';
import type { Coordinates } from '@entities/Location';
import type { POICategory } from '@entities/POICategory';
import { POI_CATEGORY_OVERPASS_FILTERS } from '@entities/POICategory';
import type { PointOfInterest } from '@entities/PointOfInterest';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import { POIError } from '@services/domain/poi/IPOIService';
import type { IPOIService, SearchNearbyOptions } from '@services/domain/poi/IPOIService';

/** URL de l'API Overpass / Overpass API URL */
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** User-Agent obligatoire / Required User-Agent */
const USER_AGENT = 'Mivro/0.0.1 (https://mivro.app)';
/** Timeout query Overpass en secondes / Overpass query timeout in seconds */
const QUERY_TIMEOUT_SEC = 25;
/** Limite par défaut de résultats / Default result limit */
const DEFAULT_LIMIT = 50;
/** Limite maximum de résultats / Maximum result limit */
const MAX_LIMIT = 200;

/**
 * Schéma DTO Overpass — validation runtime pour les éléments node.
 * Overpass DTO schema — runtime validation for node elements.
 */
const OverpassNodeSchema = z.object({
  type: z.literal('node'),
  id: z.number(),
  lat: z.number(),
  lon: z.number(),
  tags: z.record(z.string(), z.string()).optional(),
});

/**
 * Schéma DTO Overpass — validation runtime pour les éléments way.
 * Overpass DTO schema — runtime validation for way elements.
 */
const OverpassWaySchema = z.object({
  type: z.literal('way'),
  id: z.number(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

/** Schéma union node | way / Union schema node | way */
const OverpassElementSchema = z.union([OverpassNodeSchema, OverpassWaySchema]);

/** Schéma de la réponse Overpass / Overpass response schema */
const OverpassResponseSchema = z.object({
  elements: z.array(OverpassElementSchema),
});

/**
 * Service de recherche de POI via Overpass API.
 * POI search service via Overpass API.
 *
 * @param crashReporter — Reporter de crashs optionnel (Sentry)
 */
export class OverpassPOIService implements IPOIService {
  constructor(private readonly crashReporter?: ICrashReporter) {}

  /**
   * Recherche les POI autour d'un point central via Overpass.
   * Searches for POI around a central point via Overpass.
   *
   * @param center — Coordonnées du centre de recherche
   * @param radiusMeters — Rayon en mètres
   * @param categories — Catégories à rechercher
   * @param options — Options de recherche
   * @returns Liste de POI trouvés
   * @throws POIError selon le type d'erreur rencontré
   */
  async searchNearby(
    center: Coordinates,
    radiusMeters: number,
    categories: readonly POICategory[],
    options: SearchNearbyOptions = {},
  ): Promise<PointOfInterest[]> {
    const limit = Math.min(options.limitPerCategory ?? DEFAULT_LIMIT, MAX_LIMIT);

    const query = this.buildQuery(center, radiusMeters, categories, limit);
    const start = Date.now();

    try {
      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        // TS-002: cast nécessaire — AbortSignal DOM vs React Native sont structurellement
        // compatibles mais nominalement distincts
        signal: options.signal as RequestInit['signal'],
      });

      const duration = Date.now() - start;

      if (response.status === 429) {
        console.warn(
          `[WARN][OverpassPOIService][searchNearby][?][${this.timestamp()}] ` +
            `Rate limited by Overpass (HTTP 429) | duration: ${duration}ms`,
        );
        this.crashReporter?.captureMessage('Overpass rate limited', {
          level: 'warning',
          tags: { service: 'poi', provider: 'overpass' },
        });
        throw new POIError('Rate limited by Overpass', 'rate_limited');
      }

      if (response.status === 504) {
        throw new POIError('Overpass query timeout', 'query_timeout');
      }

      if (response.status >= 500) {
        throw new POIError(`Overpass server error: ${response.status}`, 'server_error');
      }

      if (!response.ok) {
        throw new POIError(`Overpass unexpected status: ${response.status}`, 'server_error');
      }

      const json: unknown = await response.json();
      const parsed = OverpassResponseSchema.safeParse(json);

      if (!parsed.success) {
        console.error(
          `[ERROR][OverpassPOIService][searchNearby][?][${this.timestamp()}] ` +
            `Failed to parse Overpass response`,
          parsed.error,
        );
        this.crashReporter?.captureException(new Error('Overpass response parse failed'), {
          level: 'error',
          tags: { service: 'poi', provider: 'overpass' },
          extra: { issues: parsed.error.issues.length },
        });
        throw new POIError('Failed to parse Overpass response', 'parse_error', parsed.error);
      }

      const pois = this.mapToPOIs(parsed.data.elements, categories);

      console.info(
        `[INFO][OverpassPOIService][searchNearby][?][${this.timestamp()}] ` +
          `Overpass returned ${pois.length} POIs across ${categories.length} categories | duration: ${duration}ms`,
      );

      return pois;
    } catch (error) {
      if (error instanceof POIError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new POIError('Request aborted', 'network', error);
      }

      console.error(
        `[ERROR][OverpassPOIService][searchNearby][?][${this.timestamp()}] ` +
          `Network error during Overpass call`,
        error,
      );
      this.crashReporter?.captureException(
        error instanceof Error ? error : new Error(String(error)),
        { tags: { service: 'poi', provider: 'overpass' } },
      );
      throw new POIError('Network error', 'network', error);
    }
  }

  /**
   * Construit la query Overpass QL pour les catégories demandées.
   * Builds the Overpass QL query for requested categories.
   *
   * @param center — Coordonnées du centre
   * @param radiusMeters — Rayon en mètres
   * @param categories — Catégories à rechercher
   * @param limit — Limite de résultats
   * @returns Query Overpass QL formatée
   *
   * @example pour [restaurant, cafe] :
   *   [out:json][timeout:25];
   *   (
   *     node["amenity"="restaurant"](around:5000,48.85,2.35);
   *     node["amenity"="cafe"](around:5000,48.85,2.35);
   *   );
   *   out body 50;
   */
  private buildQuery(
    center: Coordinates,
    radiusMeters: number,
    categories: readonly POICategory[],
    limit: number,
  ): string {
    const lat = center.latitude;
    const lon = center.longitude;
    const radius = Math.round(radiusMeters);

    const filters: string[] = [];
    for (const category of categories) {
      const overpassFilters = POI_CATEGORY_OVERPASS_FILTERS[category];
      for (const { key, value } of overpassFilters) {
        filters.push(`node["${key}"="${value}"](around:${radius},${lat},${lon});`);
      }
    }

    return [
      `[out:json][timeout:${QUERY_TIMEOUT_SEC}];`,
      '(',
      ...filters,
      ');',
      `out body ${limit};`,
    ].join('\n');
  }

  /**
   * Mappe les éléments Overpass vers des PointOfInterest.
   * Maps Overpass elements to PointOfInterest entities.
   *
   * @param elements — Éléments Overpass parsés
   * @param requestedCategories — Catégories demandées (pour le matching)
   * @returns Liste de POI valides
   */
  private mapToPOIs(
    elements: z.infer<typeof OverpassResponseSchema>['elements'],
    requestedCategories: readonly POICategory[],
  ): PointOfInterest[] {
    const pois: PointOfInterest[] = [];

    for (const element of elements) {
      const tags = element.tags ?? {};
      const name = tags.name ?? tags['name:fr'] ?? tags['name:en'];
      if (!name) continue; // [ADDED] Filtre les POI sans nom

      const category = this.detectCategory(tags, requestedCategories);
      if (!category) continue;

      const coordinates =
        element.type === 'node'
          ? { latitude: element.lat, longitude: element.lon }
          : element.center
          ? { latitude: element.center.lat, longitude: element.center.lon }
          : null;

      if (!coordinates) continue; // [ADDED] Skip ways sans center

      pois.push({
        externalId: `${element.type}/${element.id}`,
        category,
        name,
        coordinates,
        address: this.buildAddress(tags),
        tags,
      });
    }

    return pois;
  }

  /**
   * Détecte la catégorie Mivro à partir des tags OSM.
   * Renvoie la PREMIÈRE catégorie demandée qui matche.
   *
   * Detects the Mivro category from OSM tags.
   * Returns the FIRST requested category that matches.
   *
   * @param tags — Tags OSM de l'élément
   * @param requestedCategories — Catégories demandées
   * @returns Catégorie détectée ou null
   */
  private detectCategory(
    tags: Record<string, string>,
    requestedCategories: readonly POICategory[],
  ): POICategory | null {
    for (const category of requestedCategories) {
      const filters = POI_CATEGORY_OVERPASS_FILTERS[category];
      for (const { key, value } of filters) {
        if (tags[key] === value) return category;
      }
    }
    return null;
  }

  /**
   * Construit l'adresse formatée à partir des tags OSM.
   * Builds formatted address from OSM tags.
   *
   * @param tags — Tags OSM contenant addr:*
   * @returns Adresse formatée ou undefined
   */
  private buildAddress(tags: Record<string, string>): string | undefined {
    const parts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:postcode'],
      tags['addr:city'],
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' ') : undefined;
  }

  /**
   * Retourne l'heure courante au format HH:mm:ss.
   * Returns current time in HH:mm:ss format.
   *
   * @returns Timestamp formaté
   */
  private timestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }
}

/**
 * IPOIService implementation based on Overpass API / OSM.
 *
 * Overpass usage policy respected:
 * - Custom User-Agent required
 * - No bulk queries
 * - Query timeout [out:json][timeout:25]
 * - Client-side cache 5 min (handled by TanStack Query)
 *
 * @file OverpassPOIService.ts
 * @module services/infra/poi/OverpassPOIService
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API
 */

// [ADDED] OverpassPOIService adapter — Overpass API integration

import { z } from 'zod';
import type { Coordinates } from '@entities/Location';
import type { POICategory } from '@entities/POICategory';
import { POI_CATEGORY_OVERPASS_FILTERS } from '@entities/POICategory';
import type { PointOfInterest } from '@entities/PointOfInterest';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import { POIError } from '@services/domain/poi/IPOIService';
import type { IPOIService, SearchNearbyOptions } from '@services/domain/poi/IPOIService';

/** Overpass API URL */
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** Required User-Agent */
const USER_AGENT = 'Mivro/0.0.1 (https://mivro.app)';
/** Overpass query timeout in seconds */
const QUERY_TIMEOUT_SEC = 25;
/** Default result limit */
const DEFAULT_LIMIT = 50;
/** Maximum result limit */
const MAX_LIMIT = 200;
/**
 * Marker of a server-side failure in the `remark` field of an HTTP 200 response, e.g.
 * `runtime error: Query timed out in "query" at line 3 after 25 seconds.`
 */
const REMARK_RUNTIME_ERROR = 'runtime error';
/** Marker of a timeout among runtime errors */
const REMARK_TIMED_OUT = 'timed out';

/**
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
 * Overpass DTO schema — runtime validation for way elements.
 */
const OverpassWaySchema = z.object({
  type: z.literal('way'),
  id: z.number(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

/** Union schema node | way */
const OverpassElementSchema = z.union([OverpassNodeSchema, OverpassWaySchema]);

/**
 * Overpass response schema.
 *
 * [FIXED] `remark`: when a query times out or runs out of memory on the server side, Overpass
 * may still answer HTTP 200 with empty `elements` and the error in `remark` — which used to
 * show as "no places found".
 */
const OverpassResponseSchema = z.object({
  elements: z.array(OverpassElementSchema),
  remark: z.string().optional(),
});

/**
 * POI search service via Overpass API.
 *
 * @param crashReporter — Optional crash reporter (Sentry)
 */
export class OverpassPOIService implements IPOIService {
  constructor(private readonly crashReporter?: ICrashReporter) {}

  /**
   * Searches for POIs around a central point via Overpass.
   *
   * @param center — Coordinates of the search center
   * @param radiusMeters — Radius in meters
   * @param categories — Categories to search
   * @param options — Search options
   * @returns List of POIs found
   * @throws POIError depending on the error encountered
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
        // TS-002: cast required — the DOM and React Native AbortSignal types are structurally
        // compatible but nominally distinct
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

      this.throwOnRemarkError(parsed.data.remark, duration); // [FIXED]

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
   * Turns a server-side runtime error reported in `remark` (HTTP 200) into a typed POIError.
   * A remark that is not a runtime error is informational and ignored.
   *
   * [ADDED] "POI rayon géant" fix.
   *
   * @param remark — `remark` field of the Overpass response, if any
   * @param duration — Call duration in milliseconds (for the log)
   * @throws POIError `query_timeout` when the query timed out, `server_error` otherwise
   */
  private throwOnRemarkError(remark: string | undefined, duration: number): void {
    if (remark === undefined) return;
    const normalized = remark.toLowerCase();
    if (!normalized.includes(REMARK_RUNTIME_ERROR)) return;

    const code = normalized.includes(REMARK_TIMED_OUT) ? 'query_timeout' : 'server_error';
    console.warn(
      `[WARN][OverpassPOIService][searchNearby][?][${this.timestamp()}] ` +
        `Overpass runtime error in remark (${code}) | duration: ${duration}ms`,
    );
    this.crashReporter?.captureMessage('Overpass runtime error in remark', {
      level: 'warning',
      tags: { service: 'poi', provider: 'overpass' },
      extra: { code },
    });
    throw new POIError(`Overpass runtime error: ${remark}`, code);
  }

  /**
   * Builds the Overpass QL query for the requested categories.
   *
   * @param center — Center coordinates
   * @param radiusMeters — Radius in meters
   * @param categories — Categories to search
   * @param limit — Result limit
   * @returns Formatted Overpass QL query
   *
   * @example for [restaurant, cafe]:
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
   * Maps Overpass elements to PointOfInterest entities.
   *
   * @param elements — Parsed Overpass elements
   * @param requestedCategories — Requested categories (for matching)
   * @returns List of valid POIs
   */
  private mapToPOIs(
    elements: z.infer<typeof OverpassResponseSchema>['elements'],
    requestedCategories: readonly POICategory[],
  ): PointOfInterest[] {
    const pois: PointOfInterest[] = [];

    for (const element of elements) {
      const tags = element.tags ?? {};
      const name = tags.name ?? tags['name:fr'] ?? tags['name:en'];
      if (!name) continue; // [ADDED] Filters out unnamed POIs

      const category = this.detectCategory(tags, requestedCategories);
      if (!category) continue;

      const coordinates =
        element.type === 'node'
          ? { latitude: element.lat, longitude: element.lon }
          : element.center
          ? { latitude: element.center.lat, longitude: element.center.lon }
          : null;

      if (!coordinates) continue; // [ADDED] Skip ways without center

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
   * Detects the Mivro category from OSM tags.
   * Returns the FIRST requested category that matches.
   *
   * @param tags — OSM tags of the element
   * @param requestedCategories — Requested categories
   * @returns Detected category or null
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
   * Builds the formatted address from OSM tags.
   *
   * @param tags — OSM tags containing addr:*
   * @returns Formatted address or undefined
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
   * Returns the current time in HH:mm:ss format.
   *
   * @returns Formatted timestamp
   */
  private timestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }
}

/**
 * @file OverpassPOIService.test.ts
 * @description Tests unitaires de l'adapter OverpassPOIService.
 *              Unit tests for the OverpassPOIService adapter.
 *
 * @module __tests__/unit/infrastructure/poi/OverpassPOIService
 */

// [ADDED] Tests unitaires OverpassPOIService
import { mock } from 'jest-mock-extended';
import type { POICategory } from '@core/entities/POICategory';
import type { ICrashReporter } from '@core/ports/ICrashReporter';
import { POIError } from '@core/ports/IPOIService';
import { OverpassPOIService } from '@infrastructure/poi/OverpassPOIService';

// ─── Helpers ────────────────────────────────────────────────

/** Réponse Overpass valide avec 3 POIs / Valid Overpass response with 3 POIs */
const OVERPASS_VALID_RESPONSE = {
  elements: [
    {
      type: 'node' as const,
      id: 12345,
      lat: 48.8566,
      lon: 2.3522,
      tags: {
        name: 'Le Petit Bistro',
        amenity: 'restaurant',
        cuisine: 'french',
        'addr:street': 'Rue de Rivoli',
        'addr:housenumber': '1',
        'addr:postcode': '75001',
        'addr:city': 'Paris',
      },
    },
    {
      type: 'node' as const,
      id: 67890,
      lat: 48.853,
      lon: 2.3499,
      tags: {
        name: 'Café de Flore',
        amenity: 'cafe',
      },
    },
    {
      type: 'node' as const,
      id: 11111,
      lat: 48.86,
      lon: 2.3,
      tags: {
        name: 'Parc Monceau',
        leisure: 'park',
      },
    },
  ],
};

/** Réponse Overpass avec un way ayant un center / Overpass response with a way having center */
const OVERPASS_WAY_RESPONSE = {
  elements: [
    {
      type: 'way' as const,
      id: 99999,
      center: { lat: 48.87, lon: 2.31 },
      tags: {
        name: 'Grand Parc',
        leisure: 'park',
      },
    },
  ],
};

/** Réponse Overpass avec un way SANS center / Overpass response with a way WITHOUT center */
const OVERPASS_WAY_NO_CENTER_RESPONSE = {
  elements: [
    {
      type: 'way' as const,
      id: 88888,
      tags: {
        name: 'Parc Invisible',
        leisure: 'park',
      },
    },
  ],
};

/** Réponse Overpass avec un POI sans nom / Overpass response with a nameless POI */
const OVERPASS_NAMELESS_RESPONSE = {
  elements: [
    {
      type: 'node' as const,
      id: 77777,
      lat: 48.85,
      lon: 2.35,
      tags: {
        amenity: 'restaurant',
      },
    },
  ],
};

/** Centre de test / Test center */
const CENTER = { latitude: 48.85, longitude: 2.35 };
/** Rayon de test / Test radius */
const RADIUS = 5000;
/** Catégories de test / Test categories */
const CATEGORIES: readonly POICategory[] = ['restaurant', 'cafe', 'park'];

/**
 * Crée un mock Response fetch.
 * Creates a mock fetch Response.
 *
 * @param body — Corps de la réponse
 * @param status — Code HTTP
 * @param ok — Réponse OK ?
 * @returns Mock Response
 */
const createMockResponse = (body: unknown, status = 200, ok = true): Response => {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? 'OK' : 'Error',
    type: 'basic',
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    text: jest.fn(),
    bytes: jest.fn(),
  };
};

/**
 * Helper : asserts that a promise rejects with a POIError having the given code.
 *
 * @param promise — Promise à tester
 * @param expectedCode — Code d'erreur attendu
 */
const expectPOIError = async (promise: Promise<unknown>, expectedCode: string): Promise<void> => {
  try {
    await promise;
    fail('Expected promise to reject with POIError');
  } catch (error) {
    expect(error).toBeInstanceOf(POIError);
    expect((error as POIError).code).toBe(expectedCode);
  }
};

// ─── Tests ──────────────────────────────────────────────────

describe('OverpassPOIService', () => {
  let crashReporter: ReturnType<typeof mock<ICrashReporter>>;
  let service: OverpassPOIService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    crashReporter = mock<ICrashReporter>();
    service = new OverpassPOIService(crashReporter);
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createMockResponse(OVERPASS_VALID_RESPONSE));
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Success ────────────────────────────────────────────
  describe('successful search', () => {
    it('returns parsed POIs from Overpass response', async () => {
      const pois = await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(pois).toHaveLength(3);
      expect(pois[0]?.name).toBe('Le Petit Bistro');
      expect(pois[0]?.category).toBe('restaurant');
      expect(pois[1]?.name).toBe('Café de Flore');
      expect(pois[1]?.category).toBe('cafe');
      expect(pois[2]?.name).toBe('Parc Monceau');
      expect(pois[2]?.category).toBe('park');
    });

    it('maps node coordinates correctly', async () => {
      const pois = await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(pois[0]?.coordinates).toEqual({
        latitude: 48.8566,
        longitude: 2.3522,
      });
    });

    it('builds externalId from type/id', async () => {
      const pois = await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(pois[0]?.externalId).toBe('node/12345');
    });

    it('builds address from addr tags', async () => {
      const pois = await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(pois[0]?.address).toBe('1 Rue de Rivoli 75001 Paris');
    });

    it('returns undefined address when no addr tags', async () => {
      const pois = await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(pois[1]?.address).toBeUndefined();
    });

    it('preserves raw tags', async () => {
      const pois = await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(pois[0]?.tags?.cuisine).toBe('french');
    });

    it('logs INFO with POI count and duration', async () => {
      await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('Overpass returned 3 POIs'),
      );
    });
  });

  // ─── Way elements ─────────────────────────────────────
  describe('way elements', () => {
    it('maps way with center correctly', async () => {
      fetchSpy.mockResolvedValue(createMockResponse(OVERPASS_WAY_RESPONSE));

      const pois = await service.searchNearby(CENTER, RADIUS, ['park']);

      expect(pois).toHaveLength(1);
      expect(pois[0]?.externalId).toBe('way/99999');
      expect(pois[0]?.coordinates).toEqual({
        latitude: 48.87,
        longitude: 2.31,
      });
    });

    it('skips way without center', async () => {
      fetchSpy.mockResolvedValue(createMockResponse(OVERPASS_WAY_NO_CENTER_RESPONSE));

      const pois = await service.searchNearby(CENTER, RADIUS, ['park']);

      expect(pois).toHaveLength(0);
    });
  });

  // ─── Filtering ────────────────────────────────────────
  describe('filtering', () => {
    it('filters out POIs without name', async () => {
      fetchSpy.mockResolvedValue(createMockResponse(OVERPASS_NAMELESS_RESPONSE));

      const pois = await service.searchNearby(CENTER, RADIUS, ['restaurant']);

      expect(pois).toHaveLength(0);
    });

    it('returns empty array for empty elements', async () => {
      fetchSpy.mockResolvedValue(createMockResponse({ elements: [] }));

      const pois = await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(pois).toHaveLength(0);
    });
  });

  // ─── HTTP errors ──────────────────────────────────────
  describe('HTTP error handling', () => {
    it('throws rate_limited on HTTP 429', async () => {
      fetchSpy.mockResolvedValue(createMockResponse({}, 429, false));

      await expectPOIError(service.searchNearby(CENTER, RADIUS, CATEGORIES), 'rate_limited');
    });

    it('reports rate_limited to crashReporter', async () => {
      fetchSpy.mockResolvedValue(createMockResponse({}, 429, false));

      try {
        await service.searchNearby(CENTER, RADIUS, CATEGORIES);
      } catch {
        // expected
      }

      expect(crashReporter.captureMessage).toHaveBeenCalledWith(
        'Overpass rate limited',
        expect.objectContaining({
          level: 'warning',
          tags: { service: 'poi', provider: 'overpass' },
        }),
      );
    });

    it('throws query_timeout on HTTP 504', async () => {
      fetchSpy.mockResolvedValue(createMockResponse({}, 504, false));

      await expectPOIError(service.searchNearby(CENTER, RADIUS, CATEGORIES), 'query_timeout');
    });

    it('throws server_error on HTTP 500', async () => {
      fetchSpy.mockResolvedValue(createMockResponse({}, 500, false));

      await expectPOIError(service.searchNearby(CENTER, RADIUS, CATEGORIES), 'server_error');
    });

    it('throws server_error on HTTP 503', async () => {
      fetchSpy.mockResolvedValue(createMockResponse({}, 503, false));

      await expectPOIError(service.searchNearby(CENTER, RADIUS, CATEGORIES), 'server_error');
    });
  });

  // ─── Parse errors ─────────────────────────────────────
  describe('parse error handling', () => {
    it('throws parse_error on malformed JSON', async () => {
      fetchSpy.mockResolvedValue(createMockResponse({ unexpected: 'data' }));

      await expectPOIError(service.searchNearby(CENTER, RADIUS, CATEGORIES), 'parse_error');
    });

    it('reports parse_error to crashReporter', async () => {
      fetchSpy.mockResolvedValue(createMockResponse({ unexpected: 'data' }));

      try {
        await service.searchNearby(CENTER, RADIUS, CATEGORIES);
      } catch {
        // expected
      }

      expect(crashReporter.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'error',
          tags: { service: 'poi', provider: 'overpass' },
        }),
      );
    });
  });

  // ─── Network errors ───────────────────────────────────
  describe('network error handling', () => {
    it('throws network error on fetch failure', async () => {
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

      await expectPOIError(service.searchNearby(CENTER, RADIUS, CATEGORIES), 'network');
    });

    it('throws network error on AbortError', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      fetchSpy.mockRejectedValue(abortError);

      await expectPOIError(service.searchNearby(CENTER, RADIUS, CATEGORIES), 'network');
    });

    it('reports network error to crashReporter', async () => {
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

      try {
        await service.searchNearby(CENTER, RADIUS, CATEGORIES);
      } catch {
        // expected
      }

      expect(crashReporter.captureException).toHaveBeenCalledWith(
        expect.any(TypeError),
        expect.objectContaining({
          tags: { service: 'poi', provider: 'overpass' },
        }),
      );
    });
  });

  // ─── Request format ───────────────────────────────────
  describe('request format', () => {
    it('sends POST to Overpass URL', async () => {
      await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://overpass-api.de/api/interpreter',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes User-Agent header', async () => {
      await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers['User-Agent']).toBe('Mivro/0.0.1 (https://mivro.app)');
    });

    it('sends Content-Type as x-www-form-urlencoded', async () => {
      await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = callArgs[1].headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    });

    it('body contains Overpass QL query with around filter', async () => {
      await service.searchNearby(CENTER, RADIUS, CATEGORIES);

      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = callArgs[1].body as string;
      const decoded = decodeURIComponent(body.replace('data=', ''));

      expect(decoded).toContain('[out:json][timeout:25]');
      expect(decoded).toContain(`around:${RADIUS},${CENTER.latitude},${CENTER.longitude}`);
      expect(decoded).toContain('"amenity"="restaurant"');
      expect(decoded).toContain('"amenity"="cafe"');
      expect(decoded).toContain('"leisure"="park"');
      expect(decoded).toContain('out body 50');
    });

    it('respects custom limit (capped at 200)', async () => {
      await service.searchNearby(CENTER, RADIUS, CATEGORIES, {
        limitPerCategory: 300,
      });

      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = callArgs[1].body as string;
      const decoded = decodeURIComponent(body.replace('data=', ''));

      expect(decoded).toContain('out body 200');
    });

    it('passes AbortSignal to fetch', async () => {
      const controller = new AbortController();

      await service.searchNearby(CENTER, RADIUS, CATEGORIES, {
        signal: controller.signal,
      });

      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(callArgs[1].signal).toBe(controller.signal);
    });
  });

  // ─── Without crashReporter ────────────────────────────
  describe('without crashReporter', () => {
    it('does not crash when no crashReporter is provided', async () => {
      const serviceNoCrash = new OverpassPOIService();
      fetchSpy.mockResolvedValue(createMockResponse(OVERPASS_VALID_RESPONSE));

      const pois = await serviceNoCrash.searchNearby(CENTER, RADIUS, CATEGORIES);

      expect(pois).toHaveLength(3);
    });
  });
});

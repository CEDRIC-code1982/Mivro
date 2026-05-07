/**
 * @file NominatimGeocodeService.test.ts
 * @description Tests unitaires de l'adapter NominatimGeocodeService.
 *              Unit tests for the NominatimGeocodeService adapter.
 *
 * @module __tests__/unit/infrastructure/geocode/NominatimGeocodeService
 */

// [ADDED] Tests unitaires NominatimGeocodeService
import { mock } from 'jest-mock-extended';
import type { ICrashReporter } from '@core/ports/ICrashReporter';
import { GeocodeError } from '@core/ports/IGeocodeService';
import { NominatimGeocodeService } from '@infrastructure/geocode/NominatimGeocodeService';

// ─── Helpers ────────────────────────────────────────────────

/** Réponse Nominatim valide pour les tests / Valid Nominatim response for tests */
const NOMINATIM_VALID_RESPONSE = [
  {
    place_id: 100,
    osm_id: 12345,
    osm_type: 'way',
    lat: '48.8584',
    lon: '2.2945',
    display_name: 'Tour Eiffel, Paris, Île-de-France, France',
    type: 'attraction',
    importance: 0.85,
  },
  {
    place_id: 200,
    osm_id: 67890,
    lat: '48.8530',
    lon: '2.3499',
    display_name: 'Tour Eiffel, Rue de Rivoli, Paris',
    type: 'street',
    importance: 0.45,
  },
  {
    place_id: 300,
    lat: '48.8600',
    lon: '2.3000',
    display_name: 'Champ de Mars, Paris',
  },
];

/**
 * Crée un mock Response fetch / Creates a mock fetch Response
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
 * Helper : asserts that a promise rejects with a GeocodeError having the given code.
 * Avoids double-calling service.search (which consumes the mock).
 */
const expectGeocodeError = async (
  promise: Promise<unknown>,
  expectedCode: string,
): Promise<void> => {
  try {
    await promise;
    fail('Expected promise to reject with GeocodeError');
  } catch (error) {
    expect(error).toBeInstanceOf(GeocodeError);
    expect((error as GeocodeError).code).toBe(expectedCode);
  }
};

// ─── Tests ──────────────────────────────────────────────────

describe('NominatimGeocodeService', () => {
  const mockCrashReporter = mock<ICrashReporter>();
  let service: NominatimGeocodeService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NominatimGeocodeService(mockCrashReporter);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── Success ────────────────────────────────────────────
  describe('successful response', () => {
    it('parses and maps 3 results correctly', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(NOMINATIM_VALID_RESPONSE));

      const results = await service.search('Tour Eiffel');

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        externalId: '12345',
        coordinates: { latitude: 48.8584, longitude: 2.2945 },
        displayName: 'Tour Eiffel, Paris, Île-de-France, France',
        placeType: 'attraction',
        importance: 0.85,
      });
    });

    it('falls back to place_id when osm_id is missing', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(NOMINATIM_VALID_RESPONSE));

      const results = await service.search('Tour Eiffel');

      // Third result has no osm_id, should use place_id
      expect(results[2]?.externalId).toBe('300');
    });

    it('handles optional fields (placeType, importance) as undefined', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(NOMINATIM_VALID_RESPONSE));

      const results = await service.search('Tour Eiffel');

      // Third result has no type or importance
      expect(results[2]?.placeType).toBeUndefined();
      expect(results[2]?.importance).toBeUndefined();
    });

    it('returns empty array for no results', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      const results = await service.search('xyznonexistent');

      expect(results).toEqual([]);
    });
  });

  // ─── URL & Headers ──────────────────────────────────────
  describe('request construction', () => {
    it('generates correct URL with query params', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      await service.search('Paris');

      const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain('nominatim.openstreetmap.org/search?');
      expect(calledUrl).toContain('q=Paris');
      expect(calledUrl).toContain('format=json');
      expect(calledUrl).toContain('limit=5');
      expect(calledUrl).toContain('addressdetails=0');
    });

    it('includes User-Agent header with "Mivro"', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      await service.search('Paris');

      const calledOptions = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      const headers = calledOptions.headers as Record<string, string>;
      expect(headers['User-Agent']).toContain('Mivro');
    });

    it('passes countryCode as countrycodes param', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      await service.search('Paris', { countryCode: 'fr' });

      const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain('countrycodes=fr');
    });

    it('passes language as accept-language param', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      await service.search('Paris', { language: 'fr' });

      const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain('accept-language=fr');
    });

    it('clamps limit to max 10', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      await service.search('Paris', { limit: 50 });

      const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain('limit=10');
    });

    it('passes signal to fetch for abort support', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));
      const controller = new AbortController();

      await service.search('Paris', { signal: controller.signal });

      const calledOptions = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      expect(calledOptions.signal).toBe(controller.signal);
    });
  });

  // ─── HTTP 429 ───────────────────────────────────────────
  describe('rate limiting (HTTP 429)', () => {
    it('throws GeocodeError with code "rate_limited"', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(null, 429, false));

      await expectGeocodeError(service.search('Paris'), 'rate_limited');
    });

    it('reports to Sentry via captureMessage', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(null, 429, false));

      await expectGeocodeError(service.search('Paris'), 'rate_limited');

      expect(mockCrashReporter.captureMessage).toHaveBeenCalledWith(
        'Nominatim rate limited',
        expect.objectContaining({
          level: 'warning',
          tags: { service: 'geocode', provider: 'nominatim' },
        }),
      );
    });
  });

  // ─── HTTP 5xx ───────────────────────────────────────────
  describe('server error (HTTP 5xx)', () => {
    it('throws GeocodeError with code "server_error" on 500', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(null, 500, false));

      await expectGeocodeError(service.search('Paris'), 'server_error');
    });

    it('throws GeocodeError with code "server_error" on 503', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(null, 503, false));

      await expectGeocodeError(service.search('Paris'), 'server_error');
    });
  });

  // ─── HTTP 404 (unexpected) ──────────────────────────────
  describe('unexpected status (HTTP 404)', () => {
    it('throws GeocodeError with code "server_error"', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse(null, 404, false));

      await expectGeocodeError(service.search('Paris'), 'server_error');
    });
  });

  // ─── Parse error ────────────────────────────────────────
  describe('parse error (invalid Zod schema)', () => {
    it('throws GeocodeError with code "parse_error" on malformed JSON', async () => {
      // Response is not an array → Zod will fail
      fetchSpy.mockResolvedValueOnce(createMockResponse({ invalid: 'data' }));

      await expectGeocodeError(service.search('Paris'), 'parse_error');
    });

    it('throws GeocodeError with code "parse_error" when array items are malformed', async () => {
      // Array with missing required fields
      fetchSpy.mockResolvedValueOnce(createMockResponse([{ no_place_id: true }]));

      await expectGeocodeError(service.search('Paris'), 'parse_error');
    });

    it('reports parse error to Sentry via captureException', async () => {
      fetchSpy.mockResolvedValueOnce(createMockResponse({ invalid: 'data' }));

      await expectGeocodeError(service.search('Paris'), 'parse_error');

      expect(mockCrashReporter.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'error',
          tags: { service: 'geocode', provider: 'nominatim' },
        }),
      );
    });
  });

  // ─── Network error ──────────────────────────────────────
  describe('network error', () => {
    it('throws GeocodeError with code "network"', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Network request failed'));

      await expectGeocodeError(service.search('Paris'), 'network');
    });

    it('wraps the original error as cause', async () => {
      const originalError = new TypeError('Network request failed');
      fetchSpy.mockRejectedValueOnce(originalError);

      try {
        await service.search('Paris');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GeocodeError);
        expect((error as GeocodeError).cause).toBe(originalError);
      }
    });

    it('reports network error to Sentry via captureException', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Network request failed'));

      await expectGeocodeError(service.search('Paris'), 'network');

      expect(mockCrashReporter.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: 'error',
          tags: { service: 'geocode', provider: 'nominatim' },
        }),
      );
    });
  });

  // ─── Abort ──────────────────────────────────────────────
  describe('abort signal', () => {
    it('throws GeocodeError with code "network" on AbortError', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      fetchSpy.mockRejectedValueOnce(abortError);

      await expectGeocodeError(service.search('Paris'), 'network');
    });
  });

  // ─── Without crash reporter ─────────────────────────────
  describe('without crash reporter', () => {
    it('does not throw when crashReporter is undefined', async () => {
      const serviceNoCrash = new NominatimGeocodeService();
      fetchSpy.mockResolvedValueOnce(createMockResponse([]));

      const results = await serviceNoCrash.search('Paris');

      expect(results).toEqual([]);
    });
  });
});

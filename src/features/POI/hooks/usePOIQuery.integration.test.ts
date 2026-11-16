/**
 * @file usePOIQuery.integration.test.ts
 * @description Integration tests for usePOIQuery wired to the REAL SearchPOIUseCase (only the POI
 *   service is mocked), at boundary zone radii. The unit tests mock the use case, so they could not
 *   see a hook radius outside the use case bounds (JOURNAL J-065).
 *
 * @module features/POI/hooks/usePOIQuery.integration.test
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import type { PointOfInterest } from '@entities/PointOfInterest';
import {
  MAX_POI_SEARCH_RADIUS_M,
  MIN_POI_SEARCH_RADIUS_M,
  usePOIQuery,
} from '@features/POI/hooks/usePOIQuery';
import { SearchPOIUseCase } from '@services/domain/poi/SearchPOIUseCase';
import { createQueryClientWrapper } from '@test-utils/queryClientWrapper';

// ─── Real use case, mocked POI service ──────────────────────

const mockSearchNearby = jest.fn();
const mockSearchPOIUseCase = new SearchPOIUseCase({ searchNearby: mockSearchNearby });

jest.mock('@services/serviceContainer', () => ({
  getContainer: () => ({ searchPOIUseCase: mockSearchPOIUseCase }),
}));

// ─── Test data ──────────────────────────────────────────────

/** Per-test timeout for the render + query round-trip under CPU contention. */
const LOADED_MACHINE_TIMEOUT_MS = 15_000;
/** waitFor timeout (default 1 s), kept below the per-test timeout so waitFor reports first. */
const WAIT_FOR_TIMEOUT_MS = 10_000;

const CENTER = { latitude: 48.85, longitude: 2.35 };
const CATEGORIES = ['restaurant'] as const;

const FAKE_POIS: PointOfInterest[] = [
  {
    externalId: 'node/12345',
    category: 'restaurant',
    name: 'Le Petit Bistro',
    coordinates: { latitude: 48.8566, longitude: 2.3522 },
  },
];

/** Zone radius of a Paris + Tokyo session (~4,900 km), the "POI rayon géant" case. */
const PARIS_TOKYO_RADIUS = 4_900_000;
/** Lower bound of SearchPOIUseCase (`MIN_RADIUS_METERS`, private to the use case). */
const USE_CASE_MIN_RADIUS = 100;
/** Upper bound of SearchPOIUseCase (`MAX_RADIUS_METERS`, private to the use case). */
const USE_CASE_MAX_RADIUS = 100_000;
/** A mid-range zone radius, passed through unchanged. */
const MID_RANGE_RADIUS = 5_000;

// ─── Tests ──────────────────────────────────────────────────

describe('usePOIQuery + real SearchPOIUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchNearby.mockResolvedValue(FAKE_POIS);
  });

  it.each<[string, number, number]>([
    ['1 m', 1, MIN_POI_SEARCH_RADIUS_M],
    ['just below the use case minimum', USE_CASE_MIN_RADIUS - 1, MIN_POI_SEARCH_RADIUS_M],
    ['the use case minimum', USE_CASE_MIN_RADIUS, MIN_POI_SEARCH_RADIUS_M],
    ['the floor', MIN_POI_SEARCH_RADIUS_M, MIN_POI_SEARCH_RADIUS_M],
    ['a mid-range radius', MID_RANGE_RADIUS, MID_RANGE_RADIUS],
    ['the cap', MAX_POI_SEARCH_RADIUS_M, MAX_POI_SEARCH_RADIUS_M],
    ['just above the use case maximum', USE_CASE_MAX_RADIUS + 1, MAX_POI_SEARCH_RADIUS_M],
    ['Paris + Tokyo', PARIS_TOKYO_RADIUS, MAX_POI_SEARCH_RADIUS_M],
  ])(
    'searches without invalid_input for a zone radius of %s',
    async (_label, zoneRadius, expectedSearchRadius) => {
      const { result } = renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: zoneRadius,
            categories: CATEGORIES,
          }),
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(
        () => {
          expect(result.current.isSuccess || result.current.isError).toBe(true);
        },
        { timeout: WAIT_FOR_TIMEOUT_MS },
      );

      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual(FAKE_POIS);
      expect(mockSearchNearby).toHaveBeenCalledWith(
        CENTER,
        expectedSearchRadius,
        CATEGORIES,
        expect.anything(),
      );
    },
    LOADED_MACHINE_TIMEOUT_MS,
  );
});

/**
 * @file usePOIQuery.test.ts
 * @description Unit tests for the usePOIQuery hook.
 *
 * @module features/POI/hooks/usePOIQuery.test
 */

// [ADDED] usePOIQuery unit tests
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PointOfInterest } from '@entities/PointOfInterest';
import {
  MAX_POI_SEARCH_RADIUS_M,
  MIN_POI_SEARCH_RADIUS_M,
  usePOIQuery,
} from '@features/POI/hooks/usePOIQuery';
import { POIError } from '@services/domain/poi/IPOIService';
import { createQueryClientWrapper } from '@test-utils/queryClientWrapper';

// ─── Mock getContainer ──────────────────────────────────────

const mockExecute = jest.fn();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    searchPOIUseCase: { execute: mockExecute },
  })),
}));

// ─── Test data ──────────────────────────────────────────────

/** Per-test timeout for the render + query round-trip under CPU contention. */
const LOADED_MACHINE_TIMEOUT_MS = 15_000;

const FAKE_POIS: PointOfInterest[] = [
  {
    externalId: 'node/12345',
    category: 'restaurant',
    name: 'Le Petit Bistro',
    coordinates: { latitude: 48.8566, longitude: 2.3522 },
  },
  {
    externalId: 'node/67890',
    category: 'cafe',
    name: 'Café de Flore',
    coordinates: { latitude: 48.853, longitude: 2.3499 },
  },
];

const CENTER = { latitude: 48.85, longitude: 2.35 };
const RADIUS = 5000;
/** Zone radius of a Paris + Tokyo session (~4,900 km), the "POI rayon géant" case. */
const PARIS_TOKYO_RADIUS = 4_900_000;
/** Cap value validated by Cédric (2026-11-16). */
const EXPECTED_CAP = 25_000;
/** Zone radius of participants ~100 m apart, the "POI rayon minuscule" case. */
const TINY_ZONE_RADIUS = 50;
/** Floor value validated by Cédric (2026-11-16). */
const EXPECTED_FLOOR = 500;

// ─── Tests ──────────────────────────────────────────────────

describe('usePOIQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── enabled logic ──────────────────────────────────────
  describe('enabled conditions', () => {
    it('does not call useCase when center is null', () => {
      renderHook(
        () =>
          usePOIQuery({
            center: null,
            radiusMeters: RADIUS,
            categories: ['restaurant'],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('does not call useCase when radiusMeters is null', () => {
      renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: null,
            categories: ['restaurant'],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('does not call useCase when radiusMeters is 0', () => {
      renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: 0,
            categories: ['restaurant'],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('does not call useCase when categories is empty', () => {
      renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: RADIUS,
            categories: [],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('does not call useCase when enabled is false', () => {
      renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: RADIUS,
            categories: ['restaurant'],
            enabled: false,
          }),
        { wrapper: createQueryClientWrapper() },
      );

      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  // ─── success ────────────────────────────────────────────
  describe('successful fetch', () => {
    it('calls useCase.execute with correct params', async () => {
      mockExecute.mockResolvedValueOnce(FAKE_POIS);

      const { result } = renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: RADIUS,
            categories: ['restaurant', 'cafe'],
            language: 'fr',
          }),
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(FAKE_POIS);
      });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          center: CENTER,
          radiusMeters: RADIUS,
          categories: ['restaurant', 'cafe'],
          options: expect.objectContaining({ language: 'fr' }),
        }),
      );
    });

    it('caps the search radius at MAX_POI_SEARCH_RADIUS_M for a very wide zone', async () => {
      mockExecute.mockResolvedValueOnce(FAKE_POIS);

      const { result } = renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: PARIS_TOKYO_RADIUS,
            categories: ['restaurant'],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(FAKE_POIS);
      });

      expect(MAX_POI_SEARCH_RADIUS_M).toBe(EXPECTED_CAP);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ radiusMeters: MAX_POI_SEARCH_RADIUS_M }),
      );
    });

    it('passes a radius below the cap unchanged', async () => {
      mockExecute.mockResolvedValueOnce(FAKE_POIS);

      const { result } = renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: MAX_POI_SEARCH_RADIUS_M - 1,
            categories: ['restaurant'],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(FAKE_POIS);
      });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ radiusMeters: MAX_POI_SEARCH_RADIUS_M - 1 }),
      );
    });

    it('floors the search radius at MIN_POI_SEARCH_RADIUS_M for a very narrow zone', async () => {
      mockExecute.mockResolvedValueOnce(FAKE_POIS);

      const { result } = renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: TINY_ZONE_RADIUS,
            categories: ['restaurant'],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(FAKE_POIS);
      });

      expect(MIN_POI_SEARCH_RADIUS_M).toBe(EXPECTED_FLOOR);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ radiusMeters: MIN_POI_SEARCH_RADIUS_M }),
      );
    });

    it('passes a radius above the floor unchanged', async () => {
      mockExecute.mockResolvedValueOnce(FAKE_POIS);

      const { result } = renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: MIN_POI_SEARCH_RADIUS_M + 1,
            categories: ['restaurant'],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(FAKE_POIS);
      });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({ radiusMeters: MIN_POI_SEARCH_RADIUS_M + 1 }),
      );
    });
  });

  // ─── retry logic ────────────────────────────────────────
  describe('retry logic', () => {
    it('does not retry on rate_limited error', async () => {
      mockExecute.mockRejectedValue(new POIError('Rate limited', 'rate_limited'));

      const { result } = renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: RADIUS,
            categories: ['restaurant'],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('does not retry on invalid_input error', async () => {
      mockExecute.mockRejectedValue(new POIError('Invalid input', 'invalid_input'));

      const { result } = renderHook(
        () =>
          usePOIQuery({
            center: CENTER,
            radiusMeters: RADIUS,
            categories: ['restaurant'],
          }),
        { wrapper: createQueryClientWrapper() },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it(
      'does not retry on parse_error',
      async () => {
        mockExecute.mockRejectedValue(new POIError('Parse error', 'parse_error'));

        const { result } = renderHook(
          () =>
            usePOIQuery({
              center: CENTER,
              radiusMeters: RADIUS,
              categories: ['restaurant'],
            }),
          { wrapper: createQueryClientWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(mockExecute).toHaveBeenCalledTimes(1);
        // Explicit budget: this test timed out at Jest's default 5 s on a loaded
        // machine while passing 9/9 at rest (JOURNAL J-025). Raised here only, so
        // a real slowdown elsewhere still trips the global default.
      },
      LOADED_MACHINE_TIMEOUT_MS,
    );

    it(
      'does not retry on query_timeout',
      async () => {
        mockExecute.mockRejectedValue(new POIError('Overpass query timeout', 'query_timeout'));

        const { result } = renderHook(
          () =>
            usePOIQuery({
              center: CENTER,
              radiusMeters: RADIUS,
              categories: ['restaurant'],
            }),
          { wrapper: createQueryClientWrapper() },
        );

        await waitFor(() => {
          expect(result.current.isError).toBe(true);
        });

        expect(mockExecute).toHaveBeenCalledTimes(1);
      },
      LOADED_MACHINE_TIMEOUT_MS,
    );
  });
});

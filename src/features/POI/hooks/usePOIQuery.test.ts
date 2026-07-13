/**
 * @file usePOIQuery.test.ts
 * @description Tests unitaires du hook usePOIQuery.
 *              Unit tests for the usePOIQuery hook.
 *
 * @module __tests__/unit/presentation/hooks/usePOIQuery
 */

// [ADDED] Tests unitaires usePOIQuery
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PointOfInterest } from '@entities/PointOfInterest';
import { usePOIQuery } from '@features/POI/hooks/usePOIQuery';
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

    it('does not retry on parse_error', async () => {
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
    });
  });
});

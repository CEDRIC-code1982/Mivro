/**
 * @file SearchPOIUseCase.test.ts
 * @description Tests unitaires du use case SearchPOIUseCase.
 *              Unit tests for the SearchPOIUseCase.
 *
 * @module __tests__/unit/core/usecases/SearchPOIUseCase
 */

// [ADDED] Tests unitaires SearchPOIUseCase
import type { PointOfInterest } from '@core/entities/PointOfInterest';
import { POIError } from '@core/ports/IPOIService';
import type { IPOIService } from '@core/ports/IPOIService';
import { SearchPOIUseCase } from '@core/usecases/SearchPOIUseCase';
import type { SearchPOIInput } from '@core/usecases/SearchPOIUseCase';
import { PARIS } from '../../../helpers/coordinates';

const MOCK_POI: PointOfInterest = {
  externalId: 'node/12345',
  category: 'restaurant',
  name: 'Le Petit Bistro',
  coordinates: { latitude: 48.8566, longitude: 2.3522 },
};

/**
 * Crée un mock IPOIService.
 * Creates a mock IPOIService.
 */
function createMockPOIService(
  result: PointOfInterest[] = [MOCK_POI],
): IPOIService & { searchNearby: jest.Mock } {
  return {
    searchNearby: jest.fn().mockResolvedValue(result),
  };
}

function createValidInput(overrides?: Partial<SearchPOIInput>): SearchPOIInput {
  return {
    center: PARIS,
    radiusMeters: 5000,
    categories: ['restaurant', 'cafe'],
    ...overrides,
  };
}

describe('SearchPOIUseCase', () => {
  // ─── Validation ───────────────────────────────────────────
  describe('input validation', () => {
    it('throws invalid_input if radius < 100m', async () => {
      const service = createMockPOIService();
      const useCase = new SearchPOIUseCase(service);

      await expect(useCase.execute(createValidInput({ radiusMeters: 50 }))).rejects.toThrow(
        POIError,
      );

      try {
        await useCase.execute(createValidInput({ radiusMeters: 50 }));
      } catch (error) {
        expect(error).toBeInstanceOf(POIError);
        expect((error as POIError).code).toBe('invalid_input');
      }
    });

    it('throws invalid_input if radius > 100km', async () => {
      const service = createMockPOIService();
      const useCase = new SearchPOIUseCase(service);

      await expect(useCase.execute(createValidInput({ radiusMeters: 200_000 }))).rejects.toThrow(
        POIError,
      );

      try {
        await useCase.execute(createValidInput({ radiusMeters: 200_000 }));
      } catch (error) {
        expect(error).toBeInstanceOf(POIError);
        expect((error as POIError).code).toBe('invalid_input');
      }
    });

    it('throws invalid_input if categories is empty', async () => {
      const service = createMockPOIService();
      const useCase = new SearchPOIUseCase(service);

      await expect(useCase.execute(createValidInput({ categories: [] }))).rejects.toThrow(POIError);

      try {
        await useCase.execute(createValidInput({ categories: [] }));
      } catch (error) {
        expect(error).toBeInstanceOf(POIError);
        expect((error as POIError).code).toBe('invalid_input');
      }
    });

    it('accepts radius exactly 100m', async () => {
      const service = createMockPOIService();
      const useCase = new SearchPOIUseCase(service);

      await useCase.execute(createValidInput({ radiusMeters: 100 }));
      expect(service.searchNearby).toHaveBeenCalled();
    });

    it('accepts radius exactly 100km', async () => {
      const service = createMockPOIService();
      const useCase = new SearchPOIUseCase(service);

      await useCase.execute(createValidInput({ radiusMeters: 100_000 }));
      expect(service.searchNearby).toHaveBeenCalled();
    });
  });

  // ─── Delegation ───────────────────────────────────────────
  describe('service delegation', () => {
    it('calls poiService.searchNearby with correct params', async () => {
      const service = createMockPOIService();
      const useCase = new SearchPOIUseCase(service);
      const input = createValidInput();

      await useCase.execute(input);

      expect(service.searchNearby).toHaveBeenCalledWith(
        input.center,
        input.radiusMeters,
        input.categories,
        input.options,
      );
    });

    it('returns POIs from service', async () => {
      const expectedPOIs = [MOCK_POI];
      const service = createMockPOIService(expectedPOIs);
      const useCase = new SearchPOIUseCase(service);

      const result = await useCase.execute(createValidInput());

      expect(result).toEqual(expectedPOIs);
    });

    it('propagates POIError from service', async () => {
      const service = createMockPOIService();
      service.searchNearby.mockRejectedValue(new POIError('Rate limited', 'rate_limited'));
      const useCase = new SearchPOIUseCase(service);

      try {
        await useCase.execute(createValidInput());
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(POIError);
        expect((error as POIError).code).toBe('rate_limited');
      }
    });

    it('passes options to service', async () => {
      const service = createMockPOIService();
      const useCase = new SearchPOIUseCase(service);
      const input = createValidInput({
        options: { limitPerCategory: 100, language: 'fr' },
      });

      await useCase.execute(input);

      expect(service.searchNearby).toHaveBeenCalledWith(
        input.center,
        input.radiusMeters,
        input.categories,
        { limitPerCategory: 100, language: 'fr' },
      );
    });
  });
});

/**
 * @file SearchAddressUseCase.test.ts
 * @description Tests unitaires du use case SearchAddressUseCase.
 *              Unit tests for the SearchAddressUseCase use case.
 *
 * @module services/domain/geocode/SearchAddressUseCase.test
 */

// [ADDED] Tests unitaires SearchAddressUseCase
import { mock } from 'jest-mock-extended';
import type { GeocodeResult } from '@entities/GeocodeResult';
import type { IGeocodeService } from '@services/domain/geocode/IGeocodeService';
import { GeocodeError } from '@services/domain/geocode/IGeocodeService';
import { SearchAddressUseCase } from '@services/domain/geocode/SearchAddressUseCase';

describe('SearchAddressUseCase', () => {
  const mockGeocodeService = mock<IGeocodeService>();
  let useCase: SearchAddressUseCase;

  const fakeResults: GeocodeResult[] = [
    {
      externalId: '12345',
      coordinates: { latitude: 48.8584, longitude: 2.2945 },
      displayName: 'Tour Eiffel, Paris, France',
      placeType: 'attraction',
      importance: 0.85,
    },
    {
      externalId: '67890',
      coordinates: { latitude: 48.853, longitude: 2.3499 },
      displayName: 'Tour Eiffel, Rue de Rivoli, Paris',
      placeType: 'street',
      importance: 0.45,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new SearchAddressUseCase(mockGeocodeService);
  });

  // ─── Validation ────────────────────────────────────────────
  describe('input validation', () => {
    it('throws GeocodeError "invalid_query" if query is empty', async () => {
      await expect(useCase.execute({ query: '' })).rejects.toThrow(GeocodeError);
      await expect(useCase.execute({ query: '' })).rejects.toMatchObject({
        code: 'invalid_query',
      });
    });

    it('throws GeocodeError "invalid_query" if query is only spaces', async () => {
      await expect(useCase.execute({ query: '   ' })).rejects.toThrow(GeocodeError);
      await expect(useCase.execute({ query: '   ' })).rejects.toMatchObject({
        code: 'invalid_query',
      });
    });

    it('throws GeocodeError "invalid_query" if trimmed query < 3 chars', async () => {
      await expect(useCase.execute({ query: 'ab' })).rejects.toThrow(GeocodeError);
      await expect(useCase.execute({ query: 'ab' })).rejects.toMatchObject({
        code: 'invalid_query',
      });
    });

    it('throws GeocodeError "invalid_query" if trimmed query is exactly 2 chars with spaces', async () => {
      await expect(useCase.execute({ query: '  ab  ' })).rejects.toThrow(GeocodeError);
      await expect(useCase.execute({ query: '  ab  ' })).rejects.toMatchObject({
        code: 'invalid_query',
      });
    });

    it('does NOT throw if trimmed query is exactly 3 chars', async () => {
      mockGeocodeService.search.mockResolvedValueOnce([]);

      await expect(useCase.execute({ query: 'abc' })).resolves.not.toThrow();
    });
  });

  // ─── Service call ─────────────────────────────────────────
  describe('service call', () => {
    it('calls geocodeService.search with trimmed query', async () => {
      mockGeocodeService.search.mockResolvedValueOnce(fakeResults);

      await useCase.execute({ query: '  Tour Eiffel  ' });

      expect(mockGeocodeService.search).toHaveBeenCalledWith(
        'Tour Eiffel',
        expect.objectContaining({ limit: 5 }),
      );
    });

    it('uses default limit of 5 when no limit is specified', async () => {
      mockGeocodeService.search.mockResolvedValueOnce(fakeResults);

      await useCase.execute({ query: 'Paris' });

      expect(mockGeocodeService.search).toHaveBeenCalledWith(
        'Paris',
        expect.objectContaining({ limit: 5 }),
      );
    });

    it('respects custom limit from options', async () => {
      mockGeocodeService.search.mockResolvedValueOnce(fakeResults);

      await useCase.execute({ query: 'Paris', options: { limit: 3 } });

      expect(mockGeocodeService.search).toHaveBeenCalledWith(
        'Paris',
        expect.objectContaining({ limit: 3 }),
      );
    });

    it('passes countryCode and language options through', async () => {
      mockGeocodeService.search.mockResolvedValueOnce(fakeResults);

      await useCase.execute({
        query: 'Paris',
        options: { countryCode: 'fr', language: 'fr' },
      });

      expect(mockGeocodeService.search).toHaveBeenCalledWith(
        'Paris',
        expect.objectContaining({ countryCode: 'fr', language: 'fr' }),
      );
    });

    it('returns the results from the geocode service', async () => {
      mockGeocodeService.search.mockResolvedValueOnce(fakeResults);

      const results = await useCase.execute({ query: 'Tour Eiffel' });

      expect(results).toEqual(fakeResults);
      expect(results).toHaveLength(2);
    });
  });

  // ─── Error propagation ────────────────────────────────────
  describe('error propagation', () => {
    it('propagates GeocodeError from the service', async () => {
      const serviceError = new GeocodeError('Rate limited', 'rate_limited');
      mockGeocodeService.search.mockRejectedValueOnce(serviceError);

      await expect(useCase.execute({ query: 'Paris' })).rejects.toThrow(serviceError);
    });

    it('propagates GeocodeError with correct code from the service', async () => {
      const serviceError = new GeocodeError('Network error', 'network');
      mockGeocodeService.search.mockRejectedValueOnce(serviceError);

      await expect(useCase.execute({ query: 'Paris' })).rejects.toMatchObject({
        code: 'network',
      });
    });

    it('propagates unexpected errors from the service', async () => {
      const unexpectedError = new Error('Unexpected failure');
      mockGeocodeService.search.mockRejectedValueOnce(unexpectedError);

      await expect(useCase.execute({ query: 'Paris' })).rejects.toThrow('Unexpected failure');
    });
  });
});

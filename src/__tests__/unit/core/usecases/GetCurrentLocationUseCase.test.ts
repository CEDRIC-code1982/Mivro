/**
 * @file GetCurrentLocationUseCase.test.ts
 * @description Tests unitaires du use case GetCurrentLocationUseCase.
 *              Unit tests for the GetCurrentLocationUseCase use case.
 *
 * @module __tests__/unit/core/usecases/GetCurrentLocationUseCase
 */

// [ADDED] Tests unitaires GetCurrentLocationUseCase

// Mock uuid pour des résultats déterministes
const mockUuid = '550e8400-e29b-41d4-a716-446655440000';
jest.mock('uuid', () => ({ v4: () => mockUuid }));

import { mock } from 'jest-mock-extended';
import type { GeocodeResult } from '@core/entities/GeocodeResult';
import type { IGeocodeService } from '@core/ports/IGeocodeService';
import { GeocodeError } from '@core/ports/IGeocodeService';
import type { IGeolocationService } from '@core/ports/IGeolocationService';
import { GeolocationError } from '@core/ports/IGeolocationService';
import { GetCurrentLocationUseCase } from '@core/usecases/GetCurrentLocationUseCase';

describe('GetCurrentLocationUseCase', () => {
  const mockGeolocationService = mock<IGeolocationService>();
  const mockGeocodeService = mock<IGeocodeService>();
  let useCase: GetCurrentLocationUseCase;

  const fakeCoords = { latitude: 48.8566, longitude: 2.3522 };
  const fakeReverseResult: GeocodeResult = {
    externalId: '12345',
    coordinates: fakeCoords,
    displayName: '1 Rue de Rivoli, 75001 Paris, France',
    placeType: 'street',
    importance: 0.7,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetCurrentLocationUseCase(mockGeolocationService, mockGeocodeService);
  });

  // ─── Success path ──────────────────────────────────────
  describe('success path (GPS + reverse OK)', () => {
    it('returns a Location with formatted address from reverse geocoding', async () => {
      mockGeolocationService.getCurrentPosition.mockResolvedValueOnce(fakeCoords);
      mockGeocodeService.reverseGeocode.mockResolvedValueOnce(fakeReverseResult);

      const { location, addressResolved } = await useCase.execute();

      expect(location.id).toBe(mockUuid);
      expect(location.coordinates).toEqual(fakeCoords);
      expect(location.formattedAddress).toBe('1 Rue de Rivoli, 75001 Paris, France');
      expect(addressResolved).toBe(true);
    });

    it('passes language to reverse geocode', async () => {
      mockGeolocationService.getCurrentPosition.mockResolvedValueOnce(fakeCoords);
      mockGeocodeService.reverseGeocode.mockResolvedValueOnce(fakeReverseResult);

      await useCase.execute({ language: 'en' });

      expect(mockGeocodeService.reverseGeocode).toHaveBeenCalledWith(
        fakeCoords,
        expect.objectContaining({ language: 'en' }),
      );
    });

    it('passes accuracyMeters and timeoutMs to geolocation service', async () => {
      mockGeolocationService.getCurrentPosition.mockResolvedValueOnce(fakeCoords);
      mockGeocodeService.reverseGeocode.mockResolvedValueOnce(fakeReverseResult);

      await useCase.execute({ accuracyMeters: 50, timeoutMs: 5000 });

      expect(mockGeolocationService.getCurrentPosition).toHaveBeenCalledWith({
        accuracyMeters: 50,
        timeoutMs: 5000,
      });
    });

    it('generates a uuid for the Location id', async () => {
      mockGeolocationService.getCurrentPosition.mockResolvedValueOnce(fakeCoords);
      mockGeocodeService.reverseGeocode.mockResolvedValueOnce(fakeReverseResult);

      const { location } = await useCase.execute();

      expect(location.id).toBe(mockUuid);
    });
  });

  // ─── Reverse returns null ──────────────────────────────
  describe('reverse geocoding returns null', () => {
    it('uses fallback address "lat, lon"', async () => {
      mockGeolocationService.getCurrentPosition.mockResolvedValueOnce(fakeCoords);
      mockGeocodeService.reverseGeocode.mockResolvedValueOnce(null);

      const { location, addressResolved } = await useCase.execute();

      expect(location.formattedAddress).toBe('48.8566, 2.3522');
      expect(location.coordinates).toEqual(fakeCoords);
      // [FIXED P1] adresse non résolue → flag false pour notice non-bloquante
      expect(addressResolved).toBe(false);
    });
  });

  // ─── Reverse throws ────────────────────────────────────
  describe('reverse geocoding throws', () => {
    it('uses fallback address without re-throwing', async () => {
      mockGeolocationService.getCurrentPosition.mockResolvedValueOnce(fakeCoords);
      mockGeocodeService.reverseGeocode.mockRejectedValueOnce(
        new GeocodeError('Network error', 'network'),
      );

      const { location, addressResolved } = await useCase.execute();

      expect(location.formattedAddress).toBe('48.8566, 2.3522');
      expect(location.coordinates).toEqual(fakeCoords);
      // [FIXED P1] reverse échoue (hors ligne) → flag false
      expect(addressResolved).toBe(false);
    });
  });

  // ─── GPS throws ────────────────────────────────────────
  describe('GPS failure', () => {
    it('propagates GeolocationError from geolocation service', async () => {
      const gpsError = new GeolocationError('Permission denied', 'permission_denied');
      mockGeolocationService.getCurrentPosition.mockRejectedValueOnce(gpsError);

      await expect(useCase.execute()).rejects.toThrow(gpsError);
    });

    it('propagates timeout GeolocationError', async () => {
      const gpsError = new GeolocationError('Timeout', 'timeout');
      mockGeolocationService.getCurrentPosition.mockRejectedValueOnce(gpsError);

      await expect(useCase.execute()).rejects.toMatchObject({ code: 'timeout' });
    });

    it('does NOT call reverse geocode when GPS fails', async () => {
      mockGeolocationService.getCurrentPosition.mockRejectedValueOnce(
        new GeolocationError('Unavailable', 'unavailable'),
      );

      await expect(useCase.execute()).rejects.toThrow();
      expect(mockGeocodeService.reverseGeocode).not.toHaveBeenCalled();
    });
  });

  // ─── Defaults ──────────────────────────────────────────
  describe('defaults', () => {
    it('uses default language "fr" when not specified', async () => {
      mockGeolocationService.getCurrentPosition.mockResolvedValueOnce(fakeCoords);
      mockGeocodeService.reverseGeocode.mockResolvedValueOnce(fakeReverseResult);

      await useCase.execute();

      expect(mockGeocodeService.reverseGeocode).toHaveBeenCalledWith(
        fakeCoords,
        expect.objectContaining({ language: 'fr' }),
      );
    });

    it('uses default accuracyMeters 100 and timeoutMs 10000', async () => {
      mockGeolocationService.getCurrentPosition.mockResolvedValueOnce(fakeCoords);
      mockGeocodeService.reverseGeocode.mockResolvedValueOnce(fakeReverseResult);

      await useCase.execute();

      expect(mockGeolocationService.getCurrentPosition).toHaveBeenCalledWith({
        accuracyMeters: 100,
        timeoutMs: 10_000,
      });
    });
  });
});

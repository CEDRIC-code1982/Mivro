/**
 * @file RNGeolocationService.test.ts
 * @description Tests unitaires de l'adapter RNGeolocationService.
 *              Unit tests for the RNGeolocationService adapter.
 *
 * @module __tests__/unit/infrastructure/geolocation/RNGeolocationService
 */

// [ADDED] Tests unitaires RNGeolocationService

// ─── Mocks ──────────────────────────────────────────────────
// Global mock from jest.setup.js provides the base mock.
// We get references to the mocked functions here.

import Geolocation from '@react-native-community/geolocation';
import { mock } from 'jest-mock-extended';
import { PermissionsAndroid, Platform } from 'react-native';
import type { ICrashReporter } from '@core/ports/ICrashReporter';
import { RNGeolocationService } from '@infrastructure/geolocation/RNGeolocationService';

const mockSetRNConfiguration = Geolocation.setRNConfiguration as jest.Mock;
const mockGetCurrentPosition = Geolocation.getCurrentPosition as jest.Mock;

// ─── Helpers ────────────────────────────────────────────────

/** Simule une réponse GPS native valide / Simulates a valid native GPS response */
const validNativeResponse = (latitude = 48.8566, longitude = 2.3522, accuracy = 10) => ({
  coords: { latitude, longitude, accuracy, altitude: 35, heading: 0, speed: 0 },
  timestamp: Date.now(),
});

/**
 * Helper : fait en sorte que mockGetCurrentPosition appelle le success callback
 */
const mockGPSSuccess = (response: ReturnType<typeof validNativeResponse>) => {
  mockGetCurrentPosition.mockImplementation((success: (r: unknown) => void) => {
    success(response);
  });
};

/**
 * Helper : fait en sorte que mockGetCurrentPosition appelle le error callback
 */
const mockGPSError = (code: number, message: string) => {
  mockGetCurrentPosition.mockImplementation(
    (_success: unknown, error: (e: { code: number; message: string }) => void) => {
      error({ code, message });
    },
  );
};

// ─── Tests ──────────────────────────────────────────────────

describe('RNGeolocationService', () => {
  const mockCrashReporter = mock<ICrashReporter>();
  let service: RNGeolocationService;
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to iOS to skip Android permission flow
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    service = new RNGeolocationService(mockCrashReporter);
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, writable: true });
  });

  // ─── Configuration ──────────────────────────────────────
  describe('configuration', () => {
    it('calls setRNConfiguration on instantiation', () => {
      expect(mockSetRNConfiguration).toHaveBeenCalledWith({
        skipPermissionRequests: false,
        authorizationLevel: 'whenInUse',
      });
    });
  });

  // ─── Success ────────────────────────────────────────────
  describe('successful position', () => {
    it('returns valid Coordinates', async () => {
      mockGPSSuccess(validNativeResponse(48.8566, 2.3522, 10));

      const result = await service.getCurrentPosition();

      expect(result).toEqual({ latitude: 48.8566, longitude: 2.3522 });
    });

    it('passes enableHighAccuracy true when accuracyMeters <= 50', async () => {
      mockGPSSuccess(validNativeResponse(48.8566, 2.3522, 5));

      await service.getCurrentPosition({ accuracyMeters: 50 });

      const callOptions = mockGetCurrentPosition.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(callOptions.enableHighAccuracy).toBe(true);
    });

    it('passes enableHighAccuracy false when accuracyMeters > 50', async () => {
      mockGPSSuccess(validNativeResponse(48.8566, 2.3522, 80));

      await service.getCurrentPosition({ accuracyMeters: 100 });

      const callOptions = mockGetCurrentPosition.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(callOptions.enableHighAccuracy).toBe(false);
    });

    it('passes timeout and maximumAge to native', async () => {
      mockGPSSuccess(validNativeResponse(48.8566, 2.3522, 10));

      await service.getCurrentPosition({ timeoutMs: 5000, maximumAgeMs: 30000 });

      const callOptions = mockGetCurrentPosition.mock.calls[0]?.[2] as Record<string, unknown>;
      expect(callOptions.timeout).toBe(5000);
      expect(callOptions.maximumAge).toBe(30000);
    });
  });

  // ─── Accuracy check ────────────────────────────────────
  describe('accuracy check', () => {
    it('rejects with "inaccurate" when accuracy exceeds threshold', async () => {
      mockGPSSuccess(validNativeResponse(48.8566, 2.3522, 200));

      await expect(service.getCurrentPosition({ accuracyMeters: 100 })).rejects.toMatchObject({
        code: 'inaccurate',
      });
    });

    it('resolves when accuracy equals threshold', async () => {
      mockGPSSuccess(validNativeResponse(48.8566, 2.3522, 100));

      const result = await service.getCurrentPosition({ accuracyMeters: 100 });

      expect(result).toEqual({ latitude: 48.8566, longitude: 2.3522 });
    });
  });

  // ─── Invalid native response ───────────────────────────
  describe('invalid native response', () => {
    it('rejects with "unknown" when response shape is invalid', async () => {
      mockGetCurrentPosition.mockImplementation((success: (r: unknown) => void) => {
        success({ invalid: 'data' });
      });

      await expect(service.getCurrentPosition()).rejects.toMatchObject({
        code: 'unknown',
      });
    });

    it('reports invalid shape to Sentry', async () => {
      mockGetCurrentPosition.mockImplementation((success: (r: unknown) => void) => {
        success({ invalid: 'data' });
      });

      await expect(service.getCurrentPosition()).rejects.toThrow();

      expect(mockCrashReporter.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Geolocation native response invalid' }),
        expect.objectContaining({ tags: { feature: 'gps' } }),
      );
    });
  });

  // ─── Invalid coordinates range ─────────────────────────
  describe('invalid coordinates range', () => {
    it('rejects with "unknown" when latitude > 90', async () => {
      mockGPSSuccess(validNativeResponse(91, 2.3522, 10));

      await expect(service.getCurrentPosition()).rejects.toMatchObject({
        code: 'unknown',
      });
    });

    it('rejects with "unknown" when longitude > 180', async () => {
      mockGPSSuccess(validNativeResponse(48.8566, 181, 10));

      await expect(service.getCurrentPosition()).rejects.toMatchObject({
        code: 'unknown',
      });
    });
  });

  // ─── Native errors ─────────────────────────────────────
  describe('native errors', () => {
    it('maps code 1 to "permission_denied"', async () => {
      mockGPSError(1, 'User denied');

      await expect(service.getCurrentPosition()).rejects.toMatchObject({
        code: 'permission_denied',
      });
    });

    it('reports permission denied to Sentry as info', async () => {
      mockGPSError(1, 'User denied');

      await expect(service.getCurrentPosition()).rejects.toThrow();

      expect(mockCrashReporter.captureMessage).toHaveBeenCalledWith('GPS permission denied', {
        level: 'info',
        tags: { feature: 'gps' },
      });
    });

    it('maps code 2 to "unavailable"', async () => {
      mockGPSError(2, 'Position unavailable');

      await expect(service.getCurrentPosition()).rejects.toMatchObject({
        code: 'unavailable',
      });
    });

    it('maps code 3 to "timeout"', async () => {
      mockGPSError(3, 'Timeout');

      await expect(service.getCurrentPosition()).rejects.toMatchObject({
        code: 'timeout',
      });
    });

    it('reports timeout to Sentry as warning', async () => {
      mockGPSError(3, 'Timeout');

      await expect(service.getCurrentPosition()).rejects.toThrow();

      expect(mockCrashReporter.captureMessage).toHaveBeenCalledWith('GPS timeout', {
        level: 'warning',
        tags: { feature: 'gps' },
      });
    });

    it('maps unknown code to "unknown"', async () => {
      mockGPSError(99, 'Something weird');

      await expect(service.getCurrentPosition()).rejects.toMatchObject({
        code: 'unknown',
      });
    });

    it('reports unknown error to Sentry via captureException', async () => {
      mockGPSError(99, 'Something weird');

      await expect(service.getCurrentPosition()).rejects.toThrow();

      expect(mockCrashReporter.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'GPS native error: Something weird' }),
        expect.objectContaining({ tags: { feature: 'gps' } }),
      );
    });
  });

  // ─── Android permission ─────────────────────────────────
  describe('Android permission', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
      service = new RNGeolocationService(mockCrashReporter);
    });

    it('requests permission on Android before getting position', async () => {
      const requestSpy = jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValueOnce(PermissionsAndroid.RESULTS.GRANTED);
      mockGPSSuccess(validNativeResponse(48.8566, 2.3522, 10));

      await service.getCurrentPosition();

      expect(requestSpy).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        expect.objectContaining({ buttonPositive: 'OK' }),
      );
      requestSpy.mockRestore();
    });

    it('throws "permission_denied" when Android permission is denied', async () => {
      const requestSpy = jest
        .spyOn(PermissionsAndroid, 'request')
        .mockResolvedValueOnce(PermissionsAndroid.RESULTS.DENIED);

      await expect(service.getCurrentPosition()).rejects.toMatchObject({
        code: 'permission_denied',
      });

      requestSpy.mockRestore();
    });

    it('throws "permission_denied" when Android permission request fails', async () => {
      const requestSpy = jest
        .spyOn(PermissionsAndroid, 'request')
        .mockRejectedValueOnce(new Error('Permission API crash'));

      await expect(service.getCurrentPosition()).rejects.toMatchObject({
        code: 'permission_denied',
      });

      requestSpy.mockRestore();
    });

    it('does NOT request permission on iOS', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
      service = new RNGeolocationService(mockCrashReporter);
      const requestSpy = jest.spyOn(PermissionsAndroid, 'request');
      mockGPSSuccess(validNativeResponse(48.8566, 2.3522, 10));

      await service.getCurrentPosition();

      expect(requestSpy).not.toHaveBeenCalled();
      requestSpy.mockRestore();
    });
  });

  // ─── Without crash reporter ─────────────────────────────
  describe('without crash reporter', () => {
    it('does not throw when crashReporter is undefined', async () => {
      const serviceNoCrash = new RNGeolocationService();
      mockGPSSuccess(validNativeResponse(48.8566, 2.3522, 10));

      const result = await serviceNoCrash.getCurrentPosition();

      expect(result).toEqual({ latitude: 48.8566, longitude: 2.3522 });
    });
  });
});

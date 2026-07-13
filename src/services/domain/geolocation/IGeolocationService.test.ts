/**
 * @file IGeolocationService.test.ts
 * @description Tests unitaires du port IGeolocationService et GeolocationError.
 *              Unit tests for the IGeolocationService port and GeolocationError.
 *
 * @module __tests__/unit/core/ports/IGeolocationService
 */

// [ADDED] Tests unitaires GeolocationError
import { GeolocationError } from '@services/domain/geolocation/IGeolocationService';
import type { GeolocationErrorCode } from '@services/domain/geolocation/IGeolocationService';

describe('IGeolocationService port', () => {
  // ─── GeolocationError ────────────────────────────────────────
  describe('GeolocationError', () => {
    it('is an instance of Error', () => {
      const error = new GeolocationError('test', 'timeout');

      expect(error).toBeInstanceOf(Error);
    });

    it('has name "GeolocationError"', () => {
      const error = new GeolocationError('test', 'permission_denied');

      expect(error.name).toBe('GeolocationError');
    });

    it('stores the message correctly', () => {
      const error = new GeolocationError('GPS unavailable', 'unavailable');

      expect(error.message).toBe('GPS unavailable');
    });

    it('stores the error code correctly', () => {
      const error = new GeolocationError('test', 'inaccurate');

      expect(error.code).toBe('inaccurate');
    });

    it('stores the optional cause', () => {
      const originalError = new Error('native crash');
      const error = new GeolocationError('test', 'unknown', originalError);

      expect(error.cause).toBe(originalError);
    });

    it('has undefined cause when not provided', () => {
      const error = new GeolocationError('test', 'timeout');

      expect(error.cause).toBeUndefined();
    });

    it.each<GeolocationErrorCode>([
      'permission_denied',
      'permission_blocked',
      'unavailable',
      'timeout',
      'inaccurate',
      'unknown',
    ])('supports error code "%s"', (code) => {
      const error = new GeolocationError('test', code);

      expect(error.code).toBe(code);
    });
  });
});

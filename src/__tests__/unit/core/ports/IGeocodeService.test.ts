/**
 * @file IGeocodeService.test.ts
 * @description Tests unitaires du port IGeocodeService et GeocodeError.
 *              Unit tests for the IGeocodeService port and GeocodeError.
 *
 * @module __tests__/unit/core/ports/IGeocodeService
 */

// [ADDED] Tests unitaires GeocodeError
import { GeocodeError } from '@core/ports/IGeocodeService';
import type { GeocodeErrorCode } from '@core/ports/IGeocodeService';

describe('IGeocodeService port', () => {
  // ─── GeocodeError ────────────────────────────────────────────
  describe('GeocodeError', () => {
    it('is an instance of Error', () => {
      const error = new GeocodeError('test', 'network');

      expect(error).toBeInstanceOf(Error);
    });

    it('has name "GeocodeError"', () => {
      const error = new GeocodeError('test', 'rate_limited');

      expect(error.name).toBe('GeocodeError');
    });

    it('stores the message correctly', () => {
      const error = new GeocodeError('Something went wrong', 'server_error');

      expect(error.message).toBe('Something went wrong');
    });

    it('stores the error code correctly', () => {
      const error = new GeocodeError('Rate limited', 'rate_limited');

      expect(error.code).toBe('rate_limited');
    });

    it('stores the optional cause', () => {
      const originalError = new TypeError('fetch failed');
      const error = new GeocodeError('Network error', 'network', originalError);

      expect(error.cause).toBe(originalError);
    });

    it('has undefined cause when not provided', () => {
      const error = new GeocodeError('test', 'parse_error');

      expect(error.cause).toBeUndefined();
    });

    it.each<GeocodeErrorCode>([
      'rate_limited',
      'network',
      'invalid_query',
      'parse_error',
      'server_error',
      'no_results', // [ADDED]
    ])('supports error code "%s"', (code) => {
      const error = new GeocodeError('test', code);

      expect(error.code).toBe(code);
    });
  });
});

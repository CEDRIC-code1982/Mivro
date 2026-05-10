/**
 * @file IPOIService.test.ts
 * @description Tests unitaires du port IPOIService.
 *              Unit tests for the IPOIService port.
 *
 * @module __tests__/unit/core/ports/IPOIService
 */

// [ADDED] Tests unitaires port IPOIService
import { POIError } from '@core/ports/IPOIService';
import type { POIErrorCode } from '@core/ports/IPOIService';

describe('IPOIService port', () => {
  // ─── POIError ─────────────────────────────────────────────
  describe('POIError', () => {
    it('is an instance of Error', () => {
      const error = new POIError('test', 'network');
      expect(error).toBeInstanceOf(Error);
    });

    it('has name "POIError"', () => {
      const error = new POIError('test', 'network');
      expect(error.name).toBe('POIError');
    });

    it('stores the error code', () => {
      const error = new POIError('rate limited', 'rate_limited');
      expect(error.code).toBe('rate_limited');
    });

    it('stores the message', () => {
      const error = new POIError('Something broke', 'server_error');
      expect(error.message).toBe('Something broke');
    });

    it('stores optional cause', () => {
      const originalError = new TypeError('fetch failed');
      const error = new POIError('Network error', 'network', originalError);
      expect(error.cause).toBe(originalError);
    });

    it('cause is undefined when not provided', () => {
      const error = new POIError('test', 'parse_error');
      expect(error.cause).toBeUndefined();
    });

    it.each<POIErrorCode>([
      'rate_limited',
      'network',
      'invalid_input',
      'parse_error',
      'server_error',
      'query_timeout',
    ])('accepts error code: %s', (code) => {
      const error = new POIError('test', code);
      expect(error.code).toBe(code);
    });
  });
});

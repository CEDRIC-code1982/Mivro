/**
 * @file IRealtimeService.test.ts
 * @description Tests unitaires du port IRealtimeService et RealtimeError.
 *              Unit tests for the IRealtimeService port and RealtimeError.
 *
 * @module services/domain/realtime/IRealtimeService.test
 */

// [ADDED] F4 — Tests unitaires RealtimeError
import { RealtimeError } from '@services/domain/realtime/IRealtimeService';
import type { RealtimeErrorCode } from '@services/domain/realtime/IRealtimeService';

describe('IRealtimeService port', () => {
  describe('RealtimeError', () => {
    it('is an instance of Error', () => {
      expect(new RealtimeError('test', 'network')).toBeInstanceOf(Error);
    });

    it('has name "RealtimeError"', () => {
      expect(new RealtimeError('test', 'unknown').name).toBe('RealtimeError');
    });

    it('stores the message', () => {
      expect(new RealtimeError('boom', 'network').message).toBe('boom');
    });

    it('stores the error code', () => {
      expect(new RealtimeError('test', 'permission_denied').code).toBe('permission_denied');
    });

    it('stores the optional cause', () => {
      const cause = new Error('original');
      expect(new RealtimeError('test', 'unknown', cause).cause).toBe(cause);
    });

    it('has undefined cause when not provided', () => {
      expect(new RealtimeError('test', 'network').cause).toBeUndefined();
    });

    it.each<RealtimeErrorCode>([
      'not_configured',
      'network',
      'permission_denied',
      'invalid_data',
      'unknown',
    ])('supports error code "%s"', (code) => {
      expect(new RealtimeError('test', code).code).toBe(code);
    });
  });
});

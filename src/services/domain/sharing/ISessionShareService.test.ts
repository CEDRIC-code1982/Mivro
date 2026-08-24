/**
 * @file ISessionShareService.test.ts
 * @description Tests unitaires de l'erreur typée SessionShareError (F5).
 *              Unit tests for the typed SessionShareError (F5).
 *
 * @module services/domain/sharing/ISessionShareService.test
 */

// [ADDED] F5 — Tests unitaires SessionShareError
import {
  SessionShareError,
  type SessionShareErrorCode,
} from '@services/domain/sharing/ISessionShareService';

describe('SessionShareError', () => {
  it('is an Error subclass with name SessionShareError', () => {
    const error = new SessionShareError('boom', 'unknown');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SessionShareError');
    expect(error.message).toBe('boom');
  });

  it('exposes the typed code', () => {
    const error = new SessionShareError('not found', 'not_found');
    expect(error.code).toBe('not_found');
  });

  it('keeps the original cause when provided', () => {
    const cause = new Error('original');
    const error = new SessionShareError('wrapped', 'network', cause);
    expect(error.cause).toBe(cause);
  });

  it('leaves cause undefined when not provided', () => {
    const error = new SessionShareError('x', 'closed');
    expect(error.cause).toBeUndefined();
  });

  it('supports all documented error codes', () => {
    const codes: SessionShareErrorCode[] = [
      'not_configured',
      'not_found',
      'expired',
      'closed',
      'network',
      'permission_denied',
      'invalid_data',
      'unknown',
    ];
    for (const code of codes) {
      expect(new SessionShareError('m', code).code).toBe(code);
    }
  });
});

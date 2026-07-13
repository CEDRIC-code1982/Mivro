/**
 * @file IBiometricService.test.ts
 * @description Tests unitaires de l'erreur typée BiometricError + types (F8).
 *              Unit tests for the typed BiometricError + types (F8).
 *
 * @module __tests__/unit/core/ports/IBiometricService
 */

// [ADDED] F8 — Tests unitaires BiometricError
import {
  BiometricError,
  type BiometricErrorCode,
  type BiometricType,
} from '@services/domain/biometric/IBiometricService';

describe('BiometricError', () => {
  it('is an Error subclass with name BiometricError', () => {
    const error = new BiometricError('boom', 'unknown');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BiometricError');
    expect(error.message).toBe('boom');
  });

  it('exposes the typed code', () => {
    const error = new BiometricError('cancelled by user', 'cancelled');
    expect(error.code).toBe('cancelled');
  });

  it('keeps the original cause when provided', () => {
    const cause = new Error('original');
    const error = new BiometricError('wrapped', 'failed', cause);
    expect(error.cause).toBe(cause);
  });

  it('leaves cause undefined when not provided', () => {
    const error = new BiometricError('x', 'not_enrolled');
    expect(error.cause).toBeUndefined();
  });

  it('supports all documented error codes', () => {
    const codes: BiometricErrorCode[] = [
      'not_available',
      'not_enrolled',
      'cancelled',
      'failed',
      'unknown',
    ];
    for (const code of codes) {
      expect(new BiometricError('m', code).code).toBe(code);
    }
  });

  it('supports all documented biometric types', () => {
    const types: BiometricType[] = ['face', 'fingerprint', 'iris'];
    // Type-level guard: this array exhaustively lists the union members.
    expect(types).toHaveLength(3);
  });
});

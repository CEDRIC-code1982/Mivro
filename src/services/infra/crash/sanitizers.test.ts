/**
 * @file sanitizers.test.ts
 * @description Tests unitaires des sanitizers RGPD.
 *              Unit tests for GDPR sanitizers.
 *
 * @module __tests__/unit/infrastructure/crash/sanitizers
 */

// [ADDED] Tests unitaires sanitizers RGPD

import { isSensitiveKey, sanitizeString, sanitizeObject } from '@services/infra/crash/sanitizers';

describe('sanitizers', () => {
  // ─── isSensitiveKey ──────────────────────────────────────
  describe('isSensitiveKey', () => {
    it.each([
      'latitude',
      'lat',
      'userLatitude',
      'lng',
      'longitude',
      'lon',
      'location',
      'startLocation',
      'coordinates',
      'geoCoordinates',
      'geo',
      'token',
      'authToken',
      'refreshToken',
      'secret',
      'apiSecret',
      'password',
      'userPassword',
    ])('recognizes "%s" as sensitive', (key) => {
      expect(isSensitiveKey(key)).toBe(true);
    });

    it.each([
      'name',
      'displayName',
      'id',
      'type',
      'feature',
      'screen',
      'action',
      'message',
      'category',
      'level',
      'timestamp',
      'status',
      'version',
    ])('does NOT flag "%s" as sensitive', (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    });
  });

  // ─── sanitizeString ──────────────────────────────────────
  describe('sanitizeString', () => {
    it('replaces emails with [REDACTED]', () => {
      expect(sanitizeString('contact user@example.com for help')).toBe(
        'contact [REDACTED] for help',
      );
    });

    it('replaces multiple emails in one string', () => {
      expect(sanitizeString('a@b.com and c@d.org')).toBe('[REDACTED] and [REDACTED]');
    });

    it('leaves non-email strings unchanged', () => {
      expect(sanitizeString('just a plain string')).toBe('just a plain string');
    });

    it('handles empty string', () => {
      expect(sanitizeString('')).toBe('');
    });
  });

  // ─── sanitizeObject ──────────────────────────────────────
  describe('sanitizeObject', () => {
    it('redacts values of sensitive keys', () => {
      const input = {
        latitude: 48.8566,
        longitude: 2.3522,
        name: 'Paris',
      };

      const result = sanitizeObject(input) as Record<string, unknown>;

      expect(result.latitude).toBe('[REDACTED]');
      expect(result.longitude).toBe('[REDACTED]');
      expect(result.name).toBe('Paris');
    });

    it('sanitizes nested objects recursively', () => {
      const input = {
        user: {
          id: '123',
          location: { lat: 48.85, lng: 2.35 },
        },
      };

      const result = sanitizeObject(input) as Record<string, unknown>;
      const user = result.user as Record<string, unknown>;

      expect(user.id).toBe('123');
      expect(user.location).toBe('[REDACTED]');
    });

    it('sanitizes arrays recursively', () => {
      const input = [
        { name: 'Alice', token: 'abc123' },
        { name: 'Bob', secret: 'xyz' },
      ];

      const result = sanitizeObject(input) as Array<Record<string, unknown>>;

      expect(result[0]?.name).toBe('Alice');
      expect(result[0]?.token).toBe('[REDACTED]');
      expect(result[1]?.name).toBe('Bob');
      expect(result[1]?.secret).toBe('[REDACTED]');
    });

    it('replaces emails inside string values', () => {
      const input = {
        message: 'Error for user@example.com',
        feature: 'login',
      };

      const result = sanitizeObject(input) as Record<string, unknown>;

      expect(result.message).toBe('Error for [REDACTED]');
      expect(result.feature).toBe('login');
    });

    it('limits recursion depth to prevent infinite loops', () => {
      // Crée un objet profondément imbriqué (> MAX_DEPTH)
      let deep: Record<string, unknown> = { value: 'bottom' };
      for (let i = 0; i < 15; i++) {
        deep = { nested: deep };
      }

      const result = sanitizeObject(deep) as Record<string, unknown>;

      // Doit atteindre [MAX_DEPTH] quelque part dans la profondeur
      const findMaxDepth = (obj: unknown): boolean => {
        if (obj === '[MAX_DEPTH]') return true;
        if (typeof obj !== 'object' || obj === null) return false;
        return Object.values(obj).some(findMaxDepth);
      };

      expect(findMaxDepth(result)).toBe(true);
    });

    it('handles null and undefined gracefully', () => {
      expect(sanitizeObject(null)).toBeNull();
      expect(sanitizeObject(undefined)).toBeUndefined();
    });

    it('passes through primitives unchanged', () => {
      expect(sanitizeObject(42)).toBe(42);
      expect(sanitizeObject(true)).toBe(true);
    });

    it('redacts token keys in deeply nested structures', () => {
      const input = {
        data: {
          auth: {
            refreshToken: 'eyJhbGciOiJIUzI1NiJ9',
            userId: '550e8400',
          },
        },
      };

      const result = sanitizeObject(input) as Record<string, unknown>;
      const auth = (result.data as Record<string, unknown>).auth as Record<string, unknown>;

      expect(auth.refreshToken).toBe('[REDACTED]');
      expect(auth.userId).toBe('550e8400');
    });

    it('redacts GPS coordinate keys regardless of case', () => {
      const input = {
        Latitude: 48.85,
        LONGITUDE: 2.35,
        GeoLocation: 'Paris',
      };

      const result = sanitizeObject(input) as Record<string, unknown>;

      expect(result.Latitude).toBe('[REDACTED]');
      expect(result.LONGITUDE).toBe('[REDACTED]');
      expect(result.GeoLocation).toBe('[REDACTED]');
    });
  });
});

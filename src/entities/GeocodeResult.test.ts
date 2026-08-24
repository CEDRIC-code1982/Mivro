/**
 * @file GeocodeResult.test.ts
 * @description Tests unitaires de l'entité GeocodeResult.
 *              Unit tests for the GeocodeResult entity.
 *
 * @module entities/GeocodeResult.test
 */

// [ADDED] Tests unitaires entité GeocodeResult
import { GeocodeResultSchema } from '@entities/GeocodeResult';

describe('GeocodeResult entity', () => {
  // ─── GeocodeResultSchema ────────────────────────────────────
  describe('GeocodeResultSchema', () => {
    const validResult = {
      externalId: '12345',
      coordinates: { latitude: 48.8566, longitude: 2.3522 },
      displayName: 'Tour Eiffel, Paris, France',
      placeType: 'attraction',
      importance: 0.85,
    };

    it('parses a valid GeocodeResult with all fields', () => {
      const result = GeocodeResultSchema.parse(validResult);

      expect(result.externalId).toBe('12345');
      expect(result.coordinates.latitude).toBe(48.8566);
      expect(result.coordinates.longitude).toBe(2.3522);
      expect(result.displayName).toBe('Tour Eiffel, Paris, France');
      expect(result.placeType).toBe('attraction');
      expect(result.importance).toBe(0.85);
    });

    it('accepts optional placeType and importance', () => {
      const result = GeocodeResultSchema.parse({
        externalId: '12345',
        coordinates: { latitude: 48.8566, longitude: 2.3522 },
        displayName: 'Tour Eiffel, Paris, France',
      });

      expect(result.placeType).toBeUndefined();
      expect(result.importance).toBeUndefined();
    });

    it('rejects empty displayName', () => {
      const result = GeocodeResultSchema.safeParse({
        ...validResult,
        displayName: '',
      });

      expect(result.success).toBe(false);
    });

    it('rejects importance > 1', () => {
      const result = GeocodeResultSchema.safeParse({
        ...validResult,
        importance: 1.5,
      });

      expect(result.success).toBe(false);
    });

    it('rejects importance < 0', () => {
      const result = GeocodeResultSchema.safeParse({
        ...validResult,
        importance: -0.1,
      });

      expect(result.success).toBe(false);
    });

    it('accepts importance at boundaries (0 and 1)', () => {
      const resultMin = GeocodeResultSchema.parse({
        ...validResult,
        importance: 0,
      });
      const resultMax = GeocodeResultSchema.parse({
        ...validResult,
        importance: 1,
      });

      expect(resultMin.importance).toBe(0);
      expect(resultMax.importance).toBe(1);
    });

    it('validates coordinates (rejects invalid latitude)', () => {
      const result = GeocodeResultSchema.safeParse({
        ...validResult,
        coordinates: { latitude: 91, longitude: 2.3522 },
      });

      expect(result.success).toBe(false);
    });

    it('validates coordinates (rejects invalid longitude)', () => {
      const result = GeocodeResultSchema.safeParse({
        ...validResult,
        coordinates: { latitude: 48.8566, longitude: 181 },
      });

      expect(result.success).toBe(false);
    });
  });
});

/**
 * @file PointOfInterest.test.ts
 * @description Tests unitaires de l'entité PointOfInterest.
 *              Unit tests for the PointOfInterest entity.
 *
 * @module entities/PointOfInterest.test
 */

// [ADDED] Tests unitaires entité PointOfInterest
import { PointOfInterestSchema } from '@entities/PointOfInterest';

const VALID_POI = {
  externalId: 'node/12345',
  category: 'restaurant' as const,
  name: 'Le Petit Bistro',
  coordinates: { latitude: 48.8566, longitude: 2.3522 },
};

describe('PointOfInterest entity', () => {
  // ─── PointOfInterestSchema ────────────────────────────────
  describe('PointOfInterestSchema', () => {
    it('parses a valid POI', () => {
      const poi = PointOfInterestSchema.parse(VALID_POI);

      expect(poi.externalId).toBe('node/12345');
      expect(poi.category).toBe('restaurant');
      expect(poi.name).toBe('Le Petit Bistro');
      expect(poi.coordinates.latitude).toBe(48.8566);
      expect(poi.coordinates.longitude).toBe(2.3522);
    });

    it('parses POI with optional address', () => {
      const poi = PointOfInterestSchema.parse({
        ...VALID_POI,
        address: '1 Rue de Rivoli, 75001 Paris',
      });

      expect(poi.address).toBe('1 Rue de Rivoli, 75001 Paris');
    });

    it('parses POI with optional tags', () => {
      const poi = PointOfInterestSchema.parse({
        ...VALID_POI,
        tags: { amenity: 'restaurant', cuisine: 'french' },
      });

      expect(poi.tags).toEqual({ amenity: 'restaurant', cuisine: 'french' });
    });

    it('accepts POI without address and tags', () => {
      const poi = PointOfInterestSchema.parse(VALID_POI);

      expect(poi.address).toBeUndefined();
      expect(poi.tags).toBeUndefined();
    });

    it('rejects empty name', () => {
      const result = PointOfInterestSchema.safeParse({
        ...VALID_POI,
        name: '',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid category', () => {
      const result = PointOfInterestSchema.safeParse({
        ...VALID_POI,
        category: 'bowling',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid coordinates', () => {
      const result = PointOfInterestSchema.safeParse({
        ...VALID_POI,
        coordinates: { latitude: 200, longitude: 2.3522 },
      });

      expect(result.success).toBe(false);
    });

    it('parses POI with way externalId format', () => {
      const poi = PointOfInterestSchema.parse({
        ...VALID_POI,
        externalId: 'way/98765',
      });

      expect(poi.externalId).toBe('way/98765');
    });
  });
});

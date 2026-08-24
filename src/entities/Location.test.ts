/**
 * @file Location.test.ts
 * @description Tests unitaires de l'entité Location.
 *              Unit tests for the Location entity.
 *
 * @module entities/Location.test
 */

// [ADDED] Tests unitaires entité Location
import { CoordinatesSchema, LocationSchema } from '@entities/Location';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Location entity', () => {
  // ─── CoordinatesSchema ────────────────────────────────────
  describe('CoordinatesSchema', () => {
    it('parses valid coordinates', () => {
      const coords = CoordinatesSchema.parse({
        latitude: 48.8566,
        longitude: 2.3522,
      });

      expect(coords.latitude).toBe(48.8566);
      expect(coords.longitude).toBe(2.3522);
    });

    it('accepts boundary values (90, 180)', () => {
      const coords = CoordinatesSchema.parse({
        latitude: 90,
        longitude: 180,
      });

      expect(coords.latitude).toBe(90);
      expect(coords.longitude).toBe(180);
    });

    it('accepts negative boundary values (-90, -180)', () => {
      const coords = CoordinatesSchema.parse({
        latitude: -90,
        longitude: -180,
      });

      expect(coords.latitude).toBe(-90);
      expect(coords.longitude).toBe(-180);
    });

    it('rejects latitude > 90', () => {
      const result = CoordinatesSchema.safeParse({
        latitude: 91,
        longitude: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects latitude < -90', () => {
      const result = CoordinatesSchema.safeParse({
        latitude: -91,
        longitude: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects longitude > 180', () => {
      const result = CoordinatesSchema.safeParse({
        latitude: 0,
        longitude: 181,
      });

      expect(result.success).toBe(false);
    });

    it('rejects longitude < -180', () => {
      const result = CoordinatesSchema.safeParse({
        latitude: 0,
        longitude: -181,
      });

      expect(result.success).toBe(false);
    });
  });

  // ─── LocationSchema ───────────────────────────────────────
  describe('LocationSchema', () => {
    it('parses a valid Location', () => {
      const location = LocationSchema.parse({
        id: VALID_UUID,
        coordinates: { latitude: 48.8566, longitude: 2.3522 },
        formattedAddress: '1 Rue de Rivoli, 75001 Paris',
        city: 'Paris',
        country: 'France',
      });

      expect(location.formattedAddress).toBe('1 Rue de Rivoli, 75001 Paris');
      expect(location.city).toBe('Paris');
    });

    it('accepts optional city and country', () => {
      const location = LocationSchema.parse({
        id: VALID_UUID,
        coordinates: { latitude: 48.8566, longitude: 2.3522 },
        formattedAddress: 'Somewhere',
      });

      expect(location.city).toBeUndefined();
      expect(location.country).toBeUndefined();
    });

    it('rejects empty formattedAddress', () => {
      const result = LocationSchema.safeParse({
        id: VALID_UUID,
        coordinates: { latitude: 48.8566, longitude: 2.3522 },
        formattedAddress: '',
      });

      expect(result.success).toBe(false);
    });
  });
});

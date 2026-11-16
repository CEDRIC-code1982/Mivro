/**
 * @file CalculateMidpointUseCase.test.ts
 * @description Unit tests for the CalculateMidpoint use case.
 *
 * @module services/domain/midpoint/CalculateMidpointUseCase.test
 */

// [ADDED] CalculateMidpointUseCase unit tests

import type { Coordinates } from '@entities/Location';
import { MidpointSessionSchema, type Participant } from '@entities/MidpointSession';
import { SharedSessionMetaSchema } from '@entities/SharedSession';
import {
  CalculateMidpointUseCase,
  CalculateMidpointError,
  MIN_ZONE_RADIUS_M,
} from '@services/domain/midpoint/CalculateMidpointUseCase';
import { computeRadius } from '@services/utils/geo';
import { PARIS, LYON, MARSEILLE } from '@test-utils/coordinates';

/** Latitude offset of ~100 m: two participants this far apart get a computed radius of ~50 m. */
const LAT_OFFSET_100_M = 0.0009;
/** Latitude offset of ~1.1 km: computed radius of ~556 m, just above the floor. */
const LAT_OFFSET_1_1_KM = 0.01;

/**
 * Creates a minimal Participant from coordinates.
 *
 * @param name — display name
 * @param coords — start coordinates
 * @returns Participant with a stub location
 */
const makeParticipant = (name: string, coords: Coordinates): Participant => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  displayName: name,
  startLocation: {
    id: '660e8400-e29b-41d4-a716-446655440001',
    coordinates: coords,
    formattedAddress: `${coords.latitude}, ${coords.longitude}`,
  },
});

/**
 * Returns `coords` moved north by `latOffset` degrees.
 *
 * @param coords — reference coordinates
 * @param latOffset — latitude offset in degrees
 * @returns the shifted coordinates
 */
const shiftNorth = (coords: Coordinates, latOffset: number): Coordinates => ({
  latitude: coords.latitude + latOffset,
  longitude: coords.longitude,
});

describe('CalculateMidpointUseCase', () => {
  let useCase: CalculateMidpointUseCase;

  beforeEach(() => {
    useCase = new CalculateMidpointUseCase();
    // Silence console.info during tests
    jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validation', () => {
    it('should throw too_few_participants for 0 participants', () => {
      expect(() => useCase.execute({ participants: [] })).toThrow(CalculateMidpointError);

      try {
        useCase.execute({ participants: [] });
      } catch (err) {
        expect(err).toBeInstanceOf(CalculateMidpointError);
        expect((err as CalculateMidpointError).code).toBe('too_few_participants');
      }
    });

    it('should throw too_few_participants for 1 participant', () => {
      const participants = [makeParticipant('Alice', PARIS)];

      expect(() => useCase.execute({ participants })).toThrow(CalculateMidpointError);

      try {
        useCase.execute({ participants });
      } catch (err) {
        expect(err).toBeInstanceOf(CalculateMidpointError);
        expect((err as CalculateMidpointError).code).toBe('too_few_participants');
      }
    });

    it('should throw too_many_participants for 6 participants', () => {
      const coords = { latitude: 48, longitude: 2 };
      const participants = Array.from({ length: 6 }, (_, i) => makeParticipant(`P${i}`, coords));

      expect(() => useCase.execute({ participants })).toThrow(CalculateMidpointError);

      try {
        useCase.execute({ participants });
      } catch (err) {
        expect(err).toBeInstanceOf(CalculateMidpointError);
        expect((err as CalculateMidpointError).code).toBe('too_many_participants');
      }
    });
  });

  describe('calculation', () => {
    it('should compute midpoint between Paris and Lyon', () => {
      const participants = [makeParticipant('Alice', PARIS), makeParticipant('Bob', LYON)];

      const result = useCase.execute({ participants });

      // Cartesian centroid = arithmetic mean of lat/lng
      const expectedLat = (PARIS.latitude + LYON.latitude) / 2;
      const expectedLon = (PARIS.longitude + LYON.longitude) / 2;

      expect(result.midpoint.latitude).toBeCloseTo(expectedLat, 4);
      expect(result.midpoint.longitude).toBeCloseTo(expectedLon, 4);

      // Radius ≈ 196 km (each city is ~196 km from the centroid)
      const radiusKm = result.radius / 1000;
      expect(radiusKm).toBeGreaterThan(180);
      expect(radiusKm).toBeLessThan(210);
    });

    it('should compute midpoint for 3 points (Paris, Lyon, Marseille)', () => {
      const participants = [
        makeParticipant('Alice', PARIS),
        makeParticipant('Bob', LYON),
        makeParticipant('Charlie', MARSEILLE),
      ];

      const result = useCase.execute({ participants });

      const expectedLat = (PARIS.latitude + LYON.latitude + MARSEILLE.latitude) / 3;
      const expectedLon = (PARIS.longitude + LYON.longitude + MARSEILLE.longitude) / 3;

      expect(result.midpoint.latitude).toBeCloseTo(expectedLat, 4);
      expect(result.midpoint.longitude).toBeCloseTo(expectedLon, 4);

      // Radius is the MAX distance to the centroid
      expect(result.radius).toBeGreaterThan(0);
    });

    it('should return the correct participantsCount', () => {
      const participants = [
        makeParticipant('Alice', PARIS),
        makeParticipant('Bob', LYON),
        makeParticipant('Charlie', MARSEILLE),
      ];

      const result = useCase.execute({ participants });

      expect(result.participantsCount).toBe(3);
    });

    it('should accept exactly 5 participants', () => {
      const coords = [
        PARIS,
        LYON,
        MARSEILLE,
        { latitude: 44.8378, longitude: -0.5792 }, // Bordeaux
        { latitude: 47.2184, longitude: -1.5536 }, // Nantes
      ];
      const participants = coords.map((c, i) => makeParticipant(`P${i}`, c));

      const result = useCase.execute({ participants });

      expect(result.participantsCount).toBe(5);
      expect(result.midpoint.latitude).toBeDefined();
      expect(result.midpoint.longitude).toBeDefined();
      expect(result.radius).toBeGreaterThan(0);
    });
  });

  // [FIXED] "Rayon de zone nul": the zone radius is floored at MIN_ZONE_RADIUS_M
  describe('minimum zone radius', () => {
    it('should return midpoint = same point and radius = MIN_ZONE_RADIUS_M for 2 identical points', () => {
      const participants = [makeParticipant('Alice', PARIS), makeParticipant('Bob', PARIS)];

      const result = useCase.execute({ participants });

      expect(result.midpoint.latitude).toBe(PARIS.latitude);
      expect(result.midpoint.longitude).toBe(PARIS.longitude);
      expect(result.radius).toBe(MIN_ZONE_RADIUS_M);
    });

    it('should floor the radius at MIN_ZONE_RADIUS_M for participants ~100 m apart', () => {
      const coords = [PARIS, shiftNorth(PARIS, LAT_OFFSET_100_M)];
      const participants = coords.map((c, i) => makeParticipant(`P${i}`, c));

      const result = useCase.execute({ participants });

      // Guard: the computed radius really is below the floor
      expect(computeRadius(result.midpoint, coords)).toBeLessThan(MIN_ZONE_RADIUS_M);
      expect(result.radius).toBe(MIN_ZONE_RADIUS_M);
    });

    it('should keep a computed radius just above MIN_ZONE_RADIUS_M unchanged', () => {
      const coords = [PARIS, shiftNorth(PARIS, LAT_OFFSET_1_1_KM)];
      const participants = coords.map((c, i) => makeParticipant(`P${i}`, c));

      const result = useCase.execute({ participants });

      const computed = computeRadius(result.midpoint, coords);
      expect(computed).toBeGreaterThan(MIN_ZONE_RADIUS_M);
      expect(result.radius).toBe(computed);
    });

    it('should produce a radius accepted by the session schemas (positive) for identical points', () => {
      const participants = [makeParticipant('Alice', PARIS), makeParticipant('Bob', PARIS)];

      const { radius } = useCase.execute({ participants });

      expect(MidpointSessionSchema.shape.midpointRadius.safeParse(radius).success).toBe(true);
      expect(SharedSessionMetaSchema.shape.midpointRadius.safeParse(radius).success).toBe(true);
    });
  });

  describe('logging', () => {
    it('should log INFO with participant count and radius, without raw coordinates', () => {
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();

      const participants = [makeParticipant('Alice', PARIS), makeParticipant('Bob', LYON)];

      useCase.execute({ participants });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      const logMessage = infoSpy.mock.calls[0]?.[0] as string;

      // Must contain participant count and radius
      expect(logMessage).toContain('Midpoint calculated for 2 participants');
      expect(logMessage).toContain('radius:');
      expect(logMessage).toContain('[INFO][CalculateMidpointUseCase][execute]');

      // Must NOT contain raw coordinates (GDPR)
      expect(logMessage).not.toContain(String(PARIS.latitude));
      expect(logMessage).not.toContain(String(PARIS.longitude));
      expect(logMessage).not.toContain(String(LYON.latitude));
      expect(logMessage).not.toContain(String(LYON.longitude));
    });

    it('should log the floored radius for identical points', () => {
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();

      const participants = [makeParticipant('Alice', PARIS), makeParticipant('Bob', PARIS)];

      useCase.execute({ participants });

      expect(infoSpy.mock.calls[0]?.[0]).toContain(`radius: ${MIN_ZONE_RADIUS_M}m`);
    });
  });
});

/**
 * @file CalculateMidpointUseCase.test.ts
 * @description Tests unitaires du use case CalculateMidpoint.
 *              Unit tests for the CalculateMidpoint use case.
 *
 * @module __tests__/unit/core/usecases/CalculateMidpointUseCase
 */

// [ADDED] Tests unitaires CalculateMidpointUseCase

import type { Coordinates } from '@core/entities/Location';
import type { Participant } from '@core/entities/MidpointSession';
import {
  CalculateMidpointUseCase,
  CalculateMidpointError,
} from '@core/usecases/CalculateMidpointUseCase';
import { PARIS, LYON, MARSEILLE } from '../../../helpers/coordinates';

/**
 * Crée un Participant minimal à partir de coordonnées.
 * Creates a minimal Participant from coordinates.
 *
 * @param name — nom d'affichage / display name
 * @param coords — coordonnées de départ / start coordinates
 * @returns Participant avec location factice / Participant with stub location
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

describe('CalculateMidpointUseCase', () => {
  let useCase: CalculateMidpointUseCase;

  beforeEach(() => {
    useCase = new CalculateMidpointUseCase();
    // Silence console.info pendant les tests
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

      // Centroïde cartésien = moyenne arithmétique des lat/lng
      // Cartesian centroid = arithmetic mean of lat/lng
      const expectedLat = (PARIS.latitude + LYON.latitude) / 2;
      const expectedLon = (PARIS.longitude + LYON.longitude) / 2;

      expect(result.midpoint.latitude).toBeCloseTo(expectedLat, 4);
      expect(result.midpoint.longitude).toBeCloseTo(expectedLon, 4);

      // Radius ≈ 196 km (chaque ville est à ~196 km du centroïde)
      // Radius ≈ 196 km (each city is ~196 km from centroid)
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

      // Le radius est le MAX des distances au centroïde
      // Radius is the MAX distance to centroid
      expect(result.radius).toBeGreaterThan(0);
    });

    it('should return midpoint = same point and radius = 0 for 2 identical points', () => {
      const participants = [makeParticipant('Alice', PARIS), makeParticipant('Bob', PARIS)];

      const result = useCase.execute({ participants });

      expect(result.midpoint.latitude).toBe(PARIS.latitude);
      expect(result.midpoint.longitude).toBe(PARIS.longitude);
      expect(result.radius).toBe(0);
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

  describe('logging', () => {
    it('should log INFO with participant count and radius, without raw coordinates', () => {
      const infoSpy = jest.spyOn(console, 'info').mockImplementation();

      const participants = [makeParticipant('Alice', PARIS), makeParticipant('Bob', LYON)];

      useCase.execute({ participants });

      expect(infoSpy).toHaveBeenCalledTimes(1);
      const logMessage = infoSpy.mock.calls[0]?.[0] as string;

      // Doit contenir le nombre de participants et le radius
      // Must contain participant count and radius
      expect(logMessage).toContain('Midpoint calculated for 2 participants');
      expect(logMessage).toContain('radius:');
      expect(logMessage).toContain('[INFO][CalculateMidpointUseCase][execute]');

      // NE DOIT PAS contenir les coordonnées brutes (RGPD)
      // Must NOT contain raw coordinates (GDPR)
      expect(logMessage).not.toContain(String(PARIS.latitude));
      expect(logMessage).not.toContain(String(PARIS.longitude));
      expect(logMessage).not.toContain(String(LYON.latitude));
      expect(logMessage).not.toContain(String(LYON.longitude));
    });
  });
});

/**
 * @file centroid.test.ts
 * @description Tests unitaires pour le helper computeCentroid (centroïde cartésien).
 *              Unit tests for the computeCentroid helper (cartesian centroid).
 *
 * @module services/utils/geo/centroid.test
 */

// [ADDED] Tests unitaires computeCentroid

import { computeCentroid, CentroidError } from '@services/utils/geo/centroid';
import { PARIS, LYON, MARSEILLE, NYC, TOKYO } from '@test-utils/coordinates';

describe('computeCentroid', () => {
  it('should return the same point for a single-point list', () => {
    const result = computeCentroid([PARIS]);

    expect(result.latitude).toBe(PARIS.latitude);
    expect(result.longitude).toBe(PARIS.longitude);
  });

  it('should return the arithmetic mean for 2 points', () => {
    const result = computeCentroid([PARIS, LYON]);

    const expectedLat = (PARIS.latitude + LYON.latitude) / 2;
    const expectedLon = (PARIS.longitude + LYON.longitude) / 2;

    expect(result.latitude).toBeCloseTo(expectedLat, 10);
    expect(result.longitude).toBeCloseTo(expectedLon, 10);
  });

  it('should compute the geometric center for 3 symmetric points', () => {
    // Triangle équilatéral simplifié : 3 points symétriques
    // Simplified equilateral triangle: 3 symmetric points
    const p1 = { latitude: 49, longitude: 2 };
    const p2 = { latitude: 47, longitude: 2 };
    const p3 = { latitude: 48, longitude: 3.732 };

    const result = computeCentroid([p1, p2, p3]);

    const expectedLat = (p1.latitude + p2.latitude + p3.latitude) / 3;
    const expectedLon = (p1.longitude + p2.longitude + p3.longitude) / 3;

    expect(result.latitude).toBeCloseTo(expectedLat, 10);
    expect(result.longitude).toBeCloseTo(expectedLon, 10);
  });

  it('should compute the centroid for 5 points', () => {
    const points = [PARIS, LYON, MARSEILLE, NYC, TOKYO];
    const result = computeCentroid(points);

    const expectedLat = points.reduce((acc, p) => acc + p.latitude, 0) / 5;
    const expectedLon = points.reduce((acc, p) => acc + p.longitude, 0) / 5;

    expect(result.latitude).toBeCloseTo(expectedLat, 10);
    expect(result.longitude).toBeCloseTo(expectedLon, 10);
  });

  it('should throw CentroidError for an empty list', () => {
    expect(() => computeCentroid([])).toThrow(CentroidError);
    expect(() => computeCentroid([])).toThrow('Cannot compute centroid of empty list');
  });
});

/**
 * @file radius.test.ts
 * @description Tests unitaires pour le helper computeRadius (rayon de zone).
 *              Unit tests for the computeRadius helper (zone radius).
 *
 * @module __tests__/unit/core/utils/geo/radius
 */

// [ADDED] Tests unitaires computeRadius

import { computeCentroid } from '@core/utils/geo/centroid';
import { distanceBetween } from '@core/utils/geo/distance';
import { computeRadius } from '@core/utils/geo/radius';
import { PARIS, LYON, MARSEILLE } from '../../../../helpers/coordinates';

describe('computeRadius', () => {
  it('should return 0 for a single point at the center', () => {
    // Un seul point : le centroïde est ce point, distance = 0
    // Single point: centroid is that point, distance = 0
    const radius = computeRadius(PARIS, [PARIS]);

    expect(radius).toBe(0);
  });

  it('should return the common distance for 2 equidistant points', () => {
    // Centroïde entre Paris et Lyon, les deux doivent être équidistants
    // Centroid between Paris and Lyon, both should be equidistant
    const center = computeCentroid([PARIS, LYON]);
    const radius = computeRadius(center, [PARIS, LYON]);

    const distToParisKm = distanceBetween(center, PARIS) / 1000;
    const distToLyonKm = distanceBetween(center, LYON) / 1000;

    // Les distances doivent être proches (centroïde cartésien ≈ équidistant)
    // Distances should be close (cartesian centroid ≈ equidistant)
    expect(Math.abs(distToParisKm - distToLyonKm)).toBeLessThan(5);

    // Le radius est bien le max
    // Radius is indeed the max
    expect(radius).toBe(Math.max(distanceBetween(center, PARIS), distanceBetween(center, LYON)));
  });

  it('should take the MAX distance, not the mean', () => {
    // Paris est plus loin du centroïde que Lyon ou Marseille
    // Paris is farther from the centroid than Lyon or Marseille
    const center = computeCentroid([PARIS, LYON, MARSEILLE]);
    const radius = computeRadius(center, [PARIS, LYON, MARSEILLE]);

    const distances = [PARIS, LYON, MARSEILLE].map((p) => distanceBetween(center, p));
    const maxDist = Math.max(...distances);
    const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;

    // Le radius doit être le max, pas la moyenne
    // Radius must be the max, not the mean
    expect(radius).toBe(maxDist);
    expect(radius).toBeGreaterThanOrEqual(meanDist);
  });

  it('should return 0 for an empty list', () => {
    const radius = computeRadius(PARIS, []);

    expect(radius).toBe(0);
  });
});

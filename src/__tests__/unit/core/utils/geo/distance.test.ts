/**
 * @file distance.test.ts
 * @description Tests unitaires pour le helper distanceBetween (Haversine).
 *              Unit tests for the distanceBetween helper (Haversine).
 *
 * @module __tests__/unit/core/utils/geo/distance
 */

// [ADDED] Tests unitaires distanceBetween

import { distanceBetween } from '@core/utils/geo/distance';
import { PARIS, LYON, NYC } from '../../../../helpers/coordinates';

describe('distanceBetween', () => {
  it('should return 0 for the same point', () => {
    const distance = distanceBetween(PARIS, PARIS);

    expect(distance).toBe(0);
  });

  it('should compute Paris ↔ Lyon ≈ 392 km (± 5 km)', () => {
    const distance = distanceBetween(PARIS, LYON);
    const distanceKm = distance / 1000;

    expect(distanceKm).toBeGreaterThan(387);
    expect(distanceKm).toBeLessThan(397);
  });

  it('should compute Paris ↔ NYC ≈ 5836 km (± 100 km)', () => {
    const distance = distanceBetween(PARIS, NYC);
    const distanceKm = distance / 1000;

    expect(distanceKm).toBeGreaterThan(5736);
    expect(distanceKm).toBeLessThan(5936);
  });

  it('should compute antipodes ≈ half Earth circumference', () => {
    // Point et son antipode
    // Point and its antipode
    const point = { latitude: 0, longitude: 0 };
    const antipode = { latitude: 0, longitude: 180 };
    const distance = distanceBetween(point, antipode);
    const distanceKm = distance / 1000;

    // Demi-circonférence terrestre ≈ 20 015 km
    // Half Earth circumference ≈ 20,015 km
    expect(distanceKm).toBeGreaterThan(19_900);
    expect(distanceKm).toBeLessThan(20_100);
  });

  it('should be symmetric: distance(a, b) === distance(b, a)', () => {
    const ab = distanceBetween(PARIS, LYON);
    const ba = distanceBetween(LYON, PARIS);

    expect(ab).toBe(ba);
  });

  it('should always return a positive or zero value', () => {
    const distance = distanceBetween(PARIS, NYC);

    expect(distance).toBeGreaterThanOrEqual(0);
  });
});

/**
 * @file distance.test.ts
 * @description Tests unitaires du formatage de distance.
 *              Unit tests for distance formatting.
 *
 * @module __tests__/unit/core/utils/format/distance
 */

// [ADDED] Tests getDistanceLabel

import { getDistanceLabel } from '@core/utils/format/distance';

describe('getDistanceLabel', () => {
  it('returns "0 m" for 0 meters', () => {
    expect(getDistanceLabel(0)).toBe('0 m');
  });

  it('returns "450 m" for 450 meters', () => {
    expect(getDistanceLabel(450)).toBe('450 m');
  });

  it('rounds meters to nearest integer', () => {
    expect(getDistanceLabel(123.7)).toBe('124 m');
    expect(getDistanceLabel(999.4)).toBe('999 m');
  });

  it('returns "1.0 km" for exactly 1000 meters', () => {
    expect(getDistanceLabel(1000)).toBe('1.0 km');
  });

  it('returns "1.2 km" for 1234 meters', () => {
    expect(getDistanceLabel(1234)).toBe('1.2 km');
  });

  it('returns one decimal for distances between 1 and 10 km', () => {
    expect(getDistanceLabel(5500)).toBe('5.5 km');
    expect(getDistanceLabel(9999)).toBe('10.0 km');
  });

  it('returns "16 km" for 15600 meters (rounds above 10 km)', () => {
    expect(getDistanceLabel(15600)).toBe('16 km');
  });

  it('rounds to nearest integer above 10 km', () => {
    expect(getDistanceLabel(10000)).toBe('10 km');
    expect(getDistanceLabel(25400)).toBe('25 km');
    expect(getDistanceLabel(99999)).toBe('100 km');
  });
});

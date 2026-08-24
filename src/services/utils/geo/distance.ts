/**
 * @file distance.ts
 * @description Calcul de distance entre deux points GPS via la formule
 *              de Haversine (orthodromie sur sphère).
 *              Distance between GPS points using the Haversine formula
 *              (great-circle distance on a sphere).
 *
 *              Précision : ~0.5% sur Terre (modèle sphérique vs ellipsoïde).
 *              Suffisant pour un MVP urbain (< 100 km).
 *
 *              Pour V1 : envisager Vincenty pour précision ellipsoïdale.
 *
 * @see https://en.wikipedia.org/wiki/Haversine_formula
 * @module services/utils/geo/distance
 */

// [ADDED] Helper Haversine pour calcul de distance GPS
import type { Coordinates } from '@entities/Location';

/** Rayon moyen de la Terre en mètres (modèle sphérique) */
const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Convertit des degrés en radians.
 * Converts degrees to radians.
 *
 * @param deg — valeur en degrés / value in degrees
 * @returns valeur en radians / value in radians
 */
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Calcule la distance entre deux points GPS en mètres.
 * Computes the distance between two GPS points in meters.
 *
 * Utilise la formule de Haversine (grande circle sur sphère).
 * Uses the Haversine formula (great-circle on sphere).
 *
 * @param a — premier point / first point
 * @param b — second point / second point
 * @returns distance en mètres (>= 0) / distance in meters (>= 0)
 *
 * @example
 *   const paris = { latitude: 48.8566, longitude: 2.3522 };
 *   const lyon = { latitude: 45.7640, longitude: 4.8357 };
 *   distanceBetween(paris, lyon); // ≈ 392 000 m (392 km)
 */
export const distanceBetween = (a: Coordinates, b: Coordinates): number => {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const deltaLat = toRad(b.latitude - a.latitude);
  const deltaLon = toRad(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
};

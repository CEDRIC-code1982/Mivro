/**
 * @file centroid.ts
 * @description Calcul du centroïde (point moyen) d'un ensemble de coordonnées.
 *              Centroid (mean point) calculation for a set of coordinates.
 *
 *              Méthode : centroïde cartésien (moyenne arithmétique des
 *              latitudes et longitudes).
 *              Method: cartesian centroid (arithmetic mean of lat/lng).
 *
 *              Limites connues / Known limitations:
 *              - Précis pour des points proches (< 50 km)
 *              - Imprécis pour points autour du méridien 180°/-180°
 *              - Imprécis pour antipodes
 *
 *              Pour V1 : envisager le centroïde sphérique (somme de
 *              vecteurs 3D normalisés) pour les distances longues.
 *
 * @module core/utils/geo/centroid
 */

// [ADDED] Helper centroïde cartésien
import type { Coordinates } from '@entities/Location';

/**
 * Erreur levée quand le calcul de centroïde est impossible.
 * Error thrown when centroid computation is impossible.
 */
export class CentroidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CentroidError';
  }
}

/**
 * Calcule le centroïde cartésien d'une liste de points.
 * Computes the cartesian centroid of a list of points.
 *
 * @param points — liste de coordonnées (au moins 1) / list of coordinates (at least 1)
 * @returns coordonnées du centroïde / centroid coordinates
 * @throws CentroidError si la liste est vide / if the list is empty
 *
 * @example
 *   const paris = { latitude: 48.8566, longitude: 2.3522 };
 *   const lyon = { latitude: 45.7640, longitude: 4.8357 };
 *   computeCentroid([paris, lyon]);
 *   // ≈ { latitude: 47.3103, longitude: 3.5940 }
 */
export const computeCentroid = (points: readonly Coordinates[]): Coordinates => {
  if (points.length === 0) {
    throw new CentroidError('Cannot compute centroid of empty list');
  }

  // Moyenne arithmétique simple (centroïde cartésien)
  // Simple arithmetic mean (cartesian centroid)
  const sumLat = points.reduce((acc, p) => acc + p.latitude, 0);
  const sumLon = points.reduce((acc, p) => acc + p.longitude, 0);

  return {
    latitude: sumLat / points.length,
    longitude: sumLon / points.length,
  };
};

/**
 * @file radius.ts
 * @description Calcul du rayon de zone autour d'un centroïde.
 *              Radius computation around a centroid.
 *
 *              Définit la "zone de rencontre" qui englobe tous les
 *              participants. Utilisé pour afficher un cercle sur
 *              la carte et borner la recherche de POI (rayon dans
 *              lequel chercher des lieux d'intérêt).
 *              Defines the "meeting zone" that encompasses all
 *              participants. Used to display a circle on the map
 *              and bound POI search (radius to search for places).
 *
 * @module services/utils/geo/radius
 */

// [ADDED] Helper rayon de zone (distance max au centroïde)
import type { Coordinates } from '@entities/Location';
import { distanceBetween } from './distance';

/**
 * Calcule le rayon de zone (distance maximale du centroïde aux points).
 * Computes the zone radius (maximum distance from centroid to points).
 *
 * On utilise le MAXIMUM (pas la moyenne) pour garantir que TOUS les
 * participants soient à l'intérieur du cercle affiché.
 * We use MAX (not mean) to ensure all participants fit inside the circle.
 *
 * @param center — point central (centroïde) / center point (centroid)
 * @param points — liste de coordonnées / list of coordinates
 * @returns rayon en mètres (>= 0) / radius in meters (>= 0)
 *
 * @example
 *   const center = { latitude: 47.3, longitude: 3.6 };
 *   const points = [paris, lyon];
 *   computeRadius(center, points); // ≈ 200 km en mètres
 */
export const computeRadius = (center: Coordinates, points: readonly Coordinates[]): number => {
  if (points.length === 0) return 0;

  const distances = points.map((p) => distanceBetween(center, p));
  return Math.max(...distances);
};

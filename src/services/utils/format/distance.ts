/**
 * @file distance.ts
 * @description Formatage humain de distances en mètres.
 *              Human-friendly distance formatting.
 *
 * @module services/utils/format/distance
 */

// [ADDED] Utilitaire de formatage de distance

/**
 * Convertit une distance en mètres en label lisible.
 * Converts a distance in meters to a human-readable label.
 *
 * @param meters — distance en mètres / distance in meters
 * @returns Label formaté / Formatted label
 *
 * @example
 *   getDistanceLabel(450)   // "450 m"
 *   getDistanceLabel(1234)  // "1.2 km"
 *   getDistanceLabel(15600) // "16 km"
 */
export const getDistanceLabel = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
};

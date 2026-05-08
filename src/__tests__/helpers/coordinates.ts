/**
 * @file coordinates.ts
 * @description Constantes de coordonnées pour les tests géographiques.
 *              Coordinate constants for geographic tests.
 *
 *              Valeurs réelles de centres-villes pour vérifier les
 *              calculs de distance/centroïde avec des résultats connus.
 *              Real city-center values to verify distance/centroid
 *              calculations against known results.
 *
 * @module __tests__/helpers/coordinates
 */

// [ADDED] Constantes de test — coordonnées villes réelles
import type { Coordinates } from '@core/entities/Location';

/** Paris, France (centre) */
export const PARIS: Coordinates = { latitude: 48.8566, longitude: 2.3522 };

/** Lyon, France (centre) */
export const LYON: Coordinates = { latitude: 45.764, longitude: 4.8357 };

/** Marseille, France (centre) */
export const MARSEILLE: Coordinates = { latitude: 43.2965, longitude: 5.3698 };

/** New York City, USA (centre) */
export const NYC: Coordinates = { latitude: 40.7128, longitude: -74.006 };

/** Tokyo, Japon (centre) */
export const TOKYO: Coordinates = { latitude: 35.6762, longitude: 139.6503 };

/** Sydney, Australie (centre) */
export const SYDNEY: Coordinates = { latitude: -33.8688, longitude: 151.2093 };

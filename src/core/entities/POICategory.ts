/**
 * Catégories de POI standards Mivro.
 * Mapping vers tags Overpass / OpenStreetMap.
 *
 * POI categories for Mivro.
 * Maps to Overpass / OpenStreetMap tags.
 *
 * @file POICategory.ts
 * @module core/entities
 * @see https://wiki.openstreetmap.org/wiki/Map_features
 */

import { z } from 'zod'; // [ADDED]

/**
 * Schéma Zod pour les catégories de POI.
 * 9 catégories standards couvrant les usages principaux.
 *
 * Zod schema for POI categories.
 * 9 standard categories covering main use cases.
 *
 * @example
 *   const result = POICategorySchema.safeParse('restaurant');
 *   // result.success === true
 */
// [ADDED]
export const POICategorySchema = z.enum([
  'restaurant',
  'cafe',
  'bar',
  'park',
  'cinema',
  'museum',
  'shop',
  'sport',
  'hotel',
]);

/**
 * Type catégorie POI, inféré du schéma Zod.
 *
 * POI category type, inferred from Zod schema.
 */
// [ADDED]
export type POICategory = z.infer<typeof POICategorySchema>;

/**
 * Filtre Overpass : paire clé/valeur correspondant à un tag OSM.
 *
 * Overpass filter: key/value pair matching an OSM tag.
 *
 * @param key — Clé du tag OSM (ex: 'amenity', 'leisure', 'tourism')
 * @param value — Valeur du tag OSM (ex: 'restaurant', 'park')
 */
// [ADDED]
interface OverpassFilter {
  readonly key: string;
  readonly value: string;
}

/**
 * Mapping catégorie Mivro → filtres Overpass.
 * Chaque entrée définit les paires key=value à matcher
 * (logique OR entre les paires).
 *
 * Mapping from Mivro category to Overpass filters.
 * Each entry defines key=value pairs to match
 * (OR logic between pairs).
 *
 * @see https://wiki.openstreetmap.org/wiki/Map_features
 *
 * @example
 *   const filters = POI_CATEGORY_OVERPASS_FILTERS.bar;
 *   // [{ key: 'amenity', value: 'bar' }, { key: 'amenity', value: 'pub' }]
 */
// [ADDED]
export const POI_CATEGORY_OVERPASS_FILTERS: Record<POICategory, readonly OverpassFilter[]> = {
  restaurant: [{ key: 'amenity', value: 'restaurant' }],
  cafe: [{ key: 'amenity', value: 'cafe' }],
  bar: [
    { key: 'amenity', value: 'bar' },
    { key: 'amenity', value: 'pub' },
  ],
  park: [{ key: 'leisure', value: 'park' }],
  cinema: [{ key: 'amenity', value: 'cinema' }],
  museum: [{ key: 'tourism', value: 'museum' }],
  shop: [
    { key: 'shop', value: 'mall' },
    { key: 'shop', value: 'clothes' },
    { key: 'shop', value: 'department_store' },
  ],
  sport: [
    { key: 'leisure', value: 'fitness_centre' },
    { key: 'leisure', value: 'sports_centre' },
  ],
  hotel: [{ key: 'tourism', value: 'hotel' }],
};

/**
 * Liste de toutes les catégories disponibles (utile pour les UI).
 *
 * List of all available categories (useful for UI components).
 *
 * @example
 *   ALL_POI_CATEGORIES.forEach((cat) => console.log(cat));
 */
// [ADDED]
export const ALL_POI_CATEGORIES: readonly POICategory[] = [
  'restaurant',
  'cafe',
  'bar',
  'park',
  'cinema',
  'museum',
  'shop',
  'sport',
  'hotel',
];

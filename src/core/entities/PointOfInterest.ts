/**
 * Entité Point d'Intérêt issue d'Overpass / OSM.
 *
 * Point of Interest entity from Overpass / OSM.
 *
 * @file PointOfInterest.ts
 * @module core/entities
 */

import { z } from 'zod'; // [ADDED]
import { CoordinatesSchema } from './Location'; // [ADDED]
import { POICategorySchema } from './POICategory'; // [ADDED]

/**
 * Schéma Zod pour un Point d'Intérêt.
 *
 * Zod schema for a Point of Interest.
 *
 * @example
 *   const result = PointOfInterestSchema.safeParse({
 *     externalId: 'node/12345',
 *     category: 'restaurant',
 *     name: 'Le Petit Bistro',
 *     coordinates: { latitude: 48.8566, longitude: 2.3522 },
 *   });
 */
// [ADDED]
export const PointOfInterestSchema = z.object({
  /** Identifiant OSM (format: type/id ex: "node/12345") / OSM identifier */
  externalId: z.string(),
  /** Catégorie Mivro / Mivro category */
  category: POICategorySchema,
  /** Nom du lieu (peut être absent en OSM, fallback filtré) / Place name */
  name: z.string().min(1),
  /** Coordonnées géographiques / Geographic coordinates */
  coordinates: CoordinatesSchema,
  /** Adresse formatée si disponible / Formatted address if available */
  address: z.string().optional(),
  /** Tags OSM bruts (utile pour debug / extensions futures) / Raw OSM tags */
  tags: z.record(z.string(), z.string()).optional(),
});

/**
 * Type Point d'Intérêt, inféré du schéma Zod.
 *
 * Point of Interest type, inferred from Zod schema.
 */
// [ADDED]
export type PointOfInterest = z.infer<typeof PointOfInterestSchema>;

/**
 * @file GeocodeResult.ts
 * @description Résultat de recherche géocodage (avant conversion en Location).
 *              Geocoding search result (before conversion to Location).
 *
 * @module core/entities/GeocodeResult
 */

// [ADDED] Entité GeocodeResult avec validation Zod
import { z } from 'zod';
import { CoordinatesSchema } from './Location';

/**
 * Schéma Zod pour un résultat de géocodage.
 * Zod schema for a geocoding result.
 *
 * Champs :
 * - externalId : identifiant unique du provider (osm_id pour Nominatim)
 * - coordinates : latitude/longitude validées
 * - displayName : adresse formatée prête à afficher
 * - placeType : type de lieu (street, city, country, etc.) — optionnel
 * - importance : score de pertinence 0..1 si disponible — optionnel
 *
 * Fields:
 * - externalId: unique provider identifier (osm_id for Nominatim)
 * - coordinates: validated latitude/longitude
 * - displayName: formatted address ready for display
 * - placeType: place type (street, city, country, etc.) — optional
 * - importance: relevance score 0..1 if available — optional
 */
export const GeocodeResultSchema = z.object({
  /** Identifiant unique du résultat (osm_id pour Nominatim) / Unique result ID */
  externalId: z.string(),
  /** Coordonnées GPS / GPS coordinates */
  coordinates: CoordinatesSchema,
  /** Adresse formatée prête à afficher / Formatted display address */
  displayName: z.string().min(1),
  /** Type de lieu (street, city, country, ...) / Place type */
  placeType: z.string().optional(),
  /** Score de pertinence (0..1) si disponible / Relevance score */
  importance: z.number().min(0).max(1).optional(),
});

/** Type inféré depuis le schéma Zod (TS-001 : zéro any) */
export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

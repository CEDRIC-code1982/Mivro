/**
 * @file Location.ts
 * @description Entité Location — coordonnées GPS + adresse formatée.
 *              Location entity — GPS coordinates + formatted address.
 *
 *              Utilisée pour les points de départ des participants
 *              et le midpoint calculé.
 *              Used for participant start locations and the computed midpoint.
 *
 * @module core/entities/Location
 */

// [ADDED] Entité Location avec validation Zod
import { z } from 'zod';

/**
 * Schéma Zod pour des coordonnées GPS (latitude/longitude).
 * Zod schema for GPS coordinates (latitude/longitude).
 */
export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Schéma Zod pour une localisation complète (coordonnées + adresse).
 * Zod schema for a full location (coordinates + address).
 */
export const LocationSchema = z.object({
  id: z.string().uuid(),
  coordinates: CoordinatesSchema,
  formattedAddress: z.string().min(1),
  city: z.string().optional(),
  country: z.string().optional(),
});

// [ADDED] Types inférés depuis les schémas Zod (TS-001 : zéro any)
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type Location = z.infer<typeof LocationSchema>;

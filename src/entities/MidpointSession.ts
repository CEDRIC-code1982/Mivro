/**
 * @file MidpointSession.ts
 * @description Entité MidpointSession — session de calcul de midpoint avec participants.
 *              MidpointSession entity — midpoint calculation session with participants.
 *
 *              Cycle de vie : draft → computed → active → completed.
 *              Lifecycle: draft → computed → active → completed.
 *
 * @module entities/MidpointSession
 */

// [ADDED] Entité MidpointSession avec validation Zod
import { z } from 'zod';
import { AvatarIdSchema } from './Avatar'; // [ADDED] F7 — avatar emoji prédéfini
import { CoordinatesSchema, LocationSchema } from './Location';

/**
 * Schéma Zod pour un participant à la session.
 * Zod schema for a session participant.
 */
export const ParticipantSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1),
  // [ADDED] F7 — avatar emoji optionnel (fallback initiale si absent) / optional emoji avatar
  avatarId: AvatarIdSchema.optional(),
  startLocation: LocationSchema,
});

/**
 * Schéma Zod pour le statut de session.
 * Zod schema for session status.
 *
 * - `draft` : en cours de création (saisie des points)
 * - `computed` : midpoint calculé, prêt à partager
 * - `active` : trajet en cours (temps réel actif)
 * - `completed` : session terminée
 */
export const SessionStatusSchema = z.enum(['draft', 'computed', 'active', 'completed']);

/**
 * Schéma Zod pour une session Mivro complète.
 * Zod schema for a complete Mivro session.
 */
export const MidpointSessionSchema = z.object({
  id: z.string().uuid(),
  status: SessionStatusSchema,
  participants: z.array(ParticipantSchema).min(2).max(5),
  midpoint: CoordinatesSchema.optional(),
  midpointRadius: z.number().positive().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// [ADDED] Types inférés depuis les schémas Zod (TS-001 : zéro any)
export type Participant = z.infer<typeof ParticipantSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type MidpointSession = z.infer<typeof MidpointSessionSchema>;

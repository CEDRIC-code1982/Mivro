/**
 * @file MidpointSession.ts
 * @description MidpointSession entity — midpoint calculation session with participants.
 *
 *              Lifecycle: draft → computed → active → completed.
 *
 * @module entities/MidpointSession
 */

// [ADDED] MidpointSession entity with Zod validation
import { z } from 'zod';
import { AvatarIdSchema } from './Avatar'; // [ADDED] F7 — predefined emoji avatar
import { CoordinatesSchema, LocationSchema } from './Location';

/**
 * Zod schema for a session participant.
 */
export const ParticipantSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1),
  // [ADDED] F7 — optional emoji avatar (falls back to the initial when absent)
  avatarId: AvatarIdSchema.optional(),
  startLocation: LocationSchema,
});

/**
 * Zod schema for the session status.
 *
 * - `draft`: being created (start points being entered)
 * - `computed`: midpoint computed, ready to share
 * - `active`: trip in progress (real time active)
 * - `completed`: session ended
 */
export const SessionStatusSchema = z.enum(['draft', 'computed', 'active', 'completed']);

/**
 * Zod schema for a complete Mivro session.
 */
export const MidpointSessionSchema = z.object({
  id: z.string().uuid(),
  status: SessionStatusSchema,
  participants: z.array(ParticipantSchema).min(2).max(5),
  midpoint: CoordinatesSchema.optional(),
  midpointRadius: z.number().positive().optional(),
  // [ADDED] true when the session is a local copy of a shared session (F5, loaded from the
  // remote roster). Such a copy holds the other members' start addresses: once the shared
  // session has ended (deleted by its owner or purged at expiry), it must not be published again.
  isSharedCopy: z.boolean().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// [ADDED] Types inferred from the Zod schemas (TS-001: zero any)
export type Participant = z.infer<typeof ParticipantSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type MidpointSession = z.infer<typeof MidpointSessionSchema>;

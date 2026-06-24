/**
 * @file RealtimeParticipant.ts
 * @description Entité RealtimeParticipant — position GPS live d'un participant
 *              dans une session temps réel (Firebase).
 *              RealtimeParticipant entity — live GPS position of a participant
 *              in a real-time session (Firebase).
 *
 *              ⚠️ RGPD : ces données sont **éphémères** (jamais persistées en
 *              base locale) et supprimées en fin de session. Les coordonnées
 *              exactes ne doivent JAMAIS être loggées (scrubbing — voir
 *              infrastructure/crash/sanitizers.ts).
 *
 *              ⚠️ GDPR: this data is **ephemeral** (never persisted locally)
 *              and removed at the end of the session. Exact coordinates must
 *              NEVER be logged (scrubbing).
 *
 * @module core/entities/RealtimeParticipant
 */

// [ADDED] F4 — Entité RealtimeParticipant avec validation Zod (TS-004)
import { z } from 'zod';

/** Cap minimum (degrés) / Minimum heading (degrees) */
const HEADING_MIN = 0;
/** Cap maximum exclusif (degrés) / Maximum heading exclusive (degrees) */
const HEADING_MAX = 360;

/**
 * Schéma Zod strict pour la position live d'un participant.
 * Strict Zod schema for a participant's live position.
 *
 * Source de vérité runtime + type (TS-001/TS-004) : utilisé pour valider les
 * données LUES depuis Firebase (frontière externe) côté adapter.
 * Runtime + type source of truth: used to validate data READ from Firebase
 * (external boundary) on the adapter side.
 */
export const RealtimeParticipantSchema = z.object({
  /** UUID du participant (clé Firebase) / Participant UUID (Firebase key) */
  participantId: z.string().min(1),
  /** Latitude GPS (-90..90) / GPS latitude */
  latitude: z.number().min(-90).max(90),
  /** Longitude GPS (-180..180) / GPS longitude */
  longitude: z.number().min(-180).max(180),
  /**
   * Timestamp serveur (epoch ms) de la dernière mise à jour.
   * Server timestamp (epoch ms) of the last update.
   *
   * Écrit via `serverTimestamp()` côté adapter ; lu comme number.
   * Written via `serverTimestamp()` on the adapter side; read as a number.
   */
  updatedAt: z.number().int().nonnegative(),
  /** Vitesse instantanée en km/h (>= 0) / Instantaneous speed in km/h */
  speed: z.number().min(0),
  /** Cap / orientation en degrés [0, 360) / Heading in degrees [0, 360) */
  heading: z.number().min(HEADING_MIN).max(HEADING_MAX),
  /** true si le participant est connecté / true if the participant is online */
  isOnline: z.boolean(),
});

/**
 * Type inféré de la position live d'un participant (TS-001 : zéro any).
 * Inferred type of a participant's live position.
 */
export type RealtimeParticipant = z.infer<typeof RealtimeParticipantSchema>;

/**
 * Données de localisation publiées par le device courant.
 * Location data published by the current device.
 *
 * Sous-ensemble de {@link RealtimeParticipant} sans les champs gérés par le
 * serveur / l'adapter (`participantId`, `updatedAt`, `isOnline`).
 * Subset of {@link RealtimeParticipant} without server/adapter-managed fields.
 */
export const RealtimeLocationUpdateSchema = RealtimeParticipantSchema.pick({
  latitude: true,
  longitude: true,
  speed: true,
  heading: true,
});

/**
 * Type inféré d'une mise à jour de localisation à publier.
 * Inferred type of a location update to publish.
 */
export type RealtimeLocationUpdate = z.infer<typeof RealtimeLocationUpdateSchema>;

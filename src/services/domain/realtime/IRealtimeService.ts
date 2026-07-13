/**
 * @file IRealtimeService.ts
 * @description Port abstrait pour la localisation temps réel multi-participants.
 *              Abstract port for multi-participant real-time location.
 *
 *              Permet de swapper le backend temps réel (Firebase Realtime
 *              Database, Supabase Realtime, WebSocket maison…) sans toucher au
 *              code métier ni à la présentation.
 *              Allows swapping the real-time backend without touching business
 *              logic nor presentation.
 *
 *              ⚠️ RGPD : les positions sont éphémères, supprimées en fin de
 *              session, jamais persistées localement, et les coordonnées
 *              exactes ne sont jamais loggées.
 *
 *              Implémentations : FirebaseRealtimeService (infrastructure/).
 *              Implementations: FirebaseRealtimeService (infrastructure/).
 *
 * @module core/ports/IRealtimeService
 */

// [ADDED] F4 — Port IRealtimeService + erreur typée
import type { RealtimeLocationUpdate, RealtimeParticipant } from '@entities/RealtimeParticipant';

/**
 * Callback invoqué à chaque changement des participants d'une session.
 * Callback invoked on every change of a session's participants.
 *
 * Reçoit la liste **validée** (Zod) des participants live actuellement connus.
 * Receives the **validated** (Zod) list of currently known live participants.
 *
 * @param participants - Participants live validés / Validated live participants
 */
export type RealtimeUpdateHandler = (participants: readonly RealtimeParticipant[]) => void;

/**
 * Fonction de désabonnement retournée par {@link IRealtimeService.subscribeToSession}.
 * Unsubscribe function returned by {@link IRealtimeService.subscribeToSession}.
 */
export type Unsubscribe = () => void;

/**
 * Port abstrait pour le service de localisation temps réel.
 * Abstract port for the real-time location service.
 *
 * @example
 *   const unsub = realtimeService.subscribeToSession(sessionId, (participants) => {
 *     setParticipants(participants);
 *   });
 *   await realtimeService.publishLocation(sessionId, participantId, location);
 *   // …plus tard
 *   await realtimeService.leaveSession(sessionId, participantId);
 *   unsub();
 */
export interface IRealtimeService {
  /**
   * S'abonne aux positions live des participants d'une session.
   * Subscribes to the live positions of a session's participants.
   *
   * Le handler est appelé immédiatement avec l'état courant puis à chaque
   * changement. Les données sont validées via Zod avant d'être transmises
   * (TS-004) ; les entrées invalides sont ignorées (et reportées).
   * The handler is called immediately with the current state then on every
   * change. Data is validated via Zod before being passed (TS-004); invalid
   * entries are skipped (and reported).
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param onUpdate - Handler appelé à chaque changement / Handler called on each change
   * @returns Fonction de désabonnement / Unsubscribe function
   * @throws {RealtimeError} Si l'abonnement ne peut être établi / If the subscription cannot be established
   */
  subscribeToSession(sessionId: string, onUpdate: RealtimeUpdateHandler): Unsubscribe;

  /**
   * Publie la position courante du participant dans la session.
   * Publishes the participant's current position in the session.
   *
   * Définit `isOnline=true`, `updatedAt=serverTimestamp()`, et arme
   * `onDisconnect` pour repasser `isOnline=false` en cas de coupure.
   * Sets `isOnline=true`, `updatedAt=serverTimestamp()`, and arms
   * `onDisconnect` to set `isOnline=false` on connection loss.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param participantId - Identifiant du participant / Participant identifier
   * @param location - Position à publier / Location to publish
   * @throws {RealtimeError} Si la publication échoue / If the publish fails
   */
  publishLocation(
    sessionId: string,
    participantId: string,
    location: RealtimeLocationUpdate,
  ): Promise<void>;

  /**
   * Quitte la session : supprime le nœud du participant (RGPD).
   * Leaves the session: removes the participant's node (GDPR).
   *
   * Idempotent : ne lève pas si le nœud n'existe plus.
   * Idempotent: does not throw if the node no longer exists.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param participantId - Identifiant du participant / Participant identifier
   * @throws {RealtimeError} Si la suppression échoue durablement / If removal fails persistently
   */
  leaveSession(sessionId: string, participantId: string): Promise<void>;
}

/**
 * Codes d'erreur typés pour le service temps réel.
 * Typed error codes for the real-time service.
 *
 * - `not_configured` : Firebase non configuré (fichiers natifs manquants) / Firebase not configured
 * - `network` : Erreur réseau / connexion / Network or connection error
 * - `permission_denied` : Règles de sécurité Firebase refusent l'accès / Firebase security rules deny access
 * - `invalid_data` : Données lues invalides (échec Zod) / Read data invalid (Zod failure)
 * - `unknown` : Erreur inattendue / Unexpected error
 */
export type RealtimeErrorCode =
  | 'not_configured'
  | 'network'
  | 'permission_denied'
  | 'invalid_data'
  | 'unknown';

/**
 * Erreur métier typée pour le service temps réel.
 * Typed business error for the real-time service.
 *
 * @param message - Message lisible (non affiché tel quel) / Human-readable message
 * @param code - Code d'erreur typé (mappé vers un message i18n) / Typed error code
 * @param cause - Erreur originale optionnelle / Optional original error
 */
export class RealtimeError extends Error {
  constructor(
    message: string,
    public readonly code: RealtimeErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RealtimeError';
  }
}

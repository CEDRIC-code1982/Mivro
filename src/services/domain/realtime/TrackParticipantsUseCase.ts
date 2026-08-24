/**
 * @file TrackParticipantsUseCase.ts
 * @description Use case F4 — orchestre le suivi temps réel des participants.
 *              F4 use case — orchestrates real-time participant tracking.
 *
 *              Délègue intégralement au port {@link IRealtimeService} : aucune
 *              dépendance infrastructure ni présentation (règle de dépendance).
 *              Valide les entrées (sessionId / participantId / location) avant
 *              de publier (TS-004).
 *
 *              Fully delegates to the {@link IRealtimeService} port: no
 *              infrastructure nor presentation dependency. Validates inputs
 *              before publishing.
 *
 * @module services/domain/realtime/TrackParticipantsUseCase
 */

// [ADDED] F4 — UseCase TrackParticipantsUseCase
import { RealtimeLocationUpdateSchema } from '@entities/RealtimeParticipant';
import type { RealtimeLocationUpdate } from '@entities/RealtimeParticipant';
import { RealtimeError } from '@services/domain/realtime/IRealtimeService';
import type {
  IRealtimeService,
  RealtimeUpdateHandler,
  Unsubscribe,
} from '@services/domain/realtime/IRealtimeService';

/**
 * Use case d'orchestration du suivi temps réel des participants.
 * Real-time participant tracking orchestration use case.
 *
 * @param realtimeService - Service temps réel injecté / Injected real-time service
 *
 * @example
 *   const useCase = new TrackParticipantsUseCase(realtimeService);
 *   const unsub = useCase.subscribe(sessionId, onUpdate);
 *   await useCase.publish(sessionId, participantId, location);
 *   await useCase.leave(sessionId, participantId);
 *   unsub();
 */
export class TrackParticipantsUseCase {
  constructor(private readonly realtimeService: IRealtimeService) {}

  /**
   * S'abonne aux positions live des participants d'une session.
   * Subscribes to the live positions of a session's participants.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param onUpdate - Handler appelé à chaque changement / Handler called on each change
   * @returns Fonction de désabonnement / Unsubscribe function
   * @throws {RealtimeError} Si sessionId vide ou abonnement impossible / If sessionId empty or subscription fails
   */
  subscribe(sessionId: string, onUpdate: RealtimeUpdateHandler): Unsubscribe {
    this.assertId(sessionId, 'sessionId');
    return this.realtimeService.subscribeToSession(sessionId, onUpdate);
  }

  /**
   * Publie la position courante du participant.
   * Publishes the participant's current position.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param participantId - Identifiant du participant / Participant identifier
   * @param location - Position à publier / Location to publish
   * @throws {RealtimeError} Si entrées invalides ou publication échoue / If inputs invalid or publish fails
   */
  async publish(
    sessionId: string,
    participantId: string,
    location: RealtimeLocationUpdate,
  ): Promise<void> {
    this.assertId(sessionId, 'sessionId');
    this.assertId(participantId, 'participantId');

    // Validation stricte de la position avant publication (TS-004)
    const parsed = RealtimeLocationUpdateSchema.safeParse(location);
    if (!parsed.success) {
      throw new RealtimeError('Invalid location payload', 'invalid_data', parsed.error);
    }

    await this.realtimeService.publishLocation(sessionId, participantId, parsed.data);
  }

  /**
   * Quitte la session (supprime le nœud du participant — RGPD).
   * Leaves the session (removes the participant's node — GDPR).
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param participantId - Identifiant du participant / Participant identifier
   * @throws {RealtimeError} Si entrées invalides ou suppression échoue / If inputs invalid or removal fails
   */
  async leave(sessionId: string, participantId: string): Promise<void> {
    this.assertId(sessionId, 'sessionId');
    this.assertId(participantId, 'participantId');
    await this.realtimeService.leaveSession(sessionId, participantId);
  }

  /**
   * Vérifie qu'un identifiant est une chaîne non vide.
   * Asserts an identifier is a non-empty string.
   *
   * @param value - Valeur à vérifier / Value to check
   * @param name - Nom du paramètre (pour le message) / Parameter name (for the message)
   * @throws {RealtimeError} Avec code 'unknown' si invalide / With code 'unknown' if invalid
   */
  private assertId(value: string, name: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new RealtimeError(`${name} must be a non-empty string`, 'unknown');
    }
  }
}

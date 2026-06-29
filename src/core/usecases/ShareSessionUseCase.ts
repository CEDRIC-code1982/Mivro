/**
 * @file ShareSessionUseCase.ts
 * @description Use case F5 — publie la session locale courante sur le backend
 *              partagé et renvoie un lien profond `mivro://session/{id}`.
 *              F5 use case — publishes the current local session to the shared
 *              backend and returns a `mivro://session/{id}` deep link.
 *
 *              Orchestre / Orchestrates:
 *              - mappe la `MidpointSession` locale → `SharedSession` (meta + members)
 *              - calcule `expiresAt` selon `ownerType` (24h guest / 7j compte)
 *              - délègue la publication au port {@link ISessionShareService}
 *
 *              Aucune dépendance infrastructure ni présentation (règle de
 *              dépendance). Reçoit le port par injection de constructeur.
 *
 * @module core/usecases/ShareSessionUseCase
 */

// [ADDED] F5 — UseCase ShareSessionUseCase
import type { MidpointSession, Participant } from '@core/entities/MidpointSession';
import {
  buildShareLink,
  computeExpiresAt,
  type SharedSession,
  type SharedSessionMember,
  type SharedSessionOwnerType,
} from '@core/entities/SharedSession';
import {
  SessionShareError,
  type CreateSharedSessionResult,
  type ISessionShareService,
} from '@core/ports/ISessionShareService';

/**
 * Entrée du use case ShareSession.
 * ShareSession use case input.
 */
export interface ShareSessionInput {
  /** Session locale à partager (doit avoir un midpoint calculé) / Local session to share */
  readonly session: MidpointSession;
  /** Type de propriétaire (pilote l'expiration) / Owner type (drives expiration) */
  readonly ownerType: SharedSessionOwnerType;
  /** Horodatage de référence (epoch ms) — injectable pour les tests / Reference timestamp */
  readonly now?: number;
}

/**
 * Mappe un participant local en membre de session partagée.
 * Maps a local participant to a shared session member.
 *
 * @param participant - Participant local / Local participant
 * @returns Membre de session partagée / Shared session member
 */
const toMember = (participant: Participant): SharedSessionMember => ({
  memberId: participant.id,
  displayName: participant.displayName,
  ...(participant.avatarId !== undefined && { avatarId: participant.avatarId }),
  startLocation: {
    latitude: participant.startLocation.coordinates.latitude,
    longitude: participant.startLocation.coordinates.longitude,
    formattedAddress: participant.startLocation.formattedAddress,
  },
});

/**
 * Use case : publication d'une session locale pour partage collaboratif.
 * Use case: publishing a local session for collaborative sharing.
 *
 * @param shareService - Service de partage injecté / Injected sharing service
 *
 * @example
 *   const useCase = new ShareSessionUseCase(shareService);
 *   const { link } = await useCase.execute({ session, ownerType: 'guest' });
 */
export class ShareSessionUseCase {
  constructor(private readonly shareService: ISessionShareService) {}

  /**
   * Publie la session locale et renvoie le lien de partage.
   * Publishes the local session and returns the share link.
   *
   * @param input - Session + type de propriétaire / Session + owner type
   * @returns Identifiant, lien profond et date d'expiration / Identifier, deep link and expiration
   * @throws {SessionShareError} Code `unknown` si la session n'a pas de midpoint,
   *         ou erreur typée propagée du port / If the session has no midpoint, or propagated error
   */
  async execute(input: ShareSessionInput): Promise<CreateSharedSessionResult> {
    const { session, ownerType } = input;
    const now = input.now ?? Date.now();

    if (session.participants.length < 2) {
      throw new SessionShareError(
        'Session must have at least 2 participants to be shared',
        'unknown',
      );
    }

    const expiresAt = computeExpiresAt(ownerType, now);

    const sharedSession: SharedSession = {
      sessionId: session.id,
      meta: {
        createdAt: now,
        expiresAt,
        ownerType,
        status: 'open',
        ...(session.midpoint !== undefined && { midpoint: session.midpoint }),
        ...(session.midpointRadius !== undefined && { midpointRadius: session.midpointRadius }),
      },
      members: session.participants.map(toMember),
    };

    const result = await this.shareService.createSharedSession(sharedSession, ownerType);

    console.log(
      `[INFO][ShareSessionUseCase][execute][?][${new Date().toISOString().slice(11, 19)}] ` +
        `Session shared | members: ${sharedSession.members.length} | ownerType: ${ownerType}`,
    );

    return {
      sessionId: result.sessionId,
      // Filet de sécurité : si l'adapter ne renvoyait pas de lien, on le dérive.
      link: result.link.length > 0 ? result.link : buildShareLink(result.sessionId),
      expiresAt: result.expiresAt,
    };
  }
}

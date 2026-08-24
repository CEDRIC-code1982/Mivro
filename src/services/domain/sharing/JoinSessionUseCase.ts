/**
 * @file JoinSessionUseCase.ts
 * @description Use case F5 — rejoindre une session partagée via un deep link.
 *              F5 use case — join a shared session via a deep link.
 *
 *              Orchestre / Orchestrates:
 *              1. récupère la session partagée (port `ISessionShareService`)
 *              2. **vérifie l'expiration** (rejette si expirée) + statut
 *              3. ajoute l'utilisateur courant comme `member` (point de départ)
 *              4. **relit le roster réel** (anti « lost update » sur join
 *                 concurrent) puis recalcule le midpoint (`CalculateMidpointUseCase`)
 *                 à partir des `members[].startLocation` et l'écrit dans la meta
 *              5. renvoie la session partagée à jour (la presentation bascule la
 *                 session locale en mode « partagée »)
 *
 *              Le recalcul du midpoint réutilise `CalculateMidpointUseCase` :
 *              les membres sont mappés en `Participant` synthétiques (le use case
 *              ne lit que `startLocation.coordinates`).
 *
 *              Aucune dépendance infrastructure ni présentation (règle de
 *              dépendance). Reçoit les ports par injection de constructeur.
 *
 * @module services/domain/sharing/JoinSessionUseCase
 */

// [ADDED] F5 — UseCase JoinSessionUseCase
import type { Participant } from '@entities/MidpointSession';
import type { SharedSession, SharedSessionMember } from '@entities/SharedSession';
import { CalculateMidpointUseCase } from '@services/domain/midpoint/CalculateMidpointUseCase';
import {
  SessionShareError,
  type ISessionShareService,
} from '@services/domain/sharing/ISessionShareService';

/** Nombre maximum de membres d'une session (cf. CalculateMidpointUseCase) */
const MAX_MEMBERS = 5;

/**
 * Entrée du use case JoinSession.
 * JoinSession use case input.
 */
export interface JoinSessionInput {
  /** Identifiant de la session partagée (extrait du deep link) / Shared session id */
  readonly sessionId: string;
  /** Membre à ajouter (utilisateur courant + son point de départ) / Member to add */
  readonly member: SharedSessionMember;
  /** Horodatage de référence (epoch ms) — injectable pour les tests / Reference timestamp */
  readonly now?: number;
}

/**
 * Mappe un membre de session partagée en `Participant` synthétique pour le calcul
 * du midpoint (seules les coordonnées sont lues par CalculateMidpointUseCase).
 * Maps a shared session member to a synthetic `Participant` for midpoint
 * computation (only coordinates are read by CalculateMidpointUseCase).
 *
 * @param member - Membre de session partagée / Shared session member
 * @returns Participant synthétique / Synthetic participant
 */
const toSyntheticParticipant = (member: SharedSessionMember): Participant => ({
  id: member.memberId,
  displayName: member.displayName,
  ...(member.avatarId !== undefined && { avatarId: member.avatarId }),
  startLocation: {
    // id synthétique non persisté : seules les coordonnées sont utilisées
    id: '00000000-0000-0000-0000-000000000000',
    coordinates: {
      latitude: member.startLocation.latitude,
      longitude: member.startLocation.longitude,
    },
    formattedAddress: member.startLocation.formattedAddress,
  },
});

/**
 * Use case : rejoindre une session partagée (avec recalcul du midpoint).
 * Use case: joining a shared session (with midpoint recomputation).
 *
 * @param shareService - Service de partage injecté / Injected sharing service
 * @param calculateMidpointUseCase - Use case de calcul du midpoint / Midpoint use case
 *
 * @example
 *   const useCase = new JoinSessionUseCase(shareService, calculateMidpointUseCase);
 *   const shared = await useCase.execute({ sessionId, member });
 */
export class JoinSessionUseCase {
  constructor(
    private readonly shareService: ISessionShareService,
    private readonly calculateMidpointUseCase: CalculateMidpointUseCase,
  ) {}

  /**
   * Rejoint la session : vérifie l'expiration, ajoute le membre, recalcule le
   * midpoint et renvoie la session partagée à jour.
   * Joins the session: checks expiration, adds the member, recomputes the
   * midpoint and returns the up-to-date shared session.
   *
   * @param input - sessionId + membre courant / sessionId + current member
   * @returns Session partagée à jour (avec le nouveau membre + midpoint) / Up-to-date shared session
   * @throws {SessionShareError} `not_found` si introuvable, `expired` si expirée,
   *         `closed` si fermée, `full` si pleine, ou erreur propagée du port
   */
  async execute(input: JoinSessionInput): Promise<SharedSession> {
    const { sessionId, member } = input;
    const now = input.now ?? Date.now();

    // 1. Récupération de la session partagée.
    const existing = await this.shareService.fetchSharedSession(sessionId);
    if (existing === null) {
      throw new SessionShareError('Shared session not found', 'not_found');
    }

    // 2. Vérification de l'expiration + du statut (RGPD : liens expirables).
    if (now >= existing.meta.expiresAt) {
      throw new SessionShareError('Shared session has expired', 'expired');
    }
    if (existing.meta.status === 'closed') {
      throw new SessionShareError('Shared session is closed', 'closed');
    }

    // Idempotence : si le membre est déjà présent, on n'en ré-ajoute pas un.
    const alreadyMember = existing.members.some((m) => m.memberId === member.memberId);

    if (!alreadyMember && existing.members.length >= MAX_MEMBERS) {
      // [MINEUR 6] Code typé `full` (au lieu de `unknown`) → message i18n dédié.
      throw new SessionShareError('Shared session is full', 'full');
    }

    // 3. Ajout du membre (point de départ collaboratif).
    if (!alreadyMember) {
      await this.shareService.joinSharedSession(sessionId, member);
    }

    // 4. [MAJEUR 4 — anti « lost update »] On RELIT le roster réel après notre
    //    écriture, au lieu de recomposer localement `existing.members + member`.
    //    Deux joins concurrents écrivent sous des clés `memberId` distinctes
    //    (write au nœud membre, pas au nœud session) → ils ne s'écrasent pas ;
    //    mais le midpoint, lui, est une valeur unique au niveau meta. En relisant
    //    le roster post-écriture, le midpoint qu'on calcule reflète TOUS les
    //    membres présents (y compris ceux ajoutés par un join concurrent),
    //    et non un instantané périmé. L'abonnement live (point 1) re-corrige
    //    de toute façon en continu côté présentation.
    const refreshed = await this.shareService.fetchSharedSession(sessionId);
    const members: readonly SharedSessionMember[] =
      refreshed?.members ??
      // Filet : si la relecture échoue à renvoyer un roster, on retombe sur la
      // recomposition locale plutôt que de planter la jointure.
      (alreadyMember ? existing.members : [...existing.members, member]);

    // 5. Recalcul du midpoint à partir des points de départ des membres réels.
    const result = this.calculateMidpointUseCase.execute({
      participants: members.map(toSyntheticParticipant),
    });
    await this.shareService.updateMidpoint(sessionId, result.midpoint, result.radius);

    console.log(
      `[INFO][JoinSessionUseCase][execute][?][${new Date().toISOString().slice(11, 19)}] ` +
        `Joined shared session | members: ${members.length}`,
    );

    // 6. Session partagée à jour renvoyée à la presentation.
    return {
      ...(refreshed ?? existing),
      members: [...members],
      meta: {
        ...(refreshed?.meta ?? existing.meta),
        midpoint: result.midpoint,
        midpointRadius: result.radius,
      },
    };
  }
}

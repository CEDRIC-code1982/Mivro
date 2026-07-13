/**
 * @file FirebaseSessionShareService.ts
 * @description Implémentation ISessionShareService basée sur Firebase Realtime
 *              Database (@react-native-firebase/database, API modulaire v25),
 *              comme F4. Gère le ROSTER partagé (meta + membres) d'une session.
 *              ISessionShareService implementation based on Firebase Realtime
 *              Database (modular API v25), like F4. Manages a session's shared
 *              ROSTER (meta + members).
 *
 *              Structure Firebase (étend F4 / extends F4) :
 *              sessions/{sessionId}/
 *                meta/    { createdAt, expiresAt, ownerType, status, midpoint?, midpointRadius? }
 *                members/{memberId}/  { displayName, avatarId?, startLocation }
 *                participants/{participantId}/  ← positions live F4 (NON touchées ici)
 *
 *              Responsabilités / Responsibilities:
 *              - create : écrit meta + members (merge, ne touche pas participants)
 *              - join : ajoute un membre sous members/{memberId}
 *              - fetch / subscribe : lit meta + members, **valide via Zod** (TS-004)
 *              - updateMidpoint : met à jour meta/midpoint + meta/midpointRadius
 *              - delete : supprime tout le nœud sessions/{sessionId} (RGPD)
 *              - try/catch sur tous les I/O (ERR-001), mapping → SessionShareError
 *                typée, crashReporter, logs LOG-001
 *
 *              ⚠️ RGPD : aucune coordonnée brute dans les logs (scrubbing).
 *
 *              ⚠️ PRÉREQUIS (à fournir par Cédric — voir guides/realtime-setup) :
 *              projet Firebase + GoogleService-Info.plist (iOS) +
 *              google-services.json (Android). Sans ces fichiers, l'app lève à
 *              l'init Firebase ; le code ci-dessous est prêt dès leur ajout.
 *
 *              firebase = infrastructure UNIQUEMENT : core et presentation
 *              n'importent JAMAIS @react-native-firebase (règle de dépendance).
 *
 * @module infrastructure/realtime/FirebaseSessionShareService
 */

// [ADDED] F5 — Adapter FirebaseSessionShareService (API modulaire)
import { getApp } from '@react-native-firebase/app';
import { get, getDatabase, onValue, ref, remove, update } from '@react-native-firebase/database';
import Config from 'react-native-config';
import type { Coordinates } from '@entities/Location';
import {
  buildShareLink,
  SharedSessionSchema,
  type SharedSession,
  type SharedSessionMember,
  type SharedSessionOwnerType,
} from '@entities/SharedSession';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import {
  SessionShareError,
  type CreateSharedSessionResult,
  type ISessionShareService,
  type SessionShareErrorCode,
  type SessionShareUnsubscribe,
  type SharedSessionUpdateHandler,
} from '@services/domain/sharing/ISessionShareService';

/** Racine du nœud sessions / Sessions node root */
const SESSIONS_NODE = 'sessions';
/** Sous-nœud meta / Meta sub-node */
const META_NODE = 'meta';
/** Sous-nœud members / Members sub-node */
const MEMBERS_NODE = 'members';

/**
 * Implémentation Firebase du port ISessionShareService.
 * Firebase implementation of the ISessionShareService port.
 *
 * @param crashReporter - Crash reporter optionnel (Sentry) / Optional crash reporter
 *
 * @example
 *   const service = new FirebaseSessionShareService(crashReporter);
 *   const { link } = await service.createSharedSession(session, 'guest');
 */
export class FirebaseSessionShareService implements ISessionShareService {
  constructor(private readonly crashReporter?: ICrashReporter) {}

  /**
   * Publie la session courante (meta + members) sur Firebase.
   * Publishes the current session (meta + members) to Firebase.
   *
   * @param session - Session partagée à publier / Shared session to publish
   * @param ownerType - Type de propriétaire / Owner type
   * @returns Identifiant, lien profond et date d'expiration / Identifier, deep link and expiration
   * @throws {SessionShareError} Si la publication échoue / If the publish fails
   */
  async createSharedSession(
    session: SharedSession,
    ownerType: SharedSessionOwnerType,
  ): Promise<CreateSharedSessionResult> {
    try {
      const sessionId = session.sessionId;

      // members → objet indexé par memberId (clé Firebase).
      const membersObject: Record<string, unknown> = {};
      for (const member of session.members) {
        membersObject[member.memberId] = this.serializeMember(member);
      }

      // Écriture mergée : meta + members. NE touche PAS au sous-nœud
      // participants (positions live F4) — update() ne remplace que les clés
      // fournies au niveau du nœud session.
      await update(ref(this.db(), this.sessionPath(sessionId)), {
        [META_NODE]: { ...session.meta, ownerType },
        [MEMBERS_NODE]: membersObject,
      });

      console.log(
        `[INFO][FirebaseSessionShareService][createSharedSession][?][${this.timestamp()}] ` +
          `Shared session created | members: ${session.members.length} | ownerType: ${ownerType}`,
      );

      return {
        sessionId,
        link: buildShareLink(sessionId),
        expiresAt: session.meta.expiresAt,
      };
    } catch (error: unknown) {
      const mapped = this.mapError(error, 'createSharedSession');
      this.report(mapped);
      throw mapped;
    }
  }

  /**
   * Ajoute un membre (point de départ) à la session partagée.
   * Adds a member (start point) to the shared session.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param member - Membre à ajouter / Member to add
   * @throws {SessionShareError} Si l'ajout échoue / If the add fails
   */
  async joinSharedSession(sessionId: string, member: SharedSessionMember): Promise<void> {
    try {
      const memberRef = ref(this.db(), this.memberPath(sessionId, member.memberId));
      await update(memberRef, this.serializeMember(member));

      console.log(
        `[INFO][FirebaseSessionShareService][joinSharedSession][?][${this.timestamp()}] ` +
          'Member added to shared session',
      );
    } catch (error: unknown) {
      const mapped = this.mapError(error, 'joinSharedSession');
      this.report(mapped);
      throw mapped;
    }
  }

  /**
   * Lit une fois l'état courant d'une session partagée.
   * Reads the current state of a shared session once.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @returns Session partagée validée, ou null si absente / Validated shared session, or null
   * @throws {SessionShareError} Si la lecture échoue / If the read fails
   */
  async fetchSharedSession(sessionId: string): Promise<SharedSession | null> {
    try {
      const snapshot = await get(ref(this.db(), this.sessionPath(sessionId)));
      const parsed = this.parseSession(sessionId, snapshot.val());

      console.log(
        `[INFO][FirebaseSessionShareService][fetchSharedSession][?][${this.timestamp()}] ` +
          `Fetched shared session | found: ${parsed !== null}`,
      );

      return parsed;
    } catch (error: unknown) {
      const mapped = this.mapError(error, 'fetchSharedSession');
      this.report(mapped);
      throw mapped;
    }
  }

  /**
   * S'abonne aux changements (meta + members) d'une session partagée.
   * Subscribes to a shared session's changes (meta + members).
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param onUpdate - Handler appelé à chaque changement / Handler called on each change
   * @returns Fonction de désabonnement / Unsubscribe function
   * @throws {SessionShareError} Si l'abonnement ne peut être établi / If the subscription fails
   */
  subscribeToSharedSession(
    sessionId: string,
    onUpdate: SharedSessionUpdateHandler,
  ): SessionShareUnsubscribe {
    try {
      const sessionRef = ref(this.db(), this.sessionPath(sessionId));

      const unsubscribe = onValue(
        sessionRef,
        (snapshot) => {
          // Données externes → validation Zod stricte (TS-004)
          onUpdate(this.parseSession(sessionId, snapshot.val()));
        },
        (error) => {
          const mapped = this.mapError(error, 'subscribeToSharedSession');
          this.report(mapped);
        },
      );

      console.log(
        `[INFO][FirebaseSessionShareService][subscribeToSharedSession][?][${this.timestamp()}] ` +
          'Subscribed to shared session',
      );

      return () => {
        unsubscribe();
        console.log(
          `[INFO][FirebaseSessionShareService][subscribeToSharedSession][?][${this.timestamp()}] ` +
            'Unsubscribed from shared session',
        );
      };
    } catch (error: unknown) {
      throw this.mapError(error, 'subscribeToSharedSession');
    }
  }

  /**
   * Met à jour le midpoint recalculé dans la meta.
   * Updates the recomputed midpoint in the meta.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param midpoint - Coordonnées du midpoint / Midpoint coordinates
   * @param radius - Rayon de zone en mètres / Zone radius in meters
   * @throws {SessionShareError} Si la mise à jour échoue / If the update fails
   */
  async updateMidpoint(sessionId: string, midpoint: Coordinates, radius: number): Promise<void> {
    try {
      const metaRef = ref(this.db(), this.metaPath(sessionId));
      await update(metaRef, {
        midpoint: { latitude: midpoint.latitude, longitude: midpoint.longitude },
        midpointRadius: radius,
      });

      // ⚠️ RGPD : log SANS coordonnées brutes
      console.log(
        `[INFO][FirebaseSessionShareService][updateMidpoint][?][${this.timestamp()}] ` +
          `Midpoint updated | radius: ${Math.round(radius)}m`,
      );
    } catch (error: unknown) {
      const mapped = this.mapError(error, 'updateMidpoint');
      this.report(mapped);
      throw mapped;
    }
  }

  /**
   * Supprime toute la session partagée (RGPD — fin de session).
   * Deletes the whole shared session (GDPR — end of session).
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @throws {SessionShareError} Si la suppression échoue durablement / If removal fails
   */
  async deleteSharedSession(sessionId: string): Promise<void> {
    try {
      await remove(ref(this.db(), this.sessionPath(sessionId)));
      console.log(
        `[INFO][FirebaseSessionShareService][deleteSharedSession][?][${this.timestamp()}] ` +
          'Shared session removed (GDPR)',
      );
    } catch (error: unknown) {
      const mapped = this.mapError(error, 'deleteSharedSession');
      this.report(mapped);
      throw mapped;
    }
  }

  /**
   * Sérialise un membre pour Firebase (sans memberId, qui est la clé).
   * Serializes a member for Firebase (without memberId, which is the key).
   *
   * @param member - Membre à sérialiser / Member to serialize
   * @returns Objet Firebase / Firebase object
   */
  private serializeMember(member: SharedSessionMember): Record<string, unknown> {
    return {
      displayName: member.displayName,
      ...(member.avatarId !== undefined && { avatarId: member.avatarId }),
      startLocation: {
        latitude: member.startLocation.latitude,
        longitude: member.startLocation.longitude,
        formattedAddress: member.startLocation.formattedAddress,
      },
    };
  }

  /**
   * Valide et mappe le contenu brut d'un nœud session en SharedSession.
   * Validates and maps a raw session node's content into a SharedSession.
   *
   * Le memberId (clé Firebase) est ré-injecté dans chaque membre avant
   * validation Zod (TS-004). Retourne null si le nœud est absent.
   * The memberId (Firebase key) is re-injected into each member before Zod
   * validation. Returns null if the node is absent.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param raw - Valeur brute du snapshot (inconnue) / Raw snapshot value (unknown)
   * @returns Session partagée validée, ou null / Validated shared session, or null
   * @throws {SessionShareError} Code `invalid_data` si la meta est invalide / If meta invalid
   */
  private parseSession(sessionId: string, raw: unknown): SharedSession | null {
    if (raw === null || typeof raw !== 'object') {
      return null;
    }

    const node = raw as Record<string, unknown>;
    // Une session sans meta n'est pas une session partagée valide (peut n'avoir
    // que `participants` F4) → on la considère absente côté partage.
    if (node[META_NODE] === undefined || node[META_NODE] === null) {
      return null;
    }

    const membersRaw = node[MEMBERS_NODE];
    const members: Array<Record<string, unknown>> = [];
    if (membersRaw !== null && typeof membersRaw === 'object') {
      for (const [memberId, value] of Object.entries(membersRaw as Record<string, unknown>)) {
        if (value !== null && typeof value === 'object') {
          members.push({ memberId, ...(value as Record<string, unknown>) });
        }
      }
    }

    const candidate = { sessionId, meta: node[META_NODE], members };
    const parsed = SharedSessionSchema.safeParse(candidate);
    if (!parsed.success) {
      const mapped = new SessionShareError(
        'Invalid shared session data',
        'invalid_data',
        parsed.error,
      );
      console.error(
        `[ERROR][FirebaseSessionShareService][parseSession][?][${this.timestamp()}] ` +
          'Invalid shared session data (Zod)',
      );
      this.report(mapped);
      throw mapped;
    }

    return parsed.data;
  }

  /**
   * Récupère l'instance Database (lève si Firebase non configuré).
   * Gets the Database instance (throws if Firebase not configured).
   *
   * Cible explicitement l'instance RTDB via son URL (`FIREBASE_DATABASE_URL`,
   * région europe-west1) ; fallback sans URL si absente (tests/CI). Cf. F4.
   * Explicitly targets the RTDB instance via its URL; falls back without URL
   * when absent (tests/CI). See F4.
   *
   * @returns Instance Database / Database instance
   */
  private db(): ReturnType<typeof getDatabase> {
    const url = Config.FIREBASE_DATABASE_URL;
    if (url !== undefined && url.length > 0) {
      return getDatabase(getApp(), url);
    }
    return getDatabase(getApp());
  }

  /**
   * Chemin du nœud d'une session.
   * Path of a session node.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @returns Chemin Firebase / Firebase path
   */
  private sessionPath(sessionId: string): string {
    return `${SESSIONS_NODE}/${sessionId}`;
  }

  /**
   * Chemin du nœud meta d'une session.
   * Path of a session's meta node.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @returns Chemin Firebase / Firebase path
   */
  private metaPath(sessionId: string): string {
    return `${this.sessionPath(sessionId)}/${META_NODE}`;
  }

  /**
   * Chemin du nœud d'un membre.
   * Path of a member node.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param memberId - Identifiant du membre / Member identifier
   * @returns Chemin Firebase / Firebase path
   */
  private memberPath(sessionId: string, memberId: string): string {
    return `${this.sessionPath(sessionId)}/${MEMBERS_NODE}/${memberId}`;
  }

  /**
   * Mappe une erreur Firebase / inconnue en SessionShareError typé.
   * Maps a Firebase / unknown error to a typed SessionShareError.
   *
   * @param error - Erreur originale / Original error
   * @param fn - Nom de la fonction appelante (pour le log) / Calling function name
   * @returns SessionShareError typé / Typed SessionShareError
   */
  private mapError(error: unknown, fn: string): SessionShareError {
    if (error instanceof SessionShareError) {
      return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    let code: SessionShareErrorCode = 'unknown';
    if (lower.includes('permission') || lower.includes('denied')) {
      code = 'permission_denied';
    } else if (
      lower.includes('network') ||
      lower.includes('offline') ||
      lower.includes('unavailable')
    ) {
      code = 'network';
    } else if (
      lower.includes('no firebase app') ||
      lower.includes('not configured') ||
      lower.includes('default app')
    ) {
      code = 'not_configured';
    }

    console.error(
      `[ERROR][FirebaseSessionShareService][${fn}][?][${this.timestamp()}] ` +
        `Share error | code: ${code}`,
    );

    return new SessionShareError(message, code, error);
  }

  /**
   * Reporte une erreur au crash reporter (tag feature: share).
   * Reports an error to the crash reporter (tag feature: share).
   *
   * @param error - Erreur typée à reporter / Typed error to report
   */
  private report(error: SessionShareError): void {
    this.crashReporter?.captureException(error, {
      tags: { feature: 'share' },
      extra: { code: error.code },
    });
  }

  /**
   * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
   * Generates an HH:mm:ss timestamp for logging (LOG-001).
   *
   * @returns Timestamp formaté / Formatted timestamp
   */
  private timestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }
}

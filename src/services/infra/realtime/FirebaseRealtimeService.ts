/**
 * @file FirebaseRealtimeService.ts
 * @description Implémentation IRealtimeService basée sur Firebase Realtime
 *              Database (@react-native-firebase/database, API modulaire v22+).
 *              IRealtimeService implementation based on Firebase Realtime
 *              Database (@react-native-firebase/database, modular API v22+).
 *
 *              Structure Firebase (cf. CLAUDE.md > LOCALISATION TEMPS RÉEL) :
 *              sessions/{sessionId}/participants/{participantId}/
 *                { latitude, longitude, updatedAt(serverTimestamp), speed,
 *                  heading, isOnline }
 *
 *              Responsabilités / Responsibilities:
 *              - subscribe : lit le nœud participants, **valide chaque entrée
 *                via Zod** (TS-004), ignore les entrées invalides
 *              - publish : écrit la position + isOnline=true + serverTimestamp,
 *                arme onDisconnect → isOnline=false (coupure réseau)
 *              - leave : supprime le nœud du participant (RGPD)
 *              - try/catch sur tous les appels I/O (ERR-001), mapping erreurs
 *                → RealtimeError typée, crashReporter, logs LOG-001
 *
 *              ⚠️ RGPD : aucune coordonnée brute dans les logs (scrubbing).
 *
 *              ⚠️ PRÉREQUIS (à fournir par Cédric — voir guides/realtime-setup) :
 *              projet Firebase + GoogleService-Info.plist (iOS) +
 *              google-services.json (Android). Sans ces fichiers, l'app lève
 *              à l'init Firebase ; le code ci-dessous est prêt à fonctionner
 *              dès leur ajout. Aucun faux fichier de config n'est créé.
 *
 *              firebase = infrastructure UNIQUEMENT : core et presentation
 *              n'importent JAMAIS @react-native-firebase (règle de dépendance).
 *
 * @module infrastructure/realtime/FirebaseRealtimeService
 */

// [ADDED] F4 — Adapter FirebaseRealtimeService (API modulaire)
import { getApp } from '@react-native-firebase/app';
import {
  getDatabase,
  onValue,
  onDisconnect,
  ref,
  remove,
  serverTimestamp,
  update,
} from '@react-native-firebase/database';
import Config from 'react-native-config';
import type { RealtimeLocationUpdate, RealtimeParticipant } from '@entities/RealtimeParticipant';
import { RealtimeParticipantSchema } from '@entities/RealtimeParticipant';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import { RealtimeError } from '@services/domain/realtime/IRealtimeService';
import type {
  IRealtimeService,
  RealtimeErrorCode,
  RealtimeUpdateHandler,
  Unsubscribe,
} from '@services/domain/realtime/IRealtimeService';

/** Racine du nœud sessions / Sessions node root */
const SESSIONS_NODE = 'sessions';
/** Sous-nœud participants / Participants sub-node */
const PARTICIPANTS_NODE = 'participants';

/**
 * Implémentation Firebase du port IRealtimeService.
 * Firebase implementation of the IRealtimeService port.
 *
 * @param crashReporter - Crash reporter optionnel (Sentry) / Optional crash reporter
 *
 * @example
 *   const service = new FirebaseRealtimeService(crashReporter);
 *   const unsub = service.subscribeToSession(sessionId, onUpdate);
 */
export class FirebaseRealtimeService implements IRealtimeService {
  constructor(private readonly crashReporter?: ICrashReporter) {}

  /**
   * S'abonne aux positions live des participants d'une session.
   * Subscribes to a session's participants' live positions.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param onUpdate - Handler appelé à chaque changement / Handler on each change
   * @returns Fonction de désabonnement / Unsubscribe function
   * @throws {RealtimeError} Si l'abonnement ne peut être établi / If subscription fails
   */
  subscribeToSession(sessionId: string, onUpdate: RealtimeUpdateHandler): Unsubscribe {
    try {
      const participantsRef = ref(this.db(), this.participantsPath(sessionId));

      const unsubscribe = onValue(
        participantsRef,
        (snapshot) => {
          // Données externes → validation Zod stricte (TS-004)
          const participants = this.parseSnapshot(snapshot.val());
          onUpdate(participants);
        },
        (error) => {
          // cancelCallback : abonnement refusé/coupé par Firebase
          const mapped = this.mapError(error, 'subscribeToSession');
          this.crashReporter?.captureException(mapped, {
            tags: { feature: 'realtime' },
            extra: { code: mapped.code },
          });
        },
      );

      console.log(
        `[INFO][FirebaseRealtimeService][subscribeToSession][?][${this.timestamp()}] ` +
          'Subscribed to session participants',
      );

      return () => {
        unsubscribe();
        console.log(
          `[INFO][FirebaseRealtimeService][subscribeToSession][?][${this.timestamp()}] ` +
            'Unsubscribed from session participants',
        );
      };
    } catch (error: unknown) {
      throw this.mapError(error, 'subscribeToSession');
    }
  }

  /**
   * Publie la position courante du participant (+ onDisconnect → offline).
   * Publishes the participant's current position (+ onDisconnect → offline).
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param participantId - Identifiant du participant / Participant identifier
   * @param location - Position à publier / Location to publish
   * @throws {RealtimeError} Si la publication échoue / If the publish fails
   */
  async publishLocation(
    sessionId: string,
    participantId: string,
    location: RealtimeLocationUpdate,
  ): Promise<void> {
    try {
      const participantRef = ref(this.db(), this.participantPath(sessionId, participantId));

      // Arme onDisconnect AVANT l'écriture : si la connexion saute, le serveur
      // repasse isOnline=false automatiquement (best-effort, idempotent).
      // Arm onDisconnect BEFORE writing: on connection loss the server flips
      // isOnline back to false automatically.
      await onDisconnect(participantRef).update({ isOnline: false });

      // Écriture atomique du nœud participant (update = merge, pas de remove
      // des autres clés). serverTimestamp() = horloge serveur (anti-triche).
      await update(participantRef, {
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed,
        heading: location.heading,
        isOnline: true,
        updatedAt: serverTimestamp(),
      });

      // ⚠️ RGPD : log SANS coordonnées brutes
      console.log(
        `[INFO][FirebaseRealtimeService][publishLocation][?][${this.timestamp()}] ` +
          `Location published | speed: ${location.speed.toFixed(1)}km/h`,
      );
    } catch (error: unknown) {
      const mapped = this.mapError(error, 'publishLocation');
      this.crashReporter?.captureException(mapped, {
        tags: { feature: 'realtime' },
        extra: { code: mapped.code },
      });
      throw mapped;
    }
  }

  /**
   * Quitte la session : supprime le nœud du participant (RGPD).
   * Leaves the session: removes the participant's node (GDPR).
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param participantId - Identifiant du participant / Participant identifier
   * @throws {RealtimeError} Si la suppression échoue durablement / If removal fails
   */
  async leaveSession(sessionId: string, participantId: string): Promise<void> {
    try {
      const participantRef = ref(this.db(), this.participantPath(sessionId, participantId));

      // Annule le onDisconnect armé puis supprime le nœud (position effacée).
      // Cancels the armed onDisconnect then removes the node (position erased).
      await onDisconnect(participantRef).cancel();
      await remove(participantRef);

      console.log(
        `[INFO][FirebaseRealtimeService][leaveSession][?][${this.timestamp()}] ` +
          'Participant node removed (GDPR)',
      );
    } catch (error: unknown) {
      const mapped = this.mapError(error, 'leaveSession');
      this.crashReporter?.captureException(mapped, {
        tags: { feature: 'realtime' },
        extra: { code: mapped.code },
      });
      throw mapped;
    }
  }

  /**
   * Récupère l'instance Database (lève si Firebase non configuré).
   * Gets the Database instance (throws if Firebase not configured).
   *
   * Cible explicitement l'instance RTDB via son URL (`FIREBASE_DATABASE_URL`,
   * région europe-west1) lue depuis react-native-config : les instances RTDB
   * hors us-central1 EXIGENT l'URL explicite, sinon le SDK vise l'instance
   * par défaut us-central1 (inexistante ici). Si l'URL est absente (tests/CI
   * où l'env est vide) → fallback `getDatabase(getApp())` pour ne pas casser.
   *
   * Explicitly targets the RTDB instance via its URL (`FIREBASE_DATABASE_URL`,
   * europe-west1 region) read from react-native-config: non-us-central1 RTDB
   * instances REQUIRE the explicit URL. When absent (tests/CI with empty env)
   * → fallback to `getDatabase(getApp())` so nothing breaks.
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
   * Chemin du nœud participants d'une session.
   * Path of a session's participants node.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @returns Chemin Firebase / Firebase path
   */
  private participantsPath(sessionId: string): string {
    return `${SESSIONS_NODE}/${sessionId}/${PARTICIPANTS_NODE}`;
  }

  /**
   * Chemin du nœud d'un participant.
   * Path of a single participant's node.
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param participantId - Identifiant du participant / Participant identifier
   * @returns Chemin Firebase / Firebase path
   */
  private participantPath(sessionId: string, participantId: string): string {
    return `${this.participantsPath(sessionId)}/${participantId}`;
  }

  /**
   * Valide et mappe le contenu brut du nœud participants en entités.
   * Validates and maps the raw participants node content into entities.
   *
   * Chaque entrée est validée via Zod (TS-004) ; les entrées invalides sont
   * ignorées (loggées + reportées) plutôt que de faire planter l'abonnement.
   * Each entry is validated via Zod (TS-004); invalid entries are skipped
   * (logged + reported) rather than crashing the subscription.
   *
   * @param raw - Valeur brute du snapshot (inconnue) / Raw snapshot value (unknown)
   * @returns Participants live validés / Validated live participants
   */
  private parseSnapshot(raw: unknown): readonly RealtimeParticipant[] {
    if (raw === null || typeof raw !== 'object') {
      return [];
    }

    const result: RealtimeParticipant[] = [];
    let invalidCount = 0;

    for (const [participantId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value === null || typeof value !== 'object') {
        invalidCount += 1;
        continue;
      }

      const candidate = { participantId, ...(value as Record<string, unknown>) };
      const parsed = RealtimeParticipantSchema.safeParse(candidate);
      if (parsed.success) {
        result.push(parsed.data);
      } else {
        invalidCount += 1;
      }
    }

    if (invalidCount > 0) {
      console.warn(
        `[WARN][FirebaseRealtimeService][parseSnapshot][?][${this.timestamp()}] ` +
          `Skipped ${invalidCount} invalid participant entr${invalidCount > 1 ? 'ies' : 'y'}`,
      );
      this.crashReporter?.captureMessage('Realtime: invalid participant data skipped', {
        level: 'warning',
        tags: { feature: 'realtime' },
        extra: { invalidCount },
      });
    }

    return result;
  }

  /**
   * Mappe une erreur Firebase / inconnue en RealtimeError typé.
   * Maps a Firebase / unknown error to a typed RealtimeError.
   *
   * @param error - Erreur originale / Original error
   * @param fn - Nom de la fonction appelante (pour le log) / Calling function name
   * @returns RealtimeError typé / Typed RealtimeError
   */
  private mapError(error: unknown, fn: string): RealtimeError {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();

    let code: RealtimeErrorCode = 'unknown';
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
      `[ERROR][FirebaseRealtimeService][${fn}][?][${this.timestamp()}] ` +
        `Realtime error | code: ${code}`,
    );

    return new RealtimeError(message, code, error);
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

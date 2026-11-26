/**
 * @file FirebaseSessionShareService.ts
 * @description ISessionShareService implementation based on Firebase Realtime
 *              Database (@react-native-firebase/database, modular API v25),
 *              like F4. Manages a session's shared ROSTER (meta + members).
 *
 *              Firebase structure (extends F4):
 *              sessions/{sessionId}/
 *                meta/    { createdAt, expiresAt, ownerType, status, midpoint?, midpointRadius? }
 *                members/{memberId}/  { displayName, avatarId?, startLocation }
 *                participants/{participantId}/  ← F4 live positions (NOT touched here)
 *
 *              Responsibilities:
 *              - create: writes meta + members (merge, does not touch participants)
 *              - join: adds a member under members/{memberId}
 *              - fetch / subscribe: reads meta + members, **validates via Zod** (TS-004)
 *              - updateMidpoint: updates meta/midpoint + meta/midpointRadius
 *              - removeMember: removes members/{memberId} (GDPR, best-effort,
 *                never rejects)
 *              - delete: removes the whole sessions/{sessionId} node (GDPR)
 *              - try/catch on every I/O (ERR-001), mapping → typed
 *                SessionShareError, crashReporter, LOG-001 logs
 *
 *              ⚠️ GDPR: no raw coordinate in the logs (scrubbing).
 *
 *              ⚠️ PREREQUISITE (to be provided by Cédric — see guides/realtime-setup):
 *              Firebase project + GoogleService-Info.plist (iOS) +
 *              google-services.json (Android). Without these files, the app
 *              throws at Firebase init; the code below is ready as soon as they
 *              are added.
 *
 *              firebase = adapter ONLY: services/domain, features and
 *              components NEVER import `@react-native-firebase`
 *              (dependency rule, checked by npm run check:arch).
 *
 * @module services/infra/realtime/FirebaseSessionShareService
 */

// [ADDED] F5 — FirebaseSessionShareService adapter (modular API)
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

/** Sessions node root */
const SESSIONS_NODE = 'sessions';
/** Meta sub-node */
const META_NODE = 'meta';
/** Members sub-node */
const MEMBERS_NODE = 'members';

/**
 * Firebase implementation of the ISessionShareService port.
 *
 * @param crashReporter - Optional crash reporter (Sentry)
 *
 * @example
 *   const service = new FirebaseSessionShareService(crashReporter);
 *   const { link } = await service.createSharedSession(session, 'guest');
 */
export class FirebaseSessionShareService implements ISessionShareService {
  constructor(private readonly crashReporter?: ICrashReporter) {}

  /**
   * Publishes the current session (meta + members) to Firebase.
   *
   * @param session - Shared session to publish
   * @param ownerType - Owner type
   * @returns Identifier, deep link and expiration date
   * @throws {SessionShareError} If the publish fails
   */
  async createSharedSession(
    session: SharedSession,
    ownerType: SharedSessionOwnerType,
  ): Promise<CreateSharedSessionResult> {
    try {
      const sessionId = session.sessionId;

      // members → object keyed by memberId (Firebase key).
      const membersObject: Record<string, unknown> = {};
      for (const member of session.members) {
        membersObject[member.memberId] = this.serializeMember(member);
      }

      // Merged write: meta + members. Does NOT touch the participants
      // sub-node (F4 live positions) — update() only replaces the keys
      // provided at the session node level.
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
   * Adds a member (start point) to the shared session.
   *
   * @param sessionId - Session identifier
   * @param member - Member to add
   * @throws {SessionShareError} If the add fails
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
   * Reads the current state of a shared session once.
   *
   * @param sessionId - Session identifier
   * @returns Validated shared session, or null if absent
   * @throws {SessionShareError} If the read fails
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
   * Subscribes to a shared session's changes (meta + members).
   *
   * @param sessionId - Session identifier
   * @param onUpdate - Handler called on each change
   * @returns Unsubscribe function
   * @throws {SessionShareError} If the subscription cannot be established
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
          // External data → strict Zod validation (TS-004)
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
   * Updates the recomputed midpoint in the meta.
   *
   * @param sessionId - Session identifier
   * @param midpoint - Midpoint coordinates
   * @param radius - Zone radius in meters
   * @throws {SessionShareError} If the update fails
   */
  async updateMidpoint(sessionId: string, midpoint: Coordinates, radius: number): Promise<void> {
    try {
      const metaRef = ref(this.db(), this.metaPath(sessionId));
      await update(metaRef, {
        midpoint: { latitude: midpoint.latitude, longitude: midpoint.longitude },
        midpointRadius: radius,
      });

      // ⚠️ GDPR: log WITHOUT raw coordinates
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
   * Removes one member node (members/{memberId}) from the shared session
   * (GDPR: the member's start point is an exact address).
   *
   * Best-effort, **never rejects** (port contract): on failure the error is
   * mapped, logged and reported to the crash reporter, then swallowed.
   * Removing an absent node is a no-op on RTDB (idempotent). The
   * `members/$memberId` rule (`.write: true`) already allows this write.
   *
   * @param sessionId - Session identifier
   * @param memberId - Member identifier
   * @returns A promise that always resolves
   */
  async removeMember(sessionId: string, memberId: string): Promise<void> {
    try {
      await remove(ref(this.db(), this.memberPath(sessionId, memberId)));
      console.log(
        `[INFO][FirebaseSessionShareService][removeMember][?][${this.timestamp()}] ` +
          'Member removed from shared session (GDPR)',
      );
    } catch (error: unknown) {
      const mapped = this.mapError(error, 'removeMember');
      // Cleanup must never break the caller's flow: log + report without throwing.
      console.warn(
        `[WARN][FirebaseSessionShareService][removeMember][?][${this.timestamp()}] ` +
          `Failed to remove member (best-effort) | code: ${mapped.code}`,
      );
      try {
        this.report(mapped);
      } catch {
        // Reporting must not make removeMember reject: the port promises that
        // removeMember never rejects, so a crash reporter failure is swallowed.
      }
    }
  }

  /**
   * Deletes the whole shared session (GDPR — end of session).
   *
   * @param sessionId - Session identifier
   * @throws {SessionShareError} If removal fails persistently
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
   * Serializes a member for Firebase (without memberId, which is the key).
   *
   * @param member - Member to serialize
   * @returns Firebase object
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
   * Validates and maps a raw session node's content into a SharedSession.
   *
   * The memberId (Firebase key) is re-injected into each member before Zod
   * validation (TS-004). Returns null if the node is absent.
   *
   * @param sessionId - Session identifier
   * @param raw - Raw snapshot value (unknown)
   * @returns Validated shared session, or null
   * @throws {SessionShareError} Code `invalid_data` if the meta is invalid
   */
  private parseSession(sessionId: string, raw: unknown): SharedSession | null {
    if (raw === null || typeof raw !== 'object') {
      return null;
    }

    // Justified cast: the guard above ruled out null and non-objects. The
    // values read next go through a Zod schema before any use (TS-004).
    const node = raw as Record<string, unknown>;
    // A session without meta is not a valid shared session (it may only have
    // F4 `participants`) → it is considered absent on the sharing side.
    if (node[META_NODE] === undefined || node[META_NODE] === null) {
      return null;
    }

    const membersRaw = node[MEMBERS_NODE];
    const members: Array<Record<string, unknown>> = [];
    if (membersRaw !== null && typeof membersRaw === 'object') {
      // Justified cast: membersRaw has just been guarded as a non-null object;
      // Firebase stores members as a dictionary keyed by memberId.
      for (const [memberId, value] of Object.entries(membersRaw as Record<string, unknown>)) {
        if (value !== null && typeof value === 'object') {
          // Justified cast: value guarded as a non-null object just above; the
          // actual shape is validated by the Zod schema below (TS-004).
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
   * Gets the Database instance (throws if Firebase not configured).
   *
   * Explicitly targets the RTDB instance via its URL (`FIREBASE_DATABASE_URL`,
   * europe-west1 region); falls back without URL when absent (tests/CI).
   * See F4.
   *
   * @returns Database instance
   */
  private db(): ReturnType<typeof getDatabase> {
    const url = Config.FIREBASE_DATABASE_URL;
    if (url !== undefined && url.length > 0) {
      return getDatabase(getApp(), url);
    }
    return getDatabase(getApp());
  }

  /**
   * Path of a session node.
   *
   * @param sessionId - Session identifier
   * @returns Firebase path
   */
  private sessionPath(sessionId: string): string {
    return `${SESSIONS_NODE}/${sessionId}`;
  }

  /**
   * Path of a session's meta node.
   *
   * @param sessionId - Session identifier
   * @returns Firebase path
   */
  private metaPath(sessionId: string): string {
    return `${this.sessionPath(sessionId)}/${META_NODE}`;
  }

  /**
   * Path of a member node.
   *
   * @param sessionId - Session identifier
   * @param memberId - Member identifier
   * @returns Firebase path
   */
  private memberPath(sessionId: string, memberId: string): string {
    return `${this.sessionPath(sessionId)}/${MEMBERS_NODE}/${memberId}`;
  }

  /**
   * Maps a Firebase / unknown error to a typed SessionShareError.
   *
   * @param error - Original error
   * @param fn - Calling function name (for the log)
   * @returns Typed SessionShareError
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
   * Reports an error to the crash reporter (tag feature: share).
   *
   * @param error - Typed error to report
   */
  private report(error: SessionShareError): void {
    this.crashReporter?.captureException(error, {
      tags: { feature: 'share' },
      extra: { code: error.code },
    });
  }

  /**
   * Generates an HH:mm:ss timestamp for logging (LOG-001).
   *
   * @returns Formatted timestamp
   */
  private timestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }
}

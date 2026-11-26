/**
 * @file JoinSessionUseCase.ts
 * @description F5 use case — join a shared session via a deep link.
 *
 *              Orchestrates:
 *              1. fetches the shared session (`ISessionShareService` port)
 *              2. **checks expiration** (rejects if expired) + status
 *              3. adds the current user as a `member` (start point)
 *              4. **re-reads the real roster** (anti "lost update" on concurrent
 *                 join); if the session is gone by then, removes the member
 *                 just written and throws `not_found`; otherwise recomputes the
 *                 midpoint (`CalculateMidpointUseCase`) from the
 *                 `members[].startLocation` and writes it into the meta
 *              5. returns the up-to-date shared session (the presentation
 *                 switches the local session to "shared" mode)
 *
 *              The midpoint recomputation reuses `CalculateMidpointUseCase`:
 *              members are mapped to synthetic `Participant`s (the use case
 *              only reads `startLocation.coordinates`).
 *
 *              No infrastructure nor presentation dependency (dependency
 *              rule). Receives the ports through constructor injection.
 *
 * @module services/domain/sharing/JoinSessionUseCase
 */

// [ADDED] F5 — JoinSessionUseCase use case
import type { Participant } from '@entities/MidpointSession';
import type { SharedSession, SharedSessionMember } from '@entities/SharedSession';
import { CalculateMidpointUseCase } from '@services/domain/midpoint/CalculateMidpointUseCase';
import {
  SessionShareError,
  type ISessionShareService,
} from '@services/domain/sharing/ISessionShareService';

/** Maximum number of members in a session (see CalculateMidpointUseCase) */
const MAX_MEMBERS = 5;

/**
 * JoinSession use case input.
 */
export interface JoinSessionInput {
  /** Shared session id (extracted from the deep link) */
  readonly sessionId: string;
  /** Member to add (current user + their start point) */
  readonly member: SharedSessionMember;
  /** Reference timestamp (epoch ms) — injectable for tests */
  readonly now?: number;
}

/**
 * Maps a shared session member to a synthetic `Participant` for midpoint
 * computation (only coordinates are read by CalculateMidpointUseCase).
 *
 * @param member - Shared session member
 * @returns Synthetic participant
 */
const toSyntheticParticipant = (member: SharedSessionMember): Participant => ({
  id: member.memberId,
  displayName: member.displayName,
  ...(member.avatarId !== undefined && { avatarId: member.avatarId }),
  startLocation: {
    // Synthetic id, never persisted: only the coordinates are used
    id: '00000000-0000-0000-0000-000000000000',
    coordinates: {
      latitude: member.startLocation.latitude,
      longitude: member.startLocation.longitude,
    },
    formattedAddress: member.startLocation.formattedAddress,
  },
});

/**
 * Use case: joining a shared session (with midpoint recomputation).
 *
 * @param shareService - Injected sharing service
 * @param calculateMidpointUseCase - Midpoint computation use case
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
   * Joins the session: checks expiration, adds the member, recomputes the
   * midpoint and returns the up-to-date shared session.
   *
   * @param input - sessionId + current member
   * @returns Up-to-date shared session (with the new member + midpoint)
   * @throws {SessionShareError} `not_found` if not found (including when the
   *         session is deleted between the first read and the re-read after
   *         the member write), `expired` if expired, `closed` if closed,
   *         `full` if full, or an error propagated from the port
   */
  async execute(input: JoinSessionInput): Promise<SharedSession> {
    const { sessionId, member } = input;
    const now = input.now ?? Date.now();

    // 1. Fetch the shared session.
    const existing = await this.shareService.fetchSharedSession(sessionId);
    if (existing === null) {
      throw new SessionShareError('Shared session not found', 'not_found');
    }

    // 2. Check expiration + status (GDPR: expirable links).
    if (now >= existing.meta.expiresAt) {
      throw new SessionShareError('Shared session has expired', 'expired');
    }
    if (existing.meta.status === 'closed') {
      throw new SessionShareError('Shared session is closed', 'closed');
    }

    // Idempotence: if the member is already present, we do not add it again.
    const alreadyMember = existing.members.some((m) => m.memberId === member.memberId);

    if (!alreadyMember && existing.members.length >= MAX_MEMBERS) {
      // [MINEUR 6] Typed `full` code (instead of `unknown`) → dedicated i18n message.
      throw new SessionShareError('Shared session is full', 'full');
    }

    // 3. Add the member (collaborative start point).
    if (!alreadyMember) {
      await this.shareService.joinSharedSession(sessionId, member);
    }

    // 4. [MAJEUR 4 — anti "lost update"] We RE-READ the real roster after our
    //    write, instead of locally recomposing `existing.members + member`.
    //    Two concurrent joins write under distinct `memberId` keys (write at
    //    the member node, not at the session node) → they do not overwrite
    //    each other; but the midpoint is a single value at the meta level. By
    //    re-reading the roster after the write, the midpoint we compute
    //    reflects ALL the members present (including those added by a
    //    concurrent join), and not a stale snapshot. The live subscription
    //    (point 1) keeps correcting it continuously on the presentation side
    //    anyway.
    //
    //    A `null` re-read means the session was deleted between step 1 and
    //    now: there is NO fallback on the local roster any more. Falling back
    //    would let `updateMidpoint` recreate `meta`, and our member write would
    //    survive as an orphan node holding the guest's exact address, which
    //    `purgeExpiredSessions` ignores (it only purges sessions whose meta
    //    says they expired). So we throw `not_found` without calling
    //    `updateMidpoint`, after a best-effort removal of the member node, for
    //    a new member only: an already-present member was not written by this
    //    call, so there is nothing of ours to remove. `removeMember` never
    //    rejects, so the guest always gets `not_found`.
    //    Residual window, not closable without a transaction nor Auth: a
    //    deletion landing between this re-read and `updateMidpoint` below.
    //    A re-read that fails (network) instead of returning `null` still
    //    propagates the port error: the session exists, there is no orphan.
    const refreshed = await this.shareService.fetchSharedSession(sessionId);
    if (refreshed === null) {
      if (!alreadyMember) {
        await this.shareService.removeMember(sessionId, member.memberId);
      }
      console.warn(
        `[WARN][JoinSessionUseCase][execute][?][${new Date().toISOString().slice(11, 19)}] ` +
          `Shared session deleted while joining | memberRemoved: ${!alreadyMember}`,
      );
      throw new SessionShareError('Shared session deleted while joining', 'not_found');
    }

    // 5. Recompute the midpoint from the real members' start points.
    const result = this.calculateMidpointUseCase.execute({
      participants: refreshed.members.map(toSyntheticParticipant),
    });
    await this.shareService.updateMidpoint(sessionId, result.midpoint, result.radius);

    console.log(
      `[INFO][JoinSessionUseCase][execute][?][${new Date().toISOString().slice(11, 19)}] ` +
        `Joined shared session | members: ${refreshed.members.length}`,
    );

    // 6. Up-to-date shared session returned to the presentation.
    return {
      ...refreshed,
      meta: {
        ...refreshed.meta,
        midpoint: result.midpoint,
        midpointRadius: result.radius,
      },
    };
  }
}

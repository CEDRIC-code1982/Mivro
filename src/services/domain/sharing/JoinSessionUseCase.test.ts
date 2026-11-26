/**
 * @file JoinSessionUseCase.test.ts
 * @description Unit tests for the JoinSessionUseCase (F5).
 *
 *              Covers: success (member added + midpoint recomputed), expired,
 *              not_found, closed, full (`full` code), idempotence (member already
 *              present), no start point (propagated through the provided member),
 *              error propagation, and a session deleted while joining (re-read
 *              returning `null` → best-effort `removeMember` for a new member,
 *              then `not_found` without `updateMidpoint`).
 *
 *              ⚠️ The use case calls `fetchSharedSession` TWICE: before the add
 *              (validation) then after (re-read of the real roster, anti "lost
 *              update"). The mocks therefore return an UP-TO-DATE roster on the
 *              2nd call via `mockResolvedValueOnce` (1st = initial state, 2nd =
 *              post-write roster).
 *
 * @module services/domain/sharing/JoinSessionUseCase.test
 */

// [ADDED] F5 — JoinSessionUseCase unit tests
import { mock } from 'jest-mock-extended';
import {
  SHARE_TTL_GUEST_MS,
  type SharedSession,
  type SharedSessionMember,
} from '@entities/SharedSession';
import { CalculateMidpointUseCase } from '@services/domain/midpoint/CalculateMidpointUseCase';
import {
  SessionShareError,
  type ISessionShareService,
} from '@services/domain/sharing/ISessionShareService';
import { JoinSessionUseCase } from '@services/domain/sharing/JoinSessionUseCase';

const NOW = 1_700_000_000_000;
const SESSION_ID = 'session-001';

const makeMember = (id: string, lat = 48.8566, lng = 2.3522): SharedSessionMember => ({
  memberId: id,
  displayName: `User ${id}`,
  startLocation: { latitude: lat, longitude: lng, formattedAddress: `Adresse ${id}` },
});

const makeShared = (overrides: Partial<SharedSession> = {}): SharedSession => ({
  sessionId: SESSION_ID,
  meta: {
    createdAt: NOW - 1000,
    expiresAt: NOW + SHARE_TTL_GUEST_MS,
    ownerType: 'guest',
    status: 'open',
  },
  members: [makeMember('a', 48.0, 2.0)],
  ...overrides,
});

describe('JoinSessionUseCase', () => {
  let service: ReturnType<typeof mock<ISessionShareService>>;
  let calculateMidpoint: CalculateMidpointUseCase;
  let useCase: JoinSessionUseCase;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    service = mock<ISessionShareService>();
    service.joinSharedSession.mockResolvedValue(undefined);
    service.updateMidpoint.mockResolvedValue(undefined);
    service.removeMember.mockResolvedValue(undefined);
    calculateMidpoint = new CalculateMidpointUseCase();
    useCase = new JoinSessionUseCase(service, calculateMidpoint);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Success ──────────────────────────────────────────────
  describe('success', () => {
    it('adds the new member then recomputes + persists the midpoint', async () => {
      const newMember = makeMember('b', 50.0, 4.0);
      // 1st fetch (validation): initial roster; 2nd fetch (re-read): up-to-date roster.
      service.fetchSharedSession
        .mockResolvedValueOnce(makeShared())
        .mockResolvedValueOnce(makeShared({ members: [makeMember('a', 48.0, 2.0), newMember] }));

      const result = await useCase.execute({ sessionId: SESSION_ID, member: newMember, now: NOW });

      expect(service.fetchSharedSession).toHaveBeenCalledTimes(2);
      expect(service.joinSharedSession).toHaveBeenCalledWith(SESSION_ID, newMember);
      expect(service.updateMidpoint).toHaveBeenCalledTimes(1);
      expect(result.members).toHaveLength(2);
      expect(result.members.map((m) => m.memberId)).toEqual(['a', 'b']);
      expect(result.meta.midpoint).toBeDefined();
      expect(result.meta.midpointRadius).toBeGreaterThan(0);
    });

    it('recomputes the midpoint from the refreshed roster (anti lost-update)', async () => {
      // A concurrent join added 'c' between our validation and our re-read:
      // the midpoint must reflect ALL the members present at the 2nd fetch
      // (a + b + c), not the stale snapshot (a) read at the 1st fetch.
      const newMember = makeMember('b', 50.0, 4.0);
      service.fetchSharedSession.mockResolvedValueOnce(makeShared()).mockResolvedValueOnce(
        makeShared({
          members: [makeMember('a', 48.0, 2.0), newMember, makeMember('c', 46.0, 6.0)],
        }),
      );

      const result = await useCase.execute({ sessionId: SESSION_ID, member: newMember, now: NOW });

      expect(result.members).toHaveLength(3);
      expect(result.members.map((m) => m.memberId)).toEqual(['a', 'b', 'c']);
      const expected = calculateMidpoint.execute({
        participants: result.members.map((m) => ({
          id: m.memberId,
          displayName: m.displayName,
          startLocation: {
            id: '00000000-0000-0000-0000-000000000000',
            coordinates: {
              latitude: m.startLocation.latitude,
              longitude: m.startLocation.longitude,
            },
            formattedAddress: m.startLocation.formattedAddress,
          },
        })),
      });
      expect(service.updateMidpoint).toHaveBeenCalledWith(
        SESSION_ID,
        expected.midpoint,
        expected.radius,
      );
    });

    it('persists the same midpoint that was recomputed', async () => {
      const newMember = makeMember('b', 50.0, 4.0);
      service.fetchSharedSession
        .mockResolvedValueOnce(makeShared())
        .mockResolvedValueOnce(makeShared({ members: [makeMember('a', 48.0, 2.0), newMember] }));
      const expected = calculateMidpoint.execute({
        participants: [
          {
            id: 'a',
            displayName: 'User a',
            startLocation: {
              id: '00000000-0000-0000-0000-000000000000',
              coordinates: { latitude: 48.0, longitude: 2.0 },
              formattedAddress: 'Adresse a',
            },
          },
          {
            id: 'b',
            displayName: 'User b',
            startLocation: {
              id: '00000000-0000-0000-0000-000000000000',
              coordinates: { latitude: 50.0, longitude: 4.0 },
              formattedAddress: 'Adresse b',
            },
          },
        ],
      });

      const result = await useCase.execute({ sessionId: SESSION_ID, member: newMember, now: NOW });

      expect(service.updateMidpoint).toHaveBeenCalledWith(
        SESSION_ID,
        expected.midpoint,
        expected.radius,
      );
      expect(result.meta.midpoint).toEqual(expected.midpoint);
    });

    it('returns the refreshed meta and members with the recomputed midpoint', async () => {
      // The 2nd fetch differs from the 1st on purpose (other ownerType,
      // createdAt and expiresAt, one more member): the result must be built
      // from the re-read, not from the validation snapshot.
      const newMember = makeMember('b', 50.0, 4.0);
      const refreshed = makeShared({
        meta: {
          createdAt: NOW - 5000,
          expiresAt: NOW + 2 * SHARE_TTL_GUEST_MS,
          ownerType: 'account',
          status: 'open',
        },
        members: [makeMember('a', 48.0, 2.0), newMember, makeMember('c', 46.0, 6.0)],
      });
      service.fetchSharedSession
        .mockResolvedValueOnce(makeShared())
        .mockResolvedValueOnce(refreshed);

      const result = await useCase.execute({ sessionId: SESSION_ID, member: newMember, now: NOW });

      const [, midpoint, radius] = service.updateMidpoint.mock.calls[0] ?? [];
      expect(result).toEqual({
        ...refreshed,
        meta: { ...refreshed.meta, midpoint, midpointRadius: radius },
      });
    });
  });

  // ─── Session deleted while joining ────────────────────────
  describe('session deleted while joining (re-read returns null)', () => {
    it('removes the new member, throws not_found and does not update the midpoint', async () => {
      const newMember = makeMember('b', 50.0, 4.0);
      service.fetchSharedSession.mockResolvedValueOnce(makeShared()).mockResolvedValueOnce(null);

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: newMember, now: NOW }),
      ).rejects.toMatchObject({ code: 'not_found' });

      expect(service.joinSharedSession).toHaveBeenCalledWith(SESSION_ID, newMember);
      expect(service.removeMember).toHaveBeenCalledTimes(1);
      expect(service.removeMember).toHaveBeenCalledWith(SESSION_ID, 'b');
      expect(service.updateMidpoint).not.toHaveBeenCalled();
    });

    it('throws a SessionShareError instance', async () => {
      service.fetchSharedSession.mockResolvedValueOnce(makeShared()).mockResolvedValueOnce(null);

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('b'), now: NOW }),
      ).rejects.toBeInstanceOf(SessionShareError);
    });

    it('does not remove an already-present member, but still throws not_found', async () => {
      // The member was not written by this call: there is nothing of ours to remove.
      service.fetchSharedSession
        .mockResolvedValueOnce(
          makeShared({ members: [makeMember('a', 48.0, 2.0), makeMember('b', 50.0, 4.0)] }),
        )
        .mockResolvedValueOnce(null);

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('b', 50.0, 4.0), now: NOW }),
      ).rejects.toMatchObject({ code: 'not_found' });

      expect(service.joinSharedSession).not.toHaveBeenCalled();
      expect(service.removeMember).not.toHaveBeenCalled();
      expect(service.updateMidpoint).not.toHaveBeenCalled();
    });

    it('calls removeMember after the member write and the re-read', async () => {
      service.fetchSharedSession.mockResolvedValueOnce(makeShared()).mockResolvedValueOnce(null);

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('b'), now: NOW }),
      ).rejects.toMatchObject({ code: 'not_found' });

      const [joinOrder] = service.joinSharedSession.mock.invocationCallOrder;
      const [, reReadOrder] = service.fetchSharedSession.mock.invocationCallOrder;
      const [removeOrder] = service.removeMember.mock.invocationCallOrder;
      expect(joinOrder).toBeLessThan(reReadOrder ?? 0);
      expect(reReadOrder).toBeLessThan(removeOrder ?? 0);
    });

    it('awaits removeMember before rejecting with not_found', async () => {
      // The removal is held pending: the use case must not settle until it resolves.
      let releaseRemoval: () => void = () => undefined;
      service.removeMember.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseRemoval = resolve;
          }),
      );
      service.fetchSharedSession.mockResolvedValueOnce(makeShared()).mockResolvedValueOnce(null);
      let settled = false;

      const pending = useCase
        .execute({ sessionId: SESSION_ID, member: makeMember('b'), now: NOW })
        .finally(() => {
          settled = true;
        });
      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(service.removeMember).toHaveBeenCalledTimes(1);
      expect(settled).toBe(false);

      releaseRemoval();
      await expect(pending).rejects.toMatchObject({ code: 'not_found' });
      expect(settled).toBe(true);
    });
  });

  // ─── Errors ───────────────────────────────────────────────
  describe('errors', () => {
    it('throws not_found when the session does not exist', async () => {
      service.fetchSharedSession.mockResolvedValue(null);

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('b'), now: NOW }),
      ).rejects.toMatchObject({ code: 'not_found' });
      expect(service.joinSharedSession).not.toHaveBeenCalled();
    });

    it('throws expired when now is past expiresAt', async () => {
      service.fetchSharedSession.mockResolvedValue(
        makeShared({
          meta: {
            createdAt: NOW - 1000,
            expiresAt: NOW - 1,
            ownerType: 'guest',
            status: 'open',
          },
        }),
      );

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('b'), now: NOW }),
      ).rejects.toMatchObject({ code: 'expired' });
      expect(service.joinSharedSession).not.toHaveBeenCalled();
    });

    it('throws expired when now equals expiresAt (boundary)', async () => {
      service.fetchSharedSession.mockResolvedValue(
        makeShared({
          meta: {
            createdAt: NOW - 1000,
            expiresAt: NOW,
            ownerType: 'guest',
            status: 'open',
          },
        }),
      );

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('b'), now: NOW }),
      ).rejects.toMatchObject({ code: 'expired' });
    });

    it('throws closed when the session status is closed', async () => {
      service.fetchSharedSession.mockResolvedValue(
        makeShared({
          meta: {
            createdAt: NOW - 1000,
            expiresAt: NOW + SHARE_TTL_GUEST_MS,
            ownerType: 'guest',
            status: 'closed',
          },
        }),
      );

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('b'), now: NOW }),
      ).rejects.toMatchObject({ code: 'closed' });
      expect(service.joinSharedSession).not.toHaveBeenCalled();
    });

    it('throws full when the session has 5 distinct members', async () => {
      service.fetchSharedSession.mockResolvedValue(
        makeShared({
          members: [
            makeMember('a'),
            makeMember('b'),
            makeMember('c'),
            makeMember('d'),
            makeMember('e'),
          ],
        }),
      );

      // [MINEUR 6] Typed `full` code now (was `unknown`) → dedicated i18n message.
      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('f'), now: NOW }),
      ).rejects.toMatchObject({ code: 'full' });
      expect(service.joinSharedSession).not.toHaveBeenCalled();
    });

    it('propagates a typed error from fetchSharedSession', async () => {
      service.fetchSharedSession.mockRejectedValue(new SessionShareError('net', 'network'));

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('b'), now: NOW }),
      ).rejects.toMatchObject({ code: 'network' });
    });

    it('propagates a typed error from the re-read without removing the member', async () => {
      // A failing re-read (network) is not a deleted session: the session
      // exists, there is no orphan, so the port error propagates unchanged.
      const readError = new SessionShareError('net', 'network');
      service.fetchSharedSession
        .mockResolvedValueOnce(makeShared())
        .mockRejectedValueOnce(readError);

      await expect(
        useCase.execute({ sessionId: SESSION_ID, member: makeMember('b'), now: NOW }),
      ).rejects.toBe(readError);

      expect(service.joinSharedSession).toHaveBeenCalledTimes(1);
      expect(service.removeMember).not.toHaveBeenCalled();
      expect(service.updateMidpoint).not.toHaveBeenCalled();
    });
  });

  // ─── Idempotence ──────────────────────────────────────────
  describe('idempotence', () => {
    it('does not re-add a member already present, but still recomputes the midpoint', async () => {
      service.fetchSharedSession.mockResolvedValue(
        makeShared({ members: [makeMember('a', 48.0, 2.0), makeMember('b', 50.0, 4.0)] }),
      );

      const result = await useCase.execute({
        sessionId: SESSION_ID,
        member: makeMember('b', 50.0, 4.0),
        now: NOW,
      });

      expect(service.joinSharedSession).not.toHaveBeenCalled();
      expect(service.updateMidpoint).toHaveBeenCalledTimes(1);
      expect(result.members).toHaveLength(2);
    });

    it('allows joining a full session when the member is already present (idempotent)', async () => {
      service.fetchSharedSession.mockResolvedValue(
        makeShared({
          members: [
            makeMember('a'),
            makeMember('b'),
            makeMember('c'),
            makeMember('d'),
            makeMember('e'),
          ],
        }),
      );

      const result = await useCase.execute({
        sessionId: SESSION_ID,
        member: makeMember('e'),
        now: NOW,
      });

      expect(service.joinSharedSession).not.toHaveBeenCalled();
      expect(result.members).toHaveLength(5);
    });
  });

  // ─── Date.now fallback ────────────────────────────────────
  it('falls back to Date.now() when now is not provided', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    const newMember = makeMember('b', 50.0, 4.0);
    service.fetchSharedSession
      .mockResolvedValueOnce(makeShared())
      .mockResolvedValueOnce(makeShared({ members: [makeMember('a', 48.0, 2.0), newMember] }));

    const result = await useCase.execute({ sessionId: SESSION_ID, member: newMember });

    expect(result.members).toHaveLength(2);
  });
});

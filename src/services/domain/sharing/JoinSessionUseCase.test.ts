/**
 * @file JoinSessionUseCase.test.ts
 * @description Tests unitaires du use case JoinSessionUseCase (F5).
 *              Unit tests for the JoinSessionUseCase (F5).
 *
 *              Couvre : succès (ajout membre + recalcul midpoint), expiré, not_found,
 *              closed, plein (code `full`), idempotence (membre déjà présent), pas de
 *              point de départ (propagé via le membre fourni), propagation d'erreur.
 *
 *              ⚠️ Le use case appelle `fetchSharedSession` DEUX fois : avant l'ajout
 *              (validation) puis après (relecture du roster réel, anti « lost update »).
 *              Les mocks renvoient donc un roster À JOUR au 2ᵉ appel via
 *              `mockResolvedValueOnce` (1er = état initial, 2ᵉ = roster post-écriture).
 *
 * @module services/domain/sharing/JoinSessionUseCase.test
 */

// [ADDED] F5 — Tests unitaires JoinSessionUseCase
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
    service = mock<ISessionShareService>();
    service.joinSharedSession.mockResolvedValue(undefined);
    service.updateMidpoint.mockResolvedValue(undefined);
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
      // 1er fetch (validation) : roster initial ; 2ᵉ fetch (relecture) : roster à jour.
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
      // Un join concurrent a ajouté 'c' entre notre validation et notre relecture :
      // le midpoint doit refléter TOUS les membres présents au 2ᵉ fetch (a + b + c),
      // pas l'instantané périmé (a) lu au 1er fetch.
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

    it('falls back to the local recomposition when the refresh returns no roster', async () => {
      // Filet : si la relecture renvoie null, le use case retombe sur
      // existing.members + member sans planter la jointure.
      const newMember = makeMember('b', 50.0, 4.0);
      service.fetchSharedSession.mockResolvedValueOnce(makeShared()).mockResolvedValueOnce(null);

      const result = await useCase.execute({ sessionId: SESSION_ID, member: newMember, now: NOW });

      expect(result.members.map((m) => m.memberId)).toEqual(['a', 'b']);
      expect(service.updateMidpoint).toHaveBeenCalledTimes(1);
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

      // [MINEUR 6] Code typé `full` désormais (était `unknown`) → message i18n dédié.
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

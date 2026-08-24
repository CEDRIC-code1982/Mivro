/**
 * @file ShareSessionUseCase.test.ts
 * @description Tests unitaires du use case ShareSessionUseCase (F5).
 *              Unit tests for the ShareSessionUseCase (F5).
 *
 *              Couvre : mapping session locale → SharedSession, expiresAt selon
 *              ownerType, rejet < 2 participants, lien renvoyé (et filet de
 *              sécurité si l'adapter renvoie un lien vide).
 *
 * @module services/domain/sharing/ShareSessionUseCase.test
 */

// [ADDED] F5 — Tests unitaires ShareSessionUseCase
import { mock } from 'jest-mock-extended';
import type { MidpointSession, Participant } from '@entities/MidpointSession';
import { SHARE_TTL_ACCOUNT_MS, SHARE_TTL_GUEST_MS } from '@entities/SharedSession';
import {
  SessionShareError,
  type CreateSharedSessionResult,
  type ISessionShareService,
} from '@services/domain/sharing/ISessionShareService';
import { ShareSessionUseCase } from '@services/domain/sharing/ShareSessionUseCase';

const NOW = 1_700_000_000_000;

const makeParticipant = (id: string, overrides: Partial<Participant> = {}): Participant => ({
  id,
  displayName: `User ${id}`,
  startLocation: {
    id: `loc-${id}`,
    coordinates: { latitude: 48.8566, longitude: 2.3522 },
    formattedAddress: `Adresse ${id}`,
  },
  ...overrides,
});

const makeSession = (overrides: Partial<MidpointSession> = {}): MidpointSession => ({
  id: 'session-001',
  status: 'computed',
  participants: [makeParticipant('a'), makeParticipant('b')],
  createdAt: '2026-06-25T10:00:00.000Z',
  updatedAt: '2026-06-25T10:00:00.000Z',
  ...overrides,
});

describe('ShareSessionUseCase', () => {
  let service: ReturnType<typeof mock<ISessionShareService>>;
  let useCase: ShareSessionUseCase;

  const defaultResult: CreateSharedSessionResult = {
    sessionId: 'session-001',
    link: 'mivro://session/session-001',
    expiresAt: NOW + SHARE_TTL_GUEST_MS,
  };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    service = mock<ISessionShareService>();
    service.createSharedSession.mockResolvedValue(defaultResult);
    useCase = new ShareSessionUseCase(service);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps the local session to a SharedSession (meta + members)', async () => {
    await useCase.execute({ session: makeSession(), ownerType: 'guest', now: NOW });

    const [shared, ownerType] = service.createSharedSession.mock.calls[0] ?? [];
    expect(ownerType).toBe('guest');
    expect(shared?.sessionId).toBe('session-001');
    expect(shared?.meta.status).toBe('open');
    expect(shared?.meta.createdAt).toBe(NOW);
    expect(shared?.members).toHaveLength(2);
    expect(shared?.members[0]).toEqual({
      memberId: 'a',
      displayName: 'User a',
      startLocation: {
        latitude: 48.8566,
        longitude: 2.3522,
        formattedAddress: 'Adresse a',
      },
    });
  });

  it('includes avatarId in the member only when present', async () => {
    const session = makeSession({
      participants: [makeParticipant('a', { avatarId: 'fox' }), makeParticipant('b')],
    });
    await useCase.execute({ session, ownerType: 'guest', now: NOW });

    const shared = service.createSharedSession.mock.calls[0]?.[0];
    expect(shared?.members[0]?.avatarId).toBe('fox');
    expect(shared?.members[1]).not.toHaveProperty('avatarId');
  });

  it('forwards midpoint + radius into meta when the session has them', async () => {
    const session = makeSession({
      midpoint: { latitude: 48.85, longitude: 2.34 },
      midpointRadius: 1200,
    });
    await useCase.execute({ session, ownerType: 'guest', now: NOW });

    const shared = service.createSharedSession.mock.calls[0]?.[0];
    expect(shared?.meta.midpoint).toEqual({ latitude: 48.85, longitude: 2.34 });
    expect(shared?.meta.midpointRadius).toBe(1200);
  });

  it('omits midpoint from meta when the session has none', async () => {
    await useCase.execute({ session: makeSession(), ownerType: 'guest', now: NOW });

    const shared = service.createSharedSession.mock.calls[0]?.[0];
    expect(shared?.meta).not.toHaveProperty('midpoint');
    expect(shared?.meta).not.toHaveProperty('midpointRadius');
  });

  it('computes a 24h expiresAt for a guest owner', async () => {
    await useCase.execute({ session: makeSession(), ownerType: 'guest', now: NOW });

    const shared = service.createSharedSession.mock.calls[0]?.[0];
    expect(shared?.meta.expiresAt).toBe(NOW + SHARE_TTL_GUEST_MS);
  });

  it('computes a 7d expiresAt for an account owner', async () => {
    await useCase.execute({ session: makeSession(), ownerType: 'account', now: NOW });

    const shared = service.createSharedSession.mock.calls[0]?.[0];
    expect(shared?.meta.expiresAt).toBe(NOW + SHARE_TTL_ACCOUNT_MS);
  });

  it('rejects when the session has fewer than 2 participants', async () => {
    const session = makeSession({ participants: [makeParticipant('a')] });

    await expect(useCase.execute({ session, ownerType: 'guest', now: NOW })).rejects.toMatchObject({
      code: 'unknown',
    });
    expect(service.createSharedSession).not.toHaveBeenCalled();
  });

  it('returns the sessionId, link and expiresAt from the service', async () => {
    const result = await useCase.execute({ session: makeSession(), ownerType: 'guest', now: NOW });

    expect(result).toEqual(defaultResult);
  });

  it('derives the link from the sessionId when the service returns an empty link', async () => {
    service.createSharedSession.mockResolvedValue({ ...defaultResult, link: '' });

    const result = await useCase.execute({ session: makeSession(), ownerType: 'guest', now: NOW });

    expect(result.link).toBe('mivro://session/session-001');
  });

  it('propagates a typed error from the service', async () => {
    service.createSharedSession.mockRejectedValue(new SessionShareError('net', 'network'));

    await expect(
      useCase.execute({ session: makeSession(), ownerType: 'guest', now: NOW }),
    ).rejects.toMatchObject({ code: 'network' });
  });

  it('falls back to Date.now() when now is not provided', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);

    await useCase.execute({ session: makeSession(), ownerType: 'guest' });

    const shared = service.createSharedSession.mock.calls[0]?.[0];
    expect(shared?.meta.createdAt).toBe(NOW);
  });
});

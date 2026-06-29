/**
 * @file useSharedSessionStore.test.ts
 * @description Tests unitaires du store useSharedSessionStore (F5 — NON persisté)
 *              + de l'action useSessionStore.loadSharedSession (reconstruction des
 *              participants + application du midpoint).
 *              Unit tests for the useSharedSessionStore (F5 — NOT persisted) plus
 *              the useSessionStore.loadSharedSession action.
 *
 * @module __tests__/unit/presentation/stores/useSharedSessionStore
 */

// [ADDED] F5 — Tests unitaires useSharedSessionStore + loadSharedSession
import {
  SHARE_TTL_GUEST_MS,
  type SharedSession,
  type SharedSessionMember,
  type SharedSessionMeta,
} from '@core/entities/SharedSession';
import { useSessionStore } from '@presentation/stores/useSessionStore';
import { useSharedSessionStore } from '@presentation/stores/useSharedSessionStore';

const NOW = 1_700_000_000_000;

const makeMember = (id: string, lat = 48.8566, lng = 2.3522): SharedSessionMember => ({
  memberId: id,
  displayName: `User ${id}`,
  startLocation: { latitude: lat, longitude: lng, formattedAddress: `Adresse ${id}` },
});

const makeMeta = (overrides: Partial<SharedSessionMeta> = {}): SharedSessionMeta => ({
  createdAt: NOW,
  expiresAt: NOW + SHARE_TTL_GUEST_MS,
  ownerType: 'guest',
  status: 'open',
  ...overrides,
});

const resetStore = () => {
  useSharedSessionStore.setState({
    isShared: false,
    isOwner: false,
    sessionId: null,
    link: null,
    meta: null,
    members: [],
    status: 'idle',
    errorCode: null,
  });
};

describe('useSharedSessionStore', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    resetStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Initial state ────────────────────────────────────────
  describe('initial state', () => {
    it('starts idle, not shared, not owner and empty', () => {
      const state = useSharedSessionStore.getState();
      expect(state.isShared).toBe(false);
      expect(state.isOwner).toBe(false);
      expect(state.sessionId).toBeNull();
      expect(state.link).toBeNull();
      expect(state.meta).toBeNull();
      expect(state.members).toEqual([]);
      expect(state.status).toBe('idle');
      expect(state.errorCode).toBeNull();
    });
  });

  // ─── setShared ────────────────────────────────────────────
  describe('setShared', () => {
    it('marks the session as shared with its id and link (joiner by default — not owner)', () => {
      useSharedSessionStore.getState().setShared('session-001', 'mivro://session/session-001');

      const state = useSharedSessionStore.getState();
      expect(state.isShared).toBe(true);
      expect(state.sessionId).toBe('session-001');
      expect(state.link).toBe('mivro://session/session-001');
      // 3ᵉ param optionnel `isOwner` non fourni → défaut false (membre/join).
      expect(state.isOwner).toBe(false);
    });

    it('flags isOwner=true when created (3rd arg true)', () => {
      useSharedSessionStore
        .getState()
        .setShared('session-001', 'mivro://session/session-001', true);

      expect(useSharedSessionStore.getState().isOwner).toBe(true);
    });

    it('flags isOwner=false when joined (3rd arg false)', () => {
      // On part d'un état owner pour vérifier que join le repasse à false.
      useSharedSessionStore.setState({ isOwner: true });

      useSharedSessionStore
        .getState()
        .setShared('session-002', 'mivro://session/session-002', false);

      expect(useSharedSessionStore.getState().isOwner).toBe(false);
    });
  });

  // ─── setStatus ────────────────────────────────────────────
  describe('setStatus', () => {
    it('updates status and clears errorCode for a non-error status', () => {
      useSharedSessionStore.setState({ errorCode: 'network' });

      useSharedSessionStore.getState().setStatus('synced');

      const state = useSharedSessionStore.getState();
      expect(state.status).toBe('synced');
      expect(state.errorCode).toBeNull();
    });

    it('stores errorCode when status=error', () => {
      useSharedSessionStore.getState().setStatus('error', 'expired');

      const state = useSharedSessionStore.getState();
      expect(state.status).toBe('error');
      expect(state.errorCode).toBe('expired');
    });

    it('clears errorCode when status=error is set without a code', () => {
      useSharedSessionStore.getState().setStatus('error');

      expect(useSharedSessionStore.getState().errorCode).toBeNull();
    });
  });

  // ─── syncFromRemote ───────────────────────────────────────
  describe('syncFromRemote', () => {
    it('replaces meta + members and switches status to synced', () => {
      const meta = makeMeta();
      const members = [makeMember('a'), makeMember('b')];

      useSharedSessionStore.getState().syncFromRemote(meta, members);

      const state = useSharedSessionStore.getState();
      expect(state.meta).toEqual(meta);
      expect(state.members).toEqual(members);
      expect(state.status).toBe('synced');
      expect(state.errorCode).toBeNull();
    });

    it('replaces the members array wholesale (stable reference replaced)', () => {
      useSharedSessionStore.getState().syncFromRemote(makeMeta(), [makeMember('a')]);
      useSharedSessionStore.getState().syncFromRemote(makeMeta(), [makeMember('b')]);

      expect(useSharedSessionStore.getState().members.map((m) => m.memberId)).toEqual(['b']);
    });
  });

  // ─── clearShared (purge) ──────────────────────────────────
  describe('clearShared', () => {
    it('purges all state back to initial (RGPD)', () => {
      useSharedSessionStore.setState({
        isShared: true,
        isOwner: true,
        sessionId: 'session-001',
        link: 'mivro://session/session-001',
        meta: makeMeta(),
        members: [makeMember('a')],
        status: 'synced',
        errorCode: 'network',
      });

      useSharedSessionStore.getState().clearShared();

      const state = useSharedSessionStore.getState();
      expect(state.isShared).toBe(false);
      expect(state.isOwner).toBe(false);
      expect(state.sessionId).toBeNull();
      expect(state.link).toBeNull();
      expect(state.meta).toBeNull();
      expect(state.members).toEqual([]);
      expect(state.status).toBe('idle');
      expect(state.errorCode).toBeNull();
    });
  });

  // ─── Non-persistance (RGPD) ───────────────────────────────
  describe('non-persistence (GDPR)', () => {
    it('is NOT wrapped with a persist middleware', () => {
      expect((useSharedSessionStore as unknown as { persist?: unknown }).persist).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// useSessionStore.loadSharedSession (F5) — reconstruction locale
// ═══════════════════════════════════════════════════════════════
describe('useSessionStore.loadSharedSession', () => {
  const makeShared = (overrides: Partial<SharedSession> = {}): SharedSession => ({
    sessionId: 'session-001',
    meta: makeMeta(),
    members: [makeMember('a', 48.0, 2.0), makeMember('b', 50.0, 4.0)],
    ...overrides,
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    useSessionStore.setState({ session: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rebuilds the local session id and participants from the members roster', () => {
    useSessionStore.getState().loadSharedSession(makeShared());

    const session = useSessionStore.getState().session;
    expect(session?.id).toBe('session-001');
    expect(session?.participants).toHaveLength(2);
    expect(session?.participants.map((p) => p.id)).toEqual(['a', 'b']);
    expect(session?.participants[0]?.startLocation.coordinates).toEqual({
      latitude: 48.0,
      longitude: 2.0,
    });
    expect(session?.participants[0]?.startLocation.formattedAddress).toBe('Adresse a');
  });

  it('assigns a fresh local start-location id (not the synthetic shared id)', () => {
    useSessionStore.getState().loadSharedSession(makeShared());

    const id = useSessionStore.getState().session?.participants[0]?.startLocation.id;
    expect(typeof id).toBe('string');
    expect(id).not.toBe('');
  });

  it('preserves a member avatarId only when present', () => {
    useSessionStore.getState().loadSharedSession(
      makeShared({
        members: [{ ...makeMember('a'), avatarId: 'fox' }, makeMember('b')],
      }),
    );

    const participants = useSessionStore.getState().session?.participants ?? [];
    expect(participants[0]?.avatarId).toBe('fox');
    expect(participants[1]).not.toHaveProperty('avatarId');
  });

  it('applies the midpoint + radius and marks the session computed', () => {
    useSessionStore.getState().loadSharedSession(
      makeShared({
        meta: makeMeta({ midpoint: { latitude: 49.0, longitude: 3.0 }, midpointRadius: 1500 }),
      }),
    );

    const session = useSessionStore.getState().session;
    expect(session?.status).toBe('computed');
    expect(session?.midpoint).toEqual({ latitude: 49.0, longitude: 3.0 });
    expect(session?.midpointRadius).toBe(1500);
  });

  it('marks the session as draft (no midpoint) when meta has no midpoint', () => {
    useSessionStore.getState().loadSharedSession(makeShared());

    const session = useSessionStore.getState().session;
    expect(session?.status).toBe('draft');
    expect(session?.midpoint).toBeUndefined();
    expect(session?.midpointRadius).toBeUndefined();
  });
});

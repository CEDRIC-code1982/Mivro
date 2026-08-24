/**
 * @file useSharedSessionSync.test.tsx
 * @description Tests unitaires du hook d'orchestration useSharedSessionSync (F5).
 *              Unit tests for the useSharedSessionSync orchestration hook (F5).
 *
 *              Couvre : souscription quand `isShared && sessionId` (appel à
 *              `subscribeToSharedSession`), propagation du callback distant
 *              (→ `syncFromRemote` + `useSessionStore.loadSharedSession`), purge
 *              RGPD (`clearShared`) quand le nœud disparaît (callback `null`),
 *              désabonnement au démontage ET au changement de sessionId, inerte
 *              en mode non partagé.
 *
 * @module features/Sharing/hooks/useSharedSessionSync.test
 */

// [ADDED] F5 — Tests unitaires useSharedSessionSync
import { act, renderHook } from '@testing-library/react-native';
import {
  SHARE_TTL_GUEST_MS,
  type SharedSession,
  type SharedSessionMember,
  type SharedSessionMeta,
} from '@entities/SharedSession';
import { useSharedSessionSync } from '@features/Sharing/hooks/useSharedSessionSync';
import type { SharedSessionUpdateHandler } from '@services/domain/sharing/ISessionShareService';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore';

// ─── Mock DI container ──────────────────────────────────────
const mockSubscribe = jest.fn();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    sessionShareService: {
      subscribeToSharedSession: mockSubscribe,
    },
  })),
}));

const NOW = 1_700_000_000_000;
const SESSION_ID = 'session-001';

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

const makeShared = (overrides: Partial<SharedSession> = {}): SharedSession => ({
  sessionId: SESSION_ID,
  meta: makeMeta(),
  members: [makeMember('a', 48.0, 2.0), makeMember('b', 50.0, 4.0)],
  ...overrides,
});

const resetSharedStore = () => {
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

describe('useSharedSessionSync', () => {
  let unsubscribe: jest.Mock;
  let capturedHandler: SharedSessionUpdateHandler | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    resetSharedStore();
    useSessionStore.setState({ session: null });

    unsubscribe = jest.fn();
    capturedHandler = undefined;
    mockSubscribe.mockImplementation((_sessionId: string, handler: SharedSessionUpdateHandler) => {
      capturedHandler = handler;
      return unsubscribe;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Non partagé (inerte) ─────────────────────────────────
  describe('inert when not shared', () => {
    it('does NOT subscribe when isShared is false', () => {
      renderHook(() => useSharedSessionSync());

      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it('does NOT subscribe when shared but sessionId is null', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: null });

      renderHook(() => useSharedSessionSync());

      expect(mockSubscribe).not.toHaveBeenCalled();
    });
  });

  // ─── Souscription ─────────────────────────────────────────
  describe('subscription', () => {
    it('subscribes to the shared session when isShared && sessionId', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: SESSION_ID });

      renderHook(() => useSharedSessionSync());

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith(SESSION_ID, expect.any(Function));
    });
  });

  // ─── Propagation des mises à jour distantes ───────────────
  describe('remote update propagation', () => {
    it('propagates a remote update to syncFromRemote + loadSharedSession', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: SESSION_ID });
      const syncSpy = jest.spyOn(useSharedSessionStore.getState(), 'syncFromRemote');
      const loadSpy = jest.spyOn(useSessionStore.getState(), 'loadSharedSession');

      renderHook(() => useSharedSessionSync());

      const shared = makeShared();
      act(() => {
        capturedHandler?.(shared);
      });

      expect(syncSpy).toHaveBeenCalledWith(shared.meta, shared.members);
      expect(loadSpy).toHaveBeenCalledWith(shared);
    });

    it('reflects the remote roster into the shared store', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: SESSION_ID });

      renderHook(() => useSharedSessionSync());

      act(() => {
        capturedHandler?.(makeShared());
      });

      const state = useSharedSessionStore.getState();
      expect(state.members.map((m) => m.memberId)).toEqual(['a', 'b']);
      expect(state.status).toBe('synced');
    });

    it('rebuilds the local session from the remote shared session', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: SESSION_ID });

      renderHook(() => useSharedSessionSync());

      act(() => {
        capturedHandler?.(
          makeShared({
            meta: makeMeta({ midpoint: { latitude: 49.0, longitude: 3.0 }, midpointRadius: 1500 }),
          }),
        );
      });

      const session = useSessionStore.getState().session;
      expect(session?.id).toBe(SESSION_ID);
      expect(session?.participants).toHaveLength(2);
      expect(session?.midpoint).toEqual({ latitude: 49.0, longitude: 3.0 });
    });
  });

  // ─── Purge RGPD quand le nœud disparaît ───────────────────
  describe('remote removal (GDPR purge)', () => {
    it('clears the shared state when the node disappears (callback null)', () => {
      useSharedSessionStore.setState({
        isShared: true,
        sessionId: SESSION_ID,
        members: [makeMember('a')],
        status: 'synced',
      });
      const clearSpy = jest.spyOn(useSharedSessionStore.getState(), 'clearShared');

      renderHook(() => useSharedSessionSync());

      act(() => {
        capturedHandler?.(null);
      });

      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(useSharedSessionStore.getState().isShared).toBe(false);
    });

    it('does NOT touch the local session reconstruction when the node disappears', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: SESSION_ID });
      const loadSpy = jest.spyOn(useSessionStore.getState(), 'loadSharedSession');

      renderHook(() => useSharedSessionSync());

      act(() => {
        capturedHandler?.(null);
      });

      expect(loadSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Désabonnement (cleanup) ──────────────────────────────
  describe('unsubscription (cleanup)', () => {
    it('unsubscribes on unmount', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: SESSION_ID });

      const { unmount } = renderHook(() => useSharedSessionSync());
      expect(unsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('re-subscribes (after unsubscribing the old one) when sessionId changes', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: SESSION_ID });

      const { rerender } = renderHook(() => useSharedSessionSync());
      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      act(() => {
        useSharedSessionStore.setState({ sessionId: 'session-002' });
      });
      rerender(undefined);

      // L'ancien abonnement est coupé puis un nouveau est ouvert sur le nouvel id.
      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledTimes(2);
      expect(mockSubscribe).toHaveBeenLastCalledWith('session-002', expect.any(Function));
    });

    it('unsubscribes (without re-subscribing) when leaving shared mode', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: SESSION_ID });

      const { rerender } = renderHook(() => useSharedSessionSync());
      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      act(() => {
        useSharedSessionStore.setState({ isShared: false });
      });
      rerender(undefined);

      expect(unsubscribe).toHaveBeenCalledTimes(1);
      // Pas de nouvel abonnement : on est sorti du mode partagé.
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
  });
});

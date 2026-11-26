/**
 * @file useSharedSessionSync.test.tsx
 * @description Unit tests for the useSharedSessionSync orchestration hook (F5).
 *
 *              Covers: subscription when `isShared && sessionId` (call to
 *              `subscribeToSharedSession`), propagation of the remote callback
 *              (→ `syncFromRemote` + `useSessionStore.loadSharedSession`), GDPR
 *              purge (`clearShared`) when the node disappears (`null` callback),
 *              unsubscription on unmount AND on sessionId change, inert in
 *              non-shared mode.
 *              [MODIFIED] The role (`isOwner`) is the one captured when the hook subscribes:
 *              an owner whose `clearShared()` ran before the null event (as in
 *              `useCreateSessionFlow.reset`) still takes the owner path. One case renders the real
 *              `useCreateSessionFlow` next to the hook, with the null event delivered
 *              asynchronously after `deleteSharedSession`.
 *
 * @module features/Sharing/hooks/useSharedSessionSync.test
 */

// [ADDED] F5 — useSharedSessionSync unit tests
import { act, renderHook } from '@testing-library/react-native';
import {
  SHARE_TTL_GUEST_MS,
  type SharedSession,
  type SharedSessionMember,
  type SharedSessionMeta,
} from '@entities/SharedSession';
import { useCreateSessionFlow } from '@features/Session/hooks/useCreateSessionFlow';
import { useSharedSessionSync } from '@features/Sharing/hooks/useSharedSessionSync';
import type { SharedSessionUpdateHandler } from '@services/domain/sharing/ISessionShareService';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore';

// ─── Mock DI container ──────────────────────────────────────
const mockSubscribe = jest.fn();
const mockDeleteSharedSession = jest.fn<Promise<void>, [string]>();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    sessionShareService: {
      subscribeToSharedSession: mockSubscribe,
      deleteSharedSession: mockDeleteSharedSession,
    },
  })),
}));

// ─── Mocks needed by the real useCreateSessionFlow (integration case) ─
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-0001',
}));

jest.mock('@features/Profile/hooks/useAuth', () => ({
  useAuthUser: () => null,
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

  // ─── Not shared (inert) ───────────────────────────────────
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

  // ─── Subscription ─────────────────────────────────────────
  describe('subscription', () => {
    it('subscribes to the shared session when isShared && sessionId', () => {
      useSharedSessionStore.setState({ isShared: true, sessionId: SESSION_ID });

      renderHook(() => useSharedSessionSync());

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith(SESSION_ID, expect.any(Function));
    });
  });

  // ─── Remote update propagation ───────────────────────────
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

  // ─── GDPR purge when the node disappears ──────────────────
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

  describe('session ended remotely', () => {
    it('member: clears the shared state, resets the local session, then calls back, in order', () => {
      useSharedSessionStore.setState({ isShared: true, isOwner: false, sessionId: SESSION_ID });
      const clearSpy = jest.spyOn(useSharedSessionStore.getState(), 'clearShared');
      const resetSpy = jest.spyOn(useSessionStore.getState(), 'resetSession');
      const onEndedRemotely = jest.fn();

      renderHook(() => useSharedSessionSync({ onEndedRemotely }));
      act(() => {
        capturedHandler?.(null);
      });

      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(onEndedRemotely).toHaveBeenCalledTimes(1);
      const clearOrder = clearSpy.mock.invocationCallOrder[0] ?? Infinity;
      const resetOrder = resetSpy.mock.invocationCallOrder[0] ?? Infinity;
      const callbackOrder = onEndedRemotely.mock.invocationCallOrder[0] ?? -Infinity;
      expect(clearOrder).toBeLessThan(resetOrder);
      expect(resetOrder).toBeLessThan(callbackOrder);
    });

    it('member: purges the local copy of the session', () => {
      useSharedSessionStore.setState({ isShared: true, isOwner: false, sessionId: SESSION_ID });
      renderHook(() => useSharedSessionSync());
      act(() => {
        capturedHandler?.(makeShared());
      });
      expect(useSessionStore.getState().session).not.toBeNull();

      act(() => {
        capturedHandler?.(null);
      });

      expect(useSessionStore.getState().session).toBeNull();
      expect(useSharedSessionStore.getState().isShared).toBe(false);
    });

    it('member: works without a callback', () => {
      useSharedSessionStore.setState({ isShared: true, isOwner: false, sessionId: SESSION_ID });
      const resetSpy = jest.spyOn(useSessionStore.getState(), 'resetSession');

      renderHook(() => useSharedSessionSync());

      expect(() =>
        act(() => {
          capturedHandler?.(null);
        }),
      ).not.toThrow();
      expect(resetSpy).toHaveBeenCalledTimes(1);
    });

    it('owner: only clears the shared state, without reset nor callback', () => {
      useSharedSessionStore.setState({ isShared: true, isOwner: true, sessionId: SESSION_ID });
      const clearSpy = jest.spyOn(useSharedSessionStore.getState(), 'clearShared');
      const resetSpy = jest.spyOn(useSessionStore.getState(), 'resetSession');
      const onEndedRemotely = jest.fn();

      renderHook(() => useSharedSessionSync({ onEndedRemotely }));
      act(() => {
        capturedHandler?.(null);
      });

      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(resetSpy).not.toHaveBeenCalled();
      expect(onEndedRemotely).not.toHaveBeenCalled();
    });

    it('reads the role when it subscribes, not when the removal arrives', () => {
      useSharedSessionStore.setState({ isShared: true, isOwner: false, sessionId: SESSION_ID });
      const resetSpy = jest.spyOn(useSessionStore.getState(), 'resetSession');
      const onEndedRemotely = jest.fn();
      renderHook(() => useSharedSessionSync({ onEndedRemotely }));

      // Role flipped without a sessionId change: no re-subscription, the captured role stays.
      act(() => {
        useSharedSessionStore.setState({ isOwner: true });
      });
      act(() => {
        capturedHandler?.(null);
      });

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(onEndedRemotely).toHaveBeenCalledTimes(1);
    });

    it('owner: a removal arriving after clearShared() still takes the owner path', () => {
      useSharedSessionStore.setState({ isShared: true, isOwner: true, sessionId: SESSION_ID });
      const resetSpy = jest.spyOn(useSessionStore.getState(), 'resetSession');
      const onEndedRemotely = jest.fn();
      renderHook(() => useSharedSessionSync({ onEndedRemotely }));

      // Same order as `useCreateSessionFlow.reset`: the shared state (isOwner included) is purged
      // before the backend delivers the null event.
      act(() => {
        useSharedSessionStore.getState().clearShared();
      });
      expect(useSharedSessionStore.getState().isOwner).toBe(false);
      act(() => {
        capturedHandler?.(null);
      });

      expect(resetSpy).not.toHaveBeenCalled();
      expect(onEndedRemotely).not.toHaveBeenCalled();
    });

    it('uses the role of the latest subscription after a re-subscription', () => {
      useSharedSessionStore.setState({ isShared: true, isOwner: false, sessionId: SESSION_ID });
      const resetSpy = jest.spyOn(useSessionStore.getState(), 'resetSession');
      const onEndedRemotely = jest.fn();
      renderHook(() => useSharedSessionSync({ onEndedRemotely }));

      // `setShared`-like change: new sessionId and new role together, hence a new subscription.
      act(() => {
        useSharedSessionStore.setState({ isOwner: true, sessionId: 'session-002' });
      });
      expect(mockSubscribe).toHaveBeenCalledTimes(2);
      act(() => {
        capturedHandler?.(null);
      });

      expect(resetSpy).not.toHaveBeenCalled();
      expect(onEndedRemotely).not.toHaveBeenCalled();
    });

    it('owner: reset() of the creation flow followed by an async removal neither resets nor calls back', async () => {
      useSessionStore.getState().createSession();
      useSharedSessionStore.setState({ isShared: true, isOwner: true, sessionId: SESSION_ID });
      // The backend delivers the null event asynchronously, once the deletion has been sent —
      // i.e. after `reset` has already run `clearShared()` (isOwner back to false).
      mockDeleteSharedSession.mockImplementation(async () => {
        await Promise.resolve();
        capturedHandler?.(null);
      });
      const resetSpy = jest.spyOn(useSessionStore.getState(), 'resetSession');
      const onEndedRemotely = jest.fn();
      const { result } = renderHook(() => {
        useSharedSessionSync({ onEndedRemotely });
        return useCreateSessionFlow();
      });

      await act(async () => {
        result.current.reset();
        await Promise.resolve();
      });

      expect(mockDeleteSharedSession).toHaveBeenCalledWith(SESSION_ID);
      expect(useSharedSessionStore.getState().isShared).toBe(false);
      // Only the flow's own reset: the sync hook did not take the member path.
      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(onEndedRemotely).not.toHaveBeenCalled();
    });

    it('does not re-subscribe when the callback changes between renders, and calls the latest', () => {
      useSharedSessionStore.setState({ isShared: true, isOwner: false, sessionId: SESSION_ID });
      const first = jest.fn();
      const second = jest.fn();

      const { rerender } = renderHook(
        ({ onEndedRemotely }: { onEndedRemotely: () => void }) =>
          useSharedSessionSync({ onEndedRemotely }),
        { initialProps: { onEndedRemotely: first } },
      );
      rerender({ onEndedRemotely: second });

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(unsubscribe).not.toHaveBeenCalled();

      act(() => {
        capturedHandler?.(null);
      });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Unsubscription (cleanup) ─────────────────────────────
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

      // The old subscription is closed, then a new one is opened on the new id.
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
      // No new subscription: shared mode has been left.
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
  });
});

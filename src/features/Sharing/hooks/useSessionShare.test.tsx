/**
 * @file useSessionShare.test.tsx
 * @description Unit tests for the useSessionShare orchestration hook (F5).
 *
 *              Covers: share() → ShareSessionUseCase + native Share.share,
 *              join() → JoinSessionUseCase + loadSharedSession + shared state,
 *              guards (< 2 participants, no user), exposed errorCode, isBusy.
 *
 * @module features/Sharing/hooks/useSessionShare.test
 */

// [ADDED] F5 — useSessionShare unit tests
import { act, renderHook } from '@testing-library/react-native';
import { Share } from 'react-native';
import type { Location } from '@entities/Location';
import type { MidpointSession, Participant } from '@entities/MidpointSession';
import {
  SHARE_TTL_GUEST_MS,
  type SharedSession,
  type SharedSessionMember,
} from '@entities/SharedSession';
import type { User } from '@entities/User';
import { useSessionShare } from '@features/Sharing/hooks/useSessionShare';
import type { CreateSharedSessionResult } from '@services/domain/sharing/ISessionShareService';
import { SessionShareError } from '@services/domain/sharing/ISessionShareService';
import { useAuthStore } from '@state/useAuthStore';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore';

// ─── Mock DI container ──────────────────────────────────────
// useAuthStore is persisted (zustand persist) → expose an in-memory zustandStorage
// so that setState does not break when the middleware mounts.
const mockShareExecute = jest.fn();
const mockJoinExecute = jest.fn();
// [ADDED] Guest profile created by join() when the device has no user (ADR-004)
const mockCreateGuestExecute = jest.fn();
const mockStorage = new Map<string, string>();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    shareSessionUseCase: { execute: mockShareExecute },
    joinSessionUseCase: { execute: mockJoinExecute },
    createGuestUserUseCase: { execute: mockCreateGuestExecute },
    crashReporter: { setUser: jest.fn() },
    zustandStorage: {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mockStorage.set(key, value);
      },
      removeItem: (key: string) => {
        mockStorage.delete(key);
      },
    },
  })),
}));

const NOW = 1_700_000_000_000;
const SESSION_ID = 'session-001';
const USER_ID = 'user-001';

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

// [ADDED] Start point chosen on the join screen, distinct from any local participant address
const START_LOCATION: Location = {
  id: '9b2f6a1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  coordinates: { latitude: 45.764, longitude: 4.8357 },
  formattedAddress: 'Place Bellecour, Lyon',
};

const makeLocalSession = (participants: Participant[]): MidpointSession => ({
  id: SESSION_ID,
  status: 'computed',
  participants,
  createdAt: '2026-06-25T10:00:00.000Z',
  updatedAt: '2026-06-25T10:00:00.000Z',
});

const shareResult: CreateSharedSessionResult = {
  sessionId: SESSION_ID,
  link: `mivro://session/${SESSION_ID}`,
  expiresAt: NOW + SHARE_TTL_GUEST_MS,
};

const guestUser: User = {
  type: 'guest',
  id: USER_ID,
  displayName: 'Alice',
  createdAt: '2026-06-25T10:00:00.000Z',
};

const accountUser: User = {
  type: 'authenticated',
  id: USER_ID,
  email: 'a@b.co',
  displayName: 'Alice',
  provider: 'google',
  createdAt: '2026-06-25T10:00:00.000Z',
};

const makeSharedMember = (id: string): SharedSessionMember => ({
  memberId: id,
  displayName: `User ${id}`,
  startLocation: { latitude: 48.8566, longitude: 2.3522, formattedAddress: `Adresse ${id}` },
});

const joinedSession: SharedSession = {
  sessionId: SESSION_ID,
  meta: {
    createdAt: NOW,
    expiresAt: NOW + SHARE_TTL_GUEST_MS,
    ownerType: 'guest',
    status: 'open',
    midpoint: { latitude: 48.85, longitude: 2.34 },
    midpointRadius: 1200,
  },
  members: [makeSharedMember(USER_ID), makeSharedMember('b')],
};

describe('useSessionShare', () => {
  let shareSpy: jest.SpiedFunction<typeof Share.share>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    mockShareExecute.mockResolvedValue(shareResult);
    mockJoinExecute.mockResolvedValue(joinedSession);
    shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

    useSessionStore.setState({ session: null });
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
    useAuthStore.setState({ user: guestUser, isAuthenticated: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── share() ──────────────────────────────────────────────
  describe('share', () => {
    it('publishes the session, marks it shared and opens the native share sheet', async () => {
      useSessionStore.setState({
        session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
      });
      const { result } = renderHook(() => useSessionShare());

      let link: string | null = null;
      await act(async () => {
        link = await result.current.share();
      });

      expect(mockShareExecute).toHaveBeenCalledWith(
        expect.objectContaining({ ownerType: 'guest' }),
      );
      expect(link).toBe(shareResult.link);
      expect(useSharedSessionStore.getState().isShared).toBe(true);
      expect(useSharedSessionStore.getState().sessionId).toBe(SESSION_ID);
      // create() → setShared(..., true): this device is the OWNER.
      expect(useSharedSessionStore.getState().isOwner).toBe(true);
      expect(shareSpy).toHaveBeenCalledWith({ message: shareResult.link, url: shareResult.link });
    });

    it('uses the provided localized message builder for the share sheet', async () => {
      useSessionStore.setState({
        session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
      });
      const { result } = renderHook(() => useSessionShare());

      await act(async () => {
        await result.current.share((link) => `Join: ${link}`);
      });

      expect(shareSpy).toHaveBeenCalledWith({
        message: `Join: ${shareResult.link}`,
        url: shareResult.link,
      });
    });

    it('derives ownerType=account for an authenticated user', async () => {
      useAuthStore.setState({ user: accountUser, isAuthenticated: true });
      useSessionStore.setState({
        session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
      });
      const { result } = renderHook(() => useSessionShare());

      await act(async () => {
        await result.current.share();
      });

      expect(mockShareExecute).toHaveBeenCalledWith(
        expect.objectContaining({ ownerType: 'account' }),
      );
    });

    it('rejects sharing a session with fewer than 2 participants (unknown)', async () => {
      useSessionStore.setState({ session: makeLocalSession([makeParticipant(USER_ID)]) });
      const { result } = renderHook(() => useSessionShare());

      let link: string | null = 'x';
      await act(async () => {
        link = await result.current.share();
      });

      expect(link).toBeNull();
      expect(mockShareExecute).not.toHaveBeenCalled();
      expect(shareSpy).not.toHaveBeenCalled();
      expect(result.current.errorCode).toBe('unknown');
      expect(useSharedSessionStore.getState().status).toBe('error');
      expect(useSharedSessionStore.getState().errorCode).toBe('unknown');
    });

    it('exposes the typed error code when the use case fails', async () => {
      useSessionStore.setState({
        session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
      });
      mockShareExecute.mockRejectedValue(new SessionShareError('net', 'network'));
      const { result } = renderHook(() => useSessionShare());

      let link: string | null = 'x';
      await act(async () => {
        link = await result.current.share();
      });

      expect(link).toBeNull();
      expect(result.current.errorCode).toBe('network');
      expect(useSharedSessionStore.getState().status).toBe('error');
      expect(useSharedSessionStore.getState().errorCode).toBe('network');
    });

    it('falls back to "unknown" for a non-typed error', async () => {
      useSessionStore.setState({
        session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
      });
      mockShareExecute.mockRejectedValue(new Error('boom'));
      const { result } = renderHook(() => useSessionShare());

      await act(async () => {
        await result.current.share();
      });

      expect(result.current.errorCode).toBe('unknown');
    });

    describe('already shared session', () => {
      it('shares the existing link without publishing the session again', async () => {
        useSessionStore.setState({
          session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
        });
        useSharedSessionStore.setState({
          isShared: true,
          isOwner: true,
          sessionId: SESSION_ID,
          link: shareResult.link,
          status: 'synced',
        });
        const { result } = renderHook(() => useSessionShare());

        let link: string | null = null;
        await act(async () => {
          link = await result.current.share();
        });

        expect(mockShareExecute).not.toHaveBeenCalled();
        expect(link).toBe(shareResult.link);
        expect(shareSpy).toHaveBeenCalledWith({ message: shareResult.link, url: shareResult.link });
        expect(useSharedSessionStore.getState().status).toBe('synced');
        expect(useSharedSessionStore.getState().errorCode).toBeNull();
        expect(result.current.errorCode).toBeNull();
      });

      it('publishes once, then reuses the link on a second share', async () => {
        useSessionStore.setState({
          session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
        });
        const { result } = renderHook(() => useSessionShare());

        const links: (string | null)[] = [];
        await act(async () => {
          links.push(await result.current.share());
        });
        await act(async () => {
          links.push(await result.current.share());
        });

        expect(mockShareExecute).toHaveBeenCalledTimes(1);
        expect(shareSpy).toHaveBeenCalledTimes(2);
        expect(links).toEqual([shareResult.link, shareResult.link]);
        expect(useSharedSessionStore.getState().status).toBe('synced');
      });

      it('shares the joined session link without publishing it (member)', async () => {
        useSessionStore.setState({
          session: makeLocalSession([makeParticipant(USER_ID)]),
        });
        const { result } = renderHook(() => useSessionShare());

        await act(async () => {
          await result.current.join(SESSION_ID, START_LOCATION);
        });
        let link: string | null = null;
        await act(async () => {
          link = await result.current.share();
        });

        expect(mockShareExecute).not.toHaveBeenCalled();
        expect(link).toBe(`mivro://session/${SESSION_ID}`);
        expect(useSharedSessionStore.getState().isOwner).toBe(false);
      });

      it('publishes the local session when the shared store holds another session', async () => {
        useSessionStore.setState({
          session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
        });
        useSharedSessionStore.setState({
          isShared: true,
          sessionId: 'another-session',
          link: 'mivro://session/another-session',
        });
        const { result } = renderHook(() => useSessionShare());

        let link: string | null = null;
        await act(async () => {
          link = await result.current.share();
        });

        expect(mockShareExecute).toHaveBeenCalledTimes(1);
        expect(link).toBe(shareResult.link);
        expect(useSharedSessionStore.getState().sessionId).toBe(SESSION_ID);
      });

      it('reports a share sheet failure on an already shared session', async () => {
        useSessionStore.setState({
          session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
        });
        useSharedSessionStore.setState({
          isShared: true,
          sessionId: SESSION_ID,
          link: shareResult.link,
          status: 'synced',
        });
        shareSpy.mockRejectedValue(new Error('share sheet unavailable'));
        const { result } = renderHook(() => useSessionShare());

        let link: string | null = 'not-called';
        await act(async () => {
          link = await result.current.share();
        });

        expect(mockShareExecute).not.toHaveBeenCalled();
        expect(link).toBeNull();
        expect(result.current.errorCode).toBe('unknown');
      });
    });

    describe('ended shared session', () => {
      it('refuses to publish a shared copy once the shared state is cleared', async () => {
        useSessionStore.setState({
          session: {
            ...makeLocalSession([makeParticipant(USER_ID), makeParticipant('b')]),
            isSharedCopy: true,
          },
        });
        const { result } = renderHook(() => useSessionShare());

        let link: string | null = 'not-called';
        await act(async () => {
          link = await result.current.share();
        });

        expect(link).toBeNull();
        expect(mockShareExecute).not.toHaveBeenCalled();
        expect(shareSpy).not.toHaveBeenCalled();
        expect(result.current.errorCode).toBe('closed');
        expect(useSharedSessionStore.getState().errorCode).toBe('closed');
      });

      it('does not republish a joined session after its remote removal', async () => {
        useSessionStore.setState({
          session: makeLocalSession([makeParticipant(USER_ID)]),
        });
        const { result } = renderHook(() => useSessionShare());

        await act(async () => {
          await result.current.join(SESSION_ID, START_LOCATION);
        });
        act(() => {
          useSharedSessionStore.getState().clearShared();
        });
        let link: string | null = 'not-called';
        await act(async () => {
          link = await result.current.share();
        });

        expect(useSessionStore.getState().session?.isSharedCopy).toBe(true);
        expect(link).toBeNull();
        expect(mockShareExecute).not.toHaveBeenCalled();
        expect(result.current.errorCode).toBe('closed');
      });
    });
  });

  // ─── join() ───────────────────────────────────────────────
  describe('join', () => {
    it('joins, loads the shared session locally and syncs the shared store', async () => {
      useSessionStore.setState({
        session: makeLocalSession([makeParticipant(USER_ID)]),
      });
      const { result } = renderHook(() => useSessionShare());

      let ok = false;
      await act(async () => {
        ok = await result.current.join(SESSION_ID, START_LOCATION);
      });

      expect(ok).toBe(true);
      expect(mockJoinExecute).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: SESSION_ID }),
      );
      // local session rebuilt
      expect(useSessionStore.getState().session?.participants).toHaveLength(2);
      // shared store synced
      const shared = useSharedSessionStore.getState();
      expect(shared.isShared).toBe(true);
      expect(shared.sessionId).toBe(SESSION_ID);
      // join() → setShared(..., false): plain member, NOT owner.
      expect(shared.isOwner).toBe(false);
      expect(shared.members).toHaveLength(2);
      expect(shared.status).toBe('synced');
    });

    // [MODIFIED] The member carries the start point passed to join(), not the local participant's.
    it('builds the member from the current user + the start location passed to join', async () => {
      useSessionStore.setState({
        session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('other')]),
      });
      const { result } = renderHook(() => useSessionShare());

      await act(async () => {
        await result.current.join(SESSION_ID, START_LOCATION);
      });

      const member = (mockJoinExecute.mock.calls[0]?.[0] as { member: SharedSessionMember }).member;
      expect(member.memberId).toBe(USER_ID);
      expect(member.startLocation).toEqual({
        latitude: START_LOCATION.coordinates.latitude,
        longitude: START_LOCATION.coordinates.longitude,
        formattedAddress: START_LOCATION.formattedAddress,
      });
    });

    // [MODIFIED] Replaces "fails with no_user when there is no signed-in user": a device without
    // a profile now gets a guest profile (ADR-004) and joins.
    it('creates a guest profile, then joins, when the device has no user', async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      mockCreateGuestExecute.mockReturnValue(guestUser);
      const { result } = renderHook(() => useSessionShare());

      let ok = false;
      await act(async () => {
        ok = await result.current.join(SESSION_ID, START_LOCATION);
      });

      expect(ok).toBe(true);
      expect(mockCreateGuestExecute).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user).toEqual(guestUser);
      const member = (mockJoinExecute.mock.calls[0]?.[0] as { member: SharedSessionMember }).member;
      expect(member.memberId).toBe(USER_ID);
    });

    // [MODIFIED] Replaces "fails with no_location ...": `no_location` no longer exists. `no_user`
    // stays as a defensive guard, should the guest creation leave no user.
    it('fails with no_user when the guest creation leaves no user', async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      jest.spyOn(useAuthStore.getState(), 'signInAsGuest').mockImplementation(() => undefined);
      const { result } = renderHook(() => useSessionShare());

      let ok = true;
      await act(async () => {
        ok = await result.current.join(SESSION_ID, START_LOCATION);
      });

      expect(ok).toBe(false);
      expect(result.current.errorCode).toBe('no_user');
      expect(mockJoinExecute).not.toHaveBeenCalled();
    });

    // [ADDED] Condition 1 + 3: the guest exists before the join use case runs, and the member
    // carries the start point chosen on the join screen (the device has no local session).
    it('creates the guest before the join use case, with the chosen start location', async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      mockCreateGuestExecute.mockReturnValue(guestUser);
      const { result } = renderHook(() => useSessionShare());

      await act(async () => {
        await result.current.join(SESSION_ID, START_LOCATION);
      });

      const guestOrder = mockCreateGuestExecute.mock.invocationCallOrder[0] ?? Infinity;
      const joinOrder = mockJoinExecute.mock.invocationCallOrder[0] ?? -Infinity;
      expect(guestOrder).toBeLessThan(joinOrder);
      expect(mockJoinExecute).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        member: {
          memberId: USER_ID,
          displayName: guestUser.displayName,
          startLocation: {
            latitude: START_LOCATION.coordinates.latitude,
            longitude: START_LOCATION.coordinates.longitude,
            formattedAddress: START_LOCATION.formattedAddress,
          },
        },
      });
    });

    it('does not create a guest when a user is already signed in', async () => {
      const { result } = renderHook(() => useSessionShare());

      await act(async () => {
        await result.current.join(SESSION_ID, START_LOCATION);
      });

      expect(mockCreateGuestExecute).not.toHaveBeenCalled();
      expect(mockJoinExecute).toHaveBeenCalledTimes(1);
    });

    it('fails with unknown, without joining, when the guest creation throws', async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      mockCreateGuestExecute.mockImplementationOnce(() => {
        throw new Error('invalid guest');
      });
      const { result } = renderHook(() => useSessionShare());

      let ok = true;
      await act(async () => {
        ok = await result.current.join(SESSION_ID, START_LOCATION);
      });

      expect(ok).toBe(false);
      expect(result.current.errorCode).toBe('unknown');
      expect(result.current.isBusy).toBe(false);
      expect(useSharedSessionStore.getState().status).toBe('error');
      expect(mockJoinExecute).not.toHaveBeenCalled();
    });

    it('exposes the typed error code when the join use case fails', async () => {
      useSessionStore.setState({ session: makeLocalSession([makeParticipant(USER_ID)]) });
      mockJoinExecute.mockRejectedValue(new SessionShareError('gone', 'expired'));
      const { result } = renderHook(() => useSessionShare());

      let ok = true;
      await act(async () => {
        ok = await result.current.join(SESSION_ID, START_LOCATION);
      });

      expect(ok).toBe(false);
      expect(result.current.errorCode).toBe('expired');
      expect(useSharedSessionStore.getState().status).toBe('error');
    });
  });
});

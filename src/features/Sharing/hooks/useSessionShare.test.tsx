/**
 * @file useSessionShare.test.tsx
 * @description Tests unitaires du hook d'orchestration useSessionShare (F5).
 *              Unit tests for the useSessionShare orchestration hook (F5).
 *
 *              Couvre : share() → ShareSessionUseCase + Share.share natif,
 *              join() → JoinSessionUseCase + loadSharedSession + state partagé,
 *              gardes (< 2 participants, pas d'user, pas de point de départ),
 *              errorCode exposé, isBusy.
 *
 * @module __tests__/unit/presentation/hooks/useSessionShare
 */

// [ADDED] F5 — Tests unitaires useSessionShare
import { act, renderHook } from '@testing-library/react-native';
import { Share } from 'react-native';
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
// useAuthStore est persisté (zustand persist) → expose un zustandStorage in-memory
// pour que setState ne casse pas au montage du middleware.
const mockShareExecute = jest.fn();
const mockJoinExecute = jest.fn();
const mockStorage = new Map<string, string>();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    shareSessionUseCase: { execute: mockShareExecute },
    joinSessionUseCase: { execute: mockJoinExecute },
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
      // create() → setShared(..., true) : cet appareil est PROPRIÉTAIRE.
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
        ok = await result.current.join(SESSION_ID);
      });

      expect(ok).toBe(true);
      expect(mockJoinExecute).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: SESSION_ID }),
      );
      // session locale reconstruite
      expect(useSessionStore.getState().session?.participants).toHaveLength(2);
      // store partagé synchronisé
      const shared = useSharedSessionStore.getState();
      expect(shared.isShared).toBe(true);
      expect(shared.sessionId).toBe(SESSION_ID);
      // join() → setShared(..., false) : simple membre, PAS propriétaire.
      expect(shared.isOwner).toBe(false);
      expect(shared.members).toHaveLength(2);
      expect(shared.status).toBe('synced');
    });

    it('builds the member from the current user + their local start location', async () => {
      useSessionStore.setState({
        session: makeLocalSession([makeParticipant(USER_ID), makeParticipant('other')]),
      });
      const { result } = renderHook(() => useSessionShare());

      await act(async () => {
        await result.current.join(SESSION_ID);
      });

      const member = (mockJoinExecute.mock.calls[0]?.[0] as { member: SharedSessionMember }).member;
      expect(member.memberId).toBe(USER_ID);
      expect(member.startLocation.formattedAddress).toBe(`Adresse ${USER_ID}`);
    });

    it('fails with no_user when there is no signed-in user', async () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      const { result } = renderHook(() => useSessionShare());

      let ok = true;
      await act(async () => {
        ok = await result.current.join(SESSION_ID);
      });

      expect(ok).toBe(false);
      expect(result.current.errorCode).toBe('no_user');
      expect(mockJoinExecute).not.toHaveBeenCalled();
    });

    it('fails with no_location when the user has no local start location', async () => {
      // Session locale sans participant correspondant à l'user (et >1 participant).
      useSessionStore.setState({
        session: makeLocalSession([makeParticipant('x'), makeParticipant('y')]),
      });
      const { result } = renderHook(() => useSessionShare());

      let ok = true;
      await act(async () => {
        ok = await result.current.join(SESSION_ID);
      });

      expect(ok).toBe(false);
      expect(result.current.errorCode).toBe('no_location');
      expect(mockJoinExecute).not.toHaveBeenCalled();
    });

    it('exposes the typed error code when the join use case fails', async () => {
      useSessionStore.setState({ session: makeLocalSession([makeParticipant(USER_ID)]) });
      mockJoinExecute.mockRejectedValue(new SessionShareError('gone', 'expired'));
      const { result } = renderHook(() => useSessionShare());

      let ok = true;
      await act(async () => {
        ok = await result.current.join(SESSION_ID);
      });

      expect(ok).toBe(false);
      expect(result.current.errorCode).toBe('expired');
      expect(useSharedSessionStore.getState().status).toBe('error');
    });
  });
});

/**
 * @file useRealtimeStore.test.ts
 * @description Tests unitaires du store useRealtimeStore (F4 — NON persisté).
 *              Unit tests for the useRealtimeStore (F4 — NOT persisted).
 *
 * @module state/useRealtimeStore.test
 */

// [ADDED] F4 — Tests unitaires useRealtimeStore
import type { RealtimeParticipant } from '@entities/RealtimeParticipant';
import { useRealtimeStore } from '@state/useRealtimeStore';

const makeParticipant = (
  participantId: string,
  overrides: Partial<RealtimeParticipant> = {},
): RealtimeParticipant => ({
  participantId,
  latitude: 48.8566,
  longitude: 2.3522,
  updatedAt: 1_700_000_000_000,
  speed: 5,
  heading: 90,
  isOnline: true,
  ...overrides,
});

const resetStore = () => {
  useRealtimeStore.setState({
    sessionId: null,
    participants: {},
    status: 'idle',
    errorCode: null,
    hasSharingConsent: false,
  });
};

describe('useRealtimeStore', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    resetStore();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Initial state ────────────────────────────────────────
  describe('initial state', () => {
    it('starts idle with no session and no participants', () => {
      const state = useRealtimeStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.participants).toEqual({});
      expect(state.status).toBe('idle');
      expect(state.errorCode).toBeNull();
      expect(state.hasSharingConsent).toBe(false);
    });
  });

  // ─── startTracking ────────────────────────────────────────
  describe('startTracking', () => {
    it('sets sessionId and status=connecting', () => {
      useRealtimeStore.getState().startTracking('session-001');

      const state = useRealtimeStore.getState();
      expect(state.sessionId).toBe('session-001');
      expect(state.status).toBe('connecting');
    });

    it('resets participants and consent from any previous session', () => {
      useRealtimeStore.setState({
        participants: { p1: makeParticipant('p1') },
        hasSharingConsent: true,
      });

      useRealtimeStore.getState().startTracking('session-002');

      const state = useRealtimeStore.getState();
      expect(state.participants).toEqual({});
      expect(state.hasSharingConsent).toBe(false);
    });
  });

  // ─── setStatus ────────────────────────────────────────────
  describe('setStatus', () => {
    it('updates status and clears errorCode for non-error status', () => {
      useRealtimeStore.setState({ errorCode: 'network' });

      useRealtimeStore.getState().setStatus('connected');

      const state = useRealtimeStore.getState();
      expect(state.status).toBe('connected');
      expect(state.errorCode).toBeNull();
    });

    it('stores errorCode when status=error', () => {
      useRealtimeStore.getState().setStatus('error', 'permission_denied');

      const state = useRealtimeStore.getState();
      expect(state.status).toBe('error');
      expect(state.errorCode).toBe('permission_denied');
    });
  });

  // ─── setParticipants ──────────────────────────────────────
  describe('setParticipants', () => {
    it('upserts participants into a keyed map', () => {
      const list = [makeParticipant('p1'), makeParticipant('p2')];

      useRealtimeStore.getState().setParticipants(list);

      const { participants } = useRealtimeStore.getState();
      expect(Object.keys(participants)).toEqual(['p1', 'p2']);
      expect(participants.p1?.participantId).toBe('p1');
    });

    it('replaces the previous list entirely', () => {
      useRealtimeStore.getState().setParticipants([makeParticipant('p1')]);
      useRealtimeStore.getState().setParticipants([makeParticipant('p2')]);

      const { participants } = useRealtimeStore.getState();
      expect(Object.keys(participants)).toEqual(['p2']);
    });

    it('reflects online/offline status from the incoming entity', () => {
      useRealtimeStore.getState().setParticipants([makeParticipant('p1', { isOnline: false })]);

      expect(useRealtimeStore.getState().participants.p1?.isOnline).toBe(false);
    });
  });

  // ─── setSharingConsent ────────────────────────────────────
  describe('setSharingConsent', () => {
    it('records granted consent', () => {
      useRealtimeStore.getState().setSharingConsent(true);
      expect(useRealtimeStore.getState().hasSharingConsent).toBe(true);
    });

    it('records revoked consent', () => {
      useRealtimeStore.setState({ hasSharingConsent: true });
      useRealtimeStore.getState().setSharingConsent(false);
      expect(useRealtimeStore.getState().hasSharingConsent).toBe(false);
    });
  });

  // ─── stopTracking (purge) ─────────────────────────────────
  describe('stopTracking', () => {
    it('purges all state back to initial (RGPD)', () => {
      useRealtimeStore.setState({
        sessionId: 'session-001',
        participants: { p1: makeParticipant('p1') },
        status: 'connected',
        errorCode: 'network',
        hasSharingConsent: true,
      });

      useRealtimeStore.getState().stopTracking();

      const state = useRealtimeStore.getState();
      expect(state.sessionId).toBeNull();
      expect(state.participants).toEqual({});
      expect(state.status).toBe('idle');
      expect(state.errorCode).toBeNull();
      expect(state.hasSharingConsent).toBe(false);
    });
  });

  // ─── Non-persistance (RGPD) ───────────────────────────────
  describe('non-persistence (GDPR)', () => {
    it('is NOT wrapped with a persist middleware (no persist API exposed)', () => {
      // Le persist middleware de Zustand ajoute une propriété `persist` sur le store.
      // Son absence garantit qu'aucune position ne touche un storage persistant.
      expect((useRealtimeStore as unknown as { persist?: unknown }).persist).toBeUndefined();
    });
  });
});

/**
 * @file useRealtimeTracking.test.tsx
 * @description Tests unitaires du hook d'orchestration useRealtimeTracking (F4).
 *              Unit tests for the useRealtimeTracking orchestration hook (F4).
 *
 *              Couvre : throttle batterie (5s mouvement / 30s arrêt), coupure en
 *              arrière-plan (AppState), publication conditionnée au consentement
 *              (RGPD), leaveSession + purge au stop.
 *
 * @module __tests__/unit/presentation/hooks/useRealtimeTracking
 */

// [ADDED] F4 — Tests unitaires useRealtimeTracking
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { useRealtimeTracking } from '@features/Sharing/hooks/useRealtimeTracking';
import type {
  PositionSample,
  WatchPositionCallback,
} from '@services/domain/geolocation/IGeolocationService';
import { RealtimeError } from '@services/domain/realtime/IRealtimeService';
import { useRealtimeStore } from '@state/useRealtimeStore';

// ─── Mock DI container ──────────────────────────────────────
const mockSubscribe = jest.fn();
const mockPublish = jest.fn();
const mockLeave = jest.fn();
const mockWatchPosition = jest.fn();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    trackParticipantsUseCase: {
      subscribe: mockSubscribe,
      publish: mockPublish,
      leave: mockLeave,
    },
    geolocationService: {
      watchPosition: mockWatchPosition,
    },
  })),
}));

const SESSION_ID = 'session-001';
const PARTICIPANT_ID = '550e8400-e29b-41d4-a716-446655440000';

/** Capture le callback passé à watchPosition pour émettre des samples à la demande. */
let emitSample: WatchPositionCallback;

const makeSample = (overrides: Partial<PositionSample> = {}): PositionSample => ({
  latitude: 48.8566,
  longitude: 2.3522,
  speed: 10,
  heading: 90,
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

describe('useRealtimeTracking', () => {
  let unsubscribe: jest.Mock;
  let clearWatch: jest.Mock;
  let appStateRemove: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    resetStore();

    unsubscribe = jest.fn();
    clearWatch = jest.fn();
    appStateRemove = jest.fn();

    mockSubscribe.mockReturnValue(unsubscribe);
    mockPublish.mockResolvedValue(undefined);
    mockLeave.mockResolvedValue(undefined);
    mockWatchPosition.mockImplementation((onSample: WatchPositionCallback) => {
      emitSample = onSample;
      return clearWatch;
    });

    // App au premier plan par défaut
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: appStateRemove,
    } as ReturnType<typeof AppState.addEventListener>);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── start : wiring ───────────────────────────────────────
  describe('start', () => {
    it('subscribes to the session and listens to AppState, but does NOT watch GPS without consent', () => {
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));

      // start() ne fait que s'abonner (voir les autres) + écouter AppState.
      expect(mockSubscribe).toHaveBeenCalledWith(SESSION_ID, expect.any(Function));
      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      // Le watch GPS local n'est PAS démarré par start() seul (opti batterie +
      // RGPD) : il dépend du consentement de partage.
      expect(mockWatchPosition).not.toHaveBeenCalled();
    });

    it('starts watching GPS once sharing consent is granted (reactive effect)', () => {
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      expect(mockWatchPosition).not.toHaveBeenCalled();

      // L'octroi du consentement (à chaud) déclenche le watch via l'effet réactif.
      act(() => useRealtimeStore.getState().setSharingConsent(true));

      expect(mockWatchPosition).toHaveBeenCalledTimes(1);
    });

    it('stops watching GPS when sharing consent is revoked (reactive effect)', () => {
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      expect(mockWatchPosition).toHaveBeenCalledTimes(1);

      // La révocation du consentement coupe le watch GPS (mode voir-seulement).
      act(() => useRealtimeStore.getState().setSharingConsent(false));

      expect(clearWatch).toHaveBeenCalled();
    });

    it('updates the store with participants on subscribe callback', () => {
      mockSubscribe.mockImplementation((_id, handler) => {
        handler([
          {
            participantId: 'p1',
            latitude: 1,
            longitude: 2,
            updatedAt: 1,
            speed: 0,
            heading: 0,
            isOnline: true,
          },
        ]);
        return unsubscribe;
      });
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));

      expect(useRealtimeStore.getState().participants.p1).toBeDefined();
      expect(useRealtimeStore.getState().status).toBe('connected');
    });
  });

  // ─── Consentement (RGPD) ──────────────────────────────────
  describe('consent gating', () => {
    it('does NOT watch GPS nor publish without sharing consent', () => {
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));

      // Sans consentement, aucun watch GPS n'est démarré : il n'existe donc
      // aucun callback pour émettre des échantillons → aucune publication.
      expect(mockWatchPosition).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('publishes when consent is granted', () => {
      const { result } = renderHook(() => useRealtimeTracking());
      // start() réinitialise le store (startTracking) → on consent APRÈS start.
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));

      act(() => emitSample(makeSample({ speed: 20 })));

      expect(mockPublish).toHaveBeenCalledWith(SESSION_ID, PARTICIPANT_ID, {
        latitude: 48.8566,
        longitude: 2.3522,
        speed: 20,
        heading: 90,
      });
    });
  });

  // ─── Throttle batterie ────────────────────────────────────
  describe('battery throttle', () => {
    /** Démarre le suivi puis accorde le consentement (l'ordre compte : start reset). */
    const startWithConsent = (result: { current: ReturnType<typeof useRealtimeTracking> }) => {
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
    };

    it('throttles to 5s while moving (>5 km/h)', () => {
      const { result } = renderHook(() => useRealtimeTracking());
      startWithConsent(result);

      // 1er sample publie immédiatement (lastPublishAt=0)
      act(() => emitSample(makeSample({ speed: 20 })));
      expect(mockPublish).toHaveBeenCalledTimes(1);

      // 4s plus tard : encore throttlé
      act(() => jest.advanceTimersByTime(4_000));
      act(() => emitSample(makeSample({ speed: 20 })));
      expect(mockPublish).toHaveBeenCalledTimes(1);

      // > 5s depuis la 1ère publication : nouvelle publication
      act(() => jest.advanceTimersByTime(1_500));
      act(() => emitSample(makeSample({ speed: 20 })));
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });

    it('throttles to 30s while stopped (<=5 km/h)', () => {
      const { result } = renderHook(() => useRealtimeTracking());
      startWithConsent(result);

      act(() => emitSample(makeSample({ speed: 1 })));
      expect(mockPublish).toHaveBeenCalledTimes(1);

      // 10s : toujours throttlé (seuil 30s à l'arrêt)
      act(() => jest.advanceTimersByTime(10_000));
      act(() => emitSample(makeSample({ speed: 1 })));
      expect(mockPublish).toHaveBeenCalledTimes(1);

      // > 30s : republie
      act(() => jest.advanceTimersByTime(21_000));
      act(() => emitSample(makeSample({ speed: 1 })));
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Background (AppState) ────────────────────────────────
  describe('background cutoff', () => {
    it('stops publishing when the app goes to background', () => {
      let appStateHandler: (s: AppStateStatus) => void = () => undefined;
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
        appStateHandler = handler as (s: AppStateStatus) => void;
        return { remove: appStateRemove } as ReturnType<typeof AppState.addEventListener>;
      });

      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));

      // Passage en arrière-plan
      act(() => appStateHandler('background'));
      act(() => jest.advanceTimersByTime(10_000));
      act(() => emitSample(makeSample({ speed: 20 })));

      expect(mockPublish).not.toHaveBeenCalled();

      // Retour au premier plan → publication de nouveau autorisée
      act(() => appStateHandler('active'));
      act(() => emitSample(makeSample({ speed: 20 })));
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });
  });

  // ─── stop : leaveSession + purge ──────────────────────────
  describe('stop', () => {
    it('tears down watch/subscribe/appState, calls leave and purges the store', () => {
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      // Consentement requis pour activer le watch GPS → vérifie son teardown.
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      expect(mockWatchPosition).toHaveBeenCalled();
      useRealtimeStore.setState({ status: 'connected' });

      act(() => result.current.stop());

      expect(clearWatch).toHaveBeenCalled();
      expect(unsubscribe).toHaveBeenCalled();
      expect(appStateRemove).toHaveBeenCalled();
      expect(mockLeave).toHaveBeenCalledWith(SESSION_ID, PARTICIPANT_ID);
      expect(useRealtimeStore.getState().sessionId).toBeNull();
      expect(useRealtimeStore.getState().status).toBe('idle');
    });

    it('does not call leave when never started', () => {
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => result.current.stop());

      expect(mockLeave).not.toHaveBeenCalled();
    });
  });

  // ─── Cleanup au démontage ─────────────────────────────────
  describe('unmount cleanup', () => {
    it('tears down active subscriptions on unmount', () => {
      const { result, unmount } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      // Consentement requis pour activer le watch GPS → vérifie son teardown.
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      expect(mockWatchPosition).toHaveBeenCalled();

      unmount();

      expect(clearWatch).toHaveBeenCalled();
      expect(unsubscribe).toHaveBeenCalled();
      expect(appStateRemove).toHaveBeenCalled();
    });
  });

  // ─── Gestion d'erreur ─────────────────────────────────────
  describe('error handling', () => {
    it('sets error status when publish rejects', async () => {
      mockPublish.mockRejectedValue(new RealtimeError('net', 'network'));
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));

      await act(async () => {
        emitSample(makeSample({ speed: 20 }));
        await Promise.resolve();
      });

      expect(useRealtimeStore.getState().status).toBe('error');
      expect(useRealtimeStore.getState().errorCode).toBe('network');
    });

    it('sets error status when start throws (subscribe fails)', () => {
      mockSubscribe.mockImplementation(() => {
        throw new RealtimeError('not configured', 'not_configured');
      });
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));

      expect(useRealtimeStore.getState().status).toBe('error');
      expect(useRealtimeStore.getState().errorCode).toBe('not_configured');
    });
  });
});

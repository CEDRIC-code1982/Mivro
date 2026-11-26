/**
 * @file useRealtimeTracking.test.tsx
 * @description Tests unitaires du hook d'orchestration useRealtimeTracking (F4).
 *              Unit tests for the useRealtimeTracking orchestration hook (F4).
 *
 *              Couvre : throttle batterie (5s mouvement / 30s arrêt), coupure en
 *              arrière-plan (AppState), publication conditionnée au consentement
 *              (RGPD), leaveSession + purge au stop.
 *
 * @module features/Sharing/hooks/useRealtimeTracking.test
 */

// [ADDED] F4 — Tests unitaires useRealtimeTracking
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type { MidpointSession } from '@entities/MidpointSession';
import { useRealtimeTracking } from '@features/Sharing/hooks/useRealtimeTracking';
import { GeolocationError } from '@services/domain/geolocation/IGeolocationService';
import type {
  PositionSample,
  WatchPositionCallback,
} from '@services/domain/geolocation/IGeolocationService';
import { RealtimeError } from '@services/domain/realtime/IRealtimeService';
import { useRealtimeStore } from '@state/useRealtimeStore';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore';

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
    trackingErrorCode: null,
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
    it('sets a tracking error, not the connection status, when publish rejects', async () => {
      mockPublish.mockRejectedValue(new RealtimeError('net', 'network'));
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));

      await act(async () => {
        emitSample(makeSample({ speed: 20 }));
        await Promise.resolve();
      });

      expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');
      expect(useRealtimeStore.getState().status).not.toBe('error');
      expect(useRealtimeStore.getState().errorCode).toBeNull();
    });

    it('keeps the tracking error when the next snapshot of the others arrives', async () => {
      let emitRoster: (participants: readonly []) => void = () => undefined;
      mockSubscribe.mockImplementation(
        (_id: string, handler: (participants: readonly []) => void) => {
          emitRoster = handler;
          return unsubscribe;
        },
      );
      mockPublish.mockRejectedValue(new RealtimeError('net', 'network'));
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      await act(async () => {
        emitSample(makeSample({ speed: 20 }));
        await Promise.resolve();
      });

      act(() => emitRoster([]));

      expect(useRealtimeStore.getState().status).toBe('connected');
      expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');
    });

    it('clears the tracking error once a position is published again', async () => {
      mockPublish.mockRejectedValueOnce(new RealtimeError('net', 'network'));
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      await act(async () => {
        emitSample(makeSample({ speed: 20 }));
        await Promise.resolve();
      });
      expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');

      act(() => jest.advanceTimersByTime(6_000));
      await act(async () => {
        emitSample(makeSample({ speed: 20 }));
        await Promise.resolve();
      });

      expect(mockPublish).toHaveBeenCalledTimes(2);
      expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
    });

    it('clears the tracking error when sharing consent is revoked', async () => {
      mockPublish.mockRejectedValue(new RealtimeError('net', 'network'));
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      await act(async () => {
        emitSample(makeSample({ speed: 20 }));
        await Promise.resolve();
      });

      act(() => useRealtimeStore.getState().setSharingConsent(false));

      expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
    });

    it('drops a publish failure that settles after stop', async () => {
      let rejectPublish: (error: unknown) => void = () => undefined;
      mockPublish.mockImplementation(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectPublish = reject;
          }),
      );
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      act(() => emitSample(makeSample({ speed: 20 })));

      act(() => result.current.stop());
      await act(async () => {
        rejectPublish(new RealtimeError('net', 'network'));
        await Promise.resolve();
      });

      expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
    });

    it('keeps a GPS error reported while an older publish was in flight', async () => {
      let resolvePublish: () => void = () => undefined;
      mockPublish.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolvePublish = resolve;
          }),
      );
      let emitError: (error: GeolocationError) => void = () => undefined;
      mockWatchPosition.mockImplementation(
        (onSample: WatchPositionCallback, onError: (error: GeolocationError) => void) => {
          emitSample = onSample;
          emitError = onError;
          return clearWatch;
        },
      );
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      act(() => emitSample(makeSample({ speed: 20 })));

      act(() => emitError(new GeolocationError('gps', 'unavailable')));
      await act(async () => {
        resolvePublish();
        await Promise.resolve();
      });

      expect(useRealtimeStore.getState().trackingErrorCode).toBe('unavailable');
    });

    describe('overlapping publishes', () => {
      let rejectOlder: (error: unknown) => void = () => undefined;
      let resolveOlder: () => void = () => undefined;
      let rejectNewer: (error: unknown) => void = () => undefined;
      let resolveNewer: () => void = () => undefined;

      const launchTwoPublishes = (): { current: ReturnType<typeof useRealtimeTracking> } => {
        mockPublish
          .mockImplementationOnce(
            () =>
              new Promise<void>((resolve, reject) => {
                resolveOlder = resolve;
                rejectOlder = reject;
              }),
          )
          .mockImplementationOnce(
            () =>
              new Promise<void>((resolve, reject) => {
                resolveNewer = resolve;
                rejectNewer = reject;
              }),
          );
        const { result } = renderHook(() => useRealtimeTracking());
        act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
        act(() => useRealtimeStore.getState().setSharingConsent(true));
        act(() => emitSample(makeSample({ speed: 20 })));
        act(() => jest.advanceTimersByTime(6_000));
        act(() => emitSample(makeSample({ speed: 20 })));
        expect(mockPublish).toHaveBeenCalledTimes(2);
        return result;
      };

      const settle = async (action: () => void): Promise<void> => {
        await act(async () => {
          action();
          await Promise.resolve();
        });
      };

      it('clears an older publish failure once a newer publish succeeds', async () => {
        launchTwoPublishes();

        await settle(() => rejectOlder(new RealtimeError('net', 'network')));
        expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');
        await settle(() => resolveNewer());

        expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
      });

      it('drops an older publish failure that settles after a newer publish succeeded', async () => {
        launchTwoPublishes();

        await settle(() => resolveNewer());
        await settle(() => rejectOlder(new RealtimeError('net', 'network')));

        expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
      });

      it('keeps a newer publish failure when an older publish succeeds afterwards', async () => {
        launchTwoPublishes();

        await settle(() => rejectNewer(new RealtimeError('net', 'network')));
        await settle(() => resolveOlder());

        expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');
      });

      it('keeps a GPS error when an older failure settles before a pre-GPS-error publish succeeds', async () => {
        let emitError: (error: GeolocationError) => void = () => undefined;
        mockWatchPosition.mockImplementation(
          (onSample: WatchPositionCallback, onError: (error: GeolocationError) => void) => {
            emitSample = onSample;
            emitError = onError;
            return clearWatch;
          },
        );
        launchTwoPublishes();

        act(() => emitError(new GeolocationError('gps', 'unavailable')));
        await settle(() => rejectOlder(new RealtimeError('net', 'network')));
        await settle(() => resolveNewer());

        expect(useRealtimeStore.getState().trackingErrorCode).toBe('unavailable');
      });

      describe('GPS cause priority', () => {
        let emitError: (error: GeolocationError) => void = () => undefined;

        beforeEach(() => {
          mockWatchPosition.mockImplementation(
            (onSample: WatchPositionCallback, onError: (error: GeolocationError) => void) => {
              emitSample = onSample;
              emitError = onError;
              return clearWatch;
            },
          );
        });

        const publishNextSample = async (): Promise<void> => {
          act(() => jest.advanceTimersByTime(6_000));
          await settle(() => emitSample(makeSample({ speed: 20 })));
        };

        it('keeps unavailable when a publish launched before the GPS error fails with network', async () => {
          launchTwoPublishes();

          act(() => emitError(new GeolocationError('gps', 'unavailable')));
          await settle(() => rejectNewer(new RealtimeError('net', 'network')));

          expect(useRealtimeStore.getState().trackingErrorCode).toBe('unavailable');
        });

        it('keeps permission_blocked when a publish launched before a GPS permission refusal fails with network', async () => {
          launchTwoPublishes();

          act(() => emitError(new GeolocationError('gps', 'permission_denied')));
          expect(useRealtimeStore.getState().trackingErrorCode).toBe('permission_blocked');
          await settle(() => rejectNewer(new RealtimeError('net', 'network')));

          expect(useRealtimeStore.getState().trackingErrorCode).toBe('permission_blocked');
        });

        it('shows network when a publish launched after the GPS error fails', async () => {
          launchTwoPublishes();
          act(() => emitError(new GeolocationError('gps', 'unavailable')));

          mockPublish.mockRejectedValueOnce(new RealtimeError('net', 'network'));
          await publishNextSample();

          expect(mockPublish).toHaveBeenCalledTimes(3);
          expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');
        });

        it('replaces a network error with a GPS error reported after it', async () => {
          launchTwoPublishes();
          await settle(() => rejectNewer(new RealtimeError('net', 'network')));
          expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');

          act(() => emitError(new GeolocationError('gps', 'unavailable')));

          expect(useRealtimeStore.getState().trackingErrorCode).toBe('unavailable');
        });

        it('shows a newer network failure once the GPS error was cleared by a later publish', async () => {
          launchTwoPublishes();
          act(() => emitError(new GeolocationError('gps', 'unavailable')));

          mockPublish.mockResolvedValueOnce(undefined);
          await publishNextSample();
          expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();

          mockPublish.mockRejectedValueOnce(new RealtimeError('net', 'network'));
          await publishNextSample();

          expect(mockPublish).toHaveBeenCalledTimes(4);
          expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');
        });

        it('shows a new network failure after a GPS error and a consent withdrawal', async () => {
          launchTwoPublishes();
          act(() => emitError(new GeolocationError('gps', 'unavailable')));

          act(() => useRealtimeStore.getState().setSharingConsent(false));
          expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
          act(() => useRealtimeStore.getState().setSharingConsent(true));
          mockPublish.mockRejectedValueOnce(new RealtimeError('net', 'network'));
          await publishNextSample();

          expect(mockPublish).toHaveBeenCalledTimes(3);
          expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');
        });

        it('shows a new network failure after a GPS error and a stop and restart', async () => {
          const result = launchTwoPublishes();
          act(() => emitError(new GeolocationError('gps', 'unavailable')));

          act(() => result.current.stop());
          act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
          act(() => useRealtimeStore.getState().setSharingConsent(true));
          expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
          mockPublish.mockRejectedValueOnce(new RealtimeError('net', 'network'));
          await publishNextSample();

          expect(mockPublish).toHaveBeenCalledTimes(3);
          expect(useRealtimeStore.getState().trackingErrorCode).toBe('network');
        });
      });
    });

    it('drops a publish failure that settles after sharing consent is revoked', async () => {
      let rejectPublish: (error: unknown) => void = () => undefined;
      mockPublish.mockImplementation(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectPublish = reject;
          }),
      );
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      act(() => emitSample(makeSample({ speed: 20 })));

      act(() => useRealtimeStore.getState().setSharingConsent(false));
      await act(async () => {
        rejectPublish(new RealtimeError('denied', 'permission_denied'));
        await Promise.resolve();
      });

      expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
    });

    it('drops a publish failure that settles after a restart on the same session', async () => {
      let rejectPublish: (error: unknown) => void = () => undefined;
      mockPublish.mockImplementation(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectPublish = reject;
          }),
      );
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      act(() => emitSample(makeSample({ speed: 20 })));

      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      await act(async () => {
        rejectPublish(new RealtimeError('net', 'network'));
        await Promise.resolve();
      });

      expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
    });

    it('drops a publish failure that settles after a session switch', async () => {
      let rejectPublish: (error: unknown) => void = () => undefined;
      mockPublish.mockImplementation(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectPublish = reject;
          }),
      );
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      act(() => emitSample(makeSample({ speed: 20 })));

      act(() => result.current.start('session-002', PARTICIPANT_ID));
      await act(async () => {
        rejectPublish(new RealtimeError('net', 'network'));
        await Promise.resolve();
      });

      expect(useRealtimeStore.getState().trackingErrorCode).toBeNull();
    });

    it('sets a tracking error when the GPS watch cannot start', () => {
      mockWatchPosition.mockImplementation(() => {
        throw new GeolocationError('gps', 'unavailable');
      });
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));

      act(() => useRealtimeStore.getState().setSharingConsent(true));

      expect(useRealtimeStore.getState().trackingErrorCode).toBe('unavailable');
      expect(useRealtimeStore.getState().status).not.toBe('error');
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

    it.each([
      ['permission_denied', 'permission_blocked'],
      ['permission_blocked', 'permission_blocked'],
      ['timeout', 'timeout'],
    ] as const)('maps the GPS watch error %s to the code %s', (gpsCode, expected) => {
      let emitError: (error: GeolocationError) => void = () => undefined;
      mockWatchPosition.mockImplementation(
        (_onSample: WatchPositionCallback, onError: (error: GeolocationError) => void) => {
          emitError = onError;
          return clearWatch;
        },
      );
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));

      act(() => emitError(new GeolocationError('gps', gpsCode)));

      expect(useRealtimeStore.getState().trackingErrorCode).toBe(expected);
      expect(useRealtimeStore.getState().status).not.toBe('error');
    });

    it('keeps the real-time permission_denied code for a refused real-time service', () => {
      mockSubscribe.mockImplementation(() => {
        throw new RealtimeError('denied', 'permission_denied');
      });
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));

      expect(useRealtimeStore.getState().errorCode).toBe('permission_denied');
    });
  });

  describe('ended shared session', () => {
    const sharedCopy = (isSharedCopy: boolean): MidpointSession => ({
      id: SESSION_ID,
      status: 'computed',
      participants: [],
      createdAt: '2026-06-25T10:00:00.000Z',
      updatedAt: '2026-06-25T10:00:00.000Z',
      isSharedCopy,
    });

    afterEach(() => {
      useSessionStore.setState({ session: null });
      useSharedSessionStore.getState().clearShared();
    });

    it('stops tracking and removes my node when the shared session ends remotely', () => {
      useSessionStore.setState({ session: sharedCopy(true) });
      useSharedSessionStore.getState().setShared(SESSION_ID, `mivro://session/${SESSION_ID}`);
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));
      act(() => useRealtimeStore.getState().setSharingConsent(true));
      act(() => emitSample(makeSample()));
      expect(mockPublish).toHaveBeenCalledTimes(1);

      act(() => useSharedSessionStore.getState().clearShared());

      expect(mockLeave).toHaveBeenCalledWith(SESSION_ID, PARTICIPANT_ID);
      expect(clearWatch).toHaveBeenCalled();
      expect(unsubscribe).toHaveBeenCalled();
      expect(useRealtimeStore.getState().sessionId).toBeNull();
      jest.advanceTimersByTime(60_000);
      act(() => emitSample(makeSample()));
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    it('refuses to start tracking an ended shared copy', () => {
      useSessionStore.setState({ session: sharedCopy(true) });
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));

      expect(mockSubscribe).not.toHaveBeenCalled();
      expect(mockLeave).not.toHaveBeenCalled();
      expect(useRealtimeStore.getState().sessionId).toBeNull();
      expect(useRealtimeStore.getState().status).toBe('error');
      expect(useRealtimeStore.getState().errorCode).toBe('closed');
    });

    it('drops the sharing consent granted after a refused start', () => {
      useSessionStore.setState({ session: sharedCopy(true) });
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => {
        result.current.start(SESSION_ID, PARTICIPANT_ID);
        useRealtimeStore.getState().setSharingConsent(true);
      });

      expect(useRealtimeStore.getState().hasSharingConsent).toBe(false);
      expect(mockWatchPosition).not.toHaveBeenCalled();
    });

    it('stops the tracking of another session when start is refused', () => {
      useSessionStore.setState({ session: { ...sharedCopy(false), id: 'session-a' } });
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start('session-a', PARTICIPANT_ID));
      expect(useRealtimeStore.getState().sessionId).toBe('session-a');
      act(() => useSessionStore.setState({ session: sharedCopy(true) }));

      act(() => {
        result.current.start(SESSION_ID, PARTICIPANT_ID);
        useRealtimeStore.getState().setSharingConsent(true);
      });

      expect(mockLeave).toHaveBeenCalledWith('session-a', PARTICIPANT_ID);
      expect(unsubscribe).toHaveBeenCalled();
      expect(useRealtimeStore.getState().sessionId).toBeNull();
      expect(useRealtimeStore.getState().hasSharingConsent).toBe(false);
      expect(useRealtimeStore.getState().errorCode).toBe('closed');
      expect(mockWatchPosition).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('keeps the sharing consent granted after a successful start', () => {
      useSessionStore.setState({ session: sharedCopy(true) });
      useSharedSessionStore.getState().setShared(SESSION_ID, `mivro://session/${SESSION_ID}`);
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => {
        result.current.start(SESSION_ID, PARTICIPANT_ID);
        useRealtimeStore.getState().setSharingConsent(true);
      });

      expect(useRealtimeStore.getState().hasSharingConsent).toBe(true);
      expect(mockWatchPosition).toHaveBeenCalled();
    });

    it('starts tracking a shared copy while the session is still shared', () => {
      useSessionStore.setState({ session: sharedCopy(true) });
      useSharedSessionStore.getState().setShared(SESSION_ID, `mivro://session/${SESSION_ID}`);
      const { result } = renderHook(() => useRealtimeTracking());

      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));

      expect(mockSubscribe).toHaveBeenCalledWith(SESSION_ID, expect.any(Function));
      expect(useRealtimeStore.getState().sessionId).toBe(SESSION_ID);
    });

    it('keeps tracking a local session that was never loaded from a share', () => {
      useSessionStore.setState({ session: sharedCopy(false) });
      const { result } = renderHook(() => useRealtimeTracking());
      act(() => result.current.start(SESSION_ID, PARTICIPANT_ID));

      act(() => useSharedSessionStore.getState().clearShared());

      expect(mockSubscribe).toHaveBeenCalled();
      expect(mockLeave).not.toHaveBeenCalled();
      expect(useRealtimeStore.getState().sessionId).toBe(SESSION_ID);
    });
  });
});

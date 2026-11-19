/**
 * @file useRealtimeTracking.ts
 * @description Real-time orchestration hook (F4).
 *
 *              Wires:
 *              - subscribe(IRealtimeService) → useRealtimeStore (the others' positions)
 *              - geoloc.watchPosition → publish(IRealtimeService) (my position)
 *
 *              MANDATORY battery optimizations (CLAUDE.md):
 *              - throttled publishing: 5s if speed > 5 km/h, 30s when stopped
 *              - publishing disabled when the app goes to the background
 *                (AppState) — MVP, no background tracking
 *
 *              GDPR: publishing happens ONLY if explicit sharing consent has
 *              been given (useRealtimeStore.hasSharingConsent). The
 *              subscription (seeing the others) publishes nothing and stays
 *              allowed. When tracking ends: leaveSession (node removal) +
 *              stopTracking. A local copy of a shared session that has ended
 *              is never tracked: it would recreate the deleted session node.
 *
 *              Presentation goes through the port via the DI container: it
 *              NEVER imports firebase (dependency rule).
 *
 * @module features/Sharing/hooks/useRealtimeTracking
 */

// [ADDED] F4 — useRealtimeTracking orchestration hook
import { useCallback, useEffect, useRef } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';
import type { ClearWatch, PositionSample } from '@services/domain/geolocation/IGeolocationService';
import { GeolocationError } from '@services/domain/geolocation/IGeolocationService';
import { RealtimeError } from '@services/domain/realtime/IRealtimeService';
import type { Unsubscribe } from '@services/domain/realtime/IRealtimeService';
import { getContainer } from '@services/serviceContainer';
import { useRealtimeStore } from '@state/useRealtimeStore';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore';

/** Speed threshold (km/h) separating moving / stopped */
const MOVING_SPEED_THRESHOLD_KMH = 5;
/** Publishing interval while moving (ms) — battery optimization */
const PUBLISH_INTERVAL_MOVING_MS = 5_000;
/** Publishing interval while stopped (ms) — battery optimization */
const PUBLISH_INTERVAL_STOPPED_MS = 30_000;

/**
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/**
 * Maps an error to an i18n code (namespace realtime.errors.*).
 *
 * @param error - Error to map
 * @returns i18n error code
 */
const toErrorCode = (error: unknown): string => {
  if (error instanceof RealtimeError) return error.code;
  if (error instanceof GeolocationError) return error.code;
  return 'unknown';
};

/**
 * Tells whether a session is the local copy of a shared session that has ended (remote node
 * deleted by its owner or purged at expiry): it is marked `isSharedCopy`, while the shared store
 * no longer holds it.
 *
 * @param sessionId - Id of the tracked session
 * @returns true if tracking this session would recreate an ended shared session
 */
const isEndedSharedCopy = (sessionId: string): boolean => {
  const session = useSessionStore.getState().session;
  if (session?.id !== sessionId || session.isSharedCopy !== true) return false;
  const shared = useSharedSessionStore.getState();
  return !(shared.isShared && shared.sessionId === sessionId);
};

/**
 * useRealtimeTracking hook result.
 */
export interface UseRealtimeTrackingResult {
  /**
   * Starts tracking: subscribe to the others + publish my position.
   * Publishing requires `hasSharingConsent=true` (GDPR). Refused for the local copy of an ended
   * shared session (status 'error', code 'closed').
   *
   * @param sessionId - Session identifier
   * @param participantId - My participant identifier
   */
  start: (sessionId: string, participantId: string) => void;
  /**
   * Stops tracking: leaveSession (node removal — GDPR) + store purge.
   */
  stop: () => void;
}

/**
 * Real-time participant tracking orchestration hook.
 *
 * @returns start / stop actions
 */
export const useRealtimeTracking = (): UseRealtimeTrackingResult => {
  const startTracking = useRealtimeStore((s) => s.startTracking);
  const stopTrackingStore = useRealtimeStore((s) => s.stopTracking);
  const setParticipants = useRealtimeStore((s) => s.setParticipants);
  const setStatus = useRealtimeStore((s) => s.setStatus);
  const setSharingConsent = useRealtimeStore((s) => s.setSharingConsent);
  // [ADDED] The local GPS watch is driven by consent + tracking state.
  // The subscription (seeing the others) stays decoupled from these values.
  const hasSharingConsent = useRealtimeStore((s) => s.hasSharingConsent);
  const trackedSessionId = useRealtimeStore((s) => s.sessionId);
  const isTracking = trackedSessionId !== null;
  const sharedCopyId = useSessionStore((s) =>
    s.session?.isSharedCopy === true ? s.session.id : null,
  );
  const sharedSessionId = useSharedSessionStore((s) => (s.isShared ? s.sessionId : null));

  // Refs: no re-render on these purely technical values.
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const clearWatchRef = useRef<ClearWatch | null>(null);
  const appStateSubRef = useRef<{ remove: () => void } | null>(null);
  const lastPublishAtRef = useRef<number>(0);
  const sessionRef = useRef<string | null>(null);
  const participantRef = useRef<string | null>(null);
  const isForegroundRef = useRef<boolean>(AppState.currentState === 'active');

  /**
   * Publishes a sample if: consent OK + app foregrounded + throttle interval respected (5s moving
   * / 30s stopped) + the session has not ended.
   *
   * @param sample - Position sample
   */
  const maybePublish = useCallback(
    (sample: PositionSample): void => {
      const sessionId = sessionRef.current;
      const participantId = participantRef.current;
      if (sessionId === null || participantId === null) return;

      // GDPR: no consent → never publish (the others are still visible through the
      // subscription, but our position is not broadcast).
      if (!useRealtimeStore.getState().hasSharingConsent) return;

      // GDPR: an ended shared session is never written again (the effect below stops tracking).
      if (isEndedSharedCopy(sessionId)) return;

      // MVP: no publishing in the background (battery optimization)
      if (!isForegroundRef.current) return;

      const interval =
        sample.speed > MOVING_SPEED_THRESHOLD_KMH
          ? PUBLISH_INTERVAL_MOVING_MS
          : PUBLISH_INTERVAL_STOPPED_MS;

      const now = Date.now();
      if (now - lastPublishAtRef.current < interval) return;
      lastPublishAtRef.current = now;

      const { trackParticipantsUseCase } = getContainer();
      trackParticipantsUseCase
        .publish(sessionId, participantId, {
          latitude: sample.latitude,
          longitude: sample.longitude,
          speed: sample.speed,
          heading: sample.heading,
        })
        .catch((error: unknown) => {
          setStatus('error', toErrorCode(error));
          console.error(
            `[ERROR][useRealtimeTracking][maybePublish][?][${timestamp()}] ` +
              `Publish failed | code: ${toErrorCode(error)}`,
          );
        });
    },
    [setStatus],
  );

  /**
   * Starts the local GPS watch (throttled publishing). Idempotent.
   * Started ONLY when sharing consent is granted (GDPR + battery: no GPS in view-only mode).
   */
  const startWatch = useCallback((): void => {
    if (clearWatchRef.current !== null) return; // already active
    const { geolocationService } = getContainer();
    try {
      clearWatchRef.current = geolocationService.watchPosition(
        maybePublish,
        (error) => {
          setStatus('error', toErrorCode(error));
        },
        { accuracyMeters: 50, distanceFilterMeters: 10 },
      );
      console.log(
        `[INFO][useRealtimeTracking][startWatch][?][${timestamp()}] GPS watch started (sharing)`,
      );
    } catch (error: unknown) {
      setStatus('error', toErrorCode(error));
      console.error(
        `[ERROR][useRealtimeTracking][startWatch][?][${timestamp()}] ` +
          `Failed to start GPS watch | code: ${toErrorCode(error)}`,
      );
    }
  }, [maybePublish, setStatus]);

  /**
   * Stops the local GPS watch (no more GPS usage). Idempotent.
   */
  const stopWatch = useCallback((): void => {
    if (clearWatchRef.current === null) return;
    clearWatchRef.current();
    clearWatchRef.current = null;
    console.log(`[INFO][useRealtimeTracking][stopWatch][?][${timestamp()}] GPS watch stopped`);
  }, []);

  /**
   * Tears down all active subscriptions (watch, subscribe, AppState).
   */
  const teardown = useCallback((): void => {
    stopWatch();
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    appStateSubRef.current?.remove();
    appStateSubRef.current = null;
  }, [stopWatch]);

  const stop = useCallback((): void => {
    const sessionId = sessionRef.current;
    const participantId = participantRef.current;

    teardown();

    // GDPR: remove my position from Firebase (node removal).
    if (sessionId !== null && participantId !== null) {
      const { trackParticipantsUseCase } = getContainer();
      trackParticipantsUseCase.leave(sessionId, participantId).catch((error: unknown) => {
        console.error(
          `[ERROR][useRealtimeTracking][stop][?][${timestamp()}] ` +
            `leaveSession failed | code: ${toErrorCode(error)}`,
        );
      });
    }

    sessionRef.current = null;
    participantRef.current = null;
    stopTrackingStore();

    console.log(`[INFO][useRealtimeTracking][stop][?][${timestamp()}] Realtime tracking stopped`);
  }, [teardown, stopTrackingStore]);

  const start = useCallback(
    (sessionId: string, participantId: string): void => {
      // [FIXED] "Suivi F4 d'une session partagée terminée": the first position published to an
      // ended shared session would recreate its node without `meta`, out of reach of the expiry
      // purge. Such a session is never tracked.
      // [FIXED] "Consentement appliqué à la session précédente": a refused start() used to leave
      // the tracking of another session running, and the consent MapScreen grants right after
      // applied to that session, against an explicit refusal there. Any running tracking stops
      // first (leave + store reset), so that no session is tracked after a refusal and the
      // consent is dropped; the error is set after the reset, which clears the status.
      if (isEndedSharedCopy(sessionId)) {
        stop();
        setStatus('error', 'closed');
        console.log(
          `[INFO][useRealtimeTracking][start][?][${timestamp()}] ` +
            'Tracking refused: shared session has ended',
        );
        return;
      }

      // Idempotent: restart cleanly if already active.
      teardown();

      sessionRef.current = sessionId;
      participantRef.current = participantId;
      lastPublishAtRef.current = 0;
      isForegroundRef.current = AppState.currentState === 'active';

      startTracking(sessionId);

      const { trackParticipantsUseCase } = getContainer();

      try {
        // 1. Subscription to the others' positions (always allowed, even in view-only mode —
        //    publishes nothing).
        unsubscribeRef.current = trackParticipantsUseCase.subscribe(sessionId, (participants) => {
          setParticipants(participants);
          setStatus('connected');
        });

        // 2. The local GPS watch is NOT started here: it is driven by an effect reacting to
        //    consent (startWatch/stopWatch), so that GPS is never used in view-only mode
        //    (battery optimization).

        // 3. AppState: cut publishing in the background (battery optimization).
        const handleAppState = (next: AppStateStatus): void => {
          isForegroundRef.current = next === 'active';
          console.log(
            `[INFO][useRealtimeTracking][appState][?][${timestamp()}] App state: ${next}`,
          );
        };
        appStateSubRef.current = AppState.addEventListener('change', handleAppState);

        console.log(
          `[INFO][useRealtimeTracking][start][?][${timestamp()}] Realtime tracking started`,
        );
      } catch (error: unknown) {
        setStatus('error', toErrorCode(error));
        teardown();
        console.error(
          `[ERROR][useRealtimeTracking][start][?][${timestamp()}] ` +
            `Failed to start tracking | code: ${toErrorCode(error)}`,
        );
      }
    },
    [teardown, stop, startTracking, setParticipants, setStatus],
  );

  // [ADDED] The local GPS watch is driven by sharing consent.
  // The watch runs ONLY if tracking is active AND consent is granted: in view-only mode (consent
  // refused), no local GPS is started (battery optimization). Reacts to consent being
  // (re)voked on the fly.
  useEffect(() => {
    if (isTracking && hasSharingConsent) {
      startWatch();
    } else {
      stopWatch();
    }
  }, [isTracking, hasSharingConsent, startWatch, stopWatch]);

  // [FIXED] "Consentement donné sans suivi actif": MapScreen grants consent right after start();
  // when start() refuses an ended shared copy, consent was kept while nothing was tracked, and
  // the button read "Arrêter le partage" although nothing was published. Consent only exists
  // alongside active tracking.
  useEffect(() => {
    if (!isTracking && hasSharingConsent) {
      setSharingConsent(false);
    }
  }, [isTracking, hasSharingConsent, setSharingConsent]);

  // [FIXED] "Suivi F4 d'une session partagée terminée": when the shared session ends remotely
  // (deleted by its owner or purged at expiry), useSharedSessionSync only clears the shared
  // store; tracking went on publishing, recreating the deleted node. Tracking of an ended shared
  // copy stops, which also removes my position node.
  useEffect(() => {
    if (
      trackedSessionId !== null &&
      trackedSessionId === sharedCopyId &&
      sharedSessionId !== trackedSessionId
    ) {
      console.log(
        `[INFO][useRealtimeTracking][sharedSessionEnded][?][${timestamp()}] ` +
          'Shared session ended remotely — stopping tracking',
      );
      stop();
    }
  }, [trackedSessionId, sharedCopyId, sharedSessionId, stop]);

  // Safety: cleanup on unmount (avoids watch/subscribe leaks).
  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  return { start, stop };
};

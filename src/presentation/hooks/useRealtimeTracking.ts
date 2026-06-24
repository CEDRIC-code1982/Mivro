/**
 * @file useRealtimeTracking.ts
 * @description Hook d'orchestration du temps réel (F4).
 *              Real-time orchestration hook (F4).
 *
 *              Relie / Wires:
 *              - subscribe(IRealtimeService) → useRealtimeStore (positions des autres)
 *              - geoloc.watchPosition → publish(IRealtimeService) (ma position)
 *
 *              Opti batterie OBLIGATOIRES (CLAUDE.md) / MANDATORY battery opti:
 *              - publication throttlée : 5s si speed > 5 km/h, 30s à l'arrêt
 *              - désactivation de la publication si l'app passe en arrière-plan
 *                (AppState) — MVP, pas de background tracking
 *
 *              RGPD : la publication n'a lieu QUE si le consentement explicite
 *              de partage a été donné (useRealtimeStore.hasSharingConsent).
 *              L'abonnement (voir les autres) ne publie rien et reste autorisé.
 *              En fin de suivi : leaveSession (remove du nœud) + stopTracking.
 *
 *              La présentation passe par le port via le container DI : elle
 *              n'importe JAMAIS firebase (règle de dépendance).
 *              Presentation goes through the port via the DI container: it
 *              NEVER imports firebase (dependency rule).
 *
 * @module presentation/hooks/useRealtimeTracking
 */

// [ADDED] F4 — Hook d'orchestration useRealtimeTracking
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { getContainer } from '@/di/container';
import type { ClearWatch, PositionSample } from '@core/ports/IGeolocationService';
import { GeolocationError } from '@core/ports/IGeolocationService';
import { RealtimeError } from '@core/ports/IRealtimeService';
import type { Unsubscribe } from '@core/ports/IRealtimeService';
import { useRealtimeStore } from '@presentation/stores/useRealtimeStore';

/** Seuil de vitesse (km/h) distinguant mouvement / arrêt */
const MOVING_SPEED_THRESHOLD_KMH = 5;
/** Intervalle de publication en mouvement (ms) — opti batterie */
const PUBLISH_INTERVAL_MOVING_MS = 5_000;
/** Intervalle de publication à l'arrêt (ms) — opti batterie */
const PUBLISH_INTERVAL_STOPPED_MS = 30_000;

/**
 * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Timestamp formaté / Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/**
 * Mappe une erreur en code i18n (namespace realtime.errors.*).
 * Maps an error to an i18n code (namespace realtime.errors.*).
 *
 * @param error - Erreur à mapper / Error to map
 * @returns Code d'erreur i18n / i18n error code
 */
const toErrorCode = (error: unknown): string => {
  if (error instanceof RealtimeError) return error.code;
  if (error instanceof GeolocationError) return error.code;
  return 'unknown';
};

/**
 * Résultat du hook useRealtimeTracking.
 * useRealtimeTracking hook result.
 */
export interface UseRealtimeTrackingResult {
  /**
   * Démarre le suivi : abonnement aux autres + publication de ma position.
   * La publication exige `hasSharingConsent=true` (RGPD).
   * Starts tracking: subscribe to others + publish my position.
   * Publishing requires `hasSharingConsent=true` (GDPR).
   *
   * @param sessionId - Identifiant de la session / Session identifier
   * @param participantId - Mon identifiant participant / My participant identifier
   */
  start: (sessionId: string, participantId: string) => void;
  /**
   * Arrête le suivi : leaveSession (remove du nœud — RGPD) + purge du store.
   * Stops tracking: leaveSession (node removal — GDPR) + store purge.
   */
  stop: () => void;
}

/**
 * Hook d'orchestration du suivi temps réel des participants.
 * Real-time participant tracking orchestration hook.
 *
 * @returns Actions start / stop / Hook actions
 */
export const useRealtimeTracking = (): UseRealtimeTrackingResult => {
  const startTracking = useRealtimeStore((s) => s.startTracking);
  const stopTrackingStore = useRealtimeStore((s) => s.stopTracking);
  const setParticipants = useRealtimeStore((s) => s.setParticipants);
  const setStatus = useRealtimeStore((s) => s.setStatus);
  // [ADDED] Pilotage du watch GPS local par le consentement + l'état du suivi.
  // L'abonnement (voir les autres) reste découplé de ces valeurs.
  const hasSharingConsent = useRealtimeStore((s) => s.hasSharingConsent);
  const isTracking = useRealtimeStore((s) => s.sessionId !== null);

  // Refs : pas de re-render sur ces valeurs purement techniques.
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const clearWatchRef = useRef<ClearWatch | null>(null);
  const appStateSubRef = useRef<{ remove: () => void } | null>(null);
  const lastPublishAtRef = useRef<number>(0);
  const sessionRef = useRef<string | null>(null);
  const participantRef = useRef<string | null>(null);
  const isForegroundRef = useRef<boolean>(AppState.currentState === 'active');

  /**
   * Publie un échantillon si : consentement OK + app au premier plan +
   * intervalle de throttle respecté (5s en mouvement / 30s à l'arrêt).
   * Publishes a sample if: consent OK + app foregrounded + throttle interval
   * respected (5s moving / 30s stopped).
   *
   * @param sample - Échantillon de position / Position sample
   */
  const maybePublish = useCallback(
    (sample: PositionSample): void => {
      const sessionId = sessionRef.current;
      const participantId = participantRef.current;
      if (sessionId === null || participantId === null) return;

      // RGPD : pas de consentement → on ne publie jamais (on voit quand même
      // les autres via l'abonnement, mais on ne diffuse pas notre position).
      if (!useRealtimeStore.getState().hasSharingConsent) return;

      // MVP : pas de publication en arrière-plan (opti batterie)
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
   * Démarre le watch GPS local (publication throttlée). Idempotent.
   * Démarré UNIQUEMENT quand le consentement de partage est donné (RGPD +
   * opti batterie : aucun GPS en mode voir-seulement).
   * Starts the local GPS watch (throttled publishing). Idempotent.
   * Started ONLY when sharing consent is granted (GDPR + battery: no GPS in
   * view-only mode).
   */
  const startWatch = useCallback((): void => {
    if (clearWatchRef.current !== null) return; // déjà actif
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
   * Arrête le watch GPS local (cesse toute consommation GPS). Idempotent.
   * Stops the local GPS watch (no more GPS usage). Idempotent.
   */
  const stopWatch = useCallback((): void => {
    if (clearWatchRef.current === null) return;
    clearWatchRef.current();
    clearWatchRef.current = null;
    console.log(`[INFO][useRealtimeTracking][stopWatch][?][${timestamp()}] GPS watch stopped`);
  }, []);

  /**
   * Nettoie toutes les souscriptions actives (watch, subscribe, AppState).
   * Tears down all active subscriptions (watch, subscribe, AppState).
   */
  const teardown = useCallback((): void => {
    stopWatch();
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    appStateSubRef.current?.remove();
    appStateSubRef.current = null;
  }, [stopWatch]);

  const start = useCallback(
    (sessionId: string, participantId: string): void => {
      // Idempotent : on repart proprement si déjà actif.
      teardown();

      sessionRef.current = sessionId;
      participantRef.current = participantId;
      lastPublishAtRef.current = 0;
      isForegroundRef.current = AppState.currentState === 'active';

      startTracking(sessionId);

      const { trackParticipantsUseCase } = getContainer();

      try {
        // 1. Abonnement aux positions des autres (toujours autorisé, même en
        //    mode voir-seulement — ne publie rien).
        unsubscribeRef.current = trackParticipantsUseCase.subscribe(sessionId, (participants) => {
          setParticipants(participants);
          setStatus('connected');
        });

        // 2. Le watch GPS local n'est PAS démarré ici : il est piloté par un
        //    effet réagissant au consentement (startWatch/stopWatch) afin de
        //    ne jamais consommer le GPS en mode voir-seulement (opti batterie).

        // 3. AppState : couper la publication en arrière-plan (opti batterie).
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
    [teardown, startTracking, setParticipants, setStatus],
  );

  const stop = useCallback((): void => {
    const sessionId = sessionRef.current;
    const participantId = participantRef.current;

    teardown();

    // RGPD : suppression de ma position côté Firebase (remove du nœud).
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

  // [ADDED] Pilotage du watch GPS local par le consentement de partage.
  // Le watch ne tourne QUE si un suivi est actif ET le consentement est donné :
  // en mode voir-seulement (consentement refusé), aucun GPS local n'est démarré
  // (opti batterie). Réagit à la (ré)vocation du consentement à chaud.
  // Drives the local GPS watch from sharing consent: GPS runs only when
  // tracking is active AND consent is granted (battery optimization).
  useEffect(() => {
    if (isTracking && hasSharingConsent) {
      startWatch();
    } else {
      stopWatch();
    }
  }, [isTracking, hasSharingConsent, startWatch, stopWatch]);

  // Sécurité : nettoyage au démontage (évite les fuites de watch/subscribe).
  // Safety: cleanup on unmount (avoids watch/subscribe leaks).
  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  return { start, stop };
};

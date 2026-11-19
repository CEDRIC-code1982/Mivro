/**
 * @file useRealtimeStore.ts
 * @description Zustand store of participants' real-time GPS positions (F4).
 *
 *              ⚠️ NOT persisted intentionally (GDPR): live positions must NEVER survive the app
 *              lifecycle nor land in persistent storage (MMKV/AsyncStorage). Everything is in
 *              memory and lost on app kill.
 *
 *              The store is state-only: orchestration (geoloc → publish, subscribe → store,
 *              consent) lives in the useRealtimeTracking hook. The store imports neither
 *              firebase nor the port.
 *
 * @module state/useRealtimeStore
 */

// [ADDED] F4 — Real-time Zustand store (NOT persisted, GDPR)
import { create } from 'zustand';
import type { RealtimeParticipant } from '@entities/RealtimeParticipant';

/**
 * Connection status to the real-time stream.
 *
 * - `idle`: no active tracking
 * - `connecting`: subscription / publishing being established
 * - `connected`: active tracking, positions received
 * - `error`: error (see errorCode)
 */
export type RealtimeConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * Real-time store state.
 */
interface RealtimeState {
  /** Current live session id or null */
  sessionId: string | null;
  /** Map participantId → live position */
  participants: Readonly<Record<string, RealtimeParticipant>>;
  /** Connection status (health of the subscription to the others' positions) */
  status: RealtimeConnectionStatus;
  /** i18n error code of the last connection error, or null */
  errorCode: string | null;
  /**
   * i18n error code of the last failure to share my own position (GPS watch or publishing), or
   * null. Kept apart from `status`: a snapshot of the others' positions sets `connected` and
   * must not hide that my position is no longer published.
   */
  trackingErrorCode: string | null;
  /**
   * true if the user explicitly consented to location sharing for this session (GDPR — separate,
   * non-persisted consent).
   */
  hasSharingConsent: boolean;
}

/**
 * Real-time store actions.
 */
interface RealtimeActions {
  /**
   * Starts a tracking session (resets state).
   *
   * @param sessionId - Session identifier
   */
  startTracking: (sessionId: string) => void;
  /**
   * Sets the connection status.
   *
   * @param status - New status
   * @param errorCode - i18n error code if status='error'
   */
  setStatus: (status: RealtimeConnectionStatus, errorCode?: string | null) => void;
  /**
   * Sets or clears the error on sharing my own position. Leaves the connection status untouched.
   *
   * @param code - i18n error code, or null once a position is published again
   */
  setTrackingError: (code: string | null) => void;
  /**
   * Replaces the live participants list (from the subscribe handler).
   *
   * @param participants - Validated live participants
   */
  setParticipants: (participants: readonly RealtimeParticipant[]) => void;
  /**
   * Records the explicit location-sharing consent (GDPR).
   *
   * @param granted - true if the user accepts
   */
  setSharingConsent: (granted: boolean) => void;
  /**
   * Stops tracking and purges state (positions erased from memory — GDPR).
   */
  stopTracking: () => void;
}

/** Combined store type */
type RealtimeStore = RealtimeState & RealtimeActions;

/** Initial state */
const initialState: RealtimeState = {
  sessionId: null,
  participants: {},
  status: 'idle',
  errorCode: null,
  trackingErrorCode: null,
  hasSharingConsent: false,
};

/**
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

export const useRealtimeStore = create<RealtimeStore>()((set) => ({
  ...initialState,

  startTracking: (sessionId) => {
    set({ ...initialState, sessionId, status: 'connecting' });
    console.log(
      `[INFO][useRealtimeStore][startTracking][?][${timestamp()}] Tracking started for session`,
    );
  },

  setStatus: (status, errorCode = null) => {
    set({ status, errorCode: status === 'error' ? errorCode : null });
  },

  // [FIXED] "Erreur de suivi effacée par le prochain instantané": GPS and publishing errors
  // shared `status` with the subscription, so the next snapshot of the others (`connected`)
  // erased them while my position was no longer published.
  setTrackingError: (code) => {
    set({ trackingErrorCode: code });
  },

  setParticipants: (participants) => {
    const map: Record<string, RealtimeParticipant> = {};
    for (const participant of participants) {
      map[participant.participantId] = participant;
    }
    set({ participants: map });
  },

  setSharingConsent: (granted) => {
    set({ hasSharingConsent: granted });
    console.log(
      `[INFO][useRealtimeStore][setSharingConsent][?][${timestamp()}] ` +
        `Sharing consent: ${granted ? 'granted' : 'revoked'}`,
    );
  },

  stopTracking: () => {
    // Full purge: no position stays in memory (GDPR)
    set({ ...initialState });
    console.log(
      `[INFO][useRealtimeStore][stopTracking][?][${timestamp()}] Tracking stopped, state purged`,
    );
  },
}));

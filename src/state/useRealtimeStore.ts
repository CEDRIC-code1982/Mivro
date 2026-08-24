/**
 * @file useRealtimeStore.ts
 * @description Store Zustand des positions GPS temps réel des participants (F4).
 *              Zustand store of participants' real-time GPS positions (F4).
 *
 *              ⚠️ NON PERSISTÉ volontairement (RGPD) : les positions live ne
 *              doivent JAMAIS survivre au cycle de vie de l'app ni atterrir
 *              dans un storage persistant (MMKV/AsyncStorage). Tout est en
 *              mémoire et perdu au kill de l'app.
 *
 *              ⚠️ NOT persisted intentionally (GDPR): live positions must NEVER
 *              survive the app lifecycle nor land in persistent storage.
 *              Everything is in memory and lost on app kill.
 *
 *              Le store ne fait QUE de l'état : l'orchestration (geoloc →
 *              publish, subscribe → store, consentement) vit dans le hook
 *              useRealtimeTracking. Le store n'importe ni firebase ni le port.
 *              The store is state-only: orchestration lives in the
 *              useRealtimeTracking hook. The store imports neither firebase
 *              nor the port.
 *
 * @module state/useRealtimeStore
 */

// [ADDED] F4 — Store Zustand temps réel (NON persisté, RGPD)
import { create } from 'zustand';
import type { RealtimeParticipant } from '@entities/RealtimeParticipant';

/**
 * Statut de connexion au flux temps réel.
 * Connection status to the real-time stream.
 *
 * - `idle` : aucun suivi actif / no active tracking
 * - `connecting` : abonnement / publication en cours d'établissement / establishing
 * - `connected` : suivi actif, positions reçues / active tracking, positions received
 * - `error` : erreur (voir errorCode) / error (see errorCode)
 */
export type RealtimeConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * État du store temps réel.
 * Real-time store state.
 */
interface RealtimeState {
  /** Session live courante ou null / Current live session id or null */
  sessionId: string | null;
  /** Map participantId → position live / Map participantId → live position */
  participants: Readonly<Record<string, RealtimeParticipant>>;
  /** Statut de connexion / Connection status */
  status: RealtimeConnectionStatus;
  /** Code d'erreur i18n de la dernière erreur, ou null / i18n error code or null */
  errorCode: string | null;
  /**
   * true si l'utilisateur a explicitement consenti au partage de position
   * pour cette session (RGPD — consentement séparé, non persisté).
   * true if the user explicitly consented to location sharing for this
   * session (GDPR — separate, non-persisted consent).
   */
  hasSharingConsent: boolean;
}

/**
 * Actions du store temps réel.
 * Real-time store actions.
 */
interface RealtimeActions {
  /**
   * Démarre une session de suivi (réinitialise l'état).
   * Starts a tracking session (resets state).
   *
   * @param sessionId - Identifiant de la session / Session identifier
   */
  startTracking: (sessionId: string) => void;
  /**
   * Définit le statut de connexion.
   * Sets the connection status.
   *
   * @param status - Nouveau statut / New status
   * @param errorCode - Code d'erreur i18n si status='error' / i18n error code if status='error'
   */
  setStatus: (status: RealtimeConnectionStatus, errorCode?: string | null) => void;
  /**
   * Remplace la liste des participants live (depuis le subscribe).
   * Replaces the live participants list (from the subscribe handler).
   *
   * @param participants - Participants live validés / Validated live participants
   */
  setParticipants: (participants: readonly RealtimeParticipant[]) => void;
  /**
   * Enregistre le consentement explicite de partage de position (RGPD).
   * Records the explicit location-sharing consent (GDPR).
   *
   * @param granted - true si l'utilisateur accepte / true if the user accepts
   */
  setSharingConsent: (granted: boolean) => void;
  /**
   * Arrête le suivi et purge l'état (positions effacées de la mémoire — RGPD).
   * Stops tracking and purges state (positions erased from memory — GDPR).
   */
  stopTracking: () => void;
}

/** Type combiné du store / Combined store type */
type RealtimeStore = RealtimeState & RealtimeActions;

/** État initial / Initial state */
const initialState: RealtimeState = {
  sessionId: null,
  participants: {},
  status: 'idle',
  errorCode: null,
  hasSharingConsent: false,
};

/**
 * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Timestamp formaté / Formatted timestamp
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
    // Purge complète : aucune position ne reste en mémoire (RGPD)
    set({ ...initialState });
    console.log(
      `[INFO][useRealtimeStore][stopTracking][?][${timestamp()}] Tracking stopped, state purged`,
    );
  },
}));

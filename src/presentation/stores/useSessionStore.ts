/**
 * @file useSessionStore.ts
 * @description Session courante de calcul de midpoint avec participants.
 *              Current midpoint calculation session with participants.
 *
 *              ⚠️ NON PERSISTÉ volontairement (RGPD) :
 *              les positions GPS ne doivent pas survivre au cycle de vie
 *              de l'app. Si l'utilisateur force-quit, la session est perdue.
 *
 *              ⚠️ NOT persisted intentionally (GDPR):
 *              GPS positions must not survive the app lifecycle.
 *              If the user force-quits, the session is lost.
 *
 * @module presentation/stores/useSessionStore
 */

// [ADDED] Store Zustand — session courante (NON persisté, RGPD)
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import type { Coordinates } from '@core/entities/Location';
import type { MidpointSession, Participant, SessionStatus } from '@core/entities/MidpointSession';

/**
 * État de la session.
 * Session state.
 */
interface SessionState {
  /** Session courante ou null / Current session or null */
  session: MidpointSession | null;
}

/**
 * Actions de la session.
 * Session actions.
 */
interface SessionActions {
  /**
   * Crée une nouvelle session en statut 'draft'.
   * Creates a new session with 'draft' status.
   */
  createSession: () => void;
  /**
   * Ajoute un participant à la session (max 5).
   * Adds a participant to the session (max 5).
   *
   * @param participant - Données du participant sans id / Participant data without id
   */
  addParticipant: (participant: Omit<Participant, 'id'>) => void;
  /**
   * Retire un participant par son id.
   * Removes a participant by id.
   *
   * @param participantId - UUID du participant / Participant UUID
   */
  removeParticipant: (participantId: string) => void;
  /**
   * Définit le midpoint calculé et passe la session en 'computed'.
   * Sets the computed midpoint and transitions session to 'computed'.
   *
   * @param midpoint - Coordonnées du midpoint / Midpoint coordinates
   * @param radius - Rayon en mètres / Radius in meters
   */
  setMidpoint: (midpoint: Coordinates, radius: number) => void;
  /**
   * Change le statut de la session.
   * Changes the session status.
   *
   * @param status - Nouveau statut / New status
   */
  setStatus: (status: SessionStatus) => void;
  /**
   * Réinitialise la session à null.
   * Resets the session to null.
   */
  resetSession: () => void;
}

/** Type combiné du store / Combined store type */
type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()((set, get) => ({
  session: null,

  createSession: () => {
    const now = new Date().toISOString();
    set({
      session: {
        id: uuidv4(),
        status: 'draft',
        participants: [],
        createdAt: now,
        updatedAt: now,
      },
    });
    console.log(
      `[INFO][useSessionStore][createSession][?][${new Date().toISOString().slice(11, 19)}] ` +
        'New session created',
    );
  },

  addParticipant: (participantData) => {
    const current = get().session;
    if (!current) return;
    if (current.participants.length >= 5) {
      console.warn(
        `[WARN][useSessionStore][addParticipant][?][${new Date().toISOString().slice(11, 19)}] ` +
          'Cannot add more than 5 participants',
      );
      return;
    }
    set({
      session: {
        ...current,
        participants: [...current.participants, { ...participantData, id: uuidv4() }],
        updatedAt: new Date().toISOString(),
      },
    });
  },

  removeParticipant: (participantId) => {
    const current = get().session;
    if (!current) return;
    set({
      session: {
        ...current,
        participants: current.participants.filter((p) => p.id !== participantId),
        updatedAt: new Date().toISOString(),
      },
    });
  },

  setMidpoint: (midpoint, midpointRadius) => {
    const current = get().session;
    if (!current) return;
    set({
      session: {
        ...current,
        midpoint,
        midpointRadius,
        status: 'computed',
        updatedAt: new Date().toISOString(),
      },
    });
  },

  setStatus: (status) => {
    const current = get().session;
    if (!current) return;
    set({
      session: { ...current, status, updatedAt: new Date().toISOString() },
    });
  },

  resetSession: () => {
    set({ session: null });
    console.log(
      `[INFO][useSessionStore][resetSession][?][${new Date().toISOString().slice(11, 19)}] ` +
        'Session reset',
    );
  },
}));

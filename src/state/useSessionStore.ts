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
 * @module state/useSessionStore
 */

// [ADDED] Store Zustand — session courante (NON persisté, RGPD)
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import type { Coordinates } from '@entities/Location';
import type { MidpointSession, Participant, SessionStatus } from '@entities/MidpointSession';
import type { SharedSession } from '@entities/SharedSession'; // [ADDED] F5

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
  /**
   * Charge une session PARTAGÉE (F5) dans la session locale : reconstruit les
   * participants depuis le roster de membres + applique le midpoint recalculé.
   * Bascule la session locale en mode « partagée » (statut 'computed' si un
   * midpoint est présent, sinon 'draft').
   * Loads a SHARED session (F5) into the local session: rebuilds participants
   * from the members roster + applies the recomputed midpoint.
   *
   * @param shared - Session partagée (meta + members) / Shared session
   */
  loadSharedSession: (shared: SharedSession) => void;
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

  // [ADDED] F5 — charge une session partagée dans la session locale
  loadSharedSession: (shared) => {
    const now = new Date().toISOString();
    const participants: Participant[] = shared.members.map((member) => ({
      id: member.memberId,
      displayName: member.displayName,
      ...(member.avatarId !== undefined && { avatarId: member.avatarId }),
      startLocation: {
        // id local synthétique (non persisté) — la session partagée ne porte
        // que lat/lng/adresse par membre (RGPD : minimisation).
        id: uuidv4(),
        coordinates: {
          latitude: member.startLocation.latitude,
          longitude: member.startLocation.longitude,
        },
        formattedAddress: member.startLocation.formattedAddress,
      },
    }));

    const hasMidpoint =
      shared.meta.midpoint !== undefined && shared.meta.midpointRadius !== undefined;

    set({
      session: {
        id: shared.sessionId,
        status: hasMidpoint ? 'computed' : 'draft',
        participants,
        ...(shared.meta.midpoint !== undefined && { midpoint: shared.meta.midpoint }),
        ...(shared.meta.midpointRadius !== undefined && {
          midpointRadius: shared.meta.midpointRadius,
        }),
        createdAt: now,
        updatedAt: now,
      },
    });

    console.log(
      `[INFO][useSessionStore][loadSharedSession][?][${new Date().toISOString().slice(11, 19)}] ` +
        `Shared session loaded | members: ${participants.length}`,
    );
  },
}));

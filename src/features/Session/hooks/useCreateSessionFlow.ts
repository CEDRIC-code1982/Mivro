/**
 * @file useCreateSessionFlow.ts
 * @description Orchestration hook for the F1 feature (session creation).
 *
 *              Responsibilities:
 *              - Initialize the current session on mount
 *              - Expose addByGeocode / addByGPS / removeParticipant
 *              - Validate the state (canContinue: 2-5 points)
 *
 *              Connected to useSessionStore + useAuthStore + DI container.
 *
 * @module features/Session/hooks/useCreateSessionFlow
 */

// [ADDED] useCreateSessionFlow hook — F1 orchestration

import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { GeocodeResult } from '@entities/GeocodeResult';
import type { Participant } from '@entities/MidpointSession';
import { useAuthUser } from '@features/Profile/hooks/useAuth'; // [ADDED] F7 pass 2 — avatarId of the current user
import { type GpsFailureCode, toGpsFailureCode } from '@services/domain/geolocation/gpsFailureCode'; // [MODIFIED] shared GPS failure mapping
import {
  GeolocationError,
  type GeolocationErrorCode,
} from '@services/domain/geolocation/IGeolocationService';
import { getContainer } from '@services/serviceContainer';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore'; // [ADDED] F5

/** Minimum number of participants to continue */
const MIN_PARTICIPANTS = 2;
/** Maximum number of participants */
const MAX_PARTICIPANTS = 5;

/**
 * Maps a GeolocationError code to a typed AddPointError.
 *
 * [MODIFIED] Delegates to the shared `toGpsFailureCode` (also used by the join flow), instead of
 * keeping its own copy of the mapping.
 *
 * @param code - Geolocation error code
 * @returns Typed AddPointError
 */
const mapGeolocationError = (code: GeolocationErrorCode): AddPointError => ({
  code: toGpsFailureCode(code),
});

/**
 * Typed error when adding a point.
 */
export type AddPointError =
  | { code: GpsFailureCode }
  | { code: 'session_full' }
  | { code: 'unknown'; message: string };

/**
 * Non-blocking notice when adding a point (informational, not an error).
 */
export type AddPointNotice =
  /** Point added but address not resolved (offline reverse geocode) */
  { code: 'gps_address_unresolved' };

/**
 * useCreateSessionFlow hook result.
 *
 * @param participants - Participant list
 * @param participantsCount - Participant count
 * @param isFull - true if 5 participants
 * @param canContinue - true if 2-5 participants
 * @param remainingMin - Remaining points to reach the minimum
 * @param isAddingByGps - true if a GPS add is in progress
 * @param gpsError - Last GPS error
 * @param addByGeocode - Add a point via geocode
 * @param addByGps - Add a point via GPS
 * @param removeParticipant - Remove a point
 * @param reset - Reset the session
 */
export interface UseCreateSessionFlowResult {
  /** Participant list */
  participants: readonly Participant[];
  /** Participant count */
  participantsCount: number;
  /** Session full (5 participants) */
  isFull: boolean;
  /** Can continue (2-5 participants) */
  canContinue: boolean;
  /** Remaining points to reach the minimum */
  remainingMin: number;
  /** GPS loading in progress */
  isAddingByGps: boolean;
  /** GPS error from the last action */
  gpsError: AddPointError | null;
  /** Non-blocking notice from the last GPS action */
  gpsNotice: AddPointNotice | null;
  /** Add a point from a geocode result */
  addByGeocode: (result: GeocodeResult, displayName?: string) => void;
  /** Add a point from the current GPS position */
  addByGps: (displayName?: string) => Promise<void>;
  /** Remove a participant */
  removeParticipant: (participantId: string) => void;
  /** Reset the session */
  reset: () => void;
}

/**
 * Orchestration hook for session creation (F1).
 *
 * @returns Hook result
 */
export const useCreateSessionFlow = (): UseCreateSessionFlowResult => {
  // [ADDED] F7 pass 2 — emoji avatar of the current user (set on "my position")
  const currentUser = useAuthUser();

  // [ADDED] Zustand session store selectors
  const session = useSessionStore((s) => s.session);
  const createSession = useSessionStore((s) => s.createSession);
  const addParticipant = useSessionStore((s) => s.addParticipant);
  const removeParticipantStore = useSessionStore((s) => s.removeParticipant);
  const resetSession = useSessionStore((s) => s.resetSession);
  // [ADDED] F5 — GDPR purge of the shared session on reset (stable references).
  const clearShared = useSharedSessionStore((s) => s.clearShared);

  // [ADDED] Local GPS state
  const [isAddingByGps, setIsAddingByGps] = useState(false);
  const [gpsError, setGpsError] = useState<AddPointError | null>(null);
  // [FIXED P1] Non-blocking notice (e.g. address not resolved while offline)
  const [gpsNotice, setGpsNotice] = useState<AddPointNotice | null>(null);

  // [ADDED] Initialize the session if it does not exist
  useEffect(() => {
    if (session === null) {
      createSession();
    }
  }, [session, createSession]);

  // [ADDED] Derived values
  const participants = session?.participants ?? [];
  const participantsCount = participants.length;
  const isFull = participantsCount >= MAX_PARTICIPANTS;
  const canContinue =
    participantsCount >= MIN_PARTICIPANTS && participantsCount <= MAX_PARTICIPANTS;
  const remainingMin = Math.max(0, MIN_PARTICIPANTS - participantsCount);

  /**
   * Generates a default name "Participant N".
   *
   * @returns Generated name
   */
  const generateDefaultName = useCallback((): string => {
    return `Participant ${String(participantsCount + 1)}`;
  }, [participantsCount]);

  /**
   * Adds a point from a geocode result.
   *
   * @param result - Geocode result
   * @param displayName - Optional name
   */
  const addByGeocode = useCallback(
    (result: GeocodeResult, displayName?: string): void => {
      if (isFull) {
        console.warn(
          `[WARN][useCreateSessionFlow][addByGeocode][?][${new Date()
            .toISOString()
            .slice(11, 19)}] ` + `Session is full (max ${String(MAX_PARTICIPANTS)})`,
        );
        return;
      }

      addParticipant({
        displayName: displayName?.trim() || generateDefaultName(),
        startLocation: {
          id: uuidv4(),
          coordinates: result.coordinates,
          formattedAddress: result.displayName,
        },
      });

      console.log(
        `[INFO][useCreateSessionFlow][addByGeocode][?][${new Date()
          .toISOString()
          .slice(11, 19)}] ` +
          `Participant added via geocode | total: ${String(participantsCount + 1)}`,
      );
    },
    [addParticipant, generateDefaultName, isFull, participantsCount],
  );

  /**
   * Adds a point from the current GPS position.
   *
   * @param displayName - Optional name
   * @throws Does not throw — the error is captured in gpsError
   */
  const addByGps = useCallback(
    async (displayName?: string): Promise<void> => {
      if (isFull) {
        setGpsError({ code: 'session_full' });
        return;
      }

      setIsAddingByGps(true);
      setGpsError(null);
      setGpsNotice(null);

      try {
        const { getCurrentLocationUseCase } = getContainer();
        const { location, addressResolved } = await getCurrentLocationUseCase.execute({
          language: 'fr', // TODO V1: use the current i18n language
        });

        // [ADDED] F7 pass 2 — "my position" → carry the current user's emoji avatar on the
        // participant (NOT the photo: the photo stays for the profile).
        // If the user has no avatar, nothing is added (initial fallback on the card side).
        const currentAvatarId = currentUser?.avatarId;
        addParticipant({
          displayName: displayName?.trim() || generateDefaultName(),
          startLocation: location,
          ...(currentAvatarId !== undefined ? { avatarId: currentAvatarId } : {}),
        });

        // [FIXED P1] Address not resolved (offline) → non-blocking notice
        if (!addressResolved) {
          setGpsNotice({ code: 'gps_address_unresolved' });
        }

        console.log(
          `[INFO][useCreateSessionFlow][addByGps][?][${new Date().toISOString().slice(11, 19)}] ` +
            `Participant added via GPS | total: ${String(participantsCount + 1)}`,
        );
      } catch (error: unknown) {
        if (error instanceof GeolocationError) {
          // [ADDED] Map GeolocationError codes → AddPointError
          const mapped = mapGeolocationError(error.code);
          setGpsError(mapped);
        } else {
          setGpsError({
            code: 'unknown',
            message: error instanceof Error ? error.message : String(error),
          });
        }

        console.error(
          `[ERROR][useCreateSessionFlow][addByGps][?][${new Date().toISOString().slice(11, 19)}] ` +
            'Failed to add by GPS',
          error,
        );
      } finally {
        setIsAddingByGps(false);
      }
    },
    [addParticipant, generateDefaultName, isFull, participantsCount, currentUser?.avatarId],
  );

  /**
   * Removes a participant by id.
   *
   * @param participantId - Participant UUID
   */
  const removeParticipant = useCallback(
    (participantId: string): void => {
      removeParticipantStore(participantId);
    },
    [removeParticipantStore],
  );

  /**
   * Resets the session and errors.
   *
   * [MAJEUR 2 — GDPR] If the session was SHARED and this device is its OWNER, the shared node is
   * deleted on the backend (`deleteSharedSession`) BEFORE purging the local shared state
   * (`clearShared`). A plain member (join) does not delete the others' session: it only leaves
   * shared mode. The backend deletion is best-effort (try/catch): a network failure must not
   * block the local reset.
   */
  const reset = useCallback((): void => {
    const { isShared, isOwner, sessionId } = useSharedSessionStore.getState();
    if (isShared && isOwner && sessionId !== null) {
      const { sessionShareService } = getContainer();
      // try/catch through .catch: best-effort deletion, does not block the reset.
      sessionShareService.deleteSharedSession(sessionId).catch((error: unknown) => {
        console.error(
          `[ERROR][useCreateSessionFlow][reset][?][${new Date().toISOString().slice(11, 19)}] ` +
            'Failed to delete shared session (GDPR best-effort)',
          error,
        );
      });
    }
    if (isShared) {
      clearShared();
    }
    resetSession();
    setGpsError(null);
    setGpsNotice(null);
  }, [resetSession, clearShared]);

  return {
    participants,
    participantsCount,
    isFull,
    canContinue,
    remainingMin,
    isAddingByGps,
    gpsError,
    gpsNotice,
    addByGeocode,
    addByGps,
    removeParticipant,
    reset,
  };
};

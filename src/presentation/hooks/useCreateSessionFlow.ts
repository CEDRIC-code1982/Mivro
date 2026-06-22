/**
 * @file useCreateSessionFlow.ts
 * @description Hook d'orchestration pour la feature F1 (création de session).
 *              Orchestration hook for the F1 feature (session creation).
 *
 *              Responsabilités / Responsibilities:
 *              - Initialiser la session courante au mount / Initialize session on mount
 *              - Exposer addByGeocode / addByGPS / removeParticipant
 *              - Valider l'état (canContinue : 2-5 points) / Validate state
 *
 *              Connecté à useSessionStore + useAuthStore + container DI.
 *              Connected to useSessionStore + useAuthStore + DI container.
 *
 * @module presentation/hooks/useCreateSessionFlow
 */

// [ADDED] Hook useCreateSessionFlow — orchestration F1

import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getContainer } from '@/di/container';
import type { GeocodeResult } from '@core/entities/GeocodeResult';
import type { Participant } from '@core/entities/MidpointSession';
import { GeolocationError, type GeolocationErrorCode } from '@core/ports/IGeolocationService';
import { useAuthUser } from '@presentation/hooks/useAuth'; // [ADDED] F7 passe 2 — avatarId du user courant
import { useSessionStore } from '@presentation/stores/useSessionStore';

/** Nombre minimum de participants pour continuer / Minimum participants to continue */
const MIN_PARTICIPANTS = 2;
/** Nombre maximum de participants / Maximum participants */
const MAX_PARTICIPANTS = 5;

/**
 * Mappe un code d'erreur GeolocationError vers un AddPointError typé.
 * Maps a GeolocationError code to a typed AddPointError.
 *
 * @param code - Code d'erreur de géolocalisation / Geolocation error code
 * @returns AddPointError typé / Typed AddPointError
 */
const mapGeolocationError = (code: GeolocationErrorCode): AddPointError => {
  switch (code) {
    case 'permission_denied':
    case 'permission_blocked':
      return { code: 'gps_permission_denied' };
    case 'unavailable':
      return { code: 'gps_unavailable' };
    case 'timeout':
      return { code: 'gps_timeout' };
    case 'inaccurate':
      return { code: 'gps_inaccurate' };
    case 'unknown':
      return { code: 'gps_unknown' };
  }
};

/**
 * Erreur typée lors de l'ajout d'un point.
 * Typed error when adding a point.
 */
export type AddPointError =
  | { code: 'gps_permission_denied' }
  | { code: 'gps_unavailable' }
  | { code: 'gps_timeout' }
  | { code: 'gps_inaccurate' }
  | { code: 'gps_unknown' }
  | { code: 'session_full' }
  | { code: 'unknown'; message: string };

/**
 * Notice non-bloquante lors de l'ajout d'un point (information, pas erreur).
 * Non-blocking notice when adding a point (informational, not an error).
 */
export type AddPointNotice =
  /** Point ajouté mais adresse non résolue (reverse geocode hors ligne) */
  { code: 'gps_address_unresolved' };

/**
 * Résultat du hook useCreateSessionFlow.
 * useCreateSessionFlow hook result.
 *
 * @param participants - Liste des participants / Participant list
 * @param participantsCount - Nombre de participants / Participant count
 * @param isFull - true si 5 participants / true if 5 participants
 * @param canContinue - true si 2-5 participants / true if 2-5 participants
 * @param remainingMin - Points manquants pour le minimum / Remaining to reach minimum
 * @param isAddingByGps - true si ajout GPS en cours / true if GPS add in progress
 * @param gpsError - Dernière erreur GPS / Last GPS error
 * @param addByGeocode - Ajoute un point via geocode / Add point via geocode
 * @param addByGps - Ajoute un point via GPS / Add point via GPS
 * @param removeParticipant - Supprime un point / Remove a point
 * @param reset - Réinitialise la session / Reset the session
 */
export interface UseCreateSessionFlowResult {
  /** Liste des participants / Participant list */
  participants: readonly Participant[];
  /** Nombre de participants / Participant count */
  participantsCount: number;
  /** Session pleine (5 participants) / Session full (5 participants) */
  isFull: boolean;
  /** Peut continuer (2-5 participants) / Can continue (2-5 participants) */
  canContinue: boolean;
  /** Points manquants pour atteindre le minimum / Remaining to reach minimum */
  remainingMin: number;
  /** Chargement GPS en cours / GPS loading in progress */
  isAddingByGps: boolean;
  /** Erreur GPS de la dernière action / GPS error from last action */
  gpsError: AddPointError | null;
  /** Notice non-bloquante de la dernière action GPS / Non-blocking notice from last GPS action */
  gpsNotice: AddPointNotice | null;
  /** Ajoute un point via résultat de geocode / Add point from geocode result */
  addByGeocode: (result: GeocodeResult, displayName?: string) => void;
  /** Ajoute un point via position GPS courante / Add point from current GPS position */
  addByGps: (displayName?: string) => Promise<void>;
  /** Supprime un participant / Remove a participant */
  removeParticipant: (participantId: string) => void;
  /** Réinitialise la session / Reset session */
  reset: () => void;
}

/**
 * Hook d'orchestration pour la création de session (F1).
 * Orchestration hook for session creation (F1).
 *
 * @returns Résultat du hook / Hook result
 */
export const useCreateSessionFlow = (): UseCreateSessionFlowResult => {
  // [ADDED] F7 passe 2 — avatar emoji du user courant (peuplé sur « ma position »)
  const currentUser = useAuthUser();

  // [ADDED] Sélecteurs Zustand session store
  const session = useSessionStore((s) => s.session);
  const createSession = useSessionStore((s) => s.createSession);
  const addParticipant = useSessionStore((s) => s.addParticipant);
  const removeParticipantStore = useSessionStore((s) => s.removeParticipant);
  const resetSession = useSessionStore((s) => s.resetSession);

  // [ADDED] État local GPS
  const [isAddingByGps, setIsAddingByGps] = useState(false);
  const [gpsError, setGpsError] = useState<AddPointError | null>(null);
  // [FIXED P1] Notice non-bloquante (ex: adresse non résolue hors ligne)
  const [gpsNotice, setGpsNotice] = useState<AddPointNotice | null>(null);

  // [ADDED] Initialiser la session si elle n'existe pas
  useEffect(() => {
    if (session === null) {
      createSession();
    }
  }, [session, createSession]);

  // [ADDED] Valeurs dérivées
  const participants = session?.participants ?? [];
  const participantsCount = participants.length;
  const isFull = participantsCount >= MAX_PARTICIPANTS;
  const canContinue =
    participantsCount >= MIN_PARTICIPANTS && participantsCount <= MAX_PARTICIPANTS;
  const remainingMin = Math.max(0, MIN_PARTICIPANTS - participantsCount);

  /**
   * Génère un nom par défaut "Participant N".
   * Generates a default name "Participant N".
   *
   * @returns Nom généré / Generated name
   */
  const generateDefaultName = useCallback((): string => {
    return `Participant ${String(participantsCount + 1)}`;
  }, [participantsCount]);

  /**
   * Ajoute un point à partir d'un résultat de geocode.
   * Adds a point from a geocode result.
   *
   * @param result - Résultat de geocode / Geocode result
   * @param displayName - Nom optionnel / Optional name
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
   * Ajoute un point à partir de la position GPS courante.
   * Adds a point from the current GPS position.
   *
   * @param displayName - Nom optionnel / Optional name
   * @throws Ne throw pas — l'erreur est capturée dans gpsError / Does not throw — error captured in gpsError
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
          language: 'fr', // TODO V1 : utiliser la langue courante de i18n
        });

        // [ADDED] F7 passe 2 — « ma position » → on porte l'avatar emoji du user
        // courant sur le participant (PAS la photo : la photo reste pour le profil).
        // Si l'user n'a pas d'avatar, on n'ajoute rien (fallback initiale côté card).
        const currentAvatarId = currentUser?.avatarId;
        addParticipant({
          displayName: displayName?.trim() || generateDefaultName(),
          startLocation: location,
          ...(currentAvatarId !== undefined ? { avatarId: currentAvatarId } : {}),
        });

        // [FIXED P1] Adresse non résolue (hors ligne) → notice non-bloquante
        if (!addressResolved) {
          setGpsNotice({ code: 'gps_address_unresolved' });
        }

        console.log(
          `[INFO][useCreateSessionFlow][addByGps][?][${new Date().toISOString().slice(11, 19)}] ` +
            `Participant added via GPS | total: ${String(participantsCount + 1)}`,
        );
      } catch (error: unknown) {
        if (error instanceof GeolocationError) {
          // [ADDED] Mapper les codes GeolocationError → AddPointError
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
   * Supprime un participant par son id.
   * Removes a participant by id.
   *
   * @param participantId - UUID du participant / Participant UUID
   */
  const removeParticipant = useCallback(
    (participantId: string): void => {
      removeParticipantStore(participantId);
    },
    [removeParticipantStore],
  );

  /**
   * Réinitialise la session et les erreurs.
   * Resets the session and errors.
   */
  const reset = useCallback((): void => {
    resetSession();
    setGpsError(null);
    setGpsNotice(null);
  }, [resetSession]);

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

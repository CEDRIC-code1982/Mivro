/**
 * @file useSessionShare.ts
 * @description Hook d'orchestration du partage de session (F5).
 *              Session sharing orchestration hook (F5).
 *
 *              Expose deux flux / Exposes two flows:
 *              - `share()` : publie la session locale (ShareSessionUseCase),
 *                marque le store partagé, et ouvre la **share sheet native**
 *                (`Share` de react-native).
 *              - `join(sessionId)` : rejoint une session partagée
 *                (JoinSessionUseCase) en ajoutant l'utilisateur courant comme
 *                membre + recalcul du midpoint, puis charge la session dans le
 *                store local (mode « partagé »).
 *
 *              La présentation passe par les use cases via le container DI : elle
 *              n'importe JAMAIS firebase (règle de dépendance).
 *              Presentation goes through use cases via the DI container: it
 *              NEVER imports firebase (dependency rule).
 *
 * @module presentation/hooks/useSessionShare
 */

// [ADDED] F5 — Hook d'orchestration useSessionShare
import { useCallback, useState } from 'react';
import { Share } from 'react-native';
import { getContainer } from '@/di/container';
import type { SharedSessionMember, SharedSessionOwnerType } from '@core/entities/SharedSession';
import { buildShareLink } from '@core/entities/SharedSession';
import type { User } from '@core/entities/User';
import { SessionShareError } from '@core/ports/ISessionShareService';
import { useAuthStore } from '@presentation/stores/useAuthStore';
import { useSessionStore } from '@presentation/stores/useSessionStore';
import { useSharedSessionStore } from '@presentation/stores/useSharedSessionStore';

/**
 * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Timestamp formaté / Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/**
 * Mappe une erreur en code i18n (namespace share.errors.*).
 * Maps an error to an i18n code (namespace share.errors.*).
 *
 * @param error - Erreur à mapper / Error to map
 * @returns Code d'erreur i18n / i18n error code
 */
const toErrorCode = (error: unknown): string => {
  if (error instanceof SessionShareError) return error.code;
  return 'unknown';
};

/**
 * Déduit le type de propriétaire depuis l'utilisateur courant.
 * Derives the owner type from the current user.
 *
 * @param user - Utilisateur courant ou null / Current user or null
 * @returns 'account' si authentifié, 'guest' sinon / 'account' if authenticated else 'guest'
 */
const ownerTypeFromUser = (user: User | null): SharedSessionOwnerType =>
  user?.type === 'authenticated' ? 'account' : 'guest';

/**
 * Construit un membre de session partagée à partir de l'utilisateur courant et
 * de son point de départ dans la session locale.
 * Builds a shared session member from the current user and their start location.
 *
 * Le point de départ provient du participant local correspondant à l'id de
 * l'utilisateur (« ma position », créée en F1) ; à défaut, du seul participant
 * local s'il n'y en a qu'un (cas invité fraîchement arrivé via le lien).
 * The start location comes from the local participant matching the user id;
 * otherwise the single local participant if there is exactly one.
 *
 * @param user - Utilisateur courant / Current user
 * @returns Membre, ou null si aucun point de départ connu / Member, or null
 */
const buildMemberFromUser = (user: User): SharedSessionMember | null => {
  const session = useSessionStore.getState().session;
  const participants = session?.participants ?? [];
  const mine =
    participants.find((p) => p.id === user.id) ??
    (participants.length === 1 ? participants[0] : undefined);
  if (mine === undefined) {
    return null;
  }
  return {
    memberId: user.id,
    displayName: user.displayName,
    ...(user.avatarId !== undefined && { avatarId: user.avatarId }),
    startLocation: {
      latitude: mine.startLocation.coordinates.latitude,
      longitude: mine.startLocation.coordinates.longitude,
      formattedAddress: mine.startLocation.formattedAddress,
    },
  };
};

/**
 * Résultat du hook useSessionShare.
 * useSessionShare hook result.
 */
export interface UseSessionShareResult {
  /**
   * Publie la session locale et ouvre la share sheet native.
   * Publishes the local session and opens the native share sheet.
   *
   * @param shareMessage - Message localisé (avec le lien interpolé) / Localized message
   * @returns Le lien généré, ou null en cas d'erreur / The generated link, or null on error
   */
  share: (shareMessage?: (link: string) => string) => Promise<string | null>;
  /**
   * Rejoint une session partagée (ajoute l'utilisateur + recalcul midpoint).
   * Joins a shared session (adds the user + recomputes midpoint).
   *
   * @param sessionId - Identifiant de la session (extrait du lien) / Session id
   * @returns true si la jointure a réussi / true if the join succeeded
   */
  join: (sessionId: string) => Promise<boolean>;
  /** true si une opération est en cours / true while an operation is in progress */
  isBusy: boolean;
  /** Code d'erreur i18n de la dernière opération, ou null / i18n error code or null */
  errorCode: string | null;
}

/**
 * Hook d'orchestration du partage de session collaboratif.
 * Collaborative session sharing orchestration hook.
 *
 * @returns Actions share / join + état isBusy / errorCode
 */
export const useSessionShare = (): UseSessionShareResult => {
  const [isBusy, setIsBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const localSession = useSessionStore((s) => s.session);
  const loadSharedSession = useSessionStore((s) => s.loadSharedSession);
  const setShared = useSharedSessionStore((s) => s.setShared);
  const setStatus = useSharedSessionStore((s) => s.setStatus);
  const syncFromRemote = useSharedSessionStore((s) => s.syncFromRemote);

  const share = useCallback(
    async (shareMessage?: (link: string) => string): Promise<string | null> => {
      const session = localSession;
      if (session === null || session.participants.length < 2) {
        setErrorCode('unknown');
        return null;
      }

      setIsBusy(true);
      setErrorCode(null);
      setStatus('creating');

      try {
        const ownerType = ownerTypeFromUser(useAuthStore.getState().user);
        const { shareSessionUseCase } = getContainer();
        const result = await shareSessionUseCase.execute({ session, ownerType });

        setShared(result.sessionId, result.link, true); // propriétaire (create)
        setStatus('synced');

        // Ouvre la share sheet native (message localisé fourni par l'écran).
        const message = shareMessage ? shareMessage(result.link) : result.link;
        await Share.share({ message, url: result.link });

        console.log(
          `[INFO][useSessionShare][share][?][${timestamp()}] Share sheet opened for session`,
        );
        return result.link;
      } catch (error: unknown) {
        const code = toErrorCode(error);
        setErrorCode(code);
        setStatus('error', code);
        console.error(
          `[ERROR][useSessionShare][share][?][${timestamp()}] Share failed | code: ${code}`,
        );
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [localSession, setShared, setStatus],
  );

  const join = useCallback(
    async (sessionId: string): Promise<boolean> => {
      setIsBusy(true);
      setErrorCode(null);
      setStatus('joining');

      try {
        const user = useAuthStore.getState().user;
        if (user === null) {
          setErrorCode('no_user');
          setStatus('error', 'no_user');
          return false;
        }

        const member = buildMemberFromUser(user);
        if (member === null) {
          // Aucun point de départ connu pour l'utilisateur courant.
          setErrorCode('no_location');
          setStatus('error', 'no_location');
          return false;
        }

        const { joinSessionUseCase } = getContainer();
        const shared = await joinSessionUseCase.execute({ sessionId, member });

        // Bascule la session locale en mode « partagée » + state partagé.
        loadSharedSession(shared);
        setShared(shared.sessionId, buildShareLink(shared.sessionId), false); // membre (join)
        syncFromRemote(shared.meta, shared.members);

        console.log(`[INFO][useSessionShare][join][?][${timestamp()}] Joined shared session`);
        return true;
      } catch (error: unknown) {
        const code = toErrorCode(error);
        setErrorCode(code);
        setStatus('error', code);
        console.error(
          `[ERROR][useSessionShare][join][?][${timestamp()}] Join failed | code: ${code}`,
        );
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [loadSharedSession, setShared, setStatus, syncFromRemote],
  );

  return { share, join, isBusy, errorCode };
};

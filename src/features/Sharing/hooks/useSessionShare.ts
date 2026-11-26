/**
 * @file useSessionShare.ts
 * @description Session sharing orchestration hook (F5).
 *
 *              Exposes two flows:
 *              - `share()`: publishes the local session (ShareSessionUseCase),
 *                marks the shared store, and opens the **native share sheet**
 *                (react-native `Share`). A session that is already shared is
 *                not published again: its existing link is shared.
 *              - `join(sessionId, startLocation)`: joins a shared session
 *                (JoinSessionUseCase) by adding the current user as a
 *                member + recomputing the midpoint, then loads the session into
 *                the local store ("shared" mode). The start location is chosen
 *                on the join screen; a device without a profile gets a guest
 *                profile first (ADR-004, guest-first).
 *
 *              Presentation goes through use cases via the DI container: it
 *              NEVER imports firebase (dependency rule).
 *
 * @module features/Sharing/hooks/useSessionShare
 */

// [ADDED] F5 — useSessionShare orchestration hook
import { useCallback, useState } from 'react';
import { Share } from 'react-native';
import type { Location } from '@entities/Location'; // [ADDED] start point chosen at join time
import type { SharedSessionMember, SharedSessionOwnerType } from '@entities/SharedSession';
import { buildShareLink } from '@entities/SharedSession';
import type { User } from '@entities/User';
import { SessionShareError } from '@services/domain/sharing/ISessionShareService';
import { getContainer } from '@services/serviceContainer';
import { useAuthStore } from '@state/useAuthStore';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore';

/**
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/**
 * Maps an error to an i18n code (namespace share.errors.*).
 *
 * @param error - Error to map
 * @returns i18n error code
 */
const toErrorCode = (error: unknown): string => {
  if (error instanceof SessionShareError) return error.code;
  return 'unknown';
};

/**
 * Derives the owner type from the current user.
 *
 * @param user - Current user or null
 * @returns 'account' if authenticated, 'guest' otherwise
 */
const ownerTypeFromUser = (user: User | null): SharedSessionOwnerType =>
  user?.type === 'authenticated' ? 'account' : 'guest';

/**
 * Returns the link of the local session when it is already shared (published by this device, or
 * joined through a link), or null when it still has to be published.
 *
 * @param localSessionId - Id of the local session
 * @returns The existing share link, or null
 */
const existingShareLink = (localSessionId: string): string | null => {
  const { isShared, sessionId, link } = useSharedSessionStore.getState();
  return isShared && sessionId === localSessionId ? link : null;
};

/**
 * Builds a shared session member from the current user and the start location they chose on the
 * join screen.
 *
 * [MODIFIED] "Jonction d'un invité sans profil ni session": the start location used to be read
 * from the local session (the participant matching the user id, or the single participant). A new
 * user who opens an invitation link has no local session, so the join always failed with
 * `no_location`. The start location is now passed explicitly, and the local session is not read.
 *
 * @param user - Current user
 * @param startLocation - Start location chosen at join time
 * @returns The member to publish
 */
const buildMemberFromUser = (user: User, startLocation: Location): SharedSessionMember => ({
  memberId: user.id,
  displayName: user.displayName,
  ...(user.avatarId !== undefined && { avatarId: user.avatarId }),
  startLocation: {
    latitude: startLocation.coordinates.latitude,
    longitude: startLocation.coordinates.longitude,
    formattedAddress: startLocation.formattedAddress,
  },
});

/**
 * Returns the current user, creating a guest profile first when the device has none (ADR-004,
 * guest-first): a new user who opens an invitation link must be able to join without signing up.
 *
 * @returns The current user, or null if the guest profile could not be created
 */
const ensureUser = (): User | null => {
  const { user, signInAsGuest } = useAuthStore.getState();
  if (user !== null) return user;
  signInAsGuest();
  return useAuthStore.getState().user;
};

/**
 * useSessionShare hook result.
 */
export interface UseSessionShareResult {
  /**
   * Publishes the local session (unless it is already shared) and opens the native share sheet.
   *
   * @param shareMessage - Localized message builder (with the link interpolated)
   * @returns The share link, or null on error
   */
  share: (shareMessage?: (link: string) => string) => Promise<string | null>;
  /**
   * Joins a shared session (adds the user + recomputes the midpoint). Creates a guest profile
   * first when the device has none (ADR-004).
   *
   * @param sessionId - Session identifier (extracted from the link)
   * @param startLocation - Start location chosen on the join screen (GPS or address)
   * @returns true if the join succeeded
   */
  join: (sessionId: string, startLocation: Location) => Promise<boolean>;
  /** true while an operation is in progress */
  isBusy: boolean;
  /** i18n error code of the last operation, or null */
  errorCode: string | null;
}

/**
 * Collaborative session sharing orchestration hook.
 *
 * @returns share / join actions + isBusy / errorCode state
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
        // [FIXED] The guard set the hook's errorCode only: the shared store kept its previous
        // status, unlike every other share() failure.
        setErrorCode('unknown');
        setStatus('error', 'unknown');
        return null;
      }

      setIsBusy(true);
      setErrorCode(null);

      try {
        // [FIXED] "Re-partage d'une session déjà partagée → erreur affichée à tort": a second
        // press on "Partager" published the session again; the RTDB rules refuse to recreate an
        // existing session (meta exists, createdAt is immutable), so a working session showed a
        // share failure. An already shared session reuses its link, without writing to the base.
        let link = existingShareLink(session.id);
        if (link === null) {
          // [FIXED] "Session supprimée republiée par un invité": a local copy of a shared session
          // outlives the remote node (deleted by its owner or purged at expiry). Publishing it
          // again would recreate the session under the same id, with the other members' start
          // addresses and a fresh TTL. An ended shared session is never published again.
          if (session.isSharedCopy === true) {
            throw new SessionShareError('Shared session has ended', 'closed');
          }
          setStatus('creating');
          const ownerType = ownerTypeFromUser(useAuthStore.getState().user);
          const { shareSessionUseCase } = getContainer();
          const result = await shareSessionUseCase.execute({ session, ownerType });

          setShared(result.sessionId, result.link, true); // owner (create)
          setStatus('synced');
          link = result.link;
        }

        // Open the native share sheet (localized message provided by the screen).
        const message = shareMessage ? shareMessage(link) : link;
        await Share.share({ message, url: link });

        console.log(
          `[INFO][useSessionShare][share][?][${timestamp()}] Share sheet opened for session`,
        );
        return link;
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
    async (sessionId: string, startLocation: Location): Promise<boolean> => {
      setIsBusy(true);
      setErrorCode(null);
      setStatus('joining');

      try {
        // [MODIFIED] A device without a profile gets a guest profile instead of `no_user`.
        // `no_user` stays as a defensive guard, should the guest creation leave no user.
        const user = ensureUser();
        if (user === null) {
          setErrorCode('no_user');
          setStatus('error', 'no_user');
          return false;
        }

        const member = buildMemberFromUser(user, startLocation);

        const { joinSessionUseCase } = getContainer();
        const shared = await joinSessionUseCase.execute({ sessionId, member });

        // Switch the local session to "shared" mode + shared state.
        loadSharedSession(shared);
        setShared(shared.sessionId, buildShareLink(shared.sessionId), false); // member (join)
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

/**
 * @file useSharedSessionSync.ts
 * @description Orchestration hook for the LIVE synchronization of a shared
 *              session (F5). Wires the real-time RTDB subscription to the UI.
 *
 *              While the local session is in "shared" mode
 *              (`useSharedSessionStore.isShared`), subscribes to
 *              `ISessionShareService.subscribeToSharedSession(sessionId)` through the
 *              DI container and, on every remote update:
 *              - mirrors meta + roster into `useSharedSessionStore.syncFromRemote`
 *              - rebuilds the local session (participants + midpoint recomputed
 *                live) through `useSessionStore.loadSharedSession`
 *              - if the node disappears (null → deleted by the owner/TTL), purges the
 *                shared state (GDPR). [MODIFIED] On a member's device, the local copy of
 *                the session is purged too and the screen is told through
 *                `onEndedRemotely`; on the owner's device, only the shared state is
 *                purged (the owner ended the session itself).
 *
 *              **Unsubscribes** on unmount AND on any sessionId change
 *              (effect cleanup) → no subscription leak.
 *
 *              Presentation goes through the port via the container: it NEVER
 *              imports firebase (dependency rule).
 *
 *              ⚠️ Zustand v5: select STABLE references (booleans, string, actions)
 *              — never a derived value recreated on every render — to avoid render
 *              loops (useSyncExternalStore + Object.is).
 *
 * @module features/Sharing/hooks/useSharedSessionSync
 */

// [ADDED] F5 — Orchestration hook for the live sync of a shared session
import { useEffect, useRef } from 'react';
import { getContainer } from '@services/serviceContainer';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore';

/**
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/**
 * Options of useSharedSessionSync.
 */
export interface UseSharedSessionSyncOptions {
  /**
   * Called on a member's device (not the owner's) once the shared session has been removed
   * remotely (ended by its owner, or purged at expiry), after the shared state and the local copy
   * of the session have been purged. Not called on the owner's device.
   */
  onEndedRemotely?: () => void;
}

/**
 * Subscribes to the shared session while shared mode is active and propagates
 * every remote update into the stores (live).
 *
 * Call once from the map screen (MapScreen). The hook is inert while the
 * session is not shared.
 *
 * [MODIFIED] "Fin de session côté invité": when the remote node disappears on a member's device,
 * the local copy of the session (with the other members' start addresses) used to stay on the
 * device, with nothing telling the guest. It is now purged (`resetSession`), and
 * `onEndedRemotely` lets the screen stop the tracking and inform the guest.
 *
 * @param options - Optional callbacks (see {@link UseSharedSessionSyncOptions})
 */
export const useSharedSessionSync = (options?: UseSharedSessionSyncOptions): void => {
  // STABLE references only (Zustand v5) — no derived value.
  const isShared = useSharedSessionStore((s) => s.isShared);
  const sessionId = useSharedSessionStore((s) => s.sessionId);
  const syncFromRemote = useSharedSessionStore((s) => s.syncFromRemote);
  const clearShared = useSharedSessionStore((s) => s.clearShared);
  const loadSharedSession = useSessionStore((s) => s.loadSharedSession);
  const resetSession = useSessionStore((s) => s.resetSession); // [ADDED]

  // [ADDED] Latest callback kept in a ref: a new callback on every render must not re-subscribe.
  const onEndedRemotelyRef = useRef(options?.onEndedRemotely);
  useEffect(() => {
    onEndedRemotelyRef.current = options?.onEndedRemotely;
  }, [options?.onEndedRemotely]);

  useEffect(() => {
    // Inert while not in shared mode with an id.
    if (!isShared || sessionId === null) {
      return undefined;
    }

    const { sessionShareService } = getContainer();
    // [FIXED] Role captured when the effect subscribes, NOT when the removal arrives:
    // `useCreateSessionFlow.reset` calls `clearShared()` (isOwner → false) BEFORE RNFirebase
    // delivers the null event, so a late read would treat the owner as a member (stop() + alert
    // on its own device). `setShared` sets `isOwner` together with `sessionId`, which is already
    // a dependency of this effect, so a role change always comes with a re-subscription.
    const { isOwner } = useSharedSessionStore.getState();

    const unsubscribe = sessionShareService.subscribeToSharedSession(sessionId, (shared) => {
      if (shared === null) {
        // The node disappeared (deleted by the owner / TTL purge) → GDPR.
        console.log(
          `[INFO][useSharedSessionSync][onUpdate][?][${timestamp()}] ` +
            `Shared session removed remotely — clearing shared state | owner: ${String(isOwner)}`,
        );
        clearShared();
        if (isOwner) {
          // The owner ended the session itself: `useCreateSessionFlow.reset` deletes the node and
          // then empties its own session. Nothing else to do, and nothing to tell.
          return;
        }
        // [ADDED] Member: the local copy holds the other members' start addresses → purge it,
        // then let the screen react (stop tracking, inform the guest).
        resetSession();
        onEndedRemotelyRef.current?.();
        return;
      }
      // Mirror meta + roster (shared store) then rebuild the local session
      // (participants + midpoint recomputed live).
      syncFromRemote(shared.meta, shared.members);
      loadSharedSession(shared);
    });

    console.log(
      `[INFO][useSharedSessionSync][subscribe][?][${timestamp()}] Subscribed to shared session`,
    );

    // Unsubscribe on unmount AND on any sessionId change.
    return () => {
      unsubscribe();
      console.log(
        `[INFO][useSharedSessionSync][cleanup][?][${timestamp()}] Unsubscribed from shared session`,
      );
    };
  }, [isShared, sessionId, syncFromRemote, clearShared, loadSharedSession, resetSession]);
};

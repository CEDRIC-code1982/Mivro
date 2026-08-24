/**
 * @file useSharedSessionSync.ts
 * @description Hook d'orchestration de la synchronisation LIVE d'une session
 *              partagée (F5). Branche l'abonnement RTDB temps réel sur la
 *              présentation.
 *              Orchestration hook for the LIVE synchronization of a shared
 *              session (F5). Wires the real-time RTDB subscription to the UI.
 *
 *              Tant que la session locale est en mode « partagé »
 *              (`useSharedSessionStore.isShared`), s'abonne à
 *              `ISessionShareService.subscribeToSharedSession(sessionId)` via le
 *              container DI et, à chaque mise à jour distante :
 *              - reflète meta + roster dans `useSharedSessionStore.syncFromRemote`
 *              - reconstruit la session locale (participants + midpoint recalculé
 *                en direct) via `useSessionStore.loadSharedSession`
 *              - si le nœud disparaît (null → supprimé par le propriétaire/TTL),
 *                purge l'état partagé (RGPD).
 *
 *              **Désabonnement** au démontage ET à tout changement de sessionId
 *              (cleanup de l'effet) → pas de fuite d'abonnement.
 *
 *              La présentation passe par le port via le container : elle
 *              n'importe JAMAIS firebase (règle de dépendance).
 *              Presentation goes through the port via the container: it NEVER
 *              imports firebase (dependency rule).
 *
 *              ⚠️ Zustand v5 : on sélectionne des références STABLES (booléens,
 *              string, actions) — jamais un dérivé recréé à chaque rendu — pour
 *              éviter les boucles de rendu (useSyncExternalStore + Object.is).
 *
 * @module features/Sharing/hooks/useSharedSessionSync
 */

// [ADDED] F5 — Hook d'orchestration de la synchro live de session partagée
import { useEffect } from 'react';
import { getContainer } from '@services/serviceContainer';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore';

/**
 * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Timestamp formaté / Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/**
 * S'abonne à la session partagée tant que le mode « partagé » est actif et
 * propage chaque mise à jour distante dans les stores (live).
 * Subscribes to the shared session while shared mode is active and propagates
 * every remote update into the stores (live).
 *
 * À appeler une fois depuis l'écran carte (MapScreen). Le hook est inerte tant
 * que la session n'est pas partagée.
 * Call once from the map screen. The hook is inert while not shared.
 *
 */
export const useSharedSessionSync = (): void => {
  // Références STABLES uniquement (Zustand v5) — pas de dérivé recréé.
  const isShared = useSharedSessionStore((s) => s.isShared);
  const sessionId = useSharedSessionStore((s) => s.sessionId);
  const syncFromRemote = useSharedSessionStore((s) => s.syncFromRemote);
  const clearShared = useSharedSessionStore((s) => s.clearShared);
  const loadSharedSession = useSessionStore((s) => s.loadSharedSession);

  useEffect(() => {
    // Inerte tant qu'on n'est pas en mode partagé avec un id.
    if (!isShared || sessionId === null) {
      return undefined;
    }

    const { sessionShareService } = getContainer();

    const unsubscribe = sessionShareService.subscribeToSharedSession(sessionId, (shared) => {
      if (shared === null) {
        // Le nœud a disparu (supprimé par le propriétaire / purge TTL) → RGPD.
        console.log(
          `[INFO][useSharedSessionSync][onUpdate][?][${timestamp()}] ` +
            'Shared session removed remotely — clearing shared state',
        );
        clearShared();
        return;
      }
      // Reflète meta + roster (store partagé) puis recompose la session locale
      // (participants + midpoint recalculé en direct).
      syncFromRemote(shared.meta, shared.members);
      loadSharedSession(shared);
    });

    console.log(
      `[INFO][useSharedSessionSync][subscribe][?][${timestamp()}] Subscribed to shared session`,
    );

    // Désabonnement au démontage ET à tout changement de sessionId.
    return () => {
      unsubscribe();
      console.log(
        `[INFO][useSharedSessionSync][cleanup][?][${timestamp()}] Unsubscribed from shared session`,
      );
    };
  }, [isShared, sessionId, syncFromRemote, clearShared, loadSharedSession]);
};

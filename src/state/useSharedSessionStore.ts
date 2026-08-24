/**
 * @file useSharedSessionStore.ts
 * @description Store Zustand de la session PARTAGÉE synchronisée Firebase (F5).
 *              Zustand store of the Firebase-synchronized SHARED session (F5).
 *
 *              Distinct de `useSessionStore` (session locale de calcul) et de
 *              `useRealtimeStore` (positions live F4). Porte l'état du mode
 *              « partagé » : drapeau `isShared`, sessionId partagé, meta et
 *              roster de membres synchronisés depuis Firebase.
 *              Distinct from `useSessionStore` (local computation session) and
 *              `useRealtimeStore` (F4 live positions). Holds the « shared » mode
 *              state: `isShared` flag, shared sessionId, meta and members roster
 *              synced from Firebase.
 *
 *              ⚠️ NON PERSISTÉ volontairement (RGPD) : la session partagée
 *              expire (24h/7j) et n'est jamais conservée localement au-delà du
 *              cycle de vie de l'app. Tout est en mémoire.
 *              ⚠️ NOT persisted (GDPR): the shared session expires and is never
 *              kept locally beyond the app lifecycle. Everything is in memory.
 *
 *              Le store ne fait QUE de l'état : l'orchestration (create/join/
 *              subscribe via les use cases + container DI) vit côté hooks/écrans.
 *              Il n'importe ni firebase ni le port.
 *              State-only store: orchestration lives in hooks/screens. It imports
 *              neither firebase nor the port.
 *
 *              ⚠️ Zustand v5 : ne PAS exposer de sélecteur renvoyant une nouvelle
 *              référence (Object.values, .map…). Sélectionner les références
 *              stables (`members` est un tableau remplacé en bloc) et dériver via
 *              `useMemo`/`useShallow` côté composant.
 *
 * @module state/useSharedSessionStore
 */

// [ADDED] F5 — Store Zustand session partagée (NON persisté, RGPD)
import { create } from 'zustand';
import type { SharedSessionMember, SharedSessionMeta } from '@entities/SharedSession';

/**
 * Statut de la session partagée.
 * Shared session status.
 *
 * - `idle` : aucune session partagée active / no active shared session
 * - `creating` : publication en cours / publishing in progress
 * - `joining` : jointure en cours / joining in progress
 * - `synced` : synchronisée (abonnement actif) / synced (subscription active)
 * - `error` : erreur (voir errorCode) / error (see errorCode)
 */
export type SharedSessionStatus = 'idle' | 'creating' | 'joining' | 'synced' | 'error';

/**
 * État du store de session partagée.
 * Shared session store state.
 */
interface SharedSessionState {
  /** true si la session courante est partagée (mode collaboratif) / shared mode flag */
  isShared: boolean;
  /**
   * true si l'appareil courant est le PROPRIÉTAIRE (a publié la session via
   * `share()`), false s'il l'a seulement REJOINTE via un lien. Pilote la
   * suppression RGPD : seul le propriétaire supprime le nœud partagé à la fin.
   * true if the current device OWNS the session (published via `share()`),
   * false if it merely JOINED via a link. Drives GDPR deletion: only the owner
   * removes the shared node at the end.
   */
  isOwner: boolean;
  /** Identifiant de la session partagée ou null / Shared session id or null */
  sessionId: string | null;
  /** Lien profond de partage ou null / Share deep link or null */
  link: string | null;
  /** Méta-données synchronisées ou null / Synced metadata or null */
  meta: SharedSessionMeta | null;
  /** Roster des membres (tableau remplacé en bloc) / Members roster (replaced wholesale) */
  members: readonly SharedSessionMember[];
  /** Statut courant / Current status */
  status: SharedSessionStatus;
  /** Code d'erreur i18n de la dernière erreur, ou null / i18n error code or null */
  errorCode: string | null;
}

/**
 * Actions du store de session partagée.
 * Shared session store actions.
 */
interface SharedSessionActions {
  /**
   * Marque la session courante comme partagée (après create OU join).
   * Marks the current session as shared (after create OR join).
   *
   * @param sessionId - Identifiant de la session partagée / Shared session id
   * @param link - Lien profond de partage / Share deep link
   * @param isOwner - true si propriétaire (create), false si simple membre (join).
   *                  Défaut false. / true if owner (create), false if joiner.
   */
  setShared: (sessionId: string, link: string, isOwner?: boolean) => void;
  /**
   * Définit le statut courant (+ code d'erreur si status='error').
   * Sets the current status (+ error code if status='error').
   *
   * @param status - Nouveau statut / New status
   * @param errorCode - Code d'erreur i18n si status='error' / i18n error code
   */
  setStatus: (status: SharedSessionStatus, errorCode?: string | null) => void;
  /**
   * Met à jour la meta + les membres depuis l'abonnement Firebase.
   * Updates meta + members from the Firebase subscription.
   *
   * @param meta - Méta-données synchronisées / Synced metadata
   * @param members - Roster des membres / Members roster
   */
  syncFromRemote: (meta: SharedSessionMeta, members: readonly SharedSessionMember[]) => void;
  /**
   * Quitte le mode partagé et purge l'état (RGPD).
   * Leaves shared mode and purges state (GDPR).
   */
  clearShared: () => void;
}

/** Type combiné du store / Combined store type */
type SharedSessionStore = SharedSessionState & SharedSessionActions;

/** État initial / Initial state */
const initialState: SharedSessionState = {
  isShared: false,
  isOwner: false,
  sessionId: null,
  link: null,
  meta: null,
  members: [],
  status: 'idle',
  errorCode: null,
};

/**
 * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Timestamp formaté / Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

export const useSharedSessionStore = create<SharedSessionStore>()((set) => ({
  ...initialState,

  setShared: (sessionId, link, isOwner = false) => {
    set({ isShared: true, isOwner, sessionId, link });
    console.log(
      `[INFO][useSharedSessionStore][setShared][?][${timestamp()}] ` +
        `Session marked as shared | owner: ${isOwner}`,
    );
  },

  setStatus: (status, errorCode = null) => {
    set({ status, errorCode: status === 'error' ? errorCode : null });
  },

  syncFromRemote: (meta, members) => {
    set({ meta, members, status: 'synced', errorCode: null });
  },

  clearShared: () => {
    set({ ...initialState });
    console.log(
      `[INFO][useSharedSessionStore][clearShared][?][${timestamp()}] Shared state purged (GDPR)`,
    );
  },
}));

/**
 * @file useAuthStore.ts
 * @description Store d'authentification — guest first.
 *              Authentication store — guest first.
 *
 *              Google/Apple Sign-In : signatures only (no-op MVP),
 *              implémentation dans une session dédiée future.
 *
 *              Persisté via MMKV (zustand persist middleware).
 *              Validation Zod sur la rehydratation (TS-004 : données externes).
 *
 * @module presentation/stores/useAuthStore
 */

// [ADDED] Store Zustand — authentification persistée MMKV
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getContainer } from '@/di/container';
import type { User } from '@core/entities/User';
import { UserSchema } from '@core/entities/User';

/**
 * État d'authentification.
 * Authentication state.
 */
interface AuthState {
  /** Utilisateur connecté ou null / Signed-in user or null */
  user: User | null;
  /** true si un user est connecté / true if a user is signed in */
  isAuthenticated: boolean;
}

/**
 * Actions d'authentification.
 * Authentication actions.
 */
interface AuthActions {
  /**
   * Connecte en tant qu'invité avec UUID + displayName généré.
   * Signs in as guest with generated UUID + displayName.
   *
   * @param displayName - Nom optionnel / Optional display name
   */
  signInAsGuest: (displayName?: string) => void;
  /**
   * Connecte via Google (no-op MVP — throw).
   * Signs in via Google (no-op MVP — throws).
   */
  signInWithGoogle: () => Promise<void>;
  /**
   * Connecte via Apple (no-op MVP — throw).
   * Signs in via Apple (no-op MVP — throws).
   */
  signInWithApple: () => Promise<void>;
  /**
   * Déconnexion — reset le state.
   * Signs out — resets state.
   */
  signOut: () => void;
  /**
   * Met à jour le nom affiché de l'utilisateur.
   * Updates the user's display name.
   *
   * @param newName - Nouveau nom / New name
   */
  updateDisplayName: (newName: string) => void;
}

/** Type combiné du store / Combined store type */
type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      signInAsGuest: (displayName) => {
        const { createGuestUserUseCase } = getContainer();
        const guest = createGuestUserUseCase.execute({ displayName });
        set({ user: guest, isAuthenticated: true });
        console.log(
          `[INFO][useAuthStore][signInAsGuest][?][${new Date().toISOString().slice(11, 19)}] ` +
            `Guest signed in: ${guest.id}`,
        );
      },

      signInWithGoogle: async () => {
        // [TODO] Implémenter dans la session auth dédiée
        throw new Error('Google Sign-In not implemented yet');
      },

      signInWithApple: async () => {
        // [TODO] Implémenter dans la session auth dédiée
        throw new Error('Apple Sign-In not implemented yet');
      },

      signOut: () => {
        console.log(
          `[INFO][useAuthStore][signOut][?][${new Date().toISOString().slice(11, 19)}] ` +
            'User signed out',
        );
        set(initialState);
      },

      updateDisplayName: (newName) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, displayName: newName } });
      },
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => getContainer().zustandStorage),
      // [ADDED] Validation Zod sur la rehydratation (TS-004 : données externes)
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          const result = UserSchema.safeParse(state.user);
          if (!result.success) {
            console.warn(
              `[WARN][useAuthStore][onRehydrate][?][${new Date().toISOString().slice(11, 19)}] ` +
                'Invalid persisted user, clearing',
              result.error,
            );
            state.user = null;
            state.isAuthenticated = false;
          }
        }
      },
    },
  ),
);

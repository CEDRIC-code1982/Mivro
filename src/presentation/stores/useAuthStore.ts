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
import type { UpdateProfileInput } from '@core/usecases/UpdateProfileUseCase'; // [ADDED] F7

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
  /**
   * Met à jour le profil (nom affiché et/ou avatar) via UpdateProfileUseCase.
   * No-op si aucun utilisateur connecté. Lève si le patch est invalide.
   * Updates the profile (display name and/or avatar) via UpdateProfileUseCase.
   * No-op if no signed-in user. Throws if the patch is invalid.
   *
   * @param input - Patch de profil (displayName?, avatarId?) / Profile patch
   * @throws {import('zod').ZodError} Si le patch est invalide / If the patch is invalid
   */
  updateProfile: (input: UpdateProfileInput) => void;
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
        const { createGuestUserUseCase, crashReporter } = getContainer(); // [MODIFIED]
        const guest = createGuestUserUseCase.execute({ displayName });
        crashReporter.setUser({ id: guest.id, type: 'guest' }); // [ADDED]
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
        const { crashReporter } = getContainer(); // [ADDED]
        crashReporter.setUser(null); // [ADDED]
        console.log(
          `[INFO][useAuthStore][signOut][?][${new Date().toISOString().slice(11, 19)}] ` +
            'User signed out',
        );
        set(initialState);
      },

      updateDisplayName: (newName) => {
        get().updateProfile({ displayName: newName });
      },

      // [ADDED] F7 — mise à jour du profil (nom + avatar) via UpdateProfileUseCase
      updateProfile: (input) => {
        const current = get().user;
        if (!current) {
          console.warn(
            `[WARN][useAuthStore][updateProfile][?][${new Date().toISOString().slice(11, 19)}] ` +
              'No signed-in user, ignoring update',
          );
          return;
        }
        const { updateProfileUseCase } = getContainer();
        const updated = updateProfileUseCase.execute(current, input);
        set({ user: updated });
        console.log(
          `[INFO][useAuthStore][updateProfile][?][${new Date().toISOString().slice(11, 19)}] ` +
            `Profile updated: ${updated.id}`,
        );
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

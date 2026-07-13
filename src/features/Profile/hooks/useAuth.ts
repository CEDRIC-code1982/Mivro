/**
 * @file useAuth.ts
 * @description Hook sucré pour useAuthStore avec sélecteurs ciblés.
 *              Sugar hook for useAuthStore with targeted selectors.
 *
 *              Évite les re-renders inutiles en sélectionnant uniquement
 *              ce dont le composant a besoin.
 *              Avoids unnecessary re-renders by selecting only
 *              what the component needs.
 *
 * @module presentation/hooks/useAuth
 */

// [ADDED] Sélecteurs mémoïsés sur useAuthStore
import { isGuestUser, isAuthenticatedUser } from '@entities/User';
import type { User } from '@entities/User';
import { useAuthStore } from '@state/useAuthStore';

/**
 * Retourne l'utilisateur courant ou null.
 * Returns the current user or null.
 *
 * @returns User | null
 */
export const useAuthUser = (): User | null => useAuthStore((s) => s.user);

/**
 * Retourne true si un utilisateur est connecté.
 * Returns true if a user is signed in.
 *
 * @returns boolean
 */
export const useIsAuthenticated = (): boolean => useAuthStore((s) => s.isAuthenticated);

/**
 * Retourne true si l'utilisateur courant est un invité.
 * Returns true if the current user is a guest.
 *
 * @returns boolean
 */
export const useIsGuest = (): boolean =>
  useAuthStore((s) => (s.user ? isGuestUser(s.user) : false));

/**
 * Retourne true si l'utilisateur courant est authentifié (Google/Apple).
 * Returns true if the current user is authenticated (Google/Apple).
 *
 * @returns boolean
 */
export const useIsAuthenticatedProvider = (): boolean =>
  useAuthStore((s) => (s.user ? isAuthenticatedUser(s.user) : false));

/**
 * Retourne les actions d'authentification (stable, ne change jamais).
 * Returns authentication actions (stable, never changes).
 *
 * @returns Les actions signInAsGuest, signOut, etc.
 */
export const useAuthActions = () => ({
  signInAsGuest: useAuthStore((s) => s.signInAsGuest),
  signInWithGoogle: useAuthStore((s) => s.signInWithGoogle),
  signInWithApple: useAuthStore((s) => s.signInWithApple),
  signOut: useAuthStore((s) => s.signOut),
  updateDisplayName: useAuthStore((s) => s.updateDisplayName),
  updateProfile: useAuthStore((s) => s.updateProfile), // [ADDED] F7
});

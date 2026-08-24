/**
 * @file User.ts
 * @description Entité User — distingue utilisateur invité et authentifié.
 *              User entity — distinguishes guest from authenticated user.
 *
 *              Discriminated union sur le champ `type` :
 *              - 'guest' → GuestUser (inscription immédiate, sans email)
 *              - 'authenticated' → AuthenticatedUser (Google / Apple Sign-In)
 *
 *              Les schémas Zod sont la source de vérité (runtime + types).
 *              Zod schemas are the source of truth (runtime + types).
 *
 * @module entities/User
 */

// [ADDED] Entité User avec discriminated union Zod
import { z } from 'zod';
import { AvatarIdSchema } from './Avatar'; // [ADDED] F7 — avatar emoji prédéfini

/**
 * Schéma Zod pour un utilisateur invité.
 * Zod schema for a guest user.
 */
export const GuestUserSchema = z.object({
  type: z.literal('guest'),
  id: z.string().uuid(),
  displayName: z.string().min(1).max(50),
  // [ADDED] F7 — id de l'avatar emoji prédéfini choisi / chosen predefined emoji avatar id
  avatarId: AvatarIdSchema.optional(),
  // [ADDED] F7 passe 2 — chemin local de la photo de profil (FileSystem) / local profile photo path
  photoUri: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
});

/**
 * Schéma Zod pour un utilisateur authentifié (Google / Apple).
 * Zod schema for an authenticated user (Google / Apple).
 */
export const AuthenticatedUserSchema = z.object({
  type: z.literal('authenticated'),
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(50),
  // [ADDED] F7 — id de l'avatar emoji prédéfini choisi / chosen predefined emoji avatar id
  avatarId: AvatarIdSchema.optional(),
  // [ADDED] F7 passe 2 — chemin local de la photo de profil (FileSystem) / local profile photo path
  // Distinct de avatarUrl (photo distante du provider OAuth) / distinct from remote provider avatarUrl
  photoUri: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
  provider: z.enum(['google', 'apple']),
  createdAt: z.string().datetime(),
});

/**
 * Schéma Zod pour un User (union discriminée sur `type`).
 * Zod schema for a User (discriminated union on `type`).
 */
export const UserSchema = z.discriminatedUnion('type', [GuestUserSchema, AuthenticatedUserSchema]);

// [ADDED] Types inférés depuis les schémas Zod (TS-001 : zéro any)
export type GuestUser = z.infer<typeof GuestUserSchema>;
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
export type User = z.infer<typeof UserSchema>;

/**
 * Type guard : vérifie si un User est un GuestUser.
 * Type guard: checks if a User is a GuestUser.
 *
 * @param user - L'utilisateur à vérifier / The user to check
 * @returns true si l'utilisateur est un invité / true if user is a guest
 */
export const isGuestUser = (user: User): user is GuestUser => user.type === 'guest';

/**
 * Type guard : vérifie si un User est un AuthenticatedUser.
 * Type guard: checks if a User is an AuthenticatedUser.
 *
 * @param user - L'utilisateur à vérifier / The user to check
 * @returns true si l'utilisateur est authentifié / true if user is authenticated
 */
export const isAuthenticatedUser = (user: User): user is AuthenticatedUser =>
  user.type === 'authenticated';

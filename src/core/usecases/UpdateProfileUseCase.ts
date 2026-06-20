/**
 * @file UpdateProfileUseCase.ts
 * @description Met à jour le profil d'un User (nom affiché + avatar emoji).
 *              Updates a User's profile (display name + emoji avatar).
 *
 *              Use case framework-agnostic et PUR : pas de port externe,
 *              pas d'effet de bord. Reçoit le User courant + un patch,
 *              valide via Zod (TS-004) et retourne le User mis à jour.
 *              Framework-agnostic and PURE: no external port, no side effect.
 *              Takes the current User + a patch, validates via Zod (TS-004)
 *              and returns the updated User.
 *
 * @example
 *   const useCase = new UpdateProfileUseCase();
 *   const updated = useCase.execute(currentUser, { displayName: 'Léa', avatarId: 'fox' });
 *
 * @module core/usecases/UpdateProfileUseCase
 */

// [ADDED] F7 — Use case UpdateProfile (pur, validé Zod)
import { z } from 'zod';
import { AvatarIdSchema } from '@core/entities/Avatar';
import type { User } from '@core/entities/User';
import { UserSchema } from '@core/entities/User';

/**
 * Schéma Zod du patch de mise à jour de profil.
 * Zod schema for the profile update patch.
 *
 * Les deux champs sont optionnels : on ne met à jour que ce qui est fourni.
 * Le `displayName` est `trim`é puis contraint (1..50, comme l'entité User).
 * Both fields are optional: only provided fields are updated.
 * `displayName` is trimmed then constrained (1..50, like the User entity).
 */
export const UpdateProfileInputSchema = z.object({
  /** Nouveau nom affiché (trimé, 1..50) / New display name (trimmed, 1..50) */
  displayName: z.string().trim().min(1).max(50).optional(),
  /** Nouvel id d'avatar emoji prédéfini / New predefined emoji avatar id */
  avatarId: AvatarIdSchema.optional(),
});

/**
 * Patch d'entrée pour la mise à jour de profil.
 * Input patch for the profile update.
 */
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

/**
 * Use case : mettre à jour le profil utilisateur (nom + avatar).
 * Use case: update the user profile (name + avatar).
 */
export class UpdateProfileUseCase {
  /**
   * Applique un patch de profil au User courant et retourne le User validé.
   * Applies a profile patch to the current User and returns the validated User.
   *
   * @param current - User courant (non null) / Current User (non null)
   * @param input - Patch de mise à jour / Update patch
   * @returns Le User mis à jour et validé / The updated, validated User
   * @throws {z.ZodError} Si le patch ou le User résultant est invalide / If the patch or resulting User is invalid
   */
  execute(current: User, input: UpdateProfileInput): User {
    // Validation du patch en frontière (TS-004)
    // Validate the patch at the boundary (TS-004)
    const patch = UpdateProfileInputSchema.parse(input);

    // Construit un User candidat en ne surchargeant que les champs fournis.
    // Builds a candidate User overriding only the provided fields.
    const candidate: User = {
      ...current,
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.avatarId !== undefined ? { avatarId: patch.avatarId } : {}),
    };

    // Re-valide l'entité complète (cohérence de la discriminated union).
    // Re-validate the full entity (discriminated union consistency).
    return UserSchema.parse(candidate);
  }
}

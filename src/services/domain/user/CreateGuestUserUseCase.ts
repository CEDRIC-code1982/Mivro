/**
 * @file CreateGuestUserUseCase.ts
 * @description Crée un GuestUser avec UUID + displayName généré.
 *              Creates a GuestUser with a UUID + generated displayName.
 *
 *              Use case framework-agnostic : ne dépend d'aucun store
 *              ni infrastructure. Peut être testé sans mock.
 *              Framework-agnostic use case: no store or infrastructure dependency.
 *
 * @example
 *   const useCase = new CreateGuestUserUseCase();
 *   const guest = useCase.execute({ displayName: 'Anonyme' });
 *
 * @module services/domain/user/CreateGuestUserUseCase
 */

// [ADDED] Use case CreateGuestUser
import { v4 as uuidv4 } from 'uuid';
import type { GuestUser } from '@entities/User';

/**
 * Paramètres d'entrée pour la création d'un guest user.
 * Input parameters for guest user creation.
 */
export interface CreateGuestUserInput {
  /**
   * Nom affiché du guest (par défaut généré "Invité-XXXX").
   * Display name for the guest (defaults to generated "Invité-XXXX").
   */
  displayName?: string | undefined;
}

/**
 * Use case : créer un utilisateur invité.
 * Use case: create a guest user.
 */
export class CreateGuestUserUseCase {
  /**
   * Génère un GuestUser prêt à être stocké.
   * Generates a GuestUser ready to be stored.
   *
   * @param input - Paramètres optionnels / Optional parameters
   * @returns Un GuestUser valide / A valid GuestUser
   */
  execute(input: CreateGuestUserInput = {}): GuestUser {
    const fallbackName = `Invité-${uuidv4().slice(0, 4).toUpperCase()}`;
    return {
      type: 'guest',
      id: uuidv4(),
      displayName: input.displayName ?? fallbackName,
      createdAt: new Date().toISOString(),
    };
  }
}

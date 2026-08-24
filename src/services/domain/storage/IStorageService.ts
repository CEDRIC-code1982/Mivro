/**
 * @file IStorageService.ts
 * @description Port abstrait pour le storage persistant.
 *              Abstract port for persistent storage.
 *
 *              Permet de swapper l'implémentation (MMKV, AsyncStorage, etc.)
 *              sans toucher au code métier.
 *              Allows swapping implementation (MMKV, AsyncStorage, etc.)
 *              without touching business logic.
 *
 * @module services/domain/storage/IStorageService
 */

// [ADDED] Port IStorageService + StorageError

/**
 * Interface de storage clé/valeur pour la persistance.
 * Key/value storage interface for persistence.
 */
export interface IStorageService {
  /**
   * Récupère une valeur stringifiée par clé.
   * Retrieves a stringified value by key.
   *
   * @param key - Clé unique / Unique key
   * @returns La valeur ou undefined si absente / The value or undefined if missing
   */
  getString(key: string): string | undefined;

  /**
   * Stocke une valeur stringifiée.
   * Stores a stringified value.
   *
   * @param key - Clé unique / Unique key
   * @param value - Valeur à stocker / Value to store
   * @throws StorageError si l'écriture échoue / if write fails
   */
  setString(key: string, value: string): void;

  /**
   * Supprime une clé.
   * Deletes a key.
   *
   * @param key - Clé à supprimer / Key to delete
   */
  delete(key: string): void;

  /**
   * Efface tout le storage (suppression de compte / logout total).
   * Clears all storage (account deletion / full logout).
   */
  clearAll(): void;

  /**
   * Liste toutes les clés présentes (utile pour debug et nettoyage).
   * Lists all present keys (useful for debug and cleanup).
   *
   * @returns Liste en lecture seule des clés / Read-only list of keys
   */
  getAllKeys(): readonly string[];
}

/**
 * Erreur de storage — encapsule les erreurs MMKV/AsyncStorage.
 * Storage error — wraps MMKV/AsyncStorage errors.
 *
 * @param message - Description de l'erreur / Error description
 * @param cause - Erreur originale / Original error
 */
export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}

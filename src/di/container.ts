/**
 * @file container.ts
 * @description Conteneur de dépendances simple.
 *              Simple dependency injection container.
 *
 *              SEUL fichier qui connaît les implémentations concrètes.
 *              Changer de provider = modifier UNE ligne ici.
 *
 *              ONLY file that knows concrete implementations.
 *              Swapping a provider = changing ONE line here.
 *
 * @module di/container
 */

// [ADDED] DI Container — wire-up des dépendances
import { createMMKV } from 'react-native-mmkv';
import type { IStorageService } from '@core/ports/IStorageService';
import { CreateGuestUserUseCase } from '@core/usecases/CreateGuestUserUseCase';
import { MMKVStorageService } from '@infrastructure/storage/MMKVStorageService';
import { createZustandMMKVAdapter } from '@infrastructure/storage/zustand-mmkv-adapter';

/**
 * Interface du conteneur de dépendances.
 * Dependency injection container interface.
 */
export interface Container {
  /** Service de storage persistant / Persistent storage service */
  storage: IStorageService;
  /** Adapter Zustand ↔ MMKV pour persist middleware */
  zustandStorage: ReturnType<typeof createZustandMMKVAdapter>;
  /** Use case de création de guest user */
  createGuestUserUseCase: CreateGuestUserUseCase;
}

let containerInstance: Container | null = null;

/**
 * Initialise le container avec la clé de chiffrement MMKV.
 * À appeler UNE SEULE FOIS au démarrage de l'app, après getEncryptionKey().
 *
 * Initializes the container with the MMKV encryption key.
 * Must be called ONCE at app startup, after getEncryptionKey().
 *
 * @param encryptionKey - Clé de chiffrement MMKV / MMKV encryption key
 * @returns Le container initialisé / The initialized container
 */
export const initContainer = (encryptionKey: string): Container => {
  if (containerInstance) {
    return containerInstance;
  }

  const mmkv = createMMKV({
    id: 'midpoint-storage',
    encryptionKey,
  });

  const storage = new MMKVStorageService(mmkv);
  const zustandStorage = createZustandMMKVAdapter(storage);

  containerInstance = {
    storage,
    zustandStorage,
    createGuestUserUseCase: new CreateGuestUserUseCase(),
  };

  console.log(
    `[INFO][container][initContainer][?][${new Date().toISOString().slice(11, 19)}] ` +
      'DI container initialized',
  );

  return containerInstance;
};

/**
 * Récupère le container. À utiliser uniquement après initContainer().
 * Retrieves the container. Only use after initContainer().
 *
 * @returns Le container / The container
 * @throws Error si le container n'a pas été initialisé / if container not initialized
 */
export const getContainer = (): Container => {
  if (!containerInstance) {
    throw new Error('Container not initialized. Call initContainer() first.');
  }
  return containerInstance;
};

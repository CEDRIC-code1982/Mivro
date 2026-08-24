/**
 * @file zustand-mmkv-adapter.ts
 * @description Adapter pour utiliser MMKV avec Zustand persist middleware.
 *              Adapter to use MMKV with Zustand persist middleware.
 *
 *              Transforme un IStorageService en StateStorage compatible
 *              avec zustand/middleware persist().
 *              Transforms an IStorageService into a StateStorage compatible
 *              with zustand/middleware persist().
 *
 * @module services/infra/storage/zustand-mmkv-adapter
 */

// [ADDED] Zustand ↔ MMKV adapter via IStorageService
import type { StateStorage } from 'zustand/middleware';
import type { IStorageService } from '@services/domain/storage/IStorageService';

/**
 * Crée un adapter StateStorage pour Zustand persist à partir d'un IStorageService.
 * Creates a StateStorage adapter for Zustand persist from an IStorageService.
 *
 * @param storage - Le service de storage à wrapper / The storage service to wrap
 * @returns Un StateStorage compatible zustand persist / A zustand persist compatible StateStorage
 */
export const createZustandMMKVAdapter = (storage: IStorageService): StateStorage => ({
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.setString(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

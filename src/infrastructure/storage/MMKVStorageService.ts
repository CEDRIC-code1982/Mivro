/**
 * @file MMKVStorageService.ts
 * @description Implémentation IStorageService basée sur MMKV
 *              avec chiffrement via clé Keychain.
 *
 *              MMKV-based IStorageService implementation
 *              with Keychain-stored encryption key.
 *
 * @module infrastructure/storage/MMKVStorageService
 */

// [ADDED] MMKVStorageService — implémente IStorageService
import type { MMKV } from 'react-native-mmkv';
import type { IStorageService } from '@core/ports/IStorageService';
import { StorageError } from '@core/ports/IStorageService';

/**
 * Service de storage basé sur MMKV.
 * MMKV-based storage service.
 *
 * @param mmkv - Instance MMKV configurée (chiffrée) / Configured (encrypted) MMKV instance
 */
export class MMKVStorageService implements IStorageService {
  constructor(private readonly mmkv: MMKV) {}

  /**
   * @inheritdoc
   */
  getString(key: string): string | undefined {
    try {
      const value = this.mmkv.getString(key);
      console.log(
        `[DEBUG][MMKVStorageService][getString][?][${new Date().toISOString().slice(11, 19)}] ` +
          `Read key: ${key}`,
      );
      return value;
    } catch (error) {
      console.error(
        `[ERROR][MMKVStorageService][getString][?][${new Date().toISOString().slice(11, 19)}] ` +
          `Failed to read key: ${key}`,
        error,
      );
      throw new StorageError(`Failed to read key: ${key}`, error);
    }
  }

  /**
   * @inheritdoc
   */
  setString(key: string, value: string): void {
    try {
      this.mmkv.set(key, value);
      console.log(
        `[DEBUG][MMKVStorageService][setString][?][${new Date().toISOString().slice(11, 19)}] ` +
          `Wrote key: ${key}`,
      );
    } catch (error) {
      console.error(
        `[ERROR][MMKVStorageService][setString][?][${new Date().toISOString().slice(11, 19)}] ` +
          `Failed to write key: ${key}`,
        error,
      );
      throw new StorageError(`Failed to write key: ${key}`, error);
    }
  }

  /**
   * @inheritdoc
   */
  delete(key: string): void {
    this.mmkv.remove(key);
    console.log(
      `[DEBUG][MMKVStorageService][delete][?][${new Date().toISOString().slice(11, 19)}] ` +
        `Deleted key: ${key}`,
    );
  }

  /**
   * @inheritdoc
   */
  clearAll(): void {
    this.mmkv.clearAll();
    console.warn(
      `[WARN][MMKVStorageService][clearAll][?][${new Date().toISOString().slice(11, 19)}] ` +
        'All MMKV data cleared',
    );
  }

  /**
   * @inheritdoc
   */
  getAllKeys(): readonly string[] {
    return this.mmkv.getAllKeys();
  }
}

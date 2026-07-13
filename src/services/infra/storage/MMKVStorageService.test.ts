/**
 * @file MMKVStorageService.test.ts
 * @description Tests unitaires de MMKVStorageService.
 *              Unit tests for MMKVStorageService.
 *
 * @module __tests__/unit/infrastructure/storage/MMKVStorageService
 */

// [ADDED] Tests unitaires MMKVStorageService avec mock MMKV
import { mock } from 'jest-mock-extended';
import type { MMKV } from 'react-native-mmkv';
import { StorageError } from '@services/domain/storage/IStorageService';
import { MMKVStorageService } from '@services/infra/storage/MMKVStorageService';

describe('MMKVStorageService', () => {
  let mockMmkv: ReturnType<typeof mock<MMKV>>;
  let service: MMKVStorageService;

  beforeEach(() => {
    mockMmkv = mock<MMKV>();
    service = new MMKVStorageService(mockMmkv);
  });

  // ─── getString ────────────────────────────────────────────
  describe('getString', () => {
    it('returns the value when key exists', () => {
      mockMmkv.getString.mockReturnValue('stored-value');

      const result = service.getString('my-key');

      expect(result).toBe('stored-value');
      expect(mockMmkv.getString).toHaveBeenCalledWith('my-key');
    });

    it('returns undefined when key does not exist', () => {
      mockMmkv.getString.mockReturnValue(undefined);

      const result = service.getString('missing-key');

      expect(result).toBeUndefined();
    });

    it('throws StorageError when MMKV throws', () => {
      mockMmkv.getString.mockImplementation(() => {
        throw new Error('native crash');
      });

      expect(() => service.getString('bad-key')).toThrow(StorageError);
      expect(() => service.getString('bad-key')).toThrow('Failed to read key: bad-key');
    });
  });

  // ─── setString ────────────────────────────────────────────
  describe('setString', () => {
    it('calls mmkv.set with correct arguments', () => {
      service.setString('my-key', 'my-value');

      expect(mockMmkv.set).toHaveBeenCalledWith('my-key', 'my-value');
    });

    it('throws StorageError when MMKV throws', () => {
      mockMmkv.set.mockImplementation(() => {
        throw new Error('write failed');
      });

      expect(() => service.setString('bad-key', 'value')).toThrow(StorageError);
      expect(() => service.setString('bad-key', 'value')).toThrow('Failed to write key: bad-key');
    });
  });

  // ─── delete ───────────────────────────────────────────────
  describe('delete', () => {
    it('calls mmkv.remove with the key', () => {
      service.delete('my-key');

      expect(mockMmkv.remove).toHaveBeenCalledWith('my-key');
    });
  });

  // ─── clearAll ─────────────────────────────────────────────
  describe('clearAll', () => {
    it('calls mmkv.clearAll', () => {
      service.clearAll();

      expect(mockMmkv.clearAll).toHaveBeenCalled();
    });
  });

  // ─── getAllKeys ────────────────────────────────────────────
  describe('getAllKeys', () => {
    it('returns the list of keys', () => {
      mockMmkv.getAllKeys.mockReturnValue(['key1', 'key2', 'key3']);

      const keys = service.getAllKeys();

      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('returns empty array when no keys', () => {
      mockMmkv.getAllKeys.mockReturnValue([]);

      const keys = service.getAllKeys();

      expect(keys).toEqual([]);
    });
  });
});

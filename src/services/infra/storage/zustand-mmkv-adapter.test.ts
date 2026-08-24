/**
 * @file zustand-mmkv-adapter.test.ts
 * @description Tests unitaires du zustand-mmkv-adapter.
 *              Unit tests for the zustand-mmkv-adapter.
 *
 * @module services/infra/storage/zustand-mmkv-adapter.test
 */

// [ADDED] Tests unitaires zustand-mmkv-adapter
import { mock } from 'jest-mock-extended';
import type { IStorageService } from '@services/domain/storage/IStorageService';
import { createZustandMMKVAdapter } from '@services/infra/storage/zustand-mmkv-adapter';

describe('createZustandMMKVAdapter', () => {
  let mockStorage: ReturnType<typeof mock<IStorageService>>;

  beforeEach(() => {
    mockStorage = mock<IStorageService>();
  });

  describe('getItem', () => {
    it('returns the value from storage when key exists', () => {
      mockStorage.getString.mockReturnValue('{"count":42}');

      const adapter = createZustandMMKVAdapter(mockStorage);
      const result = adapter.getItem('my-key');

      expect(result).toBe('{"count":42}');
      expect(mockStorage.getString).toHaveBeenCalledWith('my-key');
    });

    it('returns null when key does not exist', () => {
      mockStorage.getString.mockReturnValue(undefined);

      const adapter = createZustandMMKVAdapter(mockStorage);
      const result = adapter.getItem('missing-key');

      expect(result).toBeNull();
    });
  });

  describe('setItem', () => {
    it('stores the value via storage', () => {
      const adapter = createZustandMMKVAdapter(mockStorage);
      adapter.setItem('my-key', '{"count":42}');

      expect(mockStorage.setString).toHaveBeenCalledWith('my-key', '{"count":42}');
    });
  });

  describe('removeItem', () => {
    it('deletes the key via storage', () => {
      const adapter = createZustandMMKVAdapter(mockStorage);
      adapter.removeItem('my-key');

      expect(mockStorage.delete).toHaveBeenCalledWith('my-key');
    });
  });
});

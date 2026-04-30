/**
 * @file getEncryptionKey.test.ts
 * @description Tests unitaires de getEncryptionKey.
 *              Unit tests for getEncryptionKey.
 *
 *              Keychain est mocké globalement dans jest.setup.js.
 *              Keychain is globally mocked in jest.setup.js.
 *
 * @module __tests__/unit/infrastructure/storage/getEncryptionKey
 */

// [ADDED] Tests unitaires getEncryptionKey avec mock Keychain
import * as Keychain from 'react-native-keychain';
import { getEncryptionKey } from '@infrastructure/storage/getEncryptionKey';

// Accès aux mocks jest
const mockGetGenericPassword = Keychain.getGenericPassword as jest.Mock;
const mockSetGenericPassword = Keychain.setGenericPassword as jest.Mock;

describe('getEncryptionKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns existing key from Keychain when available', async () => {
    mockGetGenericPassword.mockResolvedValue({
      username: 'mmkv-encryption-key',
      password: 'existing-encryption-key-123',
    });

    const key = await getEncryptionKey();

    expect(key).toBe('existing-encryption-key-123');
    expect(mockSetGenericPassword).not.toHaveBeenCalled();
  });

  it('generates and stores a new key on first launch', async () => {
    mockGetGenericPassword.mockResolvedValue(false);
    mockSetGenericPassword.mockResolvedValue(true);

    const key = await getEncryptionKey();

    expect(key).toBeTruthy();
    expect(key.length).toBeGreaterThan(0);
    expect(mockSetGenericPassword).toHaveBeenCalledWith(
      'mmkv-encryption-key',
      key,
      expect.objectContaining({
        service: 'com.cedricpineau.midpoint.mmkv',
      }),
    );
  });

  it('generates a new key when username does not match', async () => {
    mockGetGenericPassword.mockResolvedValue({
      username: 'wrong-username',
      password: 'some-password',
    });
    mockSetGenericPassword.mockResolvedValue(true);

    const key = await getEncryptionKey();

    expect(key).toBeTruthy();
    expect(mockSetGenericPassword).toHaveBeenCalled();
  });

  it('throws when Keychain access fails', async () => {
    mockGetGenericPassword.mockRejectedValue(new Error('Keychain unavailable'));

    await expect(getEncryptionKey()).rejects.toThrow('Keychain unavailable');
  });
});

/**
 * @file KeychainBiometricService.test.ts
 * @description Tests unitaires de l'adapter KeychainBiometricService (F8).
 *              Unit tests for the KeychainBiometricService adapter (F8).
 *
 *              react-native-keychain est mocké dans jest.setup.js ; chaque test
 *              surcharge le comportement attendu via jest.mocked(...).
 *
 * @module __tests__/unit/infrastructure/security/KeychainBiometricService
 */

// [ADDED] F8 — Tests unitaires KeychainBiometricService
import { mock } from 'jest-mock-extended';
import {
  ACCESS_CONTROL,
  ACCESSIBLE,
  BIOMETRY_TYPE,
  getGenericPassword,
  getSupportedBiometryType,
  resetGenericPassword,
  setGenericPassword,
} from 'react-native-keychain';
import { BiometricError } from '@services/domain/biometric/IBiometricService';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import { KeychainBiometricService } from '@services/infra/security/KeychainBiometricService';

const mockGetSupported = getSupportedBiometryType as jest.Mock;
const mockGetGeneric = getGenericPassword as jest.Mock;
const mockSetGeneric = setGenericPassword as jest.Mock;
const mockResetGeneric = resetGenericPassword as jest.Mock;

const SENTINEL_SERVICE = 'com.mivro.biometric-lock';
const SENTINEL_VALUE = 'mivro-biometric-lock-v1';

describe('KeychainBiometricService', () => {
  const crashReporter = mock<ICrashReporter>();
  let service: KeychainBiometricService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    service = new KeychainBiometricService(crashReporter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── getSupportedType — mapping BIOMETRY_TYPE → abstraction ─
  describe('getSupportedType', () => {
    it('maps FACE_ID to "face"', async () => {
      mockGetSupported.mockResolvedValueOnce(BIOMETRY_TYPE.FACE_ID);
      await expect(service.getSupportedType()).resolves.toBe('face');
    });

    it('maps FACE (Android) to "face"', async () => {
      mockGetSupported.mockResolvedValueOnce(BIOMETRY_TYPE.FACE);
      await expect(service.getSupportedType()).resolves.toBe('face');
    });

    it('maps TOUCH_ID to "fingerprint"', async () => {
      mockGetSupported.mockResolvedValueOnce(BIOMETRY_TYPE.TOUCH_ID);
      await expect(service.getSupportedType()).resolves.toBe('fingerprint');
    });

    it('maps FINGERPRINT (Android) to "fingerprint"', async () => {
      mockGetSupported.mockResolvedValueOnce(BIOMETRY_TYPE.FINGERPRINT);
      await expect(service.getSupportedType()).resolves.toBe('fingerprint');
    });

    it('maps IRIS to "iris"', async () => {
      mockGetSupported.mockResolvedValueOnce(BIOMETRY_TYPE.IRIS);
      await expect(service.getSupportedType()).resolves.toBe('iris');
    });

    it('maps null to null', async () => {
      mockGetSupported.mockResolvedValueOnce(null);
      await expect(service.getSupportedType()).resolves.toBeNull();
    });

    it('maps OPTIC_ID (unsupported on mobile MVP) to null', async () => {
      mockGetSupported.mockResolvedValueOnce(BIOMETRY_TYPE.OPTIC_ID);
      await expect(service.getSupportedType()).resolves.toBeNull();
    });

    it('degrades to null and reports when introspection throws', async () => {
      mockGetSupported.mockRejectedValueOnce(new Error('native crash'));
      await expect(service.getSupportedType()).resolves.toBeNull();
      expect(crashReporter.captureException).toHaveBeenCalled();
    });
  });

  // ─── isEnrolled ───────────────────────────────────────────
  describe('isEnrolled', () => {
    it('returns true when a supported type is present', async () => {
      mockGetSupported.mockResolvedValueOnce(BIOMETRY_TYPE.FACE_ID);
      await expect(service.isEnrolled()).resolves.toBe(true);
    });

    it('returns false when no type is supported', async () => {
      mockGetSupported.mockResolvedValueOnce(null);
      await expect(service.isEnrolled()).resolves.toBe(false);
    });
  });

  // ─── authenticate ─────────────────────────────────────────
  describe('authenticate', () => {
    it('succeeds when the sentinel reads back the expected value', async () => {
      mockGetGeneric.mockResolvedValueOnce({
        service: SENTINEL_SERVICE,
        username: 'mivro',
        password: SENTINEL_VALUE,
        storage: 'keychain',
      });

      await expect(service.authenticate('Unlock Mivro')).resolves.toBe(true);
      // Le prompt natif est déclenché via getGenericPassword avec un accessControl biométrique.
      expect(mockGetGeneric).toHaveBeenCalledWith(
        expect.objectContaining({
          service: SENTINEL_SERVICE,
          // BIOMETRY_ANY (biométrie seule) : fiabilité cross-session Android
          // (le fallback device-passcode cassait la relecture au démarrage).
          accessControl: ACCESS_CONTROL.BIOMETRY_ANY,
          authenticationPrompt: { title: 'Unlock Mivro' },
        }),
      );
    });

    it('returns false when the read-back value does not match', async () => {
      mockGetGeneric.mockResolvedValueOnce({
        service: SENTINEL_SERVICE,
        username: 'mivro',
        password: 'tampered',
        storage: 'keychain',
      });

      await expect(service.authenticate('Unlock')).resolves.toBe(false);
    });

    it('throws not_enrolled when no sentinel is stored (false)', async () => {
      mockGetGeneric.mockResolvedValueOnce(false);

      const error = await service.authenticate('Unlock').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BiometricError);
      expect((error as BiometricError).code).toBe('not_enrolled');
    });

    it('maps a user cancellation to "cancelled"', async () => {
      mockGetGeneric.mockRejectedValueOnce(new Error('User canceled the operation'));

      const error = await service.authenticate('Unlock').catch((e: unknown) => e);
      expect((error as BiometricError).code).toBe('cancelled');
      // Annulation = comportement attendu → pas de report Sentry.
      expect(crashReporter.captureException).not.toHaveBeenCalled();
    });

    it('maps an Android negative-button code 13 to "cancelled"', async () => {
      mockGetGeneric.mockRejectedValueOnce(new Error('code: 13 negative button'));

      const error = await service.authenticate('Unlock').catch((e: unknown) => e);
      expect((error as BiometricError).code).toBe('cancelled');
    });

    it('maps "authentication failed" / not recognized to "failed"', async () => {
      mockGetGeneric.mockRejectedValueOnce(new Error('Authentication failed: not recognized'));

      const error = await service.authenticate('Unlock').catch((e: unknown) => e);
      expect((error as BiometricError).code).toBe('failed');
    });

    it('maps a lockout (too many attempts) to "failed"', async () => {
      mockGetGeneric.mockRejectedValueOnce(new Error('Too many attempts. Lockout.'));

      const error = await service.authenticate('Unlock').catch((e: unknown) => e);
      expect((error as BiometricError).code).toBe('failed');
    });

    it('maps "not enrolled" to "not_enrolled"', async () => {
      mockGetGeneric.mockRejectedValueOnce(new Error('Biometry is not enrolled'));

      const error = await service.authenticate('Unlock').catch((e: unknown) => e);
      expect((error as BiometricError).code).toBe('not_enrolled');
    });

    it('maps "not available" / hardware to "not_available" and reports', async () => {
      mockGetGeneric.mockRejectedValueOnce(new Error('Biometry not available — no hardware'));

      const error = await service.authenticate('Unlock').catch((e: unknown) => e);
      expect((error as BiometricError).code).toBe('not_available');
      expect(crashReporter.captureException).toHaveBeenCalled();
    });

    it('maps an unrecognized message to "unknown" and reports', async () => {
      mockGetGeneric.mockRejectedValueOnce(new Error('weird native error'));

      const error = await service.authenticate('Unlock').catch((e: unknown) => e);
      expect((error as BiometricError).code).toBe('unknown');
      expect(crashReporter.captureException).toHaveBeenCalled();
    });

    it('handles a non-Error rejection (string) without crashing', async () => {
      mockGetGeneric.mockRejectedValueOnce('plain cancel string');

      const error = await service.authenticate('Unlock').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BiometricError);
      expect((error as BiometricError).code).toBe('cancelled');
    });

    it('NEVER logs the sentinel value (LOG-001)', async () => {
      mockGetGeneric.mockResolvedValueOnce({
        service: SENTINEL_SERVICE,
        username: 'mivro',
        password: SENTINEL_VALUE,
        storage: 'keychain',
      });

      await service.authenticate('Unlock');

      const allLogs = [...logSpy.mock.calls, ...warnSpy.mock.calls]
        .flat()
        .map((arg) => String(arg))
        .join(' | ');
      expect(allLogs).not.toContain(SENTINEL_VALUE);
    });
  });

  // ─── enableLock ───────────────────────────────────────────
  describe('enableLock', () => {
    it('stores the biometry-protected sentinel', async () => {
      mockSetGeneric.mockResolvedValueOnce({ service: SENTINEL_SERVICE, storage: 'keychain' });

      await expect(service.enableLock()).resolves.toBeUndefined();
      expect(mockSetGeneric).toHaveBeenCalledWith(
        'mivro',
        SENTINEL_VALUE,
        expect.objectContaining({
          service: SENTINEL_SERVICE,
          // BIOMETRY_ANY : fiabilité cross-session Android (anti-lockout applicatif).
          accessControl: ACCESS_CONTROL.BIOMETRY_ANY,
          accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      );
    });

    it('throws BiometricError(unknown) when the store returns false', async () => {
      mockSetGeneric.mockResolvedValueOnce(false);

      const error = await service.enableLock().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BiometricError);
      expect((error as BiometricError).code).toBe('unknown');
    });

    it('maps a native rejection to a typed BiometricError', async () => {
      mockSetGeneric.mockRejectedValueOnce(new Error('User canceled'));

      const error = await service.enableLock().catch((e: unknown) => e);
      expect((error as BiometricError).code).toBe('cancelled');
    });

    it('NEVER logs the sentinel value (LOG-001)', async () => {
      mockSetGeneric.mockResolvedValueOnce({ service: SENTINEL_SERVICE, storage: 'keychain' });

      await service.enableLock();

      const allLogs = [...logSpy.mock.calls, ...warnSpy.mock.calls]
        .flat()
        .map((arg) => String(arg))
        .join(' | ');
      expect(allLogs).not.toContain(SENTINEL_VALUE);
    });
  });

  // ─── disableLock (idempotent, never throws) ───────────────
  describe('disableLock', () => {
    it('removes the sentinel for the dedicated service', async () => {
      mockResetGeneric.mockResolvedValueOnce(true);

      await expect(service.disableLock()).resolves.toBeUndefined();
      expect(mockResetGeneric).toHaveBeenCalledWith({ service: SENTINEL_SERVICE });
    });

    it('never throws when removal fails (logs + reports as warning)', async () => {
      mockResetGeneric.mockRejectedValueOnce(new Error('locked'));

      await expect(service.disableLock()).resolves.toBeUndefined();
      expect(crashReporter.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ level: 'warning' }),
      );
    });
  });

  // ─── Sans crashReporter (optionnel) ───────────────────────
  describe('without a crash reporter', () => {
    it('still degrades to null on introspection error', async () => {
      const bare = new KeychainBiometricService();
      mockGetSupported.mockRejectedValueOnce(new Error('boom'));

      await expect(bare.getSupportedType()).resolves.toBeNull();
    });

    it('still maps authenticate errors without a reporter', async () => {
      const bare = new KeychainBiometricService();
      mockGetGeneric.mockRejectedValueOnce(new Error('weird'));

      const error = await bare.authenticate('Unlock').catch((e: unknown) => e);
      expect((error as BiometricError).code).toBe('unknown');
    });
  });
});

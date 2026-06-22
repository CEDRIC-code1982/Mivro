/**
 * @file ImagePickerProfilePhotoService.test.ts
 * @description Tests unitaires de l'adapter ImagePickerProfilePhotoService (F7 passe 2).
 *              Unit tests for the ImagePickerProfilePhotoService adapter (F7 pass 2).
 *
 *              image-picker + react-native-fs sont mockés dans jest.setup.js ;
 *              chaque test surcharge le comportement attendu via jest.mocked(...).
 *
 * @module __tests__/unit/infrastructure/media/ImagePickerProfilePhotoService
 */

// [ADDED] F7 passe 2 — Tests unitaires ImagePickerProfilePhotoService
import {
  copyFile,
  exists,
  mkdir,
  unlink,
  DocumentDirectoryPath,
} from '@dr.pogodin/react-native-fs';
import { mock } from 'jest-mock-extended';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { ICrashReporter } from '@core/ports/ICrashReporter';
import { ProfilePhotoError } from '@core/ports/IProfilePhotoService';
import { ImagePickerProfilePhotoService } from '@infrastructure/media/ImagePickerProfilePhotoService';

// ─── Mock uuid (chemin destination déterministe) ────────────
jest.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

const mockLaunchLibrary = launchImageLibrary as jest.Mock;
const mockLaunchCamera = launchCamera as jest.Mock;
const mockCopyFile = copyFile as jest.Mock;
const mockExists = exists as jest.Mock;
const mockMkdir = mkdir as jest.Mock;
const mockUnlink = unlink as jest.Mock;

const PHOTO_DIR = `${DocumentDirectoryPath}/profile-photos`;
const DEST = `${PHOTO_DIR}/fixed-uuid.jpg`;

describe('ImagePickerProfilePhotoService', () => {
  const crashReporter = mock<ICrashReporter>();
  let service: ImagePickerProfilePhotoService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    service = new ImagePickerProfilePhotoService(crashReporter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Annulation utilisateur ───────────────────────────────
  describe('cancellation', () => {
    it('returns null when the library picker is cancelled', async () => {
      mockLaunchLibrary.mockResolvedValueOnce({ didCancel: true });

      const result = await service.pickFromLibrary();

      expect(result).toBeNull();
      expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('returns null when the camera picker is cancelled', async () => {
      mockLaunchCamera.mockResolvedValueOnce({ didCancel: true });

      const result = await service.pickFromCamera();

      expect(result).toBeNull();
    });
  });

  // ─── Permission refusée ───────────────────────────────────
  describe('permission denied', () => {
    it('throws ProfilePhotoError(permission_denied) for library', async () => {
      mockLaunchLibrary.mockResolvedValueOnce({ errorCode: 'permission' });

      await expect(service.pickFromLibrary()).rejects.toMatchObject({
        code: 'permission_denied',
      });
      expect(crashReporter.captureMessage).toHaveBeenCalled();
    });

    it('maps camera_unavailable error code', async () => {
      mockLaunchCamera.mockResolvedValueOnce({ errorCode: 'camera_unavailable' });

      await expect(service.pickFromCamera()).rejects.toMatchObject({
        code: 'camera_unavailable',
      });
    });

    it('maps an "others" error code to unknown', async () => {
      mockLaunchLibrary.mockResolvedValueOnce({ errorCode: 'others', errorMessage: 'boom' });

      await expect(service.pickFromLibrary()).rejects.toMatchObject({ code: 'unknown' });
    });
  });

  // ─── Succès → copie dans Documents ────────────────────────
  describe('success', () => {
    it('copies into Documents and returns the dest path (dir already exists)', async () => {
      mockLaunchLibrary.mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/pic.jpg' }] });
      mockExists.mockResolvedValueOnce(true); // dir exists

      const result = await service.pickFromLibrary();

      expect(result).toEqual({ uri: DEST });
      expect(mockMkdir).not.toHaveBeenCalled();
      // file:// strippé pour la source
      expect(mockCopyFile).toHaveBeenCalledWith('/tmp/pic.jpg', DEST);
    });

    it('creates the dir (mkdir) when the folder is absent', async () => {
      mockLaunchCamera.mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/cam.jpg' }] });
      mockExists.mockResolvedValueOnce(false); // dir absent

      const result = await service.pickFromCamera();

      expect(mockMkdir).toHaveBeenCalledWith(PHOTO_DIR);
      expect(result).toEqual({ uri: DEST });
    });

    it('throws processing_failed when copy fails', async () => {
      mockLaunchLibrary.mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/pic.jpg' }] });
      mockExists.mockResolvedValueOnce(true);
      mockCopyFile.mockRejectedValueOnce(new Error('disk full'));

      await expect(service.pickFromLibrary()).rejects.toMatchObject({
        code: 'processing_failed',
      });
      expect(crashReporter.captureException).toHaveBeenCalled();
    });

    it('throws processing_failed when the picker returns no usable asset', async () => {
      mockLaunchLibrary.mockResolvedValueOnce({ assets: [{}] });

      await expect(service.pickFromLibrary()).rejects.toMatchObject({
        code: 'processing_failed',
      });
    });
  });

  // ─── Erreur inattendue (rejet de promesse) ────────────────
  describe('unexpected errors', () => {
    it('maps a thrown rejection to ProfilePhotoError(unknown) + crashReporter', async () => {
      mockLaunchLibrary.mockRejectedValueOnce(new Error('native crash'));

      const error = await service.pickFromLibrary().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ProfilePhotoError);
      expect((error as ProfilePhotoError).code).toBe('unknown');
      expect(crashReporter.captureException).toHaveBeenCalled();
    });

    it('throws unknown when the native response shape is invalid (Zod rejects)', async () => {
      // errorCode hors enum → safeParse échoue
      mockLaunchLibrary.mockResolvedValueOnce({ errorCode: 42 });

      await expect(service.pickFromLibrary()).rejects.toMatchObject({ code: 'unknown' });
    });
  });

  // ─── deletePhoto (idempotent) ─────────────────────────────
  describe('deletePhoto', () => {
    it('unlinks the file when it exists', async () => {
      mockExists.mockResolvedValueOnce(true);

      await service.deletePhoto('file:///mock/Documents/profile-photos/abc.jpg');

      expect(mockUnlink).toHaveBeenCalledWith('/mock/Documents/profile-photos/abc.jpg');
    });

    it('is a no-op when the file is absent (does not throw, no unlink)', async () => {
      mockExists.mockResolvedValueOnce(false);

      await expect(service.deletePhoto('/missing.jpg')).resolves.toBeUndefined();
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('never throws when unlink fails (logs + reports)', async () => {
      mockExists.mockResolvedValueOnce(true);
      mockUnlink.mockRejectedValueOnce(new Error('locked'));

      await expect(service.deletePhoto('/x.jpg')).resolves.toBeUndefined();
      expect(crashReporter.captureException).toHaveBeenCalled();
    });
  });

  // ─── Sans crashReporter (optionnel) ───────────────────────
  describe('without a crash reporter', () => {
    it('still works when no crashReporter is provided', async () => {
      const bare = new ImagePickerProfilePhotoService();
      mockLaunchLibrary.mockResolvedValueOnce({ didCancel: true });

      await expect(bare.pickFromLibrary()).resolves.toBeNull();
    });
  });
});

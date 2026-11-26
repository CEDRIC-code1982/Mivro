/**
 * @file ImagePickerProfilePhotoService.test.ts
 * @description Unit tests for the ImagePickerProfilePhotoService adapter (F7 pass 2).
 *
 *              image-picker + react-native-fs are mocked in jest.setup.js;
 *              each test overrides the expected behavior via jest.mocked(...).
 *
 * @module services/infra/media/ImagePickerProfilePhotoService.test
 */

// [ADDED] F7 pass 2 — ImagePickerProfilePhotoService unit tests
import {
  copyFile,
  exists,
  mkdir,
  unlink,
  DocumentDirectoryPath,
} from '@dr.pogodin/react-native-fs';
import { mock } from 'jest-mock-extended';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import { ProfilePhotoError } from '@services/domain/user/IProfilePhotoService';
import { ImagePickerProfilePhotoService } from '@services/infra/media/ImagePickerProfilePhotoService';

// ─── Mock uuid (deterministic destination path) ─────────────
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

  // ─── User cancellation ────────────────────────────────────
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

  // ─── Permission denied ────────────────────────────────────
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

  // ─── Success → copy into Documents ────────────────────────
  describe('success', () => {
    it('copies into Documents and returns the dest path (dir already exists)', async () => {
      mockLaunchLibrary.mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/pic.jpg' }] });
      mockExists.mockResolvedValueOnce(true); // dir exists

      const result = await service.pickFromLibrary();

      expect(result).toEqual({ uri: DEST });
      expect(mockMkdir).not.toHaveBeenCalled();
      // file:// stripped from the source
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

  // ─── Unexpected error (promise rejection) ─────────────────
  describe('unexpected errors', () => {
    it('maps a thrown rejection to ProfilePhotoError(unknown) + crashReporter', async () => {
      mockLaunchLibrary.mockRejectedValueOnce(new Error('native crash'));

      const error = await service.pickFromLibrary().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ProfilePhotoError);
      expect((error as ProfilePhotoError).code).toBe('unknown');
      expect(crashReporter.captureException).toHaveBeenCalled();
    });

    it('throws unknown when the native response shape is invalid (Zod rejects)', async () => {
      // errorCode outside the enum → safeParse fails
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

    it('never throws when unlink fails (logs + reports at warning level)', async () => {
      mockExists.mockResolvedValueOnce(true);
      const unlinkError = new Error('locked');
      mockUnlink.mockRejectedValueOnce(unlinkError);

      await expect(service.deletePhoto('/x.jpg')).resolves.toBeUndefined();
      expect(crashReporter.captureException).toHaveBeenCalledWith(
        unlinkError,
        expect.objectContaining({ level: 'warning' }),
      );
    });

    it('never throws when exists rejects (reports at warning level, no unlink)', async () => {
      mockExists.mockRejectedValueOnce(new Error('stat failed'));

      await expect(service.deletePhoto('/x.jpg')).resolves.toBeUndefined();
      expect(mockUnlink).not.toHaveBeenCalled();
      expect(crashReporter.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ level: 'warning' }),
      );
    });

    it('never throws when the crash reporter itself throws', async () => {
      mockExists.mockResolvedValueOnce(true);
      mockUnlink.mockRejectedValueOnce(new Error('locked'));
      crashReporter.captureException.mockImplementationOnce(() => {
        throw new Error('reporter down');
      });

      await expect(service.deletePhoto('/x.jpg')).resolves.toBeUndefined();
      expect(crashReporter.captureException).toHaveBeenCalledTimes(1);
    });

    it('never throws without a crash reporter when unlink fails', async () => {
      const bare = new ImagePickerProfilePhotoService();
      // Returns the spy already installed (and silenced) in beforeEach.
      const warnSpy = jest.spyOn(console, 'warn');
      mockExists.mockResolvedValueOnce(true);
      mockUnlink.mockRejectedValueOnce(new Error('locked'));

      await expect(bare.deletePhoto('/x.jpg')).resolves.toBeUndefined();
      // Proves the catch branch ran (it logs before the optional report).
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── normalizePath (private, exercised through deletePhoto) ─
  describe('path normalization (via deletePhoto)', () => {
    it.each([
      ['decodes an encoded space', 'file:///a/b%20c.jpg', '/a/b c.jpg'],
      ['decodes an encoded accented character', 'file:///a/%C3%A9.jpg', '/a/é.jpg'],
      ['strips the scheme without decoding a lone %', 'file:///a/100%.jpg', '/a/100%.jpg'],
      [
        'strips the scheme without decoding a truncated escape',
        'file:///a/%E0%A4%A.jpg',
        '/a/%E0%A4%A.jpg',
      ],
    ])('file:// URI: %s', async (_label, uri, expectedPath) => {
      mockExists.mockResolvedValueOnce(true);

      await expect(service.deletePhoto(uri)).resolves.toBeUndefined();
      expect(mockExists).toHaveBeenCalledWith(expectedPath);
      expect(mockUnlink).toHaveBeenCalledWith(expectedPath);
      expect(crashReporter.captureException).not.toHaveBeenCalled();
    });

    it.each([
      ['a stored Documents path', `${PHOTO_DIR}/fixed-uuid.jpg`],
      ['a raw path with a literal %20 (never decoded)', '/a/b%20c.jpg'],
      ['a raw path with a lone %', '/a/100%.jpg'],
      ['a raw path containing file:// in the middle', '/x/file:///y.jpg'],
    ])('raw path is passed through untouched: %s', async (_label, path) => {
      mockExists.mockResolvedValueOnce(true);

      await expect(service.deletePhoto(path)).resolves.toBeUndefined();
      expect(mockExists).toHaveBeenCalledWith(path);
      expect(mockUnlink).toHaveBeenCalledWith(path);
      expect(crashReporter.captureException).not.toHaveBeenCalled();
    });
  });

  // ─── normalizePath (exercised through copyIntoDocuments) ──
  describe('path normalization (via copyIntoDocuments)', () => {
    it('passes the decoded path to copyFile for an encoded library file:// URI', async () => {
      mockLaunchLibrary.mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/my%20pic.jpg' }] });
      mockExists.mockResolvedValueOnce(true);

      const result = await service.pickFromLibrary();

      expect(result).toEqual({ uri: DEST });
      expect(mockCopyFile).toHaveBeenCalledWith('/tmp/my pic.jpg', DEST);
    });

    it('passes the decoded path to copyFile for an encoded camera file:// URI', async () => {
      mockLaunchCamera.mockResolvedValueOnce({
        assets: [{ uri: 'file:///tmp/%C3%A9t%C3%A9.jpg' }],
      });
      mockExists.mockResolvedValueOnce(true);

      const result = await service.pickFromCamera();

      expect(result).toEqual({ uri: DEST });
      expect(mockCopyFile).toHaveBeenCalledWith('/tmp/été.jpg', DEST);
    });

    it('passes the undecoded path to copyFile when the escape is malformed', async () => {
      mockLaunchLibrary.mockResolvedValueOnce({ assets: [{ uri: 'file:///tmp/100%.jpg' }] });
      mockExists.mockResolvedValueOnce(true);

      await expect(service.pickFromLibrary()).resolves.toEqual({ uri: DEST });
      expect(mockCopyFile).toHaveBeenCalledWith('/tmp/100%.jpg', DEST);
    });
  });

  // ─── Without crashReporter (optional) ─────────────────────
  describe('without a crash reporter', () => {
    it('still works when no crashReporter is provided', async () => {
      const bare = new ImagePickerProfilePhotoService();
      mockLaunchLibrary.mockResolvedValueOnce({ didCancel: true });

      await expect(bare.pickFromLibrary()).resolves.toBeNull();
    });
  });
});

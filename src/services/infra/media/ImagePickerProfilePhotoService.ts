/**
 * @file ImagePickerProfilePhotoService.ts
 * @description IProfilePhotoService implementation based on
 *              react-native-image-picker + @dr.pogodin/react-native-fs.
 *
 *              Responsibilities:
 *              - Library/camera picking with native resize (maxWidth/maxHeight 200)
 *              - Copy of the picked file into Documents/profile-photos/
 *              - Deletion (cleanup) of a local photo
 *              - Mapping of native errors → typed ProfilePhotoError (ERR-001)
 *              - Zod validation of the native response (TS-004)
 *
 *              ⚠️ User cancellation is NOT an error → returns null.
 *
 * @module services/infra/media/ImagePickerProfilePhotoService
 */

// [ADDED] F7 pass 2 — Adapter ImagePickerProfilePhotoService
import {
  copyFile,
  exists,
  mkdir,
  unlink,
  DocumentDirectoryPath,
} from '@dr.pogodin/react-native-fs';
import {
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import {
  ProfilePhotoError,
  type IProfilePhotoService,
  type PickProfilePhotoResult,
} from '@services/domain/user/IProfilePhotoService';

/** Target profile photo side in points */
const PHOTO_SIZE = 200;

/** JPEG compression quality (0..1) */
const PHOTO_QUALITY = 0.8;

/** Profile photos storage subfolder */
const PHOTO_DIR = `${DocumentDirectoryPath}/profile-photos`;

/**
 * Native picker response validation schema (TS-004 — external data).
 */
const PickerResponseSchema = z.object({
  didCancel: z.boolean().optional(),
  errorCode: z.enum(['camera_unavailable', 'permission', 'others']).optional(),
  errorMessage: z.string().optional(),
  assets: z
    .array(
      z.object({
        uri: z.string().min(1).optional(),
      }),
    )
    .optional(),
});

/**
 * IProfilePhotoService implementation via image-picker + FS.
 *
 * @param crashReporter - Optional crash reporter (Sentry)
 *
 * @example
 *   const service = new ImagePickerProfilePhotoService(crashReporter);
 *   const result = await service.pickFromLibrary();
 */
export class ImagePickerProfilePhotoService implements IProfilePhotoService {
  constructor(private readonly crashReporter?: ICrashReporter) {}

  /**
   * Opens the library, resizes to 200×200 and copies into Documents.
   *
   * @returns Local path, or null (cancellation)
   * @throws {ProfilePhotoError} Permission denied or processing failure
   */
  async pickFromLibrary(): Promise<PickProfilePhotoResult> {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      maxWidth: PHOTO_SIZE,
      maxHeight: PHOTO_SIZE,
      quality: PHOTO_QUALITY,
      selectionLimit: 1,
      includeBase64: false,
    };

    try {
      const response = await launchImageLibrary(options);
      return await this.handlePickerResponse(response, 'pickFromLibrary');
    } catch (error: unknown) {
      throw this.toProfilePhotoError(error, 'pickFromLibrary');
    }
  }

  /**
   * Opens the camera, resizes to 200×200 and copies into Documents.
   *
   * @returns Local path, or null (cancellation)
   * @throws {ProfilePhotoError} Permission denied, camera unavailable or failure
   */
  async pickFromCamera(): Promise<PickProfilePhotoResult> {
    const options: CameraOptions = {
      mediaType: 'photo',
      maxWidth: PHOTO_SIZE,
      maxHeight: PHOTO_SIZE,
      quality: PHOTO_QUALITY,
      saveToPhotos: false,
      includeBase64: false,
      // Front camera on purpose: product choice validated by Cédric on 2026-11-26
      // (a profile photo is a selfie). Kept deliberately, do not switch to 'back'.
      cameraType: 'front',
    };

    try {
      const response = await launchCamera(options);
      return await this.handlePickerResponse(response, 'pickFromCamera');
    } catch (error: unknown) {
      throw this.toProfilePhotoError(error, 'pickFromCamera');
    }
  }

  /**
   * Deletes a local photo (idempotent — ignored if missing).
   *
   * Never rejects, as required by the port contract
   * (IProfilePhotoService.deletePhoto): every failure, path normalization
   * included, is caught below and reported to the crash reporter at warning
   * level.
   *
   * @param uri - Local path (or `file://` URI) of the photo
   */
  async deletePhoto(uri: string): Promise<void> {
    try {
      const path = this.normalizePath(uri);
      const fileExists = await exists(path);
      if (!fileExists) {
        return;
      }
      await unlink(path);
      console.log(
        `[INFO][ImagePickerProfilePhotoService][deletePhoto][?][${this.timestamp()}] ` +
          'Profile photo deleted',
      );
    } catch (error: unknown) {
      // Cleanup must never break the flow: log + report without throwing.
      console.warn(
        `[WARN][ImagePickerProfilePhotoService][deletePhoto][?][${this.timestamp()}] ` +
          'Failed to delete profile photo',
        error,
      );
      try {
        this.crashReporter?.captureException(
          error instanceof Error ? error : new Error('deletePhoto failed'),
          { tags: { feature: 'profile-photo' }, level: 'warning' },
        );
      } catch {
        // Reporting must not make deletePhoto reject: the port promises that
        // deletePhoto never rejects, so a crash reporter failure is swallowed.
      }
    }
  }

  /**
   * Handles the picker response: cancellation, error, or file copy.
   *
   * @param response - Raw picker response
   * @param fn - Caller function name (logging)
   * @returns Local path or null
   * @throws {ProfilePhotoError} On permission or processing error
   */
  private async handlePickerResponse(
    response: ImagePickerResponse,
    fn: string,
  ): Promise<PickProfilePhotoResult> {
    // Zod validation of the native response (TS-004)
    const parsed = PickerResponseSchema.safeParse(response);
    if (!parsed.success) {
      this.crashReporter?.captureException(new Error('Picker response shape invalid'), {
        tags: { feature: 'profile-photo' },
      });
      throw new ProfilePhotoError('Picker response shape invalid', 'unknown', parsed.error);
    }

    const { didCancel, errorCode, errorMessage, assets } = parsed.data;

    // User cancellation: not an error
    if (didCancel === true) {
      console.log(
        `[INFO][ImagePickerProfilePhotoService][${fn}][?][${this.timestamp()}] ` +
          'User cancelled photo selection',
      );
      return null;
    }

    // Native picker error → typed mapping
    if (errorCode !== undefined) {
      throw this.mapPickerErrorCode(errorCode, errorMessage, fn);
    }

    const firstAsset = assets?.[0];
    if (firstAsset?.uri == null) {
      // Response with no asset, no error and no cancellation: abnormal case
      throw new ProfilePhotoError('Picker returned no usable asset', 'processing_failed');
    }

    return { uri: await this.copyIntoDocuments(firstAsset.uri) };
  }

  /**
   * Copies the picked (already resized) file into Documents/profile-photos/
   * under a unique name, and returns the path.
   *
   * @param sourceUri - Source file URI (file://…)
   * @returns Destination path in Documents
   * @throws {ProfilePhotoError} If the copy fails
   */
  private async copyIntoDocuments(sourceUri: string): Promise<string> {
    try {
      const dirExists = await exists(PHOTO_DIR);
      if (!dirExists) {
        await mkdir(PHOTO_DIR);
      }

      const destPath = `${PHOTO_DIR}/${uuidv4()}.jpg`;
      await copyFile(this.normalizePath(sourceUri), destPath);

      console.log(
        `[INFO][ImagePickerProfilePhotoService][copyIntoDocuments][?][${this.timestamp()}] ` +
          'Profile photo copied to Documents',
      );

      return destPath;
    } catch (error: unknown) {
      this.crashReporter?.captureException(
        error instanceof Error ? error : new Error('copyIntoDocuments failed'),
        { tags: { feature: 'profile-photo' } },
      );
      throw new ProfilePhotoError('Failed to store profile photo', 'processing_failed', error);
    }
  }

  /**
   * Normalizes a `file://` URI into an absolute filesystem path.
   *
   * Only a URI that starts with `file://` is transformed: the leading scheme is
   * stripped, then the rest is percent-decoded, because a picker URI is a URL
   * and a space or an accented character in the path arrives as `%20` /
   * `%C3%A9`, which the filesystem would not find verbatim.
   *
   * Anything without that leading prefix is already a filesystem path and is
   * returned untouched, never decoded: the paths stored by `copyIntoDocuments`
   * (`<Documents>/profile-photos/<uuid>.jpg`) and later passed to
   * `deletePhoto` must never be rewritten (a literal `%xx` in a raw path would
   * otherwise be altered).
   *
   * Never throws: on a malformed percent-escape, `decodeURIComponent` raises a
   * `URIError` (the only error it can raise) and the path is returned with the
   * scheme stripped but undecoded. Silent fallback on purpose: the caller then
   * works on that path, and any real filesystem failure surfaces from the FS
   * call itself.
   *
   * @param uri - URI or path
   * @returns Filesystem path
   */
  private normalizePath(uri: string): string {
    const FILE_SCHEME = 'file://';
    if (!uri.startsWith(FILE_SCHEME)) {
      return uri;
    }
    const withoutScheme = uri.slice(FILE_SCHEME.length);
    try {
      return decodeURIComponent(withoutScheme);
    } catch {
      return withoutScheme;
    }
  }

  /**
   * Maps a native picker error code to a typed ProfilePhotoError.
   *
   * @param code - Native code
   * @param message - Optional native message
   * @param fn - Caller function name
   * @returns Typed ProfilePhotoError
   */
  private mapPickerErrorCode(
    code: 'camera_unavailable' | 'permission' | 'others',
    message: string | undefined,
    fn: string,
  ): ProfilePhotoError {
    let mappedCode: ProfilePhotoError['code'];
    switch (code) {
      case 'permission':
        mappedCode = 'permission_denied';
        this.crashReporter?.captureMessage('Profile photo permission denied', {
          level: 'info',
          tags: { feature: 'profile-photo' },
        });
        break;
      case 'camera_unavailable':
        mappedCode = 'camera_unavailable';
        break;
      default:
        mappedCode = 'unknown';
        this.crashReporter?.captureMessage('Profile photo picker error', {
          level: 'warning',
          tags: { feature: 'profile-photo' },
        });
    }

    console.warn(
      `[WARN][ImagePickerProfilePhotoService][${fn}][?][${this.timestamp()}] ` +
        `Picker error | code: ${mappedCode}`,
    );

    return new ProfilePhotoError(message ?? `Picker error: ${code}`, mappedCode);
  }

  /**
   * Converts an unexpected error (promise rejection) into a ProfilePhotoError.
   *
   * @param error - Caught error
   * @param fn - Caller function name
   * @returns Typed ProfilePhotoError
   */
  private toProfilePhotoError(error: unknown, fn: string): ProfilePhotoError {
    // Already typed: propagate it as is (e.g. from copyIntoDocuments)
    if (error instanceof ProfilePhotoError) {
      return error;
    }

    console.error(
      `[ERROR][ImagePickerProfilePhotoService][${fn}][?][${this.timestamp()}] ` +
        'Unexpected picker error',
      error,
    );
    this.crashReporter?.captureException(
      error instanceof Error ? error : new Error('Profile photo picker failed'),
      { tags: { feature: 'profile-photo' } },
    );
    return new ProfilePhotoError(
      error instanceof Error ? error.message : 'Unknown profile photo error',
      'unknown',
      error,
    );
  }

  /**
   * Generates an HH:mm:ss timestamp for logging (LOG-001).
   *
   * @returns Formatted timestamp
   */
  private timestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }
}

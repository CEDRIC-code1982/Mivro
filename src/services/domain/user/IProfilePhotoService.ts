/**
 * @file IProfilePhotoService.ts
 * @description Abstract port for profile photo management.
 *
 *              Encapsulates picking (library / camera), resizing and local
 *              (FileSystem) storage of the profile photo, plus cleanup. The
 *              presentation layer goes through this port and NEVER imports
 *              image-picker nor react-native-fs directly.
 *
 *              Implementations: ImagePickerProfilePhotoService (infrastructure/).
 *
 * @module services/domain/user/IProfilePhotoService
 */

// [ADDED] F7 pass 2 — IProfilePhotoService port + typed error

/**
 * Result of a profile photo selection.
 *
 * `null` represents a **user cancellation**: this is NOT an error, the caller
 * should change nothing.
 */
export type PickProfilePhotoResult = {
  /** Local path of the resized copied photo */
  uri: string;
} | null;

/**
 * Typed error codes for profile photo management.
 *
 * - `permission_denied` : camera or library permission denied
 * - `camera_unavailable` : camera unavailable (e.g. simulator)
 * - `processing_failed` : resize or FileSystem copy failure
 * - `unknown` : unexpected error
 */
export type ProfilePhotoErrorCode =
  | 'permission_denied'
  | 'camera_unavailable'
  | 'processing_failed'
  | 'unknown';

/**
 * Typed business error for the profile photo.
 *
 * @param message - Human-readable message (not shown to the user as is)
 * @param code - Typed error code (mapped to an i18n message)
 * @param cause - Optional original error
 */
export class ProfilePhotoError extends Error {
  constructor(
    message: string,
    public readonly code: ProfilePhotoErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProfilePhotoError';
  }
}

/**
 * Abstract port for the profile photo.
 *
 * @example
 *   const result = await profilePhotoService.pickFromLibrary();
 *   if (result) updateProfile({ photoUri: result.uri });
 */
export interface IProfilePhotoService {
  /**
   * Opens the photo library, resizes to 200×200 and copies the result into
   * the app's Documents directory.
   *
   * @returns Local path of the photo, or `null` if cancelled
   * @throws {ProfilePhotoError} Permission denied or processing failure
   */
  pickFromLibrary(): Promise<PickProfilePhotoResult>;

  /**
   * Opens the camera, resizes to 200×200 and copies the result into the
   * app's Documents directory.
   *
   * @returns Local path of the photo, or `null` if cancelled
   * @throws {ProfilePhotoError} Permission denied, camera unavailable or failure
   */
  pickFromCamera(): Promise<PickProfilePhotoResult>;

  /**
   * Deletes a locally stored profile photo (FileSystem cleanup).
   *
   * Best-effort and **never rejects**: the returned promise always resolves,
   * whether the file was deleted, was already missing (idempotent), or could
   * not be deleted at all. A missing or undeletable file must not break the
   * profile update: callers await this method without a dedicated catch,
   * right after having already persisted the new profile state
   * (`useProfilePhoto.ts` — photo replacement in `pickPhoto` and removal in
   * `removePhoto`). Implementations must therefore absorb their own errors
   * (e.g. report them to the crash reporter) instead of propagating them.
   *
   * @param uri - Local path of the photo to delete
   * @returns A promise that always resolves
   */
  deletePhoto(uri: string): Promise<void>;
}

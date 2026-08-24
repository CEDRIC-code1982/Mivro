/**
 * @file ImagePickerProfilePhotoService.ts
 * @description Implémentation IProfilePhotoService basée sur
 *              react-native-image-picker + @dr.pogodin/react-native-fs.
 *              IProfilePhotoService implementation based on
 *              react-native-image-picker + @dr.pogodin/react-native-fs.
 *
 *              Responsabilités / Responsibilities:
 *              - Sélection galerie/caméra avec resize natif (maxWidth/maxHeight 200)
 *              - Copie du fichier sélectionné dans Documents/profile-photos/
 *              - Suppression (cleanup) d'une photo locale
 *              - Mapping des erreurs natives → ProfilePhotoError typé (ERR-001)
 *              - Validation Zod de la réponse native (TS-004)
 *
 *              ⚠️ L'annulation utilisateur n'est PAS une erreur → renvoie null.
 *              ⚠️ User cancellation is NOT an error → returns null.
 *
 * @module services/infra/media/ImagePickerProfilePhotoService
 */

// [ADDED] F7 passe 2 — Adapter ImagePickerProfilePhotoService
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

/** Côté cible de la photo de profil en points / Target profile photo side in points */
const PHOTO_SIZE = 200;

/** Qualité de compression JPEG (0..1) / JPEG compression quality (0..1) */
const PHOTO_QUALITY = 0.8;

/** Sous-dossier de stockage des photos de profil / Profile photos storage subfolder */
const PHOTO_DIR = `${DocumentDirectoryPath}/profile-photos`;

/**
 * Schéma de validation de la réponse native du picker (TS-004 — données externes).
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
 * Implémentation du port IProfilePhotoService via image-picker + FS.
 * IProfilePhotoService implementation via image-picker + FS.
 *
 * @param crashReporter - Crash reporter optionnel pour Sentry / Optional crash reporter
 *
 * @example
 *   const service = new ImagePickerProfilePhotoService(crashReporter);
 *   const result = await service.pickFromLibrary();
 */
export class ImagePickerProfilePhotoService implements IProfilePhotoService {
  constructor(private readonly crashReporter?: ICrashReporter) {}

  /**
   * Ouvre la galerie, redimensionne 200×200 et copie dans Documents.
   * Opens the library, resizes to 200×200 and copies into Documents.
   *
   * @returns Chemin local ou null (annulation) / Local path or null (cancellation)
   * @throws {ProfilePhotoError} Permission refusée ou échec de traitement / Permission denied or processing failure
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
   * Ouvre la caméra, redimensionne 200×200 et copie dans Documents.
   * Opens the camera, resizes to 200×200 and copies into Documents.
   *
   * @returns Chemin local ou null (annulation) / Local path or null (cancellation)
   * @throws {ProfilePhotoError} Permission refusée, caméra indisponible ou échec / Permission denied, camera unavailable or failure
   */
  async pickFromCamera(): Promise<PickProfilePhotoResult> {
    const options: CameraOptions = {
      mediaType: 'photo',
      maxWidth: PHOTO_SIZE,
      maxHeight: PHOTO_SIZE,
      quality: PHOTO_QUALITY,
      saveToPhotos: false,
      includeBase64: false,
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
   * Supprime une photo locale (idempotent — ignore si absente).
   * Deletes a local photo (idempotent — ignored if missing).
   *
   * @param uri - Chemin local de la photo / Local path of the photo
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
      // Le cleanup ne doit jamais casser le flux : on logge + report sans throw.
      // Cleanup must never break the flow: log + report without throwing.
      console.warn(
        `[WARN][ImagePickerProfilePhotoService][deletePhoto][?][${this.timestamp()}] ` +
          'Failed to delete profile photo',
        error,
      );
      this.crashReporter?.captureException(
        error instanceof Error ? error : new Error('deletePhoto failed'),
        { tags: { feature: 'profile-photo' }, level: 'warning' },
      );
    }
  }

  /**
   * Traite la réponse du picker : annulation, erreur, ou copie du fichier.
   * Handles the picker response: cancellation, error, or file copy.
   *
   * @param response - Réponse brute du picker / Raw picker response
   * @param fn - Nom de la fonction appelante (logging) / Caller function name (logging)
   * @returns Chemin local ou null / Local path or null
   * @throws {ProfilePhotoError} En cas d'erreur de permission ou de traitement / On permission or processing error
   */
  private async handlePickerResponse(
    response: ImagePickerResponse,
    fn: string,
  ): Promise<PickProfilePhotoResult> {
    // Validation Zod de la réponse native (TS-004)
    const parsed = PickerResponseSchema.safeParse(response);
    if (!parsed.success) {
      this.crashReporter?.captureException(new Error('Picker response shape invalid'), {
        tags: { feature: 'profile-photo' },
      });
      throw new ProfilePhotoError('Picker response shape invalid', 'unknown', parsed.error);
    }

    const { didCancel, errorCode, errorMessage, assets } = parsed.data;

    // Annulation utilisateur : pas une erreur
    if (didCancel === true) {
      console.log(
        `[INFO][ImagePickerProfilePhotoService][${fn}][?][${this.timestamp()}] ` +
          'User cancelled photo selection',
      );
      return null;
    }

    // Erreur native du picker → mapping typé
    if (errorCode !== undefined) {
      throw this.mapPickerErrorCode(errorCode, errorMessage, fn);
    }

    const firstAsset = assets?.[0];
    if (firstAsset?.uri == null) {
      // Réponse sans asset ni erreur ni annulation : cas anormal
      throw new ProfilePhotoError('Picker returned no usable asset', 'processing_failed');
    }

    return { uri: await this.copyIntoDocuments(firstAsset.uri) };
  }

  /**
   * Copie le fichier sélectionné (déjà redimensionné par le picker) dans
   * Documents/profile-photos/ sous un nom unique, et renvoie le chemin.
   * Copies the picked (already resized) file into Documents/profile-photos/
   * under a unique name, and returns the path.
   *
   * @param sourceUri - URI du fichier source (file://…) / Source file URI
   * @returns Chemin de destination dans Documents / Destination path in Documents
   * @throws {ProfilePhotoError} Si la copie échoue / If the copy fails
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
   * Normalise une URI `file://` en chemin filesystem absolu.
   * Normalizes a `file://` URI into an absolute filesystem path.
   *
   * @param uri - URI ou chemin / URI or path
   * @returns Chemin filesystem / Filesystem path
   */
  private normalizePath(uri: string): string {
    return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
  }

  /**
   * Mappe un code d'erreur natif du picker vers une ProfilePhotoError typée.
   * Maps a native picker error code to a typed ProfilePhotoError.
   *
   * @param code - Code natif / Native code
   * @param message - Message natif optionnel / Optional native message
   * @param fn - Nom de la fonction appelante / Caller function name
   * @returns ProfilePhotoError typée / Typed ProfilePhotoError
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
   * Convertit une erreur inattendue (rejet de promesse) en ProfilePhotoError.
   * Converts an unexpected error (promise rejection) into a ProfilePhotoError.
   *
   * @param error - Erreur capturée / Caught error
   * @param fn - Nom de la fonction appelante / Caller function name
   * @returns ProfilePhotoError typée / Typed ProfilePhotoError
   */
  private toProfilePhotoError(error: unknown, fn: string): ProfilePhotoError {
    // Déjà typée : on la propage telle quelle (ex : depuis copyIntoDocuments)
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
   * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
   * Generates an HH:mm:ss timestamp for logging (LOG-001).
   *
   * @returns Timestamp formaté / Formatted timestamp
   */
  private timestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }
}

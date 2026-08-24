/**
 * @file IProfilePhotoService.ts
 * @description Port abstrait pour la gestion de la photo de profil.
 *              Abstract port for profile photo management.
 *
 *              Encapsule la sélection (galerie / caméra), le redimensionnement
 *              et le stockage local (FileSystem) de la photo de profil, ainsi
 *              que son nettoyage. La couche présentation passe par ce port et
 *              n'importe JAMAIS image-picker ni react-native-fs directement.
 *              Encapsulates picking (library / camera), resizing and local
 *              (FileSystem) storage of the profile photo, plus cleanup. The
 *              presentation layer goes through this port and NEVER imports
 *              image-picker nor react-native-fs directly.
 *
 *              Implémentations : ImagePickerProfilePhotoService (infrastructure/).
 *              Implementations: ImagePickerProfilePhotoService (infrastructure/).
 *
 * @module services/domain/user/IProfilePhotoService
 */

// [ADDED] F7 passe 2 — Port IProfilePhotoService + erreur typée

/**
 * Résultat d'une sélection de photo de profil.
 * Result of a profile photo selection.
 *
 * `null` représente une **annulation utilisateur** : ce n'est PAS une erreur,
 * l'appelant ne doit rien changer.
 * `null` represents a **user cancellation**: this is NOT an error, the caller
 * should change nothing.
 */
export type PickProfilePhotoResult = {
  /** Chemin local de la photo redimensionnée copiée / Local path of the resized copied photo */
  uri: string;
} | null;

/**
 * Codes d'erreur typés pour la gestion de la photo de profil.
 * Typed error codes for profile photo management.
 *
 * - `permission_denied` : permission caméra/galerie refusée / camera or library permission denied
 * - `camera_unavailable` : caméra indisponible (ex : simulateur) / camera unavailable (e.g. simulator)
 * - `processing_failed` : échec resize / copie FileSystem / resize or FileSystem copy failure
 * - `unknown` : erreur inattendue / unexpected error
 */
export type ProfilePhotoErrorCode =
  | 'permission_denied'
  | 'camera_unavailable'
  | 'processing_failed'
  | 'unknown';

/**
 * Erreur métier typée pour la photo de profil.
 * Typed business error for the profile photo.
 *
 * @param message - Message lisible (non affiché à l'user tel quel) / Human-readable message
 * @param code - Code d'erreur typé (mappé vers un message i18n) / Typed error code
 * @param cause - Erreur originale optionnelle / Optional original error
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
 * Port abstrait pour la photo de profil.
 * Abstract port for the profile photo.
 *
 * @example
 *   const result = await profilePhotoService.pickFromLibrary();
 *   if (result) updateProfile({ photoUri: result.uri });
 */
export interface IProfilePhotoService {
  /**
   * Ouvre la galerie, redimensionne en 200×200 et copie le résultat dans
   * le dossier Documents de l'app.
   * Opens the photo library, resizes to 200×200 and copies the result into
   * the app's Documents directory.
   *
   * @returns Le chemin local de la photo, ou `null` si annulation / Local path, or `null` if cancelled
   * @throws {ProfilePhotoError} Permission refusée ou échec de traitement / Permission denied or processing failure
   */
  pickFromLibrary(): Promise<PickProfilePhotoResult>;

  /**
   * Ouvre la caméra, redimensionne en 200×200 et copie le résultat dans
   * le dossier Documents de l'app.
   * Opens the camera, resizes to 200×200 and copies the result into the
   * app's Documents directory.
   *
   * @returns Le chemin local de la photo, ou `null` si annulation / Local path, or `null` if cancelled
   * @throws {ProfilePhotoError} Permission refusée, caméra indisponible ou échec / Permission denied, camera unavailable or failure
   */
  pickFromCamera(): Promise<PickProfilePhotoResult>;

  /**
   * Supprime une photo de profil stockée localement (nettoyage FileSystem).
   * Deletes a locally stored profile photo (FileSystem cleanup).
   *
   * Idempotent : ne lève pas si le fichier n'existe plus.
   * Idempotent: does not throw if the file no longer exists.
   *
   * @param uri - Chemin local de la photo à supprimer / Local path of the photo to delete
   */
  deletePhoto(uri: string): Promise<void>;
}

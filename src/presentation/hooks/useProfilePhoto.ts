/**
 * @file useProfilePhoto.ts
 * @description Hook d'orchestration de la photo de profil (F7 passe 2).
 *              Profile photo orchestration hook (F7 pass 2).
 *
 *              Responsabilités / Responsibilities:
 *              - Sélection galerie / caméra via IProfilePhotoService (port DI)
 *              - Persistance du chemin dans le profil (updateProfile → MMKV)
 *              - Suppression de la photo + nettoyage FileSystem (cleanup)
 *              - Remplacement : supprime l'ancien fichier après mise à jour
 *              - États loading / error typés (ERR-003) ; annulation = no-op
 *
 *              L'écran n'importe JAMAIS image-picker ni le FileSystem : il
 *              passe par ce hook, qui passe par le container DI.
 *              The screen NEVER imports image-picker nor FileSystem: it goes
 *              through this hook, which goes through the DI container.
 *
 * @module presentation/hooks/useProfilePhoto
 */

// [ADDED] F7 passe 2 — Hook useProfilePhoto
import { useCallback, useState } from 'react';
import { getContainer } from '@/di/container';
import { ProfilePhotoError, type ProfilePhotoErrorCode } from '@core/ports/IProfilePhotoService';
import { useAuthActions, useAuthUser } from '@presentation/hooks/useAuth';

/**
 * Source de sélection d'une photo de profil.
 * Profile photo selection source.
 */
export type ProfilePhotoSource = 'library' | 'camera';

/**
 * Résultat du hook useProfilePhoto.
 * useProfilePhoto hook result.
 */
export interface UseProfilePhotoResult {
  /** Chemin de la photo courante (depuis le profil) ou null / Current photo path or null */
  photoUri: string | null;
  /** true si une opération (pick / delete) est en cours / true if an operation is in progress */
  isBusy: boolean;
  /** Code d'erreur de la dernière opération, ou null / Last operation error code, or null */
  error: ProfilePhotoErrorCode | null;
  /** Sélectionne une photo (galerie ou caméra) / Picks a photo (library or camera) */
  pickPhoto: (source: ProfilePhotoSource) => Promise<void>;
  /** Supprime la photo courante (+ cleanup FileSystem) / Removes the current photo (+ FS cleanup) */
  removePhoto: () => Promise<void>;
  /** Réinitialise l'erreur courante / Clears the current error */
  clearError: () => void;
}

/**
 * Génère un timestamp HH:mm:ss pour le logging (LOG-001).
 * Generates an HH:mm:ss timestamp for logging (LOG-001).
 *
 * @returns Timestamp formaté / Formatted timestamp
 */
const timestamp = (): string => new Date().toISOString().slice(11, 19);

/**
 * Hook d'orchestration de la photo de profil.
 * Profile photo orchestration hook.
 *
 * @returns Résultat du hook / Hook result
 */
export const useProfilePhoto = (): UseProfilePhotoResult => {
  const user = useAuthUser();
  const { updateProfile } = useAuthActions();

  const photoUri = user?.photoUri ?? null;

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<ProfilePhotoErrorCode | null>(null);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * Sélectionne une photo depuis la galerie ou la caméra, la persiste et
   * nettoie l'ancien fichier en cas de remplacement.
   * Picks a photo from library or camera, persists it and cleans up the old
   * file on replacement.
   *
   * @param source - Source de sélection / Selection source
   */
  const pickPhoto = useCallback(
    async (source: ProfilePhotoSource): Promise<void> => {
      if (isBusy) return;

      setIsBusy(true);
      setError(null);

      const previousUri = photoUri;

      try {
        const { profilePhotoService } = getContainer();
        const result =
          source === 'camera'
            ? await profilePhotoService.pickFromCamera()
            : await profilePhotoService.pickFromLibrary();

        // Annulation utilisateur : ne rien changer (pas une erreur)
        if (result === null) {
          return;
        }

        // Persiste le nouveau chemin dans le profil (MMKV)
        updateProfile({ photoUri: result.uri });

        // Nettoyage du fichier précédent (remplacement) — best-effort
        if (previousUri != null && previousUri !== result.uri) {
          await profilePhotoService.deletePhoto(previousUri);
        }

        console.log(
          `[INFO][useProfilePhoto][pickPhoto][?][${timestamp()}] ` +
            `Profile photo updated | source: ${source}`,
        );
      } catch (err: unknown) {
        const code: ProfilePhotoErrorCode = err instanceof ProfilePhotoError ? err.code : 'unknown';
        setError(code);
        console.error(
          `[ERROR][useProfilePhoto][pickPhoto][?][${timestamp()}] ` +
            `Failed to pick photo | code: ${code}`,
          err,
        );
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, photoUri, updateProfile],
  );

  /**
   * Supprime la photo de profil courante (profil + fichier local).
   * Removes the current profile photo (profile + local file).
   */
  const removePhoto = useCallback(async (): Promise<void> => {
    if (isBusy || photoUri == null) return;

    setIsBusy(true);
    setError(null);

    try {
      // Efface d'abord la référence dans le profil (photoUri = null)
      updateProfile({ photoUri: null });
      // Puis nettoie le fichier local (best-effort, ne throw pas)
      const { profilePhotoService } = getContainer();
      await profilePhotoService.deletePhoto(photoUri);

      console.log(`[INFO][useProfilePhoto][removePhoto][?][${timestamp()}] Profile photo removed`);
    } catch (err: unknown) {
      const code: ProfilePhotoErrorCode = err instanceof ProfilePhotoError ? err.code : 'unknown';
      setError(code);
      console.error(
        `[ERROR][useProfilePhoto][removePhoto][?][${timestamp()}] ` +
          `Failed to remove photo | code: ${code}`,
        err,
      );
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, photoUri, updateProfile]);

  return {
    photoUri,
    isBusy,
    error,
    pickPhoto,
    removePhoto,
    clearError,
  };
};

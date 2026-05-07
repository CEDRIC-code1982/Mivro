/**
 * @file IGeolocationService.ts
 * @description Port abstrait pour la géolocalisation native.
 *              Abstract port for native geolocation.
 *
 *              Permet de swapper la lib (community/geolocation,
 *              react-native-geolocation-service, expo-location, etc.)
 *              sans toucher au code métier.
 *              Allows swapping the lib without touching business logic.
 *
 * @module core/ports/IGeolocationService
 */

// [ADDED] Port IGeolocationService + GeolocationError + types
import type { Coordinates } from '@core/entities/Location';

/**
 * Options pour la récupération de la position GPS.
 * Options for GPS position retrieval.
 *
 * @param accuracyMeters - Précision souhaitée en mètres (défaut 100) / Desired accuracy in meters
 * @param timeoutMs - Timeout en ms (défaut 10000) / Timeout in ms
 * @param maximumAgeMs - Age max du cache GPS en ms (défaut 60000) / Max GPS cache age in ms
 */
export interface GetCurrentPositionOptions {
  /** Précision souhaitée en mètres (défaut 100, plus bas = plus précis mais + lent) */
  accuracyMeters?: number;
  /** Timeout en ms (défaut 10000ms) / Timeout in ms (default 10000ms) */
  timeoutMs?: number;
  /** Age max du cache GPS en ms (défaut 60000ms) / Max GPS cache age in ms (default 60000ms) */
  maximumAgeMs?: number;
}

/**
 * Port abstrait pour le service de géolocalisation.
 * Abstract port for the geolocation service.
 *
 * Implémentations : RNGeolocationService (infrastructure/).
 * Implementations: RNGeolocationService (infrastructure/).
 *
 * @example
 *   const coords = await geolocationService.getCurrentPosition({ timeoutMs: 5000 });
 */
export interface IGeolocationService {
  /**
   * Récupère la position GPS courante de l'appareil.
   * Retrieves the current GPS position of the device.
   *
   * Demande la permission native si pas encore accordée.
   * Requests native permission if not yet granted.
   * Sur iOS, déclenche le prompt système.
   * Sur Android 6+, utilise PermissionsAndroid.
   *
   * @param options - Options de géolocalisation / Geolocation options
   * @returns Coordonnées GPS / GPS coordinates
   * @throws GeolocationError selon le cas / depending on the case
   */
  getCurrentPosition(options?: GetCurrentPositionOptions): Promise<Coordinates>;
}

/**
 * Codes d'erreur typés pour la géolocalisation.
 * Typed error codes for geolocation.
 *
 * - permission_denied : L'utilisateur a refusé / User denied
 * - permission_blocked : Refusé définitivement (iOS) ou "ne plus demander" (Android)
 * - unavailable : GPS désactivé / Service indisponible
 * - timeout : > timeoutMs sans signal / No signal within timeout
 * - inaccurate : Position trouvée mais accuracy > seuil / Position found but accuracy above threshold
 * - unknown : Erreur inattendue / Unexpected error
 */
export type GeolocationErrorCode =
  | 'permission_denied'
  | 'permission_blocked'
  | 'unavailable'
  | 'timeout'
  | 'inaccurate'
  | 'unknown';

/**
 * Erreur métier de géolocalisation avec code typé.
 * Typed geolocation business error.
 *
 * @param message - Message d'erreur lisible / Human-readable error message
 * @param code - Code d'erreur typé / Typed error code
 * @param cause - Erreur originale (optionnel) / Original error (optional)
 */
export class GeolocationError extends Error {
  constructor(
    message: string,
    public readonly code: GeolocationErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GeolocationError';
  }
}

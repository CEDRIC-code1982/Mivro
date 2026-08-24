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
 * @module services/domain/geolocation/IGeolocationService
 */

// [ADDED] Port IGeolocationService + GeolocationError + types
import type { Coordinates } from '@entities/Location';

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
 * Échantillon de position retourné par le suivi continu (watch).
 * Position sample returned by continuous tracking (watch).
 *
 * Étend {@link Coordinates} avec les métriques de mouvement nécessaires au
 * temps réel (F4 — opti batterie côté store : 5s en mouvement / 30s à l'arrêt).
 * Extends {@link Coordinates} with movement metrics needed for real-time (F4).
 *
 * @param speed - Vitesse en km/h (>= 0, 0 si inconnue) / Speed in km/h (0 if unknown)
 * @param heading - Cap en degrés [0, 360) (0 si inconnu) / Heading in degrees (0 if unknown)
 */
export interface PositionSample extends Coordinates {
  /** Vitesse instantanée en km/h (>= 0) / Instantaneous speed in km/h */
  speed: number;
  /** Cap / orientation en degrés [0, 360) / Heading in degrees [0, 360) */
  heading: number;
}

/**
 * Options pour le suivi continu de position (watchPosition).
 * Options for continuous position tracking (watchPosition).
 *
 * @param accuracyMeters - Précision souhaitée en mètres (défaut 100) / Desired accuracy in meters
 * @param distanceFilterMeters - Distance min (m) entre deux events natifs (défaut 10) / Min distance between native events
 */
export interface WatchPositionOptions {
  /** Précision souhaitée en mètres (défaut 100) / Desired accuracy in meters */
  accuracyMeters?: number;
  /** Distance minimale (m) entre deux notifications natives (défaut 10) / Min distance between native notifications */
  distanceFilterMeters?: number;
}

/**
 * Callback de réception d'un échantillon de position en continu.
 * Callback receiving a continuous position sample.
 *
 * @param sample - Échantillon de position validé / Validated position sample
 */
export type WatchPositionCallback = (sample: PositionSample) => void;

/**
 * Callback d'erreur du suivi continu.
 * Continuous tracking error callback.
 *
 * @param error - Erreur typée / Typed error
 */
export type WatchErrorCallback = (error: GeolocationError) => void;

/**
 * Fonction d'arrêt du suivi continu, retournée par {@link IGeolocationService.watchPosition}.
 * Function to stop continuous tracking, returned by {@link IGeolocationService.watchPosition}.
 */
export type ClearWatch = () => void;

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

  /**
   * Suit la position GPS en continu (pour le temps réel — F4).
   * Continuously watches the GPS position (for real-time — F4).
   *
   * Émet un {@link PositionSample} (coordonnées + vitesse km/h + cap) à chaque
   * changement significatif. Demande la permission native si nécessaire.
   * Le throttling « 5s en mouvement / 30s à l'arrêt » et la désactivation en
   * arrière-plan (AppState) sont gérés par la couche présentation, pas ici.
   *
   * Emits a {@link PositionSample} (coordinates + speed km/h + heading) on each
   * significant change. Requests native permission if needed. Throttling and
   * background deactivation are handled by the presentation layer, not here.
   *
   * @param onSample - Callback de réception d'un échantillon / Sample callback
   * @param onError - Callback d'erreur optionnel / Optional error callback
   * @param options - Options de suivi / Watch options
   * @returns Fonction d'arrêt du suivi / Function to stop the watch
   */
  watchPosition(
    onSample: WatchPositionCallback,
    onError?: WatchErrorCallback,
    options?: WatchPositionOptions,
  ): ClearWatch;
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

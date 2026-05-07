/**
 * @file RNGeolocationService.ts
 * @description Implémentation IGeolocationService basée sur
 *              @react-native-community/geolocation.
 *              IGeolocationService implementation based on
 *              @react-native-community/geolocation.
 *
 *              Gère / Handles:
 *              - Demande de permission runtime (Android 6+ et iOS)
 *              - Timeout, accuracy
 *              - Mapping des erreurs natives → GeolocationError typé
 *
 *              ⚠️ RGPD : aucune coordonnée brute dans les logs.
 *
 * @module infrastructure/geolocation/RNGeolocationService
 */

// [ADDED] Adapter RNGeolocationService
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import { z } from 'zod';
import { CoordinatesSchema } from '@core/entities/Location';
import type { Coordinates } from '@core/entities/Location';
import type { ICrashReporter } from '@core/ports/ICrashReporter';
import type {
  GetCurrentPositionOptions,
  IGeolocationService,
} from '@core/ports/IGeolocationService';
import { GeolocationError } from '@core/ports/IGeolocationService';

/** Codes natifs RN Geolocation / Native RN Geolocation error codes */
const RN_PERMISSION_DENIED = 1;
const RN_POSITION_UNAVAILABLE = 2;
const RN_TIMEOUT = 3;

/**
 * Schéma de validation de la réponse native (TS-004 — données externes).
 * Native response validation schema (TS-004 — external data).
 */
const PositionResponseSchema = z.object({
  coords: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
  }),
});

/**
 * Implémentation RN du port IGeolocationService.
 * RN implementation of the IGeolocationService port.
 *
 * @param crashReporter - Crash reporter optionnel pour Sentry / Optional crash reporter
 *
 * @example
 *   const service = new RNGeolocationService(crashReporter);
 *   const coords = await service.getCurrentPosition({ timeoutMs: 5000 });
 */
export class RNGeolocationService implements IGeolocationService {
  constructor(private readonly crashReporter?: ICrashReporter) {
    // [ADDED] Configuration globale (idempotente)
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
    });
  }

  /**
   * Récupère la position GPS courante.
   * Retrieves the current GPS position.
   *
   * @param options - Options de géolocalisation / Geolocation options
   * @returns Coordonnées GPS validées / Validated GPS coordinates
   * @throws GeolocationError avec code typé / with typed code
   */
  async getCurrentPosition(options: GetCurrentPositionOptions = {}): Promise<Coordinates> {
    const accuracyMeters = options.accuracyMeters ?? 100;
    const timeoutMs = options.timeoutMs ?? 10_000;
    const maximumAgeMs = options.maximumAgeMs ?? 60_000;

    // [ADDED] 1. Demander la permission (Android only — iOS géré par la lib)
    if (Platform.OS === 'android') {
      const granted = await this.requestAndroidPermission();
      if (!granted) {
        throw new GeolocationError('Location permission denied', 'permission_denied');
      }
    }

    // [ADDED] 2. Récupérer la position via callback → Promise
    return new Promise<Coordinates>((resolve, reject) => {
      const start = Date.now();

      Geolocation.getCurrentPosition(
        (response) => {
          const duration = Date.now() - start;

          // [ADDED] Validation stricte de la réponse native (TS-004)
          const parsed = PositionResponseSchema.safeParse(response);
          if (!parsed.success) {
            console.error(
              `[ERROR][RNGeolocationService][getCurrentPosition][?][${this.timestamp()}] ` +
                'Native response shape invalid',
            );
            this.crashReporter?.captureException(new Error('Geolocation native response invalid'), {
              tags: { feature: 'gps' },
            });
            reject(new GeolocationError('Native response shape invalid', 'unknown', parsed.error));
            return;
          }

          const { latitude, longitude, accuracy } = parsed.data.coords;

          // [ADDED] Vérification accuracy
          if (accuracy > accuracyMeters) {
            console.warn(
              `[WARN][RNGeolocationService][getCurrentPosition][?][${this.timestamp()}] ` +
                `Accuracy too low: ${accuracy}m > ${accuracyMeters}m | duration: ${duration}ms`,
            );
            reject(
              new GeolocationError(
                `Position accuracy ${accuracy}m exceeds threshold ${accuracyMeters}m`,
                'inaccurate',
              ),
            );
            return;
          }

          // [ADDED] Validation Coordinates range (latitude/longitude)
          const coordsResult = CoordinatesSchema.safeParse({ latitude, longitude });
          if (!coordsResult.success) {
            reject(
              new GeolocationError(
                'Invalid coordinates from native',
                'unknown',
                coordsResult.error,
              ),
            );
            return;
          }

          // ⚠️ RGPD : log SANS coordonnées brutes
          console.log(
            `[INFO][RNGeolocationService][getCurrentPosition][?][${this.timestamp()}] ` +
              `Position acquired | accuracy: ${accuracy}m | duration: ${duration}ms`,
          );

          resolve(coordsResult.data);
        },
        (error) => {
          this.handleNativeError(error, reject);
        },
        {
          enableHighAccuracy: accuracyMeters <= 50,
          timeout: timeoutMs,
          maximumAge: maximumAgeMs,
        },
      );
    });
  }

  /**
   * Demande la permission Android ACCESS_FINE_LOCATION.
   * Requests Android ACCESS_FINE_LOCATION permission.
   *
   * @returns true si accordée / true if granted
   */
  private async requestAndroidPermission(): Promise<boolean> {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Permission de localisation',
          message: 'Mivro a besoin de votre position pour calculer le point de rencontre.',
          buttonPositive: 'OK',
          buttonNegative: 'Refuser',
        },
      );

      console.log(
        `[INFO][RNGeolocationService][requestAndroidPermission][?][${this.timestamp()}] ` +
          `Permission result: ${result}`,
      );

      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error(
        `[ERROR][RNGeolocationService][requestAndroidPermission][?][${this.timestamp()}] ` +
          'Permission request failed',
        error,
      );
      return false;
    }
  }

  /**
   * Mappe une erreur native RN en GeolocationError typé.
   * Maps a native RN error to a typed GeolocationError.
   *
   * @param error - Erreur native / Native error
   * @param reject - Promise reject callback
   */
  private handleNativeError(
    error: { code: number; message: string },
    reject: (e: GeolocationError) => void,
  ): void {
    let code: GeolocationError['code'];
    let message: string;

    switch (error.code) {
      case RN_PERMISSION_DENIED:
        code = 'permission_denied';
        message = 'User denied location permission';
        this.crashReporter?.captureMessage('GPS permission denied', {
          level: 'info',
          tags: { feature: 'gps' },
        });
        break;
      case RN_POSITION_UNAVAILABLE:
        code = 'unavailable';
        message = 'Location service unavailable';
        break;
      case RN_TIMEOUT:
        code = 'timeout';
        message = 'Location request timed out';
        this.crashReporter?.captureMessage('GPS timeout', {
          level: 'warning',
          tags: { feature: 'gps' },
        });
        break;
      default:
        code = 'unknown';
        message = error.message ?? 'Unknown geolocation error';
        this.crashReporter?.captureException(new Error(`GPS native error: ${message}`), {
          tags: { feature: 'gps' },
        });
    }

    console.error(
      `[ERROR][RNGeolocationService][handleNativeError][?][${this.timestamp()}] ` +
        `${message} | code: ${code}`,
    );
    reject(new GeolocationError(message, code, error));
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

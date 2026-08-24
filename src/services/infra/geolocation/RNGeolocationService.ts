/**
 * @file RNGeolocationService.ts
 * @description Implémentation IGeolocationService basée sur le paquet
 *              `@react-native-community/geolocation`.
 *              IGeolocationService implementation based on the
 *              `@react-native-community/geolocation` package.
 *
 *              Gère / Handles:
 *              - Demande de permission runtime (Android 6+ et iOS)
 *              - Timeout, accuracy
 *              - Mapping des erreurs natives → GeolocationError typé
 *
 *              ⚠️ RGPD : aucune coordonnée brute dans les logs.
 *
 * @module services/infra/geolocation/RNGeolocationService
 */

// [ADDED] Adapter RNGeolocationService
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import { z } from 'zod';
import { CoordinatesSchema } from '@entities/Location';
import type { Coordinates } from '@entities/Location';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import type {
  ClearWatch,
  GetCurrentPositionOptions,
  IGeolocationService,
  PositionSample,
  WatchErrorCallback,
  WatchPositionCallback,
  WatchPositionOptions,
} from '@services/domain/geolocation/IGeolocationService';
import { GeolocationError } from '@services/domain/geolocation/IGeolocationService';

/** Codes natifs RN Geolocation / Native RN Geolocation error codes */
const RN_PERMISSION_DENIED = 1;
const RN_POSITION_UNAVAILABLE = 2;
const RN_TIMEOUT = 3;

/** Facteur de conversion m/s → km/h / Conversion factor m/s → km/h */
const MPS_TO_KMH = 3.6;
/** Cap par défaut si non fourni par le natif (degrés) / Default heading if not provided */
const DEFAULT_HEADING = 0;
/** Distance filter par défaut en mètres / Default distance filter in meters */
const DEFAULT_DISTANCE_FILTER_M = 10;

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
 * Schéma de validation d'un échantillon de suivi continu (TS-004).
 * Continuous-watch sample validation schema (TS-004).
 *
 * `speed` (m/s) et `heading` (degrés) peuvent être null/négatifs côté natif
 * (signal indisponible) → normalisés dans {@link RNGeolocationService.watchPosition}.
 * `speed` (m/s) and `heading` (degrees) can be null/negative natively
 * (signal unavailable) → normalized in `watchPosition`.
 */
const WatchResponseSchema = z.object({
  coords: z.object({
    latitude: z.number(),
    longitude: z.number(),
    speed: z.number().nullable().optional(),
    heading: z.number().nullable().optional(),
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
   * Suit la position GPS en continu et émet des échantillons normalisés.
   * Continuously watches the GPS position and emits normalized samples.
   *
   * Normalise la vitesse native (m/s) en km/h et borne le cap dans [0, 360).
   * Les valeurs natives null/négatives (signal indisponible) sont ramenées à 0.
   * Le throttling (5s/30s) et l'arrêt en arrière-plan sont gérés en amont
   * (couche présentation), pas ici (séparation des responsabilités).
   *
   * Normalizes native speed (m/s) to km/h and clamps heading to [0, 360).
   * Null/negative native values (signal unavailable) are coerced to 0.
   * Throttling and background stop are handled upstream (presentation layer).
   *
   * @param onSample - Callback de réception d'un échantillon / Sample callback
   * @param onError - Callback d'erreur optionnel / Optional error callback
   * @param options - Options de suivi / Watch options
   * @returns Fonction d'arrêt du suivi / Function to stop the watch
   */
  watchPosition(
    onSample: WatchPositionCallback,
    onError?: WatchErrorCallback,
    options: WatchPositionOptions = {},
  ): ClearWatch {
    const accuracyMeters = options.accuracyMeters ?? 100;
    const distanceFilter = options.distanceFilterMeters ?? DEFAULT_DISTANCE_FILTER_M;

    const watchId = Geolocation.watchPosition(
      (response) => {
        // [ADDED] Validation stricte de la réponse native (TS-004)
        const parsed = WatchResponseSchema.safeParse(response);
        if (!parsed.success) {
          console.error(
            `[ERROR][RNGeolocationService][watchPosition][?][${this.timestamp()}] ` +
              'Native watch response shape invalid',
          );
          this.crashReporter?.captureException(new Error('Geolocation watch response invalid'), {
            tags: { feature: 'gps' },
          });
          return;
        }

        const { latitude, longitude, speed, heading } = parsed.data.coords;

        // [ADDED] Validation range latitude/longitude (TS-004)
        const coordsResult = CoordinatesSchema.safeParse({ latitude, longitude });
        if (!coordsResult.success) {
          return;
        }

        // [ADDED] Normalisation : m/s → km/h, valeurs invalides → 0
        const speedKmh = typeof speed === 'number' && speed > 0 ? speed * MPS_TO_KMH : 0;
        const headingDeg =
          typeof heading === 'number' && heading >= 0 ? heading % 360 : DEFAULT_HEADING;

        const sample: PositionSample = {
          ...coordsResult.data,
          speed: speedKmh,
          heading: headingDeg,
        };

        // ⚠️ RGPD : log SANS coordonnées brutes (vitesse non identifiante seule)
        console.log(
          `[INFO][RNGeolocationService][watchPosition][?][${this.timestamp()}] ` +
            `Watch sample | speed: ${speedKmh.toFixed(1)}km/h`,
        );

        onSample(sample);
      },
      (error) => {
        // [ADDED] Mapping de l'erreur native → GeolocationError typé
        this.handleNativeError(error, (typedError) => {
          onError?.(typedError);
        });
      },
      {
        enableHighAccuracy: accuracyMeters <= 50,
        distanceFilter,
      },
    );

    console.log(
      `[INFO][RNGeolocationService][watchPosition][?][${this.timestamp()}] ` +
        `Watch started | id: ${watchId}`,
    );

    // [ADDED] Fonction d'arrêt idempotente
    return () => {
      Geolocation.clearWatch(watchId);
      console.log(
        `[INFO][RNGeolocationService][watchPosition][?][${this.timestamp()}] ` +
          `Watch cleared | id: ${watchId}`,
      );
    };
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

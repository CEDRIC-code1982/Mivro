/**
 * @file KeychainBiometricService.ts
 * @description Implémentation IBiometricService basée sur react-native-keychain.
 *              IBiometricService implementation based on react-native-keychain.
 *
 *              Stratégie / Strategy:
 *              - `getSupportedType` mappe `getSupportedBiometryType()` natif.
 *              - `isEnrolled` = un type supporté est retourné par le natif.
 *              - `enableLock` pose un secret « sentinelle » protégé par
 *                `accessControl: BIOMETRY_ANY_OR_DEVICE_PASSCODE` + `accessible:
 *                WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Le passcode de l'appareil sert
 *                de secours natif si la biométrie devient inutilisable (enrôlement
 *                retiré, lockout « too many attempts ») → évite l'enfermement.
 *                The device passcode acts as a native fallback if biometrics
 *                become unusable (enrollment removed, "too many attempts" lockout)
 *                → prevents lockout.
 *              - `authenticate` relit ce secret (`getGenericPassword`), ce qui
 *                déclenche le prompt Face ID / Touch ID natif ; succès = valeur
 *                relue conforme.
 *              - `disableLock` retire le secret (`resetGenericPassword`).
 *
 *              ⚠️ LOG-001 : la valeur sentinelle n'est JAMAIS loggée.
 *              ⚠️ LOG-001: the sentinel value is NEVER logged.
 *
 *              Mapping des erreurs natives → BiometricError typée (ERR-001).
 *              Distingue l'annulation utilisateur (`cancelled`) d'un échec
 *              (`failed`).
 *              Maps native errors → typed BiometricError (ERR-001). Distinguishes
 *              user cancellation (`cancelled`) from a failure (`failed`).
 *
 * @module infrastructure/security/KeychainBiometricService
 */

// [ADDED] F8 — Adapter KeychainBiometricService
import {
  ACCESS_CONTROL,
  ACCESSIBLE,
  BIOMETRY_TYPE,
  getGenericPassword,
  getSupportedBiometryType,
  resetGenericPassword,
  setGenericPassword,
} from 'react-native-keychain';
import {
  BiometricError,
  type BiometricType,
  type IBiometricService,
} from '@core/ports/IBiometricService';
import type { ICrashReporter } from '@core/ports/ICrashReporter';

/** Service keychain dédié au verrou biométrique / Dedicated keychain service for the lock */
const SENTINEL_SERVICE = 'com.mivro.biometric-lock';

/**
 * Username stocké aux côtés de la sentinelle (non sensible).
 * Username stored alongside the sentinel (non-sensitive).
 */
const SENTINEL_USERNAME = 'mivro';

/**
 * Valeur sentinelle attendue après relecture (jamais loggée — LOG-001).
 * Expected sentinel value after read-back (never logged — LOG-001).
 */
const SENTINEL_VALUE = 'mivro-biometric-lock-v1';

/**
 * Implémentation du port IBiometricService via react-native-keychain.
 * IBiometricService implementation via react-native-keychain.
 *
 * @param crashReporter - Crash reporter optionnel pour Sentry / Optional crash reporter
 *
 * @example
 *   const service = new KeychainBiometricService(crashReporter);
 *   const ok = await service.authenticate('Déverrouille Mivro');
 */
export class KeychainBiometricService implements IBiometricService {
  constructor(private readonly crashReporter?: ICrashReporter) {}

  /**
   * Retourne le type de biométrie supporté (mappé), ou null.
   * Returns the supported biometry type (mapped), or null.
   *
   * @returns Type supporté ou null / Supported type or null
   */
  async getSupportedType(): Promise<BiometricType | null> {
    try {
      const native = await getSupportedBiometryType();
      return this.mapBiometryType(native);
    } catch (error: unknown) {
      // Introspection : on dégrade silencieusement vers « aucun » + report.
      // Introspection: silently degrade to "none" + report.
      this.report(error, 'getSupportedType');
      return null;
    }
  }

  /**
   * Indique si une biométrie est enrôlée et utilisable.
   * Tells whether a biometry is enrolled and usable.
   *
   * @returns true si disponible et enrôlée / true if available and enrolled
   */
  async isEnrolled(): Promise<boolean> {
    return (await this.getSupportedType()) !== null;
  }

  /**
   * Déclenche le prompt biométrique natif en relisant la sentinelle.
   * Triggers the native biometric prompt by reading back the sentinel.
   *
   * @param reason - Raison affichée dans le prompt natif / Reason shown in the native prompt
   * @returns true si l'authentification a réussi / true if authentication succeeded
   * @throws {BiometricError} Annulation, indisponibilité, non-enrôlement ou échec / Cancellation, unavailability, non-enrollment or failure
   */
  async authenticate(reason: string): Promise<boolean> {
    try {
      const credentials = await getGenericPassword({
        service: SENTINEL_SERVICE,
        // BIOMETRY_ANY_OR_DEVICE_PASSCODE : le code de l'appareil sert de
        // secours natif si la biométrie est inutilisable (cf. fix lockout).
        // Device passcode acts as a native fallback when biometrics are unusable.
        accessControl: ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        authenticationPrompt: { title: reason },
      });

      // Aucune sentinelle posée : le verrou n'a pas été activé correctement.
      // No sentinel stored: the lock was not enabled correctly.
      if (credentials === false) {
        throw new BiometricError('No biometric sentinel stored', 'not_enrolled');
      }

      // ⚠️ LOG-001 : on compare sans jamais logger la valeur.
      // ⚠️ LOG-001: compare without ever logging the value.
      const ok = credentials.password === SENTINEL_VALUE;
      console.log(
        `[INFO][KeychainBiometricService][authenticate][?][${this.timestamp()}] ` +
          `Biometric authentication result | success: ${ok}`,
      );
      return ok;
    } catch (error: unknown) {
      throw this.toBiometricError(error, 'authenticate');
    }
  }

  /**
   * Pose le secret sentinelle protégé par biométrie.
   * Stores the biometry-protected sentinel secret.
   *
   * @throws {BiometricError} Si l'écriture échoue / If writing fails
   */
  async enableLock(): Promise<void> {
    try {
      const result = await setGenericPassword(SENTINEL_USERNAME, SENTINEL_VALUE, {
        service: SENTINEL_SERVICE,
        // BIOMETRY_ANY_OR_DEVICE_PASSCODE : secours passcode device (anti-lockout).
        // Device-passcode fallback (anti-lockout).
        accessControl: ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (result === false) {
        throw new BiometricError('Failed to store biometric sentinel', 'unknown');
      }
      console.log(
        `[INFO][KeychainBiometricService][enableLock][?][${this.timestamp()}] ` +
          'Biometric lock enabled (sentinel stored)',
      );
    } catch (error: unknown) {
      throw this.toBiometricError(error, 'enableLock');
    }
  }

  /**
   * Retire le secret sentinelle (idempotent — ignore si absent).
   * Removes the sentinel secret (idempotent — ignored if missing).
   */
  async disableLock(): Promise<void> {
    try {
      await resetGenericPassword({ service: SENTINEL_SERVICE });
      console.log(
        `[INFO][KeychainBiometricService][disableLock][?][${this.timestamp()}] ` +
          'Biometric lock disabled (sentinel removed)',
      );
    } catch (error: unknown) {
      // Le cleanup ne doit jamais casser le flux : log + report sans throw.
      // Cleanup must never break the flow: log + report without throwing.
      console.warn(
        `[WARN][KeychainBiometricService][disableLock][?][${this.timestamp()}] ` +
          'Failed to remove biometric sentinel',
      );
      this.report(error, 'disableLock', 'warning');
    }
  }

  /**
   * Mappe le type natif `BIOMETRY_TYPE` vers l'abstraction du port.
   * Maps the native `BIOMETRY_TYPE` to the port abstraction.
   *
   * @param native - Type natif ou null / Native type or null
   * @returns Type abstrait ou null / Abstract type or null
   */
  private mapBiometryType(native: BIOMETRY_TYPE | null): BiometricType | null {
    switch (native) {
      case BIOMETRY_TYPE.FACE_ID:
      case BIOMETRY_TYPE.FACE:
        return 'face';
      case BIOMETRY_TYPE.TOUCH_ID:
      case BIOMETRY_TYPE.FINGERPRINT:
        return 'fingerprint';
      case BIOMETRY_TYPE.IRIS:
        return 'iris';
      // OPTIC_ID (visionOS) et null → non supporté côté MVP mobile.
      // OPTIC_ID (visionOS) and null → unsupported for the mobile MVP.
      default:
        return null;
    }
  }

  /**
   * Convertit une erreur native en BiometricError typée (mapping + report).
   * Converts a native error into a typed BiometricError (mapping + report).
   *
   * Heuristique de mapping basée sur le message natif (la lib ne fournit pas
   * de codes typés sur le rejet) : annulation utilisateur vs échec vs
   * indisponibilité.
   * Mapping heuristic based on the native message (the lib provides no typed
   * codes on rejection): user cancellation vs failure vs unavailability.
   *
   * @param error - Erreur capturée / Caught error
   * @param fn - Nom de la fonction appelante / Caller function name
   * @returns BiometricError typée / Typed BiometricError
   */
  private toBiometricError(error: unknown, fn: string): BiometricError {
    // Déjà typée : propager telle quelle.
    // Already typed: propagate as-is.
    if (error instanceof BiometricError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    let code: BiometricError['code'];
    if (
      normalized.includes('cancel') ||
      normalized.includes('usercancel') ||
      normalized.includes('user_canceled') ||
      normalized.includes('code: 13') // Android BiometricPrompt: negative button / user cancel
    ) {
      code = 'cancelled';
    } else if (
      normalized.includes('not enrolled') ||
      normalized.includes('no identities') ||
      normalized.includes('no fingerprints') ||
      normalized.includes('biometry_not_enrolled')
    ) {
      code = 'not_enrolled';
    } else if (
      normalized.includes('not available') ||
      normalized.includes('biometry_not_available') ||
      normalized.includes('hardware')
    ) {
      code = 'not_available';
    } else if (
      normalized.includes('authentication failed') ||
      normalized.includes('not recognized') ||
      normalized.includes('too many attempts') ||
      normalized.includes('lockout')
    ) {
      code = 'failed';
    } else {
      code = 'unknown';
    }

    // Annulation = comportement attendu : pas de report Sentry (bruit).
    // Cancellation = expected behavior: no Sentry report (noise).
    if (code === 'unknown' || code === 'not_available') {
      this.report(error, fn);
    }

    console.warn(
      `[WARN][KeychainBiometricService][${fn}][?][${this.timestamp()}] ` +
        `Biometric error | code: ${code}`,
    );

    return new BiometricError(message, code, error);
  }

  /**
   * Reporte une erreur au crash reporter (sans donnée sensible).
   * Reports an error to the crash reporter (without sensitive data).
   *
   * @param error - Erreur à reporter / Error to report
   * @param fn - Fonction appelante / Caller function
   * @param level - Niveau de gravité / Severity level
   */
  private report(error: unknown, fn: string, level: 'error' | 'warning' = 'error'): void {
    this.crashReporter?.captureException(
      error instanceof Error ? error : new Error(`Biometric ${fn} failed`),
      { tags: { feature: 'biometric' }, level },
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

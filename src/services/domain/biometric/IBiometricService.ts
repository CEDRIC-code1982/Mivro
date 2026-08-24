/**
 * @file IBiometricService.ts
 * @description Port abstrait pour l'authentification biométrique (Face ID /
 *              Touch ID / empreinte / iris) — verrou applicatif (F8).
 *              Abstract port for biometric authentication (Face ID / Touch ID /
 *              fingerprint / iris) — app lock (F8).
 *
 *              Encapsule la détection du capteur, l'enrôlement et le prompt
 *              natif. La couche présentation passe par ce port et n'importe
 *              JAMAIS react-native-keychain directement.
 *              Encapsulates sensor detection, enrollment and the native prompt.
 *              The presentation layer goes through this port and NEVER imports
 *              react-native-keychain directly.
 *
 *              Implémentations : KeychainBiometricService (infrastructure/).
 *              Implementations: KeychainBiometricService (infrastructure/).
 *
 * @module services/domain/biometric/IBiometricService
 */

// [ADDED] F8 — Port IBiometricService + types + erreur typée

/**
 * Type de biométrie supporté par l'appareil (abstraction des types natifs).
 * Biometry type supported by the device (native types abstraction).
 *
 * - `face` : Face ID (iOS) / Face Recognition (Android)
 * - `fingerprint` : Touch ID (iOS) / Fingerprint (Android)
 * - `iris` : Iris Recognition (Android)
 * - `null` : aucune biométrie disponible / no biometry available
 */
export type BiometricType = 'face' | 'fingerprint' | 'iris';

/**
 * Codes d'erreur typés pour l'authentification biométrique.
 * Typed error codes for biometric authentication.
 *
 * - `not_available` : capteur indisponible (matériel absent / désactivé) / sensor unavailable
 * - `not_enrolled` : aucune biométrie enrôlée sur l'appareil / no biometry enrolled
 * - `cancelled` : annulation explicite par l'utilisateur (≠ échec) / explicit user cancellation
 * - `failed` : tentative biométrique échouée (non reconnu) / failed attempt (not recognized)
 * - `unknown` : erreur inattendue / unexpected error
 */
export type BiometricErrorCode =
  | 'not_available'
  | 'not_enrolled'
  | 'cancelled'
  | 'failed'
  | 'unknown';

/**
 * Erreur métier typée pour la biométrie.
 * Typed business error for biometrics.
 *
 * ⚠️ LOG-001 : ne JAMAIS logger de secret ni la valeur sentinelle.
 * ⚠️ LOG-001: NEVER log a secret nor the sentinel value.
 *
 * @param message - Message lisible (non affiché tel quel à l'user) / Human-readable message
 * @param code - Code d'erreur typé (mappé vers un message i18n) / Typed error code
 * @param cause - Erreur originale optionnelle / Optional original error
 */
export class BiometricError extends Error {
  constructor(
    message: string,
    public readonly code: BiometricErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BiometricError';
  }
}

/**
 * Port abstrait pour le verrou biométrique.
 * Abstract port for the biometric lock.
 *
 * @example
 *   const type = await biometricService.getSupportedType();
 *   if (type && (await biometricService.isEnrolled())) {
 *     const ok = await biometricService.authenticate('Déverrouille Mivro');
 *   }
 */
export interface IBiometricService {
  /**
   * Retourne le type de biométrie supporté par l'appareil, ou `null`.
   * Returns the biometry type supported by the device, or `null`.
   *
   * Ne déclenche AUCUN prompt — simple introspection du matériel.
   * Triggers NO prompt — plain hardware introspection.
   *
   * @returns Type supporté ou `null` si aucun / Supported type or `null`
   */
  getSupportedType(): Promise<BiometricType | null>;

  /**
   * Indique si une biométrie est enrôlée ET utilisable (capteur présent).
   * Tells whether a biometry is enrolled AND usable (sensor present).
   *
   * Ne déclenche AUCUN prompt.
   * Triggers NO prompt.
   *
   * @returns true si la biométrie est disponible et enrôlée / true if available and enrolled
   */
  isEnrolled(): Promise<boolean>;

  /**
   * Déclenche le prompt biométrique natif (Face ID / Touch ID / empreinte).
   * Triggers the native biometric prompt (Face ID / Touch ID / fingerprint).
   *
   * @param reason - Raison affichée dans le prompt natif / Reason shown in the native prompt
   * @returns `true` si l'authentification a réussi / `true` if authentication succeeded
   * @throws {BiometricError} Annulation (`cancelled`), indisponibilité, non-enrôlement ou échec / Cancellation, unavailability, non-enrollment or failure
   */
  authenticate(reason: string): Promise<boolean>;

  /**
   * Pose le secret sentinelle protégé par biométrie (à l'activation du verrou).
   * Stores the biometry-protected sentinel secret (when enabling the lock).
   *
   * @throws {BiometricError} Si l'écriture échoue / If writing fails
   */
  enableLock(): Promise<void>;

  /**
   * Retire le secret sentinelle (à la désactivation du verrou). Idempotent.
   * Removes the sentinel secret (when disabling the lock). Idempotent.
   */
  disableLock(): Promise<void>;
}

/**
 * @file react-native-config.d.ts
 * @description Déclaration des types pour react-native-config.
 *              Type declarations for react-native-config.
 *
 *              Chaque variable de .env est typée ici.
 *              Each .env variable is typed here.
 */

// [ADDED] Type declarations for react-native-config
declare module 'react-native-config' {
  interface NativeConfig {
    /** Sentry DSN — vide en dev, configuré en CI/staging/prod */
    SENTRY_DSN?: string;
    /** Sentry environment — development | staging | production */
    SENTRY_ENVIRONMENT?: string;
    /** Sentry release identifier — auto-injecté par CI */
    SENTRY_RELEASE?: string;
    /**
     * URL de l'instance Firebase Realtime Database (région europe-west1).
     * Publique (pas un secret). Requise pour cibler une instance RTDB hors
     * us-central1 ; vide en tests/CI → fallback getDatabase(getApp()).
     */
    FIREBASE_DATABASE_URL?: string;
  }

  const Config: NativeConfig;
  export default Config;
}

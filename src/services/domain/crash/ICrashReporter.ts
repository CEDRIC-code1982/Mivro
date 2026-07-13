/**
 * @file ICrashReporter.ts
 * @description Port abstrait pour le reporting de crashs/erreurs.
 *              Abstract port for crash/error reporting.
 *
 *              Permet de swapper Sentry pour Bugsnag ou autre sans
 *              toucher au code métier.
 *              Allows swapping Sentry for Bugsnag or another provider
 *              without touching business logic.
 *
 * @module core/ports/ICrashReporter
 */

// [ADDED] Port ICrashReporter — interface + types crash reporting

/**
 * Niveaux de gravité pour les events crash.
 * Severity levels for crash events.
 */
export type CrashSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

/**
 * Contexte additionnel attaché à un event crash.
 * Additional context attached to a crash event.
 *
 * ⚠️ RGPD : ne JAMAIS inclure de coordonnées GPS, emails ou tokens
 *            dans extra/tags.
 */
export interface CrashContext {
  /** Tags pour filtrer dans le dashboard (ex. feature: 'midpoint') */
  tags?: Record<string, string>;
  /** Données contextuelles supplémentaires (NE PAS inclure de données sensibles) */
  extra?: Record<string, unknown>;
  /** Niveau de gravité / Severity level */
  level?: CrashSeverity;
}

/**
 * Utilisateur anonymisé pour le crash reporter.
 * Anonymized user for the crash reporter.
 *
 * ⚠️ RGPD : jamais d'email ni de nom — uniquement ID + type.
 */
export interface CrashUser {
  /** ID utilisateur anonymisé (pas d'email ni de nom) */
  id: string;
  /** Type d'utilisateur pour filtrer / User type for filtering */
  type: 'guest' | 'authenticated';
}

/**
 * Breadcrumb — trace de navigation pour debugger un crash.
 * Breadcrumb — navigation trace for debugging a crash.
 */
export interface CrashBreadcrumb {
  /** Message décrivant l'action / Message describing the action */
  message: string;
  /** Catégorie (ex. 'navigation', 'http', 'ui') / Category */
  category?: string;
  /** Niveau de gravité / Severity level */
  level?: CrashSeverity;
  /** Données contextuelles / Contextual data */
  data?: Record<string, unknown>;
}

/**
 * Port abstrait pour le crash reporting.
 * Abstract port for crash reporting.
 *
 * Implémentations : SentryCrashReporter (infrastructure/).
 * Implementations: SentryCrashReporter (infrastructure/).
 *
 * @example
 *   // Via le hook React (couche présentation)
 *   const crash = useCrashReporter();
 *   try { await fetchData(); }
 *   catch (e) { crash.captureException(e as Error); }
 */
export interface ICrashReporter {
  /**
   * Initialise le crash reporter (appelé une seule fois au démarrage app).
   * Initializes the crash reporter (called once at app startup).
   *
   * Idempotent : appels multiples ignorés.
   * Idempotent: multiple calls are ignored.
   */
  init(): void;

  /**
   * Capture une exception (erreur attrapée).
   * Captures an exception (caught error).
   *
   * @param error - L'erreur à reporter / The error to report
   * @param context - Contexte additionnel optionnel / Optional additional context
   */
  captureException(error: Error, context?: CrashContext): void;

  /**
   * Capture un message arbitraire (sans erreur sous-jacente).
   * Captures an arbitrary message (without an underlying error).
   *
   * @param message - Le message à reporter / The message to report
   * @param context - Contexte additionnel optionnel / Optional additional context
   */
  captureMessage(message: string, context?: CrashContext): void;

  /**
   * Définit l'utilisateur courant (anonymisé).
   * Sets the current user (anonymized).
   *
   * Passer null pour clear (déconnexion).
   * Pass null to clear (logout).
   *
   * @param user - Utilisateur anonymisé ou null / Anonymized user or null
   */
  setUser(user: CrashUser | null): void;

  /**
   * Ajoute un tag global qui sera attaché à tous les events suivants.
   * Adds a global tag attached to all subsequent events.
   *
   * @param key - Clé du tag / Tag key
   * @param value - Valeur du tag / Tag value
   */
  setTag(key: string, value: string): void;

  /**
   * Ajoute un breadcrumb (trace de navigation pour debugger un crash).
   * Adds a breadcrumb (navigation trace for debugging a crash).
   *
   * @param breadcrumb - Le breadcrumb à ajouter / The breadcrumb to add
   */
  addBreadcrumb(breadcrumb: CrashBreadcrumb): void;

  /**
   * Force l'envoi des events en attente (utile avant un kill volontaire).
   * Forces sending pending events (useful before a voluntary kill).
   *
   * @param timeoutMs - Timeout en ms (défaut: 2000) / Timeout in ms (default: 2000)
   * @returns true si les events ont été envoyés / true if events were sent
   */
  flush(timeoutMs?: number): Promise<boolean>;
}

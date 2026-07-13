/**
 * @file SentryCrashReporter.ts
 * @description Implémentation Sentry du port ICrashReporter.
 *              Sentry implementation of the ICrashReporter port.
 *
 *              Inclut le scrubber RGPD pour données sensibles (beforeSend).
 *              Includes GDPR scrubber for sensitive data (beforeSend).
 *
 * @module infrastructure/crash/SentryCrashReporter
 */

// [ADDED] SentryCrashReporter — implements ICrashReporter

import * as Sentry from '@sentry/react-native';
import Config from 'react-native-config';
import type {
  ICrashReporter,
  CrashContext,
  CrashUser,
  CrashBreadcrumb,
  CrashSeverity,
} from '@services/domain/crash/ICrashReporter';
import { sanitizeObject } from './sanitizers';

/**
 * Mapping de CrashSeverity vers SeverityLevel Sentry.
 * Mapping from CrashSeverity to Sentry SeverityLevel.
 *
 * @remarks Notre CrashSeverity n'inclut pas 'log' (Sentry-specific).
 */
const SEVERITY_MAP: Record<CrashSeverity, Sentry.SeverityLevel> = {
  fatal: 'fatal',
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'debug',
};

/**
 * Configure un Scope Sentry à partir du CrashContext.
 * Configures a Sentry Scope from a CrashContext.
 *
 * @remarks Utilise les méthodes du Scope plutôt que les propriétés directes
 *          pour éviter les problèmes de types avec exactOptionalPropertyTypes.
 *
 * @param scope - Scope Sentry à configurer / Sentry scope to configure
 * @param context - Contexte optionnel / Optional context
 */
const applyScopeContext = (scope: Sentry.Scope, context?: CrashContext): void => {
  if (context?.level) {
    scope.setLevel(SEVERITY_MAP[context.level]);
  }
  if (context?.tags) {
    scope.setTags(context.tags);
  }
  if (context?.extra) {
    scope.setExtras(context.extra);
  }
};

/**
 * Implémentation Sentry du port ICrashReporter.
 * Sentry implementation of the ICrashReporter port.
 *
 * - DSN configurable via .env (react-native-config)
 * - No-op silencieux si DSN absent (dev sans config)
 * - beforeSend scrub les données RGPD (GPS, emails, tokens)
 *
 * @example
 *   const reporter = new SentryCrashReporter();
 *   reporter.init();
 *   reporter.captureException(new Error('Something went wrong'));
 */
export class SentryCrashReporter implements ICrashReporter {
  /** Flag d'initialisation (idempotent) */
  private initialized = false;

  /** Flag indiquant si Sentry est réellement actif (DSN présent) */
  private active = false;

  /**
   * Initialise Sentry avec le DSN de .env.
   * Initializes Sentry with the DSN from .env.
   *
   * Idempotent : un second appel est ignoré.
   * Si DSN absent, Sentry n'est pas initialisé (no-op silencieux).
   */
  init(): void {
    if (this.initialized) {
      return;
    }

    const dsn = Config.SENTRY_DSN;

    if (!dsn) {
      // En dev sans DSN configuré → no-op silencieusement
      console.log(
        `[INFO][SentryCrashReporter][init][?][${this.timestamp()}] ` +
          'Sentry skipped (no DSN configured)',
      );
      this.initialized = true;
      return;
    }

    Sentry.init({
      dsn,
      environment: Config.SENTRY_ENVIRONMENT ?? 'development',
      release: Config.SENTRY_RELEASE,
      // Sample rate adapté MVP : 100% des erreurs, 10% des transactions
      tracesSampleRate: 0.1,
      // Hook RGPD : nettoie les données sensibles avant envoi
      beforeSend: (event) => {
        if (event.contexts) {
          // Cast justifié : sanitizeObject retourne la même structure
          // mais TypeScript ne peut pas l'inférer à travers la récursion
          event.contexts = sanitizeObject(event.contexts) as typeof event.contexts;
        }
        if (event.extra) {
          event.extra = sanitizeObject(event.extra) as typeof event.extra;
        }
        if (event.tags) {
          for (const [key, value] of Object.entries(event.tags)) {
            if (typeof value === 'string') {
              const sanitized = sanitizeObject({ [key]: value }) as Record<string, unknown>;
              event.tags[key] = String(sanitized[key]);
            }
          }
        }
        return event;
      },
    });

    this.active = true;
    this.initialized = true;
    console.log(
      `[INFO][SentryCrashReporter][init][?][${this.timestamp()}] ` +
        `Sentry initialized (env: ${Config.SENTRY_ENVIRONMENT ?? 'development'})`,
    );
  }

  /**
   * Capture une exception (erreur attrapée).
   * Captures an exception (caught error).
   *
   * @param error - L'erreur à reporter / The error to report
   * @param context - Contexte additionnel optionnel / Optional additional context
   */
  captureException(error: Error, context?: CrashContext): void {
    if (!this.active) {
      return;
    }
    Sentry.withScope((scope) => {
      applyScopeContext(scope, context);
      Sentry.captureException(error);
    });
  }

  /**
   * Capture un message arbitraire.
   * Captures an arbitrary message.
   *
   * @param message - Le message à reporter / The message to report
   * @param context - Contexte additionnel optionnel / Optional additional context
   */
  captureMessage(message: string, context?: CrashContext): void {
    if (!this.active) {
      return;
    }
    Sentry.withScope((scope) => {
      scope.setLevel(context?.level ? SEVERITY_MAP[context.level] : 'info');
      if (context?.tags) {
        scope.setTags(context.tags);
      }
      if (context?.extra) {
        scope.setExtras(context.extra);
      }
      Sentry.captureMessage(message);
    });
  }

  /**
   * Définit l'utilisateur courant (anonymisé).
   * Sets the current user (anonymized).
   *
   * @param user - Utilisateur anonymisé ou null pour clear / Anonymized user or null to clear
   */
  setUser(user: CrashUser | null): void {
    if (!this.active) {
      return;
    }
    if (user === null) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({ id: user.id });
    // type est ajouté en tag custom (Sentry n'a pas ce champ natif)
    Sentry.setTag('user.type', user.type);
  }

  /**
   * Ajoute un tag global attaché à tous les events suivants.
   * Adds a global tag attached to all subsequent events.
   *
   * @param key - Clé du tag / Tag key
   * @param value - Valeur du tag / Tag value
   */
  setTag(key: string, value: string): void {
    if (!this.active) {
      return;
    }
    Sentry.setTag(key, value);
  }

  /**
   * Ajoute un breadcrumb.
   * Adds a breadcrumb.
   *
   * @param breadcrumb - Le breadcrumb à ajouter / The breadcrumb to add
   */
  addBreadcrumb(breadcrumb: CrashBreadcrumb): void {
    if (!this.active) {
      return;
    }
    const crumb: Sentry.Breadcrumb = {
      message: breadcrumb.message,
    };
    if (breadcrumb.category) {
      crumb.category = breadcrumb.category;
    }
    if (breadcrumb.level) {
      crumb.level = SEVERITY_MAP[breadcrumb.level];
    }
    if (breadcrumb.data) {
      crumb.data = sanitizeObject(breadcrumb.data) as Record<string, unknown>;
    }
    Sentry.addBreadcrumb(crumb);
  }

  /**
   * Force l'envoi des events en attente.
   * Forces sending pending events.
   *
   * @param _timeoutMs - Non utilisé par @sentry/react-native (signature du port)
   * @returns true si les events ont été envoyés / true if events were sent
   */
  async flush(_timeoutMs?: number): Promise<boolean> {
    if (!this.active) {
      return true;
    }
    // @sentry/react-native flush() ne prend pas de paramètre
    return Sentry.flush();
  }

  /**
   * Génère un timestamp HH:mm:ss pour les logs.
   * Generates an HH:mm:ss timestamp for logs.
   *
   * @returns Timestamp formaté / Formatted timestamp
   */
  private timestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }
}

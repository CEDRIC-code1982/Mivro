/**
 * @file sanitizers.ts
 * @description Fonctions de nettoyage RGPD pour les events Sentry.
 *              GDPR sanitization functions for Sentry events.
 *
 *              Supprime les données sensibles avant envoi :
 *              - Coordonnées GPS (lat, lng, location, coordinates, geo)
 *              - Emails → [REDACTED]
 *              - Tokens / secrets / mots de passe → [REDACTED]
 *
 * @module infrastructure/crash/sanitizers
 */

// [ADDED] Sanitizers RGPD — scrub GPS, emails, tokens

/**
 * Patterns de clés sensibles à supprimer.
 * Sensitive key patterns to redact.
 *
 * @remarks
 * Couvre : lat, lng, lon, location, coordinates, geo, token, secret, password.
 */
const SENSITIVE_KEY_PATTERNS: ReadonlyArray<RegExp> = [
  /lat/i,
  /lng/i,
  /lon/i,
  /location/i,
  /coordinates/i,
  /geo/i,
  /token/i,
  /secret/i,
  /password/i,
];

/**
 * Regex pour détecter les emails dans une chaîne.
 * Regex to detect emails in a string.
 */
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Profondeur max de récursion pour éviter les boucles infinies.
 * Max recursion depth to prevent infinite loops.
 */
const MAX_DEPTH = 10;

/**
 * Vérifie si une clé d'objet semble contenir des données sensibles.
 * Checks if an object key seems to contain sensitive data.
 *
 * @param key - La clé à vérifier / The key to check
 * @returns true si la clé correspond à un pattern sensible / true if key matches a sensitive pattern
 */
export const isSensitiveKey = (key: string): boolean =>
  SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

/**
 * Détecte et masque les emails dans une chaîne.
 * Detects and redacts emails in a string.
 *
 * @param input - La chaîne à nettoyer / The string to sanitize
 * @returns La chaîne avec les emails remplacés par [REDACTED] / String with emails replaced
 */
export const sanitizeString = (input: string): string => input.replace(EMAIL_REGEX, '[REDACTED]');

/**
 * Supprime récursivement les clés sensibles d'un objet.
 * Recursively removes sensitive keys from an object.
 *
 * - Les clés sensibles sont remplacées par "[REDACTED]"
 * - Les emails dans les strings sont masqués
 * - La profondeur est limitée à {@link MAX_DEPTH} pour éviter les cycles
 *
 * @param input - L'objet à nettoyer / The object to sanitize
 * @param depth - Profondeur actuelle de récursion / Current recursion depth
 * @returns L'objet nettoyé / The sanitized object
 */
export const sanitizeObject = (input: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) {
    return '[MAX_DEPTH]';
  }

  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  // Cast justifié : les branches précédentes ont écarté null, les primitifs
  // et les tableaux ; il ne reste qu'un objet indexable par clé.
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeObject(value, depth + 1);
    }
  }
  return result;
};

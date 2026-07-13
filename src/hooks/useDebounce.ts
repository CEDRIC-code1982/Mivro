/**
 * @file useDebounce.ts
 * @description Hook utilitaire pour debouncer une valeur.
 *              Utility hook to debounce a value.
 *
 *              Utile pour éviter de spammer une API pendant la frappe.
 *              Useful to avoid spamming an API during typing.
 *
 * @module presentation/hooks/useDebounce
 */

// [ADDED] Hook useDebounce
import { useEffect, useState } from 'react';

/**
 * Debounce une valeur : retourne la valeur après un délai sans changement.
 * Debounces a value: returns the value after a delay without changes.
 *
 * @param value - Valeur à debouncer / Value to debounce
 * @param delayMs - Délai en millisecondes / Delay in milliseconds
 * @returns Valeur debouncée / Debounced value
 *
 * @example
 *   const debouncedQuery = useDebounce(query, 400);
 */
export const useDebounce = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};

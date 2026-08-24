/**
 * @file useMidpointCalculation.ts
 * @description Hook pour calculer le midpoint et le persister dans le store.
 *              Hook to calculate the midpoint and persist it in the store.
 *
 *              Pas de TanStack Query : calcul pur synchrone.
 *              Le hook expose une fonction calculate() à appeler manuellement
 *              (ex: au click "Continuer" sur F1).
 *
 *              No TanStack Query: pure synchronous calculation.
 *              The hook exposes a calculate() function to call manually
 *              (e.g. on "Continue" button click on F1).
 *
 * @example
 *   const { calculate, isCalculating, error } = useMidpointCalculation();
 *   const handleContinue = () => {
 *     const result = calculate();
 *     if (result) navigation.navigate('Tabs', { screen: 'Map' });
 *   };
 *
 * @module features/Session/hooks/useMidpointCalculation
 */

// [ADDED] Hook useMidpointCalculation — calcul midpoint + persistance store
import { useCallback, useState } from 'react';
import {
  CalculateMidpointError,
  type CalculateMidpointResult,
} from '@services/domain/midpoint/CalculateMidpointUseCase';
import { getContainer } from '@services/serviceContainer';
import { useSessionStore } from '@state/useSessionStore';

/**
 * Erreurs typées retournées par le hook.
 * Typed errors returned by the hook.
 */
export type MidpointCalculationError =
  | { code: 'no_session' }
  | { code: 'too_few_participants' }
  | { code: 'too_many_participants' }
  | { code: 'unknown'; message: string };

/**
 * Résultat du hook useMidpointCalculation.
 * useMidpointCalculation hook result.
 *
 * @param isCalculating - true si calcul en cours / true if calculating
 * @param error - erreur typée ou null / typed error or null
 * @param calculate - lance le calcul depuis la session courante / triggers calculation from current session
 * @param clearError - efface l'erreur / clears the error
 */
export interface UseMidpointCalculationResult {
  /** true si calcul en cours / true if calculating */
  isCalculating: boolean;
  /** Erreur typée ou null / Typed error or null */
  error: MidpointCalculationError | null;
  /** Calcule le midpoint depuis la session courante et met à jour le store / Calculates midpoint from current session and updates store */
  calculate: () => CalculateMidpointResult | null;
  /** Efface l'erreur / Clears the error */
  clearError: () => void;
}

/**
 * Hook pour calculer le midpoint d'une session.
 * Hook to calculate the midpoint of a session.
 *
 * Calcul synchrone — pas d'async, pas de TanStack Query.
 * Synchronous calculation — no async, no TanStack Query.
 *
 * @returns résultat du hook / hook result
 */
export const useMidpointCalculation = (): UseMidpointCalculationResult => {
  const session = useSessionStore((s) => s.session);
  const setMidpoint = useSessionStore((s) => s.setMidpoint);

  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<MidpointCalculationError | null>(null);

  const calculate = useCallback((): CalculateMidpointResult | null => {
    if (!session) {
      setError({ code: 'no_session' });
      return null;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const { calculateMidpointUseCase } = getContainer();
      const result = calculateMidpointUseCase.execute({
        participants: session.participants,
      });

      // Persister dans le store (status → 'computed')
      // Persist to store (status → 'computed')
      setMidpoint(result.midpoint, result.radius);

      return result;
    } catch (err) {
      if (err instanceof CalculateMidpointError) {
        setError({ code: err.code });
      } else {
        setError({
          code: 'unknown',
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [session, setMidpoint]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isCalculating,
    error,
    calculate,
    clearError,
  };
};

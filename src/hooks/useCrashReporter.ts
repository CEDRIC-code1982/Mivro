/**
 * @file useCrashReporter.ts
 * @description Hook React pour utiliser le crash reporter dans les composants.
 *              React hook to use the crash reporter in components.
 *
 *              Évite l'import direct de Sentry dans la couche présentation.
 *              Avoids importing Sentry directly in the presentation layer.
 *
 * @module presentation/hooks/useCrashReporter
 *
 * @example
 *   const crash = useCrashReporter();
 *   try { await fetchData(); }
 *   catch (e) { crash.captureException(e as Error); }
 */

// [ADDED] Hook useCrashReporter — accès au crash reporter via DI

import { useMemo } from 'react';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import { getContainer } from '@services/serviceContainer';

/**
 * Hook React pour accéder au crash reporter depuis la couche présentation.
 * React hook to access the crash reporter from the presentation layer.
 *
 * @returns L'instance ICrashReporter du container / The ICrashReporter instance from the container
 */
export const useCrashReporter = (): ICrashReporter => {
  return useMemo(() => getContainer().crashReporter, []);
};

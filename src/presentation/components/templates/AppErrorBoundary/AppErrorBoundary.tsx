/**
 * @file AppErrorBoundary.tsx
 * @description ErrorBoundary global qui :
 *              - Capture les erreurs React non gérées
 *              - Les remonte au crashReporter
 *              - Affiche un fallback minimal stylé
 *
 *              Global ErrorBoundary that:
 *              - Catches unhandled React errors
 *              - Reports them to the crashReporter
 *              - Displays a styled minimal fallback
 *
 *              Doit envelopper toute l'arborescence (au-dessus de
 *              NavigationContainer dans App.tsx).
 *              Must wrap the entire tree (above NavigationContainer in App.tsx).
 *
 * @module presentation/components/templates/AppErrorBoundary
 */

// [ADDED] AppErrorBoundary — ErrorBoundary global avec crash reporting

import React, { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Pressable } from 'react-native';
import { getContainer } from '@/di/container';
import { useTheme, type Theme } from '@core/theme';
import { Text } from '@presentation/components/atoms';

/**
 * Props du composant interne (classe).
 * Internal class component props.
 */
interface ErrorBoundaryClassProps {
  /** Enfants à rendre / Children to render */
  children: ReactNode;
  /** Thème actif injecté par le wrapper FC / Active theme injected by FC wrapper */
  theme: Theme;
  /** Fonction de traduction injectée / Translation function injected */
  t: (key: string) => string;
}

/**
 * État interne de l'ErrorBoundary.
 * ErrorBoundary internal state.
 */
interface ErrorBoundaryState {
  /** Indique si une erreur a été capturée / Whether an error was caught */
  hasError: boolean;
}

/**
 * ErrorBoundary React (composant classe obligatoire pour getDerivedStateFromError).
 * React ErrorBoundary (class component required for getDerivedStateFromError).
 *
 * @remarks
 * Les hooks React ne sont pas disponibles dans les classes,
 * d'où l'injection de `theme` et `t` via le wrapper FC.
 */
class AppErrorBoundaryClass extends Component<ErrorBoundaryClassProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  /**
   * Met à jour l'état pour afficher le fallback en cas d'erreur.
   * Updates state to show fallback when an error occurs.
   *
   * @param _error - L'erreur capturée / The caught error
   * @returns Nouvel état / New state
   */
  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  /**
   * Reporte l'erreur au crashReporter (Sentry).
   * Reports the error to the crashReporter (Sentry).
   *
   * @param error - L'erreur React / The React error
   * @param errorInfo - Info sur le composant qui a crashé / Info about the crashed component
   */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      const { crashReporter } = getContainer();
      crashReporter.captureException(error, {
        level: 'fatal',
        tags: { boundary: 'app-root' },
        extra: { componentStack: errorInfo.componentStack ?? 'unknown' },
      });
    } catch (e) {
      console.error(
        `[ERROR][AppErrorBoundary][componentDidCatch][?][${new Date()
          .toISOString()
          .slice(11, 19)}] ` + 'Failed to report error to crashReporter',
        e,
      );
    }
  }

  /**
   * Réinitialise l'ErrorBoundary pour retenter le rendu.
   * Resets the ErrorBoundary to retry rendering.
   */
  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { theme, t } = this.props;
    const styles = createStyles(theme);

    return (
      <View
        style={styles.container}
        accessibilityRole="alert"
        accessibilityLabel={t('errors.boundary.title')}
      >
        <Text variant="h2" weight="bold" align="center">
          {t('errors.boundary.title')}
        </Text>
        <Text variant="body" color="secondary" align="center" style={styles.message}>
          {t('errors.boundary.message')}
        </Text>
        <Pressable
          style={styles.button}
          onPress={this.handleRetry}
          accessibilityRole="button"
          accessibilityLabel={t('errors.boundary.retry')}
          accessibilityHint={t('errors.boundary.retryHint')}
        >
          <Text variant="body" weight="semibold" color="onBrand">
            {t('errors.boundary.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }
}

/**
 * Crée les styles du fallback en fonction du thème.
 * Creates fallback styles based on the theme.
 *
 * @param theme - Thème actif / Active theme
 * @returns StyleSheet créé / Created StyleSheet
 */
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.xl,
      backgroundColor: theme.color.surface.primary,
      gap: theme.spacing.lg,
    },
    message: {
      maxWidth: 320,
    },
    button: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      backgroundColor: theme.color.interactive.brand.default,
      borderRadius: theme.radius.md,
      minHeight: theme.touchTarget.min,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

/**
 * Props publiques de l'AppErrorBoundary.
 * Public AppErrorBoundary props.
 */
interface AppErrorBoundaryProps {
  /** Enfants à rendre / Children to render */
  children: ReactNode;
}

/**
 * Wrapper FC qui injecte theme + i18n dans la classe ErrorBoundary.
 * FC wrapper that injects theme + i18n into the ErrorBoundary class.
 *
 * Nécessaire car les ErrorBoundary doivent être des classes en React,
 * et les hooks (useTheme, useTranslation) ne sont pas disponibles dans les classes.
 *
 * @param props - Enfants à envelopper / Children to wrap
 * @returns Composant ErrorBoundary avec thème et traductions / ErrorBoundary component with theme and translations
 */
export const AppErrorBoundary = ({ children }: AppErrorBoundaryProps): React.JSX.Element => {
  const theme = useTheme();
  const { t } = useTranslation('common');
  return (
    <AppErrorBoundaryClass theme={theme} t={t}>
      {children}
    </AppErrorBoundaryClass>
  );
};

export default AppErrorBoundary;

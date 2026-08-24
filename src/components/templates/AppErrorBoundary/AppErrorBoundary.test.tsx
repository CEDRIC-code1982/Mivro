/**
 * @file AppErrorBoundary.test.tsx
 * @description Tests unitaires de l'AppErrorBoundary.
 *              Unit tests for the AppErrorBoundary.
 *
 * @module components/templates/AppErrorBoundary/AppErrorBoundary.test
 */

// [ADDED] Tests unitaires AppErrorBoundary

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { AppErrorBoundary } from '@components/templates/AppErrorBoundary';

// Mock DI container avec crashReporter
const mockCaptureException = jest.fn();

jest.mock('@services/serviceContainer', () => ({
  getContainer: () => ({
    crashReporter: {
      init: jest.fn(),
      captureException: mockCaptureException,
      captureMessage: jest.fn(),
      setUser: jest.fn(),
      setTag: jest.fn(),
      addBreadcrumb: jest.fn(),
      flush: jest.fn().mockResolvedValue(true),
    },
  }),
}));

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'errors.boundary.title': "Oups, quelque chose s'est mal passé",
        'errors.boundary.message': 'Une erreur inattendue est survenue.',
        'errors.boundary.retry': 'Réessayer',
        'errors.boundary.retryHint': "Tente de recharger l'écran",
      };
      return translations[key] ?? key;
    },
    i18n: { language: 'fr' },
  }),
}));

/**
 * Composant volontairement cassé pour déclencher l'ErrorBoundary.
 * Intentionally broken component to trigger the ErrorBoundary.
 */
const ThrowingChild = ({ shouldThrow }: { shouldThrow: boolean }): React.JSX.Element => {
  if (shouldThrow) {
    throw new Error('Test crash');
  }
  return <Text>Child content</Text>;
};

describe('AppErrorBoundary', () => {
  // Supprime les console.error attendus pendant les tests ErrorBoundary
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when no error occurs', () => {
    const { getByText } = render(
      <AppErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </AppErrorBoundary>,
    );

    expect(getByText('Child content')).toBeTruthy();
  });

  it('renders fallback when a child throws', () => {
    const { getByText, queryByText } = render(
      <AppErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </AppErrorBoundary>,
    );

    // Le fallback est affiché
    expect(getByText("Oups, quelque chose s'est mal passé")).toBeTruthy();
    expect(getByText('Réessayer')).toBeTruthy();

    // Le child n'est pas affiché
    expect(queryByText('Child content')).toBeNull();
  });

  it('reports the error to crashReporter', () => {
    render(
      <AppErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </AppErrorBoundary>,
    );

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        level: 'fatal',
        tags: { boundary: 'app-root' },
      }),
    );
  });

  it('recovers when retry button is pressed', () => {
    // On utilise un state simulé : d'abord throw, puis ne throw plus
    let shouldThrow = true;

    const ConditionalChild = (): React.JSX.Element => {
      if (shouldThrow) {
        throw new Error('Test crash');
      }
      return <Text>Recovered</Text>;
    };

    const { getByText, queryByText } = render(
      <AppErrorBoundary>
        <ConditionalChild />
      </AppErrorBoundary>,
    );

    // En état d'erreur
    expect(getByText('Réessayer')).toBeTruthy();

    // On arrête de throw, puis on retry
    shouldThrow = false;
    fireEvent.press(getByText('Réessayer'));

    // Le contenu est restauré
    expect(getByText('Recovered')).toBeTruthy();
    expect(queryByText('Réessayer')).toBeNull();
  });
});

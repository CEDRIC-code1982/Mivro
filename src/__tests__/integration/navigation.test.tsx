/**
 * @file navigation.test.tsx
 * @description Tests d'intégration légers de la navigation.
 *              Lightweight navigation integration tests.
 *
 *              Vérifie que le RootNavigator affiche les 4 tabs
 *              et que MapScreen est l'écran par défaut.
 *              Verifies RootNavigator displays all 4 tabs
 *              and MapScreen is the default screen.
 *
 * @module __tests__/integration/navigation
 */

// [ADDED] Tests d'intégration navigation
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // [ADDED]
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import '@/i18n';
import RootNavigator from '@presentation/navigation/RootNavigator';

// [ADDED] Mock getContainer pour useGeocodeQuery dans ProfileScreen
jest.mock('@/di/container', () => ({
  getContainer: jest.fn(() => ({
    searchAddressUseCase: { execute: jest.fn().mockResolvedValue([]) },
  })),
}));

// [ADDED] QueryClient de test pour les hooks TanStack Query
const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

// [ADDED] Mock @react-navigation/native — preserve NavigationContainer, mock native parts
jest.mock('@react-navigation/native', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      ReactMock.createElement(View, { testID: 'navigation-container' }, children),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
  };
});

// [ADDED] Mock @react-navigation/bottom-tabs — render all screens to test tab presence
jest.mock('@react-navigation/bottom-tabs', () => {
  const ReactMock = require('react');
  const { View, Text } = require('react-native');
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({
        children,
      }: {
        children: React.ReactNode;
        screenOptions?: Record<string, unknown>;
      }) => ReactMock.createElement(View, { testID: 'bottom-tabs' }, children),
      Screen: ({
        name,
        component: Component,
      }: {
        name: string;
        component: React.FC;
        options?: Record<string, unknown>;
      }) =>
        ReactMock.createElement(
          View,
          { testID: `tab-screen-${name}` },
          ReactMock.createElement(Text, null, name),
          ReactMock.createElement(Component, null),
        ),
    }),
  };
});

// [ADDED] Mock @react-navigation/native-stack
jest.mock('@react-navigation/native-stack', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({
        children,
      }: {
        children: React.ReactNode;
        screenOptions?: Record<string, unknown>;
      }) => ReactMock.createElement(View, { testID: 'root-stack' }, children),
      Screen: ({
        component: Component,
      }: {
        name: string;
        component: React.FC;
        options?: Record<string, unknown>;
      }) => ReactMock.createElement(Component, null),
    }),
  };
});

// [ADDED] Mock lucide-react-native
jest.mock('lucide-react-native', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const createMockIcon = (displayName: string) => {
    const MockIcon = (props: Record<string, unknown>) =>
      ReactMock.createElement(View, { testID: `lucide-${displayName}`, ...props });
    MockIcon.displayName = displayName;
    return MockIcon;
  };
  return {
    MapPin: createMockIcon('MapPin'),
    List: createMockIcon('List'),
    PlusCircle: createMockIcon('PlusCircle'),
    User: createMockIcon('User'),
  };
});

describe('Navigation integration', () => {
  // ─── Default screen ───────────────────────────────────────
  it('displays MapScreen by default (first tab)', () => {
    render(
      <QueryClientProvider client={testQueryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>,
    );

    // MapScreen title is "Carte" (fr default from jest.setup.js locale mock)
    expect(screen.getByText('Carte')).toBeOnTheScreen();
  });

  // ─── 4 tabs rendered ─────────────────────────────────────
  it('renders all 4 tab screens', () => {
    render(
      <QueryClientProvider client={testQueryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('tab-screen-Map')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-screen-Sessions')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-screen-Create')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-screen-Profile')).toBeOnTheScreen();
  });

  // ─── Bottom tabs container ────────────────────────────────
  it('renders the bottom tabs navigator', () => {
    render(
      <QueryClientProvider client={testQueryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('bottom-tabs')).toBeOnTheScreen();
  });

  // ─── Each screen displays its i18n title ──────────────────
  it('displays i18n titles for all screens', () => {
    render(
      <QueryClientProvider client={testQueryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>,
    );

    // FR titles from locale files
    // Note: "Sessions" appears twice (route name + i18n title), so use getAllByText
    expect(screen.getByText('Carte')).toBeOnTheScreen();
    expect(screen.getAllByText('Sessions').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Créer une session')).toBeOnTheScreen();
    expect(screen.getByText('Profil')).toBeOnTheScreen();
  });
});

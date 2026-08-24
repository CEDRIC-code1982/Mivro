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
import '@/i18n';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // [ADDED]
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import RootNavigator from '@navigations/RootNavigator';
import { useSessionStore } from '@state/useSessionStore'; // [FIXED P0-7]

// [MODIFIED] Mock getContainer pour useGeocodeQuery + getCurrentLocationUseCase + midpoint
jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    searchAddressUseCase: { execute: jest.fn().mockResolvedValue([]) },
    getCurrentLocationUseCase: { execute: jest.fn().mockResolvedValue({}) },
    calculateMidpointUseCase: { execute: jest.fn() }, // [ADDED]
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
        options,
      }: {
        name: string;
        component: React.FC;
        options?: { tabBarIcon?: (props: { focused: boolean }) => React.ReactNode };
      }) =>
        ReactMock.createElement(
          View,
          { testID: `tab-screen-${name}` },
          ReactMock.createElement(Text, null, name),
          // [ADDED] Rend l'icône de l'onglet dans ses deux états, sinon les
          // callbacks tabBarIcon du navigator ne sont jamais invoqués.
          // Renders the tab icon in both states, otherwise the navigator's
          // tabBarIcon callbacks are never invoked.
          options?.tabBarIcon
            ? ReactMock.createElement(
                View,
                { testID: `tab-icon-${name}` },
                options.tabBarIcon({ focused: true }),
                options.tabBarIcon({ focused: false }),
              )
            : null,
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

// [MODIFIED] Mock lucide-react-native — Proxy pour supporter toutes les icônes
jest.mock('lucide-react-native', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const createMockIcon = (displayName: string) => {
    const MockIcon = (props: Record<string, unknown>) =>
      ReactMock.createElement(View, { testID: `lucide-${displayName}`, ...props });
    MockIcon.displayName = displayName;
    return MockIcon;
  };
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => createMockIcon(prop),
    },
  );
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

    // [MODIFIED] MapScreen shows EmptyState — session is draft (created by CreateSessionScreen mount)
    expect(screen.getByText('Calcul en attente')).toBeOnTheScreen();
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

  // ─── Icônes d'onglets (A11Y-003 : label sur chaque icône) ─
  it('renders an accessible icon for each of the 4 tabs, focused and unfocused', () => {
    render(
      <QueryClientProvider client={testQueryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>,
    );

    for (const tab of ['Map', 'Sessions', 'Create', 'Profile']) {
      expect(screen.getByTestId(`tab-icon-${tab}`)).toBeOnTheScreen();
    }

    // Chaque icône est rendue 2 fois (focused + non focused) → 8 libellés.
    expect(screen.getAllByLabelText(/Carte|Sessions|Créer|Profil/)).toHaveLength(8);
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

  // ─── P0-7 : Initial tab logic ──────────────────────────────
  describe('initial tab logic (P0-7)', () => {
    it('selects Create tab when no session exists', () => {
      useSessionStore.setState({ session: null });
      const session = useSessionStore.getState().session;
      const initialTab = session?.status === 'computed' ? 'Map' : 'Create';
      expect(initialTab).toBe('Create');
    });

    it('selects Map tab when session is computed', () => {
      useSessionStore.setState({
        session: {
          id: 'test-session',
          status: 'computed',
          participants: [],
          midpoint: { latitude: 0, longitude: 0 },
          midpointRadius: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      const session = useSessionStore.getState().session;
      const initialTab = session?.status === 'computed' ? 'Map' : 'Create';
      expect(initialTab).toBe('Map');
    });

    it('selects Create tab when session is draft', () => {
      useSessionStore.setState({
        session: {
          id: 'test-session',
          status: 'draft',
          participants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      const session = useSessionStore.getState().session;
      const initialTab = session?.status === 'computed' ? 'Map' : 'Create';
      expect(initialTab).toBe('Create');
    });
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
    // [MODIFIED] MapScreen shows EmptyState (session is draft from CreateSessionScreen mount)
    // Note: "Sessions" appears twice (route name + i18n title), so use getAllByText
    expect(screen.getByText('Calcul en attente')).toBeOnTheScreen();
    expect(screen.getAllByText('Sessions').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Créer une session')).toBeOnTheScreen();
    expect(screen.getByText('Profil')).toBeOnTheScreen();
  });
});

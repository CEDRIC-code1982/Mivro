/**
 * @file navigation.test.tsx
 * @description Lightweight navigation integration tests.
 *
 *              Verifies RootNavigator displays all 4 tabs
 *              and MapScreen is the default screen.
 *
 * @module navigations/navigation.integration.test
 */

// [ADDED] Navigation integration tests
import '@/i18n';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // [ADDED]
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import RootNavigator from '@navigations/RootNavigator';
import { useSessionStore } from '@state/useSessionStore'; // [FIXED P0-7]

// [MODIFIED] Mock getContainer for useGeocodeQuery + getCurrentLocationUseCase + midpoint
jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    searchAddressUseCase: { execute: jest.fn().mockResolvedValue([]) },
    getCurrentLocationUseCase: { execute: jest.fn().mockResolvedValue({}) },
    calculateMidpointUseCase: { execute: jest.fn() }, // [ADDED]
  })),
}));

// [ADDED] Test QueryClient for the TanStack Query hooks
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
        options?: {
          tabBarAccessibilityLabel?: string;
          tabBarIcon?: (props: { focused: boolean }) => React.ReactNode;
        };
      }) =>
        ReactMock.createElement(
          View,
          { testID: `tab-screen-${name}` },
          ReactMock.createElement(Text, null, name),
          // [ADDED] Renders the tab icon in both states, otherwise the navigator's
          // tabBarIcon callbacks are never invoked.
          // [MODIFIED] A11Y-003 — the icons sit inside a tab button carrying
          // tabBarAccessibilityLabel, as BottomTabItem does in
          // @react-navigation/bottom-tabs. Only the label is mocked: the real role
          // depends on the platform ('button' on iOS, 'tab' elsewhere), so no test
          // may rely on it here.
          options?.tabBarIcon
            ? ReactMock.createElement(
                View,
                {
                  testID: `tab-icon-${name}`,
                  accessible: true,
                  accessibilityLabel: options.tabBarAccessibilityLabel,
                },
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

// [MODIFIED] Mock lucide-react-native — Proxy to support every icon
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

  // ─── Tab buttons and icons (A11Y-003, D1: decorative icons) ─
  it('labels the 4 tab buttons only, the icons adding no label of their own', () => {
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

    // Each icon is rendered twice (focused + unfocused) but is hidden from
    // screen readers since D1: only the tab buttons' tabBarAccessibilityLabel
    // remains, one per tab.
    expect(screen.getAllByLabelText(/Carte|Sessions|Créer|Profil/)).toHaveLength(4);
    expect(screen.getByTestId('tab-icon-Map').props.accessibilityLabel).toBe('Carte');
    expect(screen.getByTestId('tab-icon-Sessions').props.accessibilityLabel).toBe('Sessions');
    expect(screen.getByTestId('tab-icon-Create').props.accessibilityLabel).toBe('Créer');
    expect(screen.getByTestId('tab-icon-Profile').props.accessibilityLabel).toBe('Profil');
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

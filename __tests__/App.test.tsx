/**
 * @file App.test.tsx
 * @description Smoke test de l'App racine.
 *              Root App smoke test.
 *
 * @format
 */

// [MODIFIED] Updated to use RNTL + navigation mocks after template removal
import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import App from '../src/presentation/App';

// [ADDED] Mock @react-navigation/native — full mock (ESM module not transformable by Jest)
jest.mock('@react-navigation/native', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      ReactMock.createElement(View, null, children),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
  };
});

// [ADDED] Mock @react-navigation/bottom-tabs
jest.mock('@react-navigation/bottom-tabs', () => {
  const ReactMock = require('react');
  const { View, Text } = require('react-native');
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) =>
        ReactMock.createElement(View, { testID: 'bottom-tabs' }, children),
      Screen: ({ name, component: Component }: { name: string; component: React.FC }) =>
        ReactMock.createElement(
          View,
          { testID: `tab-${name}` },
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
      Navigator: ({ children }: { children: React.ReactNode }) =>
        ReactMock.createElement(View, null, children),
      Screen: ({ component: Component }: { component: React.FC }) =>
        ReactMock.createElement(Component, null),
    }),
  };
});

// [ADDED] Mock infrastructure/storage/getEncryptionKey (async bootstrap)
jest.mock('@infrastructure/storage/getEncryptionKey', () => ({
  getEncryptionKey: jest.fn().mockResolvedValue('test-encryption-key-1234'),
}));

// [ADDED] Mock di/container (DI bootstrap)
jest.mock('@/di/container', () => ({
  initContainer: jest.fn().mockReturnValue({
    storage: {},
    zustandStorage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    },
    createGuestUserUseCase: { execute: jest.fn() },
  }),
  getContainer: jest.fn().mockReturnValue({
    storage: {},
    zustandStorage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    },
    createGuestUserUseCase: { execute: jest.fn() },
  }),
}));

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

// [MODIFIED] Test is now async — waits for DI container bootstrap
test('renders without crashing', async () => {
  render(<App />);

  // Attend que le bootstrap async (getEncryptionKey → initContainer) se termine
  await waitFor(() => {
    expect(screen.getByText('Carte')).toBeOnTheScreen();
  });
});

/**
 * @file Screen.test.tsx
 * @description Tests unitaires de l'atome Screen.
 *              Unit tests for the Screen atom.
 *
 * @module components/atoms/Screen/Screen.test
 */

// [ADDED] Tests unitaires atome Screen
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import Screen from './Screen';

describe('Screen atom', () => {
  // ─── Smoke test ───────────────────────────────────────────
  it('renders without crashing', () => {
    render(
      <Screen testID="screen">
        <Text>Content</Text>
      </Screen>,
    );

    expect(screen.getByTestId('screen')).toBeOnTheScreen();
  });

  // ─── Children rendering ───────────────────────────────────
  it('renders children correctly', () => {
    render(
      <Screen>
        <Text>Hello Screen</Text>
      </Screen>,
    );

    expect(screen.getByText('Hello Screen')).toBeOnTheScreen();
  });

  // ─── Default edges prop ───────────────────────────────────
  it('applies all 4 edges by default', () => {
    render(
      <Screen testID="screen-edges">
        <Text>Edges test</Text>
      </Screen>,
    );

    const safeArea = screen.getByTestId('screen-edges');
    // SafeAreaView receives edges prop — default should be all 4
    expect(safeArea.props.edges).toEqual(['top', 'bottom', 'left', 'right']);
  });

  // ─── Custom edges ─────────────────────────────────────────
  it('accepts custom edges prop', () => {
    render(
      <Screen testID="screen-custom-edges" edges={['top']}>
        <Text>Top only</Text>
      </Screen>,
    );

    const safeArea = screen.getByTestId('screen-custom-edges');
    expect(safeArea.props.edges).toEqual(['top']);
  });

  // ─── Scrollable mode ──────────────────────────────────────
  it('wraps children in ScrollView when scrollable is true', () => {
    render(
      <Screen testID="screen-scroll" scrollable>
        <Text>Scrollable content</Text>
      </Screen>,
    );

    expect(screen.getByTestId('screen-scroll-scroll')).toBeOnTheScreen();
  });

  // ─── Non-scrollable by default ────────────────────────────
  it('does not render ScrollView when scrollable is false (default)', () => {
    render(
      <Screen testID="screen-no-scroll">
        <Text>Static content</Text>
      </Screen>,
    );

    expect(screen.queryByTestId('screen-no-scroll-scroll')).toBeNull();
  });
});

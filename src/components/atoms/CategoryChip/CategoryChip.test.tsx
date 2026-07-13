/**
 * @file CategoryChip.test.tsx
 * @description Tests unitaires de l'atome CategoryChip.
 *              Unit tests for the CategoryChip atom.
 *
 * @module __tests__/unit/presentation/components/atoms/CategoryChip
 */

// [ADDED] Tests unitaires CategoryChip

import { fireEvent, render } from '@testing-library/react-native';
import { Coffee } from 'lucide-react-native';
import React from 'react';
import CategoryChip from '@components/atoms/CategoryChip';

describe('CategoryChip', () => {
  const defaultProps = {
    label: 'Cafés',
    selected: false,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(<CategoryChip {...defaultProps} testID="chip" />);

    expect(getByTestId('chip')).toBeTruthy();
  });

  it('renders the label text', () => {
    const { getByText } = render(<CategoryChip {...defaultProps} />);

    expect(getByText('Cafés')).toBeTruthy();
  });

  it('renders icon when provided', () => {
    const { UNSAFE_queryAllByType } = render(
      <CategoryChip {...defaultProps} icon={Coffee} testID="chip" />,
    );

    // Lucide icons render as SVG — check that an SVG element is present
    expect(UNSAFE_queryAllByType(Coffee).length).toBeGreaterThan(0);
  });

  it('does not render extra SVG icon when icon not provided', () => {
    const { UNSAFE_queryAllByType } = render(<CategoryChip {...defaultProps} testID="chip" />);

    expect(UNSAFE_queryAllByType(Coffee).length).toBe(0);
  });

  it('sets accessibilityState.selected to true when selected', () => {
    const { getByTestId } = render(
      <CategoryChip {...defaultProps} selected={true} testID="chip" />,
    );

    expect(getByTestId('chip').props.accessibilityState).toEqual({ selected: true });
  });

  it('sets accessibilityState.selected to false when not selected', () => {
    const { getByTestId } = render(
      <CategoryChip {...defaultProps} selected={false} testID="chip" />,
    );

    expect(getByTestId('chip').props.accessibilityState).toEqual({ selected: false });
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <CategoryChip {...defaultProps} onPress={onPress} testID="chip" />,
    );

    fireEvent.press(getByTestId('chip'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders count badge when count is provided', () => {
    const { getByTestId, getByText } = render(
      <CategoryChip {...defaultProps} count={12} testID="chip" />,
    );

    expect(getByTestId('chip-badge')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
  });

  it('does not render badge when count is not provided', () => {
    const { queryByTestId } = render(<CategoryChip {...defaultProps} testID="chip" />);

    expect(queryByTestId('chip-badge')).toBeNull();
  });

  it('includes count in accessibilityLabel when count provided', () => {
    const { getByTestId } = render(<CategoryChip {...defaultProps} count={5} testID="chip" />);

    expect(getByTestId('chip').props.accessibilityLabel).toBe('Cafés, 5');
  });

  it('uses label only as accessibilityLabel when no count', () => {
    const { getByTestId } = render(<CategoryChip {...defaultProps} testID="chip" />);

    expect(getByTestId('chip').props.accessibilityLabel).toBe('Cafés');
  });

  it('uses custom accessibilityLabel when provided', () => {
    const { getByTestId } = render(
      <CategoryChip {...defaultProps} accessibilityLabel="Custom label" testID="chip" />,
    );

    expect(getByTestId('chip').props.accessibilityLabel).toBe('Custom label');
  });
});

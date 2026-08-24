/**
 * @file EmptyState.test.tsx
 * @description Tests unitaires de la molecule EmptyState.
 *              Unit tests for the EmptyState molecule.
 *
 * @module components/molecules/EmptyState/EmptyState.test
 */

// [ADDED] Tests unitaires EmptyState

import { render } from '@testing-library/react-native';
import { MapPin } from 'lucide-react-native';
import React from 'react';
import EmptyState from '@components/molecules/EmptyState';

// ─── Tests ──────────────────────────────────────────────────

describe('EmptyState', () => {
  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(<EmptyState title="No data" testID="empty" />);

    expect(getByTestId('empty')).toBeTruthy();
  });

  it('renders the title', () => {
    const { getByText } = render(<EmptyState title="Aucun résultat" />);

    expect(getByText('Aucun résultat')).toBeTruthy();
  });

  it('renders the description when provided', () => {
    const { getByText } = render(
      <EmptyState title="Aucun résultat" description="Essaie autre chose" />,
    );

    expect(getByText('Essaie autre chose')).toBeTruthy();
  });

  it('does not render description when not provided', () => {
    const { queryByText } = render(<EmptyState title="Aucun résultat" />);

    expect(queryByText('Essaie autre chose')).toBeNull();
  });

  it('renders icon when provided', () => {
    const { getByTestId } = render(<EmptyState icon={MapPin} title="Aucun point" testID="empty" />);

    expect(getByTestId('empty-icon')).toBeTruthy();
  });

  it('does not render icon when not provided', () => {
    const { queryByTestId } = render(<EmptyState title="Aucun point" testID="empty" />);

    expect(queryByTestId('empty-icon')).toBeNull();
  });

  it('concatenates title and description in accessibilityLabel', () => {
    const { getByTestId } = render(
      <EmptyState title="Aucun résultat" description="Essaie autre chose" testID="empty" />,
    );

    expect(getByTestId('empty').props.accessibilityLabel).toBe(
      'Aucun résultat, Essaie autre chose',
    );
  });

  it('uses title only as accessibilityLabel when no description', () => {
    const { getByTestId } = render(<EmptyState title="Aucun résultat" testID="empty" />);

    expect(getByTestId('empty').props.accessibilityLabel).toBe('Aucun résultat');
  });
});

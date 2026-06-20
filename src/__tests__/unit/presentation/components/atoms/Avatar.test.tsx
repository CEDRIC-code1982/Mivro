/**
 * @file Avatar.test.tsx
 * @description Tests unitaires de l'atome Avatar (F7).
 *              Unit tests for the Avatar atom (F7).
 *
 * @module __tests__/unit/presentation/components/atoms/Avatar
 */

// [ADDED] F7 — Tests unitaires atome Avatar
import { render } from '@testing-library/react-native';
import React from 'react';
import Avatar from '@presentation/components/atoms/Avatar';

describe('Avatar atom', () => {
  it('renders without crashing (smoke test)', () => {
    // L'atome est décoratif (masqué de l'arbre a11y) → includeHiddenElements
    const { getByTestId } = render(<Avatar fallbackName="Léa" testID="avatar" />);

    expect(getByTestId('avatar', { includeHiddenElements: true })).toBeTruthy();
  });

  it('renders the emoji when avatarId is a known avatar', () => {
    const { getByTestId } = render(<Avatar avatarId="fox" fallbackName="Léa" testID="avatar" />);

    // L'avatar est masqué de l'arbre a11y → includeHiddenElements
    expect(getByTestId('avatar-emoji', { includeHiddenElements: true }).props.children).toBe('🦊');
  });

  it('renders the name initial (uppercase) when no avatarId', () => {
    const { getByTestId } = render(<Avatar fallbackName="sophie" testID="avatar" />);

    expect(getByTestId('avatar-initial', { includeHiddenElements: true }).props.children).toBe('S');
  });

  it('renders the initial when avatarId is unknown (fallback)', () => {
    const { getByTestId, queryByTestId } = render(
      <Avatar avatarId="unknown-id" fallbackName="Marc" testID="avatar" />,
    );

    expect(getByTestId('avatar-initial', { includeHiddenElements: true }).props.children).toBe('M');
    expect(queryByTestId('avatar-emoji', { includeHiddenElements: true })).toBeNull();
  });

  it('falls back to "?" when fallbackName is empty and no avatar', () => {
    const { getByTestId } = render(<Avatar fallbackName="   " testID="avatar" />);

    expect(getByTestId('avatar-initial', { includeHiddenElements: true }).props.children).toBe('?');
  });

  it('is hidden from the accessibility tree (decorative)', () => {
    const { getByTestId } = render(<Avatar avatarId="cat" fallbackName="Léa" testID="avatar" />);

    expect(
      getByTestId('avatar', { includeHiddenElements: true }).props.accessibilityElementsHidden,
    ).toBe(true);
  });
});

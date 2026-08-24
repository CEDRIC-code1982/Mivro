/**
 * @file Avatar.test.tsx
 * @description Tests unitaires de l'atome Avatar (F7).
 *              Unit tests for the Avatar atom (F7).
 *
 * @module components/atoms/Avatar/Avatar.test
 */

// [ADDED] F7 — Tests unitaires atome Avatar
import { render } from '@testing-library/react-native';
import React from 'react';
import Avatar from '@components/atoms/Avatar';

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

  // ─── F7 passe 2 — priorité photo > emoji > initiale ───────
  it('renders the photo when photoUri is provided (over emoji)', () => {
    const { getByTestId, queryByTestId } = render(
      <Avatar photoUri="/profile.jpg" avatarId="fox" fallbackName="Léa" testID="avatar" />,
    );

    const photo = getByTestId('avatar-photo', { includeHiddenElements: true });
    expect(photo.props.source).toEqual({ uri: '/profile.jpg' });
    // La photo prime : ni emoji ni initiale
    expect(queryByTestId('avatar-emoji', { includeHiddenElements: true })).toBeNull();
    expect(queryByTestId('avatar-initial', { includeHiddenElements: true })).toBeNull();
  });

  it('ignores an empty photoUri and falls back to the emoji', () => {
    const { getByTestId, queryByTestId } = render(
      <Avatar photoUri="" avatarId="fox" fallbackName="Léa" testID="avatar" />,
    );

    expect(getByTestId('avatar-emoji', { includeHiddenElements: true }).props.children).toBe('🦊');
    expect(queryByTestId('avatar-photo', { includeHiddenElements: true })).toBeNull();
  });

  it('renders the photo over the initial when there is no avatarId', () => {
    const { getByTestId, queryByTestId } = render(
      <Avatar photoUri="/p.jpg" fallbackName="Marc" testID="avatar" />,
    );

    expect(getByTestId('avatar-photo', { includeHiddenElements: true })).toBeTruthy();
    expect(queryByTestId('avatar-initial', { includeHiddenElements: true })).toBeNull();
  });

  it('is hidden from the accessibility tree (decorative)', () => {
    const { getByTestId } = render(<Avatar avatarId="cat" fallbackName="Léa" testID="avatar" />);

    expect(
      getByTestId('avatar', { includeHiddenElements: true }).props.accessibilityElementsHidden,
    ).toBe(true);
  });
});

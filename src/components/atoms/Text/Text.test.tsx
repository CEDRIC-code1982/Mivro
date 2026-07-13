/**
 * @file Text.test.tsx
 * @description Tests unitaires de l'atome Text.
 *              Unit tests for the Text atom.
 *
 * @module presentation/components/atoms/Text/__tests__
 */

// [ADDED] Tests unitaires atome Text
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import Text from './Text';

describe('Text atom', () => {
  // ─── Smoke test ───────────────────────────────────────────
  it('renders without crashing', () => {
    render(<Text>Mivro</Text>);

    expect(screen.getByText('Mivro')).toBeOnTheScreen();
  });

  // ─── Children rendering ───────────────────────────────────
  it('renders children correctly', () => {
    render(<Text>Hello World</Text>);

    expect(screen.getByText('Hello World')).toBeOnTheScreen();
  });

  // ─── Variant prop (fontSize) ──────────────────────────────
  it('applies h1 variant fontSize', () => {
    render(
      <Text variant="h1" testID="text-h1">
        Title
      </Text>,
    );

    const textElement = screen.getByTestId('text-h1');
    const flatStyle = textElement.props.style;
    // h1 fontSize token = 32
    const h1Styles = Array.isArray(flatStyle)
      ? flatStyle.find(
          (s: Record<string, unknown>) => typeof s === 'object' && s !== null && 'fontSize' in s,
        )
      : flatStyle;

    expect(h1Styles).toBeDefined();
    expect(h1Styles.fontSize).toBe(32);
  });

  // ─── Default variant ──────────────────────────────────────
  it('defaults to body variant (fontSize 16)', () => {
    render(<Text testID="text-body">Body text</Text>);

    const textElement = screen.getByTestId('text-body');
    const flatStyle = textElement.props.style;
    const bodyStyles = Array.isArray(flatStyle)
      ? flatStyle.find(
          (s: Record<string, unknown>) => typeof s === 'object' && s !== null && 'fontSize' in s,
        )
      : flatStyle;

    expect(bodyStyles).toBeDefined();
    expect(bodyStyles.fontSize).toBe(16);
  });

  // ─── Accessibility ────────────────────────────────────────
  it('supports accessibilityRole prop', () => {
    render(
      <Text accessibilityRole="header" testID="text-a11y">
        Accessible
      </Text>,
    );

    const textElement = screen.getByTestId('text-a11y');
    expect(textElement.props.accessibilityRole).toBe('header');
  });

  it('enables allowFontScaling by default (A11Y-004)', () => {
    render(<Text testID="text-scaling">Scalable</Text>);

    const textElement = screen.getByTestId('text-scaling');
    expect(textElement.props.allowFontScaling).toBe(true);
  });

  // ─── numberOfLines ────────────────────────────────────────
  it('passes numberOfLines prop', () => {
    render(
      <Text numberOfLines={2} testID="text-lines">
        Truncated
      </Text>,
    );

    const textElement = screen.getByTestId('text-lines');
    expect(textElement.props.numberOfLines).toBe(2);
  });
});

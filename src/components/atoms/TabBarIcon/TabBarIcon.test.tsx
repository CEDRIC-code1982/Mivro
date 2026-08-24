/**
 * @file TabBarIcon.test.tsx
 * @description Tests unitaires de l'atome TabBarIcon.
 *              Unit tests for the TabBarIcon atom.
 *
 * @module components/atoms/TabBarIcon/TabBarIcon.test
 */

// [ADDED] Tests unitaires atome TabBarIcon
import { render, screen } from '@testing-library/react-native';
import { MapPin } from 'lucide-react-native';
import React from 'react';
import TabBarIcon from './TabBarIcon';

// [ADDED] Mock lucide-react-native — native SVG unavailable in Jest
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

describe('TabBarIcon atom', () => {
  // ─── Smoke test ───────────────────────────────────────────
  it('renders without crashing', () => {
    render(<TabBarIcon icon={MapPin} focused={false} accessibilityLabel="Carte" />);

    expect(screen.getByLabelText('Carte')).toBeOnTheScreen();
  });

  // ─── Focused state — brand color ─────────────────────────
  it('applies brand color when focused', () => {
    render(<TabBarIcon icon={MapPin} focused={true} accessibilityLabel="Carte active" />);

    const lucideIcon = screen.getByTestId('lucide-MapPin');
    // brand.default = palette.brand[600] = '#4F46E5' (light theme, indigo)
    expect(lucideIcon.props.color).toBe('#4F46E5');
  });

  // ─── Unfocused state — tertiary color ─────────────────────
  it('applies tertiary color when not focused', () => {
    render(<TabBarIcon icon={MapPin} focused={false} accessibilityLabel="Carte inactive" />);

    const lucideIcon = screen.getByTestId('lucide-MapPin');
    // text.tertiary = palette.neutral[500] = '#71717A' (light theme)
    expect(lucideIcon.props.color).toBe('#71717A');
  });

  // ─── StrokeWidth focused vs unfocused ─────────────────────
  it('uses thicker strokeWidth when focused', () => {
    render(<TabBarIcon icon={MapPin} focused={true} accessibilityLabel="Carte bold" />);

    const lucideIcon = screen.getByTestId('lucide-MapPin');
    expect(lucideIcon.props.strokeWidth).toBe(2.5);
  });

  it('uses default strokeWidth when not focused', () => {
    render(<TabBarIcon icon={MapPin} focused={false} accessibilityLabel="Carte normal" />);

    const lucideIcon = screen.getByTestId('lucide-MapPin');
    expect(lucideIcon.props.strokeWidth).toBe(2);
  });

  // ─── Accessibility ────────────────────────────────────────
  it('has accessibilityRole image', () => {
    render(<TabBarIcon icon={MapPin} focused={false} accessibilityLabel="Carte a11y" />);

    const wrapper = screen.getByLabelText('Carte a11y');
    expect(wrapper.props.accessibilityRole).toBe('image');
  });
});

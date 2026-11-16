/**
 * @file TabBarIcon.test.tsx
 * @description Unit tests for the TabBarIcon atom.
 *
 * @module components/atoms/TabBarIcon/TabBarIcon.test
 */

// [ADDED] TabBarIcon atom unit tests
import { isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
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

// [MODIFIED] A11Y-003 (D1) — the icon is decorative and hidden from screen readers,
// so every query has to opt into hidden elements.
const HIDDEN = { includeHiddenElements: true };

describe('TabBarIcon atom', () => {
  // ─── Smoke test ───────────────────────────────────────────
  it('renders without crashing', () => {
    render(<TabBarIcon icon={MapPin} focused={false} />);

    expect(screen.getByTestId('lucide-MapPin', HIDDEN)).toBeOnTheScreen();
  });

  // ─── Focused state — brand color ─────────────────────────
  it('applies brand color when focused', () => {
    render(<TabBarIcon icon={MapPin} focused={true} />);

    const lucideIcon = screen.getByTestId('lucide-MapPin', HIDDEN);
    // brand.default = palette.brand[600] = '#4F46E5' (light theme, indigo)
    expect(lucideIcon.props.color).toBe('#4F46E5');
  });

  // ─── Unfocused state — tertiary color ─────────────────────
  it('applies tertiary color when not focused', () => {
    render(<TabBarIcon icon={MapPin} focused={false} />);

    const lucideIcon = screen.getByTestId('lucide-MapPin', HIDDEN);
    // text.tertiary = palette.neutral[500] = '#71717A' (light theme)
    expect(lucideIcon.props.color).toBe('#71717A');
  });

  // ─── StrokeWidth focused vs unfocused ─────────────────────
  it('uses thicker strokeWidth when focused', () => {
    render(<TabBarIcon icon={MapPin} focused={true} />);

    const lucideIcon = screen.getByTestId('lucide-MapPin', HIDDEN);
    expect(lucideIcon.props.strokeWidth).toBe(2.5);
  });

  it('uses default strokeWidth when not focused', () => {
    render(<TabBarIcon icon={MapPin} focused={false} />);

    const lucideIcon = screen.getByTestId('lucide-MapPin', HIDDEN);
    expect(lucideIcon.props.strokeWidth).toBe(2);
  });

  // ─── Accessibility ────────────────────────────────────────
  // [MODIFIED] A11Y-003 (D1) — the tab button announces its own label
  // (tabBarAccessibilityLabel), so the icon must stay out of the accessibility tree.
  it('is hidden from screen readers', () => {
    render(<TabBarIcon icon={MapPin} focused={false} />);

    expect(screen.queryByTestId('lucide-MapPin')).toBeNull();
    expect(isHiddenFromAccessibility(screen.getByTestId('lucide-MapPin', HIDDEN))).toBe(true);
  });

  it('exposes no image role, even among hidden elements', () => {
    render(<TabBarIcon icon={MapPin} focused={false} />);

    expect(screen.queryByRole('image', HIDDEN)).toBeNull();
  });
});

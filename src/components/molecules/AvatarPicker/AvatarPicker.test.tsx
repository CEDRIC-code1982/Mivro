/**
 * @file AvatarPicker.test.tsx
 * @description Tests unitaires de la molecule AvatarPicker (F7).
 *              Unit tests for the AvatarPicker molecule (F7).
 *
 * @module __tests__/unit/presentation/components/molecules/AvatarPicker
 */

// [ADDED] F7 — Tests unitaires AvatarPicker

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import AvatarPicker from '@components/molecules/AvatarPicker';
import { AVATARS } from '@entities/Avatar';

// ─── Mock i18n ──────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key.startsWith('avatarNames.')) return key.replace('avatarNames.', '');
      if (key === 'avatarPicker.selectHint') return `Select ${params?.name ?? ''}`;
      return key;
    },
    i18n: { language: 'fr' },
  }),
}));

describe('AvatarPicker', () => {
  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(<AvatarPicker onSelect={jest.fn()} testID="picker" />);

    expect(getByTestId('picker')).toBeTruthy();
  });

  it('renders exactly 20 avatar cells', () => {
    const { getByTestId } = render(<AvatarPicker onSelect={jest.fn()} testID="picker" />);

    for (const avatar of AVATARS) {
      expect(getByTestId(`picker-${avatar.id}`)).toBeTruthy();
    }
    expect(AVATARS).toHaveLength(20);
  });

  it('exposes the grid as a radiogroup', () => {
    const { getByTestId } = render(<AvatarPicker onSelect={jest.fn()} testID="picker" />);

    expect(getByTestId('picker').props.accessibilityRole).toBe('radiogroup');
  });

  it('calls onSelect with the correct id when a cell is pressed', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<AvatarPicker onSelect={onSelect} testID="picker" />);

    fireEvent.press(getByTestId('picker-panda'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('panda');
  });

  it('marks the selected cell with a11y selected/checked state', () => {
    const { getByTestId } = render(
      <AvatarPicker selectedAvatarId="fox" onSelect={jest.fn()} testID="picker" />,
    );

    const selected = getByTestId('picker-fox');
    expect(selected.props.accessibilityState.selected).toBe(true);
    expect(selected.props.accessibilityState.checked).toBe(true);
  });

  it('leaves non-selected cells unselected', () => {
    const { getByTestId } = render(
      <AvatarPicker selectedAvatarId="fox" onSelect={jest.fn()} testID="picker" />,
    );

    const other = getByTestId('picker-cat');
    expect(other.props.accessibilityState.selected).toBe(false);
    expect(other.props.accessibilityState.checked).toBe(false);
  });

  it('exposes each cell as a radio button with a label', () => {
    const { getByTestId } = render(<AvatarPicker onSelect={jest.fn()} testID="picker" />);

    const cell = getByTestId('picker-owl');
    expect(cell.props.accessibilityRole).toBe('radio');
    expect(cell.props.accessibilityLabel).toBe('owl');
  });
});

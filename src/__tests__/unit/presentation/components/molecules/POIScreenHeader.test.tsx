/**
 * @file POIScreenHeader.test.tsx
 * @description Tests unitaires de la molecule POIScreenHeader.
 *              Unit tests for the POIScreenHeader molecule.
 *
 * @module __tests__/unit/presentation/components/molecules/POIScreenHeader
 */

// [ADDED] Tests unitaires POIScreenHeader

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { ALL_POI_CATEGORIES } from '@core/entities/POICategory';
import POIScreenHeader from '@presentation/components/molecules/POIScreenHeader';

// ─── Mock i18n ────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'viewMode.list': 'Liste',
        'viewMode.map': 'Carte',
        'categories.all': 'Tout',
        'categories.restaurant': 'Restaurants',
        'categories.cafe': 'Cafés',
        'categories.bar': 'Bars',
        'categories.park': 'Parcs',
        'categories.cinema': 'Cinémas',
        'categories.museum': 'Musées',
        'categories.shop': 'Boutiques',
        'categories.sport': 'Sport',
        'categories.hotel': 'Hôtels',
      };
      return translations[key] ?? key;
    },
  }),
}));

// ─── Tests ────────────────────────────────────────────────────

describe('POIScreenHeader', () => {
  const defaultProps = {
    viewMode: 'list' as const,
    onViewModeChange: jest.fn(),
    selectedCategories: ALL_POI_CATEGORIES,
    onToggleCategory: jest.fn(),
    onSelectAllCategories: jest.fn(),
    onClearCategories: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(<POIScreenHeader {...defaultProps} testID="header" />);

    expect(getByTestId('header')).toBeTruthy();
  });

  it('renders toggle buttons for list and map', () => {
    const { getByTestId } = render(<POIScreenHeader {...defaultProps} testID="header" />);

    expect(getByTestId('header-toggle-list')).toBeTruthy();
    expect(getByTestId('header-toggle-map')).toBeTruthy();
  });

  it('calls onViewModeChange("map") when Carte toggle is pressed', () => {
    const onViewModeChange = jest.fn();
    const { getByTestId } = render(
      <POIScreenHeader {...defaultProps} onViewModeChange={onViewModeChange} testID="header" />,
    );

    fireEvent.press(getByTestId('header-toggle-map'));

    expect(onViewModeChange).toHaveBeenCalledWith('map');
  });

  it('calls onViewModeChange("list") when Liste toggle is pressed', () => {
    const onViewModeChange = jest.fn();
    const { getByTestId } = render(
      <POIScreenHeader
        {...defaultProps}
        viewMode="map"
        onViewModeChange={onViewModeChange}
        testID="header"
      />,
    );

    fireEvent.press(getByTestId('header-toggle-list'));

    expect(onViewModeChange).toHaveBeenCalledWith('list');
  });

  it('renders category chips for all categories', () => {
    const { getByTestId } = render(<POIScreenHeader {...defaultProps} testID="header" />);

    expect(getByTestId('header-chip-all')).toBeTruthy();
    expect(getByTestId('header-chip-restaurant')).toBeTruthy();
    expect(getByTestId('header-chip-cafe')).toBeTruthy();
    expect(getByTestId('header-chip-bar')).toBeTruthy();
  });

  it('calls onToggleCategory when a category chip is pressed', () => {
    const onToggleCategory = jest.fn();
    const { getByTestId } = render(
      <POIScreenHeader {...defaultProps} onToggleCategory={onToggleCategory} testID="header" />,
    );

    fireEvent.press(getByTestId('header-chip-restaurant'));

    expect(onToggleCategory).toHaveBeenCalledWith('restaurant');
  });

  it('calls onClearCategories when "Tout" chip is pressed and all selected', () => {
    const onClearCategories = jest.fn();
    const { getByTestId } = render(
      <POIScreenHeader
        {...defaultProps}
        selectedCategories={ALL_POI_CATEGORIES}
        onClearCategories={onClearCategories}
        testID="header"
      />,
    );

    fireEvent.press(getByTestId('header-chip-all'));

    expect(onClearCategories).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectAllCategories when "Tout" chip is pressed and not all selected', () => {
    const onSelectAllCategories = jest.fn();
    const { getByTestId } = render(
      <POIScreenHeader
        {...defaultProps}
        selectedCategories={['restaurant']}
        onSelectAllCategories={onSelectAllCategories}
        testID="header"
      />,
    );

    fireEvent.press(getByTestId('header-chip-all'));

    expect(onSelectAllCategories).toHaveBeenCalledTimes(1);
  });

  it('sets selected state on list toggle when viewMode is list', () => {
    const { getByTestId } = render(
      <POIScreenHeader {...defaultProps} viewMode="list" testID="header" />,
    );

    expect(getByTestId('header-toggle-list').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(getByTestId('header-toggle-map').props.accessibilityState).toEqual({
      selected: false,
    });
  });
});

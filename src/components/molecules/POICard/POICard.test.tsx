/**
 * @file POICard.test.tsx
 * @description Tests unitaires de la molecule POICard.
 *              Unit tests for the POICard molecule.
 *
 * @module components/molecules/POICard/POICard.test
 */

// [ADDED] Tests unitaires POICard

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import POICard from '@components/molecules/POICard';
import type { PointOfInterest } from '@entities/PointOfInterest';

// ─── Mock i18n ────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'categories.restaurant': 'Restaurants',
        'categories.cafe': 'Cafés',
        'detail.actions.navigate': 'Y aller',
      };
      return translations[key] ?? key;
    },
  }),
}));

// ─── Test data ────────────────────────────────────────────────

const makePOI = (overrides?: Partial<PointOfInterest>): PointOfInterest => ({
  externalId: 'node/12345',
  category: 'restaurant',
  name: 'Le Petit Bistro',
  coordinates: { latitude: 48.8566, longitude: 2.3522 },
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────

describe('POICard', () => {
  const defaultProps = {
    poi: makePOI(),
    distanceMeters: 1234,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(<POICard {...defaultProps} testID="poi-card" />);

    expect(getByTestId('poi-card')).toBeTruthy();
  });

  it('renders the POI name', () => {
    const { getByText } = render(<POICard {...defaultProps} />);

    expect(getByText('Le Petit Bistro')).toBeTruthy();
  });

  it('renders formatted distance', () => {
    const { getByText } = render(<POICard {...defaultProps} />);

    expect(getByText(/1\.2 km/)).toBeTruthy();
  });

  it('renders category label', () => {
    const { getByText } = render(<POICard {...defaultProps} />);

    expect(getByText(/Restaurants/)).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <POICard {...defaultProps} onPress={onPress} testID="poi-card" />,
    );

    fireEvent.press(getByTestId('poi-card'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sets correct accessibilityLabel with name, category and distance', () => {
    const { getByTestId } = render(<POICard {...defaultProps} testID="poi-card" />);

    expect(getByTestId('poi-card').props.accessibilityLabel).toBe(
      'Le Petit Bistro, Restaurants, 1.2 km',
    );
  });

  it('renders distance in meters for short distances', () => {
    const { getByText } = render(<POICard {...defaultProps} distanceMeters={450} />);

    expect(getByText(/450 m/)).toBeTruthy();
  });

  it('renders cafe category correctly', () => {
    const cafePoi = makePOI({ category: 'cafe', name: 'Starbucks' });
    const { getByText } = render(<POICard {...defaultProps} poi={cafePoi} />);

    expect(getByText('Starbucks')).toBeTruthy();
    expect(getByText(/Cafés/)).toBeTruthy();
  });
});

/**
 * @file POIDetailSheet.test.tsx
 * @description Tests unitaires de la molecule POIDetailSheet.
 *              Unit tests for the POIDetailSheet molecule.
 *
 * @module __tests__/unit/presentation/components/molecules/POIDetailSheet
 */

// [ADDED] Tests unitaires POIDetailSheet

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import POIDetailSheet from '@components/molecules/POIDetailSheet';
import type { PointOfInterest } from '@entities/PointOfInterest';

// ─── Mock i18n ────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'categories.restaurant': 'Restaurants',
        'categories.cafe': 'Cafés',
        'detail.distance': `${params?.distance ?? ''} du midpoint`,
        'detail.address': `Adresse : ${params?.address ?? ''}`,
        'detail.actions.navigate': 'Y aller',
        'detail.actions.close': 'Fermer',
      };
      return translations[key] ?? key;
    },
  }),
}));

// ─── Mock Linking ─────────────────────────────────────────────
jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

// ─── Test data ────────────────────────────────────────────────

const makePOI = (overrides?: Partial<PointOfInterest>): PointOfInterest => ({
  externalId: 'node/12345',
  category: 'restaurant',
  name: 'Le Petit Bistro',
  coordinates: { latitude: 48.8566, longitude: 2.3522 },
  address: '12 Rue de Rivoli, Paris',
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────

describe('POIDetailSheet', () => {
  const defaultProps = {
    poi: makePOI(),
    distanceMeters: 1200,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(<POIDetailSheet {...defaultProps} testID="detail" />);

    expect(getByTestId('detail')).toBeTruthy();
  });

  it('renders POI name when poi is provided', () => {
    const { getByText } = render(<POIDetailSheet {...defaultProps} testID="detail" />);

    expect(getByText('Le Petit Bistro')).toBeTruthy();
  });

  it('renders formatted distance', () => {
    const { getByText } = render(<POIDetailSheet {...defaultProps} testID="detail" />);

    expect(getByText(/1\.2 km du midpoint/)).toBeTruthy();
  });

  it('renders address when available', () => {
    const { getByText } = render(<POIDetailSheet {...defaultProps} testID="detail" />);

    expect(getByText(/12 Rue de Rivoli, Paris/)).toBeTruthy();
  });

  it('calls onClose when "Fermer" button is tapped', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <POIDetailSheet {...defaultProps} onClose={onClose} testID="detail" />,
    );

    fireEvent.press(getByTestId('detail-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls Linking.openURL when "Y aller" is tapped', async () => {
    const { getByTestId } = render(<POIDetailSheet {...defaultProps} testID="detail" />);

    fireEvent.press(getByTestId('detail-navigate'));

    // Attendre le prochain tick pour les promesses async
    await new Promise((r) => {
      setTimeout(r, 0);
    });

    expect(Linking.canOpenURL).toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('renders category label', () => {
    const { getByText } = render(<POIDetailSheet {...defaultProps} testID="detail" />);

    expect(getByText('Restaurants')).toBeTruthy();
  });

  it('renders coordinates', () => {
    const { getByText } = render(<POIDetailSheet {...defaultProps} testID="detail" />);

    expect(getByText(/48\.85660, 2\.35220/)).toBeTruthy();
  });
});

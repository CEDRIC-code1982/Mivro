/**
 * @file POIMapView.test.tsx
 * @description Tests unitaires de la molecule POIMapView.
 *              Unit tests for the POIMapView molecule.
 *
 * @module __tests__/unit/presentation/components/molecules/POIMapView
 */

// [ADDED] Tests unitaires POIMapView

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import type { Coordinates } from '@core/entities/Location';
import type { Participant } from '@core/entities/MidpointSession';
import type { PointOfInterest } from '@core/entities/PointOfInterest';
import POIMapView from '@presentation/components/molecules/POIMapView';

// ─── Mock react-native-maps ────────────────────────────────
jest.mock('react-native-maps', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const MockMapView = ReactMock.forwardRef((props: Record<string, unknown>, ref: unknown) =>
    ReactMock.createElement(View, { ...props, ref }),
  );
  MockMapView.displayName = 'MockMapView';

  return {
    __esModule: true,
    default: MockMapView,
    Marker: (props: Record<string, unknown>) => ReactMock.createElement(View, props),
    Circle: (props: Record<string, unknown>) => ReactMock.createElement(View, props),
    PROVIDER_GOOGLE: 'google',
  };
});

// ─── Test data ──────────────────────────────────────────────

const PARIS: Coordinates = { latitude: 48.8566, longitude: 2.3522 };
const LYON: Coordinates = { latitude: 45.764, longitude: 4.8357 };
const MIDPOINT: Coordinates = { latitude: 47.3103, longitude: 3.594 };

const makeParticipant = (name: string, coords: Coordinates): Participant => ({
  id: `p-${name.toLowerCase()}`,
  displayName: name,
  startLocation: {
    id: `loc-${name.toLowerCase()}`,
    coordinates: coords,
    formattedAddress: `Adresse de ${name}`,
  },
});

const makePOI = (id: string, name: string, lat: number, lng: number): PointOfInterest => ({
  externalId: id,
  category: 'restaurant',
  name,
  coordinates: { latitude: lat, longitude: lng },
});

const POIS: PointOfInterest[] = [
  makePOI('node/1', 'Bistro A', 47.31, 3.59),
  makePOI('node/2', 'Bistro B', 47.32, 3.6),
];

const defaultProps = {
  participants: [makeParticipant('Alice', PARIS), makeParticipant('Bob', LYON)],
  midpoint: MIDPOINT,
  radius: 196000,
  pois: POIS,
  onPressPOI: jest.fn(),
};

// ─── Tests ──────────────────────────────────────────────────

describe('POIMapView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(<POIMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map')).toBeTruthy();
  });

  it('renders participant markers', () => {
    const { getByTestId } = render(<POIMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map-marker-p-alice')).toBeTruthy();
    expect(getByTestId('map-marker-p-bob')).toBeTruthy();
  });

  it('renders midpoint marker', () => {
    const { getByTestId } = render(<POIMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map-marker-midpoint')).toBeTruthy();
  });

  it('renders zone circle', () => {
    const { getByTestId } = render(<POIMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map-circle')).toBeTruthy();
  });

  it('renders N POI markers for N POIs', () => {
    const { getByTestId } = render(<POIMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map-poi-node/1')).toBeTruthy();
    expect(getByTestId('map-poi-node/2')).toBeTruthy();
  });

  it('calls onPressPOI when a POI marker is pressed', () => {
    const onPressPOI = jest.fn();
    const { getByTestId } = render(
      <POIMapView {...defaultProps} onPressPOI={onPressPOI} testID="map" />,
    );

    fireEvent.press(getByTestId('map-poi-node/1'));

    expect(onPressPOI).toHaveBeenCalledTimes(1);
    expect(onPressPOI).toHaveBeenCalledWith(POIS[0]);
  });

  it('sets accessibilityLabel on POI markers', () => {
    const { getByTestId } = render(<POIMapView {...defaultProps} testID="map" />);

    const marker = getByTestId('map-poi-node/1');
    expect(marker.props.accessibilityLabel).toBe('Bistro A, restaurant');
  });

  it('renders with empty POIs list', () => {
    const { getByTestId, queryByTestId } = render(
      <POIMapView {...defaultProps} pois={[]} testID="map" />,
    );

    expect(getByTestId('map')).toBeTruthy();
    expect(queryByTestId('map-poi-node/1')).toBeNull();
  });
});

/**
 * @file POIMapView.test.tsx
 * @description Unit tests for the POIMapView molecule.
 *
 * @module features/POI/components/POIMapView/POIMapView.test
 */

// [ADDED] POIMapView unit tests

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import type { Coordinates } from '@entities/Location';
import type { Participant } from '@entities/MidpointSession';
import type { PointOfInterest } from '@entities/PointOfInterest';
import POIMapView from '@features/POI/components/POIMapView';
import { POIError } from '@services/domain/poi/IPOIService';

// ─── Mock i18n ─────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'mapView.midpointMarker': 'Point de rencontre',
      };
      return translations[key] ?? key;
    },
  }),
}));

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

  it('labels the midpoint marker through i18n (I18N-002)', () => {
    const { getByTestId } = render(<POIMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map-marker-midpoint').props.accessibilityLabel).toBe('Point de rencontre');
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

  // ─── Status banner: loading, error, empty (ERR-003) ─────
  describe('status banner', () => {
    it('shows no banner when POIs are displayed', () => {
      const { queryByTestId } = render(<POIMapView {...defaultProps} testID="map" />);

      expect(queryByTestId('map-status-loading')).toBeNull();
      expect(queryByTestId('map-status-error')).toBeNull();
      expect(queryByTestId('map-status-empty')).toBeNull();
    });

    it('shows the loading banner as a polite live region', () => {
      const { getByTestId, getByText } = render(
        <POIMapView {...defaultProps} pois={[]} isLoading testID="map" />,
      );

      const banner = getByTestId('map-status-loading');
      expect(getByText('list.loading')).toBeTruthy();
      expect(banner.props.accessibilityRole).toBe('text');
      expect(banner.props.accessibilityLiveRegion).toBe('polite');
      expect(banner.props.accessibilityLabel).toBe('list.loading');
    });

    it('gives loading priority over error and empty', () => {
      const { getByTestId, queryByTestId } = render(
        <POIMapView {...defaultProps} pois={[]} isLoading error={new Error('x')} testID="map" />,
      );

      expect(getByTestId('map-status-loading')).toBeTruthy();
      expect(queryByTestId('map-status-error')).toBeNull();
      expect(queryByTestId('map-status-empty')).toBeNull();
    });

    it('shows the dedicated message of a typed POI error as an alert', () => {
      const { getByTestId, getByText } = render(
        <POIMapView
          {...defaultProps}
          pois={[]}
          error={new POIError('offline', 'network')}
          testID="map"
        />,
      );

      const banner = getByTestId('map-status-error');
      expect(getByText('errors.title')).toBeTruthy();
      expect(getByText('errors.network')).toBeTruthy();
      expect(banner.props.accessibilityRole).toBe('alert');
      expect(banner.props.accessibilityLabel).toBe('errors.title. errors.network');
    });

    it('falls back to the unknown message for an untyped error', () => {
      const { getByText, queryByText } = render(
        <POIMapView {...defaultProps} error={new Error('raw technical message')} testID="map" />,
      );

      expect(getByText('errors.unknown')).toBeTruthy();
      expect(queryByText('raw technical message')).toBeNull();
    });

    it('keeps the zone circle and the markers visible under the error banner', () => {
      const { getByTestId } = render(
        <POIMapView {...defaultProps} error={new Error('x')} testID="map" />,
      );

      expect(getByTestId('map-status-error')).toBeTruthy();
      expect(getByTestId('map-circle')).toBeTruthy();
      expect(getByTestId('map-marker-midpoint')).toBeTruthy();
      expect(getByTestId('map-marker-p-alice')).toBeTruthy();
      expect(getByTestId('map-poi-node/1')).toBeTruthy();
    });

    it('gives error priority over empty', () => {
      const { getByTestId, queryByTestId } = render(
        <POIMapView {...defaultProps} pois={[]} error={new Error('x')} testID="map" />,
      );

      expect(getByTestId('map-status-error')).toBeTruthy();
      expect(queryByTestId('map-status-empty')).toBeNull();
    });

    it('shows the empty banner when the search found nothing', () => {
      const { getByTestId, getByText } = render(
        <POIMapView {...defaultProps} pois={[]} testID="map" />,
      );

      const banner = getByTestId('map-status-empty');
      expect(getByText('list.empty.title')).toBeTruthy();
      expect(getByText('list.empty.description')).toBeTruthy();
      expect(banner.props.accessibilityRole).toBe('text');
      expect(banner.props.accessibilityLiveRegion).toBe('polite');
    });

    it('lets map gestures through around the banner', () => {
      const { getByTestId } = render(<POIMapView {...defaultProps} pois={[]} testID="map" />);

      expect(getByTestId('map-status').props.pointerEvents).toBe('box-none');
    });
  });

  // ─── P0-5 : POI marker View does not intercept touches ──
  it('sets pointerEvents="none" on POI marker custom View (P0-5)', () => {
    const { getByTestId } = render(<POIMapView {...defaultProps} testID="map" />);

    // The custom View inside the Marker must not intercept touches
    // so the Marker's native onPress fires correctly on Android
    const poiMarker = getByTestId('map-poi-node/1');
    // The View is a child of the Marker mock (which is also a View)
    const customView = poiMarker.children[0];
    expect(customView).toBeTruthy();
    if (typeof customView === 'object' && customView !== null && 'props' in customView) {
      expect(customView.props.pointerEvents).toBe('none');
    }
  });
});

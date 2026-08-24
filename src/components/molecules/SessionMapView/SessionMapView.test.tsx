/**
 * @file SessionMapView.test.tsx
 * @description Tests unitaires de la molecule SessionMapView.
 *              Unit tests for the SessionMapView molecule.
 *
 * @module components/molecules/SessionMapView/SessionMapView.test
 */

// [ADDED] Tests unitaires SessionMapView

import { render } from '@testing-library/react-native';
import React from 'react';
import SessionMapView from '@components/molecules/SessionMapView';
import type { Coordinates } from '@entities/Location';
import type { Participant } from '@entities/MidpointSession';
import type { RealtimeParticipant } from '@entities/RealtimeParticipant';

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

const makeParticipant = (name: string, coords: Coordinates): Participant => ({
  id: `p-${name.toLowerCase()}`,
  displayName: name,
  startLocation: {
    id: `loc-${name.toLowerCase()}`,
    coordinates: coords,
    formattedAddress: `Adresse de ${name}`,
  },
});

const PARIS: Coordinates = { latitude: 48.8566, longitude: 2.3522 };
const LYON: Coordinates = { latitude: 45.764, longitude: 4.8357 };
const MIDPOINT: Coordinates = { latitude: 47.3103, longitude: 3.594 };

const defaultProps = {
  participants: [makeParticipant('Alice', PARIS), makeParticipant('Bob', LYON)],
  midpoint: MIDPOINT,
  radius: 196000,
};

// ─── Tests ──────────────────────────────────────────────────

describe('SessionMapView', () => {
  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(<SessionMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map')).toBeTruthy();
  });

  it('renders N markers for N participants', () => {
    const { getByTestId } = render(<SessionMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map-marker-p-alice')).toBeTruthy();
    expect(getByTestId('map-marker-p-bob')).toBeTruthy();
  });

  it('renders midpoint marker', () => {
    const { getByTestId } = render(<SessionMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map-marker-midpoint')).toBeTruthy();
  });

  it('renders zone circle', () => {
    const { getByTestId } = render(<SessionMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map-circle')).toBeTruthy();
  });

  it('sets accessibilityLabel on participant markers', () => {
    const { getByTestId } = render(<SessionMapView {...defaultProps} testID="map" />);

    const aliceMarker = getByTestId('map-marker-p-alice');
    expect(aliceMarker.props.accessibilityLabel).toBe('Alice, Adresse de Alice');

    const bobMarker = getByTestId('map-marker-p-bob');
    expect(bobMarker.props.accessibilityLabel).toBe('Bob, Adresse de Bob');
  });

  it('sets accessibilityLabel "Point de rencontre" on midpoint marker', () => {
    const { getByTestId } = render(<SessionMapView {...defaultProps} testID="map" />);

    const midpointMarker = getByTestId('map-marker-midpoint');
    expect(midpointMarker.props.accessibilityLabel).toBe('Point de rencontre');
  });

  it('renders participant initials in uppercase', () => {
    const { getByText } = render(<SessionMapView {...defaultProps} testID="map" />);

    expect(getByText('A')).toBeTruthy();
    expect(getByText('B')).toBeTruthy();
  });

  // [FIXED P1] Carte annonçable par VoiceOver (A11Y-006)
  it('exposes the map as a single accessible element when accessibilityLabel is provided', () => {
    const { getByTestId } = render(
      <SessionMapView
        {...defaultProps}
        accessibilityLabel="Carte du point de rencontre avec 2 participants."
        testID="map"
      />,
    );

    const container = getByTestId('map');
    expect(container.props.accessible).toBe(true);
    expect(container.props.accessibilityRole).toBe('image');
    expect(container.props.accessibilityLabel).toBe(
      'Carte du point de rencontre avec 2 participants.',
    );
  });

  it('is not marked accessible when no accessibilityLabel is provided', () => {
    const { getByTestId } = render(<SessionMapView {...defaultProps} testID="map" />);

    expect(getByTestId('map').props.accessible).toBeUndefined();
  });

  // ─── F4 — liveParticipants ────────────────────────────────
  describe('liveParticipants (F4)', () => {
    const makeLive = (
      participantId: string,
      overrides: Partial<RealtimeParticipant> = {},
    ): RealtimeParticipant => ({
      participantId,
      latitude: 47.31,
      longitude: 3.6,
      updatedAt: 1_700_000_000_000,
      speed: 8,
      heading: 90,
      isOnline: true,
      ...overrides,
    });

    it('renders no live markers when liveParticipants is omitted (F2 backward-compat)', () => {
      const { queryByTestId } = render(<SessionMapView {...defaultProps} testID="map" />);

      expect(queryByTestId('map-live-marker-p1')).toBeNull();
    });

    it('renders a live marker per live participant', () => {
      const { getByTestId } = render(
        <SessionMapView
          {...defaultProps}
          liveParticipants={[makeLive('p1'), makeLive('p2')]}
          testID="map"
        />,
      );

      expect(getByTestId('map-live-marker-p1')).toBeTruthy();
      expect(getByTestId('map-live-marker-p2')).toBeTruthy();
    });

    it('renders both online and offline live markers', () => {
      const { getByTestId } = render(
        <SessionMapView
          {...defaultProps}
          liveParticipants={[makeLive('on'), makeLive('off', { isOnline: false })]}
          testID="map"
        />,
      );

      expect(getByTestId('map-live-marker-on')).toBeTruthy();
      expect(getByTestId('map-live-marker-off')).toBeTruthy();
    });
  });
});

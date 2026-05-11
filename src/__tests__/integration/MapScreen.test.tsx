/**
 * @file MapScreen.test.tsx
 * @description Tests d'intégration du MapScreen (F2).
 *              Integration tests for MapScreen (F2).
 *
 *              Vérifie les 3 états : pas de session, session draft,
 *              session computed avec carte.
 *              Verifies 3 states: no session, draft session,
 *              computed session with map.
 *
 * @module __tests__/integration/MapScreen
 */

// [ADDED] Tests intégration MapScreen

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { createQueryClientWrapper } from '@/__tests__/helpers/queryClientWrapper'; // [MODIFIED]
import type { Coordinates } from '@core/entities/Location';
import type { MidpointSession, Participant } from '@core/entities/MidpointSession';
import MapScreen from '@presentation/screens/MapScreen';
import { useSessionStore } from '@presentation/stores/useSessionStore';

// ─── Mock i18n ──────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        title: 'Point de rencontre',
        'noSession.title': 'Aucune session active',
        'noSession.description': 'Commence par créer une session avec tes points de départ.',
        'notComputed.title': 'Calcul en attente',
        'notComputed.description': 'Termine la saisie des points et calcule le midpoint.',
        'summary.title': 'Point de rencontre suggéré',
        'summary.coordinates': `Coordonnées : ${String(opts?.lat ?? '')}, ${String(
          opts?.lng ?? '',
        )}`,
        'summary.radius': `Zone de ${String(opts?.km ?? '')} km autour du midpoint`,
        'actions.viewPOI': 'Voir les lieux à proximité',
        'actions.viewList': 'Vue liste',
        'list.title': 'Participants',
        'list.midpoint': 'Point de rencontre',
        'list.close': 'Fermer',
      };
      return translations[key] ?? key;
    },
    i18n: { language: 'fr' },
  }),
}));

// ─── Mock lucide-react-native ───────────────────────────────
jest.mock('lucide-react-native', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const createMockIcon = (displayName: string) => {
    const MockIcon = (props: Record<string, unknown>) =>
      ReactMock.createElement(View, { testID: `lucide-${displayName}`, ...props });
    MockIcon.displayName = displayName;
    return MockIcon;
  };
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => createMockIcon(prop),
    },
  );
});

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

// ─── Mock react-native-safe-area-context ────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// [MODIFIED] Mock navigation (pour navigation vers POIScreen)
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
}));

// ─── Helpers ────────────────────────────────────────────────

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

const computedSession: MidpointSession = {
  id: 'session-001',
  status: 'computed',
  participants: [makeParticipant('Alice', PARIS), makeParticipant('Bob', LYON)],
  midpoint: { latitude: 47.3103, longitude: 3.594 },
  midpointRadius: 196000,
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-08T10:01:00.000Z',
};

const draftSession: MidpointSession = {
  id: 'session-002',
  status: 'draft',
  participants: [makeParticipant('Alice', PARIS)],
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-08T10:00:00.000Z',
};

// ─── Tests ──────────────────────────────────────────────────

describe('MapScreen integration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    mockNavigate.mockClear();
    useSessionStore.setState({ session: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows EmptyState when no session exists', () => {
    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByTestId('map-screen-empty')).toBeTruthy();
    expect(screen.getByText('Aucune session active')).toBeTruthy();
  });

  it('shows "Calcul en attente" when session is draft', () => {
    useSessionStore.setState({ session: draftSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByTestId('map-screen-not-computed')).toBeTruthy();
    expect(screen.getByText('Calcul en attente')).toBeTruthy();
  });

  it('shows SessionMapView and footer when session is computed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByTestId('map-screen')).toBeTruthy();
    expect(screen.getByTestId('map-session')).toBeTruthy();
    expect(screen.getByTestId('map-footer')).toBeTruthy();
    expect(screen.getByText('Point de rencontre suggéré')).toBeTruthy();
  });

  it('shows masked coordinates in footer summary', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByText(/47\.31\*\*/)).toBeTruthy();
    expect(screen.getByText(/196\.0/)).toBeTruthy();
  });

  it('navigates to POI screen when "Voir POI" button is pressed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    const poiButton = screen.getByTestId('map-btn-poi');
    fireEvent.press(poiButton);

    expect(mockNavigate).toHaveBeenCalledWith('POI');
  });

  it('opens list modal when "Vue liste" is pressed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    fireEvent.press(screen.getByTestId('map-btn-list'));

    expect(screen.getByText('Participants')).toBeTruthy();
    expect(screen.getByText('Point de rencontre')).toBeTruthy();
    expect(screen.getByTestId('map-list-midpoint')).toBeTruthy();
  });

  it('shows participant cards in list modal', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    fireEvent.press(screen.getByTestId('map-btn-list'));

    expect(screen.getByTestId('map-list-participant-p-alice')).toBeTruthy();
    expect(screen.getByTestId('map-list-participant-p-bob')).toBeTruthy();
  });

  it('closes list modal when close button is pressed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    fireEvent.press(screen.getByTestId('map-btn-list'));
    expect(screen.getByTestId('map-list-midpoint')).toBeTruthy();

    fireEvent.press(screen.getByTestId('map-list-close'));

    expect(screen.queryByTestId('map-list-midpoint')).toBeNull();
  });
});

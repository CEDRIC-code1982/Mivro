/**
 * @file POIScreen.test.tsx
 * @description Tests d'intégration du POIScreen (F3).
 *              Integration tests for POIScreen (F3).
 *
 *              Vérifie les états : pas de session, vue liste/carte,
 *              filtres catégories, détail POI.
 *
 * @module features/POI/screens/POIScreen/POIScreen.integration.test
 */

// [ADDED] Tests intégration POIScreen

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import type { Coordinates } from '@entities/Location';
import type { MidpointSession, Participant } from '@entities/MidpointSession';
import type { PointOfInterest } from '@entities/PointOfInterest';
import POIScreen from '@features/POI/screens/POIScreen/POIScreen';
import { useSessionStore } from '@state/useSessionStore';

// ─── Mock i18n ──────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        title: 'Lieux à proximité',
        subtitle: 'Autour du point de rencontre',
        'noSession.title': 'Aucun calcul disponible',
        'noSession.description': 'Crée une session et calcule le midpoint.',
        'noSession.action': 'Retour à la carte',
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
        'list.loading': 'Recherche des lieux...',
        'list.empty.title': 'Aucun lieu trouvé',
        'list.empty.description': "Essaie d'élargir tes filtres.",
        'list.noFilters.title': 'Choisis au moins une catégorie',
        'list.noFilters.description': 'Sélectionne le type de lieu.',
        'detail.distance': `${params?.distance ?? ''} du midpoint`,
        'detail.address': `Adresse : ${params?.address ?? ''}`,
        'detail.actions.navigate': 'Y aller',
        'detail.actions.close': 'Fermer',
        'errors.unknown': 'Erreur inattendue.',
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

// ─── Mock navigation ──────────────────────────────────────────
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: jest.fn(),
  }),
}));

// ─── Mock POI data ────────────────────────────────────────────
const mockPOIs: PointOfInterest[] = [
  {
    externalId: 'node/100',
    category: 'restaurant',
    name: 'Le Petit Bistro',
    coordinates: { latitude: 47.311, longitude: 3.595 },
    address: '12 Rue de Rivoli',
  },
  {
    externalId: 'node/200',
    category: 'cafe',
    name: 'Café Central',
    coordinates: { latitude: 47.312, longitude: 3.596 },
  },
  {
    externalId: 'node/300',
    category: 'bar',
    name: 'Irish Pub',
    coordinates: { latitude: 47.313, longitude: 3.597 },
  },
];

// ─── Mock usePOIQuery ─────────────────────────────────────────
let mockPOIQueryResult = {
  data: mockPOIs,
  isLoading: false,
  error: null,
};

jest.mock('@features/POI/hooks/usePOIQuery', () => ({
  usePOIQuery: () => mockPOIQueryResult,
}));

// ─── Helpers ──────────────────────────────────────────────────

const PARIS: Coordinates = { latitude: 48.8566, longitude: 2.3522 };
const LYON: Coordinates = { latitude: 45.764, longitude: 4.8357 };

const makeParticipant = (name: string, coords: Coordinates): Participant => ({
  id: `p-${name.toLowerCase()}`,
  displayName: name,
  startLocation: {
    id: `loc-${name.toLowerCase()}`,
    coordinates: coords,
    formattedAddress: `Adresse de ${name}`,
  },
});

const computedSession: MidpointSession = {
  id: 'session-001',
  status: 'computed',
  participants: [makeParticipant('Alice', PARIS), makeParticipant('Bob', LYON)],
  midpoint: { latitude: 47.3103, longitude: 3.594 },
  midpointRadius: 196000,
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-08T10:01:00.000Z',
};

// ─── Tests ──────────────────────────────────────────────────

describe('POIScreen integration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    useSessionStore.setState({ session: null });
    mockPOIQueryResult = {
      data: mockPOIs,
      isLoading: false,
      error: null,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows EmptyState when no session is computed', () => {
    render(<POIScreen />);

    expect(screen.getByTestId('poi-screen-no-session')).toBeTruthy();
    expect(screen.getByText('Aucun calcul disponible')).toBeTruthy();
  });

  it('shows "Retour à la carte" button when no session', () => {
    render(<POIScreen />);

    const backBtn = screen.getByTestId('poi-btn-back');
    expect(backBtn).toBeTruthy();

    fireEvent.press(backBtn);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders POIScreen with header when session is computed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<POIScreen />);

    expect(screen.getByTestId('poi-screen')).toBeTruthy();
    expect(screen.getByText('Lieux à proximité')).toBeTruthy();
  });

  it('shows list view by default', () => {
    useSessionStore.setState({ session: computedSession });

    render(<POIScreen />);

    expect(screen.getByTestId('poi-list')).toBeTruthy();
  });

  it('renders POI cards in list view', () => {
    useSessionStore.setState({ session: computedSession });

    render(<POIScreen />);

    expect(screen.getByText('Le Petit Bistro')).toBeTruthy();
    expect(screen.getByText('Café Central')).toBeTruthy();
    expect(screen.getByText('Irish Pub')).toBeTruthy();
  });

  it('switches to map view when Carte toggle is pressed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<POIScreen />);

    fireEvent.press(screen.getByTestId('poi-header-toggle-map'));

    expect(screen.getByTestId('poi-map')).toBeTruthy();
  });

  it('switches back to list view from map', () => {
    useSessionStore.setState({ session: computedSession });

    render(<POIScreen />);

    fireEvent.press(screen.getByTestId('poi-header-toggle-map'));
    expect(screen.getByTestId('poi-map')).toBeTruthy();

    fireEvent.press(screen.getByTestId('poi-header-toggle-list'));
    expect(screen.getByTestId('poi-list')).toBeTruthy();
  });

  it('opens detail sheet when a POI card is pressed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<POIScreen />);

    fireEvent.press(screen.getByTestId('poi-list-card-node/100'));

    // Le nom apparaît dans la liste ET dans le détail
    expect(screen.getAllByText('Le Petit Bistro').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('poi-detail')).toBeTruthy();
  });

  it('shows loading state', () => {
    useSessionStore.setState({ session: computedSession });
    mockPOIQueryResult = {
      data: undefined as unknown as PointOfInterest[],
      isLoading: true,
      error: null,
    };

    render(<POIScreen />);

    expect(screen.getByTestId('poi-list-loading')).toBeTruthy();
    expect(screen.getByText('Recherche des lieux...')).toBeTruthy();
  });

  it('renders category filter chips', () => {
    useSessionStore.setState({ session: computedSession });

    render(<POIScreen />);

    expect(screen.getByTestId('poi-header-chip-all')).toBeTruthy();
    expect(screen.getByTestId('poi-header-chip-restaurant')).toBeTruthy();
    expect(screen.getByTestId('poi-header-chip-cafe')).toBeTruthy();
  });

  it('navigates back when header back button is pressed', () => {
    useSessionStore.setState({ session: computedSession });
    mockGoBack.mockClear();

    render(<POIScreen />);

    fireEvent.press(screen.getByTestId('poi-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});

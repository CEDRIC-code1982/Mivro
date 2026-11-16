/**
 * @file POIListView.test.tsx
 * @description Unit tests for the POIListView molecule.
 *
 * @module features/POI/components/POIListView/POIListView.test
 */

// [ADDED] POIListView unit tests

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import type { Coordinates } from '@entities/Location';
import type { PointOfInterest } from '@entities/PointOfInterest';
import POIListView from '@features/POI/components/POIListView';
import { POIError, type POIErrorCode } from '@services/domain/poi/IPOIService';

// ─── Mock i18n ────────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'list.loading': 'Recherche des lieux...',
        'list.empty.title': 'Aucun lieu trouvé',
        'list.empty.description': "Essaie d'élargir tes filtres.",
        'errors.title': 'Recherche impossible',
        'errors.rate_limited': 'Trop de requêtes.',
        'errors.network': 'Pas de connexion.',
        'errors.server_error': 'Service POI indisponible.',
        'errors.query_timeout': 'La recherche a pris trop de temps.',
        'errors.parse_error': 'Réponse invalide du serveur.',
        'errors.unknown': 'Erreur inattendue.',
        'categories.restaurant': 'Restaurants',
        'categories.cafe': 'Cafés',
        'detail.actions.navigate': 'Y aller',
      };
      return translations[key] ?? key;
    },
  }),
}));

// ─── Test data ────────────────────────────────────────────────

const MIDPOINT: Coordinates = { latitude: 48.8566, longitude: 2.3522 };

const makePOI = (
  id: string,
  name: string,
  lat: number,
  lng: number,
  category: 'restaurant' | 'cafe' = 'restaurant',
): PointOfInterest => ({
  externalId: id,
  category,
  name,
  coordinates: { latitude: lat, longitude: lng },
});

const CLOSE_POI = makePOI('node/1', 'Resto Proche', 48.857, 2.353);
const FAR_POI = makePOI('node/2', 'Resto Loin', 48.87, 2.37);
const MIDDLE_POI = makePOI('node/3', 'Café Moyen', 48.86, 2.36, 'cafe');

// ─── Tests ────────────────────────────────────────────────────

describe('POIListView', () => {
  const defaultProps = {
    pois: [CLOSE_POI, FAR_POI, MIDDLE_POI],
    midpoint: MIDPOINT,
    onPressPOI: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(<POIListView {...defaultProps} testID="list" />);

    expect(getByTestId('list')).toBeTruthy();
  });

  it('shows loading indicator when isLoading is true', () => {
    const { getByTestId } = render(<POIListView {...defaultProps} isLoading testID="list" />);

    expect(getByTestId('list-loading')).toBeTruthy();
  });

  it('shows loading text when isLoading is true', () => {
    const { getByText } = render(<POIListView {...defaultProps} isLoading testID="list" />);

    expect(getByText('Recherche des lieux...')).toBeTruthy();
  });

  it('shows error state when error is provided', () => {
    const { getByTestId } = render(
      <POIListView {...defaultProps} error={new Error('Network failed')} testID="list" />,
    );

    expect(getByTestId('list-error')).toBeTruthy();
  });

  it.each<[POIErrorCode, string]>([
    ['rate_limited', 'Trop de requêtes.'],
    ['network', 'Pas de connexion.'],
    ['server_error', 'Service POI indisponible.'],
    ['query_timeout', 'La recherche a pris trop de temps.'],
    ['parse_error', 'Réponse invalide du serveur.'],
    ['invalid_input', 'Erreur inattendue.'],
  ])('shows the title and the translated message for a POIError %s', (code, message) => {
    const { getByText, queryByText } = render(
      <POIListView
        {...defaultProps}
        error={new POIError('Overpass technical message', code)}
        testID="list"
      />,
    );

    expect(getByText('Recherche impossible')).toBeTruthy();
    expect(getByText(message)).toBeTruthy();
    expect(queryByText('Overpass technical message')).toBeNull();
  });

  it('falls back to the unknown message for a non-POI error, without the raw message', () => {
    const { getByText, queryByText } = render(
      <POIListView {...defaultProps} error={new Error('Network failed')} testID="list" />,
    );

    expect(getByText('Recherche impossible')).toBeTruthy();
    expect(getByText('Erreur inattendue.')).toBeTruthy();
    expect(queryByText('Network failed')).toBeNull();
  });

  it('shows empty state when pois list is empty', () => {
    const { getByTestId, getByText } = render(
      <POIListView {...defaultProps} pois={[]} testID="list" />,
    );

    expect(getByTestId('list-empty')).toBeTruthy();
    expect(getByText('Aucun lieu trouvé')).toBeTruthy();
  });

  it('renders N POICards for N pois', () => {
    const { getByTestId } = render(<POIListView {...defaultProps} testID="list" />);

    expect(getByTestId('list-card-node/1')).toBeTruthy();
    expect(getByTestId('list-card-node/2')).toBeTruthy();
    expect(getByTestId('list-card-node/3')).toBeTruthy();
  });

  it('sorts POIs by ascending distance to midpoint', () => {
    const { getAllByText } = render(<POIListView {...defaultProps} testID="list" />);

    // The closest (CLOSE_POI) should appear first
    const names = getAllByText(/Resto|Café/);
    expect(names.length).toBeGreaterThan(0);
    // Non-null assertion justified: the length was asserted just above.
    expect(names[0]!.props.children).toBe('Resto Proche');
  });

  it('calls onPressPOI when a POICard is tapped', () => {
    const onPressPOI = jest.fn();
    const { getByTestId } = render(
      <POIListView {...defaultProps} onPressPOI={onPressPOI} testID="list" />,
    );

    fireEvent.press(getByTestId('list-card-node/1'));

    expect(onPressPOI).toHaveBeenCalledTimes(1);
    expect(onPressPOI).toHaveBeenCalledWith(CLOSE_POI);
  });
});

/**
 * @file AddressAutocomplete.test.tsx
 * @description Tests unitaires de la molecule AddressAutocomplete.
 *              Unit tests for the AddressAutocomplete molecule.
 *
 * @module __tests__/unit/presentation/components/molecules/AddressAutocomplete
 */

// [MODIFIED] Tests unitaires AddressAutocomplete — Phase 6 (bottom sheet)

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import type { GeocodeResult } from '@core/entities/GeocodeResult';
import { GeocodeError } from '@core/ports/IGeocodeService';
import AddressAutocomplete from '@presentation/components/molecules/AddressAutocomplete';

// ─── Mock i18n ──────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'autocomplete.addressLabel': 'Adresse',
        'autocomplete.addressPlaceholder': 'Tape une adresse...',
        'autocomplete.addressHint': 'Cherche une rue, un lieu ou une ville',
        'autocomplete.nameLabel': 'Nom du participant (optionnel)',
        'autocomplete.namePlaceholder': 'Ex: Cédric, Sophie...',
        'autocomplete.nameHint': 'Pour identifier ce point dans la liste',
        'autocomplete.useGps': 'Utiliser ma position',
        'autocomplete.useGpsHint': 'Détecte automatiquement ton emplacement actuel',
        'autocomplete.noResults': 'Aucun résultat',
        'autocomplete.noResultsHint': 'Essaie une autre formulation',
        'autocomplete.minLength': 'Tape au moins 3 caractères',
        'autocomplete.loading': 'Recherche...',
        'errors.geocode_network': 'Pas de connexion. Vérifie ton réseau.',
        'errors.geocode_rate_limited': 'Trop de requêtes. Réessaie dans quelques secondes.',
        'errors.geocode_server': 'Service indisponible. Réessaie plus tard.',
        'errors.unknown': 'Erreur inattendue.',
      };
      return translations[key] ?? key;
    },
    i18n: { language: 'fr' },
  }),
}));

// ─── Mock useGeocodeQuery ───────────────────────────────────
const mockUseGeocodeQuery = jest.fn();

jest.mock('@presentation/hooks/useGeocodeQuery', () => ({
  useGeocodeQuery: (...args: unknown[]) => mockUseGeocodeQuery(...args),
}));

// ─── Test data ──────────────────────────────────────────────

const fakeResults: GeocodeResult[] = [
  {
    externalId: 'osm-12345',
    coordinates: { latitude: 48.8584, longitude: 2.2945 },
    displayName: 'Tour Eiffel, Paris, France',
    placeType: 'attraction',
    importance: 0.85,
  },
  {
    externalId: 'osm-67890',
    coordinates: { latitude: 45.764, longitude: 4.8357 },
    displayName: 'Lyon, Métropole de Lyon, France',
    placeType: 'city',
    importance: 0.8,
  },
];

// ─── Helpers ────────────────────────────────────────────────

const defaultProps = {
  onSelectResult: jest.fn() as jest.Mock<void, [GeocodeResult, string | undefined]>,
  onUseGps: jest.fn() as jest.Mock<void, [string | undefined]>,
};

const defaultQueryReturn = {
  data: undefined,
  isLoading: false,
  error: null,
};

// ─── Tests ──────────────────────────────────────────────────

describe('AddressAutocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGeocodeQuery.mockReturnValue(defaultQueryReturn);
  });

  // ─── Phase 5 : Inputs + GPS ─────────────────────────────
  describe('inputs and GPS button', () => {
    it('renders without crashing (smoke test)', () => {
      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );
      expect(getByTestId('autocomplete')).toBeTruthy();
    });

    it('renders address input, name input and GPS button', () => {
      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );
      expect(getByTestId('autocomplete-address-input')).toBeTruthy();
      expect(getByTestId('autocomplete-name-input')).toBeTruthy();
      expect(getByTestId('autocomplete-gps-button')).toBeTruthy();
    });

    it('calls onUseGps when GPS button is pressed', () => {
      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );
      fireEvent.press(getByTestId('autocomplete-gps-button'));
      expect(defaultProps.onUseGps).toHaveBeenCalledTimes(1);
    });

    it('passes pendingDisplayName to onUseGps when name is filled', () => {
      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );
      fireEvent.changeText(getByTestId('autocomplete-name-input'), 'Cédric');
      fireEvent.press(getByTestId('autocomplete-gps-button'));
      expect(defaultProps.onUseGps).toHaveBeenCalledWith('Cédric');
    });

    it('passes undefined to onUseGps when name is empty', () => {
      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );
      fireEvent.press(getByTestId('autocomplete-gps-button'));
      expect(defaultProps.onUseGps).toHaveBeenCalledWith(undefined);
    });

    it('has correct accessibility labels', () => {
      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );
      expect(getByTestId('autocomplete-address-input').props.accessibilityLabel).toBe('Adresse');
      expect(getByTestId('autocomplete-name-input').props.accessibilityLabel).toBe(
        'Nom du participant (optionnel)',
      );
      expect(getByTestId('autocomplete-gps-button').props.accessibilityLabel).toBe(
        'Utiliser ma position',
      );
    });
  });

  // ─── Phase 6 : Bottom sheet states ──────────────────────
  describe('bottom sheet content', () => {
    it('shows min length hint when query is shorter than 3 chars', () => {
      mockUseGeocodeQuery.mockReturnValue(defaultQueryReturn);

      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      // Query par défaut est '' (< 3 chars)
      expect(getByTestId('autocomplete-min-length')).toBeTruthy();
    });

    it('shows loading state when isLoading is true', () => {
      mockUseGeocodeQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      // On change la query pour >= 3 chars pour que le sheet content conditionnel s'active
      fireEvent.changeText(getByTestId('autocomplete-address-input'), 'Paris');

      expect(getByTestId('autocomplete-loading')).toBeTruthy();
    });

    it('shows error state when error is present', () => {
      mockUseGeocodeQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new GeocodeError('Server error', 'server_error'),
      });

      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      fireEvent.changeText(getByTestId('autocomplete-address-input'), 'Paris');

      expect(getByTestId('autocomplete-error')).toBeTruthy();
    });

    // [FIXED P1] Erreur réseau distincte de "aucun résultat"
    it('shows a network error message (not "no results") on network error', () => {
      mockUseGeocodeQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new GeocodeError('Network error', 'network'),
      });

      const { getByTestId, getByText, queryByText } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      fireEvent.changeText(getByTestId('autocomplete-address-input'), 'Paris');

      expect(getByText('Pas de connexion. Vérifie ton réseau.')).toBeTruthy();
      expect(queryByText('Aucun résultat')).toBeNull();
    });

    it('shows the rate-limited message on rate_limited error', () => {
      mockUseGeocodeQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new GeocodeError('Rate limited', 'rate_limited'),
      });

      const { getByTestId, getByText } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      fireEvent.changeText(getByTestId('autocomplete-address-input'), 'Paris');

      expect(getByText('Trop de requêtes. Réessaie dans quelques secondes.')).toBeTruthy();
    });

    it('shows empty state when data is empty array', () => {
      mockUseGeocodeQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      fireEvent.changeText(getByTestId('autocomplete-address-input'), 'xyzxyz');

      expect(getByTestId('autocomplete-empty')).toBeTruthy();
    });

    it('renders result items when data is available', () => {
      mockUseGeocodeQuery.mockReturnValue({
        data: fakeResults,
        isLoading: false,
        error: null,
      });

      const { getByTestId, getByText } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      fireEvent.changeText(getByTestId('autocomplete-address-input'), 'Tour Eiffel');

      expect(getByTestId('autocomplete-results-list')).toBeTruthy();
      expect(getByText('Tour Eiffel, Paris, France')).toBeTruthy();
      expect(getByText('Lyon, Métropole de Lyon, France')).toBeTruthy();
    });

    it('calls onSelectResult when a result is pressed', () => {
      mockUseGeocodeQuery.mockReturnValue({
        data: fakeResults,
        isLoading: false,
        error: null,
      });

      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      fireEvent.changeText(getByTestId('autocomplete-address-input'), 'Tour Eiffel');
      fireEvent.press(getByTestId('autocomplete-result-osm-12345'));

      expect(defaultProps.onSelectResult).toHaveBeenCalledWith(fakeResults[0], undefined);
    });

    it('passes pendingDisplayName to onSelectResult when name is filled', () => {
      mockUseGeocodeQuery.mockReturnValue({
        data: fakeResults,
        isLoading: false,
        error: null,
      });

      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      fireEvent.changeText(getByTestId('autocomplete-name-input'), 'Sophie');
      fireEvent.changeText(getByTestId('autocomplete-address-input'), 'Tour Eiffel');
      fireEvent.press(getByTestId('autocomplete-result-osm-12345'));

      expect(defaultProps.onSelectResult).toHaveBeenCalledWith(fakeResults[0], 'Sophie');
    });

    it('renders bottom sheet with sheet input', () => {
      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      expect(getByTestId('autocomplete-sheet-input')).toBeTruthy();
    });
  });

  // ─── P0-2 : Bottom sheet keyboard behavior ─────────────
  describe('keyboard behavior (P0-2)', () => {
    it('configures keyboard behavior props on bottom sheet', () => {
      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      const bottomSheet = getByTestId('autocomplete-bottom-sheet');
      expect(bottomSheet.props.keyboardBehavior).toBe('extend');
      expect(bottomSheet.props.keyboardBlurBehavior).toBe('restore');
      expect(bottomSheet.props.android_keyboardInputMode).toBe('adjustResize');
    });
  });

  // ─── P0-3 : Bottom sheet backdrop ──────────────────────
  describe('backdrop (P0-3)', () => {
    it('renders backdrop to prevent content showing behind sheet', () => {
      const { getByTestId } = render(
        <AddressAutocomplete {...defaultProps} testID="autocomplete" />,
      );

      expect(getByTestId('mock-backdrop')).toBeTruthy();
    });
  });
});

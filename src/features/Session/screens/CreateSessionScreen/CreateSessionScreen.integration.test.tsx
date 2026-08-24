/**
 * @file CreateSessionScreen.test.tsx
 * @description Tests d'intégration légers de CreateSessionScreen (F1).
 *              Lightweight integration tests for CreateSessionScreen (F1).
 *
 *              Vérifie le rendu initial, l'ajout de participants,
 *              et l'activation du bouton Continuer.
 *              Verifies initial render, participant addition,
 *              and Continue button activation.
 *
 * @module features/Session/screens/CreateSessionScreen/CreateSessionScreen.integration.test
 */

// [ADDED] Tests intégration CreateSessionScreen

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { Location } from '@entities/Location';
import CreateSessionScreen from '@features/Session/screens/CreateSessionScreen/CreateSessionScreen';
import { useSessionStore } from '@state/useSessionStore';

// ─── Mock i18n ──────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        title: 'Créer une session',
        subtitle: 'Ajoute 2 à 5 points de départ',
        'counter.current_one': `${String(opts?.count ?? 0)} / 5 point`,
        'counter.current_other': `${String(opts?.count ?? 0)} / 5 points`,
        'counter.remaining_one': `Encore ${String(opts?.count ?? 0)} point minimum`,
        'counter.remaining_other': `Encore ${String(opts?.count ?? 0)} points minimum`,
        'counter.complete': 'Tu peux continuer',
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
        'list.empty.title': 'Aucun point ajouté',
        'list.empty.description': 'Ajoute un point en tapant une adresse ou avec ta position GPS',
        'list.removeParticipant': `Supprimer ${String(opts?.name ?? '')}`,
        'actions.continue': 'Continuer',
        'actions.continueDisabled': 'Ajoute au moins 2 points pour continuer',
        'errors.gps_permission_denied':
          'Permission de localisation refusée. Active-la dans les réglages.',
        'midpointErrors.no_session': 'Aucune session active.',
        'midpointErrors.too_few_participants': 'Il faut au moins 2 points.',
        'midpointErrors.too_many_participants': 'Maximum 5 points.',
        'midpointErrors.unknown': `Erreur inattendue : ${String(opts?.message ?? '')}`,
      };
      // i18next pluralization: try key_other, then key_one, then key
      const count = opts?.count as number | undefined;
      if (count != null) {
        const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
        if (translations[pluralKey] != null) return translations[pluralKey];
      }
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

// ─── Mock navigation ────────────────────────────────────────
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// ─── Mock useGeocodeQuery ───────────────────────────────────
jest.mock('@features/Session/hooks/useGeocodeQuery', () => ({
  useGeocodeQuery: () => ({
    data: undefined,
    isLoading: false,
    error: null,
  }),
}));

// ─── Mock DI container ──────────────────────────────────────
const fakeLocation: Location = {
  id: 'loc-gps-001',
  coordinates: { latitude: 48.8566, longitude: 2.3522 },
  formattedAddress: '1 Rue de Rivoli, Paris, France',
};

// [FIXED P1] Le use case renvoie désormais { location, addressResolved }
const mockGetCurrentLocationExecute = jest
  .fn()
  .mockResolvedValue({ location: fakeLocation, addressResolved: true });

// [MODIFIED] Mock midpoint UseCase ajouté pour F2
const mockCalculateMidpointExecute = jest.fn();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    getCurrentLocationUseCase: { execute: mockGetCurrentLocationExecute },
    searchAddressUseCase: { execute: jest.fn().mockResolvedValue([]) },
    calculateMidpointUseCase: { execute: mockCalculateMidpointExecute }, // [ADDED]
  })),
}));

// ─── Mock uuid ──────────────────────────────────────────────
let mockUuidCounter = 0;

jest.mock('uuid', () => ({
  v4: () => {
    mockUuidCounter++;
    return `int-test-uuid-${String(mockUuidCounter).padStart(4, '0')}`;
  },
}));

// ─── Helpers ────────────────────────────────────────────────

const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderScreen = () =>
  render(
    <QueryClientProvider client={testQueryClient}>
      <CreateSessionScreen />
    </QueryClientProvider>,
  );

// ─── Tests ──────────────────────────────────────────────────

describe('CreateSessionScreen integration', () => {
  beforeEach(() => {
    mockUuidCounter = 0;
    jest.clearAllMocks();
    useSessionStore.setState({ session: null });
  });

  it('renders initial state with EmptyState and disabled Continue', () => {
    renderScreen();

    expect(screen.getByText('Créer une session')).toBeTruthy();
    expect(screen.getByText('Aucun point ajouté')).toBeTruthy();
    expect(screen.getByTestId('create-continue-button').props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('shows disabled hint text when less than 2 participants', () => {
    renderScreen();

    expect(screen.getByText('Ajoute au moins 2 points pour continuer')).toBeTruthy();
  });

  it('adds a participant via GPS and shows ParticipantCard', async () => {
    renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('create-autocomplete-gps-button'));
    });

    await waitFor(() => {
      expect(screen.getByText('1 Rue de Rivoli, Paris, France')).toBeTruthy();
    });

    expect(screen.getByText('Participant 1')).toBeTruthy();
    expect(screen.queryByText('Aucun point ajouté')).toBeNull();
  });

  it('enables Continue button after 2 participants added', async () => {
    mockGetCurrentLocationExecute
      .mockResolvedValueOnce({ location: fakeLocation, addressResolved: true })
      .mockResolvedValueOnce({
        location: {
          ...fakeLocation,
          id: 'loc-gps-002',
          formattedAddress: 'Place Bellecour, Lyon, France',
        },
        addressResolved: true,
      });

    renderScreen();

    // Ajouter 1er participant
    await act(async () => {
      fireEvent.press(screen.getByTestId('create-autocomplete-gps-button'));
    });

    await waitFor(() => {
      expect(screen.getByText('Participant 1')).toBeTruthy();
    });

    // Ajouter 2ème participant
    await act(async () => {
      fireEvent.press(screen.getByTestId('create-autocomplete-gps-button'));
    });

    await waitFor(() => {
      expect(screen.getByText('Participant 2')).toBeTruthy();
    });

    // Continue doit être activé
    expect(screen.getByTestId('create-continue-button').props.accessibilityState).toEqual({
      disabled: false,
    });

    // Le hint "Tu peux continuer" doit apparaître
    expect(screen.getByText('Tu peux continuer')).toBeTruthy();
  });

  it('updates counter in real time', async () => {
    renderScreen();

    // 0 participant
    expect(screen.getByText('0 / 5 points')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('create-autocomplete-gps-button'));
    });

    await waitFor(() => {
      expect(screen.getByText('1 / 5 point')).toBeTruthy();
    });
  });
});

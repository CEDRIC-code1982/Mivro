/**
 * @file JoinSessionScreen.test.tsx
 * @description Tests unitaires de l'écran JoinSessionScreen (F5).
 *              Unit tests for the JoinSessionScreen (F5).
 *
 *              Couvre : état loading / success (navigation vers la carte) /
 *              error (lien expiré, introuvable), réessayer, annuler, a11y, i18n.
 *
 * @module __tests__/unit/presentation/screens/JoinSessionScreen
 */

// [ADDED] F5 — Tests unitaires JoinSessionScreen
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import JoinSessionScreen from '@features/Sharing/screens/JoinSessionScreen/JoinSessionScreen';

// ─── Mock i18n (namespace share) ────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'join.loadingTitle': 'Connexion à la session…',
        'join.loadingDescription': 'Récupération du point de rencontre.',
        'join.successTitle': 'Tu as rejoint la session',
        'join.successDescription': 'Le point de rencontre a été recalculé.',
        'join.openMap': 'Voir la carte',
        'join.retry': 'Réessayer',
        'join.cancel': 'Annuler',
        'errors.title': 'Impossible de rejoindre la session',
        'errors.expired': 'Ce lien a expiré.',
        'errors.not_found': 'Cette session est introuvable.',
        'errors.unknown': 'Une erreur inattendue est survenue.',
      };
      return translations[key] ?? opts?.defaultValue ?? key;
    },
  }),
}));

// ─── Mock navigation ────────────────────────────────────────
const mockReset = jest.fn();
let mockSessionId: string | undefined = 'session-001';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockReset, navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: { sessionId: mockSessionId } }),
}));

// ─── Mock useSessionShare ───────────────────────────────────
const mockJoin = jest.fn();
let mockErrorCode: string | null = null;

jest.mock('@features/Sharing/hooks/useSessionShare', () => ({
  useSessionShare: () => ({
    join: mockJoin,
    share: jest.fn(),
    isBusy: false,
    errorCode: mockErrorCode,
  }),
}));

describe('JoinSessionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockSessionId = 'session-001';
    mockErrorCode = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Loading ──────────────────────────────────────────────
  describe('loading state', () => {
    it('shows the loading view while the join is pending', () => {
      mockJoin.mockReturnValue(new Promise(() => undefined)); // never resolves
      const { getByTestId, getByText } = render(<JoinSessionScreen />);

      expect(getByTestId('join-screen-loading')).toBeTruthy();
      expect(getByText('Connexion à la session…')).toBeTruthy();
    });
  });

  // ─── Success ──────────────────────────────────────────────
  describe('success state', () => {
    it('shows the success view and triggers the join with the route sessionId', async () => {
      mockJoin.mockResolvedValue(true);
      const { getByTestId, getByText } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByTestId('join-screen-success')).toBeTruthy());
      expect(mockJoin).toHaveBeenCalledWith('session-001');
      expect(getByText('Tu as rejoint la session')).toBeTruthy();
    });

    it('navigates (reset) to the Map tab when "View map" is pressed', async () => {
      mockJoin.mockResolvedValue(true);
      const { getByTestId } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByTestId('join-btn-open-map')).toBeTruthy());
      fireEvent.press(getByTestId('join-btn-open-map'));

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Tabs', params: { screen: 'Map' } }],
      });
    });

    it('exposes an accessible button for opening the map', async () => {
      mockJoin.mockResolvedValue(true);
      const { getByTestId } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByTestId('join-btn-open-map')).toBeTruthy());
      const button = getByTestId('join-btn-open-map');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe('Voir la carte');
    });
  });

  // ─── Error ────────────────────────────────────────────────
  describe('error state', () => {
    it('shows the error view with the expired message', async () => {
      mockJoin.mockResolvedValue(false);
      mockErrorCode = 'expired';
      const { getByTestId, getByText } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByTestId('join-screen-error')).toBeTruthy());
      expect(getByText('Impossible de rejoindre la session')).toBeTruthy();
      expect(getByText('Ce lien a expiré.')).toBeTruthy();
    });

    it('shows the not_found message when the session is unknown', async () => {
      mockJoin.mockResolvedValue(false);
      mockErrorCode = 'not_found';
      const { getByText } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByText('Cette session est introuvable.')).toBeTruthy());
    });

    it('falls back to the unknown message when errorCode is null', async () => {
      mockJoin.mockResolvedValue(false);
      mockErrorCode = null;
      const { getByText } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByText('Une erreur inattendue est survenue.')).toBeTruthy());
    });

    it('shows the error view immediately when the sessionId is missing (no join call)', async () => {
      mockSessionId = undefined;
      const { getByTestId } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByTestId('join-screen-error')).toBeTruthy());
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('retries the join when "Try again" is pressed', async () => {
      mockJoin.mockResolvedValue(false);
      mockErrorCode = 'network';
      const { getByTestId } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByTestId('join-btn-retry')).toBeTruthy());
      mockJoin.mockResolvedValue(true);
      fireEvent.press(getByTestId('join-btn-retry'));

      await waitFor(() => expect(getByTestId('join-screen-success')).toBeTruthy());
      expect(mockJoin).toHaveBeenCalledTimes(2);
    });

    it('navigates (reset) to the Create tab when "Cancel" is pressed', async () => {
      mockJoin.mockResolvedValue(false);
      const { getByTestId } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByTestId('join-btn-cancel')).toBeTruthy());
      fireEvent.press(getByTestId('join-btn-cancel'));

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Tabs', params: { screen: 'Create' } }],
      });
    });

    it('exposes accessible retry and cancel buttons', async () => {
      mockJoin.mockResolvedValue(false);
      const { getByTestId } = render(<JoinSessionScreen />);

      await waitFor(() => expect(getByTestId('join-btn-retry')).toBeTruthy());
      expect(getByTestId('join-btn-retry').props.accessibilityRole).toBe('button');
      expect(getByTestId('join-btn-retry').props.accessibilityLabel).toBe('Réessayer');
      expect(getByTestId('join-btn-cancel').props.accessibilityRole).toBe('button');
      expect(getByTestId('join-btn-cancel').props.accessibilityLabel).toBe('Annuler');
    });
  });
});

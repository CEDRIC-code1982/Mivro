/**
 * @file ProfileScreen.test.tsx
 * @description Tests d'intégration du ProfileScreen (F7).
 *              Integration tests for ProfileScreen (F7).
 *
 *              Vérifie : bouton Save désactivé si invalide/inchangé,
 *              message d'erreur, sélection avatar → updateProfile appelé.
 *
 * @module __tests__/integration/ProfileScreen
 */

// [ADDED] F7 — Tests intégration ProfileScreen

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import type { User } from '@core/entities/User';
import ProfileScreen from '@presentation/screens/ProfileScreen';

// ─── Mock i18n ──────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        title: 'Profil',
        notSignedIn: 'Pas encore connecté',
        guestBadge: 'Invité',
        'displayName.label': 'Nom affiché',
        'displayName.placeholder': 'Ton nom',
        'displayName.hint': 'Saisis le nom',
        'displayName.error': 'Le nom doit contenir entre 1 et 50 caractères',
        'displayName.save': 'Enregistrer le nom',
        'displayName.saveHint': 'Met à jour ton nom',
        'avatarPicker.label': 'Choisis ton avatar',
        'actions.signInGuest': 'Continuer en invité',
        'actions.signOut': 'Se déconnecter',
        'actions.cycleTheme': 'Changer de thème',
        'hints.signInGuest': 'Crée un profil invité',
        'hints.signOut': 'Supprime ta session',
        'hints.cycleTheme': 'Alterne les thèmes',
      };
      if (key.startsWith('avatarNames.')) return key.replace('avatarNames.', '');
      if (key === 'avatarPicker.selectHint') return `Select ${params?.name ?? ''}`;
      if (key === 'signedInAs') return `Connecté en tant que ${params?.name ?? ''}`;
      if (key === 'currentTheme') return `Thème : ${params?.mode ?? ''}`;
      if (key.startsWith('themeLabels.')) return key.replace('themeLabels.', '');
      return translations[key] ?? key;
    },
    i18n: { language: 'fr' },
  }),
}));

// ─── Mock préférences ───────────────────────────────────────
jest.mock('@presentation/stores/usePreferencesStore', () => {
  const setThemeMode = jest.fn();
  const state = { themeMode: 'system', setThemeMode };
  // Le store est consommé via sélecteurs : usePreferencesStore((s) => s.x)
  const usePreferencesStore = (selector: (s: typeof state) => unknown) => selector(state);
  return { usePreferencesStore };
});

// ─── Mock auth ──────────────────────────────────────────────
const mockUpdateProfile = jest.fn();
const mockSignInAsGuest = jest.fn();
const mockSignOut = jest.fn();

let mockUser: User | null = null;

jest.mock('@presentation/hooks/useAuth', () => ({
  useAuthUser: () => mockUser,
  useIsAuthenticated: () => mockUser != null,
  useIsGuest: () => mockUser?.type === 'guest',
  useAuthActions: () => ({
    signInAsGuest: mockSignInAsGuest,
    signOut: mockSignOut,
    updateProfile: mockUpdateProfile,
  }),
}));

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_DATETIME = '2026-01-15T10:30:00.000Z';

const guestUser: User = {
  type: 'guest',
  id: VALID_UUID,
  displayName: 'Léa',
  createdAt: VALID_DATETIME,
};

describe('ProfileScreen (F7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
  });

  // ─── Non connecté ─────────────────────────────────────────
  describe('signed out', () => {
    it('shows the not-signed-in message and a sign-in button', () => {
      const { getByText } = render(<ProfileScreen />);

      expect(getByText('Pas encore connecté')).toBeTruthy();
      expect(getByText('Continuer en invité')).toBeTruthy();
    });

    it('does not render the avatar picker when signed out', () => {
      const { queryByTestId } = render(<ProfileScreen />);

      expect(queryByTestId('profile-avatar-picker')).toBeNull();
    });
  });

  // ─── Connecté ─────────────────────────────────────────────
  describe('signed in (guest)', () => {
    beforeEach(() => {
      mockUser = guestUser;
    });

    it('renders the editing UI (input + picker + current avatar)', () => {
      const { getByTestId } = render(<ProfileScreen />);

      expect(getByTestId('profile-name-input')).toBeTruthy();
      expect(getByTestId('profile-avatar-picker')).toBeTruthy();
      // L'avatar courant est décoratif (masqué de l'arbre a11y)
      expect(getByTestId('profile-current-avatar', { includeHiddenElements: true })).toBeTruthy();
    });

    it('disables the Save button when the name is unchanged', () => {
      const { getByTestId } = render(<ProfileScreen />);

      const save = getByTestId('profile-name-save');
      expect(save.props.accessibilityState.disabled).toBe(true);
    });

    it('disables the Save button when the name is invalid (empty)', () => {
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent.changeText(getByTestId('profile-name-input'), '   ');

      const save = getByTestId('profile-name-save');
      expect(save.props.accessibilityState.disabled).toBe(true);
    });

    it('enables Save when the name is changed and valid', () => {
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent.changeText(getByTestId('profile-name-input'), 'Nouveau');

      const save = getByTestId('profile-name-save');
      expect(save.props.accessibilityState.disabled).toBe(false);
    });

    it('shows the error message when the typed name is invalid', () => {
      const { getByTestId, getByText } = render(<ProfileScreen />);

      // Un espace seul → trim vide → invalide, mais length > 0 déclenche l'erreur
      fireEvent.changeText(getByTestId('profile-name-input'), ' ');

      expect(getByText('Le nom doit contenir entre 1 et 50 caractères')).toBeTruthy();
    });

    it('calls updateProfile with the trimmed name on Save', () => {
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent.changeText(getByTestId('profile-name-input'), '  Sophie  ');
      fireEvent.press(getByTestId('profile-name-save'));

      expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'Sophie' });
    });

    it('does NOT call updateProfile on Save when name is unchanged', () => {
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent.press(getByTestId('profile-name-save'));

      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('calls updateProfile with the avatarId when an avatar is picked', () => {
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent.press(getByTestId('profile-avatar-picker-dragon'));

      expect(mockUpdateProfile).toHaveBeenCalledWith({ avatarId: 'dragon' });
    });

    it('renders a sign-out button when signed in', () => {
      const { getByText, queryByText } = render(<ProfileScreen />);

      expect(getByText('Se déconnecter')).toBeTruthy();
      expect(queryByText('Continuer en invité')).toBeNull();
    });
  });
});

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

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { User } from '@entities/User';
import ProfileScreen from '@features/Profile/screens/ProfileScreen/ProfileScreen';

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
      // [ADDED] F7 passe 2 — clés photo
      const photoTranslations: Record<string, string> = {
        'photo.label': 'Photo de profil',
        'photo.choose': 'Choisir une photo',
        'photo.chooseHint': 'Ouvre ta galerie',
        'photo.take': 'Prendre une photo',
        'photo.takeHint': 'Ouvre la caméra',
        'photo.remove': 'Supprimer la photo',
        'photo.removeHint': 'Retire ta photo',
        'photo.loading': 'Traitement de la photo…',
        'photo.errors.permission_denied': 'Permission refusée',
        'photo.errors.camera_unavailable': 'Caméra indisponible',
        'photo.errors.processing_failed': 'Échec du traitement',
        'photo.errors.unknown': 'Erreur inconnue',
      };
      // [ADDED] F8 — clés biométrie (namespace biometric ; le mock ignore le ns)
      const biometricTranslations: Record<string, string> = {
        'settings.label': 'Verrou biométrique',
        'settings.toggleHint': 'Active ou désactive le verrou biométrique',
        'settings.types.face': 'Face ID',
        'settings.types.fingerprint': 'Touch ID',
        'settings.types.iris': "la reconnaissance de l'iris",
        'settings.types.generic': 'la biométrie',
        'settings.errors.cancelled': 'Activation annulée.',
        'settings.errors.failed': "Confirmation échouée. Le verrou n'a pas été activé.",
        'settings.errors.not_available': "La biométrie n'est pas disponible.",
        'settings.errors.not_enrolled': "Configure d'abord une biométrie.",
        'settings.errors.unknown': 'Une erreur est survenue.',
      };
      if (key in biometricTranslations) return biometricTranslations[key] ?? key;
      if (key === 'settings.description') return `Protège Mivro avec ${params?.type ?? ''}`;
      if (key === 'settings.confirmReason') return `Confirme avec ${params?.type ?? ''}`;
      if (key in photoTranslations) return photoTranslations[key] ?? key;
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
jest.mock('@state/usePreferencesStore', () => {
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

jest.mock('@features/Profile/hooks/useAuth', () => ({
  useAuthUser: () => mockUser,
  useIsAuthenticated: () => mockUser != null,
  useIsGuest: () => mockUser?.type === 'guest',
  useAuthActions: () => ({
    signInAsGuest: mockSignInAsGuest,
    signOut: mockSignOut,
    updateProfile: mockUpdateProfile,
  }),
}));

// ─── Mock useProfilePhoto (F7 passe 2) ──────────────────────
const mockPickPhoto = jest.fn();
const mockRemovePhoto = jest.fn();

let mockPhotoState: {
  photoUri: string | null;
  isBusy: boolean;
  error: string | null;
} = { photoUri: null, isBusy: false, error: null };

jest.mock('@features/Profile/hooks/useProfilePhoto', () => ({
  useProfilePhoto: () => ({
    photoUri: mockPhotoState.photoUri,
    isBusy: mockPhotoState.isBusy,
    error: mockPhotoState.error,
    pickPhoto: mockPickPhoto,
    removePhoto: mockRemovePhoto,
    clearError: jest.fn(),
  }),
}));

// ─── Mock useBiometricLock (F8) ─────────────────────────────
const mockEnableLock = jest.fn();
const mockDisableLock = jest.fn();

let mockBiometricState: {
  biometricEnabled: boolean;
  supportedType: 'face' | 'fingerprint' | 'iris' | null;
} = { biometricEnabled: false, supportedType: 'face' };

jest.mock('@features/Biometric/hooks/useBiometricLock', () => ({
  useBiometricLock: () => ({
    biometricEnabled: mockBiometricState.biometricEnabled,
    supportedType: mockBiometricState.supportedType,
    isLocked: false,
    unlockError: null,
    unlock: jest.fn(),
    enableLock: mockEnableLock,
    disableLock: mockDisableLock,
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
    mockPhotoState = { photoUri: null, isBusy: false, error: null };
    mockPickPhoto.mockResolvedValue(undefined);
    mockRemovePhoto.mockResolvedValue(undefined);
    // [ADDED] F8 — reset biométrie
    mockBiometricState = { biometricEnabled: false, supportedType: 'face' };
    mockEnableLock.mockResolvedValue({ success: true, errorCode: null });
    mockDisableLock.mockResolvedValue({ success: true, errorCode: null });
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

  // ─── F7 passe 2 — section photo ───────────────────────────
  describe('profile photo (F7 pass 2)', () => {
    beforeEach(() => {
      mockUser = guestUser;
    });

    it('renders the gallery and camera buttons', () => {
      const { getByTestId } = render(<ProfileScreen />);

      expect(getByTestId('profile-photo-library')).toBeTruthy();
      expect(getByTestId('profile-photo-camera')).toBeTruthy();
    });

    it('hides the remove button when no photo is set', () => {
      mockPhotoState = { photoUri: null, isBusy: false, error: null };
      const { queryByTestId } = render(<ProfileScreen />);

      expect(queryByTestId('profile-photo-remove')).toBeNull();
    });

    it('shows the remove button only when a photo is present', () => {
      mockPhotoState = { photoUri: '/p.jpg', isBusy: false, error: null };
      const { getByTestId } = render(<ProfileScreen />);

      expect(getByTestId('profile-photo-remove')).toBeTruthy();
    });

    it('calls pickPhoto("library") when the gallery button is pressed', () => {
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent.press(getByTestId('profile-photo-library'));

      expect(mockPickPhoto).toHaveBeenCalledWith('library');
    });

    it('calls pickPhoto("camera") when the camera button is pressed', () => {
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent.press(getByTestId('profile-photo-camera'));

      expect(mockPickPhoto).toHaveBeenCalledWith('camera');
    });

    it('calls removePhoto when the remove button is pressed', () => {
      mockPhotoState = { photoUri: '/p.jpg', isBusy: false, error: null };
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent.press(getByTestId('profile-photo-remove'));

      expect(mockRemovePhoto).toHaveBeenCalled();
    });

    it('shows the loading indicator while a photo operation is busy', () => {
      mockPhotoState = { photoUri: null, isBusy: true, error: null };
      const { getByTestId, queryByTestId } = render(<ProfileScreen />);

      expect(getByTestId('profile-photo-loading')).toBeTruthy();
      // L'erreur n'est pas affichée pendant le loading
      expect(queryByTestId('profile-photo-error')).toBeNull();
    });

    it('shows the localized error message for an error code', () => {
      mockPhotoState = { photoUri: null, isBusy: false, error: 'permission_denied' };
      const { getByTestId, getByText } = render(<ProfileScreen />);

      expect(getByTestId('profile-photo-error')).toBeTruthy();
      expect(getByText('Permission refusée')).toBeTruthy();
    });

    it('disables the photo buttons while busy', () => {
      mockPhotoState = { photoUri: '/p.jpg', isBusy: true, error: null };
      const { getByTestId } = render(<ProfileScreen />);

      expect(getByTestId('profile-photo-library').props.accessibilityState.disabled).toBe(true);
      expect(getByTestId('profile-photo-remove').props.accessibilityState.disabled).toBe(true);
    });
  });

  // ─── F8 — section verrou biométrique ──────────────────────
  describe('biometric lock (F8)', () => {
    beforeEach(() => {
      mockUser = guestUser;
    });

    it('renders the biometric toggle reflecting the enabled flag', () => {
      mockBiometricState = { biometricEnabled: true, supportedType: 'face' };
      const { getByTestId } = render(<ProfileScreen />);

      const toggle = getByTestId('profile-biometric-toggle');
      expect(toggle).toBeTruthy();
      expect(toggle.props.value).toBe(true);
      expect(toggle.props.accessibilityState.checked).toBe(true);
    });

    it('does not render the toggle when signed out', () => {
      mockUser = null;
      const { queryByTestId } = render(<ProfileScreen />);

      expect(queryByTestId('profile-biometric-toggle')).toBeNull();
    });

    it('calls enableLock with a confirmation reason when toggled on', async () => {
      mockBiometricState = { biometricEnabled: false, supportedType: 'face' };
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent(getByTestId('profile-biometric-toggle'), 'valueChange', true);

      await waitFor(() => {
        expect(mockEnableLock).toHaveBeenCalledWith('Confirme avec Face ID');
      });
      expect(mockDisableLock).not.toHaveBeenCalled();
    });

    it('calls disableLock when toggled off', async () => {
      mockBiometricState = { biometricEnabled: true, supportedType: 'face' };
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent(getByTestId('profile-biometric-toggle'), 'valueChange', false);

      await waitFor(() => {
        expect(mockDisableLock).toHaveBeenCalled();
      });
      expect(mockEnableLock).not.toHaveBeenCalled();
    });

    it('shows a localized error message when enabling fails', async () => {
      mockEnableLock.mockResolvedValueOnce({ success: false, errorCode: 'not_enrolled' });
      const { getByTestId, getByText } = render(<ProfileScreen />);

      fireEvent(getByTestId('profile-biometric-toggle'), 'valueChange', true);

      await waitFor(() => {
        expect(getByTestId('profile-biometric-error')).toBeTruthy();
      });
      expect(getByText("Configure d'abord une biométrie.")).toBeTruthy();
    });

    it('falls back to "unknown" error message when no code is returned', async () => {
      mockEnableLock.mockResolvedValueOnce({ success: false, errorCode: null });
      const { getByTestId, getByText } = render(<ProfileScreen />);

      fireEvent(getByTestId('profile-biometric-toggle'), 'valueChange', true);

      await waitFor(() => {
        expect(getByText('Une erreur est survenue.')).toBeTruthy();
      });
    });

    it('builds the confirmation reason with the generic label when type is null', async () => {
      mockBiometricState = { biometricEnabled: false, supportedType: null };
      const { getByTestId } = render(<ProfileScreen />);

      fireEvent(getByTestId('profile-biometric-toggle'), 'valueChange', true);

      await waitFor(() => {
        expect(mockEnableLock).toHaveBeenCalledWith('Confirme avec la biométrie');
      });
    });
  });
});

/**
 * @file usePreferencesStore.test.ts
 * @description Tests unitaires du store usePreferencesStore.
 *              Unit tests for the usePreferencesStore.
 *
 * @module __tests__/unit/presentation/stores/usePreferencesStore
 */

// [ADDED] Tests unitaires usePreferencesStore

// Mock DI container avec storage in-memory
// Mock DI container with in-memory storage
const mockStorage = new Map<string, string>();

jest.mock('@/di/container', () => ({
  getContainer: () => ({
    zustandStorage: {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mockStorage.set(key, value);
      },
      removeItem: (key: string) => {
        mockStorage.delete(key);
      },
    },
  }),
}));

import { usePreferencesStore } from '@presentation/stores/usePreferencesStore';

describe('usePreferencesStore', () => {
  beforeEach(() => {
    mockStorage.clear();
    // Reset store to initial state between tests
    usePreferencesStore.setState({
      themeMode: 'system',
      language: 'fr',
      analyticsEnabled: true,
      // [ADDED] F8 — verrou biométrique (opt-in, off par défaut)
      biometricEnabled: false,
    });
  });

  // ─── Initial state ────────────────────────────────────────
  describe('initial state', () => {
    it('has themeMode set to "system"', () => {
      expect(usePreferencesStore.getState().themeMode).toBe('system');
    });

    it('has language set to "fr"', () => {
      expect(usePreferencesStore.getState().language).toBe('fr');
    });

    it('has analyticsEnabled set to true', () => {
      expect(usePreferencesStore.getState().analyticsEnabled).toBe(true);
    });

    // [ADDED] F8 — verrou biométrique désactivé par défaut (opt-in)
    it('has biometricEnabled set to false (opt-in)', () => {
      expect(usePreferencesStore.getState().biometricEnabled).toBe(false);
    });
  });

  // ─── Actions ──────────────────────────────────────────────
  describe('setThemeMode', () => {
    it('changes themeMode to "dark"', () => {
      usePreferencesStore.getState().setThemeMode('dark');

      expect(usePreferencesStore.getState().themeMode).toBe('dark');
    });

    it('changes themeMode to "light"', () => {
      usePreferencesStore.getState().setThemeMode('light');

      expect(usePreferencesStore.getState().themeMode).toBe('light');
    });
  });

  describe('setLanguage', () => {
    it('changes language to "en"', () => {
      usePreferencesStore.getState().setLanguage('en');

      expect(usePreferencesStore.getState().language).toBe('en');
    });
  });

  describe('setAnalyticsEnabled', () => {
    it('changes analyticsEnabled to false', () => {
      usePreferencesStore.getState().setAnalyticsEnabled(false);

      expect(usePreferencesStore.getState().analyticsEnabled).toBe(false);
    });
  });

  // [ADDED] F8 — setBiometricEnabled
  describe('setBiometricEnabled', () => {
    it('enables the biometric lock flag', () => {
      usePreferencesStore.getState().setBiometricEnabled(true);

      expect(usePreferencesStore.getState().biometricEnabled).toBe(true);
    });

    it('disables the biometric lock flag', () => {
      usePreferencesStore.getState().setBiometricEnabled(true);
      usePreferencesStore.getState().setBiometricEnabled(false);

      expect(usePreferencesStore.getState().biometricEnabled).toBe(false);
    });

    it('persists the flag to storage (MMKV adapter)', () => {
      usePreferencesStore.getState().setBiometricEnabled(true);

      const persisted = mockStorage.get('preferences');
      expect(persisted).toBeDefined();
      expect(persisted).toContain('"biometricEnabled":true');
    });
  });

  describe('resetPreferences', () => {
    it('resets all preferences to initial values', () => {
      // Change all values
      usePreferencesStore.getState().setThemeMode('dark');
      usePreferencesStore.getState().setLanguage('en');
      usePreferencesStore.getState().setAnalyticsEnabled(false);
      // [ADDED] F8
      usePreferencesStore.getState().setBiometricEnabled(true);

      // Reset
      usePreferencesStore.getState().resetPreferences();

      const state = usePreferencesStore.getState();
      expect(state.themeMode).toBe('system');
      expect(state.language).toBe('fr');
      expect(state.analyticsEnabled).toBe(true);
      // [ADDED] F8
      expect(state.biometricEnabled).toBe(false);
    });
  });
});

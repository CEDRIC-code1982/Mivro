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

  describe('resetPreferences', () => {
    it('resets all preferences to initial values', () => {
      // Change all values
      usePreferencesStore.getState().setThemeMode('dark');
      usePreferencesStore.getState().setLanguage('en');
      usePreferencesStore.getState().setAnalyticsEnabled(false);

      // Reset
      usePreferencesStore.getState().resetPreferences();

      const state = usePreferencesStore.getState();
      expect(state.themeMode).toBe('system');
      expect(state.language).toBe('fr');
      expect(state.analyticsEnabled).toBe(true);
    });
  });
});

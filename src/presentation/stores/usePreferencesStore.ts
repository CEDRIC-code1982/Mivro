/**
 * @file usePreferencesStore.ts
 * @description Préférences utilisateur persistées (thème, langue, analytics, biométrie).
 *              Persisted user preferences (theme, language, analytics, biometrics).
 *
 *              Persisté via MMKV (zustand persist middleware).
 *              Persisted via MMKV (zustand persist middleware).
 *
 * @module presentation/stores/usePreferencesStore
 */

// [ADDED] Store Zustand — préférences utilisateur persistées MMKV
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getContainer } from '@/di/container';

/**
 * Mode de thème : système, clair ou sombre.
 * Theme mode: system, light or dark.
 */
export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Langues supportées.
 * Supported languages.
 */
export type Language = 'fr' | 'en';

/**
 * État des préférences.
 * Preferences state.
 */
interface PreferencesState {
  /** Mode de thème actif / Active theme mode */
  themeMode: ThemeMode;
  /** Langue de l'interface / Interface language */
  language: Language;
  /** Analytics opt-in (PostHog) / Analytics opt-in (PostHog) */
  analyticsEnabled: boolean;
  /** Verrou biométrique opt-in (Face ID / Touch ID) — F8 / Biometric lock opt-in (Face ID / Touch ID) — F8 */
  biometricEnabled: boolean;
}

/**
 * Actions des préférences.
 * Preferences actions.
 */
interface PreferencesActions {
  /**
   * Change le mode de thème.
   * Changes the theme mode.
   *
   * @param mode - Nouveau mode / New mode
   */
  setThemeMode: (mode: ThemeMode) => void;
  /**
   * Change la langue de l'interface.
   * Changes the interface language.
   *
   * @param lang - Nouvelle langue / New language
   */
  setLanguage: (lang: Language) => void;
  /**
   * Active ou désactive les analytics.
   * Enables or disables analytics.
   *
   * @param enabled - true pour activer / true to enable
   */
  setAnalyticsEnabled: (enabled: boolean) => void;
  /**
   * Active ou désactive le verrou biométrique (F8).
   * Enables or disables the biometric lock (F8).
   *
   * ⚠️ La vérification de disponibilité + l'authentification de confirmation
   * à l'activation sont orchestrées en amont (ProfileScreen / useBiometricLock) ;
   * ce setter ne fait que persister le flag.
   * ⚠️ Availability check + confirmation authentication on enabling are
   * orchestrated upstream (ProfileScreen / useBiometricLock); this setter only
   * persists the flag.
   *
   * @param enabled - true pour activer le verrou / true to enable the lock
   */
  setBiometricEnabled: (enabled: boolean) => void;
  /**
   * Réinitialise les préférences aux valeurs par défaut.
   * Resets preferences to default values.
   */
  resetPreferences: () => void;
}

/** Type combiné du store / Combined store type */
type PreferencesStore = PreferencesState & PreferencesActions;

const initialState: PreferencesState = {
  themeMode: 'system',
  language: 'fr',
  analyticsEnabled: true,
  // [ADDED] F8 — verrou biométrique désactivé par défaut (opt-in)
  biometricEnabled: false,
};

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...initialState,
      setThemeMode: (themeMode) => set({ themeMode }),
      setLanguage: (language) => set({ language }),
      setAnalyticsEnabled: (analyticsEnabled) => set({ analyticsEnabled }),
      // [ADDED] F8 — persiste le flag verrou biométrique (opt-in)
      setBiometricEnabled: (biometricEnabled) => set({ biometricEnabled }),
      resetPreferences: () => set(initialState),
    }),
    {
      name: 'preferences',
      storage: createJSONStorage(() => getContainer().zustandStorage),
    },
  ),
);

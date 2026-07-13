/**
 * @file index.ts
 * @description Point d'entrée du Design System — composition des thèmes.
 *              Design System entry point — theme composition.
 *
 *              Tokens sémantiques (composés depuis les primitifs de tokens.ts).
 *              Semantic tokens (composed from primitives in tokens.ts).
 *
 *              Usage :
 *              ```ts
 *              import { useTheme } from '@theme';
 *              const theme = useTheme();
 *              const styles = StyleSheet.create({
 *                container: { backgroundColor: theme.color.surface.primary }
 *              });
 *              ```
 *
 * @module core/theme
 */

import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import {
  palette,
  spacing,
  typography,
  radius,
  elevation,
  motion,
  zIndex,
  touchTarget,
} from './tokens';

// ═══════════════════════════════════════════════════════════════
// THEME LIGHT
// ═══════════════════════════════════════════════════════════════

const lightSemantic = {
  // Surfaces
  surface: {
    primary: palette.neutral[0], // Fond principal app
    secondary: palette.neutral[50], // Fond sections, cards
    tertiary: palette.neutral[100], // Fond éléments imbriqués
    inverse: palette.neutral[900], // Fond inversé (toasts foncés)
    overlay: 'rgba(0, 0, 0, 0.5)', // Scrim modales
  },

  // Texte (toujours WCAG AA min sur les surfaces correspondantes)
  text: {
    primary: palette.neutral[900], // Texte principal (16:1 sur surface.primary)
    secondary: palette.neutral[600], // Texte secondaire (7:1)
    tertiary: palette.neutral[500], // Texte désactivé / hints (4.5:1)
    inverse: palette.neutral[0], // Texte sur fond foncé
    brand: palette.brand[600], // Liens / accents (4.7:1 ✅)
    error: palette.error[600], // (5.1:1 ✅)
    success: palette.success[600],
    warning: palette.warning[600],
    onBrand: palette.neutral[0], // Texte sur boutons brand
  },

  // Bordures
  border: {
    subtle: palette.neutral[200], // Séparateurs
    default: palette.neutral[300], // Bordures inputs au repos
    strong: palette.neutral[400], // Bordures emphase
    focus: palette.brand[500], // Anneau de focus a11y
    error: palette.error[500],
  },

  // États interactifs
  interactive: {
    brand: {
      default: palette.brand[600], // Boutons primaires (texte blanc lisible)
      hover: palette.brand[700],
      pressed: palette.brand[800],
      disabled: palette.neutral[300],
    },
    accent: {
      default: palette.accent[500],
      hover: palette.accent[600],
      pressed: palette.accent[700],
      disabled: palette.neutral[300],
    },
    neutral: {
      default: palette.neutral[100],
      hover: palette.neutral[200],
      pressed: palette.neutral[300],
      disabled: palette.neutral[100],
    },
    danger: {
      default: palette.error[500],
      hover: palette.error[600],
      pressed: palette.error[700],
      disabled: palette.neutral[300],
    },
  },

  // Feedback
  feedback: {
    successBg: palette.success[50],
    warningBg: palette.warning[50],
    errorBg: palette.error[50],
    infoBg: palette.info[50],
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// THEME DARK
// ═══════════════════════════════════════════════════════════════

const darkSemantic = {
  surface: {
    primary: palette.neutral[900],
    secondary: palette.neutral[800],
    tertiary: palette.neutral[700],
    inverse: palette.neutral[0],
    overlay: 'rgba(0, 0, 0, 0.7)',
  },

  text: {
    primary: palette.neutral[50], // (16:1 sur dark)
    secondary: palette.neutral[300],
    tertiary: palette.neutral[400],
    inverse: palette.neutral[900],
    brand: palette.brand[400], // En dark, on remonte la luminance
    error: palette.error[500],
    success: palette.success[500],
    warning: palette.warning[500],
    onBrand: palette.neutral[0],
  },

  border: {
    subtle: palette.neutral[800],
    default: palette.neutral[700],
    strong: palette.neutral[600],
    focus: palette.brand[400],
    error: palette.error[500],
  },

  interactive: {
    brand: {
      default: palette.brand[500],
      hover: palette.brand[400],
      pressed: palette.brand[300],
      disabled: palette.neutral[700],
    },
    accent: {
      default: palette.accent[400],
      hover: palette.accent[300],
      pressed: palette.accent[200],
      disabled: palette.neutral[700],
    },
    neutral: {
      default: palette.neutral[800],
      hover: palette.neutral[700],
      pressed: palette.neutral[600],
      disabled: palette.neutral[800],
    },
    danger: {
      default: palette.error[500],
      hover: palette.error[600],
      pressed: palette.error[700],
      disabled: palette.neutral[700],
    },
  },

  feedback: {
    successBg: 'rgba(45, 198, 83, 0.15)',
    warningBg: 'rgba(244, 180, 0, 0.15)',
    errorBg: 'rgba(230, 57, 70, 0.15)',
    infoBg: 'rgba(59, 130, 246, 0.15)',
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// THEME — Composition complète
// ═══════════════════════════════════════════════════════════════

/**
 * Construit un thème complet à partir des tokens primitifs et sémantiques.
 * Builds a complete theme from primitive and semantic tokens.
 *
 * @param mode - 'light' | 'dark'
 * @returns Theme — objet immuable utilisable dans toute l'app
 */
const buildTheme = (mode: 'light' | 'dark') => ({
  mode,
  color: mode === 'light' ? lightSemantic : darkSemantic,
  spacing,
  typography,
  radius,
  elevation,
  motion,
  zIndex,
  touchTarget,
  // Accès direct aux primitifs si besoin spécifique (rare)
  // Direct access to primitives for edge cases (rare)
  palette,
});

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');

export type Theme = typeof lightTheme;
export type ThemeMode = 'light' | 'dark';

/**
 * Préférence de mode de thème : 'system' suit l'appareil,
 * 'light'/'dark' sont des overrides explicites.
 * Theme mode preference: 'system' follows device,
 * 'light'/'dark' are explicit overrides.
 */
export type ThemeModePreference = 'system' | 'light' | 'dark';

// ═══════════════════════════════════════════════════════════════
// THEME MODE CONTEXT — [FIXED P0-6]
// ═══════════════════════════════════════════════════════════════

/**
 * Contexte React pour la préférence de thème.
 * React context for theme preference.
 *
 * Par défaut 'system' (suit l'appareil). La couche presentation
 * fournit la valeur via ThemeModeProvider connecté au store.
 * Defaults to 'system' (follows device). The presentation layer
 * provides the value via ThemeModeProvider connected to the store.
 */
const ThemeModeContext = createContext<ThemeModePreference>('system');

/**
 * Provider à placer dans l'arbre React pour overrider le mode thème.
 * Provider to place in the React tree to override the theme mode.
 *
 * @example
 * ```tsx
 * <ThemeModeProvider value={themeMode}>
 *   <App />
 * </ThemeModeProvider>
 * ```
 */
export const ThemeModeProvider = ThemeModeContext.Provider;

// ═══════════════════════════════════════════════════════════════
// HOOK — useTheme()
// ═══════════════════════════════════════════════════════════════

/**
 * Retourne le thème actif selon la préférence utilisateur ou système.
 * Returns the active theme based on user preference or system.
 *
 * Lit le ThemeModeContext (fourni par la couche presentation).
 * Si le mode est 'system', suit useColorScheme(). Sinon, utilise
 * le mode explicite ('light' ou 'dark').
 *
 * Reads ThemeModeContext (provided by the presentation layer).
 * If mode is 'system', follows useColorScheme(). Otherwise, uses
 * the explicit mode ('light' or 'dark').
 *
 * @returns Theme courant (light ou dark) / Current theme (light or dark)
 *
 * @example
 * const theme = useTheme();
 * const styles = StyleSheet.create({
 *   container: {
 *     backgroundColor: theme.color.surface.primary,
 *     padding: theme.spacing.lg,
 *   },
 * });
 */
export const useTheme = (): Theme => {
  const systemScheme = useColorScheme();
  const preferredMode = useContext(ThemeModeContext);

  // [FIXED P0-6] Respect user's theme preference over system
  const effectiveScheme = preferredMode !== 'system' ? preferredMode : systemScheme ?? 'light';

  return effectiveScheme === 'dark' ? darkTheme : lightTheme;
};

// Re-export des primitifs pour cas avancés (composables hors composants)
// Re-export primitives for advanced cases (outside components)
export { palette, spacing, typography, radius, elevation, motion, zIndex, touchTarget };

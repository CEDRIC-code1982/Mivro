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
 * @module theme
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
  borderWidth,
  size,
} from './tokens';

// ═══════════════════════════════════════════════════════════════
// THEME LIGHT
// ═══════════════════════════════════════════════════════════════

const lightSemantic = {
  // Surfaces
  surface: {
    primary: palette.neutral[0], // #FFFFFF — fond principal (bg)
    secondary: palette.neutral[0], // #FFFFFF — cartes (charte : card blanc en clair)
    tertiary: palette.neutral[100], // #F4F4F5 — chip / remplissage
    inverse: palette.neutral[900], // Fond inversé (toasts foncés)
    overlay: 'rgba(0, 0, 0, 0.5)', // Scrim modales
  },

  // Texte (toujours WCAG AA min sur les surfaces correspondantes)
  text: {
    primary: '#1A1A2E', // Encre Mivro (indigo-tinted) — charte
    secondary: palette.neutral[600], // #52525B — texte secondaire (7:1)
    tertiary: palette.neutral[500], // #71717A — hints/placeholder conservé A11Y-001 (charte #A1A1AA = 2.3:1, non conforme)
    inverse: palette.neutral[0], // Texte sur fond foncé
    brand: palette.brand[600], // Liens / accents — 6,29:1
    error: palette.error[600], // 5,59:1
    success: palette.success[700], // 5,02:1 (le 600 ne donnait que 3,3:1)
    warning: palette.warning[700], // 5,06:1 (le 600 ne donnait que 2,86:1)
    onBrand: palette.neutral[0], // Texte sur remplissage brand / danger — 6,29:1
    // Le teal accent est trop lumineux pour du blanc (2,17:1) : sur un
    // remplissage accent, le texte est de l'encre — 7,87:1.
    // Teal accent is too bright for white text: ink on accent gives 7,87:1.
    onAccent: '#1A1A2E',
  },

  // Bordures
  border: {
    subtle: palette.neutral[200], // Séparateurs
    default: palette.neutral[300], // Bordures inputs au repos
    strong: palette.neutral[400], // Bordures emphase
    focus: palette.brand[500], // Anneau de focus a11y
    error: palette.error[500],
    // Bordure réservant la place d'un état sélectionné, sans la dessiner
    // Border reserving the room of a selected state, without drawing it
    none: 'transparent',
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
      // Le teal de la charte est vif : ses états s'ÉCLAIRCISSENT au lieu de
      // s'assombrir, sinon le libellé `text.onAccent` (encre) deviendrait
      // illisible sur un teal foncé. Même logique qu'en mode sombre.
      // A bright accent lightens on interaction, so its ink label stays legible.
      default: palette.accent[400], // #2EC4B6 — teal participants (clair)
      hover: palette.accent[300],
      pressed: palette.accent[200],
      disabled: palette.neutral[300],
    },
    neutral: {
      default: palette.neutral[100],
      hover: palette.neutral[200],
      pressed: palette.neutral[300],
      disabled: palette.neutral[100],
    },
    danger: {
      // 600 et non 500 : ce token sert à la fois de remplissage (blanc dessus,
      // 5,59:1) et de couleur d'icône/texte sur blanc (5,59:1). Le 500 échouait
      // les deux (4,17:1).
      default: palette.error[600],
      hover: palette.error[700],
      pressed: palette.error[800],
      disabled: palette.neutral[300],
    },
  },

  // Couleurs rendues SUR LA CARTE — identiques en clair et en sombre.
  //
  // Les tuiles de react-native-maps ne suivent pas le thème de l'app : elles
  // restent claires en mode sombre. Un token `text.*` ou `interactive.*`, calé
  // sur les surfaces du thème, y est donc invalide — c'est ce qui a rendu le
  // cercle de rayon invisible en sombre (1,73:1, cf. JOURNAL J-021).
  //
  // Map tiles do not follow the app theme: they stay light in dark mode, so a
  // theme-relative token is invalid on them. These values are tile-relative.
  map: {
    // Trait du cercle de rayon — 5,47:1 sur tuile claire, 6,29:1 sur blanc.
    stroke: palette.brand[600],
    // Remplissage du même cercle : décoratif, le trait porte l'information.
    strokeFill: `${palette.brand[600]}26`,
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
    primary: '#15151F', // bg (charte)
    secondary: '#1E1E2D', // card (charte)
    tertiary: '#262635', // chip / remplissage (charte)
    inverse: palette.neutral[0],
    overlay: 'rgba(0, 0, 0, 0.7)',
  },

  text: {
    primary: palette.neutral[100], // #F4F4F5 (charte)
    secondary: '#A1A1AB', // charte — texte secondaire sombre
    tertiary: palette.neutral[400], // #A1A1AA — hints conservé A11Y-001 (charte muted #6B6B78 = 3.5:1)
    inverse: '#1A1A2E', // Encre Mivro sur surfaces claires
    brand: palette.brand[300], // #A5B4FC (charte brand texte/icône sombre) — 9,09:1
    error: palette.error[400], // 6,59:1 (le 500 ne donnait que 4,35:1 sur bg sombre)
    success: palette.success[500], // 7,95:1
    warning: palette.warning[500], // 9,82:1
    // En sombre, un remplissage doit être CLAIR pour se détacher du fond ;
    // du blanc dessus ne peut alors plus atteindre AA. Le libellé est donc de
    // l'encre, comme sur l'accent. Encre sur brand[400] : 5,72:1.
    // A dark-mode fill must be light to stand out, so its label is ink.
    onBrand: '#1A1A2E',
    // Idem : encre sur remplissage teal — 9,16:1.
    onAccent: '#1A1A2E',
  },

  border: {
    subtle: '#2E2E3D', // charte — bordure sombre
    default: '#3A3A4D',
    strong: palette.neutral[600],
    focus: palette.brand[400], // #818CF8
    error: palette.error[500],
    // Bordure réservant la place d'un état sélectionné, sans la dessiner
    // Border reserving the room of a selected state, without drawing it
    none: 'transparent',
  },

  interactive: {
    brand: {
      // Remplissage CLAIR portant de l'encre. brand[500] était un cul-de-sac :
      // ni le blanc (4,47:1) ni l'encre (3,82:1) n'y atteignent AA. Et
      // l'assombrir en brand[600] tombait à 2,88:1 face au fond sombre
      // (frontière WCAG 1.4.11) — c'est le bug corrigé en J-020.
      // brand[400] : frontière 6,07:1, encre dessus 5,72:1.
      default: palette.brand[400],
      hover: palette.brand[300],
      pressed: palette.brand[200],
      disabled: palette.neutral[700],
    },
    accent: {
      default: palette.accent[300], // #2DD4BF — teal participants (sombre)
      hover: palette.accent[200],
      pressed: palette.accent[100],
      disabled: palette.neutral[700],
    },
    neutral: {
      default: palette.neutral[800],
      hover: palette.neutral[700],
      pressed: palette.neutral[600],
      disabled: palette.neutral[800],
    },
    danger: {
      // Même logique que brand : remplissage clair, encre dessus.
      // error[400] : frontière 6,59:1, encre dessus 6,21:1.
      default: palette.error[400],
      hover: palette.error[300],
      pressed: palette.error[200],
      disabled: palette.neutral[700],
    },
  },

  // Couleurs rendues SUR LA CARTE — identiques en clair et en sombre.
  //
  // Les tuiles de react-native-maps ne suivent pas le thème de l'app : elles
  // restent claires en mode sombre. Un token `text.*` ou `interactive.*`, calé
  // sur les surfaces du thème, y est donc invalide — c'est ce qui a rendu le
  // cercle de rayon invisible en sombre (1,73:1, cf. JOURNAL J-021).
  //
  // Map tiles do not follow the app theme: they stay light in dark mode, so a
  // theme-relative token is invalid on them. These values are tile-relative.
  map: {
    // Trait du cercle de rayon — 5,47:1 sur tuile claire, 6,29:1 sur blanc.
    stroke: palette.brand[600],
    // Remplissage du même cercle : décoratif, le trait porte l'information.
    strokeFill: `${palette.brand[600]}26`,
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
  borderWidth,
  size,
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
export {
  palette,
  spacing,
  typography,
  radius,
  elevation,
  motion,
  zIndex,
  touchTarget,
  borderWidth,
  size,
};

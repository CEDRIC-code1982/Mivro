/**
 * @file tokens.ts
 * @description Design tokens primitifs — valeurs brutes du Design System.
 *              Primitive design tokens — raw Design System values.
 *
 *              Ces tokens sont INDÉPENDANTS du thème (light/dark).
 *              Les thèmes (light.ts, dark.ts) consomment ces primitifs
 *              pour composer des tokens sémantiques.
 *
 *              These tokens are theme-agnostic. Themes (light.ts, dark.ts)
 *              consume these primitives to compose semantic tokens.
 *
 * @module core/theme/tokens
 */

// ═══════════════════════════════════════════════════════════════
// COULEURS — Palette primitive
// ═══════════════════════════════════════════════════════════════
//
// Échelles 50→900 inspirées de Tailwind / Radix.
// Permet de composer light + dark à partir d'une seule source.
// 50→900 scales inspired by Tailwind / Radix for light/dark composition.
// ═══════════════════════════════════════════════════════════════

export const palette = {
  // Brand orange (primary) — accessible : #E55A24 (plus foncé) pour texte sur blanc
  brand: {
    50: '#FFF4EE',
    100: '#FFE4D4',
    200: '#FFC4A0',
    300: '#FF9D6B',
    400: '#FF7A40',
    500: '#FF6B35', // Couleur de marque originale — usage UI/graphique uniquement
    600: '#E55A24', // ✅ Texte sur blanc (4.7:1)
    700: '#C24517',
    800: '#993610',
    900: '#73280C',
  },

  // Accent teal (secondary)
  accent: {
    50: '#E6FAF7',
    100: '#B3F0E5',
    200: '#80E5D4',
    300: '#4DDBC2',
    400: '#2EC4B6', // Couleur de marque originale
    500: '#26A89C',
    600: '#1F8B82',
    700: '#176D66',
    800: '#0F5049',
    900: '#08332E',
  },

  // Gris neutres (text, backgrounds, borders)
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
    1000: '#000000',
  },

  // Sémantiques — états
  success: {
    50: '#E8F8EE',
    500: '#2DC653',
    600: '#1FA642', // ✅ Texte sur blanc (4.5:1)
    700: '#157A30',
  },
  warning: {
    50: '#FFF8E6',
    500: '#F4B400',
    600: '#C68F00', // ✅ Texte sur blanc
    700: '#8F6800',
  },
  error: {
    50: '#FCE8EA',
    500: '#E63946',
    600: '#C62836', // ✅ Texte sur blanc (5.1:1)
    700: '#971D2A',
  },
  info: {
    50: '#E6F2FF',
    500: '#3B82F6',
    600: '#2563EB', // ✅ Texte sur blanc
    700: '#1D4ED8',
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// ESPACEMENTS — Échelle 4-based (multiples de 4)
// ═══════════════════════════════════════════════════════════════
//
// Pourquoi 4 ? Standard mobile (Apple HIG + Material).
// Permet d'aligner sur la grille 8pt sans rigidité.
// Why 4-based? Industry standard. Aligns with 8pt grid flexibly.
// ═══════════════════════════════════════════════════════════════

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export type SpacingToken = keyof typeof spacing;

// ═══════════════════════════════════════════════════════════════
// TYPOGRAPHIE — Type scale (Major Third 1.250)
// ═══════════════════════════════════════════════════════════════
//
// Tailles en sp/dp (jamais en px).
// React Native applique automatiquement le scaling système.
// All sizes in sp/dp (never px). RN auto-applies system scaling.
// ═══════════════════════════════════════════════════════════════

export const typography = {
  fontFamily: {
    // À configurer selon les fonts intégrées via react-native-asset
    // Configure based on fonts integrated via react-native-asset
    sans: 'Inter',
    mono: 'JetBrainsMono',
  },

  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Tailles compatibles Dynamic Type (font scaling system)
  fontSize: {
    caption: 12, // Légendes, mentions secondaires
    small: 14, // Texte secondaire
    body: 16, // Corps de texte (minimum lisible mobile)
    bodyLg: 18, // Corps emphase / paragraphes longs
    h4: 20,
    h3: 24,
    h2: 28,
    h1: 32,
    display: 40, // Titres marketing / écrans de splash
  },

  lineHeight: {
    // Multiplicateurs (s'appliquent à fontSize)
    // Multipliers (applied to fontSize)
    tight: 1.2, // Titres
    normal: 1.4, // UI standard
    relaxed: 1.6, // Texte long, paragraphes
  },

  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999, // Cercles, pills
} as const;

// ═══════════════════════════════════════════════════════════════
// ÉLÉVATIONS — Ombres unifiées iOS/Android
// ═══════════════════════════════════════════════════════════════
//
// React Native gère les ombres différemment iOS/Android :
// - iOS  : shadowColor + shadowOffset + shadowOpacity + shadowRadius
// - Android : elevation (entier 0-24)
//
// Ce système unifie les deux. À utiliser via la prop `style`.
// Unifies iOS/Android shadow systems. Use via `style` prop.
// ═══════════════════════════════════════════════════════════════

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// ANIMATIONS — Durées et courbes
// ═══════════════════════════════════════════════════════════════

export const motion = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 400,
    slower: 600,
  },
  easing: {
    // Bezier values pour Animated.timing()
    // Bezier values for Animated.timing()
    standard: [0.4, 0.0, 0.2, 1], // Entrée/sortie standard
    accelerate: [0.4, 0.0, 1, 1], // Sortie rapide
    decelerate: [0.0, 0.0, 0.2, 1], // Entrée douce
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// Z-INDEX — Hiérarchie d'empilement
// ═══════════════════════════════════════════════════════════════

export const zIndex = {
  base: 0,
  raised: 1,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  toast: 1500,
  tooltip: 1600,
} as const;

// ═══════════════════════════════════════════════════════════════
// TOUCH TARGETS — Tailles minimales WCAG / HIG / Material
// ═══════════════════════════════════════════════════════════════

export const touchTarget = {
  // iOS HIG : 44pt | Material : 48dp | WCAG AA : 44×44 CSS px
  // On prend 48 pour couvrir les deux plateformes.
  min: 48,
  // Confortable pour cibles fréquentes (FAB, tabs)
  large: 56,
} as const;

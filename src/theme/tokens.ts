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
 * @module theme/tokens
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
  // Brand indigo (primary) — charte Mivro. Échelle Tailwind indigo.
  // 600=#4F46E5 (clair), 500=#6366F1 (sombre), 300=#A5B4FC (texte/icône sur fond sombre).
  brand: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC', // Brand texte/icône sur fond sombre
    400: '#818CF8', // Fin de dégradé CTA (sombre)
    500: '#6366F1', // Brand sombre (boutons, avatars, actif)
    600: '#4F46E5', // Brand clair (boutons, actif) + texte brand sur blanc (6,29:1)
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
  },

  // Accent teal (secondary) — participants : #2EC4B6 (clair), #2DD4BF (sombre).
  // Trop lumineux pour porter du blanc : son libellé est `text.onAccent` (encre).
  accent: {
    50: '#E6FAF7',
    100: '#B3F0E5',
    200: '#80E5D4',
    300: '#2DD4BF', // Teal participants (fond sombre)
    400: '#2EC4B6', // Teal participants (fond clair)
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
  // Ratios vérifiés par src/theme/contrast.test.ts (A11Y-001) — ne pas se fier
  // à un commentaire, le test est la source de vérité.
  // Ratios verified by src/theme/contrast.test.ts — the test is the source of truth.
  success: {
    50: '#E8F8EE',
    500: '#22C55E', // Succès sur fond sombre (7,95:1)
    600: '#16A34A', // Fond de badge — INSUFFISANT en texte sur blanc (3,3:1)
    700: '#15803D', // Succès en texte sur blanc (5,02:1)
  },
  warning: {
    50: '#FFF8E6',
    500: '#F4B400', // Avertissement sur fond sombre (9,82:1)
    600: '#C68F00', // Fond de badge — INSUFFISANT en texte sur blanc (2,86:1)
    700: '#8F6800', // Avertissement en texte sur blanc (5,06:1)
  },
  error: {
    50: '#FCE8EA',
    200: '#FBC7CD', // État pressé d'un remplissage destructif en sombre
    300: '#F9A2AA', // État survolé d'un remplissage destructif en sombre
    400: '#F5737F', // Erreur en texte sur fond sombre (6,59:1)
    500: '#E63946', // Bordure d'erreur (UI, 4,17:1 ≥ 3:1) — INSUFFISANT en texte
    600: '#C62836', // Erreur en texte sur blanc (5,59:1) + blanc dessus (5,59:1)
    700: '#971D2A',
    800: '#7A1622', // État pressé d'un bouton destructif
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

// ═══════════════════════════════════════════════════════════════
// ÉPAISSEURS DE BORDURE — Border widths
// ═══════════════════════════════════════════════════════════════

export const borderWidth = {
  none: 0,
  // Séparateurs, bordures d'input au repos / dividers, resting input borders
  hairline: 1,
  // Bordure d'état : sélection, participant live / state border
  thin: 2,
  // Contour de marker sur carte (lisibilité sur tuiles) / map marker outline
  thick: 3,
} as const;

export type BorderWidthToken = keyof typeof borderWidth;

// ═══════════════════════════════════════════════════════════════
// TAILLES — Dimensions propres d'un élément
// ═══════════════════════════════════════════════════════════════
//
// `spacing` sert aux écarts entre éléments, `size` aux dimensions de
// l'élément lui-même. Les deux échelles restent volontairement distinctes.
//
// `spacing` is for gaps between elements, `size` for an element's own
// dimensions. The two scales stay deliberately separate.
// ═══════════════════════════════════════════════════════════════

export const size = {
  // Diamètres des markers de carte / map marker diameters
  marker: {
    // Marker live participant (halo) / live participant halo
    sm: 28,
    // Marker point de départ participant / participant origin marker
    md: 36,
    // Marker midpoint (le résultat, donc le plus visible) / midpoint marker
    lg: 48,
  },
  // Largeur max d'une colonne de texte lisible (~50 caractères)
  // Max width of a readable text column (~50 characters)
  maxTextWidth: 320,
} as const;

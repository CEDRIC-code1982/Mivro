/**
 * @file contrast.test.ts
 * @description Mécanise A11Y-001 : chaque paire couleur avant-plan / arrière-plan
 *              du thème doit atteindre le ratio WCAG AA.
 *              Mechanises A11Y-001: every foreground/background pair of the
 *              theme must reach its WCAG AA contrast ratio.
 *
 *              Ce test est un CLIQUET, pas un mur :
 *              - toute paire conforme aujourd'hui doit rester conforme ;
 *              - les paires listées dans PENDING_DESIGN_DECISION échouent déjà à
 *                AA ; elles ne peuvent qu'AUGMENTER, jamais baisser ;
 *              - dès qu'une paire de cette liste repasse le seuil, le test
 *                échoue pour forcer sa sortie de la liste.
 *
 *              This test is a RATCHET, not a wall: compliant pairs must stay
 *              compliant, listed pairs may only improve, and a listed pair that
 *              becomes compliant fails the test so the list shrinks.
 *
 *              Corriger une entrée = changer une couleur de la palette, donc une
 *              décision design. Voir docs/harness/JOURNAL-ECHECS.md (J-012).
 *
 * @module theme/contrast
 */

import { darkTheme, lightTheme } from '@theme';

// ═══════════════════════════════════════════════════════════════
// SEUILS WCAG 2.1 niveau AA
// ═══════════════════════════════════════════════════════════════

/** Texte normal (< 18pt) / Normal text */
const AA_TEXT = 4.5;
/** Composant d'interface ou objet graphique porteur de sens / UI component */
const AA_UI = 3;

// ═══════════════════════════════════════════════════════════════
// CALCUL DU CONTRASTE
// ═══════════════════════════════════════════════════════════════

/**
 * Luminance relative d'une couleur hexadécimale (WCAG 2.1).
 * Relative luminance of a hex colour (WCAG 2.1).
 *
 * @param hex - Couleur au format #RGB ou #RRGGBB / Colour as #RGB or #RRGGBB
 * @returns Luminance relative dans [0, 1] / Relative luminance in [0, 1]
 */
const luminance = (hex: string): number => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : clean;

  const srgb = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16) / 255);
  const linear = srgb.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
};

/**
 * Ratio de contraste WCAG entre deux couleurs, arrondi à 2 décimales.
 * WCAG contrast ratio between two colours, rounded to 2 decimals.
 *
 * @param foreground - Couleur d'avant-plan / Foreground colour
 * @param background - Couleur d'arrière-plan / Background colour
 * @returns Ratio entre 1 et 21 / Ratio between 1 and 21
 */
const contrastRatio = (foreground: string, background: string): number => {
  const a = luminance(foreground);
  const b = luminance(background);
  const raw = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Math.round(raw * 100) / 100;
};

// ═══════════════════════════════════════════════════════════════
// PAIRES TESTÉES
// ═══════════════════════════════════════════════════════════════

interface Pair {
  /** Identifiant stable, aussi utilisé comme clé de PENDING_DESIGN_DECISION */
  readonly label: string;
  readonly foreground: string;
  readonly background: string;
  readonly threshold: number;
}

/**
 * Construit les paires réellement utilisées par l'UI pour un mode donné.
 * Builds the pairs the UI actually renders for a given mode.
 *
 * `surface.tertiary` est volontairement exclu : il porte du chrome imbriqué,
 * pas du texte courant. `border.subtle` / `border.default` / `border.strong`
 * sont exclus aussi — WCAG n'impose pas 3:1 aux séparateurs décoratifs.
 *
 * @param mode - 'light' ou 'dark' / 'light' or 'dark'
 * @returns Les paires à vérifier / The pairs to check
 */
const buildPairs = (mode: 'light' | 'dark'): readonly Pair[] => {
  const { color } = mode === 'light' ? lightTheme : darkTheme;
  const pairs: Pair[] = [];

  const textTokens = ['primary', 'secondary', 'tertiary', 'brand', 'error', 'success', 'warning'];
  const surfaceTokens = ['primary', 'secondary'];

  for (const textToken of textTokens) {
    for (const surfaceToken of surfaceTokens) {
      const foreground = color.text[textToken as keyof typeof color.text];
      const background = color.surface[surfaceToken as keyof typeof color.surface];
      pairs.push({
        label: `${mode} text.${textToken} on surface.${surfaceToken}`,
        foreground,
        background,
        threshold: AA_TEXT,
      });
    }
  }

  // Texte inversé sur fond inversé (toasts sombres) / inverse text on inverse surface
  pairs.push({
    label: `${mode} text.inverse on surface.inverse`,
    foreground: color.text.inverse,
    background: color.surface.inverse,
    threshold: AA_TEXT,
  });

  // Libellés de boutons pleins / solid button labels
  for (const interactiveToken of ['brand', 'accent', 'danger'] as const) {
    pairs.push({
      label: `${mode} text.onBrand on interactive.${interactiveToken}.default`,
      foreground: color.text.onBrand,
      background: color.interactive[interactiveToken].default,
      threshold: AA_TEXT,
    });
  }

  // Indicateurs porteurs de sens : focus a11y et bordure d'erreur (3:1)
  pairs.push({
    label: `${mode} border.focus on surface.primary`,
    foreground: color.border.focus,
    background: color.surface.primary,
    threshold: AA_UI,
  });
  pairs.push({
    label: `${mode} border.error on surface.primary`,
    foreground: color.border.error,
    background: color.surface.primary,
    threshold: AA_UI,
  });

  return pairs;
};

// ═══════════════════════════════════════════════════════════════
// DETTE A11Y-001 — décisions design en attente
// ═══════════════════════════════════════════════════════════════

/**
 * Paires qui échouent déjà à WCAG AA, avec le ratio mesuré au moment de la mise
 * en place du cliquet. Les corriger implique de changer la palette : c'est une
 * décision design, pas une correction mécanique.
 *
 * ⚠️ À SPÉCIFIER AVEC CÉDRIC — voir docs/context/TODO.md.
 *
 * Ne JAMAIS ajouter d'entrée ici pour faire passer une nouvelle couleur :
 * choisir une couleur conforme à la place.
 */
const PENDING_DESIGN_DECISION: Readonly<Record<string, number>> = {
  // Orange de marque #E55A24 : le commentaire du thème annonce 4.7:1, la mesure
  // donne 3.61. Concerne les liens et accents en clair.
  'light text.brand on surface.primary': 3.61,
  'light text.brand on surface.secondary': 3.46,
  // Vert de succès trop clair pour du texte en mode clair.
  'light text.success on surface.primary': 3.19,
  'light text.success on surface.secondary': 3.05,
  // Ambre d'avertissement : le pire cas du thème clair.
  'light text.warning on surface.primary': 2.86,
  'light text.warning on surface.secondary': 2.74,
  // Rouge d'erreur remonté en luminance pour le dark, mais pas assez.
  'dark text.error on surface.primary': 4.25,
  'dark text.error on surface.secondary': 3.57,
  // Anneau de focus en clair : sous les 3:1 exigés pour un indicateur.
  'light border.focus on surface.primary': 2.84,
  // Libellés blancs sur boutons pleins : aucun n'atteint 4.5:1.
  'light text.onBrand on interactive.brand.default': 3.61,
  'light text.onBrand on interactive.accent.default': 2.93,
  'light text.onBrand on interactive.danger.default': 4.17,
  'dark text.onBrand on interactive.brand.default': 2.84,
  'dark text.onBrand on interactive.accent.default': 2.17,
  'dark text.onBrand on interactive.danger.default': 4.17,
};

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

const ALL_PAIRS = [...buildPairs('light'), ...buildPairs('dark')];

describe('A11Y-001 — contraste WCAG AA des tokens de thème', () => {
  it('calcule correctement des ratios connus', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });

  it('ne teste que des couleurs hexadécimales résolues', () => {
    const nonHex = ALL_PAIRS.filter(
      (pair) => !pair.foreground?.startsWith('#') || !pair.background?.startsWith('#'),
    );
    expect(nonHex.map((pair) => pair.label)).toEqual([]);
  });

  const compliant = ALL_PAIRS.filter((pair) => !(pair.label in PENDING_DESIGN_DECISION));
  const pending = ALL_PAIRS.filter((pair) => pair.label in PENDING_DESIGN_DECISION);

  it.each(compliant.map((pair) => [pair.label, pair] as const))(
    'respecte AA — %s',
    (_label, pair) => {
      expect(contrastRatio(pair.foreground, pair.background)).toBeGreaterThanOrEqual(
        pair.threshold,
      );
    },
  );

  it.each(pending.map((pair) => [pair.label, pair] as const))(
    'ne régresse pas (dette A11Y-001) — %s',
    (label, pair) => {
      const recorded = PENDING_DESIGN_DECISION[label];
      const measured = contrastRatio(pair.foreground, pair.background);

      // Le ratio ne doit jamais baisser sous la valeur enregistrée.
      expect(measured).toBeGreaterThanOrEqual(recorded as number);

      // S'il atteint enfin le seuil, retirer l'entrée de la liste.
      if (measured >= pair.threshold) {
        throw new Error(
          `"${label}" atteint désormais ${measured}:1 (seuil ${pair.threshold}). ` +
            'Retire-la de PENDING_DESIGN_DECISION.',
        );
      }
    },
  );

  it('ne garde aucune entrée orpheline dans la liste de dette', () => {
    const knownLabels = new Set(ALL_PAIRS.map((pair) => pair.label));
    const orphans = Object.keys(PENDING_DESIGN_DECISION).filter((label) => !knownLabels.has(label));
    expect(orphans).toEqual([]);
  });
});

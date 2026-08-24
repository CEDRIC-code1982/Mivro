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
 * @module theme/contrast.test
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

  // Libellés de boutons pleins / solid button labels.
  // Le teal accent est trop lumineux pour du blanc : son libellé est de l'encre
  // (`text.onAccent`). Les remplissages brand et danger portent du blanc.
  // The teal accent is too bright for white: its label is ink.
  for (const interactiveToken of ['brand', 'danger'] as const) {
    pairs.push({
      label: `${mode} text.onBrand on interactive.${interactiveToken}.default`,
      foreground: color.text.onBrand,
      background: color.interactive[interactiveToken].default,
      threshold: AA_TEXT,
    });
  }
  pairs.push({
    label: `${mode} text.onAccent on interactive.accent.default`,
    foreground: color.text.onAccent,
    background: color.interactive.accent.default,
    threshold: AA_TEXT,
  });

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
 * Paires qui échoueraient encore à WCAG AA, avec leur ratio mesuré.
 *
 * **Cette liste est vide, et doit le rester.** La dette d'origine (15 paires,
 * dont l'ancienne marque orange à 3,61:1 alors que le thème annonçait 4,7:1) a
 * été résorbée le 2026-08-24 : rebrand indigo, `text.success`/`text.warning`
 * passés au step 700, `text.error` sombre au step 400, remplissages brand et
 * danger au step 600, et introduction de `text.onAccent` (encre) parce que le
 * teal est trop lumineux pour porter du blanc.
 *
 * Ne JAMAIS ajouter d'entrée ici pour faire passer une nouvelle couleur :
 * choisir une couleur conforme à la place. Une entrée n'est légitime que pour
 * une dette constatée sur du code existant, et doit alors pointer un TODO.
 */
const PENDING_DESIGN_DECISION: Readonly<Record<string, number>> = {};

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

  // Un seul test qui boucle, et non `it.each` : la liste de dette est vide
  // aujourd'hui, et `it.each([])` échoue en réclamant un tableau non vide.
  // A single looping test, not `it.each`: the debt list is empty today and
  // `it.each([])` fails asking for a non-empty array.
  it('ne régresse pas, et ne garde pas une dette déjà résorbée (A11Y-001)', () => {
    const regressions: string[] = [];
    const resolved: string[] = [];

    for (const pair of pending) {
      const recorded = PENDING_DESIGN_DECISION[pair.label] as number;
      const measured = contrastRatio(pair.foreground, pair.background);

      if (measured < recorded) {
        regressions.push(`${pair.label} : ${measured}:1 < ${recorded}:1 enregistré`);
      }
      if (measured >= pair.threshold) {
        resolved.push(
          `${pair.label} : ${measured}:1 atteint le seuil ${pair.threshold} — ` +
            'retire-la de PENDING_DESIGN_DECISION',
        );
      }
    }

    expect(regressions).toEqual([]);
    expect(resolved).toEqual([]);
  });

  it('ne garde aucune entrée orpheline dans la liste de dette', () => {
    const knownLabels = new Set(ALL_PAIRS.map((pair) => pair.label));
    const orphans = Object.keys(PENDING_DESIGN_DECISION).filter((label) => !knownLabels.has(label));
    expect(orphans).toEqual([]);
  });
});

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

/**
 * Fonds de tuiles de carte les plus clairs et les plus foncés rencontrés.
 * Lightest and darkest map tile backgrounds encountered.
 *
 * Approximation volontaire : on ne contrôle pas le rendu des tuiles, donc on
 * borne. Le cas dur est la tuile claire, puisque le mode sombre pousse à
 * choisir des couleurs claires.
 */
const MAP_TILES = {
  light: '#F1EFE9',
  white: '#FFFFFF',
} as const;

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
 * Compose une couleur `rgba(...)` sur un fond opaque.
 * Composites an `rgba(...)` colour over an opaque background.
 *
 * Sans ça, les fonds `feedback.*Bg` (semi-transparents en mode sombre) ne
 * seraient pas mesurables et resteraient hors du cliquet.
 *
 * @param rgba - Couleur au format `rgba(r, g, b, a)`
 * @param baseHex - Fond opaque sous-jacent
 * @returns La couleur composée, en hexadécimal
 */
const flatten = (rgba: string, baseHex: string): string => {
  const parts = rgba.match(/rgba?\(([^)]+)\)/);
  if (!parts?.[1]) {
    return rgba;
  }
  const [r, g, b, a] = parts[1].split(',').map((value) => Number(value.trim()));
  const base = baseHex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(base.slice(offset, offset + 2), 16));
  // `rgb(...)` sans canal alpha vaut opaque.
  const alpha = a ?? 1;
  const mix = [r ?? 0, g ?? 0, b ?? 0].map((channel, index) =>
    Math.round(channel * alpha + (channels[index] ?? 0) * (1 - alpha)),
  );
  return `#${mix.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Construit les paires réellement rendues par l'UI pour un mode donné.
 * Builds the pairs the UI actually renders for a given mode.
 *
 * Cinq rôles sont couverts, parce qu'un token de couleur ne se juge pas dans
 * l'abstrait mais dans l'usage :
 *
 * 1. **texte sur surface** — seuil 4,5:1 ;
 * 2. **libellé sur remplissage** — un bouton plein porte `text.onBrand` ou
 *    `text.onAccent` selon la teinte du remplissage, seuil 4,5:1 ;
 * 3. **remplissage contre surface** — la frontière du composant doit être
 *    perceptible (WCAG 1.4.11), seuil 3:1. C'est le rôle qui manquait et qui a
 *    laissé passer la régression J-020 ;
 * 4. **indicateur porteur de sens** — anneau de focus, bordure d'erreur, 3:1 ;
 * 5. **avant-plan sur tuile de carte** — les tuiles ne suivent pas le thème,
 *    donc un token calé sur les surfaces de l'app y est invalide, 3:1.
 *
 * `border.subtle` / `default` / `strong` restent exclus : WCAG n'impose rien aux
 * séparateurs décoratifs. Sur `surface.tertiary` (chrome imbriqué : chips,
 * cercles d'icône) l'app ne rend que `text.primary`, `text.secondary` et
 * `text.brand` — les autres combinaisons ne sont pas testées parce qu'elles
 * n'existent pas à l'écran.
 *
 * @param mode - 'light' ou 'dark' / 'light' or 'dark'
 * @returns Les paires à vérifier / The pairs to check
 */
const buildPairs = (mode: 'light' | 'dark'): readonly Pair[] => {
  const { color } = mode === 'light' ? lightTheme : darkTheme;
  const pairs: Pair[] = [];

  const push = (label: string, foreground: string, background: string, threshold: number): void => {
    pairs.push({ label: `${mode} ${label}`, foreground, background, threshold });
  };

  // ── 1. Texte sur surface ────────────────────────────────────────────────
  const textTokens = ['primary', 'secondary', 'tertiary', 'brand', 'error', 'success', 'warning'];
  for (const textToken of textTokens) {
    for (const surfaceToken of ['primary', 'secondary'] as const) {
      push(
        `text.${textToken} on surface.${surfaceToken}`,
        color.text[textToken as keyof typeof color.text],
        color.surface[surfaceToken],
        AA_TEXT,
      );
    }
  }
  for (const textToken of ['primary', 'secondary', 'brand'] as const) {
    push(
      `text.${textToken} on surface.tertiary`,
      color.text[textToken],
      color.surface.tertiary,
      AA_TEXT,
    );
  }
  push('text.inverse on surface.inverse', color.text.inverse, color.surface.inverse, AA_TEXT);

  // Texte d'état sur son fond de feedback (semi-transparent en mode sombre).
  for (const [textToken, bgToken] of [
    ['error', 'errorBg'],
    ['success', 'successBg'],
    ['warning', 'warningBg'],
  ] as const) {
    push(
      `text.${textToken} on feedback.${bgToken}`,
      color.text[textToken],
      flatten(color.feedback[bgToken], color.surface.primary),
      AA_TEXT,
    );
  }

  // ── 2. Libellé sur remplissage ──────────────────────────────────────────
  // L'accent teal est trop lumineux pour du blanc : il porte `text.onAccent`.
  //
  // `hover` n'existe pas en React Native ; il est testé quand même pour que la
  // valeur ne devienne pas un piège si un jour le web entre dans le périmètre.
  // `pressed` est bien rendu (6 sites l'utilisent).
  //
  // `disabled` porte `text.tertiary`, pas `text.onBrand` : le libellé encre du
  // mode sombre disparaissait sur le gris désactivé (1,63:1, cf. J-021). Seuil
  // 3:1 — WCAG exempte les contrôles inactifs, mais un libellé doit rester
  // perceptible.
  for (const state of ['default', 'hover', 'pressed'] as const) {
    for (const fill of ['brand', 'danger'] as const) {
      push(
        `text.onBrand on interactive.${fill}.${state}`,
        color.text.onBrand,
        color.interactive[fill][state],
        AA_TEXT,
      );
    }
    push(
      `text.onAccent on interactive.accent.${state}`,
      color.text.onAccent,
      color.interactive.accent[state],
      AA_TEXT,
    );
  }

  for (const fill of ['brand', 'accent', 'danger'] as const) {
    push(
      `text.tertiary on interactive.${fill}.disabled`,
      color.text.tertiary,
      color.interactive[fill].disabled,
      AA_UI,
    );
  }

  // ── 3. Remplissage contre surface (frontière du composant) ──────────────
  // `accent` est hors périmètre, et c'est une exclusion raisonnée, pas un angle
  // mort : WCAG 1.4.11 vise « l'information visuelle nécessaire pour identifier
  // un composant d'interface ». Les deux seuls remplissages accent de l'app n'en
  // sont pas — le badge « invité » de ProfileScreen n'est pas interactif et son
  // texte porte l'information (7,87:1), et les marqueurs de participants des
  // cartes sont cernés d'un anneau `surface.primary` dont la frontière se juge
  // contre les tuiles, pas contre la surface de l'app. Assombrir le teal jusqu'à
  // 3:1 sur blanc (accent[700]) reviendrait à renoncer au teal de la charte.
  // Si un jour un BOUTON accent apparaît, il faudra le rajouter ici.
  for (const fill of ['brand', 'danger'] as const) {
    for (const surfaceToken of ['primary', 'secondary', 'tertiary'] as const) {
      push(
        `interactive.${fill}.default against surface.${surfaceToken}`,
        color.interactive[fill].default,
        color.surface[surfaceToken],
        AA_UI,
      );
    }
  }

  // ── 4. Indicateurs porteurs de sens ─────────────────────────────────────
  push('border.focus on surface.primary', color.border.focus, color.surface.primary, AA_UI);
  push('border.error on surface.primary', color.border.error, color.surface.primary, AA_UI);

  // ── 5. Avant-plan sur les tuiles de carte ───────────────────────────────
  // Les tuiles ne suivent pas le thème : elles restent claires en mode sombre.
  // Un token calé sur les surfaces de l'app y est donc invalide, et c'est ce
  // rôle manquant qui a rendu le cercle de rayon invisible (1,73:1, cf. J-021).
  // Map tiles stay light in dark mode, so theme-relative tokens are invalid.
  for (const [tileLabel, tile] of Object.entries(MAP_TILES)) {
    push(`map.stroke on ${tileLabel} tile`, color.map.stroke, tile, AA_UI);
  }

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

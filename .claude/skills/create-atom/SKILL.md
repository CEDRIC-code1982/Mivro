---
name: create-atom
description: Pattern pour créer un atom Mivro (plus petit composant UI réutilisable, sans logique métier) — props typées, tokens theme, accessibilité, tests, barrel index. À utiliser pour Button, Input, IconButton, Card, Spinner, etc.
---

# Skill : create-atom

Crée un atom (Atomic Design — niveau le plus bas, aucune logique métier ni appel réseau).
**Règles** : voir `CLAUDE.md` (DS-001..004, A11Y-001..006, TS-001, I18N-001, DOC-001).

## Structure

```
src/presentation/components/atoms/<Nom>/
├── <Nom>.tsx        # composant
├── <Nom>.test.tsx   # tests RTL
└── index.ts         # barrel : export * from './<Nom>'
```

Puis ajouter l'export dans `src/presentation/components/atoms/index.ts`.

## Règles atom

- **Props** typées explicitement (interface `<Nom>Props`), zéro `any`. Étendre les props RN natives si pertinent (`...rest`).
- **Styles** via `StyleSheet.create()` + tokens du theme (DS-001/002) — aucun magic number, aucun style inline. Dark mode via tokens (DS-003).
- **A11y** : `accessibilityRole`, `accessibilityLabel` (props), touch target ≥ 44pt/48dp (A11Y-002) pour les éléments interactifs. Dynamic Type respecté (A11Y-004).
- **Pas de string hardcodée** : le texte vient des props (le parent gère i18n).
- **TSDoc** sur le composant + props publiques.

## Tests (RTL)

- Rendu par défaut + variantes de props.
- Comportement interactif (onPress…) si applicable.
- Présence des attributs d'accessibilité.

## Done

- `npm run check` vert. Atom exporté dans le barrel. Réutilisable sans dépendance métier.

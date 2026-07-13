---
name: create-molecule
description: Pattern pour créer une molecule Mivro (composition d'atoms avec éventuellement une logique d'affichage locale ou un hook) — composition, hook si logique, a11y, tests, barrel index. À utiliser pour les cartes, listes, sheets, en-têtes, etc.
---

# Skill : create-molecule

Crée une molecule (Atomic Design — composition d'atoms ; peut porter une logique de présentation locale, jamais de logique métier core).
**Règles** : voir `CLAUDE.md` (DS-001..004, A11Y-\*, ERR-003, TS-001, I18N-001, DOC-001).

## Structure

```
src/components/molecules/<Nom>/
├── <Nom>.tsx           # composition d'atoms
├── <Nom>.test.tsx      # tests RTL
├── (sous-composants)   # ex AddressResultItem.tsx
└── index.ts            # barrel
```

## Règles molecule

- **Composer** des atoms existants (`Text`, `Screen`, `CategoryChip`…) plutôt que réécrire du primitif. Créer l'atom manquant via `create-atom` si besoin.
- **Logique** : si non triviale (data fetching, état), l'extraire dans un hook `src/hooks/use<Nom>.ts` (TanStack Query pour l'async). Le composant reste lisible.
- **États complets** : loading + error + empty (ERR-003) quand la molecule affiche des données async (ex : `EmptyState`).
- **i18n** : tout texte via `useTranslation()` (I18N-001) — namespace du domaine.
- **Styles** : tokens theme uniquement (DS-001/002), dark mode (DS-003).
- **A11y** : labels/roles/hints (A11Y-003), Dynamic Type (A11Y-004) ; pour la carte, prévoir l'alternative texte (A11Y-006).

## Tests (RTL)

- Rendu avec données, état vide, état erreur/chargement.
- Interactions (sélection, toggle, ouverture sheet…).
- Accessibilité.

## Done

- `npm run check` vert. Molecule exportée + intégrée à l'écran cible.

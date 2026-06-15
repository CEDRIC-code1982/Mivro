---
name: add-i18n
description: Procédure pour ajouter ou compléter un namespace i18n Mivro en FR + EN et le câbler dans la config i18next. À utiliser dès qu'une feature introduit du texte affiché à l'utilisateur (règle I18N-001 zéro string hardcodée).
---

# Skill : add-i18n

Ajoute/complète les traductions. **Règle bloquante** : I18N-001 (zéro string hardcodée) + I18N-002 (signaler toute string hardcodée détectée). Voir `CLAUDE.md`.

## Structure existante

```
src/i18n/
├── index.ts                       # config i18next + react-i18next + react-native-localize
└── locales/
    ├── fr/<namespace>.json
    └── en/<namespace>.json
```

Namespaces actuels : `common`, `create`, `map`, `navigation`, `poi`, `profile`, `sessions`.

## Procédure

1. **Choisir le namespace** : réutiliser un namespace de domaine existant si pertinent, sinon en créer un (`<feature>.json`).
2. **Créer/éditer les 2 fichiers** `locales/fr/<ns>.json` ET `locales/en/<ns>.json` — **mêmes clés des deux côtés** (structure miroir, pas de clé orpheline).
3. **Câbler** le namespace dans `src/i18n/index.ts` (ajout aux `resources` + liste des `ns` si nécessaire).
4. **Utiliser** côté composant : `const { t } = useTranslation('<ns>')` puis `t('cle')`. Jamais de texte en dur.
5. **Interpolation/pluriel** : utiliser les fonctionnalités i18next (`{{var}}`, `_one`/`_other`) plutôt que de concaténer.

## Vérifications

- Clés FR et EN strictement alignées (même arborescence).
- Aucune string UI hardcodée restante (chercher les littéraux dans le JSX).
- `npm run check` vert.

## Done

- Namespace dispo en FR + EN, câblé, utilisé via `useTranslation`. Pas de clé manquante.

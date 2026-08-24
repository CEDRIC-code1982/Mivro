# CLAUDE.md — Mivro

<!-- v9.0 (2026-08-21, harness) : les règles vérifiables par un outil ont quitté ce fichier ;
     le reste est dans docs/context/POLICIES.md. Ne pas rallonger sans ADR. -->

Mivro (ex-MidPoint, cf. ADR-011) — React Native 0.85 + TypeScript strict, New Architecture ON.
Phase 1 : MVP iOS + Android. Archi **feature-first + `services/`** (ports/adapters).

**Jamais de dev sur `main`** (protégée) : le travail va sur `develop` ou une branche issue de
`develop`. Repo `CEDRIC-code1982/Mivro`. ADR-001→014 complets dans `docs-site/docs/adr/`.

**À lire en début de session** : `docs/context/ARCHITECTURE.md` (le code réel) ·
`PROGRESS.md` (historique) · `TODO.md` (reste à faire) · `RUNBOOK.md` (actions Cédric) ·
`POLICIES.md` (storage, state, observabilité, temps réel, RGPD, ADR, roadmap macro).

## Ce que le harness vérifie déjà — ne le redécris pas ici

`npm run check` = typecheck + lint + format + `check:arch` + `check:diff` + tests. Bloquent seuls :
`any`, cast ou `!` sans justification, string hardcodée, format de log, magic number ou couleur
littérale, style inline, TSDoc publique, props a11y, frontières de couches, Atomic Design, coverage,
contraste WCAG, build de la doc (`npm run docs`, joué au pre-push). Un hook rejoue typecheck +
archi + lint à chaque édition, un autre bloque les commandes destructrices.
Détail : `docs/harness/INVENTAIRE.md` · self-test : `npm run check:harness`.

## Règles qu'aucun outil ne vérifie — c'est toi qui juges

- **TS-004** Donnée venant de l'extérieur → schéma Zod, jamais de confiance aveugle.
- **ERR-001** try/catch sur tout appel réseau et I/O.
- **ERR-002** ErrorBoundary sur les écrans critiques.
- **ERR-003** Zéro happy path incomplet : loading + error + empty à chaque fois.
- **I18N-002** String affichée → `useTranslation()`, **y compris en prop** (le lint ne voit que le JSX brut).
- **DOC-003** Décision d'architecture → ADR dans `docs-site/docs/adr/` (format : POLICIES.md).
- **A11Y-002** Touch target ≥ 44pt iOS / 48dp Android.
- **A11Y-003** `accessibilityHint` quand le libellé seul ne suffit pas (46 manques connus).
- **A11Y-004** Dynamic Type testé à 200 %.
- **A11Y-005** `AccessibilityInfo.isReduceMotionEnabled()` respecté.
- **A11Y-006** Vue alternative texte pour la carte temps réel.
- **DS-003** Dark mode via `useColorScheme()` + tokens light/dark, pas de couleur en dur.

## Mode de travail

- Feature de bout en bout sans demander : entité → port → usecase → adapter → hook → UI → i18n → DI → tests → docs.
- **Avant de commencer** : remplir `docs/harness/DONE-CONTRACT.md`. Pas de condition de fin écrite = tâche pas commencée.
- **Après dev + tests** : lancer le subagent `reviewer`. Il bloque, tu corriges, tu relances.
- Échec de build/test : 2 tentatives de fix auto, puis tu signales.
- Défaut passé à travers le harness → entrée dans `docs/harness/JOURNAL-ECHECS.md` **et** la règle qui l'aurait attrapé.
- Spec manquante → TODO « ⚠️ À SPÉCIFIER AVEC CÉDRIC », jamais d'invention. Spec incohérente → tu la signales.

**PAUSE** uniquement si : décision produit/archi ambiguë · secret, compte ou fichier externe hors de
ta portée (Firebase, Apple/Google dev, clé prod) · doute sur une convention Claude Code (doc Anthropic d'abord).

## Commandes

`npm start` · `run ios`/`android` · **`run check` avant tout commit** · `lint:fix` · `format` ·
`test`/`test:ci`/`test:coverage`/`test:unit`/`test:integration` · `check:arch`/`check:diff`/`check:harness`.
⚠️ `pods`, `ios-clean`, `android-clean`, `clear` sont bloqués par le hook : c'est Cédric qui les lance.

## Fin de feature

`npm run check` vert → reviewer APPROVED → mise à jour de `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`
(+ ADR si décision) → commit. Ces mises à jour font partie du commit de la feature.

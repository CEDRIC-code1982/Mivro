# CLAUDE.md — Mivro

<!-- v10 (2026-09-26) : vérifiable → harness (ADR-016), le reste → POLICIES.md. Ne pas rallonger sans ADR. -->

Mivro (ex-MidPoint, cf. ADR-011) — React Native 0.85 + TypeScript strict, New Architecture ON.
Phase 1 : MVP iOS + Android. Archi **feature-first + `services/`** (ports/adapters).

**Jamais de dev sur `main`** : branche issue de `develop`, merge par PR (checks CI requis). Repo
`CEDRIC-code1982/Mivro`. ADR-001→016 dans `docs-site/docs/adr/`.

**À lire en début de session** : `docs/context/ARCHITECTURE.md` (le code réel) · `PROGRESS.md` ·
`TODO.md` · `RUNBOOK.md` (actions Cédric) · `POLICIES.md` (storage, state, RGPD, ADR, roadmap).

## Ce que le harness vérifie déjà — ne le redécris pas ici

Une table (`scripts/sensors.sh`) pour `npm run check`, le Stop, le pre-push et la CI. Bloquent seuls :
`any` partout, cast ou `!` sans vraie justification, directives de suppression, tests focalisés ou
sautés, secrets, string hardcodée, logs, magic numbers, couleurs, styles inline, TSDoc, a11y,
couches, Atomic Design, coverage, WCAG, identité native, dépendance hors liste, doc (au push).
Pas de fin de tour sur un arbre rouge (hook Stop), pas de commit sans verdict `reviewer` scellé.
**Le harness est hors de ta portée** (ADR-016) : un capteur faux se signale à Cédric, il ne se
contourne pas. Détail : `docs/harness/INVENTAIRE.md` · self-test : `npm run check:harness`.

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
- Échec de build/test : 2 tentatives de fix auto, puis tu signales.
- Défaut passé à travers le harness → entrée dans `docs/harness/JOURNAL-ECHECS.md` **et** la règle qui l'aurait attrapé, que Cédric applique.
- Spec manquante → TODO « ⚠️ À SPÉCIFIER AVEC CÉDRIC », jamais d'invention. Spec incohérente → tu la signales.

**PAUSE** uniquement si : décision produit/archi ambiguë · secret, compte ou fichier externe hors de
ta portée (Firebase, Apple/Google dev, clé prod) · doute sur une convention Claude Code (doc Anthropic d'abord).

## Commandes

`npm start` · `run ios`/`android` · **`run check` avant tout commit** · `check:fast` · `lint:fix` ·
`format` · `test`/`test:ci`/`test:coverage` · `check -- --only <id>` · `check:harness`.
⚠️ `pods`, `ios-clean`, `android-clean`, `clear`, `harness:relock` : c'est Cédric qui les lance.

## Fin de feature

`npm run check` vert → docs à jour (`PROGRESS`, `TODO`, `ARCHITECTURE`, ADR si décision) → reviewer
APPROVED sur l'arbre final → commit de **tout** l'arbre relu (`git add -A`), sur demande de Cédric.

# INVENTAIRE — Harness d'agent Mivro

> Phase 0 du chantier harness. **Constat pur, aucune modification de code.**
> Date : 2026-08-21 · Branche : `main` · HEAD : `de6b15c`
>
> ⚠️ **Les sections 1 à 9 sont un instantané daté, conservé tel quel.** Plusieurs constats ont
> depuis été corrigés : DOC-004 est outillée, le thème passe WCAG AA, les scripts morts sont
> réparés. **Les sections 10 et 11 donnent l’état courant** — c'est elle qu'il faut lire pour savoir où vit
> une règle aujourd'hui.
>
> Ce document a par ailleurs été écrit depuis `main`, alors 6 commits en retard sur
> `origin/develop` (voir J-012 dans `JOURNAL-ECHECS.md`).

---

## 1. `package.json`

- **Gestionnaire de paquets** : **npm** (`package-lock.json` v3 présent, pas de `yarn.lock` / `pnpm-lock.yaml`).
- **Runner de test** : **Jest 29** (`preset: @react-native/jest-preset`), RNTL 13 + `jest-mock-extended`.
- **Node** : `^20.19.4 || ^22.13.0 || ^24.3.0 || >= 25.0.0`.

### Scripts existants

| Script                                           | Commande                                       | État                                                                                            |
| ------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `android` / `ios` / `start`                      | `react-native …`                               | OK                                                                                              |
| `ios-release` / `android-release`                | builds release                                 | OK                                                                                              |
| `test`                                           | `jest --watch`                                 | OK                                                                                              |
| `test:ci`                                        | `jest --ci`                                    | OK                                                                                              |
| `test:coverage`                                  | `jest --coverage`                              | OK                                                                                              |
| `test:unit`                                      | `jest src/__tests__/unit`                      | ❌ **CASSÉ** — `src/__tests__/` n'existe plus depuis le refactor tests co-localisés (`de6b15c`) |
| `test:integration`                               | `jest src/__tests__/integration`               | ❌ **CASSÉ** — idem                                                                             |
| `lint` / `lint:fix`                              | `eslint . --ext .ts,.tsx`                      | OK                                                                                              |
| `format` / `format:check`                        | `prettier`                                     | OK                                                                                              |
| `typecheck`                                      | `tsc --noEmit`                                 | OK                                                                                              |
| `check`                                          | `typecheck && lint && format:check && test:ci` | OK                                                                                              |
| `prepare`                                        | `husky`                                        | OK                                                                                              |
| `pods` / `android-clean` / `ios-clean` / `clear` | nettoyages natifs                              | OK (destructifs)                                                                                |

### Scripts référencés par `CLAUDE.md` mais **absents**

- `npm run docs` (TypeDoc), `npm run docs:dev`, `npm run docs:build` → **inexistants**.
- `npm run test:e2e` (Maestro) → **inexistant**, et `e2e/` est **vide**.
- `docs-site/` ne contient qu'un dossier `docs/` : **pas de `package.json` Docusaurus**, pas de TypeDoc installé.
  → **La règle DOC-004 n'est aujourd'hui pas exécutable.**

### Outillage qualité installé

`eslint@8` (config legacy `.eslintrc.js`), `prettier@2.8.8`, `husky@9`, `lint-staged@16`,
`eslint-plugin-import`, `eslint-import-resolver-babel-module`, `@react-native/eslint-config`.
**Absents** : `dependency-cruiser`, `eslint-plugin-boundaries`, `@typescript-eslint/*` en direct
(fournis transitivement par `@react-native/eslint-config`), `eslint-plugin-jsdoc`, plugin a11y.

---

## 2. `tsconfig.json`

Étend `@react-native/typescript-config` (qui porte déjà `strict: true`).

### Flags stricts déjà actifs

`strict` (héritée) · `noImplicitAny` · `noUncheckedIndexedAccess` · `exactOptionalPropertyTypes` ·
`noImplicitReturns` · `noFallthroughCasesInSwitch` · `noUnusedLocals` · `noUnusedParameters` ·
`forceConsistentCasingInFileNames` · `skipLibCheck: true` (justifié : `react-native-maps` incompatible
avec `exactOptionalPropertyTypes`).

Tous les flags exigés par `CLAUDE.md > TYPESCRIPT` sont présents. **Rien à ajouter.**

### Path aliases (`paths`)

`@/*` → `src/*`, puis `@features`, `@services`, `@components`, `@state`, `@entities`, `@theme`,
`@hooks`, `@navigations`, `@test-utils` (forme nue + `/*` pour chacun),
plus un shim `react-native-maps` → `src/types/react-native-maps.d.ts`.

Les alias sont **triplement déclarés** et cohérents : `tsconfig.json` (`paths`),
`babel.config.js` (`module-resolver`), `jest.config.js` (`moduleNameMapper`).
⚠️ Toute règle d'architecture doit résoudre ces alias (→ `dependency-cruiser` doit lire `tsconfig`,
ESLint utilise déjà le resolver `babel-module`).

---

## 3. Config ESLint (`.eslintrc.js`, legacy eslintrc)

`extends: ['@react-native', 'plugin:import/typescript', 'prettier']` · `plugins: ['import']`

### Règles déjà en place

| Règle                                             | Niveau     | Règle CLAUDE.md couverte                               |
| ------------------------------------------------- | ---------- | ------------------------------------------------------ |
| `@typescript-eslint/no-explicit-any`              | `error`    | TS-001                                                 |
| `@typescript-eslint/no-non-null-assertion`        | `error`    | TS-003 (sans l'exception « commentaire justificatif ») |
| `@typescript-eslint/no-unused-vars` (`^_` ignoré) | `error`    | —                                                      |
| `react-native/no-inline-styles`                   | `error`    | DS-002                                                 |
| `react-native/no-raw-text`                        | **`warn`** | I18N-001 (partiel, et non bloquant)                    |
| `import/order` (10 pathGroups, alphabétisé)       | `error`    | —                                                      |

### Trous constatés

- **Aucune** règle de frontière de couches (`import/no-restricted-paths` absent).
- `react-native/no-raw-text` en `warn` → I18N-001 n'est **pas** bloquante.
- Pas de linting **type-aware** (`parserOptions.project` non défini) → `no-floating-promises`,
  `no-misused-promises` indisponibles en l'état.
- Pas de règle sur les casts (`TS-002`), les magic numbers (`DS-001`), la TSDoc (`DOC-001/002`),
  les color literals (`DS-003`), l'a11y (`A11Y-003`).

---

## 4. Arborescence réelle de `src/` (3 niveaux) — **noms de couches constatés**

```
src/
├── App.tsx                      (+ App.test.tsx)
├── components/                  59 fichiers .ts(x)
│   ├── atoms/                   Avatar · CategoryChip · Screen · TabBarIcon · Text
│   ├── molecules/               AddressAutocomplete · AvatarPicker · BiometricLockScreen ·
│   │                            EmptyState · LiveParticipantsList · POICard · POIDetailSheet ·
│   │                            POIListView · POIMapView · POIScreenHeader · ParticipantCard ·
│   │                            RealtimeConsentModal · SessionMapView
│   ├── organisms/               (vide)
│   └── templates/               AppErrorBoundary
├── entities/                    19 fichiers — modèles Zod plats (pas de sous-dossier)
│                                Avatar · GeocodeResult · Location · MidpointSession · POICategory ·
│                                PointOfInterest · RealtimeParticipant · SharedSession · User · index
├── features/                    31 fichiers
│   ├── Biometric/hooks/
│   ├── POI/{hooks,screens,utils}/
│   ├── Profile/{hooks,screens}/
│   ├── Session/{hooks,screens}/
│   └── Sharing/{hooks,screens}/
├── hooks/                       useCrashReporter · useDebounce
├── i18n/                        index.ts + locales/{fr,en}/
├── navigations/                 BottomTabsNavigator · RootNavigator · linking · types
├── services/                    70 fichiers
│   ├── domain/                  biometric · crash · geocode · geolocation · midpoint · poi ·
│   │                            realtime · sharing · storage · user   (ports `I*` + `*UseCase`)
│   ├── infra/                   analytics(vide) · crash · eta(vide) · geocode · geolocation ·
│   │                            media · poi · realtime · security · storage
│   ├── utils/                   format/ · geo/
│   ├── serviceContainer.ts      ← SEUL fichier connaissant les implémentations
│   └── queryClient.ts
├── state/                       useAuthStore · usePreferencesStore · useRealtimeStore ·
│                                useSessionStore · useSharedSessionStore  (Zustand)
├── test-utils/                  coordinates · queryClientWrapper (hors coverage)
├── theme/                       index · tokens · useTheme
└── types/                       react-native-config.d.ts · react-native-maps.d.ts
```

**Tests** : co-localisés (`X.test.ts(x)` à côté de `X.ts(x)`), intégration en `*.integration.test.tsx`.
Aucun dossier `__tests__/`. `e2e/` existe mais est vide.

### Frontières de couches — **exploitables** ✅

Vérification par grep sur le code de production (hors `*.test.*`) :

| Contrainte                                                              | Violations actuelles               |
| ----------------------------------------------------------------------- | ---------------------------------- |
| `services/domain` n'importe pas `react-native` / `react` / lib UI       | **0**                              |
| `services/domain` n'importe pas `services/infra`                        | **0**                              |
| `features` / `components` / `state` n'importent pas `services/infra`    | **0**                              |
| Aucun écran (`features/**/screens/**.tsx`) n'importe `serviceContainer` | **0** (accès via hooks uniquement) |
| `entities` et `services/utils` n'importent pas `react-native`           | **0**                              |

**Conclusion : l'architecture est nette et déjà conforme → pas de STOP.** Les capteurs de Phase 1
peuvent être introduits en mode bloquant d'emblée, sans dette à absorber.

Nommage retenu pour les règles (noms **réels**, pas de convention supposée) :
`domain` = `src/services/domain` · `infra` = `src/services/infra` · `ui` = `src/features` +
`src/components` + `src/navigations` · `state` = `src/state` · `screens` =
`src/features/*/screens/**` · transverses = `src/entities`, `src/theme`.

---

## 5. `CLAUDE.md` actuel — classement des règles

**614 lignes.** Cible Phase 2 : **< 60 lignes**.

### [MÉCANISABLE] — devient un capteur computationnel, sort de `CLAUDE.md`

| Règle                                    | Énoncé                                                           | Mécanisme                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **TS-001**                               | `any` interdit                                                   | ESLint `@typescript-eslint/no-explicit-any` (**déjà en place**) + `check-diff.sh`                                   |
| **TS-002**                               | Cast `as T` interdit sauf commentaire justificatif               | Règle ESLint **custom** (`TSAsExpression` sans commentaire adjacent)                                                |
| **TS-003**                               | `!` interdit sauf commentaire justificatif                       | Règle ESLint **custom** (idem, remplace le `error` sec actuel)                                                      |
| **I18N-001**                             | Zéro string hardcodée                                            | `react-native/no-raw-text` promu **`error`**                                                                        |
| **LOG-001**                              | Format `[LEVEL][File][fn][line][HH:mm:ss]`                       | Règle ESLint **custom** sur le 1ᵉʳ argument de `console.*`                                                          |
| **DS-001**                               | Aucun magic number, tout via tokens                              | Règle ESLint **custom** (littéraux numériques/couleurs dans `StyleSheet.create`) + `react-native/no-color-literals` |
| **DS-002**                               | `StyleSheet.create()`, pas de style inline                       | `react-native/no-inline-styles` (**déjà en place**)                                                                 |
| **DS-004**                               | Atomic Design strict (atoms → molecules → organisms → templates) | `dependency-cruiser` + `eslint-plugin-boundaries`                                                                   |
| **Règle de dépendance** (§ ARCHITECTURE) | `ui/state → services`, `domain` isolé, pas d'adapter hors DI     | `dependency-cruiser` (`npm run check:arch`)                                                                         |
| **FMT-001**                              | `npm run check` vert                                             | Hook pre-push                                                                                                       |
| **DOC-001/002**                          | TSDoc + `@param`/`@returns`/`@throws` sur API publique           | `eslint-plugin-jsdoc` (`require-jsdoc`, `require-param`, `require-returns`)                                         |
| **A11Y-001**                             | Contraste WCAG AA                                                | Test unitaire sur `theme/tokens.ts` (calcul du ratio)                                                               |
| **A11Y-003**                             | `accessibilityLabel` + `Role` + `Hint`                           | Règle ESLint (plugin a11y RN) — couverture partielle assumée                                                        |

### [NON-MÉCANISABLE] — jugement sémantique, contexte, ou device requis

| Règle        | Énoncé                                               | Pourquoi non mécanisable                                                                                 |
| ------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **TS-004**   | Données externes → Zod obligatoire                   | « externe » est une notion sémantique                                                                    |
| **I18N-002** | Signaler 💡 une string hardcodée                     | Instruction comportementale — redondante dès que I18N-001 est `error`                                    |
| **ERR-001**  | try/catch sur tous les appels réseau/IO              | Nécessiterait du lint type-aware ; approximable, pas décidable                                           |
| **ERR-002**  | ErrorBoundary sur les écrans **critiques**           | « critique » = jugement produit                                                                          |
| **ERR-003**  | Zéro happy path incomplet (loading + error + empty)  | Jugement sur l'UI rendue                                                                                 |
| **DOC-003**  | Décision d'architecture → ADR                        | Détecter « une décision a été prise »                                                                    |
| **DOC-004**  | `npm run docs` sans erreur                           | Mécanisable **en principe**, mais **Docusaurus/TypeDoc ne sont pas installés** → règle morte aujourd'hui |
| **A11Y-002** | Touch target ≥ 44pt / 48dp                           | Dépend du layout au runtime                                                                              |
| **A11Y-004** | Dynamic Type à 200 %                                 | Test device                                                                                              |
| **A11Y-005** | `isReduceMotionEnabled()` respecté                   | Test device + jugement                                                                                   |
| **A11Y-006** | Vue alternative texte pour la carte                  | Jugement produit                                                                                         |
| **DS-003**   | Dark mode via `useColorScheme()` + tokens light/dark | Partiellement approximable, décision finale = jugement                                                   |

Ces 13 règles alimentent le **capteur inférentiel** (subagent `reviewer`, Phase 3) — elles ne
seront **pas** supprimées sans arbitrage explicite.

---

## 6. Hooks Claude Code déjà configurés dans `.claude/`

**Aucun hook.** Il n'existe ni `.claude/settings.json` ni `.claude/settings.local.json`.

Contenu actuel de `.claude/` :

```
.claude/
├── agents/     mivro-dev.md · mivro-docs.md · mivro-reviewer.md · mivro-tester.md
├── commands/   feature.md · fix.md · progress.md · qa.md · team.md
└── skills/     add-i18n · create-atom · create-feature · create-molecule · external-service
```

Il existe donc déjà un **capteur inférentiel partiel** (`mivro-reviewer`), mais :

- il n'a **pas** de critères de blocage explicites adossés à un contrat de « terminé » ;
- il n'existe **aucun** `docs/harness/DONE-CONTRACT.md` ni `JOURNAL-ECHECS.md`.

### Hooks git existants

`husky@9` installé. **Un seul** hook projet : `.husky/pre-commit` → `npx lint-staged`
(`*.{ts,tsx}` : `eslint --fix` + `prettier --write` ; `*.{json,md}` : `prettier --write`).
**Pas de `pre-push`.** Les tests ne tournent donc jamais automatiquement en local.

---

## 7. Mesures de performance (budget hooks ≈ 3 s)

| Commande                                               | Durée      |
| ------------------------------------------------------ | ---------- |
| `tsc --noEmit` (froid, sans cache)                     | **3,55 s** |
| `tsc --noEmit --incremental` (1ᵉʳ run, écrit le cache) | 2,75 s     |
| `tsc --noEmit --incremental` (**à chaud**)             | **1,43 s** |
| `eslint <un fichier>`                                  | **1,70 s** |
| `eslint . --ext .ts,.tsx` (projet entier)              | 3,61 s     |

→ Le hook `PostToolUse` doit impérativement utiliser **`tsc --incremental` avec un `tsBuildInfoFile`
persistant** (hors dépôt) : `1,43 s + 1,70 s ≈ 3,1 s`, dans le budget. Sans `--incremental`,
le budget explose (≈ 5,3 s).

---

## 8. Divergences `CLAUDE.md` ↔ réalité (à corriger / arbitrer)

1. `test:unit` et `test:integration` pointent sur `src/__tests__/…` **supprimé** → scripts morts.
2. `npm run docs`, `docs:dev`, `docs:build`, `test:e2e` **documentés mais inexistants** ;
   `docs-site/` sans `package.json`, `e2e/` vide → **DOC-004 et la section E2E sont fictives**.
3. `CLAUDE.md` situe les adapters dans `src/infrastructure/…` (sections F4/F5/F8, PostHog) alors que
   le refactor `de6b15c` les a déplacés dans `src/services/infra/…` → références obsolètes.
4. `CLAUDE.md > STATE MANAGEMENT` dit « QueryClient configuré dans `di/container.ts` » →
   c'est `src/services/queryClient.ts` + `src/services/serviceContainer.ts`.
5. **LOG-001 appliqué à la main** : 129 appels `console.*` en code de production, préfixe recomposé
   localement à chaque fois, et le champ `[line]` vaut littéralement `?` partout.
   → 💡 un helper `logger` centralisé rendrait la règle triviale à tenir (proposition hors Phase 0).
6. Atoms `Button` / `Input` / `IconButton` / `Card` / `Spinner` mentionnés dans le README :
   **confirmé inexistants** (déjà signalé dans `CLAUDE.md`).
7. `src/components/organisms/` est **vide** — la chaîne DS-004 n'a donc pas encore de maillon
   `organisms`, la règle reste néanmoins à poser pour l'avenir.

---

## 9. Verdict Phase 0

✅ **Pas de STOP.** Les frontières de couches sont nettes, nommées sans ambiguïté et **déjà
respectées à 100 %** sur le code de production. Les capteurs de Phase 1 peuvent être posés en mode
bloquant immédiatement.

---

## 10. APRÈS MIGRATION — où vit chaque règle (état final)

> Ajouté en fin de chantier. C'est la table que `CLAUDE.md` pointe : pour chaque règle
> historique, le capteur qui l'applique aujourd'hui.

### Mécanisées — plus rien à redire dans `CLAUDE.md`

| Règle                   | Capteur                                                                                                                                                                                                  | Où                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| TS-001                  | `@typescript-eslint/no-explicit-any` + `check-diff`                                                                                                                                                      | `.eslintrc.js`, `check-diff.sh`   |
| TS-002                  | `local-rules/no-unjustified-type-assertion` (règle custom)                                                                                                                                               | `eslint-rules/`                   |
| TS-003                  | `local-rules/no-unjustified-non-null` (règle custom)                                                                                                                                                     | `eslint-rules/`                   |
| I18N-001                | `react-native/no-raw-text` promu `error`                                                                                                                                                                 | `.eslintrc.js`                    |
| LOG-001                 | `local-rules/log-format` (préfixe + niveau + nom de fichier)                                                                                                                                             | `eslint-rules/`                   |
| DS-001                  | `local-rules/no-magic-style-values` + `react-native/no-color-literals`                                                                                                                                   | `eslint-rules/`, `.eslintrc.js`   |
| DS-002                  | `react-native/no-inline-styles`                                                                                                                                                                          | `.eslintrc.js`                    |
| DS-004                  | `atoms-no-upper` · `molecules-no-upper` · `organisms-no-upper`                                                                                                                                           | `.dependency-cruiser.js`          |
| Règle de dépendance     | `domain-no-ui` · `domain-no-infra` · `domain-no-app-layers` · `screens-no-adapter` · `screens-no-network-client` · `ui-no-adapter` · `components-no-di` · `entities-pure` · `utils-pure` · `no-circular` | `.dependency-cruiser.js`          |
| DOC-001 / DOC-002       | `jsdoc/require-jsdoc` · `require-param` · `check-param-names` · `require-returns` · `require-returns-check` · `check-tag-names`                                                                          | `.eslintrc.js`                    |
| A11Y-001                | `src/theme/contrast.test.ts` (cliquet WCAG)                                                                                                                                                              | test unitaire                     |
| DOC-004                 | `npm run docs` — TypeDoc + Docusaurus, liens morts en erreur                                                                                                                                             | 4ᵉ garde du pre-push              |
| A11Y-003 (label + role) | `plugin:react-native-a11y/basic` (10 règles actives)                                                                                                                                                     | `.eslintrc.js`                    |
| FMT-001                 | pre-push + `npm run check`                                                                                                                                                                               | `.husky/pre-push`                 |
| Seuils de coverage      | `coverageThreshold` **réellement appliqué** (`test:ci` = `jest --ci --coverage`)                                                                                                                         | `jest.config.js`, `package.json`  |
| Échappatoires           | `as any`, `: any`, `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `.skip(`, `xit(`                                                                                                                       | `scripts/check-diff.sh`           |
| Commandes destructrices | `rm -rf`, `git push --force`, `git reset --hard`, artefacts natifs                                                                                                                                       | `scripts/hooks/pre-bash-guard.py` |

### Restées dans `CLAUDE.md` — jugement requis

TS-004 · ERR-001 · ERR-002 · ERR-003 · I18N-002 (strings en prop) · DOC-003 · A11Y-002 · A11Y-003 (partie `hint`) · A11Y-004 · A11Y-005 · A11Y-006 · DS-003.

**12 règles, contre 13 au sortir de la phase 2** : DOC-004 est devenue mécanisable une fois
Docusaurus + TypeDoc installés (arbitrage Cédric du 2026-08-24, cf. J-011).

Toutes reprises comme grille explicite du subagent `reviewer` (`.claude/agents/reviewer.md`).

### Déplacées, pas supprimées

`docs/context/POLICIES.md` : storage, state management, observabilité, temps réel + optimisations
batterie, RGPD, format ADR, roadmap macro, format des propositions d'amélioration, et la roadmap
détaillée par feature (archive de `CLAUDE.md` v8.9).

### Résultat

| Mesure                              | Avant  | Après                    |
| ----------------------------------- | ------ | ------------------------ |
| `CLAUDE.md`                         | 614 l. | **60 l.**                |
| Règles bloquantes énoncées en prose | 24     | 12 (jugement uniquement) |
| Règles vérifiées automatiquement    | 5      | 17 familles              |
| Tests                               | 1133   | 1178                     |
| Assertions du self-test harness     | 0      | 61                       |
| Paires de contraste vérifiées       | 0      | 44 (0 dette)             |

Commandes : `npm run check` (barrière unique) · `npm run check:arch` · `npm run check:diff` ·
`npm run check:harness` (prouve que les capteurs mordent encore) · `npm run docs` (TypeDoc +
Docusaurus) · `npm run docs:dev`.

⚠️ Le pre-push a besoin des dépendances de `docs-site/` : `npm --prefix docs-site install`
après un clone.

---

## 11. HARNESS v2 (2026-09-26) — état courant

> Suite à l'audit red-team du 2026-09-26 (JOURNAL J-026 à J-035) et à la comparaison avec le
> harness de P0114 SmartBLE. Décision d'ensemble : **ADR-016**. Changements encore à appliquer en
> session déverrouillée : `EN-ATTENTE.md`.

### Quatre couches, chacune suppose que la précédente peut tomber

> État au 2026-09-28, **après** application des correctifs J-036 à J-041. La dernière colonne dit ce
> qui passe encore : c'est la limite de conception, pas un trou connu.

| Couche                   | Mécanisme                                                                                                                                                         | Contournable par                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1. Refus à la source     | `pre-bash-guard.py`, `pre-edit-guard.py` (PreToolUse) ; permissions `ask`/`deny` du projet                                                                        | un script écrit dans `/tmp` puis exécuté, ou une forme que le garde ne modélise pas : c'est une liste noire (J-042) |
| 2. Détection             | `harness.lock` (capteur `lock`, stage `fast`) ; hook `PostToolUse` à chaque édition ; `check-diff` (configs imbriquées)                                           | un relock, qui exige Cédric dans son terminal                                                                       |
| 3. Obligation de process | hooks `Stop` / `SubagentStop` ; verdict lu dans le dernier message du reviewer (`SubagentStop`), effacé à chaque `SubagentStart` ; `review-gate.sh` au pre-commit | un commit fait dans un clone sans hooks, puis importé (script `/tmp`)                                               |
| 4. Serveur               | `check.yml` (`battery`, `security`) + `harness-guard.yml` (`pull_request_target`, code de la base) + protection de `main`/`develop`                               | un token GitHub admin (voir RUNBOOK)                                                                                |

### La table des capteurs — `scripts/sensors.sh`

`npm run check -- --list` (stage `check`) ou `bash scripts/check.sh --stage push --list`.

| id          | stage | Rôle                                                                               |
| ----------- | ----- | ---------------------------------------------------------------------------------- |
| `typecheck` | fast  | `tsc --noEmit` incrémental                                                         |
| `lint`      | fast  | ESLint `.ts/.tsx/.js/.mjs/.cjs`, **zéro warning**, cache indexé sur les règles     |
| `format`    | fast  | Prettier                                                                           |
| `arch`      | fast  | dependency-cruiser                                                                 |
| `diff`      | fast  | `check-diff.sh` : échappatoires, `any` en toute position, tests focalisés, secrets |
| `lock`      | fast  | intégrité du harness                                                               |
| `native`    | fast  | team Apple, bundle id, deployment target, plist Firebase, scheme Debug             |
| `deps`      | fast  | liste blanche des dépendances npm                                                  |
| `docrefs`   | fast  | numérotation du journal, citations `J-NNN` résolues                                |
| `scripts`   | fast  | shellcheck + syntaxe Python du harness (peut s'abstenir sans shellcheck)           |
| `tests`     | check | Jest + seuils de couverture                                                        |
| `audit`     | push  | `npm audit --omit=dev --audit-level=high` (peut s'abstenir hors ligne)             |
| `docs`      | push  | TypeDoc + Docusaurus (peut s'abstenir sans `docs-site/node_modules`)               |

Une abstention (exit 3) est nommée et n'est jamais comptée verte ; en CI (`MIVRO_NO_ABSTAIN=1`)
elle échoue.

### Mesures (2026-09-26, MacBook de Cédric, cache chaud)

| Étape                                           | Durée                         |
| ----------------------------------------------- | ----------------------------- |
| Hook `PostToolUse` sur un `.ts`                 | 3,2 – 3,4 s                   |
| Garde Bash (un appel)                           | ≈ 50 ms                       |
| Stage `fast` (hook `Stop`), capteurs parallèles | ≈ 4 – 5 s                     |
| `npm run check` (stage `check`)                 | ≈ 20 s                        |
| `npm run check:harness` (358 assertions)        | ≈ 5 min (build de doc inclus) |

### Protection du harness

- **Modèle (J-045)** : liste blanche des zones produit (`harness_paths.PRODUCT_ZONES`). Tout fichier
  hors de ces zones est du harness, qu'il soit nommé ou non. `scripts/harness-protected.txt` y ajoute
  les fichiers du harness situés **dans** les zones. Les deux gardes, le verrou et la CI lisent la
  même fonction.
- **Comparaison (J-046)** : insensible à la casse (APFS). Un chemin qui traverse `node_modules`,
  `build`, `dist`, `coverage` ou `Pods` n'est jamais produit. `CLAUDE.md` et `CLAUDE.local.md` sont
  du harness à toute profondeur, `functions/package.json` aussi.
- **Évolution** : session `MIVRO_HARNESS_UNLOCK=1 claude`, puis `npm run harness:relock` (terminal
  interactif, hors Claude Code), puis PR avec le label `harness-change`. Procédure : RUNBOOK.
- **Observé** : Claude Code recharge `.claude/settings.json` **à chaud**. La protection prend effet
  sans redémarrage, y compris pour l'agent qui vient de l'écrire.

### Comparaison avec P0114 SmartBLE (2026-09-26)

Repris de SmartBLE : table unique de capteurs et stage sélectif, abstention nommée, pre-push qui lit
les refs sur stdin, capteurs de config native, liste blanche des dépendances, shellcheck du harness,
vérification des références du journal, budget d'appels pour le reviewer.

Ce que Mivro a en plus, et que SmartBLE gagnerait à reprendre : seuils de couverture, règles ESLint
maison (casts, logs, magic values), self-test par violation volontaire, contraste WCAG, build de la
doc au push. Désormais aussi : protection du harness, verrou, hook Stop, verdict scellé, CI active
et protection de branche. SmartBLE n'a aucun de ces derniers.

### Reste ouvert

- **J-022** — aucun capteur ne vérifie les affirmations factuelles des docs.
- **J-047** — variante de casse du chemin absolu (dépôt, `$HOME`) : `EN-ATTENTE.md` §3.
- **EN-ATTENTE 2** — faux positif `prettier --config` de la garde Bash, à poser en session
  déverrouillée.
- **Mémoire de l'agent** — inscriptible par conception, risque accepté (J-046).
- **J-040** — `npm audit` rouge : `npm audit fix` dans une branche dédiée, avec rebuild natif.
- **Validations en réel.** L'héritage de l'environnement par les hooks, qui permet le
  déverrouillage, est **constaté** le 2026-09-28. Le scellement du verdict par
  `SubagentStart`/`SubagentStop` se vérifie à la première revue réelle : `.git/mivro-review`
  présent après un `APPROVED`. S'il ne se déclenche pas, les commits de l'agent sont refusés :
  l'échec est fermé.
- **Tests des règles RTDB** sur l'émulateur Firebase : c'est un test produit, pas un capteur du
  harness (`TODO.md`).

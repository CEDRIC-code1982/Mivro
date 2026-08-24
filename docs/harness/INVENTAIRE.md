# INVENTAIRE — Harness d'agent Mivro

> Phase 0 du chantier harness. **Constat pur, aucune modification de code.**
> Date : 2026-08-21 · Branche : `main` · HEAD : `de6b15c`

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
| A11Y-003 (label + role) | `plugin:react-native-a11y/basic` (10 règles actives)                                                                                                                                                     | `.eslintrc.js`                    |
| FMT-001                 | pre-push + `npm run check`                                                                                                                                                                               | `.husky/pre-push`                 |
| Seuils de coverage      | `coverageThreshold` **réellement appliqué** (`test:ci` = `jest --ci --coverage`)                                                                                                                         | `jest.config.js`, `package.json`  |
| Échappatoires           | `as any`, `: any`, `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `.skip(`, `xit(`                                                                                                                       | `scripts/check-diff.sh`           |
| Commandes destructrices | `rm -rf`, `git push --force`, `git reset --hard`, artefacts natifs                                                                                                                                       | `scripts/hooks/pre-bash-guard.py` |

### Restées dans `CLAUDE.md` — jugement requis

TS-004 · ERR-001 · ERR-002 · ERR-003 · I18N-002 (strings en prop) · DOC-003 · DOC-004 (inapplicable,
cf. J-011) · A11Y-002 · A11Y-003 (partie `hint`) · A11Y-004 · A11Y-005 · A11Y-006 · DS-003.

Toutes reprises comme grille explicite du subagent `reviewer` (`.claude/agents/reviewer.md`).

### Déplacées, pas supprimées

`docs/context/POLICIES.md` : storage, state management, observabilité, temps réel + optimisations
batterie, RGPD, format ADR, roadmap macro, format des propositions d'amélioration, et la roadmap
détaillée par feature (archive de `CLAUDE.md` v8.9).

### Résultat

| Mesure                              | Avant  | Après                    |
| ----------------------------------- | ------ | ------------------------ |
| `CLAUDE.md`                         | 614 l. | **58 l.**                |
| Règles bloquantes énoncées en prose | 24     | 13 (jugement uniquement) |
| Règles vérifiées automatiquement    | 5      | 16 familles              |
| Tests                               | 1133   | 1177                     |
| Assertions du self-test harness     | 0      | 53                       |

Commandes : `npm run check` (barrière unique) · `npm run check:arch` · `npm run check:diff` ·
`npm run check:harness` (prouve que les capteurs mordent encore).

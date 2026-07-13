# Mivro

> Find your mivro. / Trouvez votre mivro.

Application de géolocalisation collaborative — trouvez le point de rendez-vous idéal entre plusieurs participants.

## Stack

- **React Native** 0.85.2 (New Architecture ON — Fabric + TurboModules)
- **TypeScript** strict (toutes les options activées)
- **Architecture** feature-first + couche `services/` (ports/adapters conservés) — voir ci-dessous
- **State** Zustand + TanStack Query · **Validation** Zod · **i18n** i18next (FR/EN)
- **Bundle ID** : `com.cedricpineau.mivro` (iOS + Android)

## Commandes

### Dev

```bash
npm start                # Metro bundler
npm run ios              # iOS simulator
npm run android          # Android emulator
```

### Qualité (obligatoire avant tout commit)

```bash
npm run check            # typecheck + lint + format:check + test:ci
npm run lint:fix
npm run format
npm run typecheck        # tsc --noEmit
```

### Tests

```bash
npm test                 # watch mode
npm run test:ci          # one-shot CI
npm run test:coverage
npm run test:unit
npm run test:integration
```

## Architecture

```
src/
├── features/             # feature-first : écrans + hooks propres à la feature
│   └── Session/ POI/ Sharing/ Profile/ Biometric/   (screens/<Nom>/, hooks/)
├── components/           # Kit UI — Atomic Design (atoms/molecules/organisms/templates)
├── services/
│   ├── domain/           # use cases + ports (interfaces I*), par domaine
│   ├── infra/            # adapters concrets (Nominatim, Overpass, Firebase, MMKV, Sentry…)
│   ├── utils/            # helpers purs (geo, format)
│   ├── serviceContainer.ts   # injection de dépendances (composition root)
│   └── queryClient.ts
├── state/                # stores Zustand
├── entities/             # modèles de domaine (Zod)
├── theme/                # design tokens (light/dark) + useTheme()
├── hooks/                # hooks transverses
├── navigations/          # React Navigation
├── i18n/                 # i18next (FR/EN)
└── test-utils/           # helpers de test
```

**Tests co-localisés** : chaque `*.test.ts(x)` vit à côté de son sujet (intégration en `*.integration.test.tsx`) ; E2E Maestro dans `e2e/` à la racine.

Règle de dépendance : `features + components + state → services/domain ← services/infra`
(le seul point de câblage concret est `src/services/serviceContainer.ts`).

## Path Aliases

| Alias            | Cible               |
| ---------------- | ------------------- |
| `@/*`            | `src/*`             |
| `@features/*`    | `src/features/*`    |
| `@services/*`    | `src/services/*`    |
| `@components/*`  | `src/components/*`  |
| `@state/*`       | `src/state/*`       |
| `@entities/*`    | `src/entities/*`    |
| `@theme/*`       | `src/theme/*`       |
| `@hooks/*`       | `src/hooks/*`       |
| `@navigations/*` | `src/navigations/*` |
| `@test-utils/*`  | `src/test-utils/*`  |

## Workflow git

- `main` — branche protégée, stable (pas de push direct).
- `develop` — branche de travail : **tous les commits/PR passent par `develop`**, puis PR `develop → main`.

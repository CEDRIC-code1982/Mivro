# MidPoint

> Meet in the middle. / Retrouvez-vous à mi-chemin.

Application de géolocalisation collaborative — trouvez le point de rendez-vous idéal entre plusieurs participants.

## Stack

- **React Native** 0.85.2 (New Architecture ON — Fabric + TurboModules)
- **TypeScript** strict (toutes les options activées)
- **Clean Architecture** (core / infrastructure / presentation)
- **Bundle ID** : `com.cedricpineau.midpoint` (iOS + Android)

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
├── core/                 # Entités, use cases, ports, theme
│   ├── entities/
│   ├── usecases/
│   ├── ports/
│   └── theme/            # Design tokens (light/dark) + useTheme()
├── infrastructure/       # Implémentations concrètes (adapters)
│   ├── geocode/
│   ├── poi/
│   ├── storage/
│   ├── realtime/
│   ├── eta/
│   ├── crash/
│   └── analytics/
├── presentation/         # UI (Atomic Design)
│   ├── screens/
│   ├── components/       # atoms → molecules → organisms → templates
│   ├── hooks/
│   ├── navigation/
│   └── stores/
├── i18n/                 # i18next (FR/EN)
├── di/                   # Injection de dépendances
└── __tests__/            # unit / integration / e2e
```

Règle de dépendance : `presentation → core ← infrastructure`

## Path Aliases

| Alias               | Cible                  |
| ------------------- | ---------------------- |
| `@/*`               | `src/*`                |
| `@core/*`           | `src/core/*`           |
| `@infrastructure/*` | `src/infrastructure/*` |
| `@presentation/*`   | `src/presentation/*`   |

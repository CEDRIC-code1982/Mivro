# ARCHITECTURE.md — Mivro

> Architecture **réelle** du code, explorée depuis le filesystem. Mise à jour à chaque feature (cf. CLAUDE.md > AUTO-MAINTENANCE).
> Dernière exploration : 2026-06-20 (F7 Profil passe 2 — photo — livrée/testée/reviewée, non commitée).

## Vue d'ensemble — Clean Architecture + Ports/Adapters

```
        ┌─────────────────┐
        │  presentation   │  React, écrans, hooks, stores, navigation
        └────────┬────────┘
                 │ dépend de
                 ▼
        ┌─────────────────┐
        │      core       │  Entités, ports (interfaces), use cases, utils, theme
        └────────▲────────┘
                 │ implémente
        ┌────────┴────────┐
        │ infrastructure  │  Adapters concrets (Nominatim, Overpass, MMKV, Sentry…)
        └─────────────────┘
```

**Règle de dépendance (bloquante)** : `presentation → core ← infrastructure`

- `core` n'importe JAMAIS `presentation` ni `infrastructure`.
- `presentation` n'importe JAMAIS `infrastructure` (passe par les ports + le DI container).
- Le seul point de câblage concret est `src/di/container.ts`.

Compteurs de fichiers `.ts`/`.tsx` (hors `.gitkeep`) : core **28** · infrastructure **9** · presentation **58**. Tests (`src/__tests__/`, helpers inclus) : **61** fichiers, dont **59** `*.test.ts(x)` (**718** cas, `npm run check` vert au 2026-06-20).

---

## Arborescence réelle de `src/`

```
src/
├── core/
│   ├── entities/        Avatar, GeocodeResult, Location, MidpointSession, POICategory, PointOfInterest, User (+ index)
│   ├── ports/           ICrashReporter, IGeocodeService, IGeolocationService, IPOIService, IProfilePhotoService, IStorageService
│   ├── usecases/        CalculateMidpoint, CreateGuestUser, GetCurrentLocation, SearchAddress, SearchPOI, UpdateProfile
│   ├── theme/           tokens.ts, index.ts
│   └── utils/
│       ├── geo/         centroid, distance, radius (+ index)
│       └── format/      distance (+ index)
├── infrastructure/
│   ├── crash/           SentryCrashReporter, sanitizers
│   ├── geocode/         NominatimGeocodeService
│   ├── geolocation/     RNGeolocationService
│   ├── media/           ImagePickerProfilePhotoService (F7 passe 2 — photo profil)
│   ├── poi/             OverpassPOIService
│   ├── storage/         MMKVStorageService, getEncryptionKey, zustand-mmkv-adapter
│   ├── analytics/       (vide — placeholder PostHog)
│   ├── eta/             (vide — placeholder OSRM V1)
│   └── realtime/        (vide — placeholder Firebase F4)
├── presentation/
│   ├── App.tsx
│   ├── screens/         CreateSessionScreen, MapScreen, POIScreen, ProfileScreen, SessionsScreen
│   ├── components/
│   │   ├── atoms/        Text, Screen, TabBarIcon, CategoryChip, Avatar
│   │   ├── molecules/    AddressAutocomplete, AvatarPicker, EmptyState, POICard, POIDetailSheet,
│   │   │                 POIListView, POIMapView, POIScreenHeader, ParticipantCard, SessionMapView
│   │   ├── organisms/    (vide)
│   │   └── templates/    AppErrorBoundary
│   ├── hooks/           useAuth, useCrashReporter, useCreateSessionFlow, useDebounce,
│   │                    useGeocodeQuery, useMidpointCalculation, usePOIQuery, useProfilePhoto
│   ├── navigation/      RootNavigator, BottomTabsNavigator, types
│   ├── stores/          useAuthStore, usePreferencesStore, useSessionStore
│   └── utils/           poiIcons
├── di/                  container.ts, queryClient.ts
├── i18n/                index.ts, locales/{fr,en}/{common,create,map,navigation,poi,profile,sessions}.json
├── types/               react-native-config.d.ts, react-native-maps.d.ts
└── __tests__/           unit/ · integration/ · e2e/ (Maestro) · helpers/
```

---

## Entités Core (`src/core/entities/`)

| Entité            | Rôle                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `Avatar`          | Avatar emoji prédéfini (`AvatarSchema`, `AvatarIdSchema` 20 ids, `AVATARS`, `getAvatarById`) — F7 |
| `Location`        | Coordonnées GPS + adresse formatée                                                                |
| `GeocodeResult`   | Résultat brut de géocodage (avant conversion en `Location`)                                       |
| `MidpointSession` | Session de calcul de midpoint avec participants (participant porte `avatarId?`)                   |
| `PointOfInterest` | POI (résultat Overpass)                                                                           |
| `POICategory`     | Catégorie de POI (filtres / chips)                                                                |
| `User`            | Distingue utilisateur invité (guest) et authentifié (+ `avatarId?` et `photoUri?` — F7)           |

Toutes les entités sont définies/validées via **Zod** (`z.infer<>` exporté). `index.ts` = barrel d'export.
`Avatar` n'est PAS une entité persistée comme telle : c'est un **référentiel statique** (20 avatars en dur) + l'enum d'ids (`AvatarId`) référencé par `User.avatarId` et `Participant.avatarId`.

## Ports (`src/core/ports/`) → Adapters (`src/infrastructure/`)

| Port                   | Adapter concret                  | Rôle                                                                                     |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `ICrashReporter`       | `SentryCrashReporter`            | Reporting crashs/erreurs (+ scrubbing RGPD via `sanitizers.ts`)                          |
| `IGeocodeService`      | `NominatimGeocodeService`        | Adresse → coordonnées (Nominatim/OSM)                                                    |
| `IGeolocationService`  | `RNGeolocationService`           | Géolocalisation native (GPS + reverse)                                                   |
| `IPOIService`          | `OverpassPOIService`             | Recherche POI (Overpass)                                                                 |
| `IProfilePhotoService` | `ImagePickerProfilePhotoService` | Photo profil : pick galerie/caméra (resize 200×200) + copie FileSystem + cleanup (F7 p2) |
| `IStorageService`      | `MMKVStorageService`             | Storage persistant chiffré (MMKV)                                                        |

**Ports planifiés (non encore créés)** : `IRealtimeService` (F4/Firebase), `IAnalyticsService` (PostHog), `IETAService` (V1/OSRM). Dossiers infra correspondants déjà présents et vides.

## Use Cases (`src/core/usecases/`)

| Use Case                    | Rôle                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `CalculateMidpointUseCase`  | Calcul du midpoint (centroïde + rayon) d'une session                                                           |
| `CreateGuestUserUseCase`    | Crée un guest user (UUID + displayName généré)                                                                 |
| `GetCurrentLocationUseCase` | Position GPS courante (orchestre géoloc + reverse géocode)                                                     |
| `SearchAddressUseCase`      | Recherche d'adresse (orchestre `IGeocodeService`)                                                              |
| `SearchPOIUseCase`          | Recherche de POI (orchestre `IPOIService`)                                                                     |
| `UpdateProfileUseCase`      | Met à jour le profil (`displayName` + `avatarId` + `photoUri`, set/clear via `null`) — **pur, sans port** (F7) |

Chaque use case reçoit ses ports par **injection de constructeur** (instancié dans le container).
Exception : `UpdateProfileUseCase` est une transformation **pure** (`User + patch → User`, validée Zod) sans I/O ni port ; il est tout de même câblé dans le container pour rester homogène et faciliter un futur port (ex : sync serveur).

## Utils Core (`src/core/utils/`)

- `geo/centroid` — centroïde (point moyen) d'un ensemble de coordonnées
- `geo/distance` — distance entre 2 points GPS (formule de Haversine)
- `geo/radius` — rayon de zone autour d'un centroïde
- `format/distance` — formatage humain des distances (m / km)

---

## Stores Zustand (`src/presentation/stores/`)

| Store                 | Persisté ? | Rôle                                                                                               |
| --------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `useAuthStore`        | MMKV       | Auth guest-first (guest vs authentifié) + `updateProfile` (nom/avatar, via `UpdateProfileUseCase`) |
| `usePreferencesStore` | MMKV       | Thème, langue, opt-in analytics (+ biométrie F8)                                                   |
| `useSessionStore`     | non\*      | Session courante : participants, midpoint, POIs                                                    |

\*`useRealtimeStore` (F4) sera **non persisté** (RGPD — positions éphémères).
Persistance via `zustand-mmkv-adapter` (infrastructure) câblé dans le container.

## Hooks custom (`src/presentation/hooks/`)

| Hook                     | Type            | Rôle                                                                                                                                       |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `useAuth`                | sélecteur store | Accès ciblé à `useAuthStore`                                                                                                               |
| `useCrashReporter`       | service         | Expose le crash reporter aux composants                                                                                                    |
| `useCreateSessionFlow`   | orchestration   | Flow complet feature F1 (création de session) ; le point GPS « ma position » reçoit l'`avatarId` (emoji) du user courant — jamais la photo |
| `useDebounce`            | utilitaire      | Debounce d'une valeur (ex : saisie autocomplete)                                                                                           |
| `useGeocodeQuery`        | TanStack Query  | Recherche d'adresse (cache 1 min, retry 2×)                                                                                                |
| `usePOIQuery`            | TanStack Query  | Recherche POI (cache 5 min, retry 2×)                                                                                                      |
| `useMidpointCalculation` | store + calc    | Calcule le midpoint et le persiste dans le store                                                                                           |
| `useProfilePhoto`        | orchestration   | Photo profil (F7 p2) : pick via `IProfilePhotoService`, persist `photoUri`, cleanup, loading/error                                         |

## Atomic Design (`src/presentation/components/`)

- **Atoms** : `Text`, `Screen`, `TabBarIcon`, `CategoryChip`, `Avatar`
  - `Avatar` (F7) : ordre de rendu **photo (`photoUri`, `<Image>`) > emoji (`avatarId`) > initiale (`fallbackName`)**. Source unique de la logique d'initiale (réutilisée par `ParticipantCard`). Photo ajoutée en passe 2.
  - ⚠️ `Button`, `Input`, `IconButton`, `Card`, `Spinner` **n'existent pas** — à créer au besoin (skill `create-atom`).
- **Molecules** : `AddressAutocomplete` (+ `AddressResultItem`), `AvatarPicker`, `EmptyState`, `POICard`, `POIDetailSheet`, `POIListView`, `POIMapView`, `POIScreenHeader`, `ParticipantCard`, `SessionMapView`
  - `AvatarPicker` (F7) : grille des 20 avatars en `accessibilityRole="radiogroup"` (A11Y-003), composant l'atom `Avatar`.
- **Organisms** : aucun pour l'instant
- **Templates** : `AppErrorBoundary` (ErrorBoundary global — ERR-002)

## Écrans (`src/presentation/screens/`)

| Écran                 | État                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `CreateSessionScreen` | F1 — saisie 2-5 points + autocomplete + GPS                                                                                 |
| `MapScreen`           | F2 — midpoint + carte react-native-maps                                                                                     |
| `POIScreen`           | F3 — POI Overpass, toggle liste/carte                                                                                       |
| `ProfileScreen`       | F7 — édition `displayName` + grille avatars + photo (galerie/caméra/supprimer, états loading/erreur) ; biométrie F8 à venir |
| `SessionsScreen`      | Squelette (72 l.) — historique sessions                                                                                     |

Navigation : `RootNavigator` (native-stack) + `BottomTabsNavigator` (bottom-tabs), types dans `navigation/types.ts`.

---

## Injection de dépendances (`src/di/container.ts`)

- **Seul fichier** connaissant les implémentations concrètes (swap provider = 1 ligne).
- Pattern : singleton `containerInstance`, `initContainer(encryptionKey)` au démarrage, `getContainer()` ailleurs.
- Câble : `storage`, `zustandStorage`, `crashReporter`, `geocodeService`, `geolocationService`, `poiService`, `profilePhotoService` (F7 p2 — `ImagePickerProfilePhotoService`, reçoit le `crashReporter`), le `queryClient` TanStack, et les use cases (`createGuestUser`, `searchAddress`, `getCurrentLocation`, `calculateMidpoint`, `searchPOI`, `updateProfileUseCase`).
- `crashReporter.init()` est appelé **avant** le reste (les adapters le reçoivent par constructeur).
- `queryClient.ts` : factory `createQueryClient()` (config cache/retry).

---

## Conventions observées

- **Nommage** : entités `PascalCase.ts` ; ports `I<Nom>Service.ts` ; usecases `<Verbe><Nom>UseCase.ts` ; adapters `<Provider><Port>.ts` (ex `NominatimGeocodeService`) ; hooks `use<Nom>.ts` ; stores `use<Nom>Store.ts`.
- **Composants** : un dossier par composant avec `<Nom>.tsx` + `index.ts` (barrel) + `<Nom>.test.tsx` co-localisé ou dans `__tests__/`.
- **TSDoc bilingue** : en-tête `@file` / `@description` FR + EN sur chaque module (DOC-001/002).
- **Marqueurs** : commentaires `// [ADDED]` / `// [MODIFIED]` pour tracer les évolutions.
- **Logging** : format `[LEVEL][File][fn][line][HH:mm:ss] message` (LOG-001).
- **Zod partout** pour les données externes (TS-004) ; zéro `any` (TS-001).

## Path aliases (`tsconfig.json`)

| Alias               | Cible                                     |
| ------------------- | ----------------------------------------- |
| `@/*`               | `src/*`                                   |
| `@core/*`           | `src/core/*`                              |
| `@infrastructure/*` | `src/infrastructure/*`                    |
| `@presentation/*`   | `src/presentation/*`                      |
| `react-native-maps` | `src/types/react-native-maps.d.ts` (shim) |

Options strict notables : `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noUnusedLocals/Parameters`, `forceConsistentCasingInFileNames`. `skipLibCheck` activé (libs RN incompatibles avec `exactOptionalPropertyTypes`).

## Patterns clés

- **DI container** singleton, ports/adapters, swap = 1 ligne.
- **Validation Zod** systématique en frontière (API, storage).
- **Error handling** : try/catch sur réseau/I/O (ERR-001), `AppErrorBoundary` (ERR-002), états loading/error/empty (ERR-003).
- **State** : Zustand (client) + TanStack Query (serveur/async), persistance MMKV chiffrée via adapter.
- **Observabilité** : Sentry avec `sanitizers.ts` qui scrubbe GPS/emails/tokens dans `beforeSend` (RGPD).
- **i18n** : i18next + react-i18next, namespaces par domaine (common, create, map, navigation, poi, profile, sessions) × FR/EN.
- **Découplage des libs natives via port (F7 p2)** : `react-native-image-picker` + `@dr.pogodin/react-native-fs` ne sont importés QUE par l'adapter `ImagePickerProfilePhotoService` (infra). La presentation passe par le port `IProfilePhotoService` (DI) et n'importe jamais les libs natives — testable sans device (mocks typés).
- **Stockage photo profil = FileSystem (chemin)** : la photo (resize natif 200×200) est copiée dans `Documents/profile-photos/<uuid>.jpg` ; seul le chemin est stocké dans `User.photoUri` (Zod) et persisté MMKV. Cleanup best-effort de l'ancien fichier au remplacement/suppression (ne rejette jamais). Voir **ADR-013**.

## Stack & dépendances principales

RN 0.85.2 · React 19.2.3 · Zod 4 · Zustand 5 · TanStack Query 5 · @react-navigation 7 · react-native-maps 1.26 · react-native-mmkv 4 · @gorhom/bottom-sheet 5 · react-native-reanimated 4 + worklets · react-native-keychain 10 · @sentry/react-native 8 · i18next 26 · lucide-react-native · react-native-svg · react-native-localize · react-native-config · react-native-image-picker · @dr.pogodin/react-native-fs (F7 p2).

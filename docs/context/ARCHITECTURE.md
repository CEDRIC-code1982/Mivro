# ARCHITECTURE.md — Mivro

> Architecture **réelle** du code, explorée depuis le filesystem. Mise à jour à chaque feature (cf. CLAUDE.md > AUTO-MAINTENANCE).
> Dernière exploration : 2026-06-29 (F8 Biométrie — livrée/testée **1133**/reviewée APPROVED, non commitée ; F5 & F4 commitées `d112edb`/`c9a76d1`/`1c73eeb` ; F7 commitée `ebf1215`).

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

Compteurs de fichiers `.ts`/`.tsx` (hors `.gitkeep`) : core **36** · infrastructure **12** · presentation **72**. Tests : **85** suites, **1133** cas (`npm run check` vert au 2026-06-29).

---

## Arborescence réelle de `src/`

```
src/
├── core/
│   ├── entities/        Avatar, GeocodeResult, Location, MidpointSession, POICategory, PointOfInterest, User (+ index)
│   ├── ports/           IBiometricService, ICrashReporter, IGeocodeService, IGeolocationService, IPOIService, IProfilePhotoService, IRealtimeService, ISessionShareService, IStorageService
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
│   ├── realtime/        FirebaseRealtimeService (F4 — Firebase RTDB, API modulaire)
│   └── security/        KeychainBiometricService (F8 — verrou biométrique via react-native-keychain)
├── presentation/
│   ├── App.tsx
│   ├── screens/         CreateSessionScreen, JoinSessionScreen, MapScreen, POIScreen, ProfileScreen, SessionsScreen
│   ├── components/
│   │   ├── atoms/        Text, Screen, TabBarIcon, CategoryChip, Avatar
│   │   ├── molecules/    AddressAutocomplete, AvatarPicker, BiometricLockScreen, EmptyState,
│   │   │                 LiveParticipantsList, POICard, POIDetailSheet, POIListView, POIMapView,
│   │   │                 POIScreenHeader, ParticipantCard, RealtimeConsentModal, SessionMapView
│   │   ├── organisms/    (vide)
│   │   └── templates/    AppErrorBoundary
│   ├── hooks/           useAuth, useBiometricLock, useCrashReporter, useCreateSessionFlow, useDebounce,
│   │                    useGeocodeQuery, useMidpointCalculation, usePOIQuery, useProfilePhoto,
│   │                    useRealtimeTracking, useSessionShare, useSharedSessionSync
│   ├── navigation/      RootNavigator, BottomTabsNavigator, linking, types
│   ├── stores/          useAuthStore, usePreferencesStore, useSessionStore, useRealtimeStore, useSharedSessionStore
│   └── utils/           poiIcons
├── di/                  container.ts, queryClient.ts
├── i18n/                index.ts, locales/{fr,en}/{biometric,common,create,map,navigation,poi,profile,realtime,sessions,share}.json
├── types/               react-native-config.d.ts, react-native-maps.d.ts
└── __tests__/           unit/ · integration/ · e2e/ (Maestro) · helpers/
```

---

## Entités Core (`src/core/entities/`)

| Entité                | Rôle                                                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Avatar`              | Avatar emoji prédéfini (`AvatarSchema`, `AvatarIdSchema` 20 ids, `AVATARS`, `getAvatarById`) — F7                                                                                                                                               |
| `Location`            | Coordonnées GPS + adresse formatée                                                                                                                                                                                                              |
| `GeocodeResult`       | Résultat brut de géocodage (avant conversion en `Location`)                                                                                                                                                                                     |
| `MidpointSession`     | Session de calcul de midpoint avec participants (participant porte `avatarId?`)                                                                                                                                                                 |
| `PointOfInterest`     | POI (résultat Overpass)                                                                                                                                                                                                                         |
| `POICategory`         | Catégorie de POI (filtres / chips)                                                                                                                                                                                                              |
| `User`                | Distingue utilisateur invité (guest) et authentifié (+ `avatarId?` et `photoUri?` — F7)                                                                                                                                                         |
| `RealtimeParticipant` | Position GPS live d'un participant (F4) : `participantId`, `latitude`, `longitude`, `updatedAt`, `speed` km/h, `heading`, `isOnline` — éphémère (RGPD)                                                                                          |
| `SharedSession`       | Session PARTAGÉE (F5) : `meta` (createdAt, expiresAt, ownerType guest/account, status open/closed, midpoint?, midpointRadius?) + `members[]` (memberId, displayName, avatarId?, startLocation lat/lng/adresse) — éphémère, expire 24h/7j (RGPD) |

Toutes les entités sont définies/validées via **Zod** (`z.infer<>` exporté). `index.ts` = barrel d'export.
`Avatar` n'est PAS une entité persistée comme telle : c'est un **référentiel statique** (20 avatars en dur) + l'enum d'ids (`AvatarId`) référencé par `User.avatarId` et `Participant.avatarId`.

## Ports (`src/core/ports/`) → Adapters (`src/infrastructure/`)

| Port                   | Adapter concret                  | Rôle                                                                                                         |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ICrashReporter`       | `SentryCrashReporter`            | Reporting crashs/erreurs (+ scrubbing RGPD via `sanitizers.ts`)                                              |
| `IGeocodeService`      | `NominatimGeocodeService`        | Adresse → coordonnées (Nominatim/OSM)                                                                        |
| `IGeolocationService`  | `RNGeolocationService`           | Géolocalisation native (GPS + reverse)                                                                       |
| `IPOIService`          | `OverpassPOIService`             | Recherche POI (Overpass)                                                                                     |
| `IProfilePhotoService` | `ImagePickerProfilePhotoService` | Photo profil : pick galerie/caméra (resize 200×200) + copie FileSystem + cleanup (F7 p2)                     |
| `IStorageService`      | `MMKVStorageService`             | Storage persistant chiffré (MMKV)                                                                            |
| `IRealtimeService`     | `FirebaseRealtimeService`        | Localisation temps réel multi-participants (Firebase RTDB, API modulaire) — F4                               |
| `ISessionShareService` | `FirebaseSessionShareService`    | Partage collaboratif de session (roster meta + members, Firebase RTDB) — F5 ; distinct de `IRealtimeService` |
| `IBiometricService`    | `KeychainBiometricService`       | Verrou biométrique Face ID / Touch ID via react-native-keychain (secret sentinelle BIOMETRY_ANY) — F8        |

> `IGeolocationService` étendu en F4 avec `watchPosition(onSample, onError?, options?) → clearWatch` (suivi GPS continu : coordonnées + `speed` km/h + `heading`).

**Ports planifiés (non encore créés)** : `IAnalyticsService` (PostHog), `IETAService` (V1/OSRM). Dossiers infra correspondants (`analytics/`, `eta/`) présents et vides. `IRealtimeService` était « planifié » jusqu'à F4 — désormais **réalisé** (`FirebaseRealtimeService`), `infrastructure/realtime/` n'est plus vide.

## Use Cases (`src/core/usecases/`)

| Use Case                    | Rôle                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CalculateMidpointUseCase`  | Calcul du midpoint (centroïde + rayon) d'une session                                                                                                                        |
| `CreateGuestUserUseCase`    | Crée un guest user (UUID + displayName généré)                                                                                                                              |
| `GetCurrentLocationUseCase` | Position GPS courante (orchestre géoloc + reverse géocode)                                                                                                                  |
| `SearchAddressUseCase`      | Recherche d'adresse (orchestre `IGeocodeService`)                                                                                                                           |
| `SearchPOIUseCase`          | Recherche de POI (orchestre `IPOIService`)                                                                                                                                  |
| `UpdateProfileUseCase`      | Met à jour le profil (`displayName` + `avatarId` + `photoUri`, set/clear via `null`) — **pur, sans port** (F7)                                                              |
| `TrackParticipantsUseCase`  | Orchestre subscribe/publish/leave via `IRealtimeService`, valide la position (Zod) — sans dépendance infra (F4)                                                             |
| `ShareSessionUseCase`       | Publie la session locale → `SharedSession` (meta + members), calcule `expiresAt` (24h/7j), renvoie le lien `mivro://session/{id}` (F5)                                      |
| `JoinSessionUseCase`        | Rejoint une session partagée : vérifie l'expiration/statut, ajoute le membre, **recalcule le midpoint** (réutilise `CalculateMidpointUseCase`) et l'écrit dans la meta (F5) |

Chaque use case reçoit ses ports par **injection de constructeur** (instancié dans le container).
Exception : `UpdateProfileUseCase` est une transformation **pure** (`User + patch → User`, validée Zod) sans I/O ni port ; il est tout de même câblé dans le container pour rester homogène et faciliter un futur port (ex : sync serveur).

## Utils Core (`src/core/utils/`)

- `geo/centroid` — centroïde (point moyen) d'un ensemble de coordonnées
- `geo/distance` — distance entre 2 points GPS (formule de Haversine)
- `geo/radius` — rayon de zone autour d'un centroïde
- `format/distance` — formatage humain des distances (m / km)

---

## Stores Zustand (`src/presentation/stores/`)

| Store                   | Persisté ?     | Rôle                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAuthStore`          | MMKV           | Auth guest-first (guest vs authentifié) + `updateProfile` (nom/avatar, via `UpdateProfileUseCase`)                                                                                                                                                                                                                          |
| `usePreferencesStore`   | MMKV           | Thème, langue, opt-in analytics, **`biometricEnabled`** + `setBiometricEnabled` (verrou biométrique opt-in F8)                                                                                                                                                                                                              |
| `useSessionStore`       | non\*          | Session courante : participants, midpoint, POIs                                                                                                                                                                                                                                                                             |
| `useRealtimeStore`      | **non** (RGPD) | Positions GPS live des participants (F4) : map `participantId → RealtimeParticipant`, `status`, `hasSharingConsent`                                                                                                                                                                                                         |
| `useSharedSessionStore` | **non** (RGPD) | Mode session PARTAGÉE (F5) : `isShared`, `isOwner` (propriétaire vs membre — pilote la suppression RGPD), `sessionId`, `link`, `meta`, `members[]`, `status`, `errorCode`. State-only ; `useSessionStore.loadSharedSession` charge le roster dans la session locale (midpoint recalculé). N'importe ni firebase ni le port. |

\*`useRealtimeStore` (F4) est **non persisté** (RGPD — positions éphémères, purgées au `stopTracking`).
Persistance via `zustand-mmkv-adapter` (infrastructure) câblé dans le container.

## Hooks custom (`src/presentation/hooks/`)

| Hook                     | Type            | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAuth`                | sélecteur store | Accès ciblé à `useAuthStore`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `useCrashReporter`       | service         | Expose le crash reporter aux composants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `useCreateSessionFlow`   | orchestration   | Flow complet feature F1 (création de session) ; le point GPS « ma position » reçoit l'`avatarId` (emoji) du user courant — jamais la photo                                                                                                                                                                                                                                                                                                                                                                                         |
| `useDebounce`            | utilitaire      | Debounce d'une valeur (ex : saisie autocomplete)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `useGeocodeQuery`        | TanStack Query  | Recherche d'adresse (cache 1 min, retry 2×)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `usePOIQuery`            | TanStack Query  | Recherche POI (cache 5 min, retry 2×)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `useMidpointCalculation` | store + calc    | Calcule le midpoint et le persiste dans le store                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `useProfilePhoto`        | orchestration   | Photo profil (F7 p2) : pick via `IProfilePhotoService`, persist `photoUri`, cleanup, loading/error                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `useRealtimeTracking`    | orchestration   | Temps réel (F4) : `geoloc.watchPosition → publish` + `subscribe → store` ; opti batterie (5s/30s + off background AppState) ; publie seulement si consentement ; `leaveSession` au stop. N'importe jamais firebase (port + DI)                                                                                                                                                                                                                                                                                                     |
| `useSessionShare`        | orchestration   | Partage (F5) : `share()` (ShareSessionUseCase + share sheet native `Share`) et `join(sessionId)` (JoinSessionUseCase + `loadSharedSession`) ; états `isBusy`/`errorCode`. Marque l'ownership (`setShared(..., isOwner)`). Passe par les use cases via le container DI (jamais firebase)                                                                                                                                                                                                                                            |
| `useBiometricLock`       | orchestration   | Verrou biométrique (F8) : détecte `supportedType` (port DI), gère `isLocked` au lancement + re-lock dès `inactive`/`background` (masque l'app-switcher) ET au retour `→ active` (AppState) ; expose `unlock(reason)`, `enableLock(reason)`/`disableLock()` (auth de confirmation à l'activation) et l'échappatoire `disableLockAndContinue` + `showDisableEscape` après 3 échecs. **Anti-lockout** : auto-désactivation si la biométrie n'est plus enrôlée/dispo au montage. Sélecteurs Zustand stables. N'importe jamais keychain |
| `useSharedSessionSync`   | orchestration   | Synchro LIVE (F5) : tant que `useSharedSessionStore.isShared`, s'abonne via `ISessionShareService.subscribeToSharedSession` (DI), branche `syncFromRemote` + `loadSharedSession` sur chaque update (roster + midpoint live), purge si le nœud disparaît, **désabonne au démontage/changement de sessionId**. Sélecteurs Zustand stables. Appelé depuis `MapScreen`. Jamais firebase                                                                                                                                                |

## Atomic Design (`src/presentation/components/`)

- **Atoms** : `Text`, `Screen`, `TabBarIcon`, `CategoryChip`, `Avatar`
  - `Avatar` (F7) : ordre de rendu **photo (`photoUri`, `<Image>`) > emoji (`avatarId`) > initiale (`fallbackName`)**. Source unique de la logique d'initiale (réutilisée par `ParticipantCard`). Photo ajoutée en passe 2.
  - ⚠️ `Button`, `Input`, `IconButton`, `Card`, `Spinner` **n'existent pas** — à créer au besoin (skill `create-atom`).
- **Molecules** : `AddressAutocomplete` (+ `AddressResultItem`), `AvatarPicker`, `EmptyState`, `LiveParticipantsList`, `POICard`, `POIDetailSheet`, `POIListView`, `POIMapView`, `POIScreenHeader`, `ParticipantCard`, `RealtimeConsentModal`, `SessionMapView`
  - `AvatarPicker` (F7) : grille des 20 avatars en `accessibilityRole="radiogroup"` (A11Y-003), composant l'atom `Avatar`.
  - `LiveParticipantsList` (F4) : vue liste textuelle alternative à la carte temps réel (A11Y-006) — nom, statut online/offline, distance au midpoint ; état empty géré.
  - `RealtimeConsentModal` (F4) : consentement RGPD explicite et **séparé** au partage de position.
  - `BiometricLockScreen` (F8) : overlay plein écran **bloquant** rendu par `App.tsx` tant que l'app est verrouillée ; bouton « Déverrouiller » (+ auto-prompt au montage), message d'erreur i18n (échec/annulation), a11y `accessibilityViewIsModal`. Le verrou est un overlay (pas une route) pour bloquer tous les écrans et survivre aux transitions AppState.
  - `SessionMapView` (F4) : prop optionnelle `liveParticipants` → markers live (halo online/offline) distincts des points de départ.
- **Organisms** : aucun pour l'instant
- **Templates** : `AppErrorBoundary` (ErrorBoundary global — ERR-002)

## Écrans (`src/presentation/screens/`)

| Écran                 | État                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CreateSessionScreen` | F1 — saisie 2-5 points + autocomplete + GPS                                                                                                                               |
| `MapScreen`           | F2 — midpoint + carte react-native-maps                                                                                                                                   |
| `POIScreen`           | F3 — POI Overpass, toggle liste/carte                                                                                                                                     |
| `ProfileScreen`       | F7 — édition `displayName` + grille avatars + photo (galerie/caméra/supprimer, états loading/erreur) ; **F8 — toggle verrou biométrique opt-in** (via `useBiometricLock`) |
| `SessionsScreen`      | Squelette (72 l.) — historique sessions                                                                                                                                   |
| `JoinSessionScreen`   | F5 — jointure via deep link `mivro://session/{id}` : états loading/success/error (lien expiré/introuvable/fermé), recalcul midpoint, navigation vers la carte             |

Navigation : `RootNavigator` (native-stack) + `BottomTabsNavigator` (bottom-tabs), types dans `navigation/types.ts`.
Deep linking (F5) : `navigation/linking.ts` (`prefixes: ['mivro://']`, `session/:sessionId → JoinSession`) passé à `NavigationContainer`. Config native : iOS `CFBundleURLTypes` + Android `<intent-filter>` (scheme `mivro`).

Verrou biométrique (F8) : `App.tsx` définit le composant `BiometricLockGate` (consomme `useBiometricLock`) qui **enveloppe l'arbre applicatif** ; tant que `isLocked`, l'overlay `BiometricLockScreen` est rendu par-dessus et l'arbre sous-jacent est masqué aux lecteurs d'écran (`importantForAccessibility="no-hide-descendants"` Android + `accessibilityElementsHidden` iOS). Le gate est un **overlay** (pas une route) → bloque tous les écrans et survit aux transitions `AppState`.

---

## Injection de dépendances (`src/di/container.ts`)

- **Seul fichier** connaissant les implémentations concrètes (swap provider = 1 ligne).
- Pattern : singleton `containerInstance`, `initContainer(encryptionKey)` au démarrage, `getContainer()` ailleurs.
- Câble : `storage`, `zustandStorage`, `crashReporter`, `geocodeService`, `geolocationService`, `poiService`, `profilePhotoService` (F7 p2 — `ImagePickerProfilePhotoService`, reçoit le `crashReporter`), `realtimeService` (F4 — `FirebaseRealtimeService`, reçoit le `crashReporter`), `sessionShareService` (F5 — `FirebaseSessionShareService`, reçoit le `crashReporter`), `biometricService` (F8 — `KeychainBiometricService`, reçoit le `crashReporter`), le `queryClient` TanStack, et les use cases (`createGuestUser`, `searchAddress`, `getCurrentLocation`, `calculateMidpoint`, `searchPOI`, `updateProfileUseCase`, `trackParticipantsUseCase`, `shareSessionUseCase`, `joinSessionUseCase`).
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
- **i18n** : i18next + react-i18next, namespaces par domaine (**biometric** F8, common, create, map, navigation, poi, profile, realtime, sessions, **share** F5) × FR/EN.
- **Partage de session confiné à l'infra (F5)** : `FirebaseSessionShareService` (infra/realtime) implémente `ISessionShareService` (distinct de `IRealtimeService`). Le core (port + `ShareSessionUseCase`/`JoinSessionUseCase`) et la presentation (`useSessionShare`, `useSharedSessionStore`, `JoinSessionScreen`) ignorent firebase → transport substituable (swap = 1 ligne DI). Join = participant collaboratif (recalcul midpoint via `CalculateMidpointUseCase`). RGPD : session expirable (24h/7j), `deleteSharedSession` en fin de session, store non persisté, pas de coords loggées.
- **Découplage des libs natives via port (F7 p2)** : `react-native-image-picker` + `@dr.pogodin/react-native-fs` ne sont importés QUE par l'adapter `ImagePickerProfilePhotoService` (infra). La presentation passe par le port `IProfilePhotoService` (DI) et n'importe jamais les libs natives — testable sans device (mocks typés).
- **Stockage photo profil = FileSystem (chemin)** : la photo (resize natif 200×200) est copiée dans `Documents/profile-photos/<uuid>.jpg` ; seul le chemin est stocké dans `User.photoUri` (Zod) et persisté MMKV. Cleanup best-effort de l'ancien fichier au remplacement/suppression (ne rejette jamais). Voir **ADR-013**.
- **Temps réel confiné à l'infra (F4)** : `@react-native-firebase/app` + `/database` (API modulaire v25) ne sont importés QUE par `FirebaseRealtimeService` (infra/realtime). Le core (`IRealtimeService`, `TrackParticipantsUseCase`) et la presentation (`useRealtimeStore`, `useRealtimeTracking`) ignorent Firebase → transport substituable (swap = 1 ligne DI) et testable sans device (port mocké). Voir **ADR-006**.
- **Politique batterie côté presentation (F4)** : `RNGeolocationService.watchPosition` (infra) émet brut ; le throttling (5s en mouvement / 30s à l'arrêt) et la coupure en arrière-plan (AppState) vivent dans `useRealtimeTracking` (decision applicative). L'adapter reste simple.
- **RGPD temps réel (F4)** : `useRealtimeStore` non persisté (purgé au `stopTracking`) ; consentement de partage **explicite et séparé** (`hasSharingConsent`, non persisté) — on peut s'abonner (voir) sans publier ; le **watch GPS lui-même est conditionné au consentement** (corrigé en review) ; `leaveSession` = cancel `onDisconnect` + `remove` du nœud ; aucune coordonnée brute loggée.
- **Verrou biométrique confiné à l'infra (F8)** : `react-native-keychain` n'est importé QUE par `KeychainBiometricService` (infra/security). Le core (`IBiometricService`, `BiometricError` typée) et la presentation (`useBiometricLock`, `BiometricLockScreen`, `App.tsx`/gate) passent par le port (DI) → testable sans device (port mocké), swap = 1 ligne DI. La biométrie est matérialisée par un **secret sentinelle** posé en keychain (`enableLock`) et relu (`authenticate`) — c'est la relecture qui déclenche le prompt natif Face ID / Touch ID. **Anti-lockout (double filet)** : (1) `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE` (+ `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) → le **passcode device** sert de secours natif si la biométrie devient inutilisable ; (2) échappatoire **applicative** (`disableLockAndContinue` + bouton « Désactiver le verrou et continuer » après 3 échecs, ou auto-désactivation si la biométrie n'est plus enrôlée/dispo au montage). La valeur sentinelle n'est **jamais loggée** (LOG-001). La lib ne renvoyant pas de codes typés au rejet, le mapping vers `BiometricErrorCode` (`cancelled`/`not_enrolled`/`not_available`/`failed`/`unknown`) est **heuristique sur le message natif**. **Verrou opt-in pour tout utilisateur (guest inclus)** au MVP — « compte requis » relâché car F6 bloqué (réversible quand F6 existera).
- **Masquage app-switcher (F8)** : `useBiometricLock` re-verrouille **dès `inactive`/`background`** (avant le snapshot OS du multitâche, pour masquer le contenu dans la vignette) ET au retour `→ active` (garde l'exigence d'auth). L'overlay `BiometricLockScreen` masque l'arbre aux lecteurs d'écran (`importantForAccessibility`/`accessibilityElementsHidden`).

## Stack & dépendances principales

RN 0.85.2 · React 19.2.3 · Zod 4 · Zustand 5 · TanStack Query 5 · @react-navigation 7 · react-native-maps 1.26 · react-native-mmkv 4 · @gorhom/bottom-sheet 5 · react-native-reanimated 4 + worklets · react-native-keychain 10 · @sentry/react-native 8 · i18next 26 · lucide-react-native · react-native-svg · react-native-localize · react-native-config · react-native-image-picker · @dr.pogodin/react-native-fs (F7 p2) · @react-native-firebase/app + @react-native-firebase/database 25 (F4, API modulaire — importés en infra uniquement).

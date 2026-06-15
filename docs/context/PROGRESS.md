# PROGRESS.md — Mivro

> Journal de progression. Mis à jour à la fin de CHAQUE feature (cf. CLAUDE.md > AUTO-MAINTENANCE).
> Dernière mise à jour : 2026-06-15 (HEAD `f520911`).

## Tableau des sprints

| Sprint         | Période (commits)  | Statut     | Commit(s)                     |
| -------------- | ------------------ | ---------- | ----------------------------- |
| Setup          | 2026-04-27 → 04-30 | ✅ Fait    | `0600f76` → `7cdacc9`         |
| S01-02         | 2026-04-30 → 05-01 | ✅ Fait    | `c8dcb29` `a1065f2` `0e92689` |
| Rename         | 2026-05-07         | ✅ Fait    | `8dbaba3` `8d6425e`           |
| S03-04         | 2026-05-07         | ✅ Fait    | `593ae51` `1ff8ad6`           |
| F1             | 2026-05-08         | ✅ Fait    | `0e2db7c`                     |
| S05-06 (F2)    | 2026-05-08         | ✅ Fait    | `cf70fce` `eb022c9`           |
| S07-08 (F3)    | 2026-05-10 → 05-11 | ✅ Fait    | `0bca95f` `4804539`           |
| QA P0          | 2026-05-25         | ✅ Fait    | `f520911`                     |
| QA P1          | —                  | 🔜 À faire | —                             |
| F7 Profil      | —                  | 📋 Backlog | —                             |
| F4 Temps réel  | —                  | 📋 Backlog | —                             |
| F5 Partage     | —                  | 📋 Backlog | —                             |
| F8 Biométrie   | —                  | 📋 Backlog | —                             |
| F6 Auth        | —                  | 📋 Backlog | —                             |
| ADR rattrapage | —                  | 📋 Backlog | —                             |
| PostHog        | —                  | 📋 Backlog | —                             |
| Beta           | —                  | 📋 Backlog | —                             |

---

## Détail des features livrées

### Setup + S01-02 — Fondations (`7cdacc9` → `0e92689`)

- Init RN 0.85.2, New Architecture ON, bundle id `com.cedricpineau.midpoint`.
- Navigation : `RootNavigator` (native-stack) + `BottomTabsNavigator`.
- Stores Zustand (`useAuthStore`, `usePreferencesStore`, `useSessionStore`) + persistance MMKV chiffrée (`MMKVStorageService`, `getEncryptionKey`, `zustand-mmkv-adapter`).
- Entités core (Zod) + DI container (`src/di/container.ts`, `queryClient.ts`).
- Observabilité Sentry (`SentryCrashReporter` + `sanitizers.ts` scrubbing RGPD).
- **Fichiers clés** : `di/container.ts`, `infrastructure/storage/*`, `infrastructure/crash/*`, `presentation/stores/*`.

### S03-04 — Geocoding + Geolocation (`593ae51`, `1ff8ad6`)

- `NominatimGeocodeService` (port `IGeocodeService`) + `useGeocodeQuery` (TanStack, cache 1 min, retry 2×).
- `RNGeolocationService` (port `IGeolocationService`) + reverse geocoding.
- Use cases `SearchAddressUseCase`, `GetCurrentLocationUseCase`.
- **Fichiers clés** : `infrastructure/geocode/`, `infrastructure/geolocation/`, `hooks/useGeocodeQuery.ts`.

### F1 — Création de session (`0e2db7c`)

- `CreateSessionScreen` : saisie 2-5 points, `AddressAutocomplete` (+ `AddressResultItem`), bouton GPS.
- Orchestration via `useCreateSessionFlow`, debounce saisie (`useDebounce`).
- **Fichiers clés** : `screens/CreateSessionScreen.tsx`, `molecules/AddressAutocomplete/`, `hooks/useCreateSessionFlow.ts`.

### F2 — Midpoint + carte (`cf70fce`, `eb022c9`)

- `CalculateMidpointUseCase` + utils `geo/centroid`, `geo/radius`, `geo/distance` (Haversine).
- `MapScreen` + `SessionMapView` (react-native-maps) : markers participants + cercle de zone.
- `useMidpointCalculation` (calcul + persistance store).
- **Fichiers clés** : `usecases/CalculateMidpointUseCase.ts`, `core/utils/geo/*`, `molecules/SessionMapView/`.

### F3 — POI Overpass (`0bca95f`, `4804539`)

- `OverpassPOIService` (port `IPOIService`) + `SearchPOIUseCase` + `usePOIQuery` (cache 5 min, retry 2×).
- `POIScreen` avec toggle liste/carte : `POIListView`, `POIMapView`, `POICard`, `POIDetailSheet` (@gorhom/bottom-sheet), `POIScreenHeader`, `CategoryChip`, `poiIcons`.
- **Fichiers clés** : `infrastructure/poi/OverpassPOIService.ts`, `screens/POIScreen.tsx`, `molecules/POI*`.

### QA P0 — 7 bugs critiques device (`f520911`)

- Correction de 7 bugs bloquants remontés au QA device (voir `01-checklist-qa-technique.md`).

---

## Historique des commits (annoté)

```
f520911  2026-05-25  fix(qa-p0)      7 bugs critiques device
4804539  2026-05-11  feat(poi-ui)    POI screen liste/carte           ← F3
0bca95f  2026-05-10  feat(poi)       Overpass POI service             ← F3
eb022c9  2026-05-08  feat(f2)        carte markers + cercle de zone   ← F2
cf70fce  2026-05-08  feat(midpoint)  centroïde + rayon                ← F2
0e2db7c  2026-05-08  feat(f1)        CreateSessionScreen + GPS        ← F1
1ff8ad6  2026-05-07  feat(geolocation) GPS + reverse geocoding        ← S03-04
593ae51  2026-05-07  feat(geocode)   Nominatim + TanStack Query       ← S03-04
8d6425e  2026-05-07  fix(babel)      export-namespace-from (zod v4)
8dbaba3  2026-05-07  chore           rename MidPoint → Mivro           ← ADR-011
0e92689  2026-05-01  feat(observability) Sentry crash reporting       ← S01-02
a1065f2  2026-05-01  feat(stores)    Zustand + MMKV + entités core     ← S01-02
c8dcb29  2026-04-30  feat(navigation) bottom tabs + stack             ← S01-02
7cdacc9  2026-04-30  chore           initial setup v0.1.0
8ae32d6  2026-04-30  docs            CLAUDE.md
a18979a  2026-04-30  chore           init RN 0.85.2
38abaa0  2026-04-30  first commit
0600f76  2026-04-27  Initial commit
```

---

## Métriques actuelles (2026-06-15)

| Métrique                           | Valeur                    |
| ---------------------------------- | ------------------------- |
| Fichiers code (`src/`, hors tests) | 91                        |
| Fichiers de tests                  | 52                        |
| Entités core                       | 6                         |
| Ports                              | 5                         |
| Use cases                          | 5                         |
| Adapters infrastructure            | 5 (+3 placeholders vides) |
| Stores Zustand                     | 3                         |
| Hooks custom                       | 7                         |
| Atoms / Molecules / Templates      | 4 / 9 / 1                 |
| Écrans                             | 5                         |
| Namespaces i18n × langues          | 7 × 2 (FR/EN)             |

> ⚠️ Coverage par couche **non mesurée ici** : `coverage/coverage-summary.json` absent. Lancer `npm run test:coverage` pour les chiffres réels (seuils CI : core 90% / infra 70% / presentation 50% / global 70%).

---

## Appris / pièges rencontrés

- **Zod v4 + Babel** : nécessite le plugin `@babel/plugin-transform-export-namespace-from` (fix `8d6425e`).
- **react-native-maps + `exactOptionalPropertyTypes`** : incompatibilité → `skipLibCheck: true` + shim `src/types/react-native-maps.d.ts` (alias tsconfig).
- **`@gorhom/bottom-sheet`** : utilisé pour `POIDetailSheet` (attention au `BottomSheetTextInput` si saisie dans une sheet).
- **react-native-reanimated 4** : plugin Babel requis (worklets) — vérifier `babel.config.js`.
- **Rename MidPoint → Mivro** : conflit App Store (ADR-011) ; le bundle id iOS historique reste `com.cedricpineau.midpoint`, le MMKV id est passé à `mivro-storage`.
- **Sentry `beforeSend`** : scrubbing obligatoire des coordonnées GPS / emails / tokens (`sanitizers.ts`) — RGPD.

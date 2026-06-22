# PROGRESS.md — Mivro

> Journal de progression. Mis à jour à la fin de CHAQUE feature (cf. CLAUDE.md > AUTO-MAINTENANCE).
> Dernière mise à jour : 2026-06-20 (F7 Profil passe 2 — photo — livrée/testée/reviewée, non commitée).

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
| QA P1          | 2026-06-15         | ✅ Fait    | `786a4e9` `ed7b0ee` `c01e29c` |
| F7 Profil (P1) | 2026-06-20         | ✅ Fait\*  | non commité                   |
| F7 Profil (P2) | 2026-06-20         | ✅ Fait\*  | non commité                   |
| F4 Temps réel  | —                  | 📋 Backlog | —                             |
| F5 Partage     | —                  | 📋 Backlog | —                             |
| F8 Biométrie   | —                  | 📋 Backlog | —                             |
| F6 Auth        | —                  | 📋 Backlog | —                             |
| ADR rattrapage | —                  | 📋 Backlog | —                             |
| PostHog        | —                  | 📋 Backlog | —                             |
| Beta           | —                  | 📋 Backlog | —                             |

\*F7 passes 1 **et** 2 livrées/testées/reviewées (APPROVED), pas encore commitées au moment de cette mise à jour. **F7 est désormais entièrement implémentée** (édition nom + avatars emoji + photo). Reste uniquement la vérification sur device (voir TODO.md). Prochaine feature : F5 Partage (ou F4 si Firebase prêt).

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

### QA P1 — accessibilité & robustesse (2026-06-15)

- **VoiceOver** : `SessionMapView` annonce la carte (prop `accessibilityLabel` + `accessible`/`role=image`), hint « Vue liste » clarifié dans `MapScreen`.
- **Erreur réseau** : `AddressAutocomplete` mappe `GeocodeError.code` → messages i18n dédiés (`geocode_network`/`rate_limited`/`server`), qui existaient mais étaient inutilisés.
- **GPS hors-ligne** : `GetCurrentLocationUseCase` renvoie `{ location, addressResolved }`; `useCreateSessionFlow` expose `gpsNotice`; `CreateSessionScreen` affiche une notice non-bloquante.
- **EmptyState / layout 200 %** : backdrop autocomplete 0.5→0.7, corps du sheet `flex:1`, compteur F1 `flexWrap` (à re-vérifier device).
- **Fichiers clés** : `AddressAutocomplete.tsx`, `SessionMapView.tsx`, `MapScreen.tsx`, `GetCurrentLocationUseCase.ts`, `useCreateSessionFlow.ts`, `CreateSessionScreen.tsx`, i18n `create`/`map`.
- **Tests** : +8 (network/rate-limited messages, map accessible, addressResolved true/false, gpsNotice). Total 603, `npm run check` vert.

### F7 — Profil, passe 1 (2026-06-20, non commité)

Première passe de la feature Profil : édition du `displayName` + sélection d'un avatar parmi **20 avatars emoji prédéfinis**. Le **photo picker est reporté en passe 2** (étape native, voir TODO).

- **Décision tranchée** : avatars **emoji-based** (pas de SVG vectoriel, pas de dépendance native), rendus via `<Text>` sur un fond coloré tiré de la palette du Design System. Lève la décision en attente « Avatars F7 : SVG ou emoji ». Voir ADR-012.
- **Core** :
  - `entities/Avatar.ts` — `AvatarSchema`, `AvatarIdSchema` (enum de 20 ids), liste `AVATARS` (emoji + `backgroundColor` palette), `getAvatarById` (lookup O(1), `safeParse` défensif → `undefined` si id inconnu), types `Avatar` / `AvatarId` / `PredefinedAvatar`.
  - `usecases/UpdateProfileUseCase.ts` — use case **pur** (pas de port, pas d'effet de bord) : `execute(current, patch)` valide le patch (`UpdateProfileInputSchema` : `displayName` trim 1..50, `avatarId` optionnel) puis re-valide le `User` complet via `UserSchema`. Câblé dans `di/container.ts` (`updateProfileUseCase`).
  - `entities/User.ts` et `entities/MidpointSession.ts` (participant) portent désormais un `avatarId?` (validé par `AvatarIdSchema`).
- **Presentation** :
  - Store : `useAuthStore.updateProfile(input)` (persisté MMKV) délègue à `UpdateProfileUseCase` ; exposé via le hook `useAuth`.
  - Atom `Avatar` (`atoms/Avatar/`) : rend l'emoji sur fond coloré, ou une initiale en fallback (`fallbackName`).
  - Molecule `AvatarPicker` (`molecules/AvatarPicker/`) : grille `radiogroup` accessible (A11Y-003).
  - `ParticipantCard` **refactorée** pour consommer l'atom `Avatar` → déduplication de la logique d'initiale.
  - `ProfileScreen` enrichi (édition nom + grille avatars).
- **i18n** : namespace `profile` complété FR + EN (`displayName.*`, `avatarPicker.*`, `avatarNames.*` pour les 20 ids).
- **Fichiers clés** : `core/entities/Avatar.ts`, `core/usecases/UpdateProfileUseCase.ts`, `core/entities/User.ts`, `core/entities/MidpointSession.ts`, `atoms/Avatar/`, `molecules/AvatarPicker/`, `molecules/ParticipantCard/`, `screens/ProfileScreen.tsx`, `stores/useAuthStore.ts`, `hooks/useAuth.ts`, `di/container.ts`, `i18n/locales/{fr,en}/profile.json`.
- **Tests** : 7 fichiers touchés (~80 cas) — nouveaux : `Avatar.test.ts` (entité), `UpdateProfileUseCase.test.ts`, `Avatar.test.tsx` (atom), `AvatarPicker.test.tsx`, `ProfileScreen.test.tsx` (intégration) ; modifiés : `ParticipantCard.test.tsx`, `useAuthStore.test.ts`. `npm run check` vert (**661 tests**), seuils de coverage respectés.
- **Reporté en passe 2** : photo picker (`react-native-image-picker` — npm install + pod install + permissions Info.plist/AndroidManifest) ; `avatarId` ajouté à `Participant` mais **pas encore peuplé** à la création de session (`useCreateSessionFlow`) — `ParticipantCard` l'affichera dès qu'il sera fourni.

### F7 — Profil, passe 2 : photo (2026-06-20, non commité)

Seconde passe de F7 : ajout d'une **photo de profil optionnelle** (galerie / caméra), en plus des avatars emoji. F7 est désormais **entièrement livrée**.

- **Libs ajoutées** : `react-native-image-picker` + `@dr.pogodin/react-native-fs` (npm install + `pod install` OK).
- **Architecture (découplage natif via port)** :
  - Port `IProfilePhotoService` (core) + adapter `ImagePickerProfilePhotoService` (infra, `src/infrastructure/media/`), reçoit le `crashReporter` par constructeur, câblé dans le container (`profilePhotoService`).
  - Hook `useProfilePhoto` (presentation) : orchestre pick → persist `photoUri` → cleanup, expose loading/error.
  - La presentation **n'importe jamais** les libs natives : tout passe par le port → testable sans device (mocks typés image-picker + FS).
- **Stockage FileSystem** (cf. CLAUDE.md > STORAGE, acté en **ADR-013**) : photo resize **200×200** (resize natif du picker via `maxWidth/maxHeight`) copiée dans `Documents/profile-photos/<uuid>.jpg` ; **seul le chemin** est stocké dans `User.photoUri` (Zod) et persisté MMKV. Cleanup best-effort de l'ancien fichier au remplacement / à la suppression.
- **Core** : `User.photoUri?` (Zod, `min(1)`) sur les deux variantes guest/auth ; `UpdateProfileUseCase` gère set (chemin) / clear (`photoUri: null` → champ retiré).
- **Presentation** :
  - Atom `Avatar` étendu : priorité de rendu **photo (`<Image>`) > emoji (`avatarId`) > initiale**.
  - `ProfileScreen` : boutons galerie / caméra / supprimer + états loading / erreur (via `useProfilePhoto`).
  - `useCreateSessionFlow` : le participant ajouté via GPS « ma position » reçoit l'`avatarId` (emoji) du user courant — **jamais la photo** (cohérence légère + vie privée).
- **Permissions natives** : iOS `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` (Info.plist) ; Android `CAMERA` (la galerie utilise le Photo Picker système, sans permission de lecture).
- **i18n** : namespace `profile.photo` FR + EN (boutons, loading, erreurs typées).
- **Fichiers clés** : `core/ports/IProfilePhotoService.ts`, `infrastructure/media/ImagePickerProfilePhotoService.ts`, `hooks/useProfilePhoto.ts`, `core/entities/User.ts`, `core/usecases/UpdateProfileUseCase.ts`, `atoms/Avatar/`, `screens/ProfileScreen.tsx`, `hooks/useCreateSessionFlow.ts`, `di/container.ts`, `i18n/locales/{fr,en}/profile.json`, `ios/.../Info.plist`, `android/.../AndroidManifest.xml`.
- **Tests** : ~133 cas F7 au total ; suite globale **718 tests** (63 suites) verts, seuils de coverage respectés. Nouveaux/étendus : entité `User.photoUri`, `UpdateProfileUseCase` clear, adapter (mock image-picker + FS), hook `useProfilePhoto`, atom `Avatar` (photo), intégration `ProfileScreen`.
- **Reste** : vérification sur device (permissions réelles, resize effectif, persistance du chemin après kill, cleanup FS réel, ouverture du picker) — voir TODO.md.

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

## Métriques actuelles (2026-06-20)

| Métrique                           | Valeur                      |
| ---------------------------------- | --------------------------- |
| Fichiers code (`src/`, hors tests) | 95                          |
| Fichiers de tests                  | 59                          |
| Tests (cas) — `npm run check`      | 718                         |
| Entités core                       | 7 (+`Avatar`)               |
| Ports                              | 6 (+`IProfilePhotoService`) |
| Use cases                          | 6 (+`UpdateProfile`)        |
| Adapters infrastructure            | 6 (+3 placeholders vides)   |
| Stores Zustand                     | 3                           |
| Hooks custom                       | 8 (+`useProfilePhoto`)      |
| Atoms / Molecules / Templates      | 5 / 10 / 1                  |
| Écrans                             | 5                           |
| Namespaces i18n × langues          | 7 × 2 (FR/EN)               |

> Atoms : +`Avatar`. Molecules : +`AvatarPicker`. Ports : +`IProfilePhotoService` (adapter `ImagePickerProfilePhotoService`). Hooks : +`useProfilePhoto`.
> ⚠️ Coverage par couche **non mesurée ici** : `coverage/coverage-summary.json` absent. La review F7 indique seuils respectés ; lancer `npm run test:coverage` pour les chiffres réels (seuils CI : core 90% / infra 70% / presentation 50% / global 70%).

---

## Appris / pièges rencontrés

- **Zod v4 + Babel** : nécessite le plugin `@babel/plugin-transform-export-namespace-from` (fix `8d6425e`).
- **react-native-maps + `exactOptionalPropertyTypes`** : incompatibilité → `skipLibCheck: true` + shim `src/types/react-native-maps.d.ts` (alias tsconfig).
- **`@gorhom/bottom-sheet`** : utilisé pour `POIDetailSheet` (attention au `BottomSheetTextInput` si saisie dans une sheet).
- **react-native-reanimated 4** : plugin Babel requis (worklets) — vérifier `babel.config.js`.
- **Rename MidPoint → Mivro** : conflit App Store (ADR-011) ; le bundle id iOS historique reste `com.cedricpineau.midpoint`, le MMKV id est passé à `mivro-storage`.
- **Sentry `beforeSend`** : scrubbing obligatoire des coordonnées GPS / emails / tokens (`sanitizers.ts`) — RGPD.
- **i18n clés mortes** : les messages `errors.geocode_*` existaient en FR/EN mais n'étaient jamais utilisés (l'UI affichait `noResults`). Penser à vérifier que les clés d'erreur sont bien câblées à l'UI.
- **Fallback silencieux trompeur** : `GetCurrentLocationUseCase` masquait l'échec du reverse geocode derrière une adresse « lat, lon ». Un use case qui « dégrade » doit **remonter le fait** (drapeau) pour que l'UI puisse informer l'utilisateur.
- **Avatars emoji plutôt que SVG (F7)** : pour le MVP, des avatars emoji rendus via `<Text>` évitent toute dépendance native / asset bundling, tout en restant accessibles (label par avatar). Décision actée en ADR-012.
- **Use case pur sans port** : `UpdateProfileUseCase` ne prend aucun port (transformation pure `User + patch → User`). Pas besoin d'injecter un port quand il n'y a pas d'I/O — mais on le câble quand même dans le container pour rester cohérent et faciliter un futur port (ex : sync serveur).
- **Double validation Zod défensive** : `UpdateProfileUseCase` valide le patch ET re-valide le `User` complet (`UserSchema`) — la discriminated union guest/auth peut casser si on patche naïvement. `getAvatarById` fait du `safeParse` pour tolérer un `avatarId` inconnu venant du storage (robustesse, pas de throw).
- **Découpler les libs natives derrière un port (F7 p2)** : `react-native-image-picker` / `@dr.pogodin/react-native-fs` ne sont importés QUE par l'adapter `ImagePickerProfilePhotoService` (infra). La presentation passe par `IProfilePhotoService` (DI) → testable sans device (mocks typés), et un futur backend (upload S3) ne touche pas l'UI. Le contrat « ne pas faire fuiter de type natif au-delà de l'infra » est ce qui rend la couche substituable.
- **Stocker un chemin, pas un binaire (F7 p2)** : la photo de profil est copiée sur le FileSystem (`Documents/profile-photos/<uuid>.jpg`) et seul le **chemin** est persisté MMKV (`User.photoUri`). Évite de gonfler le store (pas de base64), survit aux redémarrages (≠ URI `tmp/` du picker qui peut être purgée). Voir ADR-013.
- **Cleanup FileSystem best-effort (F7 p2)** : `deletePhoto` (suppression de l'ancien fichier au remplacement / à la suppression) **ne doit jamais rejeter** — un fichier déjà absent ou non supprimable ne doit pas faire échouer la mise à jour du profil. À durcir côté contrat (TSDoc) et `normalizePath` (voir TODO dette F7).
- **`BottomSheet` ≠ `BottomSheetModal`** (@gorhom) : `BottomSheet` n'est PAS un portail — placé dans un `ScrollView`, il se positionne dans le flux du scroll et son contenu « fermé » s'affiche en bas du contenu (champ fantôme F1). Pour un sheet par-dessus un écran scrollable, utiliser `BottomSheetModal` + `BottomSheetModalProvider` (rendu en portail racine). `present()`/`dismiss()` au lieu de `snapToIndex(0)`/`close()`, `onDismiss` au lieu de `onClose`, pas de prop `index`.

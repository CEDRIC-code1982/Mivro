# PROGRESS.md — Mivro

> Journal de progression. Mis à jour à la fin de CHAQUE feature (cf. CLAUDE.md > AUTO-MAINTENANCE).
> Dernière mise à jour : 2026-09-26 (harness v2 — le harness devient une frontière de confiance).

## Harness v2 — frontière de confiance (2026-09-26, branche `harness/beton`, non commité)

L'audit red-team de ce jour a montré qu'on pouvait contourner le harness de bout en bout : il pouvait
se réécrire lui-même, `--no-verify` était pré-approuvé, et il n'y avait ni CI ni protection de
`develop`. Réponse en quatre couches (**ADR-016**, journal **J-026 à J-035**) :

- **gardes** `PreToolUse` Bash et Edit ;
- **verrou** `scripts/harness.lock` ;
- **hook Stop** et **verdict reviewer scellé** au pre-commit ;
- **CI GitHub Actions** (`battery`, `security`, `harness-guard`) et protection de branche prête à
  être appliquée.

Une **table unique de capteurs** (`scripts/sensors.sh`, reprise de SmartBLE) alimente
`npm run check`, le Stop, le pre-push et la CI.

Nouveaux capteurs :

- identité native (J-023) ;
- liste blanche des dépendances ;
- références du journal ;
- shellcheck du harness ;
- parité des catalogues i18n FR/EN (31 cas) ;
- `JSON.parse` et `Response.json()` qui renvoient `unknown`.

**2026-09-28, session déverrouillée.** Les constats de la revue (J-036 à J-039, J-041) sont
corrigés :

- `harness-guard` passe sous `pull_request_target` ;
- le verdict est lu dans le dernier message du reviewer, vérifié dans le binaire 2.1.283 ;
- le garde Bash est réécrit ;
- `check-diff` refuse les configs imbriquées et échoue fermé.

Le déverrouillage est vérifié en réel. `check:harness` compte 374 assertions après six revues (J-036 à J-046, closes le 2026-10-05 ;
harness défini par zones produit, comparées sans casse). Le verrou est généré (2026-10-05) et le stage `check` est vert. La septième revue a trouvé J-047
(casse du chemin absolu), en attente de session déverrouillée. Le stage `push` est vert sauf `audit` (J-040 : `npm audit
fix` à faire en branche dédiée). Mise en service : RUNBOOK > « Harness ».

## ADR rattrapage — série ADR-001→014 complète (2026-07-14)

Documentation rétroactive des décisions d'architecture manquantes, au format imposé
(Contexte / Décision / Raisons / Compromis / Alternatives écartées), dans
`docs-site/docs/adr/` :

- **ADR-001** Nominatim + Overpass (OSM) vs Google — géocodage/POI
- **ADR-002** Clean Architecture + Ports/Adapters (principes ; forme actualisée par ADR-014)
- **ADR-003** React Native CLI (bare) vs Expo
- **ADR-004** Auth « guest-first » (compte optionnel)
- **ADR-005** Zustand + TanStack Query vs Redux
- **ADR-007** New Architecture (Fabric + TurboModules)
- **ADR-008** MMKV + Keychain + AsyncStorage (stockage par sensibilité)
- **ADR-009** Montée en charge des APIs externes (usage OSM → self-host)
- **ADR-010** Observabilité Sentry + PostHog (orientés vie privée)
- **ADR-014** _(bonus)_ Réorganisation feature-first + `services/` + tests co-localisés — documente le refactor du 2026-07-13 et actualise ADR-002 (forme).

ADR-006/011/012/013 existaient déjà. La série est désormais **complète et sans trou**.
Aucun code touché ; commits sur `develop`.

## Refactor archi — layer-first → feature-first + `services/` + tests co-localisés (2026-07-13)

**Objectif** : aligner l'organisation des dossiers sur `p0153_lineguard_studio_mobile` (feature-first + couche `services/{domain,infra,utils}` + `serviceContainer`, state Zustand centralisé), **en ajoutant** des **tests co-localisés** (chaque `*.test` à côté de son sujet). **Périmètre = dossiers uniquement** : stack inchangée (Zustand/Zod/TanStack), adapters classes conservés, **Atomic Design gardé** (DS-004). Zéro changement de comportement.

**Fait** (refactor purement structurel, `git mv` → historique préservé, `npm run check` vert, **1133 tests** intacts) :

- `core/{entities,theme,utils}` → `src/entities/`, `src/theme/`, `src/services/utils/`.
- `core/{usecases,ports}` → `src/services/domain/<domaine>/` (par domaine : midpoint, geocode, geolocation, poi, sharing, realtime, user, biometric, storage, crash).
- `infrastructure/` → `src/services/infra/` ; `di/container.ts` → `src/services/serviceContainer.ts` ; `di/queryClient.ts` → `src/services/queryClient.ts`.
- `presentation/stores` → `src/state/` ; `presentation/navigation` → `src/navigations/` ; `presentation/App.tsx` → `src/App.tsx`.
- `presentation/screens` + hooks de feature → `src/features/{Session,POI,Sharing,Profile,Biometric}/{screens/<Nom>/,hooks/}` ; hooks transverses (`useDebounce`, `useCrashReporter`) → `src/hooks/` ; `poiIcons` → `features/POI/utils/`.
- `presentation/components` → `src/components/` (arbo Atomic Design inchangée).
- **Tests** : tous déplacés de `src/__tests__/**` à côté de leur sujet ; intégration en `*.integration.test.tsx` ; helpers → `src/test-utils/` ; E2E Maestro → `e2e/` (racine).
- **Config** : alias `@core/@infrastructure/@presentation` remplacés par `@features @services @components @state @entities @theme @hooks @navigations @test-utils` (tsconfig + babel + jest) ; seuils de coverage jest remappés sur les nouvelles couches.
- **Docs** : CLAUDE.md v8.9, ARCHITECTURE.md réécrit (overview + arbre + règle de dépendance + alias).

**Reporté (non bloquant)** : barrels `features/<F>/index.ts` (imports en chemin direct pour l'instant).

## F8 — Verrou biométrique (Face ID / Touch ID / empreinte) — livrée + testée + reviewée APPROVED (2026-06-29, non commitée)

**Décision produit (MVP, réversible)** : verrou biométrique **opt-in pour TOUT utilisateur, guest inclus** — la contrainte « compte requis » du backlog est **relâchée** car F6 (Auth) reste bloqué par les comptes dev. À re-durcir quand F6 existera (pas d'ADR dédié — décision MVP consignée en TODO « Décisions en attente »).

**Architecture (keychain confiné à l'infra)** : `react-native-keychain` n'est importé QUE par l'adapter ; core et presentation passent par le port `IBiometricService` (DI) → testable sans device (port mocké), swap = 1 ligne DI.

- **Core** : port `IBiometricService` (`getSupportedType`, `isEnrolled`, `authenticate(reason)`, `enableLock`, `disableLock`) + types `BiometricType` (`face`/`fingerprint`/`iris`) + `BiometricErrorCode` (`not_available`/`not_enrolled`/`cancelled`/`failed`/`unknown`) + erreur typée `BiometricError`.
- **Infra** : `KeychainBiometricService` (`src/infrastructure/security/`) — pose un **secret sentinelle** en `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE` + `ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY` (le passcode device sert de **secours natif** anti-lockout) ; `authenticate` relit la sentinelle (déclenche le prompt natif) et compare **sans jamais logger la valeur** (LOG-001) ; mappe `BIOMETRY_TYPE` natif → `BiometricType` ; mapping erreurs **heuristique sur le message natif** (la lib ne fournit pas de codes typés au rejet) ; reçoit le `crashReporter` (report sauf annulation/échec attendus).
- **Presentation** :
  - Store : `usePreferencesStore.biometricEnabled` (bool, **persisté MMKV**) + `setBiometricEnabled`.
  - Hook `useBiometricLock` : détecte `supportedType`, gère `isLocked` au lancement, **re-lock dès `inactive`/`background`** (masque le contenu dans l'app-switcher) **ET** au retour `→ active` ; expose `unlock`, `enableLock`/`disableLock` (auth de confirmation à l'activation), et l'**échappatoire anti-lockout** `disableLockAndContinue` + `showDisableEscape` (après 3 échecs ou biométrie inutilisable) ; **auto-désactivation** si la biométrie n'est plus enrôlée/dispo au montage. Sélecteurs Zustand atomiques (évite la boucle de rendu v5).
  - Molecule `BiometricLockScreen` (`molecules/BiometricLockScreen/`) : overlay plein écran bloquant, **auto-prompt différé jusqu'à `supportedType` connu** (libellé correct Face ID/Touch ID), message d'erreur i18n, bouton « Désactiver le verrou et continuer » (échappatoire), a11y `accessibilityViewIsModal`/live region.
  - Gate : `App.tsx` définit `BiometricLockGate` (consomme `useBiometricLock`) enveloppant l'arbre ; quand verrouillé, masque l'arbre aux lecteurs d'écran (`importantForAccessibility="no-hide-descendants"` Android + `accessibilityElementsHidden` iOS) et rend l'overlay par-dessus.
  - Toggle opt-in dans `ProfileScreen`.
- **DI** : `biometricService` (`KeychainBiometricService`, reçoit le `crashReporter`) câblé dans `di/container.ts` (swap = 1 ligne).
- **i18n** : namespace `biometric` FR + EN (titre/sous-titre du verrou, types, erreurs typées, échappatoire). Zéro string hardcodée.
- **Natif** : iOS `NSFaceIDUsageDescription` (Info.plist) ; Android `<uses-permission android:name="android.permission.USE_BIOMETRIC" />` (AndroidManifest).
- **Fichiers clés** : `core/ports/IBiometricService.ts`, `infrastructure/security/KeychainBiometricService.ts`, `presentation/hooks/useBiometricLock.ts`, `presentation/components/molecules/BiometricLockScreen/`, `presentation/stores/usePreferencesStore.ts`, `presentation/App.tsx`, `presentation/screens/ProfileScreen.tsx`, `di/container.ts`, `i18n/index.ts`, `i18n/locales/{fr,en}/biometric.json`, `ios/Mivro/Info.plist`, `android/app/src/main/AndroidManifest.xml`.
- **Tests** : ~140 cas F8 ; suite globale **1133 tests** (85 suites) verts, `npm run check` vert, seuils de coverage respectés. Keychain mocké via le port `IBiometricService` (zéro `any`). Nouveaux fichiers : `IBiometricService.test.ts`, `infrastructure/security/` (adapter), `useBiometricLock.test.tsx`, `BiometricLockScreen.test.tsx` ; modifiés : `usePreferencesStore.test.ts`, `ProfileScreen.test.tsx` (intégration toggle).

**Corrections de review appliquées (après 1 tour) — 1 bloquant + 1 majeur + 2 mineurs** :

1. **(bloquant) anti-lockout double filet** : `BIOMETRY_ANY` seul enfermait l'utilisateur si la biométrie devenait indisponible (enrôlement retiré / lockout « too many attempts ») → ajout du **fallback passcode device** (`BIOMETRY_ANY_OR_DEVICE_PASSCODE`) **ET** d'une échappatoire applicative (`disableLockAndContinue` + auto-désactivation si biométrie inutilisable au montage + bouton après 3 échecs).
2. **(majeur) masquage app-switcher** : le re-lock ne se faisait qu'au retour `→ active`, exposant le contenu dans la vignette du multitâche → re-lock avancé dès `inactive`/`background` (avant le snapshot OS).
3. **(mineur) a11y du gate** : masquer l'arbre sous-jacent aux lecteurs d'écran quand verrouillé (`importantForAccessibility`/`accessibilityElementsHidden`).
4. **(mineur) prompt différé** : l'auto-prompt partait avant que `supportedType` soit résolu → libellé générique ; différé jusqu'à `supportedType !== null` pour afficher « Face ID »/« Touch ID ».

**Reste à Cédric** : tester sur **device réel** (Face ID / Touch ID / empreinte ; simulateur iOS : Features → Face ID → Enrolled/Matching), fallback passcode device, échappatoire anti-lockout, masquage de l'app-switcher (voir TODO.md). Point edge iOS à vérifier (re-lock parasite `previous==='inactive'` au 1er lancement) consigné en dette.

## F5 — Partage de session (deep link + join collaboratif live) — livrée + testée + reviewée APPROVED (2026-06-20, non commitée)

**Décision produit** : join = **participant collaboratif** (l'invité ajoute son point de départ → midpoint **recalculé** → tous voient le nouveau midpoint + positions live F4) → **session collaborative live** synchronisée via Firebase RTDB. Session partagée sur **Firebase RTDB** (étend la structure F4 sans toucher au nœud `participants`). Lien = `mivro://session/{sessionId}`. Expiration 24h (guest) / 7j (compte), encodée dans `meta.expiresAt`, vérifiée à l'ouverture.

**Modèle Firebase étendu** (distinct des positions live F4) :

```text
sessions/{sessionId}/
  meta/                 { createdAt, expiresAt, ownerType: guest|account, status: open|closed, midpoint?, midpointRadius? }
  members/{memberId}/   { displayName, avatarId?, startLocation: { latitude, longitude, address? } }  ← points de DÉPART
  participants/{id}/    positions GPS live (F4 — jamais altéré par F5)
```

**Fichiers clés**

- core entités : `src/core/entities/SharedSession.ts` (meta + members, Zod ; `computeExpiresAt` 24h/7j, `buildShareLink`, TTL constants `SHARE_TTL_GUEST_MS`/`SHARE_TTL_ACCOUNT_MS`)
- core port : `src/core/ports/ISessionShareService.ts` (`shareSession`/`joinSession`/`subscribeToSharedSession`/`deleteSharedSession` + `SessionShareError` typée)
- core usecases : `src/core/usecases/ShareSessionUseCase.ts`, `JoinSessionUseCase.ts` (vérif expiration/statut, ajout membre, **recalcul midpoint** via `CalculateMidpointUseCase` avec relecture du roster anti-race)
- infra adapter : `src/infrastructure/realtime/FirebaseSessionShareService.ts` (API modulaire v25, réutilise l'URL EU, validation Zod, error mapping, LOG-001, **n'altère jamais** le nœud F4 `participants`)
- presentation : `src/presentation/stores/useSharedSessionStore.ts` (non persisté, `isOwner`), `hooks/useSessionShare.ts` (share natif + Alert succès/erreur), **`hooks/useSharedSessionSync.ts`** (abonnement live RTDB monté dans `MapScreen`, désabonnement au démontage/changement de sessionId), `screens/JoinSessionScreen.tsx` (loading/success/error, a11y), `navigation/linking.ts` (scheme `mivro://`) ; bouton Partager sur `MapScreen` ; action `loadSharedSession` sur `useSessionStore` ; suppression RGPD du nœud (`deleteSharedSession`) au reset par le PROPRIÉTAIRE dans `useCreateSessionFlow`
- i18n : `src/i18n/locales/{fr,en}/share.json` (namespace `share`)
- DI : `sessionShareService` + `shareSessionUseCase` + `joinSessionUseCase`
- natif : `ios/Mivro/Info.plist` (`CFBundleURLTypes` scheme `mivro`), `android/app/src/main/AndroidManifest.xml` (`<intent-filter>` scheme `mivro`)
- rules : `database.rules.json` (+ `sessions/$sessionId/meta` + `members/$memberId`)

**Qualité** : ~143 cas F5 ajoutés ; suite globale **1021 tests** (81 suites) verts, `npm run check` vert ; coverage core 100 % / infra ~98 % / presentation ~94 %.

**5 corrections de review appliquées (après 1 tour)** : (1) **join live** — l'invité ne voyait pas les mises à jour collaboratives → ajout du hook `useSharedSessionSync` (abonnement RTDB monté dans `MapScreen`) ; (2) **suppression RGPD** — le nœud Firebase n'était jamais supprimé → `deleteSharedSession` déclenché explicitement au reset par le **propriétaire** (un joiner ne purge que son local) ; (3) **gestion d'erreurs** — `JoinSessionScreen` distingue `expired`/`not_found`/`closed` et états loading/error ; (4) **anti-race** — `JoinSessionUseCase` **relit le roster** avant de recalculer le midpoint (évite le lost-update quand deux invités rejoignent simultanément) ; (5) **rules** — `sessions/$sessionId/meta` + `members/$memberId` validés (forme alignée Zod, `$other` refusé aux feuilles).

**Reste à Cédric** : redéployer les rules étendues (`firebase deploy --only database`), `pod install`, rebuild natif (scheme deep link), tester l'ouverture du lien (`xcrun simctl openurl booted mivro://session/<id>` / `adb shell am start -a android.intent.action.VIEW -d "mivro://session/<id>"`) + join multi-devices + recalcul live + suppression en fin de session (voir TODO.md).

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
| F7 Profil (P1) | 2026-06-20         | ✅ Fait    | `0ade2e2`                     |
| F7 Profil (P2) | 2026-06-22         | ✅ Fait    | `ebf1215`                     |
| F4 Temps réel  | 2026-06-24 → 06-25 | ✅ Fait    | `1c73eeb` `c9a76d1`           |
| F5 Partage     | 2026-06-29         | ✅ Fait    | `d112edb`                     |
| F8 Biométrie   | 2026-06-29         | ✅ Fait\*  | non commité                   |
| F6 Auth        | —                  | 📋 Backlog | —                             |
| ADR rattrapage | —                  | 📋 Backlog | —                             |
| PostHog        | —                  | 📋 Backlog | —                             |
| Beta           | —                  | 📋 Backlog | —                             |

F7 (passes 1 & 2) est désormais **commitée** (`0ade2e2`, `ebf1215`). F4 et F5 sont désormais **commitées** (`1c73eeb`+`c9a76d1` pour F4, `d112edb` pour F5 ; `3385acf` ajoute le `.gitignore` des configs natives Firebase + une Cloud Function de purge RGPD).
\*F8 Biométrie : code applicatif **livré + testé (1133 tests) + reviewé APPROVED** (après 1 tour de corrections), pas encore commité au moment de cette mise à jour. **Restent à Cédric** : vérif sur device réel (Face ID/Touch ID/empreinte, fallback passcode, échappatoire anti-lockout, masquage app-switcher) — voir TODO.md.
\*F4 Temps réel Firebase : code applicatif **livré + testé (867 tests) + reviewé APPROVED** (après 1 tour de corrections review), pas encore commité au moment de cette mise à jour. Le **projet Firebase EU (`mivro-40125`, europe-west1) est désormais fourni et câblé** (URL, env var, rules, `firebase.json` — voir « Câblage Firebase EU » + ADR-006) : la PAUSE « transport » est levée. **Restent à Cédric** : enregistrer les apps iOS/Android (fichiers `GoogleService-Info.plist` / `google-services.json`), déployer les rules, `pod install`, puis vérif device (voir TODO.md).
\*F5 Partage de session : code applicatif + config native + rules **livrés + testés (1021 tests) + reviewés APPROVED** (après 1 tour de corrections review), pas encore commité. Bâti sur F4 (RTDB EU), étend le modèle Firebase (`meta` + `members`) sans toucher au nœud `participants`. **Restent à Cédric** : redéployer les rules étendues, `pod install`, rebuild natif, tester l'ouverture du deep link + join multi-devices (voir TODO.md). Prochaine feature sans blocker : **F8 Biométrie** (F6 Auth bloqué par comptes dev).

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

### F4 — Temps réel Firebase (multi-participants live) — livrée + testée + reviewée APPROVED (2026-06-20, non commité)

> Transport tranché : **Firebase Realtime Database** (`@react-native-firebase/app` + `/database` v25, **API modulaire**) — décision actée en **ADR-006**. Code applicatif **livré + testé (867 tests) + reviewé APPROVED** (1 tour de corrections review appliqué). Le **projet Firebase EU est désormais fourni et câblé** (`mivro-40125`, europe-west1 ; URL, env var, rules, `firebase.json` — voir « Câblage Firebase EU » ci-dessous). Restent à Cédric les fichiers de config natifs (`GoogleService-Info.plist` iOS / `google-services.json` Android), le déploiement des rules et `pod install`. Aucun faux fichier de config n'a été créé.

- **Core** :
  - Entité `RealtimeParticipant` (Zod strict) : `participantId`, `latitude`, `longitude`, `updatedAt` (epoch ms serveur), `speed` (km/h), `heading` [0,360), `isOnline`. + `RealtimeLocationUpdate` (sous-ensemble publié par le device).
  - Port `IRealtimeService` : `subscribeToSession → unsubscribe`, `publishLocation`, `leaveSession` + `RealtimeError` typée (`not_configured`/`network`/`permission_denied`/`invalid_data`/`unknown`).
  - `TrackParticipantsUseCase` : orchestre subscribe/publish/leave, valide les entrées (Zod sur la position), **aucune dépendance infra**.
  - Port `IGeolocationService` étendu : `watchPosition(onSample, onError?, options?) → clearWatch` + types `PositionSample` (coordonnées + speed km/h + heading), `WatchPositionOptions`.
- **Infrastructure** :
  - `FirebaseRealtimeService` (`infrastructure/realtime/`) : implémente le port via l'API modulaire (`getDatabase/ref/onValue/onDisconnect/update/remove/serverTimestamp`). Structure exacte `sessions/{sessionId}/participants/{participantId}`. **Valide chaque entrée lue via Zod** (TS-004, entrées invalides ignorées + reportées), try/catch partout (ERR-001), mapping erreurs → `RealtimeError`, crashReporter, logs LOG-001 **sans coordonnées brutes**. `onDisconnect → isOnline=false` armé avant l'écriture ; `leaveSession` annule l'`onDisconnect` puis `remove` le nœud (RGPD).
  - `RNGeolocationService.watchPosition` : normalise la vitesse native m/s → km/h, borne le cap [0,360), valide via Zod, expose une fonction d'arrêt (`clearWatch`).
- **Presentation** :
  - `useRealtimeStore` (Zustand, **NON persisté** — RGPD) : map `participantId → RealtimeParticipant`, `status` (idle/connecting/connected/error), `hasSharingConsent`, actions start/stop/setParticipants/setStatus/setSharingConsent. `stopTracking` purge l'état (aucune position en mémoire).
  - Hook `useRealtimeTracking` : relie `geoloc.watchPosition → publish` et `subscribe → store`. **Opti batterie** : publication throttlée 5s si speed>5 km/h / 30s à l'arrêt ; **coupée si l'app passe en arrière-plan (AppState)**. La publication n'a lieu **que si `hasSharingConsent=true`** (RGPD) ; l'abonnement (voir les autres) reste autorisé sans consentement. `stop()` → `leaveSession` (remove du nœud). N'importe jamais firebase (passe par le port + DI).
  - UI : `SessionMapView` étendu avec des **markers live distincts** (halo online/offline) des points de départ ; molecule `LiveParticipantsList` (vue liste a11y A11Y-006 : nom, statut online/offline, distance au midpoint) ; molecule `RealtimeConsentModal` (consentement RGPD **explicite et séparé**). `MapScreen` orchestre : bouton « Partager / Arrêter », modal de consentement, markers live + section liste live dans la modal a11y, `leaveSession` au démontage.
- **DI** : `IRealtimeService → FirebaseRealtimeService` + `TrackParticipantsUseCase` câblés dans `di/container.ts` (swap = 1 ligne).
- **i18n** : namespace `realtime` FR + EN (consentement, statut online/offline, liste, actions, a11y, erreurs typées). Zéro string hardcodée.
- **Config native (préparée pour Cédric)** :
  - iOS `Podfile` : ajout de `use_modular_headers!` (requis par les pods Swift Firebase).
  - Android : classpath `com.google.gms:google-services:4.4.2` (`android/build.gradle`) + `apply plugin: "com.google.gms.google-services"` (`android/app/build.gradle`).
  - iOS init Firebase : **aucun `[FIRApp configure]` manuel** — RNFirebase v25 auto-configure via `GoogleService-Info.plist` au build (AppDelegate inchangé).
- **Fichiers clés** : `core/entities/RealtimeParticipant.ts`, `core/ports/IRealtimeService.ts`, `core/ports/IGeolocationService.ts` (watchPosition), `core/usecases/TrackParticipantsUseCase.ts`, `infrastructure/realtime/FirebaseRealtimeService.ts`, `infrastructure/geolocation/RNGeolocationService.ts`, `presentation/stores/useRealtimeStore.ts`, `presentation/hooks/useRealtimeTracking.ts`, `presentation/components/molecules/{LiveParticipantsList,RealtimeConsentModal}/`, `presentation/components/molecules/SessionMapView/SessionMapView.tsx`, `presentation/screens/MapScreen.tsx`, `di/container.ts`, `i18n/locales/{fr,en}/realtime.json`, `ios/Podfile`, `android/build.gradle`, `android/app/build.gradle`.
- **Tests** : ~168 cas F4 ajoutés (+2 pour les branches de `db()`, voir « Câblage Firebase EU ») ; suite globale **867 tests** (71 suites) verts, seuils de coverage respectés. Firebase mocké via le port `IRealtimeService`, `watchPosition` mocké via le port geoloc (zéro `any`). Nouveaux fichiers : `RealtimeParticipant.test.ts`, `IRealtimeService.test.ts`, `TrackParticipantsUseCase.test.ts`, `infrastructure/realtime/` (adapter), `useRealtimeStore.test.ts`, `useRealtimeTracking.test.tsx`, `LiveParticipantsList.test.tsx`, `RealtimeConsentModal.test.tsx` ; modifiés : `RNGeolocationService.test.ts` (watchPosition), `SessionMapView.test.tsx` (markers live), `MapScreen.test.tsx` (orchestration). `npm run check` vert.
- **Bug corrigé (1)** : **boucle de rendu Zustand v5** — un sélecteur de `useRealtimeStore` renvoyant un **nouvel objet** à chaque appel provoquait des re-renders infinis (« Maximum update depth exceeded »). Corrigé en mémoïsant la dérivation (`useMemo`) / en sélectionnant des références stables. Voir « Appris ».
- **3 corrections de review** appliquées (après 1 tour) : (1) le **watch GPS** est désormais **conditionné au consentement** (`hasSharingConsent`) — on n'arme plus le capteur GPS tant que l'utilisateur n'a pas consenti au partage, pas seulement la publication ; (2) + (3) corrections de robustesse/cohérence remontées par la review (mapping erreurs / cycle de vie du watch).
- **tsc** : `npx tsc --noEmit` à **0 erreur** ; lint + prettier verts sur les fichiers touchés.
- **Reste** : **PAUSE OBLIGATOIRE Cédric** — enregistrer les apps iOS/Android + fournir `GoogleService-Info.plist` (iOS) + `google-services.json` (android/app/), déployer les rules, `pod install` (iOS), puis vérif device (live multi-appareils + opti batterie réelle). Voir « Câblage Firebase EU » ci-dessous + TODO.md.

#### Câblage Firebase EU (2026-06-20)

Le projet Firebase a été **fourni et câblé** côté code (la PAUSE OBLIGATOIRE « transport » est levée ; restent des actions console/natives pour Cédric — voir TODO.md). Livré + testé (**867 tests**) + reviewé APPROVED.

- **Projet** : `mivro-40125` — Realtime Database région **europe-west1** (EU → **RGPD OK**). URL : `https://mivro-40125-default-rtdb.europe-west1.firebasedatabase.app/`.
- **Env var** : `FIREBASE_DATABASE_URL` ajoutée à `.env` / `.env.example` (URL **publique, pas un secret**) et **typée** dans `src/types/react-native-config.d.ts` (`react-native-config`). `FirebaseRealtimeService.db()` cible l'instance EU **explicitement** : `getDatabase(getApp(), url)`, avec **fallback `getDatabase(getApp())`** si l'env est vide (tests/CI).
- **Security Rules** : `database.rules.json` (+ `database.rules.README.md`) — **racine fermée** (`.read`/`.write` = `false`), `sessions/$sessionId/participants/$participantId` **read+write autorisés** avec validation de forme alignée sur `RealtimeParticipantSchema` (lat/lon/heading/speed bornés, `isOnline` bool, `updatedAt` présent), `$other` **refusé**. Modèle **MVP sans auth** : protection par `$sessionId` = UUID non devinable (capability URL). Durcissement futur documenté = **Firebase Anonymous Auth** (dette de sécurité connue et assumée).
- **`firebase.json`** : `database.rules → database.rules.json`.
- **Fichiers** : `.env`, `.env.example`, `src/types/react-native-config.d.ts`, `src/infrastructure/realtime/FirebaseRealtimeService.ts`, `database.rules.json`, `database.rules.README.md`, `firebase.json`.
- **Tests** : suite globale **867 tests** verts (+2 vs 865 : couvre les 2 branches de `db()` — URL EU explicite vs fallback env vide). `npm run check` vert.
- **Piège appris** : une **instance RTDB hors `us-central1`** (ici `europe-west1`) **exige l'URL explicite** passée à `getDatabase(getApp(), url)` — sans elle, le SDK cible l'instance par défaut `us-central1` (inexistante ici) et les lectures/écritures échouent silencieusement. Voir « Appris ».

---

## Historique des commits (annoté)

```
(F8 Biométrie — livrée/testée 1133/reviewée APPROVED, PAS encore commitée)
3385acf  2026-06-30  chore(firebase) gitignore configs natives + Cloud Function purge RGPD
d112edb  2026-06-29  feat(f5)        partage session collaboratif (deep link) ← F5
c9a76d1  2026-06-25  feat(f4)        wire projet Firebase EU + rules RTDB  ← F4 (câblage EU)
1c73eeb  2026-06-24  feat(f4)        tracking multi-participants RTDB      ← F4 (ADR-006)
ebf1215  2026-06-22  feat(f7)        profile photo (picker + FileSystem) ← F7 p2 (ADR-013)
0ade2e2  2026-06-20  feat(f7)        profile name + emoji avatars      ← F7 p1 (ADR-012)
c01e29c  2026-06-15  fix(qa-p1)      autocomplete au-dessus du clavier ← QA P1
ed7b0ee  2026-06-15  fix(qa-p1)      bottom sheet portal + footer map  ← QA P1
786a4e9  2026-06-15  fix(qa-p1)      a11y + erreurs réseau + GPS notice ← QA P1
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

## Métriques actuelles (mesurées le 2026-09-26)

| Métrique                           | Valeur                                                            |
| ---------------------------------- | ----------------------------------------------------------------- |
| Fichiers code (`src/`, hors tests) | 124                                                               |
| Suites de tests                    | 87                                                                |
| Tests (cas) — `npm run check`      | 1257                                                              |
| Entités core                       | 9                                                                 |
| Ports                              | 9 (+`IBiometricService`)                                          |
| Use cases                          | 9                                                                 |
| Adapters infrastructure            | 9 (+`KeychainBiometricService`) (+2 placeholders : eta/analytics) |
| Stores Zustand                     | 5                                                                 |
| Hooks custom                       | 12 (+`useBiometricLock`)                                          |
| Atoms / Molecules / Templates      | 5 / 13 / 1 (+`BiometricLockScreen`)                               |
| Écrans                             | 6                                                                 |
| Namespaces i18n × langues          | 10 × 2 (FR/EN) (+`biometric`)                                     |

> F8 : +port `IBiometricService` (adapter `KeychainBiometricService`, infra/security), +store flag `usePreferencesStore.biometricEnabled`, +hook `useBiometricLock`, +molecule `BiometricLockScreen`, +gate `BiometricLockGate` dans `App.tsx`, +namespace i18n `biometric`. (F5 avait ajouté `SharedSession`, `ISessionShareService`/`FirebaseSessionShareService`, `ShareSession`/`JoinSession`, `useSharedSessionStore`, `useSessionShare` & `useSharedSessionSync`, `JoinSessionScreen`, `navigation/linking.ts`, namespace `share`.) Restent vides : `infrastructure/{eta,analytics}/`.
> Coverage F8 (review) : core / infra / presentation au-dessus des seuils CI (core 90 / infra 70 / presentation 50 / global 70).
> Couverture **réellement appliquée** depuis le 2026-08-21 : `test:ci` = `jest --ci --coverage`, donc les `coverageThreshold` de `jest.config.js` bloquent `npm run check`. Mesure du 2026-08-24 : **95,5 % stmts / 85,7 % branches / 93,3 % funcs**. ⚠️ `coverage/coverage-summary.json` n'est toujours pas écrit (pas de `coverageReporters` dans `jest.config.js`) — à ajouter si on veut mécaniser la mise à jour de ce tableau.

---

## Appris / pièges rencontrés

- **Zod v4 + Babel** : nécessite le plugin `@babel/plugin-transform-export-namespace-from` (fix `8d6425e`).
- **react-native-maps + `exactOptionalPropertyTypes`** : incompatibilité → `skipLibCheck: true` + shim `src/types/react-native-maps.d.ts` (alias tsconfig).
- **`@gorhom/bottom-sheet`** : utilisé pour `POIDetailSheet` (attention au `BottomSheetTextInput` si saisie dans une sheet).
- **react-native-reanimated 4** : plugin Babel requis (worklets) — vérifier `babel.config.js`.
- **Rename MidPoint → Mivro** : conflit App Store (ADR-011) ; le bundle id iOS a depuis été migré vers `com.cedricpineau.mivro` (comme l'`applicationId` Android, vérifié 2026-08-24), le MMKV id est passé à `mivro-storage`.
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
- **RNFirebase v25 = API modulaire** : importer `getDatabase/ref/onValue/onDisconnect/update/remove/serverTimestamp` directement depuis `@react-native-firebase/database` (tree-shakable, recommandé v22+). Pas de `[FIRApp configure]` manuel : la config se fait via `GoogleService-Info.plist` / `google-services.json` au build. Les types du SDK suffisent : **`tsc` compile à 0 erreur sans les fichiers de config** (ils ne sont nécessaires qu'au runtime).
- **Pods Swift Firebase → `use_modular_headers!`** : sans cette directive dans le Podfile, `pod install` échoue (« Swift pod cannot yet be integrated as a static library… depends upon … which do not define modules »). À placer juste après `prepare_react_native_project!`.
- **`onDisconnect` AVANT l'écriture** (RTDB) : armer `onDisconnect(ref).update({ isOnline:false })` _avant_ le `update` de la position garantit que le serveur repasse le participant offline en cas de coupure brutale. `leaveSession` doit `cancel()` l'onDisconnect puis `remove()` (sinon le onDisconnect ré-écrirait un nœud qu'on vient de supprimer — RGPD).
- **Opti batterie côté presentation, pas dans l'adapter geoloc** : `watchPosition` (infra) émet brut ; le throttling 5s/30s + la coupure en arrière-plan (AppState) vivent dans `useRealtimeTracking`. Garde l'adapter simple et substituable ; la politique batterie reste une décision applicative.
- **RGPD — consentement de partage séparé et non persisté** : `hasSharingConsent` vit dans `useRealtimeStore` (non persisté). On peut **voir** les autres sans consentement (abonnement), mais on ne **publie** jamais sa position tant qu'il est `false`. Choix par session, jamais stocké. **Corrigé en review** : on ne se contente pas de bloquer la publication — le **watch GPS lui-même n'est armé que si le consentement est donné** (ne pas allumer le capteur sans raison ni consentement).
- **Boucle de rendu Zustand v5 (sélecteur renvoyant un nouvel objet)** : avec Zustand v5, un sélecteur qui **construit un nouvel objet/array à chaque appel** (ex : `s => ({ ...derived })` ou `Object.values(map)`) casse l'égalité référentielle → React re-render en boucle (« Maximum update depth exceeded »). Bug rencontré sur `useRealtimeStore` (F4). Fix : sélectionner des **références stables** (sélecteurs atomiques) et **mémoïser** la dérivation côté composant (`useMemo`), ou passer un comparateur (`useShallow`). Régression silencieuse jusqu'au montage du composant — d'où l'intérêt des tests d'intégration.
- **Firebase confiné à l'infra (F4)** : `@react-native-firebase/*` n'est importé que par `FirebaseRealtimeService`. Le `tsc` compile à 0 erreur **sans** les fichiers de config natifs (nécessaires seulement au runtime), et le core/presentation restent testables via le port mocké. Transport substituable (swap = 1 ligne DI). Décision actée en ADR-006.
- **Instance RTDB hors `us-central1` → URL explicite obligatoire (câblage Firebase EU)** : pour la conformité RGPD, l'instance Realtime Database est en **`europe-west1`**. Le SDK Firebase cible **par défaut l'instance `us-central1`** ; pour une instance dans une autre région, il **faut passer l'URL explicite** à `getDatabase(getApp(), 'https://mivro-40125-default-rtdb.europe-west1.firebasedatabase.app/')`. Sans ça, lectures/écritures partent vers une instance inexistante (échec silencieux / erreurs réseau). L'URL est exposée via `FIREBASE_DATABASE_URL` (publique, pas un secret) ; `db()` fait un **fallback** `getDatabase(getApp())` quand l'env est vide (tests/CI), d'où les 2 branches testées.
- **Collaboratif live = un abonnement à câbler explicitement (F5)** : « partager une session » ne suffit pas à la rendre live chez l'invité. Publier le roster sur RTDB ne fait rien tant que personne ne **s'abonne** ; le hook `useSharedSessionSync` (monté dans `MapScreen`) appelle `subscribeToSharedSession` et rebranche `loadSharedSession` à chaque update (roster + midpoint recalculé). Penser au **désabonnement** au démontage / au changement de `sessionId`, et à des sélecteurs Zustand **stables** (cf. piège boucle de rendu F4). Oubli classique : l'écran s'ouvre mais ne « bouge » jamais.
- **Suppression RGPD à déclencher explicitement, et seulement par le propriétaire (F5)** : `expiresAt` n'efface **rien** par lui-même (pas de TTL serveur — il faudra une Cloud Function, cf. TODO). La purge du nœud Firebase se fait via `deleteSharedSession`, appelée **uniquement par le propriétaire** (`useSharedSessionStore.isOwner`) au reset de session ; un simple **joiner** ne purge que son état local (il n'est pas propriétaire des données partagées). Distinguer ces deux rôles évite qu'un invité supprime la session des autres — ou qu'on oublie de supprimer côté propriétaire.
- **Relecture du roster anti lost-update (F5)** : `JoinSessionUseCase` ajoute le membre puis **relit le roster complet** avant de recalculer le midpoint, plutôt que de recalculer sur sa copie locale. Sans cette relecture, deux invités qui rejoignent quasi simultanément écraseraient mutuellement le midpoint (lost-update : chacun ne voit que son propre ajout). La relecture ramène l'état serveur courant avant le `CalculateMidpointUseCase`.
- **Étendre un modèle Firebase sans casser l'existant (F5 sur F4)** : F5 ajoute `sessions/{id}/meta` + `members/{id}` **à côté** du nœud `participants` (positions live F4), sans jamais l'altérer. `members` = points de **départ** (roster collaboratif) ; `participants` = positions GPS **live**. Deux services distincts (`ISessionShareService` ≠ `IRealtimeService`) sur la même session, deux nœuds disjoints → pas de couplage, et les rules valident chaque feuille séparément.
- **Deep link scheme `mivro://` seul pour le MVP (F5)** : `linking.ts` déclare `prefixes: ['mivro://']` + `session/:sessionId → JoinSession`, branché sur `NavigationContainer`. Config native : iOS `CFBundleURLTypes`, Android `<intent-filter>`. Pas d'universal links (AASA/assetlinks) au MVP — ils exigent un domaine vérifié et de l'hébergement de fichiers d'association ; reportés (cf. TODO « Décisions en attente »). Un lien `mivro://` n'ouvre pas l'app si elle n'est pas installée — acceptable au MVP.
- **`BIOMETRY_ANY` seul = lockout (F8)** : protéger un secret keychain par `ACCESS_CONTROL.BIOMETRY_ANY` **seul** enferme l'utilisateur si la biométrie devient inutilisable (enrôlement retiré, lockout « too many attempts », capteur HS) — il ne peut plus jamais déverrouiller. Fix **double filet** : (1) `BIOMETRY_ANY_OR_DEVICE_PASSCODE` → le **passcode device** sert de secours natif ; (2) **échappatoire applicative** (`disableLockAndContinue` : retire la sentinelle + le flag PUIS déverrouille ; proposée après 3 échecs ou si la biométrie est durablement inutilisable ; auto-désactivation au montage si `getSupportedType()` renvoie `null` alors que le verrou est actif). Ne **jamais** poser un verrou biométrique sans chemin de sortie garanti.
- **Masquer dès `inactive`/`background`, pas seulement au retour (F8)** : pour empêcher que le contenu sensible apparaisse dans la **vignette de l'app-switcher** (snapshot pris par l'OS quand l'app quitte le premier plan), il faut re-verrouiller **avant** ce snapshot, c.-à-d. dès `AppState === 'inactive' || 'background'` — pas seulement au retour `→ active`. Re-locker uniquement au retour expose le contenu dans le multitâche.
- **Keychain ne fournit pas de codes d'erreur typés (F8)** : `react-native-keychain` **rejette avec un message natif libre** (pas de code structuré) — distinguer annulation utilisateur (`cancelled`, ≠ échec, à ne pas comptabiliser vers l'échappatoire), `not_enrolled`, `not_available`, `failed` (« too many attempts »/« not recognized ») et `unknown` repose sur une **heuristique de substring sur le message** (incluant `code: 13` pour le bouton négatif Android). Fragile par nature (dépend du wording natif/OS) ; centralisé dans `toBiometricError` et couvert par tests. À surveiller sur device réel.
- **Auth biométrique via relecture d'un secret sentinelle (F8)** : il n'y a pas d'API « authentifie-moi » pure dans keychain ; on **pose** une valeur sentinelle protégée biométrie (`setGenericPassword` à l'activation) et on la **relit** (`getGenericPassword`) pour déclencher le prompt natif — succès = valeur relue conforme. La sentinelle n'a aucune valeur secrète métier et n'est **jamais loggée** (LOG-001). `disableLock` (`resetGenericPassword`) doit être **idempotent et best-effort** (ne jamais throw) pour ne pas casser le flux de désactivation/échappatoire.
- **Prompt biométrique différé jusqu'au type connu (F8)** : tirer l'auto-prompt au montage de l'écran de verrouillage **avant** d'avoir résolu `getSupportedType()` affiche le libellé générique (« la biométrie ») au lieu de « Face ID »/« Touch ID ». Différer le 1er prompt jusqu'à `supportedType !== null`. Si aucun type ne se résout, c'est le hook qui auto-désactive le verrou (anti-lockout) — pas d'auto-prompt à tirer.

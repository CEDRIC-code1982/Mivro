# TODO.md — Mivro

> Tâches restantes priorisées. Cocher au fur et à mesure, ajouter les découvertes (cf. CLAUDE.md > AUTO-MAINTENANCE).
> Dernière mise à jour : 2026-06-29 (F8 Biométrie livrée/testée/reviewée APPROVED ; **1133 tests**).

Priorités : **P0** bloquant/immédiat · **P1** important · **P2** souhaitable · **P3** plus tard.
Ordre d'exécution recommandé : Fix QA P1 → F7 → F4 → F5 → F8 → F6 → ADR → PostHog → Beta. (Fix QA P1, F7, F4, F5, **F8 faits** — F4/F5 attendent device par Cédric, F8 attend device par Cédric.) **Il ne reste que des features à blocker externe (F6 comptes dev, PostHog VPS, Beta secrets/signing) + l'ADR rattrapage (sans blocker).**

---

## P0 — Fix QA P1 (accessibilité & robustesse) — ✅ FAIT (2026-06-15)

_Estimation : S (M pour VoiceOver). Dépendances : aucune. Blockers : aucun._

- [x] **VoiceOver Map** : carte annoncée (`SessionMapView` accessible + `accessibilityLabel` résumant la session) + hint « Vue liste » clarifié (A11Y-003/006)
- [x] **Erreur réseau Nominatim** : `AddressAutocomplete` mappe `network`/`rate_limited`/`server_error` vers les messages dédiés (au lieu de « aucun résultat ») (ERR-001/003)
- [x] **GPS mode avion** : `GetCurrentLocationUseCase` renvoie `addressResolved`; le flux affiche une **notice non-bloquante** « Adresse non résolue (hors ligne) » et ajoute quand même le point (ERR-001)
- [x] **EmptyState / champ fantôme** : cause racine trouvée via screenshots — le `BottomSheet` (non-portail) fuyait dans le `ScrollView` de F1 (2ᵉ champ « Tape une adresse » sous Continuer). **Corrigé** : migration vers `BottomSheetModal` + `BottomSheetModalProvider` (App.tsx). Backdrop 0.5→0.7 + sheet `flex:1` conservés.
- [x] **Layout 200 % / footer carte** : screenshot — « Voir les lieux à proximité » débordait sur 2 lignes. **Corrigé** : boutons du footer empilés verticalement (`actionsRow` en colonne, boutons pleine largeur), robuste en Dynamic Type. Compteur F1 `flexWrap` conservé.
- [x] Docs mises à jour (PROGRESS.md + TODO.md) — commits `fix(qa-p1)` + `fix(qa-p1): bottom sheet portal`

---

## P1 — F7 Profil — passe 1 ✅ FAIT (2026-06-20)

_Estimation : M. Décision avatars tranchée : **emoji-based** (ADR-012, pas de SVG/photo pour cette passe du MVP)._

- [x] `UpdateProfileUseCase` (core, pur, validé Zod) + câblé dans `di/container.ts`
- [x] Entité `Avatar` (`AvatarSchema`, `AvatarIdSchema` 20 ids, `AVATARS`, `getAvatarById`)
- [x] `avatarId?` ajouté à `User` + `Participant` (`MidpointSession`)
- [x] Grille de 20 avatars prédéfinis (atom `Avatar` + molecule `AvatarPicker`, emoji-based)
- [x] Édition `displayName` → `useAuthStore.updateProfile` (persisté MMKV) + exposé via `useAuth`
- [x] Enrichir `ProfileScreen.tsx` (édition nom + grille avatars)
- [x] Afficher l'avatar dans `ParticipantCard` (refactorée pour utiliser l'atom `Avatar`)
- [x] i18n namespace `profile` complété FR + EN (`displayName`, `avatarPicker`, `avatarNames`)
- [x] Tests (entité, usecase, atom, picker, intégration ProfileScreen) — `npm run check` vert (661 tests)

## P1 — F7 Profil — passe 2 (photo + intégration session)

_Estimation : S. **Étape native** : npm install + pod install + permissions._
**⚠️ BLOCKER** : permissions caméra/galerie (`NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` dans `Info.plist` + `AndroidManifest`).

- [x] Installer `react-native-image-picker` + `@dr.pogodin/react-native-fs` (npm install + `pod install` — faits)
- [x] Photo picker + resize 200×200 (resize natif `maxWidth/maxHeight`), copie FileSystem (`Documents/profile-photos/`) — port `IProfilePhotoService` + adapter `ImagePickerProfilePhotoService` (infra), câblé DI
- [x] Entité `User.photoUri?` (Zod) + `UpdateProfileUseCase` gère set/clear (`photoUri: null` = effacer)
- [x] Intégrer la photo dans l'atom `Avatar` (photo > emoji > initiale, via `<Image>`)
- [x] `ProfileScreen` : boutons galerie/caméra/supprimer + états loading/erreur (hook `useProfilePhoto`, cleanup ancien fichier au remplacement/suppression)
- [x] Permissions natives : iOS `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` ; Android `CAMERA`
- [x] Peupler `avatarId` du `Participant` à la création de session via GPS « ma position » (`useCreateSessionFlow` → avatar emoji du user courant, PAS la photo)
- [x] i18n namespace `profile.photo` FR + EN (boutons, loading, erreurs typées)
- [x] Tests (entité User.photoUri, UpdateProfileUseCase clear, adapter mock IP+FS, hook useProfilePhoto, Avatar photo, ProfileScreen intégration) — `npm run check` vert (**718 tests**) + update PROGRESS.md
- [ ] **À tester sur device** : permissions iOS/Android réelles, resize effectif 200×200, persistance MMKV du chemin après kill, cleanup FileSystem réel, ouverture réelle du picker

> **F7 entièrement livrée** (passes 1 + 2, testée + reviewée APPROVED). Reste uniquement la vérif device ci-dessus.

## P1 — F4 Temps réel Firebase (S09-10) — ✅ CODE + TESTS + CÂBLAGE FIREBASE EU FAITS (2026-06-20, reviewé APPROVED, non commité) ; reste actions console/natives (Cédric)

_Estimation : L. Dépendances : `@react-native-firebase/app` + `/database` (v25, API modulaire). Décision : ADR-006._
**Projet Firebase EU fourni et câblé** : `mivro-40125`, Realtime Database région **europe-west1** (RGPD OK), URL `https://mivro-40125-default-rtdb.europe-west1.firebasedatabase.app/`. La PAUSE « transport » est **levée**. Restent les actions console Firebase + fichiers de config natifs + déploiement rules + `pod install` → **à faire par Cédric** (voir ci-dessous). Aucun faux fichier de config créé.

- [x] Entité `RealtimeParticipant` (Zod strict) + `RealtimeLocationUpdate`
- [x] Port `IRealtimeService` (`subscribeToSession` / `publishLocation` / `leaveSession`) + `RealtimeError`
- [x] `TrackParticipantsUseCase` (core, sans dépendance infra)
- [x] Port `IGeolocationService.watchPosition` + adapter `RNGeolocationService.watchPosition` (m/s→km/h, heading borné, Zod)
- [x] Adapter `FirebaseRealtimeService` → `src/infrastructure/realtime/` (Realtime DB, API modulaire, Zod sur les lectures, onDisconnect)
- [x] Store `useRealtimeStore` (Zustand, **NON persisté** — RGPD)
- [x] Affichage live sur carte (markers halo distincts) + **vue liste alternative a11y** `LiveParticipantsList` (A11Y-006)
- [x] Optimisations batterie (5s en mouvement / 30s arrêt / off en background via AppState) — dans `useRealtimeTracking`
- [x] Consentement partage explicite et SÉPARÉ (`RealtimeConsentModal` + `hasSharingConsent`) + suppression positions en fin de session (`leaveSession` + remove) (RGPD)
- [x] DI câblé (`di/container.ts`) + i18n namespace `realtime` FR/EN + config native (Podfile `use_modular_headers!`, Android google-services plugin)
- [x] `npx tsc --noEmit` 0 erreur + lint/prettier verts
- [x] Tests (Firebase mocké via le port `IRealtimeService`, watchPosition mocké via le port geoloc) — ~168 cas F4, **867 tests** au total, `npm run check` vert, seuils respectés
- [x] Review APPROVED (1 tour de corrections appliqué) : 1 bug corrigé (boucle de rendu Zustand v5 — sélecteur renvoyant un nouvel objet, fix `useMemo`/références stables) + 3 corrections review (dont **watch GPS conditionné au consentement**)
- [x] **Câblage URL EU + rules + `firebase.json` fait** (2026-06-20) : projet `mivro-40125` (RTDB europe-west1, RGPD OK) ; `FIREBASE_DATABASE_URL` dans `.env`/`.env.example` + typée (`react-native-config.d.ts`) ; `FirebaseRealtimeService.db()` cible l'instance EU explicitement (`getDatabase(getApp(), url)`, fallback si vide) ; `database.rules.json` (+ `database.rules.README.md`, racine fermée + validation alignée sur `RealtimeParticipantSchema` + `$other` refusé) ; `firebase.json` → `database.rules.json`

**Reste à Cédric (actions console Firebase + natives) :**

- [ ] **Console Firebase — app iOS** : enregistrer l'app iOS (bundle id `com.cedricpineau.midpoint`) → télécharger `GoogleService-Info.plist` → l'ajouter à la cible Xcode
- [ ] **Console Firebase — app Android** : enregistrer l'app Android (même `applicationId` `com.cedricpineau.midpoint`) → télécharger `google-services.json` → le placer dans `android/app/`
- [ ] **Déployer les rules** : `firebase deploy --only database` (ou copier `database.rules.json` dans Console → Realtime Database → Règles)
- [ ] **iOS** : `cd ios && pod install` (le CDN CocoaPods avait flanché côté CI ; `use_modular_headers!` est déjà au Podfile)
- [ ] **Vérif device** : live multi-appareils (positions qui bougent en temps réel) + **opti batterie réelle** (5s/30s + coupure background)

## P1 — F5 Partage deep link (S11) — ✅ CODE + TESTS + REVIEW APPROVED (2026-06-20, non commité) ; reste device (Cédric)

_Décision produit : join = participant collaboratif (l'invité ajoute son point de départ → midpoint recalculé → tous voient le nouveau midpoint + positions live F4) → session collaborative live. Session partagée sur Firebase RTDB (étend F4)._

- [x] Entité `SharedSession` (meta + members, Zod) + helpers (`computeExpiresAt`, `buildShareLink`)
- [x] Port `ISessionShareService` + `SessionShareError` (codes `not_found`/`expired`/`closed`/`network`/`not_configured`/…)
- [x] UseCases `ShareSessionUseCase` + `JoinSessionUseCase` (vérif expiration + recalcul midpoint via `CalculateMidpointUseCase`)
- [x] Adapter `FirebaseSessionShareService` (API modulaire v25, validation Zod, error mapping, LOG-001, pas de coords loggées)
- [x] Store `useSharedSessionStore` (NON persisté, RGPD) + action `loadSharedSession` sur `useSessionStore`
- [x] Deep linking : `linking.ts` + `NavigationContainer linking` + route `JoinSession` + `JoinSessionScreen` (loading/success/error)
- [x] Config native : iOS `CFBundleURLTypes` (scheme `mivro`) + Android `<intent-filter>` (scheme `mivro`)
- [x] UI : bouton « Partager la session » sur `MapScreen` → `Share` natif
- [x] i18n namespace `share` FR + EN
- [x] DI : `sessionShareService` + `shareSessionUseCase` + `joinSessionUseCase` câblés
- [x] Security rules : `sessions/$sessionId/meta` + `members/$memberId` ajoutés (racine fermée, `$other` refusé aux feuilles)
- [x] Hook `useSharedSessionSync` (abonnement live RTDB monté dans `MapScreen`, désabonnement au démontage/changement de sessionId) — branche le join collaboratif live (correction review)
- [x] Suppression RGPD : `deleteSharedSession` déclenché au reset par le **propriétaire** (`isOwner`), joiner → purge locale seule (correction review)
- [x] **Tests** : ~143 cas F5 (usecases Share/Join : expiration, full, recalcul, anti-race ; adapter mock firebase ; store `useSharedSessionStore` ; hooks `useSessionShare` + `useSharedSessionSync` ; `linking.ts` ; `JoinSessionScreen`) — **1021 tests** au total, `npm run check` vert, coverage core 100 / infra ~98 / presentation ~94
- [x] Review APPROVED (1 tour) : 5 corrections — join live (abonnement), suppression RGPD, gestion d'erreurs join (expired/not_found/closed), relecture roster anti-race, rules meta/members
- [ ] **⚠️ Reste à Cédric** : redéployer les rules étendues (`firebase deploy --only database`) ; `pod install` (déjà requis F4) ; rebuild natif (scheme deep link) ; tester `xcrun simctl openurl booted mivro://session/<id>` / `adb shell am start -a android.intent.action.VIEW -d "mivro://session/<id>"` + join multi-devices + recalcul live + suppression en fin de session
- [ ] **Décision en attente** : universal links (AASA/assetlinks) — MVP en scheme `mivro://` seul (tranché)
- [ ] **Limite MVP** : « Copier le lien » dédié non implémenté (pas de dép. Clipboard) → la share sheet native offre déjà « Copier ». Ajouter `@react-native-clipboard/clipboard` si un bouton dédié est voulu.

## P1 — F8 Biométrie (S12) — ✅ CODE + TESTS + REVIEW APPROVED (2026-06-29, non commité) ; reste device (Cédric)

_Estimation : S. Dépendances : `react-native-keychain` (déjà installé)._
**Décision MVP** : « compte requis » **relâché** → verrou **opt-in pour tout utilisateur (guest inclus)**, car F6 (Auth) reste bloqué par les comptes dev. Réversible quand F6 existera (cf. « Décisions en attente »).

- [x] Port `IBiometricService` (core) + `BiometricError` typée + types `BiometricType`/`BiometricErrorCode`
- [x] Adapter `KeychainBiometricService` (`infra/security/`, secret sentinelle `BIOMETRY_ANY_OR_DEVICE_PASSCODE` + `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, sentinelle jamais loggée, mapping erreurs heuristique) + câblé DI
- [x] Flag `biometricEnabled` + `setBiometricEnabled` dans `usePreferencesStore` (persisté MMKV)
- [x] Hook `useBiometricLock` (isLocked, unlock, enable/disable, re-lock `inactive`/`background` + `→ active`, anti-lockout : auto-désactivation + `disableLockAndContinue` + `showDisableEscape` après 3 échecs)
- [x] Molecule `BiometricLockScreen` (overlay bloquant, prompt différé jusqu'au type connu, bouton « Désactiver le verrou et continuer », a11y)
- [x] Gate `BiometricLockGate` dans `App.tsx` (enveloppe l'arbre, masquage a11y `importantForAccessibility`/`accessibilityElementsHidden` quand verrouillé)
- [x] Toggle opt-in dans `ProfileScreen`
- [x] i18n namespace `biometric` FR + EN ; natif : iOS `NSFaceIDUsageDescription`, Android `USE_BIOMETRIC`
- [x] **Tests** : ~140 cas F8 (port, adapter mock keychain, hook, molecule, store, intégration ProfileScreen) — **1133 tests** au total, `npm run check` vert, seuils respectés
- [x] Review APPROVED (1 tour) : 1 bloquant (anti-lockout double filet) + 1 majeur (masquage app-switcher) + 2 mineurs (a11y du gate, prompt différé)
- [ ] **À tester sur device** (Cédric) : Face ID / Touch ID / empreinte réels (simulateur iOS : Features → Face ID → Enrolled/Matching), fallback passcode device, échappatoire anti-lockout, masquage app-switcher
- [ ] **(edge iOS, P3)** Le re-lock `→ active` se déclenche aussi sur `previous==='inactive'` : au tout 1er lancement, l'alerte système de permission Face ID peut provoquer un **re-lock parasite** une fois après le 1er unlock (auto-récupérable). À vérifier sur device QA ; si confirmé, restreindre la branche `→ active` à `previous==='background'`.

---

## P2 — F6 Auth Google/Apple

_Estimation : M. Dépendances : `@react-native-google-signin/google-signin`, `@invertase/react-native-apple-authentication`._
**⚠️ BLOCKER / PAUSE OBLIGATOIRE** : comptes développeur (Google Cloud OAuth client + Apple « Sign in with Apple » capability).

- [ ] Brancher les signatures no-op de `useAuthStore` sur les libs réelles
- [ ] Login Google + Apple, persistance de l'état
- [ ] Conserver le guest-first (ADR-004)
- [ ] Tests + update docs

## P2 — ADR rattrapage

_Estimation : M (rédaction). Dépendances : aucune. ADR-011 déjà écrit._

- [ ] ADR-001 Nominatim vs Google
- [ ] ADR-002 Clean Architecture
- [ ] ADR-003 Expo vs RN CLI
- [ ] ADR-004 Guest-first auth
- [ ] ADR-005 Zustand vs Redux
- [x] ADR-006 Firebase Realtime — **écrit** (2026-06-20, rédigé avec F4)
- [ ] ADR-007 New Architecture
- [ ] ADR-008 MMKV storage
- [ ] ADR-009 External APIs scaling
- [ ] ADR-010 Sentry + PostHog
- [ ] `npm run docs` passe sans erreur

## P2 — PostHog analytics

_Estimation : M. Dépendances : SDK PostHog._
**⚠️ BLOCKER / PAUSE OBLIGATOIRE** : instance PostHog auto-hébergée (VPS, données EU) + clé projet.

- [ ] Port `IAnalyticsService` (core)
- [ ] Adapter `PostHogAnalytics` → `src/infrastructure/analytics/`
- [ ] Opt-out dans `usePreferencesStore`
- [ ] JAMAIS : GPS exact / identités / contenus utilisateur
- [ ] Tests + update docs

---

## P3 — TestFlight + Play Beta (S12)

_Estimation : L. Dépendances : comptes stores._
**⚠️ BLOCKER / PAUSE OBLIGATOIRE** : clé API Google Maps Android prod, certificats de signing, provisioning profiles.

- [ ] Clé API Google Maps Android (release)
- [ ] Build signing iOS + Android
- [ ] Coverage global ≥ 70 % (seuil CI)
- [ ] Upload TestFlight + Play Console (piste interne)

---

## Dette technique connue

- [ ] **POI rayon géant** (ex: Paris + Tokyo) : la requête Overpass `(around:RAYON_ÉNORME)` fait timeout/erreur → `POIListView` affiche « Erreur inattendue » au lieu d'un EmptyState. Découvert au QA (Pacifique). À traiter : borner le rayon POI ou mapper le timeout vers un message dédié. (P2)
- [ ] **Re-vérif device** : confirmer sur iPhone que (a) le champ fantôme F1 a disparu, (b) le footer carte tient en Dynamic Type 200 %. Vérifier aussi qu'aucun autre écran ne casse en 200 %.
- [ ] **Coverage non mesurée** : `coverage/coverage-summary.json` absent → lancer `npm run test:coverage` et reporter les chiffres dans PROGRESS.md.
- [ ] **Atoms manquants** : `Button`, `Input`, `IconButton`, `Card`, `Spinner` n'existent pas — à créer via skill `create-atom` quand une feature les requiert.
- [ ] **Ports placeholders** : dossiers `infrastructure/{eta,analytics}` encore vides — à remplir (V1 OSRM / PostHog). `realtime/` rempli par F4.
- [ ] **`SessionsScreen`** : squelette 72 l. — historique sessions à implémenter (AsyncStorage, cf. STORAGE).
- [ ] **react-native-maps shim** : `skipLibCheck` désactive le check des `.d.ts` libs — surveiller les régressions de types externes.
- [ ] **`borderWidth: 1` en dur** (magic number) répandu dans plusieurs écrans — relevé par la review F7, **non introduit par F7**. Envisager un token `borderWidth` dans le thème (DS-001). (P2)
- [ ] **`AvatarPicker` `fallbackName={avatar.emoji}`** : fallback inatteignable pour un id connu (cosmétique / robustesse défensive). Relevé par la review F7 — à nettoyer ou documenter. (P3)
- [ ] **`normalizePath` (F7 p2)** : `ImagePickerProfilePhotoService.normalizePath` fait `uri.replace('file://', '')` ; utiliser plutôt `decodeURIComponent(uri.replace(/^file:\/\//, ''))` pour gérer les chemins avec caractères encodés (espaces, accents). Relevé par la review F7 — durcissement. (P3)
- [ ] **Contrat `IProfilePhotoService.deletePhoto` (F7 p2)** : renforcer la TSDoc pour stipuler que la méthode **ne doit JAMAIS rejeter** (best-effort : un fichier absent / non supprimable ne casse pas la mise à jour du profil). Relevé par la review F7. (P3)
- [ ] **`cameraType: 'front'` (F7 p2)** : choix de la caméra frontale par défaut dans `ImagePickerProfilePhotoService` = décision produit implicite → à confirmer avec Cédric. (P3)
- [ ] **Label midpoint hardcodé (I18N-001, pré-existant — pas F4)** : le marker midpoint dans `SessionMapView.tsx` (`accessibilityLabel="Point de rencontre"`) est une string en dur → passer par `useTranslation()`. Relevé pendant la review F4 mais antérieur à F4. (P3)
- [ ] **Rules : `sessions/$sessionId` sans `$other: false` (F5, review — résiduel)** : le niveau `sessions/$sessionId` n'a pas de `"$other": { ".validate": false }` → un client qui connaît l'UUID pourrait écrire un **sous-nœud frère arbitraire** (au-delà de `meta`/`members`/`participants`). Risque **MVP-sans-auth assumé** (protection = UUID non devinable, capability URL ; cf. `database.rules.README.md`). À corriger avec le durcissement **Firebase Anonymous Auth**. (P2/P3)
- [ ] **`expiresAt` sans purge automatique (F5, RGPD)** : `meta.expiresAt` est **vérifié à l'ouverture** (join refusé si expiré) mais **n'efface aucune donnée** côté serveur → les nœuds de sessions expirées **persistent** dans RTDB. Nécessite une **Cloud Function cron / TTL serveur** pour supprimer les sessions expirées. À planifier. (P2)
- [ ] **`test:ci` ne passe pas `--coverage` (F5, tester)** : `npm run check` → `test:ci` ne mesure pas la couverture, donc les `coverageThreshold` de `jest.config.js` (core 90 / infra 70 / presentation 50 / global 70) **ne sont PAS enforced** par la CI locale. Si l'intention est que la CI **bloque** sur la couverture, ajouter `--coverage` à `test:ci`. (P2)

---

## Décisions en attente (input Cédric requis)

- [x] ⚠️ **Avatars F7** : ~~SVG vectoriels custom **ou** emoji-based ?~~ → **tranché : emoji-based** (passe 1, 2026-06-20, ADR-012).
- [ ] ⚠️ **Firebase F4** : projet `mivro-40125` (RTDB europe-west1) **fourni et câblé** (URL/env/rules/`firebase.json`) ; restent les **fichiers de config natifs** (`GoogleService-Info.plist` iOS, `google-services.json` Android), le **déploiement des rules** et `pod install` — voir la checklist « Reste à Cédric » de la section F4. _(Code F4 livré/testé/reviewé ; transport acté ADR-006.)_
- [x] ⚠️ **F5 universal links** : ~~MVP en scheme `mivro://` seul, ou config domaine (AASA/assetlinks) dès maintenant ?~~ → **tranché : scheme `mivro://` seul** pour le MVP (pas d'universal links — exigent domaine vérifié + hébergement AASA/assetlinks). Reportés post-MVP. (F5, 2026-06-20)
- [x] ⚠️ **F8 « compte requis »** : ~~verrou biométrique réservé aux comptes ou ouvert aux guests ?~~ → **tranché (MVP) : opt-in pour TOUT utilisateur, guest inclus** — la contrainte « compte requis » du backlog est relâchée car F6 (Auth) reste bloqué par les comptes dev. **Réversible** : à re-durcir quand F6 existera. Pas d'ADR dédié (décision MVP). (F8, 2026-06-29)
- [ ] ⚠️ **Comptes dev F6** : Google Cloud + Apple Developer prêts ?
- [ ] ⚠️ **PostHog** : VPS d'auto-hébergement provisionné ?
- [ ] ⚠️ **Bundle id** : iOS reste `com.cedricpineau.midpoint` malgré le rename Mivro — à figer ou migrer avant la beta ?

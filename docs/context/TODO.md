# TODO.md — Mivro

> Tâches restantes priorisées. Cocher au fur et à mesure, ajouter les découvertes (cf. CLAUDE.md > AUTO-MAINTENANCE).
> Dernière mise à jour : 2026-06-20.

Priorités : **P0** bloquant/immédiat · **P1** important · **P2** souhaitable · **P3** plus tard.
Ordre d'exécution recommandé : Fix QA P1 → F7 → F4 → F5 → F8 → F6 → ADR → PostHog → Beta.

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

## P1 — F4 Temps réel Firebase (S09-10)

_Estimation : L. Dépendances : `@react-native-firebase/app` + `/database`._
**⚠️ BLOCKER / PAUSE OBLIGATOIRE** : création projet Firebase + `GoogleService-Info.plist` (iOS) + `google-services.json` (Android) → à fournir par Cédric.

- [ ] Entité `RealtimeParticipant` (Zod)
- [ ] Port `IRealtimeService` (`subscribeToSession` / `publishLocation` / `leaveSession`)
- [ ] `TrackParticipantsUseCase` (core)
- [ ] Adapter `FirebaseRealtimeService` → `src/infrastructure/realtime/` (Realtime DB, pas Firestore)
- [ ] Store `useRealtimeStore` (Zustand, **NON persisté** — RGPD)
- [ ] Affichage live sur carte + **vue liste alternative a11y** (A11Y-006)
- [ ] Optimisations batterie (5s en mouvement / 30s arrêt / off en background)
- [ ] Consentement partage explicite + suppression positions en fin de session (RGPD)
- [ ] Tests (Firebase mocké via le port) + update docs

## P1 — F5 Partage deep link (S11)

_Estimation : M. Dépendances : config `@react-navigation` linking. Blockers : universal links nécessitent domaine + AASA/assetlinks (peut rester en scheme `mivro://` pour le MVP)._

- [ ] `ShareSessionUseCase` (core)
- [ ] Config scheme `mivro://` + linking `@react-navigation`
- [ ] UI de partage (générer/copier le lien)
- [ ] Expiration : 24h guest / 7j compte (RGPD)
- [ ] Done : ouvrir `mivro://session/{id}` rejoint la session
- [ ] Tests + update docs

## P1 — F8 Biométrie (S12)

_Estimation : S. Dépendances : `react-native-keychain` (déjà installé). Blockers : compte requis (pas guest)._

- [ ] Flag biométrie dans `usePreferencesStore`
- [ ] Toggle dans `ProfileScreen` (opt-in)
- [ ] Déverrouillage biométrique au lancement (`biometryType`)
- [ ] Tests + update docs

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
- [ ] ADR-006 Firebase Realtime
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
- [ ] **Ports placeholders** : dossiers `infrastructure/{realtime,eta,analytics}` vides — à remplir (F4 / V1 / PostHog).
- [ ] **`SessionsScreen`** : squelette 72 l. — historique sessions à implémenter (AsyncStorage, cf. STORAGE).
- [ ] **react-native-maps shim** : `skipLibCheck` désactive le check des `.d.ts` libs — surveiller les régressions de types externes.
- [ ] **`borderWidth: 1` en dur** (magic number) répandu dans plusieurs écrans — relevé par la review F7, **non introduit par F7**. Envisager un token `borderWidth` dans le thème (DS-001). (P2)
- [ ] **`AvatarPicker` `fallbackName={avatar.emoji}`** : fallback inatteignable pour un id connu (cosmétique / robustesse défensive). Relevé par la review F7 — à nettoyer ou documenter. (P3)
- [ ] **`normalizePath` (F7 p2)** : `ImagePickerProfilePhotoService.normalizePath` fait `uri.replace('file://', '')` ; utiliser plutôt `decodeURIComponent(uri.replace(/^file:\/\//, ''))` pour gérer les chemins avec caractères encodés (espaces, accents). Relevé par la review F7 — durcissement. (P3)
- [ ] **Contrat `IProfilePhotoService.deletePhoto` (F7 p2)** : renforcer la TSDoc pour stipuler que la méthode **ne doit JAMAIS rejeter** (best-effort : un fichier absent / non supprimable ne casse pas la mise à jour du profil). Relevé par la review F7. (P3)
- [ ] **`cameraType: 'front'` (F7 p2)** : choix de la caméra frontale par défaut dans `ImagePickerProfilePhotoService` = décision produit implicite → à confirmer avec Cédric. (P3)

---

## Décisions en attente (input Cédric requis)

- [x] ⚠️ **Avatars F7** : ~~SVG vectoriels custom **ou** emoji-based ?~~ → **tranché : emoji-based** (passe 1, 2026-06-20, ADR-012).
- [ ] ⚠️ **Firebase F4** : créer le projet Firebase + fournir les fichiers de config natifs.
- [ ] ⚠️ **F5 universal links** : MVP en scheme `mivro://` seul, ou config domaine (AASA/assetlinks) dès maintenant ?
- [ ] ⚠️ **Comptes dev F6** : Google Cloud + Apple Developer prêts ?
- [ ] ⚠️ **PostHog** : VPS d'auto-hébergement provisionné ?
- [ ] ⚠️ **Bundle id** : iOS reste `com.cedricpineau.midpoint` malgré le rename Mivro — à figer ou migrer avant la beta ?

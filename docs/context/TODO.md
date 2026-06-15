# TODO.md — Mivro

> Tâches restantes priorisées. Cocher au fur et à mesure, ajouter les découvertes (cf. CLAUDE.md > AUTO-MAINTENANCE).
> Dernière mise à jour : 2026-06-15.

Priorités : **P0** bloquant/immédiat · **P1** important · **P2** souhaitable · **P3** plus tard.
Ordre d'exécution recommandé : Fix QA P1 → F7 → F4 → F5 → F8 → F6 → ADR → PostHog → Beta.

---

## P0 — Fix QA P1 (accessibilité & robustesse)

_Estimation : S (M pour VoiceOver). Dépendances : aucune. Blockers : aucun._

- [ ] **VoiceOver Map** : annoncer la carte (`accessibilityLabel`) + rendre le bouton « Vue liste » accessible (A11Y-003/006)
- [ ] **Layout texte 200 %** : corriger les cassures de mise en page (A11Y-004)
- [ ] **Erreur réseau Nominatim** : distinguer « erreur réseau » de « aucun résultat » (ERR-001/003)
- [ ] **EmptyState caché** : « aucun résultat » masqué par un autre texte → fixer z-index / layout
- [ ] **GPS mode avion** : afficher une erreur si le reverse geocode échoue (ERR-001)
- [ ] Mettre à jour PROGRESS.md + cocher ici + commit

---

## P1 — F7 Profil

_Estimation : M. Dépendances : `react-native-image-picker`. Blockers : permissions caméra/galerie (Info.plist + AndroidManifest)._

- [ ] `UpdateProfileUseCase` (core)
- [ ] Grille de 20 avatars prédéfinis (atom/molecule, SVG ou emoji-based)
- [ ] Photo picker (`react-native-image-picker`) + resize 200×200 (stockage FileSystem)
- [ ] Édition `displayName` → `useAuthStore`
- [ ] Enrichir `ProfileScreen.tsx` (existe déjà, 232 l.)
- [ ] Afficher l'avatar dans `ParticipantCard`
- [ ] i18n namespace `profile` (existe déjà — compléter FR + EN)
- [ ] Tests (usecase + composants) + update docs

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

- [ ] **Coverage non mesurée** : `coverage/coverage-summary.json` absent → lancer `npm run test:coverage` et reporter les chiffres dans PROGRESS.md.
- [ ] **Atoms manquants** : `Button`, `Input`, `IconButton`, `Card`, `Spinner` n'existent pas — à créer via skill `create-atom` quand une feature les requiert.
- [ ] **Ports placeholders** : dossiers `infrastructure/{realtime,eta,analytics}` vides — à remplir (F4 / V1 / PostHog).
- [ ] **`SessionsScreen`** : squelette 72 l. — historique sessions à implémenter (AsyncStorage, cf. STORAGE).
- [ ] **react-native-maps shim** : `skipLibCheck` désactive le check des `.d.ts` libs — surveiller les régressions de types externes.

---

## Décisions en attente (input Cédric requis)

- [ ] ⚠️ **Avatars F7** : SVG vectoriels custom **ou** emoji-based ? (impacte le poids/rendu)
- [ ] ⚠️ **Firebase F4** : créer le projet Firebase + fournir les fichiers de config natifs.
- [ ] ⚠️ **F5 universal links** : MVP en scheme `mivro://` seul, ou config domaine (AASA/assetlinks) dès maintenant ?
- [ ] ⚠️ **Comptes dev F6** : Google Cloud + Apple Developer prêts ?
- [ ] ⚠️ **PostHog** : VPS d'auto-hébergement provisionné ?
- [ ] ⚠️ **Bundle id** : iOS reste `com.cedricpineau.midpoint` malgré le rename Mivro — à figer ou migrer avant la beta ?

# CLAUDE.md — Mivro

# Fichier lu automatiquement par Claude Code à chaque session.

# À placer à la racine du repo.

# Ne pas modifier sans créer un ADR correspondant.

# Version 8.9 — 2026-07-13 (Refactor archi : passage **layer-first → feature-first + couche `services/`** (aligné sur lineguard), **state Zustand centralisé** dans `src/state/`, DI renommé `src/services/serviceContainer.ts`, et **tests co-localisés** (chaque `*.test` à côté de son sujet, intégration en `*.integration.test`). Stack inchangée (Zustand/Zod/TanStack), Atomic Design conservé (DS-004). 1133 tests verts, aucun changement de comportement. Alias : `@features @services @components @state @entities @theme @hooks @navigations @test-utils`.)

# Version 8.8 — 2026-06-29 (F8 Biométrie — verrou Face ID / Touch ID / empreinte, opt-in pour tout utilisateur guest inclus ; port `IBiometricService` + `KeychainBiometricService` + hook `useBiometricLock` + molecule `BiometricLockScreen` + gate dans `App.tsx` ; code livré + testé 1133 + reviewé APPROVED après 1 tour ; non commité. Il ne reste que des features à blocker externe (F6 comptes dev, PostHog VPS, Beta signing) + l'ADR rattrapage sans blocker)

## PROJET

Nom : Mivro (anciennement MidPoint, renommé suite à conflit App Store — voir ADR-011)
Slogan : "Find your mivro." / "Trouvez votre mivro."
Stack : React Native 0.85.2 + TypeScript strict + New Architecture ON
Phase actuelle : PHASE 1 — Mobile iOS + Android (MVP)
Architecture : Clean Architecture + Ports/Adapters
Doc : Docusaurus + TypeDoc → docs-site/

### Contexte d'ingénierie (lire en début de session)

- `docs/context/ARCHITECTURE.md` — architecture réelle du code (couches, entités, ports, stores, composants)
- `docs/context/PROGRESS.md` — historique des sprints, commits, métriques, pièges rencontrés
- `docs/context/TODO.md` — tâches restantes priorisées (P0→P3), dette technique, décisions en attente

---

## MODE DE TRAVAIL (AUTONOMIE)

Objectif : maximiser l'autonomie de Claude Code, minimiser les allers-retours.

- Tu **enchaînes les étapes** d'une feature automatiquement (entité → port → usecase → adapter → hook → UI → i18n → DI → tests → docs).
- Tu **modifies / ajoutes / supprimes** des fichiers SANS demander, tant que tu respectes les règles bloquantes ci-dessous.
- En cas d'erreur de build/test, tu **tentes un fix automatique jusqu'à 2 fois** avant de signaler.
- Tu **PAUSES** uniquement si :
  - une décision produit / architecture est ambiguë ;
  - une feature nécessite un secret, un compte ou un fichier externe que tu ne peux pas créer (ex : Firebase, Apple/Google dev, clé API prod) — voir ⚠️ PAUSE OBLIGATOIRE dans la roadmap ;
  - tu n'es pas certain d'une convention Claude Code → recherche web doc officielle Anthropic, sinon demande.
- Si une spec manque → ajoute un TODO explicite « ⚠️ À SPÉCIFIER AVEC CÉDRIC » plutôt que d'inventer.
- Si tu détectes une incohérence dans les specs → signale-la.
- À la fin de chaque feature : **résumé + mise à jour des docs (voir AUTO-MAINTENANCE) + commit**.

---

## COMMANDES

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
npm run test:e2e         # Maestro
```

### Documentation

```bash
npm run docs             # TypeDoc → docs-site/docs/api/
npm run docs:dev         # Docusaurus dev server port 3001
npm run docs:build
```

---

## RÈGLES BLOQUANTES (violation = STOP, ne pas continuer)

### TypeScript

- **TS-001** `any` INTERDIT. Alternatives : `unknown` | `z.infer<>` | `never`
- **TS-002** Cast direct (`as Type`) INTERDIT sauf commentaire justificatif
- **TS-003** Non-null assertion (`!`) INTERDITE sauf commentaire justificatif
- **TS-004** Données externes → validation Zod OBLIGATOIRE

### i18n

- **I18N-001** Zéro string hardcodée. Tout via `useTranslation()`
- **I18N-002** String hardcodée détectée → signaler 💡 avant tout

### Logging

- **LOG-001** Format imposé :
  `[LEVEL][FileName][functionName][line][HH:mm:ss] message`

### Erreurs

- **ERR-001** try/catch sur TOUS les appels réseau et I/O
- **ERR-002** ErrorBoundary sur tous les écrans critiques
- **ERR-003** Zéro happy path incomplet (loading + error + empty)

### Documentation

- **DOC-001** TSDoc complet sur toutes les fonctions/méthodes publiques
- **DOC-002** `@param` + `@returns` + `@throws` obligatoires
- **DOC-003** Décision d'architecture → ADR dans `docs-site/docs/adr/`
- **DOC-004** `npm run docs` doit passer sans erreur

### Formatage

- **FMT-001** `npm run check` doit passer sans erreur ni warning

### Accessibilité (voir guidelines/accessibility.md)

- **A11Y-001** Contraste WCAG AA respecté (4.5:1 texte normal, 3:1 large/UI)
- **A11Y-002** Touch target ≥ 44pt iOS / 48dp Android
- **A11Y-003** `accessibilityLabel` + `accessibilityRole` + `accessibilityHint`
- **A11Y-004** Dynamic Type supporté (test à 200%)
- **A11Y-005** `AccessibilityInfo.isReduceMotionEnabled()` respecté
- **A11Y-006** Vue alternative texte pour la carte temps réel

### Design System (voir src/core/theme/)

- **DS-001** Aucun magic number — tous styles via `theme` tokens
- **DS-002** `StyleSheet.create()` + tokens (jamais de styles inline)
- **DS-003** Dark mode via `useColorScheme()` + tokens light/dark
- **DS-004** Atomic Design strict : atoms → molecules → organisms → templates

---

## ARCHITECTURE

Organisation : **feature-first + couche `services/`** (alignée sur lineguard). Règle de dépendance (violation = refactoring immédiat) :

```
features + components + state → services ← (rien)
services/infra implémente les ports de services/domain
```

- `services/domain` (usecases + ports) : JAMAIS d'import depuis `features`, `components`, `state` ni `services/infra`.
- `features` / `components` / `state` : JAMAIS d'import d'un adapter concret `services/infra` — uniquement via `serviceContainer`.
- `entities` et `theme` sont transverses (importables partout).

Changer de provider API :
→ Modifier UNE ligne dans `src/services/serviceContainer.ts` uniquement

```
src/
├── features/             # feature-first : écrans + hooks propres à la feature
│   ├── Session/  POI/  Sharing/  Profile/  Biometric/
│   │   └── screens/<Nom>/<Nom>.tsx (+ <Nom>.test.tsx co-localisé) · hooks/ · utils/
├── components/           # KIT UI GLOBAL — Atomic Design (DS-004)
│   └── atoms/ molecules/ organisms/ templates/   (<Nom>/<Nom>.tsx + <Nom>.test.tsx)
├── services/             # logique métier + infra
│   ├── domain/           # usecases + ports (I*) par domaine : midpoint|geocode|geolocation|poi|sharing|realtime|user|biometric|storage|crash
│   ├── infra/            # adapters : geocode(Nominatim)|poi(Overpass)|realtime(Firebase)|geolocation|storage(MMKV)|security(Keychain)|crash(Sentry)|media
│   ├── utils/            # geo/ format/ (helpers purs)
│   ├── serviceContainer.ts   # SEUL fichier connaissant les implémentations
│   └── queryClient.ts
├── state/                # stores Zustand (centralisés)
├── entities/             # modèles de domaine Zod (transverse)
├── theme/                # tokens + useTheme (transverse)
├── hooks/                # hooks transverses (useDebounce, useCrashReporter)
├── navigations/          # RootNavigator | BottomTabsNavigator | linking | types
├── i18n/                 # index.ts | locales/fr | locales/en
├── test-utils/           # helpers de test (coordinates, queryClientWrapper) — hors coverage
├── App.tsx
└── docs-site/            # Docusaurus + TypeDoc
```

> **Tests co-localisés** : chaque `*.test.ts(x)` vit à côté de son sujet (les tests d'intégration en `*.integration.test.tsx`). Plus de dossier `__tests__/` centralisé ; l'E2E Maestro est à la racine `e2e/`.
> Détail à jour de l'arborescence réelle, des entités/ports/usecases/stores/hooks/composants existants : voir `docs/context/ARCHITECTURE.md`.

---

## TYPESCRIPT — tsconfig.json

Options critiques :

```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

Alternatives au `any` :

- `unknown` → données de l'extérieur (API, storage)
- `never` → cas impossibles / switch exhaustif
- `Record<string, unknown>` → objet de forme inconnue
- `z.infer<typeof Schema>` → PRÉFÉRÉ pour données externes
- `ReturnType<typeof fn>` → type inféré depuis une fonction

---

## STATE MANAGEMENT

Pattern retenu : **Zustand + TanStack Query**
Pourquoi pas Redux : trop verbeux pour solo dev, même avec RTK.

### Zustand — état client global

| Store                 | Rôle                                            |
| --------------------- | ----------------------------------------------- |
| `useSessionStore`     | Session en cours (participants, midpoint, POIs) |
| `useAuthStore`        | Utilisateur connecté / guest                    |
| `useRealtimeStore`    | Positions GPS temps réel des participants       |
| `usePreferencesStore` | Dark mode, langue, biométrie (persisted MMKV)   |

Règles :

- Un store par domaine (pas un god-object)
- Actions explicites (setMidpoint, addParticipant)
- Sélecteurs mémoïsés
- Types stricts, zéro any

### TanStack Query — état serveur/async

| Hook               | Cache | Retry |
| ------------------ | ----- | ----- |
| `useGeocodeQuery`  | 1 min | 2x    |
| `usePOIQuery`      | 5 min | 2x    |
| `useETAQuery` (V1) | 30s   | 2x    |

Règles :

- QueryClient configuré dans `di/container.ts`
- Invalidation après changement de session
- Erreurs catchées et remontées à l'UI

---

## STORAGE

| Type de donnée                   | Storage                   | Raison                                 |
| -------------------------------- | ------------------------- | -------------------------------------- |
| Auth tokens (JWT, refresh)       | **react-native-keychain** | Secure enclave / Keystore              |
| Préférences utilisateur          | **MMKV**                  | Rapide, persisté, supporte chiffrement |
| Cache POI / géocodage            | **MMKV**                  | Performance > AsyncStorage             |
| Photos profil (binaire local)    | FileSystem                | MVP local, S3 en V1                    |
| Sessions complétées (historique) | **AsyncStorage**          | Volume modéré, non sensible            |

⚠️ AsyncStorage **non chiffré** sur Android par défaut → ne JAMAIS y stocker de secrets.

---

## OBSERVABILITÉ

### Sentry — Crash reporting

- Initialisation dans `App.tsx` (ou `index.js`)
- Port `ICrashReporter` → `SentryCrashReporter`
- `beforeSend` : scrubber les coordonnées GPS, emails, tokens
- Source maps uploadées en CI sur build release

### PostHog auto-hébergé — Analytics produit

- Instance auto-hébergée (RGPD compliant, données EU)
- Port `IAnalyticsService` → `PostHogAnalytics`
- Events trackés : feature usage, parcours utilisateur, erreurs UX
- **JAMAIS** : positions GPS exactes, identités, contenus utilisateur
- Opt-out utilisateur respecté (paramètre dans usePreferencesStore)

---

## LOCALISATION TEMPS RÉEL

Backend : Firebase Realtime Database (free tier MVP)
Lib GPS : @react-native-community/geolocation
Lib background (V1) : react-native-background-geolocation

### Projet Firebase (F4 — câblé 2026-06-20)

- **Projet** : `mivro-40125` — Realtime Database région **europe-west1** (EU → RGPD OK).
- **URL** : `https://mivro-40125-default-rtdb.europe-west1.firebasedatabase.app/` exposée via `FIREBASE_DATABASE_URL` (`.env` / `.env.example`, typée `react-native-config`). **Publique, pas un secret.**
- ⚠️ Une instance RTDB **hors `us-central1`** exige l'URL explicite : `FirebaseRealtimeService.db()` fait `getDatabase(getApp(), url)` (fallback `getDatabase(getApp())` si vide).
- **Rules** : `database.rules.json` (+ `database.rules.README.md`) ; `firebase.json` → `database.rules.json`. Racine fermée, `sessions/$sessionId/participants/$participantId` validés (MVP sans auth, `$sessionId` = UUID ; durcissement futur = Firebase Anonymous Auth).
- **Code + rules prêts.** Restent à Cédric : `GoogleService-Info.plist` (iOS) + `google-services.json` (`android/app/`), déploiement des rules (`firebase deploy --only database`), `pod install`. Voir `docs/context/TODO.md`.

### Structure Firebase

```
sessions/{sessionId}/participants/{participantId}/
  latitude    : number
  longitude   : number
  updatedAt   : timestamp (serverTimestamp)
  speed       : number (km/h)
  heading     : number (0-360°)
  isOnline    : boolean
```

### Port IRealtimeService

- `subscribeToSession(sessionId, onUpdate) → unsubscribe`
- `publishLocation(sessionId, participantId, location)`
- `leaveSession(sessionId, participantId)`

### Optimisations batterie (obligatoires)

- Update GPS 5s si speed > 5 km/h
- Update 30s si à l'arrêt
- Désactivation si app en arrière-plan (MVP)
- Background tracking en V1

---

## TESTS

### Seuils bloquants en CI

| Couche                                                                         | Seuil |
| ------------------------------------------------------------------------------ | ----- |
| `src/entities/` `src/services/domain/` `src/services/utils/` `src/theme/`      | 90%   |
| `src/services/infra/`                                                          | 70%   |
| `src/features/` `src/components/` `src/state/` `src/hooks/` `src/navigations/` | 50%   |
| Global                                                                         | 70%   |

### Règles

- Chaque UseCase = 1 fichier `*.test.ts` dédié
- Stores Zustand testés via actions + sélecteurs
- TanStack Query testé avec QueryClient de test
- Firebase mocké via `IRealtimeService` (port)
- jest-mock-extended pour mocks typés (zéro any)

### E2E Maestro

```
create-session.yaml     | search-poi.yaml
share-session.yaml      | auth-biometric.yaml
realtime-tracking.yaml  | eta-display.yaml
```

---

## DOCUMENTATION

```
docs-site/docs/
├── intro.md
├── architecture/
│   ├── overview.md
│   ├── phase-1-mobile.md
│   ├── phase-2-auto-carplay.md
│   └── phase-3-watch.md
├── guides/
│   ├── getting-started.md
│   ├── swap-api-provider.md
│   ├── add-new-screen.md
│   ├── add-new-poi-category.md
│   ├── add-new-language.md
│   ├── realtime-setup.md
│   ├── design-system.md
│   └── accessibility.md
├── adr/
│   ├── ADR-001-nominatim-vs-google.md
│   ├── ADR-002-clean-architecture.md
│   ├── ADR-003-expo-vs-rn-cli.md
│   ├── ADR-004-guest-first-auth.md
│   ├── ADR-005-zustand-vs-redux.md
│   ├── ADR-006-firebase-realtime.md
│   ├── ADR-007-new-architecture.md
│   ├── ADR-008-mmkv-storage.md
│   ├── ADR-009-external-apis-scaling.md
│   ├── ADR-010-sentry-posthog.md
│   ├── ADR-011-rename-midpoint-to-mivro.md
│   ├── ADR-012-emoji-avatars-vs-svg.md
│   └── ADR-013-profile-photo-filesystem-vs-base64.md
└── api/                       # Généré par TypeDoc
```

### Format ADR

```
# ADR-XXX : Titre
Date     : YYYY-MM-DD
Statut   : Accepté | Supersédé | Déprécié
Contexte : Pourquoi cette décision
Décision : Ce qui a été choisi
Raisons  : Arguments retenus
Compromis: Trade-offs acceptés
Alternatives écartées : Avec raisons
```

---

## RGPD

- Consentement GPS AVANT tout accès localisation
- Consentement partage temps réel EXPLICITE et SÉPARÉ :
  _"Acceptes-tu de partager ta position avec les participants ?"_
- Position Firebase supprimée à la fin de chaque session
- Aucune position stockée en base persistante
- Suppression compte = clear MMKV + AsyncStorage + Keychain + Firebase
- Liens de partage expirables : 24h guest / 7j compte
- PostHog auto-hébergé → données EU
- Sentry → scrubber des données sensibles dans `beforeSend`

---

## ROADMAP COMPLÈTE (jusqu'à finalisation MVP)

### ✅ Fait

| Sprint  | Livrable                                                                                                  | Commit(s) clés                          |
| ------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| S01-02  | Setup RN, navigation, stores Zustand+MMKV, Sentry                                                         | `7cdacc9` `c8dcb29` `a1065f2` `0e92689` |
| S03-04  | Geocoding Nominatim + Geolocation GPS + reverse                                                           | `593ae51` `1ff8ad6`                     |
| F1      | Saisie 2-5 points + autocomplete + GPS (CreateSessionScreen)                                              | `0e2db7c`                               |
| F2      | Midpoint (centroïde + rayon) + carte react-native-maps                                                    | `cf70fce` `eb022c9`                     |
| F3      | POI Overpass + écran liste/carte toggle                                                                   | `0bca95f` `4804539`                     |
| QA P0   | Fix 7 bugs critiques device QA                                                                            | `f520911`                               |
| QA P1   | Accessibilité & robustesse (VoiceOver, erreurs réseau, GPS)                                               | `786a4e9` `ed7b0ee` `c01e29c`           |
| F7 (P1) | Profil : `displayName` + 20 avatars emoji (passe 1)                                                       | `0ade2e2`                               |
| F7 (P2) | Profil : photo (picker + FileSystem) — F7 complète (ADR-013)                                              | `ebf1215`                               |
| F4      | Temps réel Firebase (RTDB) — code+rules+projet EU câblés, testé, reviewé                                  | `1c73eeb` `c9a76d1` (2026-06-29)        |
| F5      | Partage de session — deep link `mivro://` + join collaboratif live, testé 1021, reviewé                   | `d112edb` (2026-06-29)                  |
| F8      | Biométrie — verrou Face ID/Touch ID opt-in (guest inclus), anti-lockout double filet, testé 1133, reviewé | non commité (2026-06-29)                |

Atoms livrés : `Text`, `Screen`, `TabBarIcon`, `CategoryChip`, `Avatar`
Molecules livrés : `ParticipantCard`, `EmptyState`, `AddressAutocomplete`, `AvatarPicker`, `SessionMapView`, `POICard`, `POIDetailSheet`, `POIListView`, `POIMapView`, `POIScreenHeader`

> ⚠️ Divergence à corriger : le README/anciennes notes mentionnaient des atoms `Button`/`Input`/`IconButton`/`Card`/`Spinner` — **ils n'existent pas encore**. À créer au besoin via le skill `create-atom`.

### 🔜 Sprint en cours / suivant — plus aucune feature sans blocker hors ADR rattrapage

**F8 Biométrie** ✅ (2026-06-29) : **code complet, testé (1133 tests) + reviewé APPROVED** (1 tour : 1 bloquant + 1 majeur + 2 mineurs corrigés). Non commité. Verrou **Face ID / Touch ID / empreinte**, **opt-in pour TOUT utilisateur (guest inclus)** — « compte requis » relâché car F6 bloqué (réversible quand F6 existera). Port `IBiometricService` + adapter `KeychainBiometricService` (secret sentinelle `BIOMETRY_ANY_OR_DEVICE_PASSCODE`, jamais loggé) + hook `useBiometricLock` (re-lock background/inactive + active ; **anti-lockout double filet** : fallback passcode device + échappatoire applicative) + molecule `BiometricLockScreen` (overlay) + gate `BiometricLockGate` dans `App.tsx` + toggle `ProfileScreen`. i18n `biometric` FR+EN ; natif iOS `NSFaceIDUsageDescription` + Android `USE_BIOMETRIC`. ⚠️ Restent à Cédric : tests device (Face ID/Touch ID, fallback passcode, échappatoire, masquage app-switcher) — voir `docs/context/TODO.md`.
**F5 Partage de session** ✅ (2026-06-29, `d112edb`) : deep link **`mivro://session/{id}`** + **join collaboratif live** ; étend le modèle Firebase F4 (`meta` + `members`). ⚠️ Restent à Cédric : redéployer les rules étendues, `pod install`, rebuild natif, tester le deep link + join multi-devices.
**F4 Temps réel Firebase** ✅ (2026-06-29, `1c73eeb` `c9a76d1`) : transport tranché = Firebase RTDB (**ADR-006**), projet EU `mivro-40125` (europe-west1, RGPD OK) câblé. ⚠️ Restent à Cédric : `GoogleService-Info.plist` (iOS) + `google-services.json` (Android), déploiement des rules, `pod install`.
**F7 Profil entièrement livrée** ✅ (`0ade2e2` + `ebf1215`) : avatars emoji (ADR-012) + photo FileSystem (ADR-013). Reste la **vérif device**.
**Plus aucune feature livrable sans blocker externe** : il ne reste que **F6 Auth** (comptes dev Google/Apple), **PostHog** (VPS auto-hébergé) et **Beta TestFlight/Play** (signing + clés prod) — toutes en ⚠️ PAUSE OBLIGATOIRE — plus l'**ADR rattrapage** (ADR-001→005, 007→010), seul chantier **sans blocker** restant.
⚠️ Restent à re-vérifier sur device (QA P1) : layout Dynamic Type 200 % et champ fantôme F1 (fixes posés).

### 📋 Backlog priorisé

Ordre recommandé : **Fix QA P1 → F7 → F4 → F5 → F8 → F6 → ADR → PostHog → Beta**. _(Fix QA P1, F7, F4, F5, **F8 faits** — F4/F5/F8 attendent la vérif device par Cédric. Il ne reste que des features à blocker externe (F6 comptes dev, PostHog VPS, Beta signing) + l'ADR rattrapage, seul chantier sans blocker.)_
Pour chaque feature : objectif · couches · composants · dépendances · décisions tranchées · done · complexité.

---

#### Fix QA P1 — Accessibilité & robustesse

- **Objectif** : corriger les 5 bugs P1 du QA device.
- **Couches** : presentation (a11y, layout), infrastructure (mapping erreurs réseau).
- **Tâches** :
  - VoiceOver Map : annoncer la carte (`accessibilityLabel`) + rendre le bouton "Vue liste" accessible (A11Y-003/006).
  - Layout texte 200% : fixer les cassures de mise en page (A11Y-004).
  - Message erreur réseau Nominatim : distinguer "erreur réseau" de "aucun résultat" (ERR-001/003).
  - EmptyState "aucun résultat" caché par un autre texte → fixer z-index / layout.
  - GPS mode avion : afficher une erreur si le reverse geocode échoue (ERR-001).
- **Done** : les 5 points validés, `npm run check` vert, cas testés.
- **Complexité** : S (M pour VoiceOver Map).

#### F7 — Profil — ✅ FAIT (2026-06-20, passes 1 & 2 ; ADR-012 + ADR-013 ; reste vérif device)

- **Objectif** : permettre à l'user de personnaliser son identité. `ProfileScreen.tsx` (232 l.) existe déjà → enrichir, pas créer de zéro.
- **Couches** : presentation (principalement) + `UpdateProfileUseCase` (core).
- **Composants à créer** : grille avatars (atom/molecule), intégration photo picker, édition `displayName`.
- **Avatar** : grille de 20 avatars prédéfinis (SVG ou emoji-based).
- **Photo** : photo picker (`react-native-image-picker`), resize 200×200, stockée FileSystem (cf. STORAGE).
- **Nom** : édition `displayName` → update `useAuthStore`.
- **Dépendances** : `react-native-image-picker` (permissions caméra/galerie iOS + Android).
- **Décisions tranchées** : avatars prédéfinis EN PLUS de la photo optionnelle.
- **Done** : profil éditable, persisté MMKV, avatar affiché dans `ParticipantCard`.
- **Complexité** : M.

#### F4 — Temps réel Firebase (S09-10) — ✅ FAIT (2026-06-20 ; code+tests+review APPROVED ; ADR-006 ; projet Firebase EU `mivro-40125` câblé ; reste fichiers config natifs + déploiement rules + pod install par Cédric)

- **Objectif** : voir les positions GPS live des participants sur la carte.
- **Couches** : core (`IRealtimeService` port + `TrackParticipantsUseCase` + entité `RealtimeParticipant`), infrastructure (`FirebaseRealtimeService` → `src/infrastructure/realtime/`), presentation (`useRealtimeStore`).
- **Store** : `useRealtimeStore` (Zustand, **NON persisté** — RGPD).
- **Dépendances** : `@react-native-firebase/app` + `@react-native-firebase/database`.
- **Décisions tranchées** : Realtime Database (pas Firestore) pour le MVP ; positions éphémères ; TTL court ; suppression en fin de session ; opti batterie (5s en mouvement / 30s à l'arrêt / off en background — cf. LOCALISATION TEMPS RÉEL).
- **Done** : 2 devices voient leurs positions bouger en temps réel ; vue liste a11y alternative (A11Y-006).
- **Complexité** : L.
- **⚠️ Reste à Cédric** (PAUSE « transport » levée, projet `mivro-40125` EU câblé) : enregistrer les apps iOS/Android dans la Console → `GoogleService-Info.plist` (iOS) + `google-services.json` (`android/app/`), déployer les rules (`firebase deploy --only database`), `pod install`.

#### F5 — Partage deep link (S11) — ✅ FAIT (2026-06-20 ; code + tests 1021 + review APPROVED ; reste device par Cédric)

- **Objectif** : inviter des amis à rejoindre une session.
- **Couches** : core (`SharedSession`, `ISessionShareService`, `ShareSessionUseCase` + `JoinSessionUseCase`), infrastructure (`FirebaseSessionShareService` → RTDB EU, étend le modèle F4), presentation (`useSharedSessionStore`, `useSessionShare`, `useSharedSessionSync`, `JoinSessionScreen`, `navigation/linking.ts`).
- **Deep linking** : scheme **`mivro://`** ; config `@react-navigation` linking + natif (iOS `CFBundleURLTypes`, Android `<intent-filter>`).
- **Décisions tranchées** : lien valide 24h (guest) / 7j (compte) — cf. RGPD ; join = **participant collaboratif** (midpoint recalculé) → session live ; **scheme `mivro://` seul, pas d'universal links au MVP** (AASA/assetlinks reportés — exigent domaine vérifié + hébergement ; consigné en dette `docs/context/TODO.md`, pas d'ADR dédié — décision MVP réversible).
- **Done** : ouvrir `mivro://session/{id}` rejoint la session ✅.
- **Complexité** : M.
- **⚠️ Reste à Cédric** : redéployer les rules étendues (`firebase deploy --only database`), `pod install`, rebuild natif, tester l'ouverture du lien (`xcrun simctl openurl booted mivro://session/<id>` / `adb shell am start -a android.intent.action.VIEW -d "mivro://session/<id>"`) + join multi-devices + recalcul live + suppression en fin de session.

#### F8 — Biométrie (S12) — ✅ FAIT (2026-06-29 ; code + tests 1133 + review APPROVED ; reste vérif device par Cédric)

- **Objectif** : protéger l'accès à l'app par Face ID / Touch ID / empreinte.
- **Couches** : core (port `IBiometricService` + `BiometricError`/types), infrastructure (`KeychainBiometricService` → `src/infrastructure/security/`), presentation (hook `useBiometricLock`, molecule `BiometricLockScreen`, gate `BiometricLockGate` dans `App.tsx`, toggle `ProfileScreen`) + `usePreferencesStore.biometricEnabled` (flag MMKV).
- **Dépendances** : `react-native-keychain` (déjà installé) — secret sentinelle `ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE` + `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (jamais loggé).
- **Décisions tranchées** : opt-in ; **« compte requis » relâché → ouvert à TOUT utilisateur (guest inclus)** car F6 bloqué — **réversible** quand F6 existera (pas d'ADR dédié, décision MVP). Anti-lockout **double filet** (fallback passcode device natif + échappatoire applicative `disableLockAndContinue` après 3 échecs / auto-désactivation si biométrie indispo). Re-lock dès `inactive`/`background` (masque l'app-switcher) ET au retour `→ active`.
- **Done** : toggle dans Profile + déverrouillage biométrique au lancement + re-lock au retour d'arrière-plan ✅. DI câblé, i18n `biometric` FR+EN, natif iOS `NSFaceIDUsageDescription` + Android `USE_BIOMETRIC`. ~140 tests / **1133** au total, reviewé APPROVED (1 tour).
- **Complexité** : S.
- **⚠️ Reste à Cédric** : tests device (Face ID / Touch ID / empreinte, fallback passcode device, échappatoire anti-lockout, masquage app-switcher) — voir `docs/context/TODO.md`. Dette P3 : edge iOS re-lock parasite `→active` sur `previous==='inactive'` (alerte permission Face ID au 1er run) à vérifier device.

#### F6 — Auth Google / Apple

- **Objectif** : connexion via Google / Apple Sign-In. Signatures no-op déjà présentes dans `useAuthStore`.
- **Couches** : presentation + `useAuthStore` + éventuel usecase d'auth.
- **Dépendances** : `@react-native-google-signin/google-signin` + `@invertase/react-native-apple-authentication`.
- **Décisions tranchées** : guest-first conservé (cf. ADR-004) ; auth optionnelle.
- **Done** : login Google + Apple fonctionnels, état persisté.
- **Complexité** : M.
- **⚠️ PAUSE OBLIGATOIRE** : comptes développeur requis (Google Cloud OAuth client + Apple Developer / Sign in with Apple capability).

#### ADR rattrapage

- **Objectif** : documenter rétroactivement les décisions déjà prises. **ADR-006, ADR-011, ADR-012, ADR-013 existent déjà** ; il manque **ADR-001 → ADR-005, ADR-007 → ADR-010** (référencés dans la section DOCUMENTATION).
- **À écrire** : ADR-001 Nominatim vs Google, ADR-002 Clean Architecture, ADR-003 Expo vs RN CLI, ADR-004 Guest-first auth, ADR-005 Zustand vs Redux, ~~ADR-006 Firebase Realtime~~ (écrit avec F4), ADR-007 New Architecture, ADR-008 MMKV, ADR-009 External APIs scaling, ADR-010 Sentry+PostHog.
- **Format** : voir DOCUMENTATION > Format ADR. Emplacement `docs-site/docs/adr/`.
- **Done** : `npm run docs` passe ; chaque ADR au format imposé.
- **Complexité** : M (rédaction).

#### PostHog analytics

- **Objectif** : analytics produit RGPD-compliant.
- **Couches** : core (`IAnalyticsService` port), infrastructure (`PostHogAnalytics` → `src/infrastructure/analytics/`), presentation (opt-out dans `usePreferencesStore`).
- **Décisions tranchées** : auto-hébergé (VPS, données EU) ; JAMAIS de GPS exact / identités / contenus ; opt-out respecté.
- **Done** : events feature-usage trackés, opt-out fonctionnel.
- **Complexité** : M.
- **⚠️ PAUSE OBLIGATOIRE** : setup infra serveur (instance PostHog auto-hébergée + clé projet).

#### TestFlight + Play Beta (S12)

- **Objectif** : distribution beta iOS + Android.
- **Tâches** : clé API Google Maps Android production, build signing, provisioning profiles, upload stores.
- **Done** : build distribuable sur TestFlight + Play Console (piste interne), coverage global ≥ 70%.
- **Complexité** : L.
- **⚠️ PAUSE OBLIGATOIRE** : secrets de signing + clés API prod.

---

## ROADMAP MACRO (post-MVP — référence)

### Phase 1 MVP (S01-S12)

| Semaines | Livrable                                                                     |
| -------- | ---------------------------------------------------------------------------- |
| S01-02   | Setup complet (infra + stores + Firebase + Sentry + PostHog + Design System) |
| S03-04   | Saisie + Geocoding Nominatim                                                 |
| S05-06   | Midpoint + Carte statique react-native-maps                                  |
| S07-08   | POI Overpass + toggle liste/carte                                            |
| S09-10   | Temps réel Firebase + carte participants + vue liste a11y                    |
| S11      | Partage deep link                                                            |
| S12      | Profil + Biométrie + 70% coverage + TestFlight + Play Beta                   |

### Phase 2 V1

Background GPS | ETA OSRM | Géofencing | Tablette | ES+DE | S3

### Phase 3

Android Auto + CarPlay (ADR obligatoire avant)

### Phase 4

watchOS + WearOS (ADR obligatoire avant)

### Phase 5

Monétisation

---

## AUTO-MAINTENANCE DES DOCS (RÈGLE)

À la fin de CHAQUE sprint / feature, tu DOIS — et ces updates font partie du **commit de la feature** :

1. **`docs/context/PROGRESS.md`** — ajouter ce qui a été livré (fichiers clés, tests, commit hash).
2. **`docs/context/TODO.md`** — cocher le fait, ajouter les découvertes / nouvelles tâches / blockers.
3. **`docs/context/ARCHITECTURE.md`** — mettre à jour si nouveaux patterns / composants / ports / stores.
4. **CLAUDE.md > ROADMAP > ✅ Fait** — déplacer la feature terminée depuis le backlog.
5. Si décision d'architecture prise → **nouvel ADR** dans `docs-site/docs/adr/` (DOC-003).

---

## PROPOSITIONS D'AMÉLIORATIONS (proactif)

Format imposé :

```
💡 AMÉLIORATION : [titre]
   Contexte    : [pourquoi maintenant]
   Proposition : [quoi faire]
   Effort      : XS | S | M | L | XL
   Impact      : Faible | Moyen | Élevé
   Cible       : MVP | V1 | V2 | Hors scope
```

Domaines à surveiller :
Performance · Sécurité · A11y · UX · Architecture · Tests · i18n
TypeScript · Documentation · Batterie (GPS) · Coût Firebase · Vie privée

### Code Review en fin de feature

- **JUNIOR** : explication pas à pas
- **SENIOR** : trade-offs, architecture, maintenabilité

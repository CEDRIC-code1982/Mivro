# CLAUDE.md — MidPoint

# Fichier lu automatiquement par Claude Code à chaque session.

# À placer à la racine du repo.

# Ne pas modifier sans créer un ADR correspondant.

# Version 8.0 — Avril 2026

## PROJET

Nom : MidPoint
Slogan : "Meet in the middle." / "Retrouvez-vous à mi-chemin."
Stack : React Native 0.85.2 + TypeScript strict + New Architecture ON
Phase actuelle : PHASE 1 — Mobile iOS + Android (MVP)
Architecture : Clean Architecture + Ports/Adapters
Doc : Docusaurus + TypeDoc → docs-site/

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

Règle de dépendance (violation = refactoring immédiat) :

```
presentation → core ← infrastructure
```

- `core` : JAMAIS d'import depuis `presentation` ou `infrastructure`
- `presentation` : JAMAIS d'import depuis `infrastructure`

Changer de provider API :
→ Modifier UNE ligne dans `src/di/container.ts` uniquement

```
src/
├── core/
│   ├── entities/         # Location | User | PointOfInterest | MidpointSession | RealtimeParticipant
│   ├── usecases/         # CalculateMidpoint | SearchPOI | ShareSession | TrackParticipants | ComputeETA
│   ├── ports/            # IGeocodeService | IPOIService | IStorageService | IRealtimeService | IETAService | ICrashReporter | IAnalyticsService
│   └── theme/            # tokens.ts | light.ts | dark.ts | index.ts
├── infrastructure/       # Nominatim | Overpass | MMKV | AsyncStorage | FirebaseRealtime | OSRM | Sentry | PostHog
├── presentation/         # screens | components/{atoms,molecules,organisms,templates} | hooks | navigation | stores
├── i18n/                 # index.ts | locales/fr | locales/en
├── di/container.ts       # SEUL fichier connaissant les implémentations
├── __tests__/            # unit | integration | e2e
└── docs-site/            # Docusaurus + TypeDoc
```

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

| Couche                | Seuil |
| --------------------- | ----- |
| `src/core/`           | 90%   |
| `src/infrastructure/` | 70%   |
| `src/presentation/`   | 50%   |
| Global                | 70%   |

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
│   └── ADR-010-sentry-posthog.md
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

## ROADMAP

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

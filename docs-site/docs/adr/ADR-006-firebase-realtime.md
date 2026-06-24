# ADR-006 : Firebase Realtime Database pour le suivi de position temps réel (MVP)

Date : 2026-06-20
Statut : Accepté
Auteur : Cédric Pineau

## Contexte

La feature F4 (Temps réel) doit afficher, sur la carte, les positions GPS
**live** des participants d'une session, en multi-appareils. Cela suppose un
transport temps réel côté backend : pousser la position d'un device et recevoir
celles des autres avec une faible latence, sans serveur applicatif à maintenir
(développeur solo, MVP).

Contraintes :

- **MVP sans backend custom** : pas de serveur WebSocket à opérer / héberger.
- **Positions éphémères** (RGPD) : aucune position ne doit subsister en base
  après la fin d'une session ; détection de déconnexion brutale nécessaire.
- **Optimisation batterie** : la fréquence de publication GPS doit pouvoir être
  pilotée côté client (5s en mouvement / 30s à l'arrêt / off en arrière-plan).
- **Découplage** : le transport doit rester substituable (règle de dépendance
  Clean Architecture — le core et la presentation ne connaissent pas Firebase).

## Décision

Le suivi temps réel du MVP s'appuie sur **Firebase Realtime Database (RTDB)**,
via `@react-native-firebase/app` + `@react-native-firebase/database` (v25, **API
modulaire**).

- Structure : `sessions/{sessionId}/participants/{participantId}` (latitude,
  longitude, updatedAt = `serverTimestamp`, speed, heading, isOnline).
- L'accès est confiné derrière le port **`IRealtimeService`** (core) ; le seul
  importateur de Firebase est l'adapter **`FirebaseRealtimeService`**
  (`src/infrastructure/realtime/`). Le câblage se fait dans `di/container.ts`
  (swap de transport = 1 ligne).
- **RGPD / déconnexion** : `onDisconnect(ref).update({ isOnline: false })` est
  **armé avant** l'écriture de position (le serveur repasse le participant
  offline en cas de coupure brutale) ; `leaveSession` **annule** l'onDisconnect
  puis **supprime** le nœud (`remove`) — aucune position persistée en fin de
  session.
- **Batterie** : l'adapter géoloc émet brut ; le throttling 5s/30s et la coupure
  en arrière-plan (AppState) vivent dans `useRealtimeTracking` (presentation).
- **Consentement** : la publication (et le watch GPS lui-même) n'a lieu que si
  l'utilisateur a donné un consentement de partage explicite et séparé
  (`hasSharingConsent`, non persisté).

## Raisons

- **Zéro backend à opérer** : RTDB gère la synchro temps réel, l'auth anonyme et
  la persistance managée — idéal pour un MVP solo, free tier suffisant.
- **`onDisconnect` natif** : primitive serveur qui détecte les coupures brutales
  (perte réseau / kill app) — exactement ce qu'il faut pour repasser un
  participant offline et garantir le nettoyage RGPD.
- **Modèle simple key/value arborescent** : adapté à un petit ensemble de
  positions par session, plus léger et moins cher que Firestore pour ce cas
  (écritures fréquentes, documents minuscules, pas de requêtes complexes).
- **SDK React Native mûr** : RNFirebase v25 expose une API modulaire
  tree-shakable ; auto-configuration via les fichiers natifs (pas de
  `[FIRApp configure]` manuel).
- **Substituable** : isolé derrière `IRealtimeService` → un futur transport
  (WebSocket maison, Supabase Realtime…) ne touche ni le core ni l'UI.

## Compromis

- **Dépendance à un service Google** : verrouillage modéré sur l'écosystème
  Firebase (atténué par le port qui rend le transport remplaçable).
- **Config native requise** : `GoogleService-Info.plist` (iOS) +
  `google-services.json` (Android) + `use_modular_headers!` (Podfile, pods Swift
  Firebase). Au runtime seulement — `tsc` compile sans ces fichiers. → action
  externe (PAUSE OBLIGATOIRE) : projet Firebase à créer par Cédric.
- **Security Rules à écrire** : sans règles restrictives sur
  `sessions/{sessionId}`, la base est ouverte. À définir avant toute mise en
  ligne réelle.
- **Coût au-delà du MVP** : le free tier suffit pour la beta ; à surveiller si le
  volume de sessions/écritures grandit (cf. domaine « Coût Firebase »).

## Alternatives écartées

- **Cloud Firestore** : modèle document plus riche et meilleures requêtes, mais
  surdimensionné et plus coûteux pour des positions éphémères à écriture
  fréquente ; `onDisconnect` n'existe pas nativement (détection de présence plus
  lourde à implémenter). Écarté pour le MVP.
- **WebSocket / serveur maison (Socket.IO, etc.)** : contrôle total, mais impose
  d'opérer et de scaler un backend temps réel — hors budget MVP solo.
- **Supabase Realtime / Ably / Pusher** : viables, mais soit re-introduisent un
  backend à gérer (Postgres pour Supabase), soit un coût/intégration RN moins
  mûrs que RNFirebase au moment du choix. Réévaluables en V1.
- **Polling REST périodique** : trop de latence et de consommation batterie/réseau
  pour un suivi « live ». Écarté.

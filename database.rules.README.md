# Firebase Realtime Database — Security Rules (`database.rules.json`)

Règles RTDB pour la feature F4 (temps réel). Déploiement :

```bash
firebase deploy --only database
```

## Modèle MVP (guest-first, PAS de Firebase Auth)

- **Racine** : `".read": false` / `".write": false` → aucun listing global des
  sessions, pas d'accès hors chemin explicite.
- **`sessions/$sessionId/participants/$participantId`** : `read` + `write`
  autorisés. La protection repose sur le fait que `$sessionId` est un **UUID
  non devinable** (capability URL, partagée via deep link `mivro://`).
- **Validation de forme** alignée sur `RealtimeParticipantSchema`
  (`src/core/entities/RealtimeParticipant.ts`) :
  - `latitude` number ∈ [-90, 90]
  - `longitude` number ∈ [-180, 180]
  - `heading` number ∈ [0, 360]
  - `speed` number ≥ 0
  - `isOnline` boolean
  - `updatedAt` présent (écrit via `serverTimestamp()`)
  - `$other` : `".validate": false` → **tout champ inconnu est refusé**.

## ⚠️ Durcissement futur (NON implémenté — nécessite Firebase Anonymous Auth)

Le modèle actuel autorise n'importe quel client connaissant le `$sessionId` à
écrire/supprimer n'importe quel nœud participant de la session (y compris ceux
des autres). C'est acceptable pour le MVP guest-first, mais à durcir avant prod.

Quand **Firebase Anonymous Auth** sera introduit (story dédiée, ADR à écrire) :

- réserver l'écriture au propre nœud du participant :
  `".write": "auth != null && auth.uid === $participantId"` (ou mapping
  `auth.uid` → `participantId`) ;
- restreindre `read` aux membres authentifiés de la session ;
- envisager un nœud `meta` de session (créateur, expiration) pour valider
  l'appartenance.

Tant que l'app reste guest-only (cf. ADR-004), ce durcissement n'est PAS en
place — c'est une dette de sécurité connue et assumée pour le MVP.

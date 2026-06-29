# Firebase Realtime Database — Security Rules (`database.rules.json`)

Règles RTDB pour les features F4 (temps réel) et F5 (partage de session).
Déploiement :

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

## Partage de session F5 — `sessions/$sessionId/{meta,members}`

Le partage collaboratif (F5) ajoute deux sous-nœuds à côté de `participants` :

- **`meta`** : cycle de vie de la session partagée
  (`createdAt`, `expiresAt`, `ownerType`, `status`, `midpoint?`, `midpointRadius?`),
  aligné sur `SharedSessionMetaSchema` (`src/core/entities/SharedSession.ts`).
- **`members/$memberId`** : roster des points de départ collaboratifs
  (`displayName`, `avatarId?`, `startLocation{latitude,longitude,formattedAddress}`),
  aligné sur `SharedSessionMemberSchema`.
- `$other : ".validate": false` partout → **tout champ inconnu est refusé**.

### Champs `meta` immuables après création (durcissement review F5)

`createdAt`, `expiresAt`, `ownerType` et `status` sont **immuables après leur
première écriture** :

```text
".validate": "<typeCheck> && (!data.exists() || data.val() === newData.val())"
```

→ une fois posés à la création, ils ne peuvent plus être réécrits. Cela empêche
qu'un client connaissant le `$sessionId` (capability URL) **rallonge `expiresAt`**
(contournement du TTL RGPD), **rouvre une session fermée** (`status`) ou
**usurpe `ownerType`**. Restent volontairement **modifiables** :
`meta/midpoint` + `meta/midpointRadius` (recalcul collaboratif à chaque join) et
le sous-nœud `members` (ajout de membres).

### ⚠️ Risque résiduel (MVP sans auth)

Le modèle MVP reste **sans Firebase Auth** : la protection repose sur le
`$sessionId` (UUID non devinable). Conséquences assumées tant que guest-only :

- un client connaissant le `$sessionId` peut toujours **ajouter / écraser un
  membre** ou **modifier le midpoint** ;
- l'immuabilité ci-dessus est appliquée **côté règles** (déclaratif) et ne
  remplace pas une véritable autorisation par identité.

Durcissement = **Firebase Anonymous Auth** (même story que F4 ci-dessus) :
réserver l'écriture du nœud `meta` au créateur (`auth.uid`), et l'écriture d'un
membre à son propriétaire.

### ⚠️ Expiration (`expiresAt`) — purge SERVEUR requise (NON implémentée)

`expiresAt` n'est qu'une **donnée** : les règles RTDB ne suppriment **rien**
automatiquement et **ne refusent pas la lecture d'un nœud expiré**. Le client
(`JoinSessionUseCase`) vérifie l'expiration à la jointure et rejette (`expired`),
mais **le nœud expiré persiste en base**. La suppression effective en fin de
session repose aujourd'hui uniquement sur le **propriétaire** qui appelle
`deleteSharedSession` au reset (best-effort, côté client — peut échouer si l'app
est tuée ou hors ligne).

Pour que l'expiration RGPD soit **réellement effective**, il faut une **purge
serveur** (NON encore en place) :

- une **Cloud Function** planifiée (cron) qui balaie `sessions/` et `remove()` les
  nœuds dont `meta/expiresAt < now` ; ou
- un mécanisme de **TTL** côté backend.

Tant que cette purge n'existe pas, des nœuds expirés peuvent rester en base
au-delà de 24h/7j → **dette RGPD connue** à traiter avant prod (story dédiée).

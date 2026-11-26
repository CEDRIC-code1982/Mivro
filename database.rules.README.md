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

### Niveau `sessions/$sessionId` — lecture et cycle de vie (2026-11-16)

Les règles RTDB **ne sont pas des filtres** : une lecture ou une écriture à un chemin est refusée
en bloc si aucune règle ne l'accorde **à ce chemin ou au-dessus**, même si chaque enfant est
accessible. Jusqu'au 2026-11-16, rien n'était accordé au niveau `sessions/$sessionId`, alors que le
client y travaille :

| Appel client                                                          | Chemin                             | Règle qui l'autorise                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `fetchSharedSession` — `get()`                                        | `sessions/$sessionId`              | `.read: true`                                                                                                          |
| `subscribeToSharedSession` — `onValue()`                              | `sessions/$sessionId`              | `.read: true`                                                                                                          |
| `FirebaseRealtimeService` — abonnement aux positions                  | `sessions/$sessionId/participants` | `.read: true` (hérité du niveau session)                                                                               |
| `createSharedSession` — `update({ meta, members })`                   | `sessions/$sessionId`              | `.write`, branche « pas encore de `meta` »                                                                             |
| `deleteSharedSession` — `remove()` (RGPD)                             | `sessions/$sessionId`              | `.write`, branche « suppression de la session entière »                                                                |
| `joinSharedSession`, mise à jour du midpoint, écriture d'une position | nœuds enfants                      | règles des enfants : `meta` (`.write` conditionnel, voir plus bas), `members/$memberId`, `participants/$participantId` |

```text
".read":  true
".write": "!newData.exists() || !data.child('meta').exists()"
"$other": { ".validate": false }
```

- **Lecture** : ouverte au niveau session. Elle ne donne rien de plus que les trois nœuds déjà
  lisibles un par un.
- **Écriture** : au niveau session, seulement pour **créer** la session partagée (pas encore de
  `meta` ; des `participants` F4 peuvent déjà exister, `update()` ne les touche pas) ou la
  **supprimer en entier**. L'expression est évaluée pour **toute** écriture sous la session, avec
  `data` et `newData` pris au niveau `$sessionId` ; la condition porte donc sur l'existence de
  `meta`, pas sur le chemin écrit :

  - session **partagée** (`meta` existe) : une écriture en bloc (par exemple un `set()` qui
    effacerait `participants`) est refusée ; les modifications passent par les nœuds enfants ;
  - session **F4 sans partage** (jamais de `meta`) : elle reste inscriptible en bloc, et un
    `set()` sur `sessions/X` ou `sessions/X/participants` peut effacer les positions des autres ;
  - toute écriture qui **vide** la session est accordée (`!newData.exists()`).

  Les validations (`.validate`) des enfants s'appliquent toujours aux données écrites, y compris à
  la création.

- **`$other`** refusé : aucun nœud frère de `meta`, `members` et `participants`.
- **Re-partage** d'une session déjà partagée : refusé (`meta` existe, et `createdAt` est immuable
  alors que le client en écrit un nouveau). Le client ne le tente plus : le bouton « Partager » de
  `MapScreen` reste actif une fois la session partagée, et `useSessionShare.share()` réutilise
  alors le lien existant (store partagé sur le même id) et rouvre la share sheet, sans écrire en
  base. Avant ce correctif (2026-11-16), un second appui relançait `createSharedSession` →
  `permission_denied` et une alerte d'échec sur une session qui fonctionne.

- **Re-création** après suppression ou purge : **acceptée** par les règles (`meta` n'existe plus),
  sous le même id. Le client ne la tente pas : une session chargée depuis le partage est marquée
  `isSharedCopy`, et `useSessionShare.share()` refuse de la publier (erreur `closed`), pour ne pas
  republier les adresses des autres membres avec un nouveau TTL. De même, une position écrite
  dans `participants/$participantId` après la suppression **recrée** un nœud de session sans
  `meta` (accepté par les règles, et ignoré par la purge `purgeExpiredSessions`, qui saute les
  sessions sans `meta`) : `useRealtimeTracking` arrête donc le suivi d'une copie de session
  partagée dès sa fin distante, et refuse de le démarrer sur une copie terminée.

Cette condition n'est **pas une frontière de sécurité** face à qui connaît le `$sessionId` : les
nœuds enfants permettent déjà d'écrire ou de supprimer chaque nœud un par un (hors les quatre
champs de cycle de vie de `meta`, voir ci-dessous). Elle protège la
session contre une écriture en bloc involontaire. La vraie frontière reste Firebase Anonymous Auth
(voir plus haut).

### Champs `meta` immuables après création (durcissement review F5, puis 2026-11-26)

`createdAt`, `expiresAt`, `ownerType` et `status` sont **immuables après leur
première écriture**, et **ne peuvent pas être supprimés un par un** :

```text
meta/.write:            "newData.hasChildren(['createdAt', 'expiresAt', 'ownerType', 'status'])"
meta/<champ>/.validate: "<typeCheck> && (!data.exists() || data.val() === newData.val())"
```

→ une fois posés à la création, ils ne peuvent plus être réécrits. Cela empêche
qu'un client connaissant le `$sessionId` (capability URL) **rallonge `expiresAt`**
(contournement du TTL RGPD), **rouvre une session fermée** (`status`) ou
**usurpe `ownerType`**. Restent volontairement **modifiables** :
`meta/midpoint` + `meta/midpointRadius` (recalcul collaboratif à chaque join) et
le sous-nœud `members` (ajout de membres).

**Faille fermée par la règle `.write` (branche `fix/regle-meta-immuable`, 2026-11-26).**
Jusque-là, `meta` avait `".write": true`, et les `.validate` ne sont **pas évalués
sur une suppression**. Un client qui connaissait l'UUID pouvait écrire
`meta/expiresAt = null`, puis réécrire un `expiresAt` plus lointain (la clause
`!data.exists()` est vraie à la seconde écriture) : TTL rallongé à volonté. Même
contournement pour `status`. La règle `.write` exige désormais que les quatre
champs existent encore **après** toute écriture sous `meta`. La piste
`newData.exists()` ne suffisait pas : supprimer un seul champ laisse `meta` non
vide. Choix de `hasChildren` validé par Cédric le 2026-11-26.

Écritures légitimes, vérifiées une par une :

| Écriture                                                           | Pourquoi elle reste permise                                                                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSharedSession` — `update({ meta, members })`                | accordée au niveau `sessions/$sessionId` tant que `meta` n'existe pas, et un `.write` accordé vaut pour toute la descendance                                                                  |
| `updateMidpoint` — `update(metaRef, { midpoint, midpointRadius })` | les quatre champs restent en place, tant que `meta` existe ; le client ne l'appelle plus si sa relecture voit la session supprimée (fenêtre résiduelle : voir « Risque résiduel » ci-dessous) |
| `removeMember` — `remove()` de `members/$memberId`                 | accordée par `members/$memberId: .write true` (une suppression n'évalue pas les `.validate`) ; ne touche pas `meta`                                                                           |
| `deleteSharedSession` — `remove()` de la session entière           | accordée au niveau session (`!newData.exists()`)                                                                                                                                              |
| Re-partage d'une session déjà partagée                             | toujours **refusé** par l'immuabilité de `createdAt`, comme avant (le client ne le tente plus)                                                                                                |
| Purge `purgeExpiredSessions` (`functions/index.js`)                | Admin SDK, qui ignore les règles                                                                                                                                                              |

Le test structurel `src/services/infra/realtime/databaseRules.test.ts` fige la
chaîne exacte de la règle, et vérifie que la liste des champs exigés par
`hasChildren` est égale à celle des champs qui portent la clause d'immuabilité.

**Règle provisoire.** Elle ferme la suppression champ par champ, pas la faille de
fond (voir le risque résiduel ci-dessous). La vraie réponse reste Firebase
Anonymous Auth, avec l'écriture de `meta` réservée au créateur.

### ⚠️ Risque résiduel (MVP sans auth)

Le modèle MVP reste **sans Firebase Auth** : la protection repose sur le
`$sessionId` (UUID non devinable). Conséquences assumées tant que guest-only :

- un client connaissant le `$sessionId` peut toujours **ajouter / écraser un
  membre** ou **modifier le midpoint** ;
- **supprimer puis recréer** : il peut supprimer la session entière (accordé au
  niveau session), puis la recréer sous le même id avec un `expiresAt` de son
  choix, puisque `meta` n'existe plus. C'est la même faille que celle fermée
  ci-dessus, un cran plus haut : sans identité, les règles ne savent pas
  distinguer le créateur légitime d'un autre client ;
- rien n'oblige `meta/midpoint` à porter `latitude` **et** `longitude` ensemble
  (déjà vrai avant le 2026-11-26 ; suivi : item « Forme de `meta/midpoint` » de
  `docs/context/TODO.md`) ;
- **nœud orphelin après une course à la jonction** : fermé côté client depuis
  le 2026-11-26 (`fix/jonction-session-supprimee`). Si la session est supprimée
  (par le propriétaire ou par la purge) pendant qu'un invité la rejoint, après
  sa lecture, `joinSharedSession` écrit quand même `members/$memberId` (accordé
  par `members/$memberId: .write true`). La relecture renvoie alors `null` :
  `JoinSessionUseCase` lève `not_found`, n'appelle plus `updateMidpoint` (il ne
  retombe plus sur le roster local) et, pour un nouveau membre seulement,
  supprime d'abord en best-effort le `members/$memberId` qu'il vient d'écrire
  (`removeMember`). Avant ce correctif, il restait un nœud
  `{ members: { <invité> }, meta: { midpoint, midpointRadius } }` sans
  `expiresAt`, ignoré par `purgeExpiredSessions`, avec l'**adresse de départ
  exacte** de l'invité. Les règles, elles, acceptent toujours ces écritures :
  la fermeture est côté client seulement. Deux résidus, non fermables côté
  client sans transaction :

  - si la session est supprimée **entre** la relecture et `updateMidpoint`,
    il reste un `meta = { midpoint, midpointRadius }` orphelin, ignoré par la
    purge. Il ne porte pas d'adresse, seulement une coordonnée dérivée (le
    membre a été supprimé avec la session). Anonymous Auth **fermerait** ce
    résidu si l'écriture de `meta` est réservée au créateur (`auth.uid`),
    **y compris** sur le chemin de création au niveau `sessions/$sessionId`
    (aujourd'hui accordé dès que `meta` n'existe pas, et cet accord descend
    jusqu'à `meta`) : l'invité ne pourrait plus écrire `meta/midpoint`, mais
    le recalcul du
    midpoint à la jonction ne viendrait alors plus de l'invité (à repenser
    dans cette story) ;
  - si `removeMember` échoue (best-effort : l'échec part au crash reporter, la
    méthode ne rejette jamais, l'invité voit quand même `not_found`), le
    `members/$memberId` reste, avec l'adresse exacte de l'invité. Anonymous
    Auth ne fermerait **pas** ce résidu : un invité authentifié reste
    propriétaire de son `members/$memberId`.

  Suivi : item « Tests des règles RTDB » de `docs/context/TODO.md` ;

- l'immuabilité ci-dessus est appliquée **côté règles** (déclaratif) et ne
  remplace pas une véritable autorisation par identité.

Durcissement = **Firebase Anonymous Auth** (même story que F4 ci-dessus) :
réserver l'écriture du nœud `meta` au créateur (`auth.uid`), et l'écriture d'un
membre à son propriétaire. Suivi : item « Firebase Anonymous Auth » de
`docs/context/TODO.md` (P2).

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

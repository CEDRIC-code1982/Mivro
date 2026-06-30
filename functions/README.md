# Cloud Functions — Mivro

## `purgeExpiredSessions`

Purge RGPD planifiée (toutes les heures) des sessions partagées (F5) dont
`meta.expiresAt` est dépassé. Supprime le nœud `sessions/{id}` entier (meta +
members + participants). Complète la suppression best-effort côté client
(le propriétaire supprime sa session au reset) en garantissant qu'aucune
donnée n'est conservée au-delà de l'expiration (24h guest / 7j compte).

### Prérequis

- **Plan Blaze** (pay-as-you-go) — requis par Cloud Scheduler / Cloud Functions v2.
  Le coût d'une fonction horaire sur une petite base est négligeable (free tier généreux).
- Région **`europe-west1`** (alignée sur l'instance RTDB, données EU).
- `firebase-tools` installé et authentifié (`firebase login`), projet `mivro-40125` sélectionné
  (`firebase use mivro-40125`).

### Déploiement

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### Vérifier / logs

```bash
firebase functions:log
# ou tester à la demande depuis la console GCP (Cloud Scheduler → forcer l'exécution)
```

### Notes

- Si tu ne veux pas passer en Blaze pour l'instant : la suppression côté client
  (propriétaire au reset de session) reste active ; cette fonction n'est qu'un
  filet de sécurité pour les sessions « orphelines ». À activer avant la beta.
- RTDB n'a pas de TTL natif : un scan planifié est l'approche standard à cette échelle.
  Si le volume de sessions explose, indexer/segmenter par fenêtre temporelle.

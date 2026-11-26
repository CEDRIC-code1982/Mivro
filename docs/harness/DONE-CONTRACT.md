# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Champs immuables de `meta` protégés contre la suppression (règle RTDB provisoire)

**Demande d'origine** : décision de Cédric du 2026-11-26, « règle `meta` provisoire », puis « on
suit tes recos » sur le lot proposé : `".write": "newData.hasChildren(['createdAt', 'expiresAt',
'ownerType', 'status'])"` sur `meta`, à la place de `newData.exists()`, qui laissait supprimer un
champ seul puis le réécrire.

**Branche** : `fix/regle-meta-immuable`, issue de `fix/dette-f7` (d7ce98e).

**Hors périmètre explicite** :

- `.validate` de forme sur `meta` à la création : écarté, non vérifiable sans émulateur.
- Tests des règles sur l'émulateur Firebase (`@firebase/rules-unit-testing`) : item du TODO
  existant, non traité.
- Firebase Anonymous Auth (la vraie réponse) : story à part.
- Déploiement des règles : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                             | Comment on le vérifie                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Le nœud `meta` n'accorde l'écriture que si, après l'écriture, il garde `createdAt`, `expiresAt`, `ownerType` et `status`              | `database.rules.json`, test structurel dans `databaseRules.test.ts`                                            |
| 2   | Les écritures légitimes restent permises : création au niveau session, `updateMidpoint` sur `meta`, suppression de la session entière | Relecture des règles contre `FirebaseSessionShareService` ; raisonnement écrit dans `database.rules.README.md` |
| 3   | `database.rules.README.md` décrit la règle, le contournement qu'elle ferme et son caractère provisoire                                | Relecture, capteurs `docrefs` et `docclaims`                                                                   |
| 4   | L'item « Immuabilité de `meta` contournable » du TODO est coché, noté provisoire ; le RUNBOOK porte le déploiement à faire            | Relecture, capteur `docfacts`                                                                                  |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché.
- [ ] Toute donnée externe validée par un schéma Zod.
- [ ] Toute string affichée passe par `useTranslation()`.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`.
- [ ] ADR si décision d'architecture.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] `firebase deploy --only database`, puis vérifier le partage sur deux appareils.
- [ ] Pousser la branche ; pas de PR tant que le verrou de facturation GitHub tient.

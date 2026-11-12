# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : `ci:local` — l'échec voulu de la sonde J-051 annoncé comme attendu

**Demande d'origine** : « oui je veux bien l'info échec attendu » (Cédric, 2026-11-12, après le
premier vrai run de `npm run ci:local` : l'étape 3 affiche un `X exit 127 … 1 failed` voulu qui
surprend).

**Branche** : `harness/ci-local`, même branche que le chantier `ci:local` (PR pas encore fusionnée),
issue de `develop`.

**Hors périmètre explicite** :

- Le comportement de la sonde (copie, `sed`, critère ` 1 failed`) ne change pas.
- Les items reportés de la revue 1 (parité complète, capteur d'entrée JOURNAL) restent en TODO.
- Revue en session normale, commit et push : Cédric (relock 3 fait le 2026-11-12).

---

## Conditions de fin

| #   | Condition                                                                                                                                                   | Comment on le vérifie                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Le titre de l'étape 3 porte « (1 échec attendu) », et donc sa ligne du récapitulatif aussi, sans casser l'alignement de la colonne des durées (≤ 52 octets) | Lecture de `scripts/ci-local.sh` ; cas du self-test qui exige la mention dans le titre et le récapitulatif |
| 2   | Une ligne d'info précède la sortie de la sonde : « ℹ la copie du self-test contient un appel mort volontaire : X exit 127 et 1 failed sont attendus »       | Cas du self-test qui exige la ligne avant la sortie de la sonde                                            |
| 3   | La parité `check.yml` ↔ `ci-local.sh` reste verte, la sortie redirigée reste sans `\033`                                                                    | `npm run check:harness` : 0 échec                                                                          |
| 4   | shellcheck vert sur les scripts touchés                                                                                                                     | `bash scripts/check-scripts.sh`                                                                            |
| 5   | Docs à jour : INVENTAIRE (CI locale), TODO (état du chantier)                                                                                               | Lecture                                                                                                    |

---

## Socle systématique

- [x] `npm run check` vert (relock 3 fait, `lock` vert).
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché — sans objet, aucun écran.
- [x] Toute donnée externe validée par un schéma Zod — sans objet.
- [x] Toute string affichée passe par `useTranslation()` — sans objet, script shell du harness.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`.
- [x] ADR si décision d'architecture — sans objet.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [x] `npm run harness:relock` (relock 3), hors Claude Code → fait (2026-11-12).
- [ ] Revue et commit en session normale, puis `npm run ci:local` vert, push.

# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Clore J-040 sur la branche du harness (lots 1 et 1 bis, rebase, relock, docs)

**Demande d'origine, en une phrase** : « fais 2 et 3 » (merger le lot 1, rebaser la branche du
harness, relock), puis le lot 1 bis (`compression`) apparu au rebase.

**Branche** : `harness/en-attente-5-8`, rebasée sur `develop` (`58e4096`).

**Hors périmètre explicite** :

- §3 d'`EN-ATTENTE.md` (sandbox pour la lecture des secrets) : décision de Cédric.
- Push (`--force-with-lease`, la branche est rebasée) et PR vers `develop` : Cédric.
- Montée de React Native 0.86+ : à spécifier avec Cédric.

---

## Conditions de fin

| #   | Condition                                                                                              | Comment on le vérifie                                    |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 1   | Lots 1 et 1 bis de J-040 dans `develop`, avec `package-lock.json` seul modifié                         | PR #1 et #2 MERGED ; `git show --stat 4242ada 58e4096`   |
| 2   | `harness/en-attente-5-8` rebasée sur `develop`, sans régression                                        | `git merge-base --is-ancestor origin/develop HEAD`       |
| 3   | Verrou refait par Cédric, conforme à l'arbre                                                           | capteur `lock` vert                                      |
| 4   | Stage `push` entièrement vert, `audit` compris, sans `--no-verify`                                     | `bash scripts/check.sh --stage push` : 13 capteurs verts |
| 5   | J-040 RÉSOLU au journal ; §1 retiré d'`EN-ATTENTE.md` ; TODO, INVENTAIRE, PROGRESS et RUNBOOK à jour   | relecture                                                |
| 6   | Aucun fichier de code ni du harness modifié par l'agent dans ce delta (docs et verrou de Cédric seuls) | `git diff 4f7d1ba --stat`                                |

---

## Socle systématique

- [x] `npm run check` vert, `lock` compris (relock de Cédric le 2026-10-08).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — sans objet (aucun code modifié).
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `JOURNAL-ECHECS.md`, `EN-ATTENTE.md`, `TODO.md`,
      `INVENTAIRE.md`, `PROGRESS.md`, `RUNBOOK.md`.
- [x] ADR : aucune nouvelle décision d'architecture.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [x] `npm run harness:relock` (2026-10-08).
- [ ] `git push --force-with-lease origin harness/en-attente-5-8`, puis PR vers `develop`.
- [ ] Décision sur le sandbox (`EN-ATTENTE.md` §3).

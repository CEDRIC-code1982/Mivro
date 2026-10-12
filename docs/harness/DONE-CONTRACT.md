# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Chantier du harness, lot 2 — sonde réseau contrôlée, règle de déverrouillage décodée (J-054, J-055, J-056)

**Demande d'origine** : mode chantier (« Go chantier », « commit et push en autonomie ») ; lot 2 =
EN-ATTENTE §1 et les trois mineurs de la 4e revue du lot 1.

**Branche** : `harness/chantier`, à la suite de `d89c1de`.

**Hors périmètre explicite** :

- EN-ATTENTE §2 (chargement de `harness_paths` par chemin dans les gardes, destination « dossier »
  de la garde Bash) et la règle `docrefs` : lots suivants.
- Rendre le pre-push strict même dans les processus de l'agent (4e revue, option) : à arbitrer avec
  Cédric, le RUNBOOK accepte aujourd'hui qu'un `! git push` hérite du chantier.
- Push et relock : Cédric, en fin de chantier.

---

## Conditions de fin

| #   | Condition                                                                                                                                   | Comment on le vérifie                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | La sonde `api.github.com` a un contrôle positif : `registry.npmjs.org` doit répondre, sinon échec nommé                                     | self-test section sandbox, sous sandbox                                 |
| 2   | Un déverrouillage dans un bloc `env` de settings est refusé même si le K final de la clé est écrit en échappement JSON (antislash, u, 004B) | cas croisé du self-test (4 fixtures) dans le clone                      |
| 3   | La règle de déverrouillage du verrou et `harness_paths.unlocked()` répondent pareil sur les mêmes settings                                  | cas croisé : clean → 3/True, plain/escaped/malformed → 1/False          |
| 4   | Les deux gardes exécutent leur chemin déverrouillé sans planter (J-056)                                                                     | 2 cas du self-test, `MIVRO_HARNESS_UNLOCK=1`                            |
| 5   | Commentaire de `pre-bash-guard.py` à jour sur le déverrouillage ; J-055 précisé, J-056 consigné ; EN-ATTENTE §1 retiré                      | relecture                                                               |
| 6   | Aucune régression                                                                                                                           | self-test du dépôt 0 failed ; `check.sh --stage check` vert sauf `lock` |

---

## Socle systématique

- [x] `npm run check` vert, sauf `lock` qui s'abstient (mode chantier, par construction).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — les settings sont décodés en JSON, malformé = échec fermé.
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `JOURNAL-ECHECS.md`, `EN-ATTENTE.md`.
- [x] ADR : aucune nouvelle décision.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric (fin de chantier)

- [ ] `npm run harness:relock`, push de `harness/chantier` depuis un terminal hors Claude Code, PR, merge.
- [ ] Relancer une session normale (sans `MIVRO_HARNESS_UNLOCK`).

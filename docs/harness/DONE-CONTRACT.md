# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Chantier du harness, lot 3 — une édition des gardes qui les casserait est refusée avant d'atterrir (J-056)

**Demande d'origine** : mode chantier (« Go chantier », commits en autonomie) ; lot 3 = les trois
mineurs de la 2e revue du lot 2, et une réponse mécanique à la 3e occurrence de J-056.

**Branche** : `harness/chantier`, à la suite de `bfe83ba`.

**Hors périmètre explicite** :

- EN-ATTENTE §2 (chargement de `harness_paths` par chemin dans les gardes, destination « dossier »,
  `mkfifo`/`mknod` dans la garde Bash) et la règle `docrefs` : lots suivants.
- Push et relock : Cédric, en fin de chantier.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                                            | Comment on le vérifie                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | En session déverrouillée, une édition de `scripts/hooks/*.py` qui casserait `harness_paths` ou la garde Bash (la voie de réparation : chargement, `unlocked()` juste et rapide, `git restore` accepté) est refusée avant d'atterrir, blocage compris | cas `edit_sim` au self-test (message vérifié)                        |
| 2   | Un échec du vérificateur lui-même ne bloque pas l'édition (refus différentiel : le même contrôle doit passer sur l'arbre actuel)                                                                                                                     | cas « health check cassé » au self-test : édition anodine → 0        |
| 3   | Les cas « chemin déverrouillé » des gardes ne passent que si la branche déverrouillée est prise                                                                                                                                                      | cible du harness + settings propres ; contrôle négatif rouge         |
| 4   | Un fichier de settings non régulier (FIFO) est refusé avant toute ouverture, dans les deux copies de la règle                                                                                                                                        | 6e fixture `fifo` du cas croisé (clone), sous garde-temps            |
| 5   | `HOME` absent ne fait plus échouer la sonde du verrou sur une variable non liée                                                                                                                                                                      | `${HOME:-}` ; shellcheck                                             |
| 6   | J-056 consigné (3e occurrence, réponse mécanique) ; aucune régression                                                                                                                                                                                | self-test du dépôt 443/0 ; `check.sh --stage check` vert sauf `lock` |

---

## Socle systématique

- [x] `npm run check` vert, sauf `lock` qui s'abstient (mode chantier, par construction).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — sans objet (harness seul).
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `JOURNAL-ECHECS.md`, `EN-ATTENTE.md`.
- [x] ADR : aucune nouvelle décision.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric (fin de chantier)

- [ ] `npm run harness:relock`, push de `harness/chantier` depuis un terminal hors Claude Code, PR, merge.
- [ ] Relancer une session normale (sans `MIVRO_HARNESS_UNLOCK`).

# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Chantier du harness, lot 4 — la garde Bash juge ce qu'une copie dépose dans un dossier (EN-ATTENTE §2b)

**Demande d'origine** : « fais le §2b puis on clôt ».

**Branche** : `harness/chantier`, à la suite de `8fd98f1`.

**Hors périmètre explicite** :

- EN-ATTENTE §2a (charger `harness_paths` par chemin explicite dans les gardes), la règle `docrefs`
  et la constante `_BROKEN` inutilisée : laissés en TODO à la clôture du chantier.
- Relock, push, PR, merge : Cédric, à la clôture.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                                                                                              | Comment on le vérifie                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 1   | Une copie de fichiers vers un dossier est jugée fichier par fichier ; une copie récursive vers le dépôt, et tout cas incertain (accolades, tout glob en source ou en destination, qualificateurs zsh, source créée dans la commande), est refusée avec un message dédié                                | cas `guard BLOCK` du self-test                |
| 2   | Les copies de fichiers légitimes en zone produit passent ; faux positifs assumés : pas de copie récursive ni par glob à l'intérieur du dépôt, ni de `mv` d'un dossier (passer par `git mv`)                                                                                                            | cas `guard ALLOW` (dont `mv README.md docs/`) |
| 3   | `mkfifo` et `mknod` (options sautées) sur un chemin protégé sont refusés ; `cd -`, `pushd ±N`, `pushd -n` et CDPATH rendent le dossier courant inconnu                                                                                                                                                 | cas BLOCK et ALLOW du self-test               |
| 4   | Déverrouillé, l'écriture Bash par fichier d'un module des gardes est refusée (écrivains indirects : EN-ATTENTE §3), `git restore` reste ouvert                                                                                                                                                         | 15 cas `guard_unlocked`                       |
| 5   | EN-ATTENTE §2b retiré, journal à jour ; aucune régression, y compris sous chaque forme de sous-shell, imbriquée comprise (`{(…)}`, `{({(…)})}`, `then(…)`, `do(…)`, `<=(…)`) . Le refus des qualificateurs zsh qui exécutent du code (`e:…:`, `+fonction`) est un filet sans garantie : EN-ATTENTE §4c | self-test 579/0 ; `check.sh --stage check`    |

---

## Socle systématique

- [x] `npm run check` vert, sauf `lock` qui s'abstient (mode chantier, par construction).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — sans objet (harness seul).
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `EN-ATTENTE.md`, `JOURNAL-ECHECS.md`.
- [x] ADR : aucune nouvelle décision.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric (clôture du chantier)

- [ ] `npm run harness:relock`, push de `harness/chantier` depuis un terminal hors Claude Code, PR, merge.
- [ ] Relancer une session normale (sans `MIVRO_HARNESS_UNLOCK`).

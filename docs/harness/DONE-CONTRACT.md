# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : finir le harness — lots A à E (EN-ATTENTE §2a, §3, §4, fin de J-022, clôture)

**Demande d'origine** : « harness : lots A à E », sur le plan validé par Cédric : « je ne veux pas
bâcler le harness ! Je veux quelque chose de solide ! Si c'est à faire on le fait ». Chaque trou se
ferme par une règle conservatrice et bornée (une liste de ce qui est permis, tout le reste refusé),
et chaque faux positif accepté est nommé.

**Branche** : `harness/finition-lots-a-e`, issue de `fix/todo-et-libelle-poi` (`809ba70`, poussée,
PR en attente), pour ne pas entrer en conflit sur le TODO. Session déverrouillée
(`MIVRO_HARNESS_UNLOCK=1`), un commit local par lot après `APPROVED` du reviewer.

**Hors périmètre explicite** :

- Le relock, le push, la PR et la fusion (y compris `develop` dans `main`) : Cédric.
- La lecture du run CI `battery` pour J-048 : Cédric.
- La montée de React Native, l'iPhone pliable et les passkeys : après le harness.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                                                                                                                                       | Comment on le vérifie                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A   | Garde Bash : le dossier courant suit les sous-shells et devient inconnu quand un `cd` peut ne pas s'appliquer ; un nom de commande est un mot simple (liste blanche) ; les mots réservés et les préfixes zsh ne cachent plus la commande ; un groupe hors position de commande est une liste de qualificateurs permis ; `mkdir` est un écrivain | cas `Lot A` du self-test, en `BLOCK` et en `ALLOW` |
| B   | `harness_paths` est chargé par chemin explicite partout ; `check-scripts` refuse un `import harness_paths` ou un `sys.path.insert(0,` ; un faux paquet `scripts/hooks/harness_paths/` ne change pas le verdict des gardes                                                                                                                       | cas `Lot B` du self-test, capteur `scripts`        |
| C   | En session déverrouillée, `tar`, `unzip`, `curl -o`, `wget -O` et les interpréteurs sont jugés contre `scripts/hooks/` ; `patch` et `git apply` aux cibles inconnues sont refusés                                                                                                                                                               | cas `Lot C` du self-test (`guard_unlocked BLOCK`)  |
| D   | Capteurs des docs : absences démenties (sans le faux positif d'`INVENTAIRE.md`), métriques de `PROGRESS.md`, contrat périmé, chemins `src/…` cités, clés i18n contre catalogues                                                                                                                                                                 | cas `Lot D` du self-test, `npm run check` vert     |
| E   | Journal à jour (J-052 à J-056, J-022, nouvelles entrées), `EN-ATTENTE.md` vidé, `TODO.md` et `INVENTAIRE.md` à jour                                                                                                                                                                                                                             | relecture, capteurs `docrefs` et `docfacts`        |

---

## Socle systématique

- [x] `npm run check` vert (12 capteurs ; `lock` s'abstient en session déverrouillée, relock à Cédric).
- [x] Les trois états rendus pour chaque écran touché : aucun écran modifié.
- [x] Toute donnée externe validée : sans objet.
- [x] Toute string affichée passe par `useTranslation()` : aucune string ajoutée.
- [ ] Docs de contexte mises à jour : `TODO.md`, `INVENTAIRE.md`, `JOURNAL-ECHECS.md`, `EN-ATTENTE.md` (lot E).
- [x] ADR : aucune, ADR-016 couvre le harness.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre de chaque lot.

---

## Ce qui reste à Cédric

- [ ] `npm run harness:relock` hors Claude Code, après le lot E.
- [ ] Push de `harness/finition-lots-a-e`, PR vers `develop`, fusion si la CI est verte.
- [ ] J-048 : dans un run `battery` récent, vérifier que le pas `self-test counts a dead call (J-051)` est vert.
- [ ] Une nouvelle session normale, sans `MIVRO_HARNESS_UNLOCK`.

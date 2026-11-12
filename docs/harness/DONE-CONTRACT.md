# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : `npm run ci:local` — la CI `check.yml` rejouée en local, avec retour visuel

**Demande d'origine** : « fait moi une commande dans mon package.json pour lancer une CI en local au
complet avec un retour visuel dans le terminal » (2026-11-12, compte GitHub verrouillé, aucun job
Actions ne démarre). Six choix validés le 2026-11-12 (« Ok pour la CI en local »), plus le cas de
parité du self-test validé en début de chantier.

**Branche** : `harness/ci-local`, issue de `develop` (`ad43859`).

**Hors périmètre explicite** :

- gitleaks (job `security`) : pas rejoué en local, il n'est pas installé et passe par l'API GitHub ;
  il revient avec la CI GitHub.
- le verdict réel de `harness-guard` (label posé par Cédric) : en local, ligne d'information
  seulement.
- relock (`npm run harness:relock`), commit, push et PR : Cédric. Le relock 1 et le
  relock 2 (après les corrections de la revue 1) sont faits le 2026-11-12.
- reportés en TODO par la revue 1 (validé par Cédric) : parité complète `check.yml` ↔
  `ci-local.sh` (bloc `run:` entier, `env:` par pas, pas `uses:` en exceptions nommées) ; capteur
  exigeant une entrée du JOURNAL quand une plage touche le harness (à spécifier).

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                 | Comment on le vérifie                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | `npm run ci:local` lance les 4 étapes de `check.yml` (capteurs stage push sur `<base>...HEAD` avec `MIVRO_NO_ABSTAIN=1`, `check:harness`, sonde J-051 dans un `mktemp`, `check-audit.sh`) | lecture de `scripts/ci-local.sh` + run complet                                    |
| 2   | Toutes les étapes tournent même après un échec ; récapitulatif ✔/✖ avec durées et total ; exit ≠ 0 si une étape échoue                                                                    | run avec une étape forcée en échec (`--only`/variable de test), code de sortie lu |
| 3   | Titres `━━ [n/4] … ━━`, couleurs seulement sur un tty                                                                                                                                     | run redirigé dans un fichier : aucune séquence `\033`                             |
| 4   | `--install` lance `npm ci` et `npm --prefix docs-site ci` ; sans l'option, pas d'install                                                                                                  | lecture + `--help`                                                                |
| 5   | `git fetch origin` tenté, avertissement si échec, plage = `merge-base HEAD origin/develop` (repli `origin/main`)                                                                          | run sous le sandbox (fetch refusé) : avertissement affiché, plage affichée        |
| 6   | Ligne d'info `harness-change` si la plage touche le harness, via `harness_paths.is_harness` chargé par chemin                                                                             | run sur cette branche (elle touche `scripts/`)                                    |
| 7   | Le self-test échoue si une commande `run:` de `check.yml` (hors Install et Diff range) n'a pas son équivalent dans `ci-local.sh` ; contrôle négatif avec un step factice                  | `npm run check:harness` vert + cas négatif dans la sortie                         |
| 8   | `check-scripts.sh` (shellcheck) vert sur le nouveau script                                                                                                                                | `npm run check`                                                                   |
| 9   | Docs : INVENTAIRE, RUNBOOK (« Au quotidien »), TODO, PROGRESS                                                                                                                             | relecture                                                                         |
| 10  | Revue 1 : hors tty, la sortie de chaque étape est débarrassée des séquences de couleur dans `ci-local.sh` seul, code de l'étape lu dans `PIPESTATUS[0]`                                   | self-test : doublures colorées, sortie redirigée, zéro `\033`, exit 3 conservé    |
| 11  | Revue 1 : `--help` marche depuis un sous-dossier (chemin du script figé avant le `cd`)                                                                                                    | self-test : `--help` lancé depuis un sous-dossier vide du dépôt jetable           |
| 12  | Revue 1 : un échec du python3 de `harness-guard` s'affiche « non évalué », jamais « aucun fichier du harness »                                                                            | self-test : `harness_paths` de la base qui lève une exception                     |
| 13  | Revue 1 : l'avertissement du fetch cite l'erreur de git et la ref de base réellement utilisée                                                                                             | self-test : dépôt jetable sans remote `origin`                                    |
| 14  | Revue 1 : entrée JOURNAL J-065 (Actions bloqué, `ci:local` en remplacement, non couvert, condition de retrait)                                                                            | `docrefs` vert + relecture                                                        |

---

## Socle systématique

- [ ] `npm run check` vert.
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché. — aucun écran touché.
- [x] Toute donnée externe validée par un schéma Zod. — aucune donnée externe dans l'app.
- [x] Toute string affichée passe par `useTranslation()`. — aucune string d'app.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`.
- [x] ADR si décision d'architecture. — pas de décision d'architecture (outillage).
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [x] ~~`npm run harness:relock` hors Claude Code~~ → relock 1 fait (2026-11-12).
- [x] ~~Relock 2 (`npm run harness:relock` hors Claude Code), après les corrections de la revue 1~~
      → fait (2026-11-12).
- [ ] Session normale : reviewer, puis commit sur demande ; `npm run ci:local` vert avant le push.
- [ ] Push, PR vers `develop`, label `harness-change` (quand GitHub Actions revient).

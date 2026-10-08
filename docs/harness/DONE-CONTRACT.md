# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Appliquer EN-ATTENTE §6 et §7 (J-053 historique intouchable, J-054 trousseau et réseau)

**Demande d'origine, en une phrase** : « applique EN-ATTENTE §6 et §7 » (session déverrouillée de
Cédric), puis « Lance 4 » : revue et commit.

**Branche** : `harness/en-attente-5-8`, à la suite de `b1d3993`.

**Hors périmètre explicite** :

- Jeton GitHub à privilèges réduits pour les sessions Claude : réglage GitHub de Cédric (TODO).
- Push, CI de la PR #3, merge : Cédric (GitHub est refusé au réseau du sandbox, `gh` et SSH aussi).
- Règle `docrefs` (a)(b)(c) de J-051 : pas encore décrite dans EN-ATTENTE.

---

## Conditions de fin

| #   | Condition                                                                                                                                                     | Comment on le vérifie                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | §6 : `scratch_repo` échoue fermé (`$dir` vide, `git init` raté), commit par `--git-dir`, appelants arrêtés                                                    | cas du self-test ; preuve sur faux dépôt (J-053)                           |
| 2   | §6 : la sortie du self-test vérifie `HEAD` et `refs/heads`, et `tmp_dir` ne laisse plus de répertoire                                                         | run : HEAD et branches inchangés, 0 `mivro.*` neuf dans `$TMPDIR`          |
| 3   | §6 : seconde forge `.pyc` dans le `__pycache__/` voisin, contrôle qui distingue une forge ratée                                                               | self-test section 10                                                       |
| 4   | §7 : GitHub refusé au réseau du sandbox (`deniedDomains`), effet mesuré et pas seulement écrit                                                                | sonde `curl https://api.github.com` refusée (« host is on the deny list ») |
| 5   | §7 : la garde refuse `security -i/-p`, `gh auth git-credential`, `git credential fill/approve/reject`, `git credential-*`                                     | cas `guard BLOCK` du self-test, `gh pr view` toujours ALLOW                |
| 6   | §6 et §7 retirés d'EN-ATTENTE (seul y reste le §1, mineur de la 14e revue) ; J-053 et J-054 décrits comme appliqués, OUVERT jusqu'à leur preuve ; docs à jour | relecture                                                                  |
| 7   | Aucune régression                                                                                                                                             | stage `push` vert (13) ; self-test 427/0 sous sandbox (424 en CI)          |

---

## Socle systématique

- [x] `npm run check` vert, `lock` compris (relock de Cédric après §6 et §7).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — sans objet (harness seul).
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `EN-ATTENTE.md`, `JOURNAL-ECHECS.md`, `TODO.md`, `RUNBOOK.md`.
- [x] ADR : aucune nouvelle décision d'architecture (application d'ADR-016 au sandbox).
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [x] `npm run harness:relock` (2026-10-08).
- [ ] `git push origin harness/en-attente-5-8`, puis CI de la PR #3 et merge.
- [ ] Jeton GitHub à privilèges réduits (J-054).

# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Appliquer EN-ATTENTE §3, §4 et §5 (sandbox Bash J-051, première CI J-052)

**Demande d'origine, en une phrase** : « applique EN-ATTENTE §4 et §5 ». Ajoute « §3 ».

**Branche** : `harness/en-attente-5-8`, session déverrouillée (`MIVRO_HARNESS_UNLOCK=1`).

**Hors périmètre explicite** :

- `~/.claude/settings.json` (`allowUnsandboxedCommands: false`) : fichier utilisateur, à Cédric.
- Relock, push, PR : Cédric.
- Règle `docrefs` (a)(b)(c) de J-051 : pas encore décrite dans EN-ATTENTE.
- J-053 (le self-test a commité dans le vrai dépôt) : découvert en fin de tâche, consigné, et
  correctif prêt dans `EN-ATTENTE.md` §6 pour la prochaine session déverrouillée. Les deux commits
  parasites ont été retirés avant ce commit.
- J-054 (quatre autres routes vers le jeton par le trousseau, GitHub joignable depuis le sandbox) :
  trouvé par la 13e revue, consigné dans `EN-ATTENTE.md` §7, décision de Cédric (réseau, jeton).

---

## Conditions de fin

| #   | Condition                                                                                                                                                        | Comment on le vérifie                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | §4 : identité du commit synthétique, verrou rouge qui liste ses fichiers                                                                                         | `npm run check:harness`, section 3 et 7                   |
| 2   | §5 : hooks en `python3 -I -B -X pycache_prefix=…`, export dans les 9 scripts, 3 cas                                                                              | `npm run check:harness`, sections 10 et 12                |
| 3   | §3 : sandbox actif, `~/.ssh` et `~/.config/gh` illisibles sous sandbox ; garde du trousseau posée pour les routes du §3, incomplète par nature (J-054, consigné) | `PermissionError` en session ; self-test sections 1 et 10 |
| 4   | Le harness fonctionne sous sandbox                                                                                                                               | self-test 418/0 ; stage `push` vert, `lock` compris       |
| 5   | §3, §4, §5 retirés d'EN-ATTENTE ; JOURNAL, TODO, INVENTAIRE, RUNBOOK, PROGRESS à jour                                                                            | relecture                                                 |
| 6   | Verrou refait par Cédric, puis tout vert                                                                                                                         | `bash scripts/check.sh --stage push`                      |

---

## Socle systématique

- [x] `npm run check` vert, `lock` compris (relock de Cédric le 2026-10-08).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — sans objet (harness seul).
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `JOURNAL-ECHECS.md`, `EN-ATTENTE.md`, `TODO.md`,
      `INVENTAIRE.md`, `PROGRESS.md`, `RUNBOOK.md`.
- [x] ADR : le sandbox prolonge ADR-016 (protection du harness), pas de nouvelle décision.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [ ] `npm run harness:relock`, hors Claude Code.
- [ ] `"sandbox": { "allowUnsandboxedCommands": false }` dans `~/.claude/settings.json`.
- [ ] Revue en session normale, commit, `git push`, CI `battery` verte sur la PR #3.

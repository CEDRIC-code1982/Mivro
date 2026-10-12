# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Chantier du harness, lot 1 — le mode chantier (J-055)

**Demande d'origine** : « Je veux que le chantier de harness soit en modification automatique le
temps de le finir », puis « Go chantier », avec « commit et push en autonomie ».

**Branche** : `harness/chantier`, issue de `b605577` (§6 et §7, absents de `develop` depuis le
merge prématuré de la PR #3).

**Hors périmètre explicite** :

- Push : impossible depuis l'agent (le sandbox lui interdit `~/.ssh` et GitHub, et doit continuer à
  le faire). Commits locaux seulement, le push revient à Cédric en fin de chantier.
- Relock : à Cédric, une fois, en fin de chantier (`--update` refuse de tourner dans Claude Code).
- Lots suivants : contrôle positif de la sonde réseau (EN-ATTENTE §1), règle `docrefs` (a) à (e).

---

## Conditions de fin

| #   | Condition                                                                                  | Comment on le vérifie                                              |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | `lock` s'abstient (exit 3) en session Claude Code déverrouillée, et seulement là           | clone jetable : 6 cas (verrouillé, chantier, hors Claude Code, CI) |
| 2   | Hors de cette session, la dérive reste rouge : session verrouillée, terminal, pre-push, CI | idem ; `MIVRO_NO_ABSTAIN=1 check.sh --only lock` → 1               |
| 3   | Le self-test juge le verrou comme en session verrouillée, et nomme le saut en chantier     | self-test 425/0 en chantier ; section 7 complète dans le clone     |
| 4   | `.claude/settings.json` identique à l'état approuvé (`deniedDomains` GitHub restauré)      | `git diff b605577 -- .claude/settings.json` vide                   |
| 5   | J-055 au journal ; RUNBOOK (mode chantier) et en-tête d'EN-ATTENTE à jour                  | relecture                                                          |

---

## Socle systématique

- [x] `npm run check` vert, sauf `lock` qui s'abstient (mode chantier, par construction).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — sans objet (harness seul).
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `JOURNAL-ECHECS.md`, `EN-ATTENTE.md`, `RUNBOOK.md`.
- [x] ADR : le mode chantier prolonge ADR-016 sans le changer (la CI reste stricte).
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric (fin de chantier)

- [ ] `npm run harness:relock`, push de `harness/chantier`, PR vers `develop`, merge.
- [ ] Relancer une session normale (sans `MIVRO_HARNESS_UNLOCK`).

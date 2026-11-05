# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : le harness refusé en écriture par le sandbox (`sandbox.filesystem.denyWrite`)

**Demande d'origine** : « fais le nécessaire pour le harness en béton », puis validation par Cédric
de la liste S1 à S9 (« Je valide tes recommandations GO »).

**Branche** : `harness/finition-lots-a-e`, après `2c7f86a`, avant le relock et le push.

**Hors périmètre explicite** :

- `.git/`, `package.json`, `package-lock.json` restent écrivables (S2) ; `.claude/` est déjà protégé
  par Claude Code (S3).
- EN-ATTENTE §5 (masquage d'une commande destructive) et §7 (détection textuelle de
  `check-scripts`) : non couverts par le sandbox, laissés en limites (S8).
- Le relock, le push, la PR : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                         | Comment on le vérifie                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `.claude/settings.json` refuse en écriture, au sandbox, les chemins S1 (liste protégée sans `.git/` ni `.claude/`)                                                                | relecture ; sonde `touch` sur chaque famille de chemins                    |
| 2   | Une écriture Bash dans le harness échoue au noyau (« Operation not permitted »), quelle que soit la syntaxe : `touch`, Perl `'> chemin'`, Ruby `'w:UTF-8'`, `openSync`            | sonde manuelle dans la session, ou dans la suivante si pas de rechargement |
| 3   | Sous le sandbox, les cas du self-test qui plantent un fichier dans le harness vérifient que l'écriture est refusée ; hors sandbox (CI, terminal), ils gardent leur forme actuelle | self-test vert sous le sandbox ; code des cas relu                         |
| 4   | Un cas du self-test prouve que, sous le sandbox de Claude Code, `scripts/` est refusé en écriture                                                                                 | self-test                                                                  |
| 5   | `EN-ATTENTE.md` §6 marque les limites d'écriture « couvertes par le sandbox pour Bash » ; journal (nouvelle entrée), `INVENTAIRE.md` et `TODO.md` à jour                          | relecture, `docrefs`, `docfacts`                                           |

---

## Socle systématique

- [ ] `npm run check` vert (`lock` s'abstient en session déverrouillée, relock à Cédric).
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché : aucun écran.
- [x] Toute donnée externe validée par un schéma Zod : sans objet.
- [x] Toute string affichée passe par `useTranslation()` : aucune string.
- [ ] Docs de contexte mises à jour : `EN-ATTENTE.md`, `JOURNAL-ECHECS.md`, `INVENTAIRE.md`, `TODO.md`.
- [x] ADR si décision d'architecture : ADR-016 couvre la protection du harness.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] `npm run harness:relock` hors Claude Code, push, PR, fusion.
- [ ] Si le sandbox ne se recharge pas en cours de session : la sonde de la condition 2 dans une
      session neuve.

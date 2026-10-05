# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Appliquer EN-ATTENTE §2 et §4 en session déverrouillée (J-051)

**Demande d'origine, en une phrase** : « applique EN-ATTENTE §2 et §4 ».

**Branche** : `harness/en-attente-5-8` (pas encore mergée dans `develop`), à la suite de `653ea5d`.

**Hors périmètre explicite** :

- §1 (J-040 lot 1, `npm update`) : réservé à Cédric, hors Claude Code.
- §3 (sandbox pour la lecture des secrets) : décision de Cédric, non demandée ici.
- `npm run harness:relock` : Cédric le lance hors Claude Code.
- Commit, push et PR : sur demande explicite de Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                    | Comment on le vérifie                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | §2 : un appel mort du self-test est compté par un trap `ERR` sans condition de version, `set -E` posé                        | copies du self-test sous Bash 3.2 : niveau supérieur et fonction → 1 failed |
| 2   | §2 : la CI prouve le comptage sous Bash 5 (pas `self-test counts a dead call (J-051)` au job `battery`)                      | relecture de `check.yml` ; le pas lui-même rejoué en local                  |
| 3   | §4 : le juge `audit` sur `[]` rend exit 1 avec un message, sans trace Python                                                 | deux nouveaux cas du self-test (exit, stderr vide)                          |
| 4   | §2 et §4 retirés d'`EN-ATTENTE.md` ; J-048 et J-051 mis à jour au journal (Bash 5 non vérifié tant que la CI n'a pas tourné) | relecture                                                                   |
| 5   | Aucune régression ; comptes d'assertions à jour (INVENTAIRE, PROGRESS, TODO)                                                 | `npm run check:harness` : 395 passed, 0 failed (393 avant)                  |

---

## Socle systématique

- [x] `npm run check` vert, `lock` compris (relock de Cédric après §5 à §8).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — le rapport `npm audit` est validé (version 2, objet
      `vulnerabilities`, chaîne `via` traçable), TS-004.
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `EN-ATTENTE.md`, `JOURNAL-ECHECS.md` (J-048 à J-050),
      `INVENTAIRE.md`, `PROGRESS.md`, `TODO.md`.
- [x] ADR : aucune nouvelle décision d'architecture (correctifs du harness dans le cadre d'ADR-016).
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [x] `npm run harness:relock` hors Claude Code.
- [ ] §1 d'`EN-ATTENTE.md` (J-040 lot 1).
- [ ] Push de `harness/en-attente-5-8` et PR, sur sa demande.

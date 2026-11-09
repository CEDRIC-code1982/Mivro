# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : J-055 et J-056 passent RÉSOLU après le relock final de la finition

**Demande d'origine** : « Pousser la branche harness/finition-lots-a-e. Ouvrir la PR vers develop
avec le label harness-change […]. Fusionner si la CI est verte, puis passer J-055/J-056 à
RÉSOLU. »

**Branche** : `harness/finition-lots-a-e`, après `3a1682e` et le relock de Cédric.

**Hors périmètre explicite** :

- Le commit de `scripts/harness.lock` (relock) : Cédric, dans son terminal.
- Le push, la PR, la fusion : GitHub est refusé au sandbox (J-057), donc Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                       | Comment on le vérifie                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | J-055 et J-056 sont RÉSOLU dans l'index et dans leur ligne de statut, avec la preuve : relock fait, session normale, lock vert  | relecture ; `bash scripts/check.sh --only lock` |
| 2   | `INVENTAIRE.md` ne les liste plus en « Reste ouvert » ; la case TODO du relock reflète ce qui est fait et ce qui reste à Cédric | relecture ; `docfacts`                          |
| 3   | Aucun fichier du harness ne change dans ce diff (hors `scripts/harness.lock`, commité à part par Cédric)                        | `git diff --stat`                               |

---

## Socle systématique

- [ ] `npm run check` vert.
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché : aucun écran.
- [x] Toute donnée externe validée par un schéma Zod : sans objet.
- [x] Toute string affichée passe par `useTranslation()` : aucune string.
- [ ] Docs de contexte mises à jour : `JOURNAL-ECHECS.md`, `INVENTAIRE.md`, `TODO.md`.
- [x] ADR si décision d'architecture : aucune.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Commiter `scripts/harness.lock`, puis pousser, ouvrir la PR (label `harness-change`) et fusionner si la CI est verte.

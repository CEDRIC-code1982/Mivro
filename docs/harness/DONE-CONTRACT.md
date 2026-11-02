# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : J-040 lot 5 — deux nouveaux avis npm audit « high » levés, avis périmé `vfj7` retiré

**Demande d'origine** : le pre-push de `harness/j-022-capteurs-docs` est rouge sur `audit`
(GHSA-4528-x5fx-h6hg `joi`, GHSA-qr28-fpjm-wq7f `decode-uri-component`). Cédric a validé : `joi`
mis à jour, `decode-uri-component` traité, `GHSA-vfj7-8cjw-p6xm` retiré de `audit-accepted.json`.

**Branche** : `harness/j-022-capteurs-docs`, à la suite de `fcf4ede` (un seul push pour les deux
lots).

**Hors périmètre explicite** :

- Le test sur device du deep linking `mivro://session/<id>` après la mise à jour de React
  Navigation : c'est Cédric qui le fait (RUNBOOK).
- Le push, la PR et le merge : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                             | Comment on le vérifie                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | `joi` 17.13.9 est installé, et `decode-uri-component` n'est plus dans l'arbre runtime : `@react-navigation/core` 7.24.0 n'utilise plus `query-string` | `npm ls joi decode-uri-component --omit=dev`         |
| 2   | Seul `package-lock.json` change côté dépendances : aucune plage de `package.json` ne bouge                                                            | `git diff --stat`                                    |
| 3   | `GHSA-vfj7-8cjw-p6xm` est retiré de `audit-accepted.json`, et le capteur `audit` est vert sans avertissement `stale`                                  | `bash scripts/check.sh --stage push -- --only audit` |
| 4   | Aucune régression : navigation et deep linking (`src/navigations/linking.ts`) restent couverts et verts, et la batterie du stage push est verte       | `bash scripts/check.sh --stage push`                 |
| 5   | Le verrou couvre le nouveau lockfile et le nouveau `audit-accepted.json` (relock de Cédric), et le TODO décrit le lot 5                               | capteur `lock`, relecture du TODO                    |

---

## Socle systématique

- [x] `npm run check` vert (stage push, 14 capteurs).
- [x] Les trois états rendus pour chaque écran touché : aucun écran modifié.
- [x] Toute donnée externe validée : sans objet, aucun schéma modifié.
- [x] Toute string affichée passe par `useTranslation()` : aucune string ajoutée.
- [x] Docs de contexte mises à jour : `TODO.md` (J-040 lot 5, retrait de `vfj7`).
- [x] ADR : aucune, la procédure J-040 s'applique.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [ ] Tester sur device un lien `mivro://session/<id>` après la mise à jour de React Navigation.
- [ ] Push de `harness/j-022-capteurs-docs`, PR vers `develop` avec le label `harness-change`, merge
      si la CI est verte.

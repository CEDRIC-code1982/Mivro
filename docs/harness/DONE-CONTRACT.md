# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Quatre avis npm audit « high » corrigés dans les plages déclarées (suite de J-040)

**Demande d'origine** : le pre-push de `harness/chantier` est rouge sur `audit`. Cédric a validé la
reco : `npm update` des quatre paquets, en commit séparé sur `harness/chantier`.

**Branche** : `harness/chantier`, à la suite de `c002ca3`.

**Hors périmètre explicite** :

- Retirer l'avis périmé `GHSA-vfj7-8cjw-p6xm` de `scripts/audit-accepted.json`. C'est un fichier du
  harness, et il ne produit qu'un avertissement : il ira en TODO, pour la prochaine session
  déverrouillée.
- Le push, la PR et le merge : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                          | Comment on le vérifie                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 1   | `zod` 4.6.7, `body-parser` 1.20.9, `launch-editor` 2.14.2 et `undici` 6.29.1 sont installés, et seul `package-lock.json` a changé (aucune plage de `package.json`) | `git diff --stat`, versions lues dans `node_modules` |
| 2   | Le capteur `audit` ne signale plus aucun avis non accepté                                                                                                          | `bash scripts/check.sh --stage push -- --only audit` |
| 3   | Aucune régression : les schémas Zod et toute la batterie restent verts                                                                                             | `npm run check` (`tests` compris)                    |

---

## Socle systématique

- [x] `npm run check` vert (stage push, 13 capteurs).
- [x] Les trois états rendus pour chaque écran touché : aucun écran modifié.
- [x] Toute donnée externe validée : sans objet, aucun schéma modifié.
- [x] Toute string affichée passe par `useTranslation()` : aucune string ajoutée.
- [x] Docs de contexte mises à jour : `TODO.md` (avis périmé à retirer).
- [x] ADR : aucune nouvelle décision, la procédure J-040 s'applique.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [ ] Push de `harness/chantier`, PR vers `develop` avec le label `harness-change`, merge si la CI est verte.

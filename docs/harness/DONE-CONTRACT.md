# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Écrire les trois capteurs mécanisables de J-022 proposés par les revues de J-057

**Demande d'origine** : « fais les points 1 à 3 » — les trois volets consignés sous J-022 le
2026-10-28 : index du journal, script remplacé encore prescrit, case ouverte sur une branche mergée.

**Branche** : `harness/j-022-capteurs-docs`, issue de `develop` (`f7f7997`), en session déverrouillée
(mode chantier, J-055).

**Hors périmètre explicite** :

- Le quatrième volet (contrat périmé, `reset-review.sh`) et les deux volets d'origine de J-022
  (absences démenties, métriques de `PROGRESS.md`) : J-022 reste OUVERT pour eux.
- Le relock, le commit, le push, la PR et le merge : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                        | Comment on le vérifie                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 1   | `docrefs` est rouge quand un titre `## J-NNN` n'a pas sa ligne `\| J-NNN \|` dans l'index, et inversement                                                                                        | self-test, cas positif et négatif                    |
| 2   | Un nouveau capteur est rouge quand une étape non barrée du RUNBOOK cite un script déclaré remplacé (« au lieu de `scripts/X` ») dans un document, et vert sur la phrase de déclaration elle-même | self-test, dont l'étape 5 réelle d'avant J-057       |
| 3   | Le même capteur est rouge quand une case `- [ ]` du TODO ou une étape non barrée du RUNBOOK cite une branche `harness/*` déjà mergée dans l'historique de HEAD                                   | self-test, dont le cas réel `harness/en-attente-5-8` |
| 4   | Les trois règles sont vertes sur l'arbre actuel, sans faux positif, et rapides (stage `fast`)                                                                                                    | `npm run check`, temps du capteur                    |
| 5   | Le capteur est dans la table `scripts/sensors.sh`, et le self-test vérifie sa présence                                                                                                           | `npm run check:harness`                              |
| 6   | J-022, `INVENTAIRE.md`, `TODO.md` et `PROGRESS.md` décrivent ce qui est livré et ce qui reste ouvert, avec les limites des règles                                                                | relecture                                            |

---

## Socle systématique

- [x] `npm run check` vert (`lock` s'abstient en session déverrouillée) ; `check:harness` 592/0.
- [x] Les trois états rendus pour chaque écran touché : aucun écran modifié.
- [x] Toute donnée externe validée : sans objet, aucun schéma modifié.
- [x] Toute string affichée passe par `useTranslation()` : aucune string ajoutée.
- [x] Docs de contexte mises à jour : J-022, `INVENTAIRE.md`, `TODO.md`, `PROGRESS.md`.
- [x] ADR : aucune, le capteur suit ADR-016.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [ ] `npm run harness:relock` (taper `RELOCK`), commit, push, PR vers `develop` avec le label
      `harness-change`, merge.

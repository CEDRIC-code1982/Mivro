# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Appliquer EN-ATTENTE §2 à §4 en session déverrouillée

**Demande d'origine, en une phrase** : « applique EN-ATTENTE §2 à §4 ».

**Hors périmètre explicite** :

- §1 (J-040 lot 1, `npm update`) : réservé à Cédric, hors Claude Code.
- `npm run harness:relock` : Cédric le lance hors Claude Code.
- Commit, push, PR : sur demande explicite de Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                  | Comment on le vérifie                                        |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | §2 : `prettier --config <fichier> --write <cible>` n'est plus refusé, un fichier du harness en cible l'est | 3 cas `guard` ajoutés au self-test                           |
| 2   | §3 : la casse de la racine du dépôt et de `$HOME` ne contourne plus les gardes (J-047)                     | 8 cas `edit_guard` / `guard` ajoutés au self-test            |
| 3   | §3 : docstring `Checked` de `check-native.py` complète                                                     | relecture                                                    |
| 4   | §4 : le capteur `audit` accepte nommément les 4 GHSA, rouge pour tout le reste, abstention hors ligne      | 4 cas hors ligne dans le self-test ; `check -- --only audit` |
| 5   | §4 : CI `security` et libellé `sensors.sh` alignés sur le capteur                                          | relecture de `check.yml` et `sensors.sh`                     |
| 6   | Entrées §2 à §4 retirées de `EN-ATTENTE.md`                                                                | relecture                                                    |
| 7   | Aucune régression                                                                                          | `npm run check:harness` tout vert (358 avant)                |

---

## Socle systématique

- [x] `npm run check` vert, `lock` compris (relock de Cédric, 2026-10-05).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée — le rapport `npm audit` est lu défensivement (JSON illisible → rouge).
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [ ] Docs de contexte mises à jour : `EN-ATTENTE.md`, `JOURNAL-ECHECS.md` (J-040, J-047), `INVENTAIRE.md`.
- [x] ADR : aucune nouvelle décision d'architecture (application de décisions déjà prises).
- [ ] Verdict `APPROVED` du subagent `reviewer` (session normale, après relock).

---

## Ce qui reste à Cédric

- [x] `npm run harness:relock` hors Claude Code (2026-10-05).
- [ ] Revue et commit depuis une session normale.

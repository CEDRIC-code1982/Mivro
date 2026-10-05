# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Harness « en béton » — fermer les contournements trouvés par l'audit red-team

**Demande d'origine, en une phrase** : « Go pour les modifs, je veux à la fin un harness en béton ! »
après l'audit comparatif Mivro / SmartBLE (lots 0 à 4).

**Hors périmètre explicite** :

- Activer la protection de branche GitHub et pousser : actions externes, faites **sur demande
  explicite** de Cédric une fois la CI verte (script prêt, pas lancé).
- Tests des règles RTDB sur l'émulateur Firebase : c'est un test produit, pas un capteur du harness.
  Tracé dans `TODO.md`.
- `~/.claude/settings.json` (fichier de permissions personnel de Cédric) : je ne le modifie pas. Les
  règles vont dans le `.claude/settings.json` du projet, où `deny` l'emporte sur son `allow`.

---

## Conditions de fin

| #   | Condition                                                                                                                                                   | Comment on le vérifie                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Chaque contournement **critique** ou **élevé** de l'audit est bloqué                                                                                        | un cas par contournement dans `check:harness`, qui rejoue l'attaque et exige BLOCK |
| 2   | Un fichier non suivi est inspecté par `check-diff` même quand aucun fichier suivi n'a bougé (H1)                                                            | cas dédié dans `check:harness`                                                     |
| 3   | Le hook d'édition vérifie le fichier réellement édité, y compris depuis un worktree (G1)                                                                    | cas dédié : `CLAUDE_PROJECT_DIR` pointé ailleurs, violation quand même détectée    |
| 4   | Toute modification d'un fichier du harness est visible : refusée à l'édition, et rouge dans `check` et en CI tant que le verrou n'est pas refait par Cédric | `check:harness-lock` + cas dédié ; job CI `harness-guard`                          |
| 5   | L'agent ne peut pas finir son tour avec un arbre rouge                                                                                                      | hook `Stop` testé par violation volontaire                                         |
| 6   | Un commit fait depuis Claude Code exige un verdict `APPROVED` du reviewer portant sur exactement l'arbre commité                                            | `pre-commit` testé : sans verdict → refus ; verdict d'un autre arbre → refus       |
| 7   | L'identité native (team Apple `W7N4H92U5V`, bundle/applicationId `com.cedricpineau.mivro`) ne peut plus dériver en silence (J-023)                          | capteur `check:native` + cas dédié                                                 |
| 8   | Une seule table de capteurs, lue par `npm run check`, le pre-push et la CI ; une abstention est nommée et jamais comptée verte                              | `scripts/sensors.sh` ; `npm run check -- --list`                                   |
| 9   | La CI rejoue la batterie complète côté serveur, plus secrets et `npm audit`                                                                                 | `.github/workflows/check.yml` ; verte sur la PR (après push autorisé)              |
| 10  | J-022 à J-025 fermés ou requalifiés ; chaque trou de l'audit a son entrée de journal                                                                        | `check:doc-refs` vert ; relecture du journal                                       |
| 11  | Aucune régression, budgets tenus                                                                                                                            | `npm run check` exit 0 ; `check:harness` tout vert ; PostToolUse ≈ 3 s mesuré      |

---

## Socle systématique

- [ ] `npm run check` vert (typecheck + lint + format + `check:arch` + `check:diff` + tests).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée par Zod — renforcé : `JSON.parse` renvoie désormais `unknown`.
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [ ] Docs de contexte mises à jour : `INVENTAIRE.md`, `JOURNAL-ECHECS.md`, `CLAUDE.md`, `RUNBOOK.md`,
      `TODO.md`, `PROGRESS.md`.
- [ ] ADR : ADR-016 — le harness est une frontière de confiance (verrou, CI, protection de branche).
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Autoriser le commit, le push de `harness/beton` et l'ouverture de la PR.
- [ ] Une fois la CI verte : lancer `scripts/setup-branch-protection.sh`, ou me demander de le faire.
- [ ] Relancer Claude Code pour que les nouveaux hooks et permissions du projet soient chargés.

---

## Hypothèses prises

- Solo : la protection de branche exige des **checks verts** et une PR, pas une approbation (on ne
  peut pas approuver sa propre PR). Le verrou humain, c'est le merge et le relock du harness.
- Le reviewer est identifié par le hook `SubagentStop` et son `matcher`, pas par un champ de
  l'entrée du hook : l'identité de l'agent dans l'entrée n'est pas documentée.

---

## Clôture du contrat précédent (étape 1 Firebase)

Conditions 1 à 8 satisfaites et commitées (`c15b8e1`, `b346a53`). Les règles RTDB ont été déployées
et vérifiées structurellement par Cédric le 2026-08-24. Restent à Cédric, hors contrat : le rebuild
natif et les vérifications sur appareil F4/F5.

---

## État au 2026-10-05

Six revues successives (J-036 à J-046) ont rouvert le contrat ; les capteurs de toutes sont
appliqués. Le self-test compte 358 assertions, toutes vertes, verrou compris. La septième revue rouvre la
condition 4 (J-047).

| #   | Résultat                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | ✅ Audit et revues J-026 à J-046 rejoués au self-test                                                                                                  |
| 2   | ✅ cas au self-test                                                                                                                                    |
| 3   | ✅ cas au self-test                                                                                                                                    |
| 4   | ⚠️ verrou généré et vert, `harness-guard` en place ; le refus à l'édition tombe sur une variante de casse du chemin absolu (J-047, `EN-ATTENTE.md` §3) |
| 5   | ✅ hook Stop actif, testé par violation                                                                                                                |
| 6   | ✅ sceau lié à l'`agent_id`, arbre comparé au début et à la fin de la revue, ABA détecté par ctime                                                     |
| 7   | ✅ `check:native` vert                                                                                                                                 |
| 8   | ✅ table unique, ESLint et Prettier lancés avec la seule config racine                                                                                 |
| 9   | ⚠️ workflows écrits, jamais exécutés ; `npm audit` rouge (J-040, branche dédiée)                                                                       |
| 10  | ✅ J-022 requalifié, J-023 à J-046 à jour, `docrefs` vert                                                                                              |
| 11  | ✅ stage `check` vert ; 1257 tests                                                                                                                     |

Reste à Cédric : relock, `npm audit fix`, commit, push, PR, merges, protection (RUNBOOK >
« Harness »).

# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Paires de contraste des marqueurs live dans le test du harness (EN-ATTENTE §8, J-067)

**Demande d'origine** : « applique EN-ATTENTE §8 »

**Branche** : `fix/marqueurs-live-contraste`, à la suite de `12fc658` (même branche que le correctif des marqueurs, empilée sur `test/suivi-temps-reel-assertions`).

**Hors périmètre explicite** :

- `npm run harness:relock` : Cédric, après la revue.
- La vérification sur appareil en mode sombre (TODO) : Cédric.
- Un capteur qui relierait un style de `MapView` à un token `map.*` : non outillable, au reviewer (J-067).

---

## Conditions de fin

| #   | Condition                                                                                         | Comment on le vérifie                    |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | Les deux blocs du §8 sont collés dans `src/theme/contrast.test.ts`, formatés par `npm run format` | `git diff src/theme/contrast.test.ts`    |
| 2   | 103 tests de contraste verts (90 + 12 paires + le test de complétude)                             | `npx jest src/theme/contrast.test.ts`    |
| 3   | Le test de complétude rougit si l'on retire une des cinq lignes `push` de la section 5            | retrait un à un sur une copie temporaire |
| 4   | L'entrée §8 est retirée d'EN-ATTENTE, J-067 passe RÉSOLU, TODO et PROGRESS à jour                 | `git diff docs/`                         |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché.
- [ ] Toute donnée externe validée par un schéma Zod.
- [ ] Toute string affichée passe par `useTranslation()`.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`.
- [ ] ADR si décision d'architecture.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [x] `npm run harness:relock` (fait par Cédric le 2026-11-19) ; commit sur sa demande.
- [ ] Vérification sur appareil des marqueurs live en mode sombre.

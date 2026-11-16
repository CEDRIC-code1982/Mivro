# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : A11Y-003 — les 46 `accessibilityHint` manquants (J-013)

**Demande d'origine** : « go A11Y-003 » (Cédric, 2026-11-12), plus « Il faut ajouter dans la liste
des choses à faire » les deux tickets Play 2027 (R8 / DEX, Zero-Tap Sign-In Restoration), « à voir
selon ton analyse ».

**Branche** : `fix/a11y-003-hints`, issue de `develop` (`ad43859`).

**Hors périmètre explicite** :

- Passer la règle `react-native-a11y/has-accessibility-hint` en `error` : c'est la config de lint,
  donc le harness. Changement proposé à Cédric, en session déverrouillée.
- Mettre en œuvre les deux exigences Play 2027 : elles sont seulement ajoutées au TODO.
- Les sites signalés dans les fichiers de test : ce sont des fixtures, on n'y touche que si le
  composant testé change d'API.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                                                                                                                                  | Comment on le vérifie                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Chacun des 38 sites produit est résolu selon la liste validée par Cédric le 2026-11-16 : hint traduit posé par `t()` ou par une prop alimentée par `t()` ; icône d'onglet rendue décorative (D1) ; libellé redondant du thème retiré (D3) ; prop optionnelle d'EmptyState (D4) ; bouton × de ParticipantCard libellé et hint corrigés (D5) | `npx eslint src --rule '{"react-native-a11y/has-accessibility-hint":"error"}'` : 0 signalement, tests compris ; relecture du diff contre la liste |
| 2   | Chaque clé de hint existe en FR et en EN, au style maison (tutoiement, verbe à la 3ᵉ personne, sans point final, sans répéter le libellé)                                                                                                                                                                                                  | `locales.parity.test.ts` et `locales.keys.test.ts` verts ; lecture                                                                                |
| 3   | Aucun import `components/**` → `features/**` ajouté : un atom ou une molecule reçoit son hint par prop quand son libellé vient d'une prop                                                                                                                                                                                                  | Capteur des couches vert                                                                                                                          |
| 4   | Un test vérifie le hint de chaque atom ou molecule dont l'API change (nouvelle prop)                                                                                                                                                                                                                                                       | Tests des composants touchés                                                                                                                      |
| 5   | Docs : J-013 et l'item A11Y-003 du TODO à jour ; les deux exigences Play 2027 ajoutées au TODO, adaptées à Mivro                                                                                                                                                                                                                           | Lecture de `JOURNAL-ECHECS.md` et de `TODO.md`                                                                                                    |

---

## Socle systématique

- [x] `npm run check` vert (15/15, 1281 tests, 2026-11-16).
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché — sans objet : seuls
      des props d'accessibilité changent, pas les états.
- [x] Toute donnée externe validée par un schéma Zod — sans objet.
- [x] Toute string affichée passe par `useTranslation()` (hints compris, y compris en prop).
- [x] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`, et J-013.
- [x] ADR si décision d'architecture — sans objet.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [x] Valider la liste des hints proposés (un par élément) avant l'implémentation (« Ok, on suit
      tes reco », 2026-11-16, D1 à D5 compris).
- [x] Nettoyer l'arbre de `fix/a11y-003-hints` : trois fichiers de `scripts/` y sont restés dans
      leur version `harness/ci-local`, parce que le sandbox a refusé de les remplacer au
      changement de branche (fait par Cédric le 2026-11-12, capteur `lock` vert).
- [ ] Plus tard, en session déverrouillée : passer `has-accessibility-hint` en `error`.

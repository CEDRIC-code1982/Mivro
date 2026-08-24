# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Arbitrages Cédric du 2026-08-24 — palette accessible, outillage de doc, couplage archi

**Demande d'origine, en une phrase** : « On suit ton plan pour les 13 règles. 1. Je veux que les
couleurs soient accessibles aux mal-voyants et j'avais choisi de l'indigo, fais le nécessaire. 2. Installe ce qu'il faut. 3. Oui c'est un choix d'archi, que me proposes-tu ? » + « bascule les
modifs sur develop, et garde cette règle en mémoire ».

**Hors périmètre explicite** : les 46 `accessibilityHint` manquants (copie utilisateur à écrire) ;
les scénarios E2E Maestro ; le déplacement des molecules mono-feature restantes.

---

## Conditions de fin

| #   | Condition                                                    | Comment on le vérifie                                                                        |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | Le travail est sur `develop`, pas sur `main`                 | `git branch --show-current` = `develop` ; `main` inchangée ; règle en mémoire persistante    |
| 2   | Aucune paire de couleurs du thème n'échoue WCAG AA           | `npx jest src/theme/contrast.test.ts` vert et `PENDING_DESIGN_DECISION` vide                 |
| 3   | La marque reste l'indigo voulu par Cédric                    | `palette.brand` = échelle indigo `#4F46E5` / `#6366F1` / `#A5B4FC` inchangée                 |
| 4   | `npm run docs` passe sans erreur (DOC-004)                   | `npm run docs` exit 0, et un lien mort le fait échouer (sonde du self-test)                  |
| 5   | DOC-004 est un capteur, plus une règle de jugement           | 4ᵉ garde de `.husky/pre-push` ; sortie de la liste « jugement » de `CLAUDE.md`               |
| 6   | Le couplage `components/` → `features/` n'a plus d'exemption | `npm run check:arch` vert **sans** `pathNot` de grandfathering dans `.dependency-cruiser.js` |
| 7   | Aucune régression                                            | `npm run check` exit 0 (1226 tests) et `npm run check:harness` 64/64                         |

---

## Socle systématique

- [x] `npm run check` vert (typecheck + lint + format + `check:arch` + `check:diff` + tests).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié dans sa logique.
- [x] Toute donnée externe validée par Zod — pas de nouvelle source de données.
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `ARCHITECTURE.md`, `TODO.md`, `INVENTAIRE.md`, `JOURNAL-ECHECS.md`.
- [x] ADR écrit : **ADR-015** (composants locaux à une feature) — le reviewer a établi que
      ADR-014 avait explicitement tranché l'inverse, donc c'est un renversement, pas une
      application. Note de renversement ajoutée dans ADR-014.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Vérifier le rendu à l'œil, **mode sombre surtout** : un remplissage y est désormais
      **clair et porte de l'encre** au lieu d'être foncé et de porter du blanc — bouton primaire
      (`brand[400]`), bouton destructif (`error[400]`), marqueurs de participants et badge
      « invité » sur teal. Les états pressés s'éclaircissent au lieu de s'assombrir.
- [ ] Vérifier le cercle de rayon sur la carte dans les deux modes : il utilise maintenant
      `theme.color.map.stroke`, identique en clair et en sombre, parce que les tuiles ne suivent
      pas le thème.
- [ ] `npm --prefix docs-site install` sur ses autres machines : le pre-push en a besoin.

---

## Hypothèses prises

- L'indigo de `origin/develop` (`617d64b`) **est** l'indigo voulu : je l'ai conservé tel quel et
  n'ai touché qu'aux couleurs qui échouaient AA.
- Un remplissage teal porte de l'encre plutôt que du blanc — c'était le seul moyen de garder le
  teal vif tout en atteignant AA (assombrir jusqu'à `accent[700]` l'aurait dénaturé).
- Option 3 retenue pour le couplage (déplacer les 6 composants qui créent la violation), et non
  l'option 2 (déplacer toutes les molecules mono-feature), qui mérite sa propre tâche.

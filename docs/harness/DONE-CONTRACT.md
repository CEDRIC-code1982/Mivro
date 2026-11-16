# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Vue carte POI — états loading, error et empty

**Demande d'origine** : « Ok, on suit tes reco, go pour le n°1 » (n°1 = item TODO P2 « Vue carte POI
sans état loading ni error » ; reco : bandeau sur la carte + indicateur de chargement).

**Branche** : `fix/poi-carte-etats`, issue de `fix/rayon-zone-nul` (`145c18b`, empilée : `PROGRESS.md`
et `TODO.md` bougent encore sur la pile POI ; écart à « issue de `develop` » accepté par Cédric).

**Hors périmètre explicite** :

- Bouton « Réessayer » (item TODO P3, après la fusion de `fix/a11y-003-hints`, qui touche `EmptyState`).
- Nouvelles clés i18n : les textes de la liste sont réutilisés (`list.loading`, `errors.*`,
  `list.empty.*`), ce qui évite un conflit dans `poi.json` avec `fix/a11y-003-hints`.
- Vérification visuelle sur device (clair/sombre, Dynamic Type 200 %) : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                      | Comment on le vérifie                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Pendant le chargement, la carte affiche un bandeau « Recherche des lieux... » avec indicateur, sans bloquer la carte                                           | test `POIMapView` (loading)                       |
| 2   | En erreur, bandeau avec le titre `errors.title` et le message traduit du code (même table que la liste) ; participants, midpoint et cercle restent affichés    | tests `POIMapView` (error typée, erreur inconnue) |
| 3   | Recherche réussie sans résultat → bandeau `list.empty.*`                                                                                                       | test `POIMapView` (empty)                         |
| 4   | Avec des POI, pas de bandeau ; priorité loading > error > empty comme la liste                                                                                 | tests `POIMapView`                                |
| 5   | `POIScreen` passe `isLoading` et `error` à la vue carte                                                                                                        | test d'intégration `POIScreen` (carte en erreur)  |
| 6   | La table code → clé i18n est partagée liste/carte (`features/POI/utils/poiErrorKey.ts`), testée seule                                                          | test `poiErrorKey`                                |
| 7   | Bandeau annoncé (`accessibilityRole="alert"` pour l'erreur, région live pour chargement/vide), sans couleur en dur, contraste AA (texte sur `surface.primary`) | relecture + capteurs a11y/couleurs                |
| 8   | Commentaires de `POIMapView.tsx` en anglais (règle du fichier entier)                                                                                          | relecture du diff                                 |
| 9   | Pas de nouveau conflit avec `fix/a11y-003-hints` hors `PROGRESS.md` (déjà connu)                                                                               | `git merge-tree`                                  |
| 10  | Docs : item TODO fermé, section PROGRESS + métriques, ARCHITECTURE si pertinent                                                                                | `npm run check` (docmetrics) + relecture          |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché.
- [ ] Toute donnée externe validée par un schéma Zod. (aucune nouvelle donnée externe)
- [ ] Toute string affichée passe par `useTranslation()`.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`.
- [ ] ADR si décision d'architecture. (aucune)
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Vérifier sur device, en clair et en sombre et en Dynamic Type 200 %, le bandeau de la vue carte (mode avion pour l'erreur, catégorie sans résultat pour le vide).
- [ ] Push de `fix/poi-carte-etats`.

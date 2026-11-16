# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Rayon de zone nul — rayon de zone plancher à 500 m

**Demande d'origine** : « Ok, on suit tes reco, go pour le n°1 à 500 m verif que le repo est clean et qu'il n'y a pas de rebse ou conflit avec les branches sur develop »
(reco validée : rayon de zone minimal de 500 m dans `CalculateMidpointUseCase`, schémas Zod et
gardes d'écran inchangés).

**Branche** : `fix/rayon-zone-nul`, issue de `fix/poi-rayon-minuscule` (`ea0199f`, empilée pour
éviter un conflit de doc sur `TODO.md` ; écart à « issue de `develop` » accepté par Cédric).

**Hors périmètre explicite** :

- Les gardes `!midpointRadius` de `MapScreen` / `POIScreen` et le `positive()` des schémas Zod ne
  changent pas : un rayon 0 n'est plus produit. Les sessions déjà stockées avec un rayon 0 ne sont
  pas migrées (rien en prod).
- Le plancher de recherche POI (`MIN_POI_SEARCH_RADIUS_M`) reste en place comme défense.
- Vérification visuelle du cercle sur device : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                         | Comment on le vérifie                                       |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Deux participants à la même adresse → rayon de zone = 500 m (plus jamais 0)                                       | test `CalculateMidpointUseCase.test.ts` (points identiques) |
| 2   | Participants très proches (rayon calculé < 500 m) → 500 m                                                         | test dédié (deux points à ~100 m)                           |
| 3   | Rayon calculé ≥ 500 m inchangé (Paris + Lyon ≈ 196 km)                                                            | tests existants + test à la frontière                       |
| 4   | Le log INFO donne le rayon plancher                                                                               | test `logging` existant (`radius:`)                         |
| 5   | Un rayon produit par le use case passe `MidpointSessionSchema` / `SharedSessionSchema` (`positive()`)             | test : `safeParse` du rayon de points identiques            |
| 6   | Commentaires de `CalculateMidpointUseCase.ts` et de son test en anglais (règle du fichier entier)                 | relecture du diff                                           |
| 7   | Docs : item TODO « Rayon de zone nul » fermé, section PROGRESS + métriques, ARCHITECTURE si le rayon y est décrit | `npm run check` (docmetrics) + relecture                    |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché. (aucun écran touché)
- [ ] Toute donnée externe validée par un schéma Zod. (aucune nouvelle donnée externe)
- [ ] Toute string affichée passe par `useTranslation()`. (aucune string affichée ajoutée)
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`.
- [ ] ADR si décision d'architecture. (aucune : règle métier locale au use case)
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Vérifier sur device qu'une session à la même adresse affiche un cercle de 500 m et la liste POI.
- [ ] Push de `fix/rayon-zone-nul` et PR (après celles de `fix/poi-rayon-geant` et `fix/poi-rayon-minuscule`).

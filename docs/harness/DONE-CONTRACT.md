# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : POI « rayon minuscule » — rayon de recherche POI borné entre 500 m et 25 km

**Demande d'origine** : « Ok, commit puis on attaque le rayon minuscule », puis « Ok, on suit tes
reco, 500 m » (Cédric, 2026-11-16). Item P2 du TODO « POI rayon minuscule » (JOURNAL J-065).

**Branche** : `fix/poi-rayon-minuscule`, issue de `fix/poi-rayon-geant` (`b310e82`) et non de
`develop` : les deux correctifs touchent le même calcul de `usePOIQuery.ts`. Rebase sur `develop`
une fois `fix/poi-rayon-geant` fusionnée.

**Hors périmètre explicite** :

- M3 : les bornes du hook ne dérivent pas des constantes de `SearchPOIUseCase` (bornes techniques
  contre valeurs produit) ; le test d'intégration garde leur cohérence.
- M4 : rayon de zone nul (participants à la même adresse) — carte et POI affichent « pas de
  calcul », le schéma `positive()` refuse le partage. Ajouté au TODO (P2), règle produit à fixer.
- Le rayon de zone (cercle de la carte, partage) ne change pas : seul le rayon de recherche POI est
  borné.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                             | Comment on le vérifie                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | M1 : le rayon envoyé à la recherche POI vaut au moins 500 m (`MIN_POI_SEARCH_RADIUS_M`) ; entre 500 m et 25 km, il passe tel quel                                                                                                     | Tests `usePOIQuery` (sous le plancher, au-dessus)                           |
| 2   | M2 : test d'intégration du hook avec le vrai `SearchPOIUseCase` (seul le service POI mocké), aux rayons 1 m, 99 m, 100 m, 500 m, 25 km, 100 km + 1 et 4 900 km : aucun `invalid_input`, rayon reçu par le service dans [500 m, 25 km] | Nouveau fichier de test d'intégration                                       |
| 3   | M5 : TODO « POI rayon minuscule » clos, item M4 ajouté, J-065 complété du correctif, PROGRESS et ARCHITECTURE à jour                                                                                                                  | Lecture de `TODO.md`, `JOURNAL-ECHECS.md`, `PROGRESS.md`, `ARCHITECTURE.md` |

---

## Socle systématique

- [x] `npm run check` vert.
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché — sans objet : aucun
      écran touché, seul le hook change.
- [x] Toute donnée externe validée par un schéma Zod — sans objet : aucune donnée externe nouvelle.
- [x] Toute string affichée passe par `useTranslation()` — sans objet : aucune string nouvelle.
- [x] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md` (ligne
      `usePOIQuery`), plus `JOURNAL-ECHECS.md` (J-065).
- [x] ADR si décision d'architecture — sans objet.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [x] Valider la liste des cas et la valeur du plancher (« Ok, on suit tes reco, 500 m »).
- [ ] Pousser `fix/poi-rayon-geant` puis `fix/poi-rayon-minuscule`.
- [ ] Appliquer la règle proposée par J-065 (test d'intégration hook + vrai use case aux bornes).

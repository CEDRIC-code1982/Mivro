# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Restes P3 relevés pendant A11Y-003

**Demande d'origine** : « on attaque les restes P3 », puis « Ok, on suit tes reco commit et push dès
que tout es ok » (Cédric, 2026-11-16).

**Branche** : `fix/a11y-003-hints`, à la suite de `cbf1dc8` (la PR n'existe pas encore).

**Hors périmètre explicite** :

- R2 : `cardLabel` de ParticipantCard laissé tel quel (deux données jointes par une virgule, rien à
  traduire) ; l'item est clos « sans objet » dans le TODO.
- Les libellés de catégorie au pluriel (« Le Comptoir, Cafés ») : ajouté au TODO, il touche
  POICard, POIDetailSheet et POIMapView.
- `noResultsHint`, `nameHint`, `signedInAsHint`, `loadingHint` : ce ne sont pas des hints
  d'action à l'impératif, on n'y touche pas.
- Le push : GitHub est refusé au sandbox, c'est Cédric qui pousse.

---

## Conditions de fin

| #   | Condition                                                                                                                                           | Comment on le vérifie                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | R1 : le libellé du marqueur POI de POIMapView annonce la catégorie traduite par `` t(`categories.${…}`) ``, comme POICard                           | Test POIMapView sur le libellé                                    |
| 2   | R3 : le bouton retour de l'en-tête de POIScreen utilise `poi:header.back` et `poi:header.backHint` ; le bouton de l'état vide garde `noSession.*`   | Test d'intégration POIScreen ; clés FR et EN, parity et keys vert |
| 3   | R4, R5 : `create:autocomplete.addressHint`, `useGpsHint` et `profile:avatarPicker.selectHint` en EN à la 3ᵉ personne ; FR inchangé                  | Lecture des JSON EN                                               |
| 4   | Docs : l'item « Restes relevés pendant A11Y-003 » du TODO clos (R2 sans objet, motif écrit), l'item pluriel des catégories ajouté ; PROGRESS à jour | Lecture de `TODO.md` et `PROGRESS.md`                             |

---

## Socle systématique

- [x] `npm run check` vert (15/15, 1282 tests, 2026-11-16).
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché — sans objet : seuls
      des libellés d'accessibilité changent.
- [x] Toute donnée externe validée par un schéma Zod — sans objet.
- [x] Toute string affichée passe par `useTranslation()`.
- [x] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md` (`ARCHITECTURE.md` sans objet).
- [x] ADR si décision d'architecture — sans objet.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [x] Valider la liste des recommandations, un élément par ligne (« Ok, on suit tes reco »,
      2026-11-16).
- [ ] Pousser `fix/a11y-003-hints` (GitHub refusé au sandbox).

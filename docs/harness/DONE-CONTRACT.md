# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : POI « rayon géant » — erreur typée affichée, rayon de recherche plafonné à 25 km

**Demande d'origine** : « Ok, go pour le rayon géant », puis « Ok, on suit tes reco, 25 km »
(Cédric, 2026-11-16). Item P2 du TODO « POI rayon géant ».

**Branche** : `fix/poi-rayon-geant`, issue de `develop` (`ad43859`).

**Hors périmètre explicite** :

- C6 : états loading et error de la vue carte (POIMapView) — au TODO (P2), un rendu est à choisir.
- C7 : bouton « Réessayer » dans l'état d'erreur — au TODO, il demande une prop d'action sur
  EmptyState, déjà touché par `fix/a11y-003-hints`.
- Le rayon de zone (cercle de la carte, partage) ne change pas : seul le rayon de recherche POI est
  plafonné.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                         | Comment on le vérifie                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | C1 : l'état d'erreur de POIListView affiche le titre `errors.title` et le message traduit `errors.${code}` ; repli `errors.unknown` ; plus aucun message technique brut           | Tests POIListView, un par code              |
| 2   | C2 : le rayon envoyé à la recherche POI est plafonné à 25 km ; en dessous, il passe tel quel                                                                                      | Test `usePOIQuery` (rayon > 25 km, < 25 km) |
| 3   | C3 : une réponse Overpass HTTP 200 dont `remark` signale un `runtime error` lève `query_timeout` (« timed out ») ou `server_error` (autre) ; une `remark` sans erreur est ignorée | Tests OverpassPOIService avec fixtures      |
| 4   | C4 : pas de nouvelle tentative sur `query_timeout`                                                                                                                                | Test `usePOIQuery` sur le retry             |
| 5   | C5 : `errors.query_timeout` reformulé en FR et EN, sans « réduis la zone »                                                                                                        | Lecture des JSON ; parity et keys verts     |
| 6   | Docs : item « POI rayon géant » du TODO clos, C6 et C7 ajoutés au TODO, PROGRESS à jour                                                                                           | Lecture de `TODO.md` et `PROGRESS.md`       |

---

## Socle systématique

- [x] `npm run check` vert.
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché — vue liste ; la vue
      carte est hors périmètre (C6).
- [x] Toute donnée externe validée par un schéma Zod (`remark` ajouté au schéma de réponse).
- [x] Toute string affichée passe par `useTranslation()`.
- [x] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md` (ligne
      `usePOIQuery`).
- [x] ADR si décision d'architecture — sans objet.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [x] Valider la liste des cas et la valeur du plafond (« Ok, on suit tes reco, 25 km »,
      2026-11-16).
- [ ] Pousser `fix/poi-rayon-geant` (GitHub refusé au sandbox).

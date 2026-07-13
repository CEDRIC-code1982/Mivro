# ADR-001 : Nominatim + Overpass (OpenStreetMap) pour le géocodage et les POI

Date : 2026-04-27
Statut : Accepté
Auteur : Cédric Pineau

> Documenté rétroactivement le 2026-07-14 (ADR rattrapage).

## Contexte

Le cœur de Mivro repose sur deux services de données géographiques :

- **Géocodage** : adresse → coordonnées (F1) et reverse (coordonnées → adresse,
  pour « ma position GPS »).
- **Points d'intérêt** : recherche de lieux autour du midpoint (F3).

Contraintes du MVP : développeur solo, budget nul, exigence **RGPD** (données
EU, minimisation), et découplage (le transport doit rester substituable derrière
un port).

## Décision

Utiliser les services **OpenStreetMap** :

- **Nominatim** pour le géocodage (adapter `NominatimGeocodeService`, port
  `IGeocodeService`).
- **Overpass API** pour les POI (adapter `OverpassPOIService`, port
  `IPOIService`).

Les deux sont confinés dans `src/services/infra/{geocode,poi}/` derrière leurs
ports respectifs — le core et la présentation ne connaissent aucun fournisseur.
Chaque appel envoie un **User-Agent** identifiant l'app (exigé par la politique
d'usage OSM).

## Raisons

- **Gratuit, sans clé API** : aucune facturation, aucun compte à provisionner —
  idéal pour démarrer un MVP solo sans blocage administratif.
- **Données OSM ouvertes** et couverture mondiale correcte pour un point de
  rendez-vous entre amis.
- **RGPD** : instances hébergeables en EU (voir ADR-009 pour le passage en
  self-host à l'échelle), pas de profilage publicitaire côté fournisseur.
- **Substituable** : isolé derrière `IGeocodeService` / `IPOIService` → passer à
  Google/Mapbox = changer 1 ligne dans `serviceContainer.ts`.

## Compromis

- **Rate limits stricts** sur les instances publiques (Nominatim ≈ 1 req/s,
  Overpass quotas) → nécessite debounce côté client + cache TanStack Query
  (géocodage 1 min, POI 5 min) + User-Agent correct. Voir ADR-009.
- **Qualité/ranking** de l'autocomplétion en retrait par rapport à Google Places
  (moins de tolérance aux fautes, ranking moins fin).
- **Pas de SLA** sur les instances publiques → self-host obligatoire avant tout
  trafic réel (ADR-009).

## Alternatives écartées

- **Google Geocoding + Places** : meilleure qualité et autocomplétion, mais
  **payant** (facturation à l'usage + clé + compte de facturation), moins
  RGPD-friendly (US, profilage). Réévaluable si le budget le permet — le port
  rend le swap trivial.
- **Mapbox** : bonne qualité, mais payant et clé requise.
- **Photon** (surcouche Nominatim orientée autocomplete) : intéressant pour
  l'autocomplétion ; envisageable en complément côté self-host plus tard.

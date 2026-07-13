# ADR-009 : Stratégie de montée en charge des APIs externes (Nominatim / Overpass)

Date : 2026-04-27
Statut : Accepté
Auteur : Cédric Pineau

> Documenté rétroactivement le 2026-07-14 (ADR rattrapage).

## Contexte

Le MVP consomme les **instances publiques** d'OpenStreetMap (Nominatim,
Overpass — voir ADR-001), soumises à des **politiques d'usage strictes** :
limites de débit, `User-Agent` obligatoire, interdiction de charge lourde, pas de
SLA. Il faut respecter ces politiques **et** anticiper la montée en charge sans
se peindre dans un coin.

## Décision

**MVP** : utiliser les instances publiques de manière responsable —

- `User-Agent` identifiant l'app sur chaque requête.
- **Debounce** de la saisie (autocomplétion) côté client.
- **Cache TanStack Query** : géocodage 1 min, POI 5 min ; **retry** limité (2×).

**À l'échelle (beta et au-delà)** : basculer vers des instances **auto-hébergées**
(Nominatim/Overpass en EU) ou un fournisseur payant. Comme tout est isolé derrière
les ports `IGeocodeService` / `IPOIService`, le basculement = **1 ligne** dans
`serviceContainer.ts`.

## Raisons

- **Respect de la politique OSM** : sans quoi l'app risque un blocage IP.
- **Réduction des appels** : cache + debounce diminuent fortement le volume.
- **Découplage** : les ports permettent de changer d'instance/fournisseur sans
  toucher au core ni à l'UI.
- **Report du coût infra** : on ne paie/héberge que quand le trafic le justifie.

## Compromis

- Les instances publiques restent **best-effort** (pas de SLA, latence variable).
- Il **faudra** self-héberger ou payer **avant** un vrai trafic (sous peine de
  violer la politique OSM).
- Couverture/qualité OSM variable selon les zones.

## Alternatives écartées

- **Google/Mapbox dès le départ** : élimine les limites, mais coût + clé + moindre
  conformité RGPD dès le MVP (cf. ADR-001).
- **Self-host dès le jour 1** : overhead d'infra prématuré pour un MVP solo sans
  trafic.

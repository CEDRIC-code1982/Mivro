# ADR-015 : Composants locaux à une feature

Date : 2026-08-24
Statut : Accepté
Auteur : Cédric Pineau

> Remplace partiellement **ADR-014** sur le seul point « frontière feature vs partagé ».
> Le reste d'ADR-014 (layout feature-first, couche `services/`, tests co-localisés) est inchangé.

## Contexte

ADR-014 avait tranché de garder **tous** les composants dans le kit global `src/components/`
(Atomic Design, règle DS-004), sans composants par feature. La mise en place du harness d'agent
(règle `components-no-features` de `.dependency-cruiser.js`) a rendu visible ce que ce choix
coûtait réellement : **5 violations de la règle de dépendance**, toutes de la même forme, le kit UI
global important du code de feature.

- 4 molecules POI (`POICard`, `POIDetailSheet`, `POIMapView`, `POIScreenHeader`) importaient
  `@features/POI/utils/poiIcons`. `POIListView` n'importait pas `poiIcons` mais `POICard`, donc
  suivait nécessairement le mouvement.
- `AddressAutocomplete` importait `@features/Session/hooks/useGeocodeQuery`.

Une vérification d'usage a montré que le couplage n'était pas le problème mais le **symptôme** :

| Composant             | Importé par                      |
| --------------------- | -------------------------------- |
| `POICard`             | `POIListView` uniquement         |
| `POIDetailSheet`      | `POIScreen` uniquement           |
| `POIListView`         | `POIScreen` uniquement           |
| `POIMapView`          | `POIScreen` uniquement           |
| `POIScreenHeader`     | `POIScreen` uniquement           |
| `AddressAutocomplete` | `CreateSessionScreen` uniquement |

**Aucun de ces six composants n'était partagé.** Six composants de feature vivaient dans le kit
commun, et c'est de là qu'ils avaient besoin de code de feature.

## Décision

Un composant appartient à la feature qui l'utilise, dès lors qu'**une seule** feature l'utilise.

- `src/components/` ne contient que du **réellement partagé** entre features (atoms + molecules
  transverses). C'est la définition du kit : ce que toutes les features ont en commun ne peut
  connaître aucune d'elles.
- `src/features/<X>/components/` accueille les composants propres à une feature.
- Le critère est **l'usage réel, pas la taille ni la sophistication** du composant.
- Un composant de feature reste **présentationnel** : pas d'accès au conteneur de DI, les données
  arrivent par les props ou par un hook de la même feature.
- Les composants d'une feature sont **privés** : une autre feature ne les importe pas.

Appliqué : les 5 composants POI dans `src/features/POI/components/`, `AddressAutocomplete` (+
`AddressResultItem`) dans `src/features/Session/components/`.

## Raisons

- **Supprime la cause au lieu de la contourner.** Les deux alternatives consistaient à promouvoir
  du code de feature au rang de « partagé » (`poiIcons` dans `components/`, `useGeocodeQuery` dans
  `src/hooks/`), ce qui aurait rendu la règle verte en aggravant le désalignement : un mapping
  d'icônes POI et une requête de géocodage Session ne sont pas des utilitaires transverses.
- **Cohérent avec l'intention d'ADR-014.** Le feature-first veut qu'une feature soit lisible et
  supprimable d'un bloc. Cinq de ses composants ailleurs dans l'arbre contredisent cet objectif.
- **DS-004 est préservée.** Atomic Design continue de régir `src/components/` (atoms → molecules →
  organisms → templates) et les règles `atoms-no-upper` / `molecules-no-upper` /
  `organisms-no-upper` restent en vigueur. Un composant de feature est une molecule composant des
  atoms du kit : la hiérarchie n'est pas cassée, seule sa localisation change.
- **La frontière est tenue par un capteur, pas par la discipline.** `components-no-features` est
  passée en `error` **sans aucune exemption** (le grandfathering `pathNot` a été supprimé), et deux
  règles ont été ajoutées : `no-cross-feature-private-import` (les `screens`, `utils` et
  `components` d'une feature sont privés) et `feature-components-presentational` (pas de DI dans un
  composant de feature). Chacune est prouvée par une violation volontaire dans
  `scripts/harness-selftest.sh`.

## Compromis

- **Deux emplacements possibles** pour un composant : il faut trancher à la création. Le critère
  d'usage réel rend la décision mécanique, et `check:arch` rattrape l'erreur.
- **Un composant peut devoir déménager** le jour où une deuxième feature en a besoin — de
  `features/<X>/components/` vers `components/molecules/`. C'est un `git mv` plus une réécriture
  d'imports, et le capteur signale le besoin (la deuxième feature ne peut pas importer le
  composant privé de la première).
- **Migration partielle assumée.** Seuls les six composants qui créaient une violation ont été
  déplacés. Cinq molecules mono-feature restent dans le kit global (`AvatarPicker`,
  `BiometricLockScreen`, `LiveParticipantsList`, `RealtimeConsentModal`, `SessionMapView`) ;
  `ParticipantCard` sert à deux features et y reste à juste titre. Aucune ne viole de règle : les déplacer serait de la
  cohérence de taxonomie, à traiter séparément (`docs/context/TODO.md`, P3).
- **La cohérence de la règle n'est donc pas encore visible dans l'arbre** : un lecteur peut voir
  `SessionMapView` dans le kit global et en déduire, à tort, que les composants de feature y vont.

## Alternatives écartées

- **Remonter les deux modules partagés** (`poiIcons` dans `components/`, `useGeocodeQuery` dans
  `src/hooks/`) : le plus petit diff — deux fichiers — mais il soigne le symptôme. Il déclare
  « partagé » du code qui ne l'est pas et laisse les composants POI dans le kit commun. Rejeté.
- **Déplacer immédiatement tous les composants mono-feature** : taxonomie idéale, mais diff large
  touchant quatre features de plus alors qu'aucune règle ne l'exige. Reporté, pas rejeté.
- **Garder ADR-014 tel quel et exempter les deux imports** (`pathNot` dans dependency-cruiser) :
  c'était l'état transitoire pendant la mise en place du harness. Rejeté : une exemption
  permanente transforme une règle en décoration, et celle-ci portait sur la frontière la plus
  structurante du projet.

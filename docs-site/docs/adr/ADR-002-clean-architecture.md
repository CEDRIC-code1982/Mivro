# ADR-002 : Clean Architecture + Ports/Adapters

Date : 2026-04-27
Statut : Accepté
Auteur : Cédric Pineau

> Documenté rétroactivement le 2026-07-14 (ADR rattrapage).
> ⚠️ La **disposition physique** des dossiers décrite ici a été réorganisée le
> 2026-07-13 (layer-first → feature-first, voir **ADR-014**). Les **principes**
> ci-dessous (règle de dépendance, ports/adapters, point de câblage unique)
> restent **inchangés**.

## Contexte

Mivro est développé en solo, avec une roadmap multi-phases (mobile → auto/CarPlay
→ watch) et plusieurs fournisseurs externes potentiellement substituables
(géocodage, POI, temps réel, crash, analytics). Il faut une architecture qui
maximise la **testabilité** (sans device), le **découplage** (changer de
fournisseur sans casser l'UI) et la **maintenabilité** dans la durée.

## Décision

Adopter la **Clean Architecture** avec le pattern **Ports/Adapters** (hexagonal) :

- **Domaine** : entités (Zod), use cases, et **ports** (interfaces `I*`) — aucune
  dépendance vers un framework ou un fournisseur concret.
- **Infra** : **adapters** qui implémentent les ports (Nominatim, Overpass,
  Firebase, MMKV, Keychain, Sentry…).
- **Présentation** : React (écrans, hooks, stores) — consomme le domaine via les
  ports, jamais un adapter concret.
- **Règle de dépendance** : la présentation et le domaine ne dépendent jamais des
  implémentations concrètes ; le **seul** point de câblage concret est le
  conteneur d'injection de dépendances (aujourd'hui
  `src/services/serviceContainer.ts`).

## Raisons

- **Testabilité** : les use cases et l'UI se testent en mockant les ports
  (jest-mock-extended), sans device ni réseau — clé pour un solo dev.
- **Substituabilité** : changer de fournisseur (ex. Nominatim → Google) = 1 ligne
  dans le conteneur, zéro impact sur le core/l'UI.
- **Séparation des responsabilités** : la logique métier est isolée du framework
  et des I/O, ce qui protège la roadmap longue (réutilisable sur auto/watch).

## Compromis

- **Boilerplate** : chaque capacité = un port + un adapter + (souvent) un use
  case. Surcoût réel pour un petit MVP.
- **Courbe d'apprentissage / discipline** : il faut résister à la tentation
  d'importer un adapter directement depuis l'UI.
- La rigueur des couches a été **assouplie dans la forme** (mais pas dans le
  principe) par le passage en feature-first (ADR-014).

## Alternatives écartées

- **MVC / structure « plate »** : plus rapide à court terme, mais couplage fort
  UI↔I/O et testabilité médiocre — mauvais pour une roadmap longue.
- **Feature-sliced sans ports** : bonne localité, mais rend les fournisseurs
  difficilement substituables et la logique métier moins isolée. (Mivro a
  finalement adopté une organisation feature-first **tout en conservant** les
  ports — voir ADR-014.)

# ADR-005 : Zustand + TanStack Query plutôt que Redux

Date : 2026-04-27
Statut : Accepté
Auteur : Cédric Pineau

> Documenté rétroactivement le 2026-07-14 (ADR rattrapage).

## Contexte

Mivro doit gérer deux natures d'état :

- **État client global** : session en cours, utilisateur, positions temps réel,
  préférences (dark mode, langue, biométrie).
- **État serveur / asynchrone** : requêtes de géocodage et de POI (cache, retry,
  invalidation).

Le projet est développé en solo → priorité au **ratio simplicité / puissance** et
au faible boilerplate.

## Décision

- **Zustand** pour l'état client global : un store par domaine dans `src/state/`
  (`useSessionStore`, `useAuthStore`, `useRealtimeStore`, `usePreferencesStore`,
  `useSharedSessionStore`), persistance via le **middleware persist + MMKV**.
- **TanStack Query** pour l'état serveur/asynchrone (`useGeocodeQuery`,
  `usePOIQuery`) : cache, retry, invalidation. `QueryClient` câblé dans le
  conteneur.
- Sélecteurs **mémoïsés / atomiques**, actions explicites, types stricts (zéro
  `any`).

## Raisons

- **Boilerplate minimal** vs Redux/RTK (pas d'actions/reducers/slices verbeux) —
  décisif en solo.
- **Store par domaine** simple, sans god-object, avec persistance MMKV native.
- **Séparation client/serveur** claire : TanStack Query gère le cache/async, ce
  que Redux ferait moins bien sans surcouche.

## Compromis

- Écosystème / conventions moins standardisés que Redux (devtools, middlewares).
- **Discipline requise** : sélecteurs atomiques obligatoires — un sélecteur
  renvoyant un nouvel objet a provoqué une **boucle de rendu** (Zustand v5) lors
  de F4, corrigée par des références stables / `useMemo`.

## Alternatives écartées

- **Redux Toolkit** : standard robuste et outillé, mais trop verbeux pour un MVP
  solo, sans bénéfice à cette échelle.
- **Context + useReducer** : suffisant pour un petit état, mais problèmes de
  performance (re-renders) et boilerplate dès que l'état grossit.
- **Jotai / Recoil** (modèle atomique) : viables, mais moins adaptés à des stores
  de domaine persistés.

> Note : le projet de référence `p0153_lineguard_studio_mobile` utilise Redux
> Toolkit. Lors du refactor du 2026-07-13 (ADR-014), Mivro a délibérément
> **conservé Zustand** (réorganisation des dossiers uniquement, pas de la stack).

# ADR-014 : Réorganisation feature-first + couche `services/` + tests co-localisés

Date : 2026-07-13
Statut : Accepté
Auteur : Cédric Pineau

## Contexte

L'organisation initiale était **layer-first** (`core/` / `infrastructure/` /
`presentation/`, DI dans `di/container.ts` — voir ADR-002). Avec 8 features
livrées, le besoin est apparu d'aligner la **disposition des dossiers** sur le
projet de référence `p0153_lineguard_studio_mobile` (organisation **feature-first**
et couche `services/`) et d'améliorer la **localité** — regrouper ce qui vit
ensemble et rapprocher les tests de leur sujet.

Contrainte forte fixée avec Cédric : **réorganiser les dossiers uniquement**, sans
toucher à la stack ni au comportement.

## Décision

Refactor **purement structurel** (commit `de6b15c`, **1133 tests** verts, zéro
changement de comportement) :

- **Feature-first** : `src/features/<F>/{screens/<Nom>/, hooks/}` pour Session,
  POI, Sharing, Profile, Biometric.
- **Couche `services/`** : `services/domain/<domaine>/` (use cases + ports `I*`),
  `services/infra/<domaine>/` (adapters), `services/utils/`, et
  **`services/serviceContainer.ts`** (ex `di/container.ts`).
- **State centralisé** : stores Zustand dans `src/state/`.
- **Kit UI global** : `src/components/{atoms,molecules,organisms,templates}/` —
  **Atomic Design conservé** (DS-004).
- **Transverses** : `src/entities/` (Zod), `src/theme/`, `src/hooks/`,
  `src/navigations/`.
- **Tests co-localisés** : chaque `*.test.ts(x)` à côté de son sujet ; tests
  d'intégration en `*.integration.test.tsx` ; helpers dans `src/test-utils/` ;
  E2E Maestro à la racine `e2e/`.
- **Alias** : `@core/@infrastructure/@presentation` → `@features @services
@components @state @entities @theme @hooks @navigations @test-utils` (tsconfig,
  babel, jest, eslint).

**Les principes de l'ADR-002 sont préservés** : ports/adapters, règle de
dépendance (`features + components + state → services/domain ← services/infra`),
point de câblage concret unique (`serviceContainer`). Seule la **forme** (layout
physique) change.

## Raisons

- **Localité feature** : écrans + hooks d'une feature regroupés → navigation et
  évolution plus simples.
- **Tests co-localisés** : plus faciles à trouver et à maintenir que dans un
  `__tests__/` central.
- **Alignement** sur le projet de référence lineguard.
- **Frontière `services/` explicite** (domain vs infra) sans perdre les ports.

## Compromis

- **Churn ponctuel important** : 236 fichiers (renommages), tous les imports et
  alias réécrits, docs/skills/agents à mettre à jour.
- **Frontière feature vs partagé** : choix de garder **tous** les composants dans
  le kit global (Atomic Design) plutôt que des composants par feature, pour
  honorer DS-004.
- L'ADR-002 devient partiellement obsolète **sur la forme** (le layout y décrit
  n'existe plus) — d'où cette ADR qui l'actualise.

## Alternatives écartées

- **Garder le layer-first** : rejeté, l'objectif explicite était l'alignement
  lineguard + la co-localisation des tests.
- **Port complet de la stack lineguard** (Redux Toolkit + `neverthrow` + services
  en factory functions) : rejeté — réécriture lourde et risquée, contredit
  ADR-005 (Zustand), sans bénéfice de comportement. Seule la structure de dossiers
  a été alignée.

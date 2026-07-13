---
name: create-feature
description: Procédure complète (feature-first + services/) pour implémenter une nouvelle feature Mivro de bout en bout (entité → port → usecase → adapter → hook → UI → i18n → DI → tests → docs). À utiliser quand on démarre une feature de la roadmap (F4, F5, F7, F8, F6…).
---

# Skill : create-feature

Implémente une feature de bout en bout en respectant l'architecture Mivro (feature-first + `services/`, ports/adapters). **Tests co-localisés** : chaque `*.test` à côté de son sujet (intégration en `*.integration.test`).
**Règles** : voir `CLAUDE.md` (TS-001..004, I18N-001/002, LOG-001, ERR-001..003, DOC-001..004, A11Y-_, DS-_). Ne pas les dupliquer ici.

## Avant de commencer

1. Lire la spec de la feature dans `CLAUDE.md > ROADMAP COMPLÈTE > Backlog`.
2. Vérifier les `⚠️ PAUSE OBLIGATOIRE` (compte/secret/fichier externe) → si présent, demander à Cédric AVANT de coder l'adapter.
3. Regarder `docs/context/ARCHITECTURE.md` pour les patterns/nommages existants.

## Étapes (respecter l'ordre des couches)

1. **Entité(s) core** — `src/entities/<Nom>.ts` : schéma **Zod** + `export type X = z.infer<typeof XSchema>`. Barrel `index.ts`.
2. **Port(s)** — `src/services/domain/<domaine>/I<Nom>Service.ts` : interface pure, TSDoc `@param/@returns/@throws`. Aucun import `services/infra` ni présentation.
3. **UseCase(s)** — `src/services/domain/<domaine>/<Verbe><Nom>UseCase.ts` : reçoit les ports par constructeur, orchestre, ne connaît aucune implémentation.
4. **Adapter(s)** — `src/services/infra/<domaine>/<Provider><Port>.ts` : implémente le port, validation Zod en frontière, try/catch + crashReporter, logging LOG-001. (Pour un service externe : utiliser le skill `external-service`.)
5. **Hook(s)** — `src/features/<Feature>/hooks/use<Nom>.ts` : TanStack Query pour l'async, ou sélecteur de store ; jamais d'import direct `services/infra`.
6. **Composant(s) UI** — atoms/molecules (skills `create-atom` / `create-molecule`) puis écran. États loading/error/empty (ERR-003), a11y (A11Y-003), tokens theme (DS-001/002).
7. **i18n** — namespace FR + EN (skill `add-i18n`). Zéro string hardcodée.
8. **Wire-up DI** — ajouter au `Container` + instancier dans `initContainer()` (`src/services/serviceContainer.ts`). Swap provider = 1 ligne.
9. **Tests** par couche — usecase (`*.test.ts` dédié), adapter (mock fetch / mock port via jest-mock-extended), store (actions + sélecteurs), composant (RTL). Respecter les seuils CI (entities + services/domain 90 / services/infra 70 / features + components + state 50).
10. **Docs** — mettre à jour `docs/context/{PROGRESS,TODO,ARCHITECTURE}.md`, déplacer la feature en ✅ dans `CLAUDE.md`. ADR si décision d'archi (DOC-003).

## Done

- `npm run check` vert (typecheck + lint + format + tests).
- Specs du backlog satisfaites + critères « Done » cochés.
- Docs à jour dans le même commit que la feature.

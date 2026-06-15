---
name: external-service
description: Pattern pour intégrer un service externe Mivro (API HTTP, SDK tiers) — port core + adapter infrastructure + validation Zod + Sentry + User-Agent + error mapping typé + tests avec mock fetch. À utiliser pour Firebase (F4), PostHog, OSRM, ou toute nouvelle API.
---

# Skill : external-service

Intègre un service externe via Ports/Adapters. **Règles** : voir `CLAUDE.md` (TS-004 Zod obligatoire, ERR-001 try/catch, LOG-001, RGPD, DOC-001..002).
Références existantes : `NominatimGeocodeService`, `OverpassPOIService`, `SentryCrashReporter`.

## 1. Port (core) — `src/core/ports/I<Nom>Service.ts`

- Interface pure, méthodes async typées, TSDoc `@param/@returns/@throws`.
- Aucune référence au provider concret (pas de mention Firebase/PostHog dans le nom des méthodes).

## 2. Adapter (infra) — `src/infrastructure/<domaine>/<Provider><Port>.ts`

- Implémente le port. Reçoit `ICrashReporter` par constructeur (comme les adapters existants).
- **Validation Zod** de TOUTE réponse externe (`Schema.parse` / `safeParse`) → données typées via `z.infer` (TS-004). Jamais de `any`.
- **HTTP** : `fetch` avec header `User-Agent` (Nominatim/Overpass l'exigent), timeout, gestion des status non-2xx.
- **Error mapping typé** : convertir les erreurs réseau/parse en erreurs métier (union de types ou classe d'erreur dédiée) — distinguer « réseau », « parse », « pas de résultat » (cf. bug QA P1 Nominatim).
- **try/catch** sur tous les appels (ERR-001) + `crashReporter.captureException` + log LOG-001.
- **RGPD** : ne jamais logger/envoyer GPS exact, emails, tokens (scrubbing).

## 3. Wire-up DI — `src/di/container.ts`

- Ajouter au type `Container` + instancier dans `initContainer()`. Swap provider = 1 ligne.

## 4. Tests — `src/__tests__/unit/infrastructure/<domaine>/`

- **Mock `fetch`** (ou mock du SDK) : succès, erreur réseau, payload invalide (Zod rejette), réponse vide.
- Vérifier l'error mapping + l'appel au crashReporter.
- Mocks typés via `jest-mock-extended` (zéro any). Seuil infra 70 %.

## Done

- `npm run check` vert. Adapter branché dans le container. Erreurs mappées et testées. Docs à jour.

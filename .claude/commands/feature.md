---
description: Implémente une feature de la roadmap Mivro en autonomie (spec CLAUDE.md + skill create-feature), met à jour les docs et commit.
argument-hint: [nom de la feature, ex: F7 ou "profil"]
---

Implémente la feature **$ARGUMENTS** pour Mivro, en autonomie.

1. Lis sa spec dans `CLAUDE.md > ROADMAP COMPLÈTE > Backlog priorisé` (objectif, couches, composants, dépendances, décisions tranchées, done, complexité).
2. Vérifie les `⚠️ PAUSE OBLIGATOIRE` : si la feature requiert un compte/secret/fichier externe (Firebase, Apple/Google, PostHog, clés prod), **PAUSE et demande à Cédric** avant d'écrire l'adapter.
3. Applique le skill **create-feature** (entité → port → usecase → adapter → hook → UI → i18n → DI → tests → docs). Utilise au besoin `create-atom`, `create-molecule`, `external-service`, `add-i18n`.
4. Respecte les règles bloquantes du CLAUDE.md. Lance `npm run check` jusqu'au vert (fix auto jusqu'à 2× avant de signaler).
5. Mets à jour `docs/context/{PROGRESS,TODO,ARCHITECTURE}.md` et déplace la feature en ✅ dans `CLAUDE.md`.
6. Commit (`feat(<scope>): …`) incluant code + docs. Termine par un résumé + une code review (niveau SENIOR : trade-offs, archi, maintenabilité).

Si la spec est incomplète, ajoute un TODO « ⚠️ À SPÉCIFIER AVEC CÉDRIC » plutôt que d'inventer.

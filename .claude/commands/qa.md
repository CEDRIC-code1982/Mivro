---
description: Génère une checklist QA pour les features Mivro récemment ajoutées (a11y, i18n, erreurs, RGPD, tests).
---

Génère une checklist QA actionnable pour les features récemment ajoutées à Mivro.

1. Identifie le périmètre : derniers commits (`git log --oneline -10`) + fichiers modifiés (`git status --short`). Si un argument est fourni ($ARGUMENTS), cible cette feature.
2. Rappelle/complète depuis `01-checklist-qa-technique.md` à la racine s'il est pertinent.
3. Produis une checklist groupée par thème, chaque item cochable et vérifiable sur device :
   - **Accessibilité** (A11Y-001..006) : contraste, touch target ≥44/48, labels/roles/hints, Dynamic Type 200 %, reduce motion, alternative texte carte.
   - **i18n** (I18N-001/002) : zéro string hardcodée, FR + EN alignés.
   - **Erreurs** (ERR-001..003) : états loading/error/empty, messages réseau distincts de « aucun résultat », ErrorBoundary.
   - **RGPD** : consentement GPS, partage explicite, pas de GPS/email/token loggé.
   - **Edge cases device** : mode avion, permissions refusées, hors-ligne, données vides.
   - **Tests** : couverture par couche vs seuils CI (core 90 / infra 70 / presentation 50 / global 70).
4. Mets en évidence les points P1 connus encore ouverts (voir `docs/context/TODO.md`).

N'implémente rien : produis uniquement la checklist.

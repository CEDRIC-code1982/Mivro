---
description: Met à jour PROGRESS.md et TODO.md selon l'état git actuel du projet Mivro.
---

Mets à jour les docs de contexte Mivro selon l'état réel du dépôt.

1. Lis l'état git : `git log --pretty=format:'%h|%ad|%s' --date=short` et `git status --short`.
2. **`docs/context/PROGRESS.md`** : ajoute/complète les sprints et features livrés depuis la dernière mise à jour (fichiers clés, commit hash, date). Recalcule les métriques (nb fichiers `src/` hors tests, nb tests, entités/ports/usecases/stores/hooks/atoms/molecules/écrans). Si `coverage/coverage-summary.json` existe, reporte la coverage par couche.
3. **`docs/context/TODO.md`** : coche les tâches désormais terminées, ajoute les découvertes / nouvelles tâches / blockers, mets à jour les sections « Dette technique » et « Décisions en attente ».
4. Mets à jour la date « Dernière mise à jour » des deux fichiers.
5. Ne touche PAS au code. Termine par un court résumé des changements de progression.

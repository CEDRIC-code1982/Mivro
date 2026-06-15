---
description: Investigue, corrige, teste et commit un bug Mivro avec balisage [FIXED].
argument-hint: [description du bug]
---

Corrige le problème suivant sur Mivro : **$ARGUMENTS**

1. **Investigue** : reproduis/localise la cause (lis le code concerné, les tests existants, les logs). Ne devine pas — confirme la cause racine.
2. **Corrige** en respectant les règles bloquantes du CLAUDE.md (TS strict, i18n, error handling, a11y, tokens theme). Vise la cause, pas le symptôme.
3. **Teste** : ajoute/complète un test qui échoue avant le fix et passe après. Lance `npm run check` jusqu'au vert (fix auto jusqu'à 2× avant de signaler).
4. **Docs** : si le bug révèle de la dette ou un piège, note-le dans `docs/context/TODO.md` / section « Appris » de `PROGRESS.md`. Coche le bug s'il était listé.
5. **Commit** : `fix(<scope>): … [FIXED]` incluant le test. Termine par un résumé : cause racine → correctif → preuve (test).

Si la cause touche une décision d'archi, propose un ADR (DOC-003).

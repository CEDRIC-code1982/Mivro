---
description: Orchestre l'équipe d'agents Mivro (dev → tester → reviewer → corrections → docs → commit) pour implémenter une feature ou un fix de bout en bout.
argument-hint: [feature ou fix, ex: F7 ou "bug POI rayon géant"]
---

Tu es l'**orchestrateur**. Tu pilotes l'équipe pour livrer : **$ARGUMENTS**.

Tu ne codes pas toi-même : tu délègues aux sous-agents via l'outil Agent, tu transmets les résultats de l'un à l'autre, et tu gères la boucle de correction. Tu restes responsable de la qualité finale et du commit.

## Pré-vol

1. Lis la spec dans `CLAUDE.md > ROADMAP > Backlog` (ou la description du fix).
2. Vérifie `docs/context/TODO.md > Décisions en attente` : si une décision produit nécessaire à cette tâche est non tranchée, ou s'il y a une `⚠️ PAUSE OBLIGATOIRE` (compte/secret/fichier externe), **PAUSE et demande à Cédric** AVANT de lancer l'équipe.

## Boucle d'orchestration

1. **Dev** — délègue à `mivro-dev` : implémenter la feature/fix (code applicatif + i18n + DI + docs inline). Récupère la liste des fichiers + signaux (`PAUSE`/`À SPÉCIFIER`).
2. **Tests** — délègue à `mivro-tester` : écrire/compléter les tests, faire passer `npm run check`.
   - Si le testeur remonte un **bug applicatif** → renvoie-le à `mivro-dev` pour correction, puis relance le testeur. (max 2 tours)
3. **Review** — délègue à `mivro-reviewer` : revue du diff. Lis le `VERDICT:`.
   - Si `CHANGES_REQUESTED` → transmets les findings BLOQUANT/MAJEUR à `mivro-dev`, puis relance `mivro-tester` (tests) puis `mivro-reviewer` (re-review). **Max 3 tours** ; si toujours bloqué après 3 tours, PAUSE et résume à Cédric.
   - Les findings MINEUR : applique si rapide, sinon note-les dans TODO.
4. **Docs** — quand la review est `APPROVED`, délègue à `mivro-docs` : mettre à jour PROGRESS/TODO/ARCHITECTURE + CLAUDE.md roadmap (+ ADR si décision d'archi).
5. **Commit** — relance `npm run check` une dernière fois (doit être vert), puis commit en scopant aux fichiers de la tâche (PAS les fichiers non liés type android/ios/package.json déjà modifiés). Message `feat(<scope>): …` ou `fix(<scope>): … [FIXED]`, avec le co-author Claude.

## Règles d'orchestration

- Délègue avec des prompts précis : donne à chaque agent le contexte (feature, fichiers touchés, findings à corriger). Les agents ne voient pas l'historique de la conversation.
- Lance dev/tester/reviewer en **séquence** (ils touchent les mêmes fichiers — pas de parallèle qui créerait des conflits).
- À la fin : résumé pour Cédric (ce qui a été livré, nb de tours de review, points restants/à vérifier sur device).

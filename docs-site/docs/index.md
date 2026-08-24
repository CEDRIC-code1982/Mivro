---
slug: /
title: Documentation technique Mivro
sidebar_position: 0
---

# Documentation technique Mivro

Deux sections, deux natures de contenu :

- **[ADR](/adr/ADR-001-nominatim-vs-google)** — les décisions d'architecture, écrites à la main.
  Toute décision structurante doit y laisser une trace (règle DOC-003 de `CLAUDE.md`).
- **API** — la référence générée par TypeDoc depuis `src/`, à partir des TSDoc du code
  (règles DOC-001 et DOC-002, vérifiées par ESLint).

## Régénérer

```bash
npm run docs        # TypeDoc puis build Docusaurus — doit passer sans erreur (DOC-004)
npm run docs:dev    # serveur de dev avec rechargement à chaud
```

`npm run docs` fait partie de la définition de « terminé » dès qu'une décision d'architecture
ou une API publique change. Le contenu de `docs/api/` est **généré** : ne pas l'éditer à la main.

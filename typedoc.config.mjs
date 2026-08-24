// Génère la référence API dans docs-site/docs/api/ depuis les TSDoc de src/
// (règles DOC-001 / DOC-002). Sortie en Markdown, consommée par Docusaurus.
//
// Config en .mjs et non .json : les choix ci-dessous ont besoin d'être expliqués,
// et JSON n'accepte pas de commentaires.

/** @type {Partial<import('typedoc').TypeDocOptions>} */
export default {
  entryPoints: ['src'],
  entryPointStrategy: 'expand',
  tsconfig: 'tsconfig.json',

  out: 'docs-site/docs/api',
  plugin: ['typedoc-plugin-markdown'],

  // Tests co-localisés, helpers de test et déclarations ambiantes ne font pas
  // partie de l'API publique. Les barrels (index.ts) n'ajoutent que du bruit.
  exclude: [
    '**/*.test.ts',
    '**/*.test.tsx',
    'src/test-utils/**',
    '**/*.d.ts',
    'src/types/**',
    '**/index.ts',
  ],
  excludePrivate: true,
  excludeInternal: true,
  excludeExternals: true,

  // @remarks et @format sont utilisés par le code (cf. check-tag-names dans .eslintrc.js).
  blockTags: [
    '@param',
    '@returns',
    '@throws',
    '@remarks',
    '@example',
    '@module',
    '@file',
    '@description',
    '@deprecated',
    '@see',
    '@defaultValue',
    '@format',
  ],

  readme: 'none',
  githubPages: false,
  hideGenerator: true,
  sort: ['source-order'],

  // Un lien non résolvable vers un type de lib externe ne doit pas faire
  // échouer la génération : ce n'est pas un défaut de notre documentation.
  validation: {
    notExported: false,
    invalidLink: false,
    notDocumented: false,
  },
};

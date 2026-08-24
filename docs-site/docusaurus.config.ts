import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

/**
 * Documentation Mivro.
 *
 * Le site sert deux choses :
 *  - `docs/adr/` — les ADR écrits à la main (DOC-003) ;
 *  - `docs/api/` — la référence générée par TypeDoc depuis `src/` (DOC-001/002).
 *
 * `npm run docs` (à la racine) régénère l'API puis construit ce site : c'est la
 * commande que DOC-004 exige de voir passer sans erreur.
 */
const config: Config = {
  title: 'Mivro — Documentation technique',
  tagline: 'ADR et référence API',

  url: 'https://cedric-code1982.github.io',
  baseUrl: '/Mivro/',
  organizationName: 'CEDRIC-code1982',
  projectName: 'Mivro',

  // Un lien mort est une erreur : la doc doit rester navigable.
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  onDuplicateRoutes: 'throw',

  i18n: {
    defaultLocale: 'fr',
    locales: ['fr'],
  },

  // Docusaurus 3 parse les .md en MDX par défaut, donc toute accolade devient
  // une expression JS — ce qui casse sur le Markdown généré par TypeDoc
  // (génériques, objets littéraux). 'detect' rend les .md au CommonMark et
  // réserve MDX aux .mdx.
  // Without this, generated TypeDoc markdown fails to parse as MDX.
  markdown: {
    format: 'detect',
    // Depuis Docusaurus 3.9, onBrokenMarkdownLinks vit ici et non à la racine
    // (l'ancien emplacement est déprécié et silencieusement ignoré).
    // Since 3.9 this hook lives here; the root-level option is deprecated.
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        // Pas de blog ni de page marketing : c'est de la doc technique interne.
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Mivro',
      items: [
        { type: 'docSidebar', sidebarId: 'adrSidebar', position: 'left', label: 'ADR' },
        { type: 'docSidebar', sidebarId: 'apiSidebar', position: 'left', label: 'API' },
        {
          href: 'https://github.com/CEDRIC-code1982/Mivro',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Mivro — documentation interne. Construit avec Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'diff'],
    },
    colorMode: { respectPrefersColorScheme: true },
  } satisfies Preset.ThemeConfig,
};

export default config;

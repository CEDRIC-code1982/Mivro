/**
 * dependency-cruiser configuration — architectural sensor for Mivro.
 *
 * Layer names below are the REAL directory names observed in src/ (see
 * docs/harness/INVENTAIRE.md), not an assumed convention:
 *
 *   src/services/domain   -> business layer (ports I* + *UseCase). Must stay pure.
 *   src/services/infra    -> adapters (Nominatim, Overpass, Firebase, MMKV, Keychain, Sentry...).
 *   src/services/utils    -> pure helpers (geo/, format/).
 *   src/features           -> feature-first screens + hooks.
 *   src/components         -> global UI kit (atoms/molecules/organisms/templates).
 *   src/state              -> Zustand stores.
 *   src/entities, src/theme -> cross-cutting, importable anywhere.
 *
 * Run with: npm run check:arch
 */

/**
 * UI / framework packages the business layer must never touch.
 *
 * NOTE: dependency-cruiser matches `to.path` against the RESOLVED path, so an
 * npm package appears as `node_modules/<name>/...`, never as the bare specifier.
 */
const UI_PACKAGES = [
  '^node_modules/react/',
  '^node_modules/react-dom/',
  '^node_modules/react-native/',
  '^node_modules/react-native-',
  '^node_modules/@react-native/',
  '^node_modules/@react-native-community/',
  '^node_modules/@react-native-firebase/',
  '^node_modules/@react-navigation/',
  '^node_modules/react-i18next/',
  '^node_modules/i18next/',
  '^node_modules/@gorhom/',
  '^node_modules/lucide-react-native/',
  '^node_modules/@tanstack/react-query/',
  '^node_modules/@sentry/react-native/',
];

/** Concrete adapters + the DI container: reachable only through hooks / DI. */
const ADAPTER_PATHS = ['^src/services/infra/'];

module.exports = {
  forbidden: [
    // ---------------------------------------------------------------------
    // 1. Business layer purity (CLAUDE.md ARCHITECTURE: domain imports nothing)
    // ---------------------------------------------------------------------
    {
      name: 'domain-no-ui',
      severity: 'error',
      comment:
        'src/services/domain (usecases + ports) must not depend on React Native, React or any UI library. Move the framework-specific code to src/services/infra or to a hook.',
      from: { path: '^src/services/domain/' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'], path: UI_PACKAGES },
    },
    {
      name: 'domain-no-infra',
      severity: 'error',
      comment:
        'src/services/domain must not depend on src/services/infra. Depend on the port (I*) and let src/services/serviceContainer.ts wire the adapter.',
      from: { path: '^src/services/domain/' },
      to: { path: ADAPTER_PATHS },
    },
    {
      name: 'domain-no-app-layers',
      severity: 'error',
      comment:
        'src/services/domain must not depend on features, components, state, hooks, navigations or i18n. Dependencies point inward only.',
      from: { path: '^src/services/domain/' },
      to: {
        path: [
          '^src/features/',
          '^src/components/',
          '^src/state/',
          '^src/hooks/',
          '^src/navigations/',
          '^src/i18n/',
          '^src/App\\.tsx$',
          '^src/services/serviceContainer\\.ts$',
        ],
      },
    },

    // ---------------------------------------------------------------------
    // 2. Screens must not reach for a repository / API client directly
    // ---------------------------------------------------------------------
    {
      name: 'screens-no-adapter',
      severity: 'error',
      comment:
        'A screen must not import a concrete adapter, the DI container or a network/SDK client. Go through a feature hook (src/features/<Feature>/hooks/) which reads serviceContainer.',
      from: { path: '^src/features/[^/]+/screens/' },
      to: {
        path: [
          ...ADAPTER_PATHS,
          '^src/services/serviceContainer\\.ts$',
          '^src/services/queryClient\\.ts$',
        ],
      },
    },
    {
      name: 'screens-no-network-client',
      severity: 'error',
      comment:
        'A screen must not talk to a network SDK directly (Firebase, MMKV, Keychain...). Wrap it in an adapter behind a port in src/services/domain.',
      from: { path: '^src/features/[^/]+/screens/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
        path: [
          '^node_modules/@react-native-firebase/',
          '^node_modules/react-native-mmkv/',
          '^node_modules/react-native-keychain/',
          '^node_modules/@dr\\.pogodin/react-native-fs/',
          '^node_modules/react-native-image-picker/',
        ],
      },
    },

    // ---------------------------------------------------------------------
    // 3. UI kit / stores must not know the adapters either
    // ---------------------------------------------------------------------
    {
      name: 'ui-no-adapter',
      severity: 'error',
      comment:
        'features, components, state, hooks and navigations must never import a concrete adapter from src/services/infra — only src/services/serviceContainer.ts may.',
      from: {
        path: [
          '^src/features/',
          '^src/components/',
          '^src/state/',
          '^src/hooks/',
          '^src/navigations/',
        ],
      },
      to: { path: ADAPTER_PATHS },
    },
    {
      name: 'components-no-di',
      severity: 'error',
      comment:
        'The global UI kit (src/components) must stay presentational: no DI container, no data fetching. Receive data through props.',
      from: { path: '^src/components/(atoms|molecules|organisms)/' },
      to: { path: ['^src/services/serviceContainer\\.ts$', '^src/services/queryClient\\.ts$'] },
    },

    // ---------------------------------------------------------------------
    // 4. Cross-cutting layers stay pure
    // ---------------------------------------------------------------------
    {
      name: 'entities-pure',
      severity: 'error',
      comment: 'src/entities holds Zod domain models only: no React Native, no services, no UI.',
      from: { path: '^src/entities/' },
      to: {
        path: ['^src/services/', '^src/features/', '^src/components/', '^src/state/'],
      },
    },
    {
      name: 'entities-no-ui-package',
      severity: 'error',
      comment: 'src/entities must not depend on a UI package.',
      from: { path: '^src/entities/' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'], path: UI_PACKAGES },
    },
    {
      name: 'utils-pure',
      severity: 'error',
      comment:
        'src/services/utils holds pure helpers: no UI package, no domain, no infra, no app layer.',
      from: { path: '^src/services/utils/' },
      to: {
        path: [
          '^src/services/domain/',
          '^src/services/infra/',
          '^src/features/',
          '^src/components/',
          '^src/state/',
        ],
      },
    },

    // ---------------------------------------------------------------------
    // 5. Atomic Design (DS-004): atoms -> molecules -> organisms -> templates
    // ---------------------------------------------------------------------
    {
      name: 'atoms-no-upper',
      severity: 'error',
      comment: 'DS-004: an atom must not import a molecule, an organism or a template.',
      from: { path: '^src/components/atoms/' },
      to: { path: '^src/components/(molecules|organisms|templates)/' },
    },
    {
      name: 'molecules-no-upper',
      severity: 'error',
      comment: 'DS-004: a molecule must not import an organism or a template.',
      from: { path: '^src/components/molecules/' },
      to: { path: '^src/components/(organisms|templates)/' },
    },
    {
      name: 'organisms-no-upper',
      severity: 'error',
      comment: 'DS-004: an organism must not import a template.',
      from: { path: '^src/components/organisms/' },
      to: { path: '^src/components/templates/' },
    },
    {
      name: 'components-no-features',
      severity: 'error',
      comment:
        'The global UI kit must not depend on a feature. Lift the shared piece up, or keep the component inside the feature. GRANDFATHERED: the two modules in pathNot pre-date the rule (see docs/harness/JOURNAL-ECHECS.md, entry J-014) — do not add to that list, move the code instead.',
      from: { path: '^src/components/' },
      to: {
        path: '^src/features/',
        pathNot: [
          '^src/features/POI/utils/poiIcons\\.ts$',
          '^src/features/Session/hooks/useGeocodeQuery\\.ts$',
        ],
      },
    },
    {
      name: 'no-cross-feature-screen-import',
      severity: 'error',
      comment:
        'A feature must not import another feature screen or feature-local util. Cross-feature HOOK reuse is allowed on purpose (useAuth, useBiometricLock, useSessionShare are app-wide) — see docs/harness/JOURNAL-ECHECS.md, entry J-016.',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/(screens|utils)/',
        pathNot: '^src/features/$1/',
      },
    },

    // ---------------------------------------------------------------------
    // 6. Structural hygiene
    // ---------------------------------------------------------------------
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependency: break the cycle (extract the shared part).',
      from: { path: '^src/' },
      to: { circular: true, path: '^src/' },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },

    // Architecture rules apply to production code only: co-located tests are
    // allowed to reach for the DI container and for adapters in order to mock them.
    exclude: {
      path: ['\\.test\\.tsx?$', '^src/test-utils/', '^src/types/', '\\.d\\.ts$'],
    },

    // Cycle detection must stay inside our own code.

    // Resolve the @features / @services / ... aliases and see type-only imports.
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['require', 'node', 'import', 'default', 'react-native'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    moduleSystems: ['es6', 'cjs'],
    reporterOptions: { text: { highlightFocused: true } },
  },
};

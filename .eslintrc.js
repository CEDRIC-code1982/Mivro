// Mivro lint configuration.
//
// This file IS the enforcement of the mechanisable CLAUDE.md rules. Each block
// below names the rule it mechanises, so CLAUDE.md does not have to repeat it.
// Architectural boundaries live in .dependency-cruiser.js (npm run check:arch);
// banned escape hatches live in scripts/check-diff.sh (npm run check:diff).
//
// See docs/harness/INVENTAIRE.md for the mechanisable/non-mechanisable split
// and docs/harness/JOURNAL-ECHECS.md for why each exemption exists.

// A dynamic import or require with a computed specifier is invisible to
// dependency-cruiser: `import(ADAPTER)` crossed a layer boundary with check:arch
// green (JOURNAL J-035).
const DYNAMIC_MODULE_SELECTORS = [
  {
    selector: "ImportExpression[source.type!='Literal']",
    message:
      'Dynamic import with a computed specifier: check:arch cannot see it. Use a static import, or a literal path.',
  },
  {
    selector: "CallExpression[callee.name='require'][arguments.0.type!='Literal']",
    message:
      'require() with a computed specifier: check:arch cannot see it. Use a static import, or a literal path.',
  },
];

module.exports = {
  root: true,

  // Inline configuration comments (a rule set to off in a block comment, or a
  // disable directive) are ignored: a single one at the top of a file switched every rule off for
  // that file, with lint and check-diff green (JOURNAL J-031). An exemption now
  // lives in this file, where it is reviewed and locked.
  noInlineConfig: true,

  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'docs-site/build/',
    'docs-site/.docusaurus/',
    'docs-site/node_modules/',
    'ios/',
    'android/',
    'vendor/',
    '.claude/worktrees/',
  ],

  extends: [
    '@react-native',
    'plugin:import/typescript',
    'plugin:react-native-a11y/basic',
    'prettier',
  ],
  plugins: ['import', 'jsdoc', 'react-native-a11y', 'local-rules'],
  rules: {
    // ── TS-001 — `any` forbidden ────────────────────────────────────────────
    '@typescript-eslint/no-explicit-any': 'error',

    // Every TypeScript suppression comment is banned, the expect-error form included:
    // it silenced a real type error with tsc, lint and check-diff green
    // (JOURNAL J-031).
    '@typescript-eslint/ban-ts-comment': [
      'error',
      { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
    ],
    // `Function` and `Object` are `any` in disguise.
    '@typescript-eslint/no-unsafe-function-type': 'error',
    '@typescript-eslint/no-wrapper-object-types': 'error',

    // ── TS-002 — a type assertion needs a justifying comment ────────────────
    // The comment must say something: eslint-rules/justification.js.
    'local-rules/no-unjustified-type-assertion': 'error',

    // `x as unknown as T` defeats the type checker entirely; in production
    // code, validate with Zod or write a type guard instead (TS-004).
    'no-restricted-syntax': [
      'error',
      ...DYNAMIC_MODULE_SELECTORS,
      {
        selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
        message:
          'Double assertion (as unknown as T) is banned in production code. Parse with a Zod schema or narrow with a type guard (TS-004).',
      },
    ],

    // ── TS-003 — a non-null assertion needs a justifying comment ────────────
    // Replaces @typescript-eslint/no-non-null-assertion, which cannot express
    // the "unless justified" half of the rule.
    '@typescript-eslint/no-non-null-assertion': 'off',
    'local-rules/no-unjustified-non-null': 'error',

    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // ── I18N-001 — no hardcoded string ──────────────────────────────────────
    // Catches raw text inside JSX. Strings passed as props still need a human
    // eye, which is the reviewer's job (see .claude/agents/reviewer.md).
    'react-native/no-raw-text': 'error',

    // ── LOG-001 — imposed log prefix ────────────────────────────────────────
    'local-rules/log-format': 'error',

    // ── DS-001 — no magic number, everything through theme tokens ───────────
    'local-rules/no-magic-style-values': 'error',
    'react-native/no-color-literals': 'error',

    // ── DS-002 — StyleSheet.create(), never inline styles ───────────────────
    'react-native/no-inline-styles': 'error',

    // ── DOC-001 / DOC-002 — TSDoc on the public API ─────────────────────────
    // Only the rules that carry signal are enabled: the recommended preset also
    // brings jsdoc/tag-lines and friends (500+ purely cosmetic reports).
    'jsdoc/require-jsdoc': [
      'error',
      {
        publicOnly: true,
        require: {
          FunctionDeclaration: true,
          ClassDeclaration: true,
          MethodDefinition: false,
          ArrowFunctionExpression: true,
          FunctionExpression: true,
        },
        // A constructor is documented through its class, which is where the
        // codebase already puts the @param tags.
        contexts: ['MethodDefinition[kind!="constructor"]'],
      },
    ],
    'jsdoc/require-param': ['error', { checkDestructured: false, checkDestructuredRoots: false }],
    'jsdoc/check-param-names': ['error', { checkDestructured: false }],
    'jsdoc/require-returns': 'error',
    'jsdoc/require-returns-check': 'error',
    // @remarks and @format are TSDoc / Prettier tags the codebase relies on.
    'jsdoc/check-tag-names': ['error', { definedTags: ['remarks', 'format'] }],

    // ── A11Y-003 — accessibility props ──────────────────────────────────────
    // plugin:react-native-a11y/basic covers label + role + valid state/value.
    // has-accessibility-hint is OFF: 46 pre-existing gaps, and a hint is
    // user-facing copy, so it stays a reviewer + product call (JOURNAL J-013).
    'react-native-a11y/has-accessibility-hint': 'off',

    // ── Import ordering ─────────────────────────────────────────────────────
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@/**', group: 'internal' },
          { pattern: '@features/**', group: 'internal' },
          { pattern: '@services/**', group: 'internal' },
          { pattern: '@components/**', group: 'internal' },
          { pattern: '@state/**', group: 'internal' },
          { pattern: '@entities/**', group: 'internal' },
          { pattern: '@theme/**', group: 'internal' },
          { pattern: '@hooks/**', group: 'internal' },
          { pattern: '@navigations/**', group: 'internal' },
          { pattern: '@test-utils/**', group: 'internal' },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'never',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },

  overrides: [
    {
      // Tests and test helpers.
      //
      // TS-002 is off here on purpose: `err as CustomError` after a throw,
      // `fn as jest.Mock` and `'bad' as never` fixtures are the standard
      // idioms, and demanding a comment on each of the 127 sites would be
      // noise, not safety (JOURNAL J-015). A cast to `any` stays forbidden
      // through no-explicit-any and check-diff.
      //
      // TSDoc is not required on test bodies either, and LOG-001 targets
      // application logs: a test file would be asked for a [Name.test] prefix.
      //
      // Test hygiene is enforced as errors, not warnings: a focused or skipped
      // test passed `jest --ci` silently (JOURNAL J-032).
      files: ['**/*.test.ts', '**/*.test.tsx', 'src/test-utils/**'],
      rules: {
        'jest/no-focused-tests': 'error',
        'jest/no-disabled-tests': 'error',
        'jest/no-commented-out-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/valid-expect': 'error',
        'jest/expect-expect': [
          'error',
          { assertFunctionNames: ['expect', 'expect*', 'assert*', '*.expect*'] },
        ],
        // Mocks legitimately use `as unknown as jest.Mocked<T>`; dynamic
        // specifiers stay banned.
        'no-restricted-syntax': ['error', ...DYNAMIC_MODULE_SELECTORS],
        'local-rules/no-unjustified-type-assertion': 'off',
        'local-rules/log-format': 'off',
        'jsdoc/require-jsdoc': 'off',
        'jsdoc/require-param': 'off',
        'jsdoc/require-returns': 'off',
        'jsdoc/check-param-names': 'off',
      },
    },
    {
      // Node-side JavaScript: config files, the Jest setup, custom ESLint
      // rules, Cloud Functions. Linted since J-035 (functions/index.js had
      // errors nobody saw). No TSDoc requirement on config objects.
      files: ['*.js', 'eslint-rules/**/*.js', 'functions/**/*.js', 'scripts/**/*.js'],
      env: { node: true },
      rules: {
        'local-rules/log-format': 'off',
      },
    },
    {
      files: ['jest.setup.js'],
      env: { jest: true },
      rules: {
        'jsdoc/require-jsdoc': 'off',
      },
    },
    {
      // Ambient declarations mirror a third-party API: documenting each member
      // would duplicate the upstream docs.
      files: ['**/*.d.ts'],
      rules: {
        'jsdoc/require-jsdoc': 'off',
        'jsdoc/require-param': 'off',
        'jsdoc/require-returns': 'off',
      },
    },
  ],

  settings: {
    'import/resolver': {
      'babel-module': {},
    },
  },
};

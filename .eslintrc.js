// Mivro lint configuration.
//
// This file IS the enforcement of the mechanisable CLAUDE.md rules. Each block
// below names the rule it mechanises, so CLAUDE.md does not have to repeat it.
// Architectural boundaries live in .dependency-cruiser.js (npm run check:arch);
// banned escape hatches live in scripts/check-diff.sh (npm run check:diff).
//
// See docs/harness/INVENTAIRE.md for the mechanisable/non-mechanisable split
// and docs/harness/JOURNAL-ECHECS.md for why each exemption exists.

module.exports = {
  root: true,
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

    // ── TS-002 — a type assertion needs a justifying comment ────────────────
    'local-rules/no-unjustified-type-assertion': 'error',

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
      files: ['**/*.test.ts', '**/*.test.tsx', 'src/test-utils/**'],
      rules: {
        'local-rules/no-unjustified-type-assertion': 'off',
        'local-rules/log-format': 'off',
        'jsdoc/require-jsdoc': 'off',
        'jsdoc/require-param': 'off',
        'jsdoc/require-returns': 'off',
        'jsdoc/check-param-names': 'off',
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

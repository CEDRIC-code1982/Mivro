// [MODIFIED] Extended ESLint config per CLAUDE.md rules
module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:import/typescript', 'prettier'],
  plugins: ['import'],
  rules: {
    // TS-001 — any interdit
    '@typescript-eslint/no-explicit-any': 'error',
    // TS-003 — non-null assertion interdite
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // DS-002 — pas de styles inline
    'react-native/no-inline-styles': 'error',
    // I18N — warn sur les strings brutes (sera error après i18n complet)
    'react-native/no-raw-text': 'warn',
    // Import ordering
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
          { pattern: '@/**', group: 'internal' },
          { pattern: '@core/**', group: 'internal' },
          { pattern: '@infrastructure/**', group: 'internal' },
          { pattern: '@presentation/**', group: 'internal' },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'never',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },
  settings: {
    'import/resolver': {
      'babel-module': {},
    },
  },
};

// [MODIFIED] Jest config per CLAUDE.md — aliases, coverage thresholds, setup
module.exports = {
  preset: '@react-native/jest-preset',

  // [ADDED] Path aliases — mirrors tsconfig.json paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@presentation/(.*)$': '<rootDir>/src/presentation/$1',
  },

  // [ADDED] Transform ESM packages that Jest cannot parse out of the box
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|uuid|@react-native-community)/)',
  ],

  // [ADDED] Ignore test helpers (not test suites)
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/__tests__/helpers/'],

  // [ADDED] Setup file for RNTL matchers and global mocks
  // [MODIFIED] setupFilesAfterEnv — expect must be available for jest-native matchers
  setupFilesAfterEnv: ['./jest.setup.js'],

  // [ADDED] Coverage thresholds per CLAUDE.md
  coverageThreshold: {
    'src/core/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'src/infrastructure/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    'src/presentation/': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // [ADDED] Coverage collection
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/__tests__/**',
    '!src/**/index.ts',
  ],
};

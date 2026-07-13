// [MODIFIED] Jest config per CLAUDE.md — aliases, coverage thresholds, setup
module.exports = {
  preset: '@react-native/jest-preset',

  // [ADDED] Path aliases — mirrors tsconfig.json paths
  moduleNameMapper: {
    '^@features$': '<rootDir>/src/features',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@services$': '<rootDir>/src/services',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@components$': '<rootDir>/src/components',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@state$': '<rootDir>/src/state',
    '^@state/(.*)$': '<rootDir>/src/state/$1',
    '^@entities$': '<rootDir>/src/entities',
    '^@entities/(.*)$': '<rootDir>/src/entities/$1',
    '^@theme$': '<rootDir>/src/theme',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@hooks$': '<rootDir>/src/hooks',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@navigations$': '<rootDir>/src/navigations',
    '^@navigations/(.*)$': '<rootDir>/src/navigations/$1',
    '^@test-utils$': '<rootDir>/src/test-utils',
    '^@test-utils/(.*)$': '<rootDir>/src/test-utils/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // [ADDED] Transform ESM packages that Jest cannot parse out of the box
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*|uuid|@react-native-community)/)',
  ],

  // [ADDED] Ignore test helpers (not test suites)
  // [MODIFIED] helpers moved to src/test-utils/ (co-located tests migration)
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/test-utils/'],

  // [ADDED] Setup file for RNTL matchers and global mocks
  // [MODIFIED] setupFilesAfterEnv — expect must be available for jest-native matchers
  setupFilesAfterEnv: ['./jest.setup.js'],

  // [ADDED] Coverage thresholds per CLAUDE.md
  // [MODIFIED] keys remapped to feature-first + services/ architecture
  //   ex-core (90) -> entities + services/domain + services/utils + theme
  //   ex-infrastructure (70) -> services/infra
  //   ex-presentation (50) -> features + components + state + hooks + navigations
  coverageThreshold: {
    'src/entities/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    'src/services/domain/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    'src/services/utils/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    'src/theme/': { branches: 90, functions: 90, lines: 90, statements: 90 },
    'src/services/infra/': { branches: 70, functions: 70, lines: 70, statements: 70 },
    'src/features/': { branches: 50, functions: 50, lines: 50, statements: 50 },
    'src/components/': { branches: 50, functions: 50, lines: 50, statements: 50 },
    'src/state/': { branches: 50, functions: 50, lines: 50, statements: 50 },
    'src/hooks/': { branches: 50, functions: 50, lines: 50, statements: 50 },
    'src/navigations/': { branches: 50, functions: 50, lines: 50, statements: 50 },
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },

  // [ADDED] Coverage collection
  // [MODIFIED] tests are now co-located; exclude test-utils (helpers) instead of __tests__
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/test-utils/**',
    '!src/**/index.ts',
  ],
};

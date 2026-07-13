module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // [ADDED] Path aliases — mirrors tsconfig.json paths
  plugins: [
    '@babel/plugin-transform-export-namespace-from', // [ADDED] Required by zod v4 (export * as)
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@features': './src/features',
          '@services': './src/services',
          '@components': './src/components',
          '@state': './src/state',
          '@entities': './src/entities',
          '@theme': './src/theme',
          '@hooks': './src/hooks',
          '@navigations': './src/navigations',
          '@test-utils': './src/test-utils',
        },
      },
    ],
    'react-native-reanimated/plugin', // [ADDED] Must be LAST plugin (required by reanimated)
  ],
};

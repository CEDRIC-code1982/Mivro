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
          '@core': './src/core',
          '@infrastructure': './src/infrastructure',
          '@presentation': './src/presentation',
        },
      },
    ],
  ],
};

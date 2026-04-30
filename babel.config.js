module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // [ADDED] Path aliases — mirrors tsconfig.json paths
  plugins: [
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

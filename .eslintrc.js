module.exports = {
  root: true,

  extends: ['@metamask/eslint-config'],

  rules: {
    'prefer-object-spread': 'off',
  },

  overrides: [
    {
      files: ['*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
    },

    {
      files: ['*.js'],
      parserOptions: {
        sourceType: 'script',
      },
      extends: ['@metamask/eslint-config-nodejs'],
    },

    {
      files: ['test/*'],
      extends: ['@metamask/eslint-config-mocha'],
    },
  ],

  ignorePatterns: ['!.eslintrc.js', '.nyc*', 'coverage/', 'dist/'],
};

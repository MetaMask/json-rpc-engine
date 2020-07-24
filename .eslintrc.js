module.exports = {
  root: true,

  parserOptions: {
    ecmaVersion: 2018,
  },

  plugins: [
    'json',
    'import',
  ],

  extends: [
    '@metamask/eslint-config',
    '@metamask/eslint-config/config/mocha',
    '@metamask/eslint-config/config/nodejs',
  ],

  overrides: [{
    files: [
      '.eslintrc.js',
    ],
    parserOptions: {
      sourceType: 'script',
    },
  }],
}

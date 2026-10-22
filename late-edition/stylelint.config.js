export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['node_modules/**', 'tests/fixtures/**'],
  plugins: ['./scripts/stylelint-palette.js'],
  rules: {
    'color-hex-length': 'long',
    'color-named': 'never',
    'late-edition/palette': true,
  },
};

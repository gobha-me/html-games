import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'tests/fixtures/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-unused-vars': 'error',
      eqeqeq: ['error', 'always'],
      'no-implicit-globals': 'error',
    },
  },
  {
    files: ['js/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['js/sim.js', 'js/physics.js'],
    rules: {
      'no-restricted-globals': ['error', 'Date', 'window', 'document', 'localStorage', 'performance'],
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'Use the injected seeded RNG.' },
        ...['Date', 'window', 'document', 'localStorage', 'performance'].map((property) => ({
          object: 'globalThis', property, message: 'Use an injected adapter.',
        })),
      ],
    },
  },
  {
    files: ['*.{js,mjs}', 'tests/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
];

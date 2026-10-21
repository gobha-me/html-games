import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'tests/fixtures/**'] },
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
    files: ['*.{js,mjs}', 'tests/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
];

// Optional mutation check; normal tests use only Node's built-in modules.
export default {
  mutate: ['js/{state,game,controls}.js'],
  ignorePatterns: ['**', '!js/*.js', '!tests/*.mjs'],
  testRunner: 'command',
  commandRunner: { command: 'node --test --test-concurrency=2 tests/*.test.mjs' },
  coverageAnalysis: 'off',
  concurrency: 2,
  timeoutMS: 2000,
  timeoutFactor: 1.5,
  reporters: ['clear-text', 'json'],
  jsonReporter: { fileName: 'reports/mutation.json' },
  cleanTempDir: true,
};

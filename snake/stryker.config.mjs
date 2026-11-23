// Optional mutation check; the normal node:test suite has no dependencies.
export default {
  mutate: ['js/{state,snake,food,controls,multiplayer}.js'],
  ignorePatterns: ['**', '!js/*.js', '!tests/*.mjs'],
  testRunner: 'command',
  commandRunner: { command: 'node --test --test-concurrency=2 tests/*.test.mjs' },
  coverageAnalysis: 'off',
  concurrency: 2,
  timeoutMS: 1000,
  timeoutFactor: 1.5,
  reporters: ['clear-text', 'json'],
  jsonReporter: { fileName: 'reports/mutation.json' },
  cleanTempDir: true,
};

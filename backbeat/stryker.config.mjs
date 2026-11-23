// Optional mutation check of browser-independent JS; Python is tested separately.
export default {
  mutate: ['js/{config,game,chart}.js'],
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

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export const base = {
  testRunner: 'tap',
  plugins: ['@stryker-mutator/tap-runner'],
  coverageAnalysis: 'off',
  ignorePatterns: [
    'e2e', 'playwright-report', 'test-results', 'performance-results',
    'reports', '.stryker-tmp', 'node_modules',
  ],
  reporters: ['clear-text', 'progress', 'json'],
  dryRunTimeoutMinutes: 30,
  timeoutFactor: 2,
  timeoutMS: 60000,
  concurrency: 2,
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  incremental: false,
};

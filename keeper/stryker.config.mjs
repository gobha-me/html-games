// Default `npm run test:mutation`: core game logic against the whole node:test suite.
// Shares its incremental file with stryker.quick.config.mjs, so running quick first
// seeds this run and only mutants the quick pass could not kill are retried here.
import { base, coreLogic, allTests } from './stryker.base.mjs';

export default {
  ...base,
  mutate: coreLogic,
  tap: { testFiles: allTests },
  incrementalFile: 'reports/stryker-incremental-core.json',
  htmlReporter: { fileName: 'reports/mutation/core.html' },
  jsonReporter: { fileName: 'reports/mutation/core.json' },
};

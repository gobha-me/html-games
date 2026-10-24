// Fast pass: core game logic without the two 500-seed spawn sweeps (minutes, not hours).
// Its score is a lower bound; run stryker.config.mjs afterwards for the real core score.
import { base, coreLogic, fastTests } from './stryker.base.mjs';

export default {
  ...base,
  mutate: coreLogic,
  tap: { testFiles: fastTests },
  incrementalFile: 'reports/stryker-incremental-core.json',
  htmlReporter: { fileName: 'reports/mutation/quick.html' },
  jsonReporter: { fileName: 'reports/mutation/quick.json' },
};

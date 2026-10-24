// Full run: every Keeper module (including renderer/main/audio glue) against every suite.
// Slow (many hours on 16 workers); use for occasional audits, not CI.
import { base, allTests } from './stryker.base.mjs';

export default {
  ...base,
  mutate: ['js/**/*.js'],
  tap: { testFiles: allTests },
  incrementalFile: 'reports/stryker-incremental-full.json',
  htmlReporter: { fileName: 'reports/mutation/full.html' },
  jsonReporter: { fileName: 'reports/mutation/full.json' },
};

// CI shard config, driven by scripts/mutation-ci-shard.mjs through environment variables
// (the Stryker CLI cannot set nested reporter options, so the script can't pass them as flags).
//   STRYKER_MUTATE       JSON array of mutate globs/ranges for this shard (required)
//   STRYKER_TESTS        "fast" (default: every suite but the 500-seed spawn sweeps) or "all"
//   STRYKER_REPORT       JSON report path (default reports/mutation/ci.json)
//   STRYKER_INCREMENTAL  incremental file path; unset disables incremental mode
//   STRYKER_CONCURRENCY  worker count (default from stryker.base.mjs)
// The break threshold is enforced over all shards by scripts/mutation-score.mjs, not per shard.
import { base, fastTests, allTests } from './stryker.base.mjs';

const env = process.env;
if (!env.STRYKER_MUTATE) throw new Error('STRYKER_MUTATE (JSON array of mutate ranges) is required');
const mutate = JSON.parse(env.STRYKER_MUTATE);
if (!Array.isArray(mutate) || mutate.length === 0) throw new Error('STRYKER_MUTATE must be a non-empty JSON array');
const tests = env.STRYKER_TESTS ?? 'fast';
if (tests !== 'fast' && tests !== 'all') throw new Error(`STRYKER_TESTS must be "fast" or "all", got "${tests}"`);

export default {
  ...base,
  mutate,
  tap: { testFiles: tests === 'all' ? allTests : fastTests },
  reporters: ['clear-text', 'progress', 'json'],
  jsonReporter: { fileName: env.STRYKER_REPORT ?? 'reports/mutation/ci.json' },
  incremental: Boolean(env.STRYKER_INCREMENTAL),
  ...(env.STRYKER_INCREMENTAL ? { incrementalFile: env.STRYKER_INCREMENTAL } : {}),
  ...(env.STRYKER_CONCURRENCY ? { concurrency: Number(env.STRYKER_CONCURRENCY) } : {}),
  thresholds: { high: 92, low: 85, break: null },
};

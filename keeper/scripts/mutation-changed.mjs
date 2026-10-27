#!/usr/bin/env node
/** CI helper: require ≥90% kills and ≤20% timeouts. Exit 0 PASS, 1 FAIL, 2 INCONCLUSIVE. */
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { changedFiles, scoreReport, MAX_TIMEOUT_RATIO } from './mutation-gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function formatCounts(counts) {
  const timeoutPct = counts.total ? (100 * counts.timedOut) / counts.total : 0;
  return `${Object.entries(counts).map(([key, count]) => `${key}=${count}`).join(' ')} timeouts=${timeoutPct.toFixed(2)}%`
    + ` errors: runtimeError=${counts.runtimeError} compileError=${counts.compileError} (excluded from score)`;
}

export function main() {
  const min = Number(process.env.MUTATION_MIN || 90);
  if (!Number.isFinite(min) || min < 0 || min > 100) {
    console.error('mutation-changed: FAIL MUTATION_MIN must be between 0 and 100');
    return 1;
  }
  const baseName = process.env.GITHUB_BASE_REF || 'main';
  const baseRef = baseName.startsWith('origin/') ? baseName : `origin/${baseName}`;
  const changed = changedFiles({ cwd: ROOT, baseRef });
  if (!changed.ok) {
    console.error(`mutation-changed: FAIL ${changed.error}`);
    return 1;
  }
  if (changed.warning) console.warn(`mutation-changed: ${changed.warning}; using resolved local ${baseRef}`);
  const mutate = changed.files;
  if (mutate.length === 0) {
    console.log(`mutation-changed: no keeper/js changes vs ${baseRef} — skip (pass)`);
    return 0;
  }

  console.log(`mutation-changed: mutating ${mutate.join(', ')} min=${min}%`);
  writeFileSync(resolve(ROOT, 'stryker.changed.ci.mjs'), `import { base } from './stryker.base.mjs';
export default {
  ...base,
  mutate: ${JSON.stringify(mutate)},
  tap: { testFiles: ['tests/*.test.mjs'] },
  jsonReporter: { fileName: 'reports/mutation/changed.json' },
  thresholds: { high: ${min}, low: ${min}, break: ${min} },
};
`);
  mkdirSync(resolve(ROOT, 'reports/mutation'), { recursive: true });
  const report = resolve(ROOT, 'reports/mutation/changed.json');
  rmSync(report, { force: true });
  const run = spawnSync('npx', ['stryker', 'run', 'stryker.changed.ci.mjs'], {
    cwd: ROOT, stdio: 'inherit', encoding: 'utf8',
  });
  if (!existsSync(report)) {
    console.error('mutation-changed: FAIL missing Stryker report');
    return 1;
  }
  let result;
  try {
    result = scoreReport(JSON.parse(readFileSync(report, 'utf8')), { min });
  } catch (error) {
    console.error(`mutation-changed: FAIL invalid Stryker report: ${error.message}`);
    return 1;
  }
  for (const [path, counts] of Object.entries(result.files)) {
    console.log(`mutation-changed: file=${path} ${formatCounts(counts)}`);
  }
  console.log(`mutation-changed: score=${result.score.toFixed(2)}% ${formatCounts(result.totals)}`);
  if (result.verdict === 'INCONCLUSIVE') {
    console.error(`mutation-changed: INCONCLUSIVE timeouts ${(100 * result.timeoutRatio).toFixed(2)}% > ${100 * MAX_TIMEOUT_RATIO}%`);
    return 2;
  }
  if (!result.pass) {
    console.error(`mutation-changed: FAIL below ${min}%`);
    return 1;
  }
  if (run.status !== 0 || run.error) {
    console.error(`mutation-changed: FAIL Stryker ${run.error?.message || `exited ${run.status}`}`);
    return 1;
  }
  console.log(`mutation-changed: PASS ≥${min}%`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`mutation-changed: FAIL ${error.message}`);
    process.exitCode = 1;
  }
}

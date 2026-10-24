/* global console, process -- Node CLI script; eslint.config.js only declares browser/test globals. */
// One CI mutation shard: the same two-pass method as docs/keeper-mutation-report.md.
//  1. quick pass: the shard's mutants against every suite except the two 500-seed spawn sweeps
//     (incremental, so a cached report only re-tests mutants whose code or tests changed);
//  2. survivor pass: only the spans holding quick-pass Survived/NoCoverage mutants, against the
//     whole suite;
//  3. merge: a quick-pass survivor the survivor pass killed (or timed out) counts as detected.
// Writes reports/mutation/shard-<name>.json for scripts/mutation-score.mjs.
// Usage: node scripts/mutation-ci-shard.mjs <name> '<json mutate array>' <expectedMutants>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [name, mutateJson, expectedArg] = process.argv.slice(2);
if (!name || !/^[\w.+-]+$/.test(name) || !mutateJson) {
  console.error('usage: node scripts/mutation-ci-shard.mjs <name> <json mutate array> [expected]');
  process.exit(2);
}
const expected = expectedArg === undefined ? null : Number(expectedArg);
mkdirSync('reports/mutation', { recursive: true });
const quickReport = `reports/mutation/shard-${name}-quick.json`;
const survivorReport = `reports/mutation/shard-${name}-survivors.json`;

function stryker(env) {
  const r = spawnSync('npx', ['stryker', 'run', 'stryker.ci.config.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    console.error(`stryker exited with ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

const key = (file, m) => `${file}|${m.location.start.line}:${m.location.start.column}|${m.location.end.line}:${m.location.end.column}|${m.mutatorName}|${m.replacement}`;
const live = (s) => s === 'Survived' || s === 'NoCoverage';

stryker({
  STRYKER_MUTATE: mutateJson,
  STRYKER_TESTS: 'fast',
  STRYKER_REPORT: quickReport,
  STRYKER_INCREMENTAL: `reports/stryker-incremental-${name}.json`,
});
const quick = JSON.parse(readFileSync(quickReport, 'utf8'));

const ranges = [];
for (const [file, { mutants }] of Object.entries(quick.files)) {
  for (const m of mutants) {
    if (!live(m.status)) continue;
    const { start, end } = m.location;
    ranges.push(`${file}:${start.line}:${start.column - 1}-${end.line}:${end.column - 1}`);
  }
}

const rescued = new Map();
if (ranges.length > 0) {
  stryker({ STRYKER_MUTATE: JSON.stringify(ranges), STRYKER_TESTS: 'all', STRYKER_REPORT: survivorReport });
  const survivors = existsSync(survivorReport) ? JSON.parse(readFileSync(survivorReport, 'utf8')) : { files: {} };
  for (const [file, { mutants }] of Object.entries(survivors.files)) {
    for (const m of mutants) rescued.set(key(file, m), m.status);
  }
}

const merged = [];
for (const [file, { mutants }] of Object.entries(quick.files)) {
  for (const m of mutants) {
    let status = m.status;
    const again = rescued.get(key(file, m));
    if (live(status) && (again === 'Killed' || again === 'Timeout')) status = again;
    const { start } = m.location;
    merged.push({ file, line: start.line, column: start.column, mutator: m.mutatorName, replacement: m.replacement, status });
  }
}
if (expected !== null && merged.length !== expected) {
  console.error(`shard ${name}: Stryker reported ${merged.length} mutants, plan expected ${expected}`);
  process.exit(1);
}
writeFileSync(`reports/mutation/shard-${name}.json`, JSON.stringify({ name, expected, mutants: merged }, null, 2));
console.log(`shard ${name}: ${merged.length} mutants, ${merged.filter((m) => live(m.status)).length} live after merge`);

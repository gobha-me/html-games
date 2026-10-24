/* global console, process -- Node CLI script; eslint.config.js only declares browser/test globals. */
// Merges CI shard results (reports/mutation/shard-*.json written by mutation-ci-shard.mjs),
// prints a per-file table (also to $GITHUB_STEP_SUMMARY) and fails below the break threshold.
// Score = (killed + timeout) / (killed + timeout + survived + no coverage), Stryker's definition.
// Usage: node scripts/mutation-score.mjs <dir> <breakThreshold> [expectedTotal]
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, breakArg, expectedArg] = process.argv.slice(2);
const threshold = Number(breakArg);
if (!dir || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
  console.error('usage: node scripts/mutation-score.mjs <dir> <break 0-100> [expectedTotal]');
  process.exit(2);
}
const shardFiles = readdirSync(dir, { recursive: true })
  .map(String)
  .filter((f) => /(^|\/)shard-[^/]+\.json$/.test(f) && !/-(quick|survivors)\.json$/.test(f));
if (shardFiles.length === 0) {
  console.error(`no shard-*.json reports under ${dir}`);
  process.exit(1);
}
const perFile = new Map();
const live = [];
let total = 0;
for (const f of shardFiles) {
  const shard = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  if (shard.expected !== null && shard.mutants.length !== shard.expected) {
    console.error(`${f}: ${shard.mutants.length} mutants, expected ${shard.expected}`);
    process.exit(1);
  }
  for (const m of shard.mutants) {
    total++;
    const row = perFile.get(m.file) ?? { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0, other: 0 };
    if (m.status in row) row[m.status]++;
    else row.other++;
    perFile.set(m.file, row);
    if (m.status === 'Survived' || m.status === 'NoCoverage') live.push(m);
  }
}
if (expectedArg !== undefined && total !== Number(expectedArg)) {
  console.error(`shards reported ${total} mutants, plan expected ${expectedArg}; a shard is missing or overlapping`);
  process.exit(1);
}
const score = (r) => {
  const detected = r.Killed + r.Timeout;
  const valid = detected + r.Survived + r.NoCoverage;
  return valid === 0 ? 100 : (100 * detected) / valid;
};
const all = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0, other: 0 };
const lines = ['| File | Killed | Timeout | Survived | No cov | Errors/other | Score |', '|---|---|---|---|---|---|---|'];
for (const [file, r] of [...perFile].sort(([a], [b]) => a.localeCompare(b))) {
  for (const k of Object.keys(all)) all[k] += r[k];
  lines.push(`| ${file} | ${r.Killed} | ${r.Timeout} | ${r.Survived} | ${r.NoCoverage} | ${r.other} | ${score(r).toFixed(2)}% |`);
}
const overall = score(all);
lines.push(`| **All files** | ${all.Killed} | ${all.Timeout} | ${all.Survived} | ${all.NoCoverage} | ${all.other} | **${overall.toFixed(2)}%** |`);
lines.push('', `Break threshold: ${threshold}%. ${overall >= threshold ? 'PASS' : 'FAIL'}.`);
if (live.length > 0) {
  lines.push('', '<details><summary>Live mutants</summary>', '', '| Location | Mutator | Replacement | Status |', '|---|---|---|---|');
  for (const m of live.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
    lines.push(`| ${m.file}:${m.line} | ${m.mutator} | \`${String(m.replacement).replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 80)}\` | ${m.status} |`);
  }
  lines.push('', '</details>');
}
const text = lines.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Keeper mutation score\n\n${text}\n`);
process.exit(overall >= threshold ? 0 : 1);

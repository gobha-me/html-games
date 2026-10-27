#!/usr/bin/env node
/**
 * CI helper: mutate changed keeper/js/*.js vs base ref; require ≥90% score.
 * Exits 0 when no mutate targets. Additive gate — never weakens other checks.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIN = Number(process.env.MUTATION_MIN || 90);
const baseName = process.env.GITHUB_BASE_REF || 'main';
const baseRef = baseName.startsWith('origin/') ? baseName : `origin/${baseName}`;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: ROOT, ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    process.stderr.write(r.stderr || r.stdout || `${cmd} failed\n`);
    process.exit(r.status || 1);
  }
  return r;
}

sh('git', ['fetch', '--no-tags', '--depth=1', 'origin', baseName], { allowFail: true });

const diff = sh('git', ['diff', '--name-only', `${baseRef}...HEAD`, '--', 'js/', 'keeper/js/'], { allowFail: true });
const raw = (diff.stdout || '').split(/\n/).map((s) => s.trim()).filter(Boolean);
const mutate = [...new Set(raw.map((f) => f.replace(/^keeper\//, '')).filter((f) => /^js\/.+\.js$/.test(f)))];

if (mutate.length === 0) {
  console.log(`mutation-changed: no keeper/js changes vs ${baseRef} — skip (pass)`);
  process.exit(0);
}

console.log(`mutation-changed: mutating ${mutate.join(', ')} min=${MIN}%`);
const configPath = resolve(ROOT, 'stryker.changed.ci.mjs');
writeFileSync(configPath, `import { base } from './stryker.base.mjs';
export default {
  ...base,
  mutate: ${JSON.stringify(mutate)},
  tap: { testFiles: ['tests/*.test.mjs'] },
  jsonReporter: { fileName: 'reports/mutation/changed.json' },
  thresholds: { high: ${MIN}, low: ${MIN}, break: ${MIN} },
};
`);

mkdirSync(resolve(ROOT, 'reports/mutation'), { recursive: true });
const run = spawnSync('npx', ['stryker', 'run', 'stryker.changed.ci.mjs'], {
  cwd: ROOT, stdio: 'inherit', encoding: 'utf8',
});

const report = resolve(ROOT, 'reports/mutation/changed.json');
if (!existsSync(report)) {
  console.error('mutation-changed: missing report');
  process.exit(run.status || 1);
}
const data = JSON.parse(readFileSync(report, 'utf8'));
let killed = 0, survived = 0, timeout = 0, noCov = 0;
for (const info of Object.values(data.files || {})) {
  for (const m of info.mutants || []) {
    if (m.status === 'Killed') killed++;
    else if (m.status === 'Survived') survived++;
    else if (m.status === 'TimedOut') timeout++;
    else if (m.status === 'NoCoverage') noCov++;
  }
}
const detected = killed + timeout;
const total = detected + survived + noCov;
const score = total ? (100 * detected) / total : 100;
console.log(`mutation-changed: score=${score.toFixed(2)}% killed=${killed} timedOut=${timeout} survived=${survived} noCoverage=${noCov} total=${total}`);
if (score + 1e-9 < MIN) {
  console.error(`mutation-changed: FAIL below ${MIN}%`);
  process.exit(1);
}
console.log(`mutation-changed: PASS ≥${MIN}%`);
process.exit(0);

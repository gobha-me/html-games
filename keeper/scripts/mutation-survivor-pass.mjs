/* global console, process -- Node CLI script; eslint.config.js only declares browser/test globals. */
// Second mutation pass: re-test only the mutants the quick pass (stryker.quick.config.mjs)
// left alive (Survived / NoCoverage) against the *whole* suite, including the two slow
// 500-seed spawn sweeps. Usage: node scripts/mutation-survivor-pass.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const quick = JSON.parse(readFileSync('reports/mutation/quick.json', 'utf8'));
const ranges = [];
for (const [file, { mutants }] of Object.entries(quick.files)) {
  for (const m of mutants) {
    if (m.status !== 'Survived' && m.status !== 'NoCoverage') continue;
    const { start, end } = m.location;
    ranges.push(`${file}:${start.line}:${start.column - 1}-${end.line}:${end.column - 1}`);
  }
}
if (ranges.length === 0) {
  console.log('No live mutants after the quick pass.');
  process.exit(0);
}
writeFileSync('reports/mutation/survivor-ranges.json', JSON.stringify(ranges, null, 2));
// The Stryker CLI cannot set nested reporter options (e.g. --jsonReporter.fileName),
// so write a small config that extends stryker.config.mjs with the survivor scope.
const cfg = 'stryker.survivors.generated.mjs';
writeFileSync(cfg, `import full from './stryker.config.mjs';
export default {
  ...full,
  mutate: ${JSON.stringify(ranges)},
  htmlReporter: { fileName: 'reports/mutation/survivors.html' },
  jsonReporter: { fileName: 'reports/mutation/survivors.json' },
};
`);
const result = spawnSync('npx', ['stryker', 'run', cfg, '--force'], { stdio: 'inherit' });
process.exit(result.status ?? 1);

/* global console, process -- Node CLI script; eslint.config.js only declares browser/test globals. */
// Plans the CI mutation shards. Stryker has no native sharding, and a `--mutate` line range
// silently drops any mutant that crosses its edge (e.g. a BlockStatement spanning a function).
// So this instruments the core files with Stryker's own instrumenter, counts every mutant, and
// only cuts shards at line boundaries no mutant crosses. Each shard records how many mutants it
// must report; scripts/mutation-score.mjs fails the job if the shards don't add up.
// Usage: node scripts/mutation-plan.mjs [targetMutantsPerShard]   (prints JSON; also writes
// `matrix=` and `expected=` to $GITHUB_OUTPUT when set)
import { appendFileSync, readFileSync } from 'node:fs';
// @stryker-mutator/instrumenter is pinned by @stryker-mutator/core (same version) and declared
// as a devDependency so this import is not a phantom dependency.
import { Instrumenter } from '@stryker-mutator/instrumenter';
import { coreLogic } from '../stryker.base.mjs';

const target = Number(process.argv[2] ?? 160);
if (!Number.isInteger(target) || target < 1) {
  console.error(`target mutants per shard must be a positive integer, got ${process.argv[2]}`);
  process.exit(2);
}

const quiet = () => false;
const logger = {
  isTraceEnabled: quiet, isDebugEnabled: quiet, isInfoEnabled: quiet,
  isWarnEnabled: () => true, isErrorEnabled: () => true, isFatalEnabled: () => true,
  trace() {}, debug() {}, info() {},
  warn: (...a) => console.error(...a), error: (...a) => console.error(...a), fatal: (...a) => console.error(...a),
};
const files = coreLogic.map((name) => ({ name, content: readFileSync(name, 'utf8'), mutate: true }));
const { mutants } = await new Instrumenter(logger).instrument(files, {
  plugins: null, excludedMutations: [], ignorers: [],
});

const shards = [];
for (const file of coreLogic) {
  const own = mutants.filter((m) => m.fileName === file || m.fileName.endsWith(`/${file}`));
  if (own.length === 0) continue;
  const lineCount = files.find((f) => f.name === file).content.split('\n').length;
  // Instrumenter locations are 0-based lines; mutate ranges are 1-based and inclusive.
  const crossed = new Set();
  const startsOn = new Map();
  for (const m of own) {
    const s = m.location.start.line + 1;
    const e = m.location.end.line + 1;
    for (let l = s; l < e; l++) crossed.add(l);
    startsOn.set(s, (startsOn.get(s) ?? 0) + 1);
  }
  const base = file.replace(/^js\//, '').replace(/\.js$/, '');
  let from = 1;
  let count = 0;
  let part = 1;
  const pieces = [];
  for (let line = 1; line <= lineCount; line++) {
    count += startsOn.get(line) ?? 0;
    const last = line === lineCount;
    if (last || (count >= target && !crossed.has(line))) {
      pieces.push({ from, to: line, count });
      from = line + 1;
      count = 0;
    }
  }
  // Fold a small tail into the previous piece so we don't spin up a runner for a handful.
  if (pieces.length > 1 && pieces.at(-1).count < target / 3) {
    const tail = pieces.pop();
    pieces.at(-1).to = tail.to;
    pieces.at(-1).count += tail.count;
  }
  for (const p of pieces) {
    const name = pieces.length === 1 ? base : `${base}-${part++}`;
    shards.push({ name, mutate: [`${file}:${p.from}-${p.to}`], expected: p.count });
  }
}

// Pack tiny whole-file shards together (keys.js + record.js are a few dozen mutants each).
shards.sort((a, b) => a.expected - b.expected);
while (shards.length > 1 && shards[0].expected + shards[1].expected <= target) {
  const [a, b] = shards.splice(0, 2);
  shards.push({ name: `${a.name}+${b.name}`, mutate: [...a.mutate, ...b.mutate], expected: a.expected + b.expected });
  shards.sort((x, y) => x.expected - y.expected);
}
shards.sort((a, b) => a.name.localeCompare(b.name));

const total = shards.reduce((n, s) => n + s.expected, 0);
if (total !== mutants.length) {
  console.error(`shard plan covers ${total} of ${mutants.length} mutants`);
  process.exit(1);
}
const plan = { total, shards };
console.log(JSON.stringify(plan, null, 2));
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include: shards })}\nexpected=${total}\n`);
}

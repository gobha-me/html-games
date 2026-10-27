import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_TIMEOUT_RATIO, changedFiles, scoreReport } from '../scripts/mutation-gate.mjs';
import { main } from '../scripts/mutation-changed.mjs';

const GATE_SCRIPT = fileURLToPath(new URL('../scripts/mutation-gate.mjs', import.meta.url));
const CLI_SCRIPT = fileURLToPath(new URL('../scripts/mutation-changed.mjs', import.meta.url));

function makeMutants(spec) {
  const mutants = [];
  for (const [status, count] of Object.entries(spec)) {
    for (let index = 0; index < count; index++) {
      mutants.push({ id: `${status}-${index}`, status });
    }
  }
  return mutants;
}

function makeReport(fileSpecs) {
  const files = {};
  for (const [path, spec] of Object.entries(fileSpecs)) {
    files[path] = { mutants: makeMutants(spec) };
  }
  return { files };
}

function withTempDir(prefix, fn) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function gitIn(cwd, args) {
  const res = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test Author',
      GIT_AUTHOR_EMAIL: 'test@agent.invalid',
      GIT_COMMITTER_NAME: 'Test Author',
      GIT_COMMITTER_EMAIL: 'test@agent.invalid',
    },
  });
  assert.equal(res.status, 0, `git ${args.join(' ')} failed: ${res.stderr}`);
  return res;
}

test('scoreReport (a): timeouts never count as killed and all seven statuses are accounted exactly', () => {
  // 85 killed + 10 timedOut + 5 survived:
  // Stryker's own (killed + timedOut) / total score would be 95% (PASS at min 90),
  // but the gate must compute 85% and FAIL.
  const strykerWouldPass = makeReport({
    'js/sim.js': { Killed: 85, TimedOut: 10, Survived: 5 },
  });
  const res85 = scoreReport(strykerWouldPass);
  assert.equal(res85.score, 85);
  assert.equal(res85.timeoutRatio, 0.1);
  assert.equal(res85.verdict, 'FAIL');
  assert.equal(res85.pass, false);
  const expectedCounts85 = {
    killed: 85,
    timedOut: 10,
    survived: 5,
    noCoverage: 0,
    compileError: 0,
    runtimeError: 0,
    ignored: 0,
    total: 100,
  };
  assert.deepEqual(res85.totals, expectedCounts85);
  assert.deepEqual(res85.files['js/sim.js'], expectedCounts85);

  // 9 killed + 1 timedOut: score is strictly 90% (9/10), not 100% (10/10).
  // Passes at min=90, but fails at min=90.01 or min=91 where 10/10 would pass.
  const nineAndOne = makeReport({
    'js/morse.js': { Killed: 9, TimedOut: 1 },
  });
  const at90 = scoreReport(nineAndOne, { min: 90 });
  assert.equal(at90.score, 90);
  assert.equal(at90.timeoutRatio, 0.1);
  assert.equal(at90.verdict, 'PASS');
  assert.equal(at90.pass, true);
  assert.equal(at90.totals.killed, 9);
  assert.equal(at90.totals.timedOut, 1);
  assert.equal(at90.totals.survived, 0);
  assert.equal(at90.totals.total, 10);

  const at90Point01 = scoreReport(nineAndOne, { min: 90.01 });
  assert.equal(at90Point01.score, 90);
  assert.equal(at90Point01.verdict, 'FAIL');
  assert.equal(at90Point01.pass, false);

  // 8 killed + 1 timedOut: 88.89% -> FAIL at default min=90 (Stryker's 9/9=100% would PASS).
  const eightAndOne = scoreReport(makeReport({ 'js/physics.js': { Killed: 8, TimedOut: 1 } }));
  assert.ok(Math.abs(eightAndOne.score - (800 / 9)) < 1e-12);
  assert.equal(eightAndOne.verdict, 'FAIL');
  assert.equal(eightAndOne.pass, false);

  // All-timeout report: 0% score, pass false (INCONCLUSIVE at default 20% cap, FAIL at cap=1).
  const allTimeouts = makeReport({ 'js/sim.js': { TimedOut: 10 } });
  const allTimeoutDefault = scoreReport(allTimeouts);
  assert.equal(allTimeoutDefault.score, 0);
  assert.equal(allTimeoutDefault.timeoutRatio, 1);
  assert.equal(allTimeoutDefault.verdict, 'INCONCLUSIVE');
  assert.equal(allTimeoutDefault.pass, false);
  assert.equal(allTimeoutDefault.totals.killed, 0);
  assert.equal(allTimeoutDefault.totals.timedOut, 10);
  assert.equal(allTimeoutDefault.totals.total, 10);

  const allTimeoutCap1 = scoreReport(allTimeouts, { maxTimeoutRatio: 1 });
  assert.equal(allTimeoutCap1.score, 0);
  assert.equal(allTimeoutCap1.verdict, 'FAIL');
  assert.equal(allTimeoutCap1.pass, false);

  // Sub-20% timeouts with zero kills: 0% score, FAIL.
  const zeroKillsSub20 = scoreReport(makeReport({ 'js/sim.js': { TimedOut: 15, Survived: 85 } }));
  assert.equal(zeroKillsSub20.score, 0);
  assert.equal(zeroKillsSub20.timeoutRatio, 0.15);
  assert.equal(zeroKillsSub20.verdict, 'FAIL');
  assert.equal(zeroKillsSub20.pass, false);

  // All seven statuses with distinct counts: CompileError, RuntimeError, Ignored excluded from total.
  const sevenDistinct = makeReport({
    'js/sim.js': {
      Killed: 7,
      TimedOut: 2,
      Survived: 3,
      NoCoverage: 4,
      CompileError: 5,
      RuntimeError: 6,
      Ignored: 8,
    },
  });
  const resSeven = scoreReport(sevenDistinct);
  const expectedSeven = {
    killed: 7,
    timedOut: 2,
    survived: 3,
    noCoverage: 4,
    compileError: 5,
    runtimeError: 6,
    ignored: 8,
    total: 16,
  };
  assert.deepEqual(resSeven.totals, expectedSeven);
  assert.deepEqual(resSeven.files['js/sim.js'], expectedSeven);
  assert.equal(resSeven.score, 43.75);
  assert.equal(resSeven.timeoutRatio, 0.125);
  assert.equal(resSeven.verdict, 'FAIL');
  assert.equal(resSeven.pass, false);

  // One of each of the seven statuses: total=4, score=25%, timeoutRatio=0.25 -> INCONCLUSIVE.
  const oneOfEach = scoreReport(makeReport({
    'js/sim.js': {
      Killed: 1,
      TimedOut: 1,
      Survived: 1,
      NoCoverage: 1,
      CompileError: 1,
      RuntimeError: 1,
      Ignored: 1,
    },
  }));
  assert.equal(oneOfEach.totals.total, 4);
  assert.equal(oneOfEach.score, 25);
  assert.equal(oneOfEach.timeoutRatio, 0.25);
  assert.equal(oneOfEach.verdict, 'INCONCLUSIVE');
  assert.equal(oneOfEach.pass, false);

  // Multi-file aggregation: 1 timedOut in file A (100% file timeout) + 99 killed in file B (0%)
  // -> aggregate 99% score, 1% timeoutRatio, PASS; per-file objects contain only count fields.
  const multiFile = scoreReport(makeReport({
    'js/a.js': { TimedOut: 1 },
    'js/b.js': { Killed: 99 },
  }));
  assert.equal(multiFile.score, 99);
  assert.equal(multiFile.timeoutRatio, 0.01);
  assert.equal(multiFile.verdict, 'PASS');
  assert.equal(multiFile.pass, true);
  assert.deepEqual(Object.keys(multiFile.files['js/a.js']), [
    'killed', 'timedOut', 'survived', 'noCoverage',
    'compileError', 'runtimeError', 'ignored', 'total',
  ]);
  assert.equal('verdict' in multiFile.files['js/a.js'], false);

  // Zero scored mutants (empty report or only non-scored statuses) retains 100% score and 0 timeoutRatio.
  const noScored = scoreReport(makeReport({
    'js/sim.js': { CompileError: 2, RuntimeError: 1, Ignored: 3 },
  }));
  assert.equal(noScored.totals.total, 0);
  assert.equal(noScored.score, 100);
  assert.equal(noScored.timeoutRatio, 0);
  assert.equal(noScored.verdict, 'PASS');
  assert.equal(noScored.pass, true);

  // Input report is never mutated.
  const frozenInput = Object.freeze({
    files: Object.freeze({
      'js/sim.js': Object.freeze({
        mutants: Object.freeze([Object.freeze({ status: 'Killed' })]),
      }),
    }),
  });
  const frozenResult = scoreReport(frozenInput);
  assert.equal(frozenResult.score, 100);
  assert.equal(frozenResult.pass, true);
});

test('scoreReport (b): INCONCLUSIVE strictly above 20% timeouts, boundary at 20%, overrides PASS and FAIL', () => {
  assert.equal(MAX_TIMEOUT_RATIO, 0.2);

  // 21% timeouts (79 killed + 21 timedOut): INCONCLUSIVE and pass=false even when min=0 or min=79.
  const report21Pct = makeReport({
    'js/sim.js': { Killed: 79, TimedOut: 21 },
  });
  for (const min of [0, 50, 79, 90]) {
    const res = scoreReport(report21Pct, { min });
    assert.equal(res.score, 79);
    assert.equal(res.timeoutRatio, 0.21);
    assert.equal(res.verdict, 'INCONCLUSIVE', `expected INCONCLUSIVE at min=${min}`);
    assert.equal(res.pass, false, `expected pass=false at min=${min}`);
  }

  // 1 killed + 9 timedOut (90% timeouts): INCONCLUSIVE even with min=0.
  const report90PctTimeout = scoreReport(
    makeReport({ 'js/sim.js': { Killed: 1, TimedOut: 9 } }),
    { min: 0 },
  );
  assert.equal(report90PctTimeout.score, 10);
  assert.equal(report90PctTimeout.timeoutRatio, 0.9);
  assert.equal(report90PctTimeout.verdict, 'INCONCLUSIVE');
  assert.equal(report90PctTimeout.pass, false);

  // Exactly 20% timeouts (80 killed + 20 timedOut): NOT INCONCLUSIVE.
  const report20Pct = makeReport({
    'js/sim.js': { Killed: 80, TimedOut: 20 },
  });
  const exact20AtMin80 = scoreReport(report20Pct, { min: 80 });
  assert.equal(exact20AtMin80.score, 80);
  assert.equal(exact20AtMin80.timeoutRatio, 0.2);
  assert.equal(exact20AtMin80.verdict, 'PASS');
  assert.equal(exact20AtMin80.pass, true);

  const exact20AtDefaultMin = scoreReport(report20Pct);
  assert.equal(exact20AtDefaultMin.score, 80);
  assert.equal(exact20AtDefaultMin.timeoutRatio, 0.2);
  assert.equal(exact20AtDefaultMin.verdict, 'FAIL');
  assert.equal(exact20AtDefaultMin.pass, false);

  // Custom maxTimeoutRatio boundaries (0 and 0.25).
  const onePercentTimeout = makeReport({ 'js/sim.js': { Killed: 99, TimedOut: 1 } });
  const strictZeroTimeout = scoreReport(onePercentTimeout, { maxTimeoutRatio: 0 });
  assert.equal(strictZeroTimeout.verdict, 'INCONCLUSIVE');
  assert.equal(strictZeroTimeout.pass, false);

  const relaxedTimeout = scoreReport(report21Pct, { min: 75, maxTimeoutRatio: 0.25 });
  assert.equal(relaxedTimeout.verdict, 'PASS');
  assert.equal(relaxedTimeout.pass, true);
});

test('changedFiles (c): failed git diff or unresolved base fails closed; empty diff and fetch-warning fallback succeed', () => {
  // 1. Diff exits nonzero (e.g., no merge base) -> ok:false, files:[], even if stdout had paths.
  const calls = [];
  const diffNonZero = changedFiles({
    cwd: '/tmp/fake-keeper',
    baseRef: 'main',
    run(cmd, args, opts) {
      calls.push({ cmd, args, opts });
      if (args[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
      if (args[0] === 'rev-parse') return { status: 0, stdout: 'deadbeef\n', stderr: '' };
      if (args[0] === 'diff') {
        return {
          status: 128,
          stdout: 'keeper/js/sim.js\n',
          stderr: 'fatal: origin/main...HEAD: no merge base\n',
        };
      }
      throw new Error(`unexpected git args: ${args.join(' ')}`);
    },
  });
  assert.equal(diffNonZero.ok, false);
  assert.deepEqual(diffNonZero.files, []);
  assert.match(diffNonZero.error, /git diff --name-only origin\/main\.\.\.HEAD -- js\/ keeper\/js\/ failed/);
  assert.match(diffNonZero.error, /no merge base/);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].args, ['fetch', '--no-tags', 'origin', 'main']);
  assert.deepEqual(calls[1].args, ['rev-parse', '--verify', 'origin/main^{commit}']);
  assert.deepEqual(calls[2].args, ['diff', '--name-only', 'origin/main...HEAD', '--', 'js/', 'keeper/js/']);

  // 2. Diff spawn error object (even with status 0) -> ok:false, files:[].
  const diffSpawnError = changedFiles({
    baseRef: 'origin/main',
    run(_cmd, args) {
      if (args[0] === 'fetch') return { status: 0, stdout: '', stderr: '' };
      if (args[0] === 'rev-parse') return { status: 0, stdout: 'deadbeef\n', stderr: '' };
      return { status: 0, stdout: 'js/sim.js\n', stderr: '', error: new Error('spawn git EIO') };
    },
  });
  assert.equal(diffSpawnError.ok, false);
  assert.deepEqual(diffSpawnError.files, []);
  assert.match(diffSpawnError.error, /spawn git EIO/);

  // 3. Diff killed by signal with empty output -> ok:false, files:[].
  const diffSignal = changedFiles({
    baseRef: 'origin/main',
    run(_cmd, args) {
      if (args[0] === 'fetch' || args[0] === 'rev-parse') return { status: 0, stdout: '', stderr: '' };
      return { status: null, signal: 'SIGKILL', stdout: '', stderr: '' };
    },
  });
  assert.equal(diffSignal.ok, false);
  assert.deepEqual(diffSignal.files, []);
  assert.match(diffSignal.error, /signal SIGKILL/);

  // 4. Runner throws synchronously during diff -> caught, ok:false, files:[].
  const runnerThrowsOnDiff = changedFiles({
    baseRef: 'origin/main',
    run(_cmd, args) {
      if (args[0] === 'fetch' || args[0] === 'rev-parse') return { status: 0, stdout: '', stderr: '' };
      throw new Error('runner exploded on diff');
    },
  });
  assert.equal(runnerThrowsOnDiff.ok, false);
  assert.deepEqual(runnerThrowsOnDiff.files, []);
  assert.match(runnerThrowsOnDiff.error, /runner exploded on diff/);

  // 5. Fetch fails AND base cannot be resolved -> ok:false, error contains both failures.
  const unresolvedBase = changedFiles({
    baseRef: 'origin/feature/test',
    run(_cmd, args) {
      if (args[0] === 'fetch') {
        return { status: 128, stdout: '', stderr: "fatal: couldn't find remote ref feature/test\n" };
      }
      if (args[0] === 'rev-parse') {
        return { status: 128, stdout: '', stderr: 'fatal: Needed a single revision\n' };
      }
      throw new Error('diff must not run when rev-parse fails');
    },
  });
  assert.equal(unresolvedBase.ok, false);
  assert.deepEqual(unresolvedBase.files, []);
  assert.match(unresolvedBase.error, /git fetch --no-tags origin feature\/test failed/);
  assert.match(unresolvedBase.error, /cannot resolve base origin\/feature\/test/);

  // 6. Contrast case: successful empty diff -> ok:true, files:[], error:null, warning:null.
  const emptyDiff = changedFiles({
    baseRef: 'origin/main',
    run() {
      return { status: 0, stdout: '\n', stderr: '' };
    },
  });
  assert.deepEqual(emptyDiff, { ok: true, files: [], error: null, warning: null });

  // 7. Fetch failure + resolvable local base + good diff -> ok:true with warning, deduplicated js/*.js targets.
  const fetchWarnGoodDiff = changedFiles({
    baseRef: 'main',
    run(_cmd, args) {
      if (args[0] === 'fetch') {
        return { status: 128, stdout: '', stderr: 'fatal: Could not read from remote repository.\n' };
      }
      if (args[0] === 'rev-parse') return { status: 0, stdout: 'abc1234\n', stderr: '' };
      return {
        status: 0,
        stdout: 'keeper/js/sim.js\njs/sim.js\nkeeper/js/morse.js\nkeeper/tests/sim.test.mjs\nREADME.md\n',
        stderr: '',
      };
    },
  });
  assert.equal(fetchWarnGoodDiff.ok, true);
  assert.deepEqual(fetchWarnGoodDiff.files, ['js/sim.js', 'js/morse.js']);
  assert.equal(fetchWarnGoodDiff.error, null);
  assert.match(fetchWarnGoodDiff.warning, /git fetch --no-tags origin main failed: fatal: Could not read from remote repository\./);
});

test('changedFiles (c) with REAL git repo: unresolved base and orphan no-merge-base diff fail closed', () => {
  withTempDir('keeper-138-real-git-', (repoDir) => {
    gitIn(repoDir, ['init', '-b', 'main']);
    mkdirSync(join(repoDir, 'keeper/js'), { recursive: true });
    writeFileSync(join(repoDir, 'keeper/js/sim.js'), 'export const x = 1;\n');
    gitIn(repoDir, ['add', '.']);
    gitIn(repoDir, ['commit', '-m', 'initial commit']);

    // Case 1: Base ref does not exist at all in real git repository.
    const unresolved = changedFiles({ cwd: repoDir, baseRef: 'origin/no-such-branch' });
    assert.equal(unresolved.ok, false);
    assert.deepEqual(unresolved.files, []);
    assert.match(unresolved.error, /git fetch --no-tags origin no-such-branch failed/);
    assert.match(unresolved.error, /cannot resolve base origin\/no-such-branch/);

    // Record initial commit as refs/remotes/origin/main so rev-parse succeeds locally.
    const mainSha = gitIn(repoDir, ['rev-parse', 'HEAD']).stdout.trim();
    gitIn(repoDir, ['update-ref', 'refs/remotes/origin/main', mainSha]);

    // Contrast case with real git: HEAD === origin/main -> empty diff -> ok:true, files:[].
    const cleanReal = changedFiles({ cwd: repoDir, baseRef: 'origin/main' });
    assert.equal(cleanReal.ok, true);
    assert.deepEqual(cleanReal.files, []);
    assert.equal(cleanReal.error, null);
    assert.match(cleanReal.warning, /git fetch --no-tags origin main failed/);

    // Case 2: Switch HEAD to an orphan commit with no common ancestor with origin/main.
    // rev-parse origin/main^{commit} succeeds, but real `git diff origin/main...HEAD` fails (exit 128: no merge base).
    gitIn(repoDir, ['checkout', '--orphan', 'orphan-branch']);
    writeFileSync(join(repoDir, 'keeper/js/sim.js'), 'export const x = 2;\n');
    gitIn(repoDir, ['add', '.']);
    gitIn(repoDir, ['commit', '-m', 'orphan commit without merge base']);

    const noMergeBase = changedFiles({ cwd: repoDir, baseRef: 'origin/main' });
    assert.equal(noMergeBase.ok, false);
    assert.deepEqual(noMergeBase.files, []);
    assert.match(noMergeBase.error, /git diff --name-only origin\/main\.\.\.HEAD -- js\/ keeper\/js\/ failed/);
    assert.match(noMergeBase.error, /no merge base/);
  });
});

test('scoreReport (d): missing/malformed report, unknown status, and invalid options throw Error', () => {
  const validReport = makeReport({ 'js/sim.js': { Killed: 1 } });

  for (const badMin of [-1, -0.0001, 100.0001, 101, NaN, Infinity, -Infinity, '90', null]) {
    assert.throws(
      () => scoreReport(validReport, { min: badMin }),
      /mutation minimum must be a number between 0 and 100/,
    );
  }

  for (const badRatio of [-1, -0.0001, 1.0001, 2, NaN, Infinity, -Infinity, '0.2', null]) {
    assert.throws(
      () => scoreReport(validReport, { maxTimeoutRatio: badRatio }),
      /maximum timeout ratio must be a number between 0 and 1/,
    );
  }

  for (const badReport of [undefined, null, false, 42, ' {}', {}, { files: null }, { files: [] }, { files: 'js' }]) {
    assert.throws(
      () => scoreReport(badReport),
      /invalid Stryker report: expected a files object/,
    );
  }

  for (const badFileEntry of [null, undefined, {}, { mutants: null }, { mutants: {} }, { mutants: 'none' }]) {
    assert.throws(
      () => scoreReport({ files: { 'js/sim.js': badFileEntry } }),
      /invalid Stryker report: missing mutants array for js\/sim\.js/,
    );
  }

  for (const badMutant of [
    null,
    undefined,
    {},
    { status: undefined },
    { status: '' },
    { status: 'killed' },
    { status: 'Pending' },
    { status: 'Timeout' },
    { status: 'toString' },
    { status: 'constructor' },
    { status: '__proto__' },
  ]) {
    assert.throws(
      () => scoreReport({ files: { 'js/sim.js': { mutants: [badMutant] } } }),
      /invalid Stryker report: unknown mutant status in js\/sim\.js/,
    );
  }
});

test('CLI main() (b, c, d): exits 1 on invalid MUTATION_MIN or git diff failure, 2 on INCONCLUSIVE, 1 on FAIL, 0 on PASS', () => {
  // Direct main() check for invalid MUTATION_MIN before any git or Stryker calls.
  const prevMin = process.env.MUTATION_MIN;
  try {
    for (const invalidMin of ['-1', '101', 'not-a-number', 'Infinity']) {
      process.env.MUTATION_MIN = invalidMin;
      assert.equal(main(), 1, `expected main() to return 1 for MUTATION_MIN=${invalidMin}`);
    }
  } finally {
    if (prevMin === undefined) delete process.env.MUTATION_MIN;
    else process.env.MUTATION_MIN = prevMin;
  }

  // Stage an isolated temp workspace with a real git repo, verbatim copies of the two gate scripts,
  // and a fast PATH-shimmed `npx` stub so CLI main() can be exercised end-to-end without running real Stryker.
  withTempDir('keeper-138-cli-', (rootDir) => {
    const keeperDir = join(rootDir, 'keeper');
    const scriptsDir = join(keeperDir, 'scripts');
    const jsDir = join(keeperDir, 'js');
    const binDir = join(rootDir, 'bin');
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(jsDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });

    copyFileSync(GATE_SCRIPT, join(scriptsDir, 'mutation-gate.mjs'));
    copyFileSync(CLI_SCRIPT, join(scriptsDir, 'mutation-changed.mjs'));
    const stagedCli = join(scriptsDir, 'mutation-changed.mjs');

    // Stub `npx` writes FAKE_STRYKER_REPORT (if set) to reports/mutation/changed.json and exits with FAKE_STRYKER_EXIT.
    const fakeNpx = join(binDir, 'npx');
    writeFileSync(
      fakeNpx,
      `#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
if (process.env.FAKE_STRYKER_SKIP_WRITE !== '1') {
  mkdirSync(resolve(process.cwd(), 'reports/mutation'), { recursive: true });
  writeFileSync(resolve(process.cwd(), 'reports/mutation/changed.json'), process.env.FAKE_STRYKER_REPORT || '');
}
process.exit(Number(process.env.FAKE_STRYKER_EXIT || 0));
`,
    );
    chmodSync(fakeNpx, 0o755);

    const runCli = (envOverrides = {}) => spawnSync(process.execPath, [stagedCli], {
      cwd: keeperDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        ...envOverrides,
      },
    });

    // Initialize real git repo in rootDir.
    gitIn(rootDir, ['init', '-b', 'main']);
    writeFileSync(join(jsDir, 'sim.js'), 'export const v = 1;\n');
    gitIn(rootDir, ['add', '.']);
    gitIn(rootDir, ['commit', '-m', 'base commit']);
    const baseSha = gitIn(rootDir, ['rev-parse', 'HEAD']).stdout.trim();
    gitIn(rootDir, ['update-ref', 'refs/remotes/origin/main', baseSha]);

    // 1. Unresolved base ref -> exit 1, never prints "skip (pass)".
    const unresolvedCli = runCli({ GITHUB_BASE_REF: 'nonexistent-branch' });
    assert.equal(unresolvedCli.status, 1);
    assert.match(unresolvedCli.stderr, /mutation-changed: FAIL/);
    assert.match(unresolvedCli.stderr, /cannot resolve base origin\/nonexistent-branch/);
    assert.doesNotMatch(unresolvedCli.stdout, /skip \(pass\)/);

    // 2. Successful empty diff (HEAD === origin/main) -> exit 0, prints "skip (pass)".
    const emptyDiffCli = runCli({ GITHUB_BASE_REF: 'main' });
    assert.equal(emptyDiffCli.status, 0);
    assert.match(emptyDiffCli.stdout, /mutation-changed: no keeper\/js changes vs origin\/main — skip \(pass\)/);
    assert.match(emptyDiffCli.stderr, /using resolved local origin\/main/);

    // 3. Orphan branch (no merge base with origin/main) -> real git diff fails -> exit 1, never prints "skip (pass)".
    gitIn(rootDir, ['checkout', '--orphan', 'disconnected']);
    writeFileSync(join(jsDir, 'sim.js'), 'export const v = 2;\n');
    gitIn(rootDir, ['add', '.']);
    gitIn(rootDir, ['commit', '-m', 'disconnected commit']);

    const noMergeBaseCli = runCli({ GITHUB_BASE_REF: 'main' });
    assert.equal(noMergeBaseCli.status, 1);
    assert.match(noMergeBaseCli.stderr, /mutation-changed: FAIL/);
    assert.match(noMergeBaseCli.stderr, /no merge base/);
    assert.doesNotMatch(noMergeBaseCli.stdout, /skip \(pass\)/);

    // 4. Create a valid feature branch off origin/main modifying keeper/js/sim.js to test report scoring in CLI.
    gitIn(rootDir, ['checkout', '-B', 'feature', 'refs/remotes/origin/main']);
    writeFileSync(join(jsDir, 'sim.js'), 'export const v = 3;\n');
    gitIn(rootDir, ['add', '.']);
    gitIn(rootDir, ['commit', '-m', 'modify sim.js']);

    // 4a. 21% timeouts (79 killed + 21 timedOut) -> CLI exits 2 (INCONCLUSIVE) even with MUTATION_MIN=0.
    const inconclusiveCli = runCli({
      GITHUB_BASE_REF: 'main',
      MUTATION_MIN: '0',
      FAKE_STRYKER_REPORT: JSON.stringify(makeReport({ 'js/sim.js': { Killed: 79, TimedOut: 21 } })),
    });
    assert.equal(inconclusiveCli.status, 2);
    assert.match(inconclusiveCli.stdout, /timeouts=21\.00%/);
    assert.match(inconclusiveCli.stderr, /mutation-changed: INCONCLUSIVE timeouts 21\.00% > 20%/);

    // 4b. 85 killed + 10 timedOut + 5 survived -> CLI exits 1 (FAIL below 90%).
    const failTimeoutCli = runCli({
      GITHUB_BASE_REF: 'main',
      FAKE_STRYKER_REPORT: JSON.stringify(makeReport({ 'js/sim.js': { Killed: 85, TimedOut: 10, Survived: 5 } })),
    });
    assert.equal(failTimeoutCli.status, 1);
    assert.match(failTimeoutCli.stdout, /score=85\.00%.*killed=85 timedOut=10 survived=5.*total=100 timeouts=10\.00%/);
    assert.match(failTimeoutCli.stderr, /mutation-changed: FAIL below 90%/);

    // 4c. Exactly 20% timeouts (80 killed + 20 timedOut) at MUTATION_MIN=80 -> CLI exits 0 (PASS).
    const boundaryPassCli = runCli({
      GITHUB_BASE_REF: 'main',
      MUTATION_MIN: '80',
      FAKE_STRYKER_REPORT: JSON.stringify(makeReport({ 'js/sim.js': { Killed: 80, TimedOut: 20 } })),
    });
    assert.equal(boundaryPassCli.status, 0);
    assert.match(boundaryPassCli.stdout, /mutation-changed: PASS ≥80%/);

    // 4d. Stale report is deleted before running Stryker; missing report fails closed with exit 1.
    const missingReportCli = runCli({
      GITHUB_BASE_REF: 'main',
      FAKE_STRYKER_SKIP_WRITE: '1',
    });
    assert.equal(missingReportCli.status, 1);
    assert.match(missingReportCli.stderr, /mutation-changed: FAIL missing Stryker report/);

    // 4e. Malformed JSON report fails closed with exit 1.
    const malformedReportCli = runCli({
      GITHUB_BASE_REF: 'main',
      FAKE_STRYKER_REPORT: '{not-valid-json',
    });
    assert.equal(malformedReportCli.status, 1);
    assert.match(malformedReportCli.stderr, /mutation-changed: FAIL invalid Stryker report:/);

    // 4f. Nonzero Stryker exit code despite 100% passing report -> normalized to exit 1 (FAIL).
    const runnerFailedCli = runCli({
      GITHUB_BASE_REF: 'main',
      FAKE_STRYKER_REPORT: JSON.stringify(makeReport({ 'js/sim.js': { Killed: 10 } })),
      FAKE_STRYKER_EXIT: '2',
    });
    assert.equal(runnerFailedCli.status, 1);
    assert.match(runnerFailedCli.stderr, /mutation-changed: FAIL Stryker exited 2/);
  });
});

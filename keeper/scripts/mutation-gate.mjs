import { spawnSync } from 'node:child_process';

export const MAX_TIMEOUT_RATIO = 0.2;

const STATUS_KEYS = {
  Killed: 'killed', Timeout: 'timedOut', TimedOut: 'timedOut', Survived: 'survived', NoCoverage: 'noCoverage',
  CompileError: 'compileError', RuntimeError: 'runtimeError', Ignored: 'ignored',
};

function emptyCounts() {
  return { killed: 0, timedOut: 0, survived: 0, noCoverage: 0,
    compileError: 0, runtimeError: 0, ignored: 0, total: 0 };
}

/** Score a parsed Stryker JSON report without I/O; total counts scored mutants only. */
export function scoreReport(reportJson, { min = 90, maxTimeoutRatio = MAX_TIMEOUT_RATIO } = {}) {
  if (!Number.isFinite(min) || min < 0 || min > 100) {
    throw new Error('mutation minimum must be a number between 0 and 100');
  }
  if (!Number.isFinite(maxTimeoutRatio) || maxTimeoutRatio < 0 || maxTimeoutRatio > 1) {
    throw new Error('maximum timeout ratio must be a number between 0 and 1');
  }
  if (!reportJson || !reportJson.files || typeof reportJson.files !== 'object'
      || Array.isArray(reportJson.files)) {
    throw new Error('invalid Stryker report: expected a files object');
  }
  const files = {};
  const totals = emptyCounts();
  for (const [path, info] of Object.entries(reportJson.files)) {
    if (!info || !Array.isArray(info.mutants)) {
      throw new Error(`invalid Stryker report: missing mutants array for ${path}`);
    }
    const counts = emptyCounts();
    let pending = 0;
    for (const mutant of info.mutants) {
      if (mutant?.status === 'Pending') {
        pending++;
        continue;
      }
      if (!mutant || !Object.hasOwn(STATUS_KEYS, mutant.status)) {
        throw new Error(`invalid Stryker report: unknown mutant status in ${path}`);
      }
      counts[STATUS_KEYS[mutant.status]]++;
    }
    if (pending) {
      throw new Error(`incomplete Stryker report: ${pending} pending mutant(s) in ${path}`);
    }
    counts.total = counts.killed + counts.timedOut + counts.survived + counts.noCoverage;
    Object.defineProperty(files, path, { value: counts, enumerable: true });
    for (const key of Object.keys(totals)) totals[key] += counts[key];
  }
  const score = totals.total ? (100 * totals.killed) / totals.total : 100;
  const timeoutRatio = totals.total ? totals.timedOut / totals.total : 0;
  const verdict = timeoutRatio > maxTimeoutRatio ? 'INCONCLUSIVE'
    : score + 1e-9 >= min ? 'PASS' : 'FAIL';
  return { files, totals, score, timeoutRatio, verdict, pass: verdict === 'PASS' };
}

/** Discover changed targets. run has spawnSync's (command, args, options) signature. */
export function changedFiles({ cwd = process.cwd(), baseRef = 'origin/main', run = spawnSync } = {}) {
  const baseName = baseRef.replace(/^origin\//, '');
  const remoteRef = `origin/${baseName}`;
  function git(args) {
    try {
      return run('git', args, { cwd, encoding: 'utf8' });
    } catch (error) {
      return { status: null, error };
    }
  }
  function failure(args, result) {
    const detail = result.error?.message || result.stderr?.trim() || result.stdout?.trim()
      || `exit status ${result.status}, signal ${result.signal || 'none'}`;
    return `git ${args.join(' ')} failed: ${detail}`;
  }
  const fetchArgs = ['fetch', '--no-tags', 'origin', baseName];
  const fetch = git(fetchArgs);
  const warning = fetch.status !== 0 || fetch.error ? failure(fetchArgs, fetch) : null;
  const resolveArgs = ['rev-parse', '--verify', `${remoteRef}^{commit}`];
  const resolved = git(resolveArgs);
  if (resolved.status !== 0 || resolved.error) {
    return { ok: false, files: [], error: [warning,
      `cannot resolve base ${remoteRef}: ${failure(resolveArgs, resolved)}`].filter(Boolean).join('\n') };
  }
  const diffArgs = ['diff', '--name-only', `${remoteRef}...HEAD`, '--', 'js/', 'keeper/js/'];
  const diff = git(diffArgs);
  if (diff.status !== 0 || diff.error) {
    return { ok: false, files: [], error: [warning, failure(diffArgs, diff)].filter(Boolean).join('\n') };
  }
  const files = [...new Set((diff.stdout || '').split(/\r?\n/)
    .map((file) => file.trim().replace(/^keeper\//, ''))
    .filter((file) => /^js\/.+\.js$/.test(file)))];
  return { ok: true, files, error: null, warning };
}

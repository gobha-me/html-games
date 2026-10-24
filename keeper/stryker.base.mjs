// Shared StrykerJS options for Keeper. The per-scope configs below import this.
//
// Why the knobs look like this (measured 2026-10-23 on a 20-core dev container):
// - The suite runs on node:test, so Stryker uses the tap runner. Its "perTest"
//   coverage is per *test file*, not per test case: a mutant covered by a file
//   reruns that whole file.
// - tests/spawns.test.mjs (~27 s) and tests/spawns-independent.test.mjs (~39 s)
//   sweep 500 seeds through createState(); everything else together is ~11 s.
//   Under instrumentation the dry run is ~7.7 min, and almost every sim.js
//   mutant is covered by both spawns files, so each such mutant costs minutes
//   and each looping mutant waits netTime + timeoutMS before it is declared a
//   timeout. That is why the first full run stalled at ~968/3030.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export const base = {
  testRunner: 'tap',
  plugins: ['@stryker-mutator/tap-runner'],
  coverageAnalysis: 'perTest',
  ignorePatterns: ['e2e', 'playwright-report', 'test-results', 'performance-results', 'reports'],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  // The two seeded spawn suites take minutes once instrumented.
  dryRunTimeoutMinutes: 60,
  // Timeout = dryRunNetTime * timeoutFactor + timeoutMS. The dry run is ONE process
  // at full speed, so mutant runs must not be slower than that. The dev container is
  // capped at 8 CPUs by its cgroup (cpu.max 800000/100000) while nproc/os.cpus()
  // report the host's 20 cores. With concurrency 16-18 every worker was throttled to
  // ~0.45 CPU, ran 2x+ slower than the dry run, and ~1,200 mutants that were really
  // killed or surviving were reported as "Timeout" (record.js and keys.js showed
  // 100% that way; record.js re-run alone scores ~84%). Timeouts count as detected,
  // so this inflated the score. Keep workers <= quota - 1.
  // The tap runner's per-file "net time" is the TAP-reported test duration, which
  // leaves out node start-up and loading the instrumented modules (~1-3 s per file),
  // so the fixed slack has to be generous too.
  timeoutFactor: 2,
  timeoutMS: 60000,
  concurrency: 7,
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  incremental: true,
};

// Pure game logic: simulation/rules/spawns/hazards, vessel physics, Morse, keys, save record.
// Excluded as rendering/UI/boot glue: js/main.js, js/renderer.js, js/audio.js.
export const coreLogic = ['js/sim.js', 'js/physics.js', 'js/morse.js', 'js/keys.js', 'js/record.js'];
export const allTests = ['tests/*.test.mjs'];
// Every suite except the two 500-seed spawn sweeps.
export const fastTests = [
  'tests/!(spawns|spawns-independent).test.mjs',
];

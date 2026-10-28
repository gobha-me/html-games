#!/usr/bin/env node
/**
 * Reproducible in-memory break-variant verifier for Keeper #113 (#145).
 *
 * Rewrites targeted `keeper/js/*.js` sources strictly in memory via a Node ESM
 * loader hook (`module.register`) and never touches `keeper/js/` on disk.
 *
 * For every variant:
 *   1. Asserts that the replacement anchor matches in the target `js/*.js`
 *      source file on disk EXACTLY ONCE (throws if 0 or >1 matches, preventing
 *      a drifted anchor from silently passing).
 *   2. Spawns `node --test --test-name-pattern=<pattern> tests/<file>.test.mjs`
 *      with `NODE_OPTIONS=--max-old-space-size=2048` and `--import` pointing at
 *      this module.
 *   3. Asserts that the child test process exits non-zero (FAILS) and that the
 *      expected diagnostic substring appears in stdout/stderr.
 *
 * Usage (from `keeper/` or repo root):
 *   node tests/proof/break-variants.mjs --list
 *   node tests/proof/break-variants.mjs --only C1
 *   node tests/proof/break-variants.mjs --only A1
 *   /config/.local/bin/heavy-run node tests/proof/break-variants.mjs
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMainThread } from 'node:worker_threads';

const SELF_PATH = fileURLToPath(import.meta.url);
const KEEPER_ROOT = resolve(dirname(SELF_PATH), '../..');

export const VARIANTS = Object.freeze([
  {
    id: 'C1',
    name: 'C1_EARLY_EXTRA_TRAWLER',
    description: 'Allow extra threatening trawlers at spawnTime > 0 instead of > TRAFFIC.lateAfter (360 s)',
    module: 'js/sim.js',
    testFile: 'tests/fleet-independent.test.mjs',
    testNamePattern: 'every seed 0..499 keeps hazard layout',
    anchor:
      'if (threatening && (spawnTime <= TRAFFIC.lateAfter || overlapping.filter((ship) => ship.threatening).length >= TRAFFIC.maxThreats)) continue;',
    replacement:
      'if (threatening && (spawnTime <= 0 || overlapping.filter((ship) => ship.threatening).length >= TRAFFIC.maxThreats)) continue;',
    expectedMessage: 'seed 0 night 1 first extra must not be trawler',
  },
  {
    id: 'C2',
    name: 'C2_SEED_250_EARLY_TRAWLER',
    description: 'Bypass spawnTime <= TRAFFIC.lateAfter guard only when seed === 250 && night === 3',
    module: 'js/sim.js',
    testFile: 'tests/fleet-independent.test.mjs',
    testNamePattern: 'every seed 0..499 keeps hazard layout',
    anchor:
      'if (threatening && (spawnTime <= TRAFFIC.lateAfter || overlapping.filter((ship) => ship.threatening).length >= TRAFFIC.maxThreats)) continue;',
    replacement:
      'if (threatening && (((seed !== 250 || night !== 3) && spawnTime <= TRAFFIC.lateAfter) || overlapping.filter((ship) => ship.threatening).length >= TRAFFIC.maxThreats)) continue;',
    expectedMessage: 'seed 250 night 3 extra trawler at 331.40936018592265 outside (360, 480]',
  },
  {
    id: 'B1',
    name: 'B1_SPAWNS_INDEP_UNDERWAY_SEED_150',
    description: 'Admit ship-2 2 s early (spawnTime - 2) only on seed 150 in 200-seed underway loop',
    module: 'js/sim.js',
    testFile: 'tests/spawns-independent.test.mjs',
    testNamePattern: 'a planned ship is underway at its spawnTime and absent earlier',
    anchor: 'if (approach.spawnTime > state.time - dt && approach.spawnTime <= state.time',
    replacement:
      "if (approach.spawnTime - (state.seed === 150 && approach.id === 'ship-2' ? 2 : 0) > state.time - dt && approach.spawnTime - (state.seed === 150 && approach.id === 'ship-2' ? 2 : 0) <= state.time",
    expectedMessage: 'seed 150 ship-2 present at 68.39827847608696',
  },
  {
    id: 'B2',
    name: 'B2_SPAWNS_INDEP_CALM_WRECK_SEED_140',
    description: 'Wreck non-threatening ship after spawnTime + 5 s only on seed 140 in 200-seed calm-course loop',
    module: 'js/sim.js',
    testFile: 'tests/spawns-independent.test.mjs',
    testNamePattern: 'unwarned non-threatening spawns never wreck',
    anchor: "if (ship.status === 'underway' && !ship.smuggler && !distress && contact) {",
    replacement:
      "if (ship.status === 'underway' && !ship.smuggler && !distress && (contact || (state.seed === 140 && ship.threatening === false && state.time > ship.spawnTime + 5))) {",
    expectedMessage: 'seed 140 t 36 ship-1',
  },
  {
    id: 'B3',
    name: 'B3_SPAWNS_REPLAY_DETERMINISM_SEED_18',
    description: 'Perturb beam by +0.5 deg on second replay at t < 0.02 s only on seeds[18] (1161830751)',
    module: 'js/sim.js',
    testFile: 'tests/spawns.test.mjs',
    testNamePattern: 'planning and input replay are deterministic',
    anchor: 'if (input.hold !== true) state.beam = wrapBearing(state.beam + state.speed * dt);',
    replacement:
      'if (input.hold !== true) state.beam = wrapBearing(state.beam + state.speed * dt + (state.seed === 1161830751 && state.time < 0.02 && (globalThis.__replayFault = (globalThis.__replayFault ?? 0) + 1) > 1 ? 0.5 : 0));',
    expectedMessage: '1161830751',
  },
  {
    id: 'B4',
    name: 'B4_SPAWNS_SCHEDULED_TICK_SEED_12',
    description: 'Delay ship-2 arrival by +0.5 s only on seeds[12] (2415085369) in 16-seed scheduled-tick loop',
    module: 'js/sim.js',
    testFile: 'tests/spawns.test.mjs',
    testNamePattern: 'ships first appear underway at their scheduled tick',
    anchor: 'if (approach.spawnTime > state.time - dt && approach.spawnTime <= state.time',
    replacement:
      "if (approach.spawnTime + (state.seed === 2415085369 && approach.id === 'ship-2' ? 0.5 : 0) > state.time - dt && approach.spawnTime + (state.seed === 2415085369 && approach.id === 'ship-2' ? 0.5 : 0) <= state.time",
    expectedMessage: '2415085369/ship-2: missed arrival',
  },
  {
    id: 'B5A',
    name: 'B5A_SPAWNS_PAST_DAWN_COURSE_SEED_300',
    description: 'Collapse stepVessel position to origin for dt > 100 s only on seeds[300] (2388405849) first coaster',
    module: 'js/physics.js',
    testFile: 'tests/spawns.test.mjs',
    testNamePattern: 'non-threatening spawns across all 500 seeds',
    anchor: 'export function stepVessel(vessel, { rudderCommand = 0, throttle = 1 } = {}, dt) {',
    replacement:
      'export function stepVessel(vessel, { rudderCommand = 0, throttle = 1 } = {}, dt) {\n  if (dt > 100 && Math.abs(vessel.x - 445.8520500534243) < 1e-6) return { ...vessel, x: 0, y: 0 };',
    expectedMessage: 'non-threatening spawns across all 500 seeds are on permanently reef-clear courses, even beyond dawn',
  },
  {
    id: 'B5B',
    name: 'B5B_SPAWNS_NONTHREAT_LIVE_STEP_SEED_10',
    description: 'Wreck non-threatening ship after t > 100 s only on seeds[10] (1401181143) in 16-seed live step loop',
    module: 'js/sim.js',
    testFile: 'tests/spawns.test.mjs',
    testNamePattern: 'non-threatening spawns across all 500 seeds',
    anchor: "if (ship.status === 'underway' && !ship.smuggler && !distress && contact) {",
    replacement:
      "if (ship.status === 'underway' && !ship.smuggler && !distress && (contact || (state.seed === 1401181143 && ship.threatening === false && state.time > 100))) {",
    expectedMessage: 'wrecked',
  },
  {
    id: 'B6',
    name: 'B6_SPAWNS_UNDERWAY_CAP_SEED_9',
    description: 'Push 3 extra underway hulls after t > 100 s only on seeds[9] (3041712678) in 12-seed cap loop',
    module: 'js/sim.js',
    testFile: 'tests/spawns.test.mjs',
    testNamePattern: 'live underway cap holds with and without repeated rescue attempts',
    anchor: 'state.ships.push(arrive(approach, state.hazards, state.settings.incomingWpm));',
    replacement: [
      'state.ships.push(arrive(approach, state.hazards, state.settings.incomingWpm));',
      '      if (state.seed === 3041712678 && state.time > 100) {',
      '        state.ships.push(',
      "          { ...arrive(approach, state.hazards, 8), id: 'extra-a' },",
      "          { ...arrive(approach, state.hazards, 8), id: 'extra-b' },",
      "          { ...arrive(approach, state.hazards, 8), id: 'extra-c' },",
      '        );',
      '      }',
    ].join('\n'),
    expectedMessage: 'live underway cap holds with and without repeated rescue attempts',
  },
  {
    id: 'A1',
    name: 'A1_REPLAY_DETERMINISM_AFTER_36S',
    description: 'Perturb beam by +0.5 deg on second replay only at t > 120 s (after Round-3 36 s horizon) on seeds[18] (1161830751)',
    module: 'js/sim.js',
    testFile: 'tests/spawns.test.mjs',
    testNamePattern: 'planning and input replay are deterministic',
    anchor: 'if (input.hold !== true) state.beam = wrapBearing(state.beam + state.speed * dt);',
    replacement:
      'if (input.hold !== true) state.beam = wrapBearing(state.beam + state.speed * dt + (state.seed === 1161830751 && state.time > 120 && state.time < 120.02 && (globalThis.__replayFaultAfter36 = (globalThis.__replayFaultAfter36 ?? 0) + 1) > 1 ? 0.5 : 0));',
    expectedMessage: '1161830751',
  },
  {
    id: 'A2',
    name: 'A2_REPLAY_DETERMINISM_LATE_TRAFFIC_AFTER_360S',
    description: 'Perturb beam by +0.5 deg on second replay only at t > 400 s (past TRAFFIC.lateAfter = 360 s) on seed 108',
    module: 'js/sim.js',
    testFile: 'tests/spawns.test.mjs',
    testNamePattern: 'planning and input replay are deterministic',
    anchor: 'if (input.hold !== true) state.beam = wrapBearing(state.beam + state.speed * dt);',
    replacement:
      'if (input.hold !== true) state.beam = wrapBearing(state.beam + state.speed * dt + (state.seed === 108 && state.time > 400 && state.time < 400.02 && (globalThis.__replayFaultAfter360 = (globalThis.__replayFaultAfter360 ?? 0) + 1) > 1 ? 0.5 : 0));',
    expectedMessage: 'seed: 108',
  },
  {
    id: 'B7',
    name: 'B7_NONTHREAT_FUTURE_HORIZON_2X_NIGHT',
    description: 'Turn non-threatening coaster toward Tooth reef only when stepVessel dt > 600 s (beyond Round-3 horizon <= 528 s) on seeds[300]',
    module: 'js/physics.js',
    testFile: 'tests/spawns.test.mjs',
    testNamePattern: 'non-threatening spawns across all 500 seeds',
    anchor: 'export function stepVessel(vessel, { rudderCommand = 0, throttle = 1 } = {}, dt) {',
    replacement:
      'export function stepVessel(vessel, { rudderCommand = 0, throttle = 1 } = {}, dt) {\n  if (dt > 600 && Math.abs(vessel.x - 445.8520500534243) < 1e-6) return { ...vessel, x: 210, y: 500, heading: 180 };',
    expectedMessage: 'non-threatening spawns across all 500 seeds are on permanently reef-clear courses, even beyond dawn',
  },
  {
    id: 'C3',
    name: 'C3_MAIN_REMOVE_ITEM_SWALLOWED',
    description: 'Swallow localStorage.removeItem(SAVE_KEY) error without updating storageMessage in main.js',
    module: 'js/main.js',
    testFile: 'tests/log.test.mjs',
    testNamePattern: 'main.js catches removeItem errors when clearing a corrupt saved watch on startup',
    anchor: "    storageMessage = 'The saved watch could not be read. Take a fresh watch.';\n    localStorage.removeItem(SAVE_KEY);",
    replacement:
      "    storageMessage = 'The saved watch could not be read. Take a fresh watch.';\n    try { localStorage.removeItem(SAVE_KEY); } catch { /* broken: swallowed removeItem failure */ }",
    expectedMessage: 'This browser cannot save your watch. Keep this page open to continue.',
  },
]);

function countOccurrences(haystack, needle) {
  assert.ok(needle.length > 0, 'Replacement anchor must not be empty');
  return haystack.split(needle).length - 1;
}

export function findVariant(id) {
  const variant = VARIANTS.find((candidate) => candidate.id === id || candidate.name === id);
  if (!variant) {
    throw new Error(`Unknown variant "${id}". Valid IDs: ${VARIANTS.map((v) => v.id).join(', ')}`);
  }
  return variant;
}

export function applyVariantToSource(source, variant) {
  const matches = countOccurrences(source, variant.anchor);
  assert.equal(
    matches,
    1,
    `Variant ${variant.id} (${variant.name}): expected anchor in ${variant.module} to match exactly once, found ${matches}`,
  );
  return source.replace(variant.anchor, variant.replacement);
}

export function assertAnchorMatchesOnce(variant) {
  const targetPath = resolve(KEEPER_ROOT, variant.module);
  const source = readFileSync(targetPath, 'utf8');
  applyVariantToSource(source, variant);
}

let activeVariantId = process.env.PROOF_VARIANT ?? null;
let useRound3Test = process.env.PROOF_ROUND3_TEST === '1';

const ROUND3_SPAWNS_TEST_REPLACEMENTS = Object.freeze([
  {
    anchor: [
      '    const replay = () => {',
      '      let state = createState(seed);',
      '      for (let i = 0; i < 6; i++) state = step(state, { horn: i % 2 === 0, fast: i === 2, hold: i === 3 }, 30);',
      '      return state;',
      '    };',
      '    assert.deepEqual(replay(), replay());',
      '  }',
      '  for (const seed of seeds.slice(0, 4)) {',
      '    const replayFirstWindow = () => {',
      '      let state = createState(seed);',
      '      for (let i = 0; i < 6; i++) state = step(state, { horn: i % 2 === 0, fast: i === 2, hold: i === 3 }, 6);',
      '      return state;',
      '    };',
      '    assert.deepEqual(replayFirstWindow(), replayFirstWindow());',
      '    const replayFullWatch = () => {',
      '      let state = createState(seed);',
      '      for (let i = 0; i < 6; i++) {',
      '        state = step(state, { horn: i % 2 === 0, fast: i === 2, hold: i === 3 }, NIGHT_SECONDS / 6);',
      '      }',
      '      return state;',
      '    };',
      '    assert.deepEqual(replayFullWatch(), replayFullWatch());',
      '  }',
    ].join('\n'),
    replacement: [
      '    const replay = () => {',
      '      let state = createState(seed);',
      '      for (let i = 0; i < 6; i++) state = step(state, { horn: i % 2 === 0, fast: i === 2, hold: i === 3 }, 6);',
      '      return state;',
      '    };',
      '    assert.deepEqual(replay(), replay());',
      '  }',
    ].join('\n'),
  },
  {
    anchor: '    const future = stepVessel(pose, {}, 2 * NIGHT_SECONDS);',
    replacement: '    const future = stepVessel(pose, {}, NIGHT_SECONDS - ship.spawnTime + BUDGET_PERIOD_SECONDS);',
  },
]);

export async function initialize(data) {
  if (data?.variantId) {
    activeVariantId = data.variantId;
  }
  if (typeof data?.useRound3Test === 'boolean') {
    useRound3Test = data.useRound3Test;
  }
}

export async function load(url, context, nextLoad) {
  if (activeVariantId && url.startsWith('file:')) {
    const variant = findVariant(activeVariantId);
    const parsedUrl = new URL(url);
    const filePath = fileURLToPath(parsedUrl);
    const targetPath = resolve(KEEPER_ROOT, variant.module);
    if (filePath === targetPath) {
      const originalSource = readFileSync(targetPath, 'utf8');
      const rewrittenSource = applyVariantToSource(originalSource, variant);
      return {
        format: 'module',
        shortCircuit: true,
        source: rewrittenSource,
      };
    }
    if (useRound3Test && filePath === resolve(KEEPER_ROOT, 'tests/spawns.test.mjs')) {
      let testSource = readFileSync(filePath, 'utf8');
      for (const patch of ROUND3_SPAWNS_TEST_REPLACEMENTS) {
        const matches = countOccurrences(testSource, patch.anchor);
        assert.equal(matches, 1, `Round-3 spawns.test.mjs patch anchor matched ${matches} times`);
        testSource = testSource.replace(patch.anchor, patch.replacement);
      }
      return {
        format: 'module',
        shortCircuit: true,
        source: testSource,
      };
    }
  }
  return nextLoad(url, context);
}

function parseCliArgs(argv) {
  let listOnly = false;
  const onlyIds = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--list') {
      listOnly = true;
    } else if (arg === '--only') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --only <ID>');
      onlyIds.push(...next.split(',').map((s) => s.trim()).filter(Boolean));
      i += 1;
    } else if (arg.startsWith('--only=')) {
      const value = arg.slice('--only='.length);
      onlyIds.push(...value.split(',').map((s) => s.trim()).filter(Boolean));
    } else {
      throw new Error(`Unknown argument "${arg}". Usage: node tests/proof/break-variants.mjs [--list] [--only <ID>]`);
    }
  }
  return { listOnly, onlyIds };
}

function runCli() {
  const { listOnly, onlyIds } = parseCliArgs(process.argv.slice(2));
  const selected = onlyIds.length > 0 ? onlyIds.map(findVariant) : [...VARIANTS];

  for (const variant of selected) {
    assertAnchorMatchesOnce(variant);
  }

  if (listOnly) {
    for (const variant of selected) {
      console.log(
        `${variant.id.padEnd(4)} ${variant.name.padEnd(46)} ${variant.module.padEnd(14)} ${variant.testFile} :: ${variant.testNamePattern}`,
      );
    }
    return;
  }

  let failures = 0;
  for (const variant of selected) {
    const startMs = Date.now();
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        pathToFileURL(SELF_PATH).href,
        '--test',
        `--test-name-pattern=${variant.testNamePattern}`,
        variant.testFile,
      ],
      {
        cwd: KEEPER_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=2048',
          PROOF_CHILD: '1',
          PROOF_VARIANT: variant.id,
        },
      },
    );
    const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(2);
    const combinedOutput = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
    const exitedNonZero = child.status !== 0 && child.status !== null;
    const matchedMessage = combinedOutput.includes(variant.expectedMessage);

    if (exitedNonZero && matchedMessage) {
      console.log(
        `[PASS: caught fault] ${variant.id} (${variant.name}) failed as expected in ${elapsedSec}s — matched "${variant.expectedMessage}"`,
      );
    } else {
      failures += 1;
      console.error(
        `[FAIL: variant escaped] ${variant.id} (${variant.name}) status=${child.status} matched=${matchedMessage} (${elapsedSec}s)`,
      );
      console.error(combinedOutput.slice(-2000));
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} of ${selected.length} break variant(s) did NOT fail as expected.`);
    process.exit(1);
  }
  console.log(`\nAll ${selected.length} break variant(s) failed their target tests as expected.`);
}

if (isMainThread) {
  if (process.env.PROOF_CHILD === '1') {
    const variant = findVariant(process.env.PROOF_VARIANT ?? '');
    assertAnchorMatchesOnce(variant);
    register(pathToFileURL(SELF_PATH).href, {
      parentURL: pathToFileURL(SELF_PATH).href,
      data: {
        variantId: variant.id,
        useRound3Test: process.env.PROOF_ROUND3_TEST === '1',
      },
    });
  } else {
    runCli();
  }
}

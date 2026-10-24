# Keeper mutation-testing report

Measured 2026-10-23/24 with StrykerJS 10 (tap runner) on the dev container, branch `chore/keeper-mutation-testing`, against `main` at `fd247d7`. Scope: `js/sim.js`, `js/physics.js`, `js/morse.js`, `js/keys.js`, `js/record.js` (2,043 mutants).

## Current score (CI, after the survivor-killing tests)

Measured by the `Keeper mutation` workflow (`.github/workflows/keeper-mutation.yml`, run 40064857951) on commit `ed7a175`, branch `test/keeper-kill-survivors`, 2026-10-24. All 2,043 planned mutants were reported by the shards; each shard runs the quick pass plus a survivor pass against the whole suite.

| File | Killed | Timeout | Survived | No cov | Errors/other | Score |
|---|---|---|---|---|---|---|
| keys.js | 39 | 0 | 0 | 0 | 0 | **100.00%** |
| morse.js | 261 | 0 | 0 | 0 | 1 | **100.00%** |
| physics.js | 298 | 15 | 32 | 0 | 50 | **90.72%** |
| record.js | 44 | 0 | 1 | 0 | 0 | **97.78%** |
| sim.js | 1207 | 52 | 43 | 0 | 0 | **96.70%** |
| **All files** | 1849 | 67 | 76 | 0 | 51 | **96.18%** |

CI break threshold (`MUTATION_BREAK`): **95**, just below the measured 96.18%.

Of the 76 live mutants, 23 are documented equivalents or roundoff-only (listed below), and 8 sim.js mutants are unresolved boundary/tie cases with no valid public-API fixture found. Most of the other physics.js survivors are in `pointOfNoReturn` and `forwardExcursion` (lines 146–183). They weren't survivor targets in the baseline, which recorded 71 physics.js timeouts against 15 in this CI run, so they probably showed up as timeouts there. They are the next place to add tests.

### Equivalent mutants

- physics.js:85 `angle <= 180` and physics.js:89 `angle + change > 180`: all four accepted hulls cross 180 strictly, never landing on it, so `<`/`<=` and `>`/`>=` behave the same.
- sim.js:120 `ship.speed < 0`: zero speed still gives nonfinite visibility times and the same invalid-ship violation from the finite check.
- sim.js:164 `rock.x < 0` / `rock.y > 0`: generated chart coordinates are never exactly zero (checked algebraically over the seeded RNG).
- sim.js:165 outer-extent `>=`: no valid seeded rock pair has equal outer extent.
- sim.js:174 `Math.abs(across) < rock.radius`: the chosen disc's opening lane is strictly interior; no other forward disc can be tangent.
- sim.js:198 removed `checkSeedNight` call: `planHazards` immediately repeats the same validation.
- sim.js:212 `random() <= 0.5`: an exact 0.5 LCG draw needs a predecessor that already disables the threatening branch.
- sim.js:248 `[]`: every generated approach already has a valid budget period.
- sim.js:265 `+ 180` vs `- 180`: identical bearing modulo 360 (roundoff-only).
- sim.js:457, 464, 473 equality boundaries: the binary64 values involved can never equal the boundary exactly.
- sim.js:514 `>=` vs `>`: at equality both branches integrate the same interval (roundoff-only).
- sim.js:533–536 (four mutants plus three literals): `step`'s final cleanup overwrites the private dawn cleanup in `tick` before the state is returned.
- sim.js:560 `<= 1e-8`: no binary64 time near 180 differs from 180 by exactly 1e-8.
- record.js:6 `value.version` (optional chaining removed): parsed `null` throws into the existing catch, which returns the same `null`.

### Unresolved (not equivalent)

sim.js:207 `spawnTime < SPAWN.lastSpawn`, sim.js:217 (two bearing-sort mutants), sim.js:221 `width >= widest`, sim.js:235 `Math.abs(across) < rock.radius`, sim.js:443 `offset < NAVIGATION.maxOffset`, sim.js:465 `<= NAVIGATION.settleYaw` and sim.js:473 removed early rejection. Each needs an exact tie or endpoint that the public seeded API doesn't reach without replacing private functions.

## Baseline (before the survivor-killing tests)

## How it was measured

1. **Quick pass** (`npm run test:mutation:quick`, `stryker.quick.config.mjs`): every mutant against the suite minus the two slow 500-seed spawn sweeps. Result: 88.81% (1,538 killed, 231 timeout, 216 survived, 7 no coverage, 51 errors).
2. **Survivor pass** (`node scripts/mutation-survivor-pass.mjs`): only the source spans holding quick-pass survivors / no-coverage mutants, re-run against the **whole** suite including the spawn sweeps (433 mutants in those spans, ~159 min). All 223 quick-pass survivors/no-coverage mutants were re-tested; **37 of them were killed** by the full suite.
3. **Merge**: a quick-pass survivor that the survivor pass killed (or timed out) counts as detected. Every other mutant keeps its quick-pass status.

Mutation score = (killed + timeout) / (killed + timeout + survived + no coverage), Stryker's definition, which leaves runtime errors out.

## Merged score

| File | Killed | Timeout | Survived | No cov | Errors | Score | Score if errors counted as detected |
|---|---|---|---|---|---|---|---|
| keys.js | 22 | 0 | 17 | 0 | 0 | **56.41%** | 56.41% |
| morse.js | 255 | 0 | 6 | 0 | 1 | **97.70%** | 97.71% |
| physics.js | 239 | 71 | 35 | 0 | 50 | **89.86%** | 91.14% |
| record.js | 41 | 0 | 4 | 0 | 0 | **91.11%** | 91.11% |
| sim.js | 1018 | 160 | 117 | 7 | 0 | **90.48%** | 90.48% |
| **All files** | 1575 | 231 | 179 | 7 | 51 | **90.66%** | 90.90% |

### About the 51 "errors"

All 51 (50 in physics.js, 1 in morse.js) are RuntimeErrors where `tests/teeth.test.mjs`'s tap process exited with code 1, i.e. the test file crashed under the mutant. They are effectively detected, but Stryker doesn't count them in the score. Counting them, the total is 90.90%.

### About timeouts

391 mutants (mostly sim.js and physics.js) were classified Timeout, which Stryker counts as detected. These are mostly mutants that make simulation loops never terminate. The timeout knobs in `stryker.base.mjs` were tuned so that CPU throttling no longer inflates this number (see the comments there), but some timeouts may still hide slow survivors.

## Weak spots

1. **`keys.js` (56.41%)**: 17 survivors, all in the frozen `KEYS` / `CONTROL_LABELS` tables (emptied arrays, blanked key codes and labels). No test pins the exact bindings or the help-overlay labels, so a binding could be deleted without any test failing.
2. **`sim.js` (117 survivors + 7 no coverage)**: most survivors are boundary/equality flips (32), dropped conditions (26), arithmetic swaps (22) and blanked strings (24). Concentrations: `tick` and `step` (per-tick updates and the dawn/end-of-night edges at lines ~521–560), `clearsManeuver` / `chooseAvoidance` (avoidance geometry), `passesBetween` (budget-period edge), `extraApproaches` (trawler/coaster pick), `arrive` (callsign format) and `blastHorn` (ignored-blast 2 s window).
3. **`physics.js` (35 survivors)**: the midpoint-heading integration (line 60: sign of the half-turn and the `speed === 0` case), the 180° crossing interpolation (line 89), the sub-step remainder (lines 75–77), input-validation messages and guards in `checkVessel` / `checkRocks` (lines 18–42), and the seed-validation guard and draw/trust thresholds in `broadcastHorn` (lines 130–141).
4. **`morse.js` (6)** and **`record.js` (4)**: blanked error strings, the `/STEER [NSEW]$/` regex, `value.seed <= 0` vs `< 0` and `safe - wrecked` in the record check.

Survivors by function:

| File / function | Survivors + no cov |
|---|---|
| sim.js `tick` | 24 |
| keys.js `(module top level)` | 17 |
| sim.js `clearsManeuver` | 14 |
| sim.js `extraApproaches` | 14 |
| sim.js `step` | 12 |
| sim.js `arrive` | 9 |
| physics.js `broadcastHorn` | 7 |
| physics.js `integrate` | 7 |
| sim.js `planHazards` | 6 |
| sim.js `blastHorn` | 6 |
| physics.js `stepVessel` | 5 |
| physics.js `measureTacticalDiameter` | 5 |
| sim.js `validateSchedule` | 5 |
| sim.js `passesBetween` | 4 |
| sim.js `firstApproach` | 4 |
| sim.js `createState` | 4 |
| sim.js `keyLamp` | 4 |
| physics.js `checkVessel` | 3 |
| physics.js `checkRocks` | 3 |
| sim.js `chooseAvoidance` | 3 |
| sim.js `navigationHelm` | 3 |
| record.js `parseRecord` | 3 |
| morse.js `decodeKeying` | 2 |
| sim.js `checkSeedNight` | 2 |
| sim.js `perception` | 2 |
| sim.js `updateNavigation` | 2 |
| morse.js `encode` | 1 |
| morse.js `decodeLetter` | 1 |
| morse.js `keyingFor` | 1 |
| morse.js `parseMessage` | 1 |
| physics.js `createVessel` | 1 |
| physics.js `finite` | 1 |
| physics.js `parameters` | 1 |
| physics.js `hornRange` | 1 |
| physics.js `threatensReef` | 1 |
| sim.js `checkPeriod` | 1 |
| sim.js `spawnRangeFor` | 1 |
| sim.js `wrapBearing` | 1 |
| sim.js `clampSpeed` | 1 |
| sim.js `fogReach` | 1 |
| sim.js `planSpawns` | 1 |
| record.js `(module top level)` | 1 |

## Recommended CI minimum

Baseline total was **90.66%**, so the first CI threshold was 89. After the survivor-killing tests the CI-measured total is **96.18%** and `MUTATION_BREAK` is now **95**, keeping about a point of headroom for timeout noise between runners. The CI job uses the quick pass plus the survivor pass, sharded, because the full suite takes several hours on 7 workers.

## Baseline survivor list (after merge, before the survivor-killing tests)

| Location | Function | Mutator | Replacement | Status |
|---|---|---|---|---|
| keys.js:3 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:4 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:4 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:4 | (module top level) | ArrayDeclaration | `[]` | Survived |
| keys.js:8 | (module top level) | ArrayDeclaration | `[]` | Survived |
| keys.js:8 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:8 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:9 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:9 | (module top level) | ArrayDeclaration | `[]` | Survived |
| keys.js:11 | (module top level) | ObjectLiteral | `{}` | Survived |
| keys.js:12 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:12 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:12 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:13 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:13 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:13 | (module top level) | StringLiteral | `""` | Survived |
| keys.js:13 | (module top level) | StringLiteral | `""` | Survived |
| morse.js:15 | encode | StringLiteral | `""` | Survived |
| morse.js:22 | decodeLetter | StringLiteral | `""` | Survived |
| morse.js:28 | decodeKeying | StringLiteral | `""` | Survived |
| morse.js:34 | decodeKeying | StringLiteral | `""` | Survived |
| morse.js:65 | parseMessage | Regex | `/STEER [NSEW]$/` | Survived |
| morse.js:70 | keyingFor | StringLiteral | `""` | Survived |
| physics.js:18 | finite | StringLiteral | `""` | Survived |
| physics.js:21 | parameters | StringLiteral | `""` | Survived |
| physics.js:25 | checkVessel | OptionalChaining | `vessel.type` | Survived |
| physics.js:27 | checkVessel | StringLiteral | `""` | Survived |
| physics.js:27 | checkVessel | ConditionalExpression | `false` | Survived |
| physics.js:31 | checkRocks | StringLiteral | `""` | Survived |
| physics.js:34 | checkRocks | StringLiteral | `""` | Survived |
| physics.js:34 | checkRocks | EqualityOperator | `rock.radius <= 0` | Survived |
| physics.js:42 | createVessel | StringLiteral | `""` | Survived |
| physics.js:56 | integrate | ConditionalExpression | `false` | Survived |
| physics.js:59 | integrate | ConditionalExpression | `false` | Survived |
| physics.js:60 | integrate | ArithmeticOperator | `vessel.heading - (vessel.speed === 0 ? 0 : change / 2)` | Survived |
| physics.js:60 | integrate | ConditionalExpression | `true` | Survived |
| physics.js:60 | integrate | ConditionalExpression | `false` | Survived |
| physics.js:60 | integrate | EqualityOperator | `vessel.speed !== 0` | Survived |
| physics.js:60 | integrate | ArithmeticOperator | `change * 2` | Survived |
| physics.js:69 | stepVessel | StringLiteral | `""` | Survived |
| physics.js:75 | stepVessel | ArithmeticOperator | `steps / PHYSICS_DT` | Survived |
| physics.js:76 | stepVessel | ConditionalExpression | `true` | Survived |
| physics.js:76 | stepVessel | EqualityOperator | `remainder >= 1e-12` | Survived |
| physics.js:77 | stepVessel | CallExpression | `;` | Survived |
| physics.js:85 | measureTacticalDiameter | EqualityOperator | `angle <= 180` | Survived |
| physics.js:89 | measureTacticalDiameter | EqualityOperator | `angle + change > 180` | Survived |
| physics.js:89 | measureTacticalDiameter | ArithmeticOperator | `previous.x - (vessel.x - previous.x) * (180 - angle) / chang` | Survived |
| physics.js:89 | measureTacticalDiameter | ArithmeticOperator | `(vessel.x - previous.x) * (180 - angle) * change` | Survived |
| physics.js:89 | measureTacticalDiameter | ArithmeticOperator | `180 + angle` | Survived |
| physics.js:95 | hornRange | StringLiteral | `""` | Survived |
| physics.js:115 | threatensReef | StringLiteral | `""` | Survived |
| physics.js:128 | broadcastHorn | StringLiteral | `""` | Survived |
| physics.js:129 | broadcastHorn | OptionalChaining | `origin.x` | Survived |
| physics.js:130 | broadcastHorn | ConditionalExpression | `false` | Survived |
| physics.js:130 | broadcastHorn | LogicalOperator | `!Number.isInteger(seed) && seed < 0` | Survived |
| physics.js:130 | broadcastHorn | StringLiteral | `""` | Survived |
| physics.js:140 | broadcastHorn | EqualityOperator | `draw(seed, vessel.id, 71) <= 0.5` | Survived |
| physics.js:141 | broadcastHorn | EqualityOperator | `draw(seed, vessel.id, 37) > trust` | Survived |
| record.js:2 | (module top level) | StringLiteral | `""` | Survived |
| record.js:6 | parseRecord | OptionalChaining | `value.version` | Survived |
| record.js:6 | parseRecord | EqualityOperator | `value.seed <= 0` | Survived |
| record.js:9 | parseRecord | ArithmeticOperator | `value.safe - value.wrecked` | Survived |
| sim.js:44 | checkSeedNight | StringLiteral | `""` | Survived |
| sim.js:45 | checkSeedNight | StringLiteral | `""` | Survived |
| sim.js:65 | planHazards | ArithmeticOperator | `random() * 2 + 1` | Survived |
| sim.js:65 | planHazards | ArithmeticOperator | `random() / 2` | Survived |
| sim.js:67 | planHazards | ConditionalExpression | `true` | Survived |
| sim.js:68 | planHazards | ArithmeticOperator | `random() / (maximum - HAZARD.minRadius)` | Survived |
| sim.js:70 | planHazards | UnaryOperator | `+Math.cos(angle)` | Survived |
| sim.js:75 | planHazards | ArrayDeclaration | `[]` | NoCoverage |
| sim.js:78 | checkPeriod | StringLiteral | `""` | Survived |
| sim.js:86 | passesBetween | StringLiteral | `""` | Survived |
| sim.js:93 | passesBetween | ArithmeticOperator | `cycle + 1` | NoCoverage |
| sim.js:93 | passesBetween | ConditionalExpression | `false` | Survived |
| sim.js:93 | passesBetween | ArithmeticOperator | `cycle - offset` | Survived |
| sim.js:104 | spawnRangeFor | StringLiteral | `""` | Survived |
| sim.js:110 | validateSchedule | StringLiteral | `""` | Survived |
| sim.js:112 | validateSchedule | StringLiteral | `""` | Survived |
| sim.js:113 | validateSchedule | StringLiteral | `""` | Survived |
| sim.js:120 | validateSchedule | EqualityOperator | `ship.speed < 0` | Survived |
| sim.js:127 | validateSchedule | MethodExpression | `[firstVisible, pnrTime].some(Number.isFinite)` | Survived |
| sim.js:140 | wrapBearing | StringLiteral | `""` | Survived |
| sim.js:144 | clampSpeed | StringLiteral | `""` | Survived |
| sim.js:148 | fogReach | StringLiteral | `""` | Survived |
| sim.js:164 | firstApproach | EqualityOperator | `rock.x < 0` | Survived |
| sim.js:164 | firstApproach | EqualityOperator | `rock.y > 0` | Survived |
| sim.js:165 | firstApproach | EqualityOperator | `Math.hypot(a.x, a.y) + a.radius >= Math.hypot(b.x, b.y) + b.` | Survived |
| sim.js:174 | firstApproach | EqualityOperator | `Math.abs(across) < rock.radius` | Survived |
| sim.js:198 | planSpawns | CallExpression | `;` | Survived |
| sim.js:207 | extraApproaches | EqualityOperator | `spawnTime < SPAWN.lastSpawn` | Survived |
| sim.js:212 | extraApproaches | ConditionalExpression | `false` | Survived |
| sim.js:212 | extraApproaches | EqualityOperator | `random() <= 0.5` | Survived |
| sim.js:212 | extraApproaches | EqualityOperator | `random() >= 0.5` | Survived |
| sim.js:217 | extraApproaches | ArithmeticOperator | `a + b` | Survived |
| sim.js:217 | extraApproaches | ArrowFunction | `() => undefined` | Survived |
| sim.js:221 | extraApproaches | EqualityOperator | `width >= widest` | Survived |
| sim.js:221 | extraApproaches | ConditionalExpression | `true` | Survived |
| sim.js:226 | extraApproaches | EqualityOperator | `overlapping.filter(ship => ship.threatening).length > TRAFFI` | Survived |
| sim.js:235 | extraApproaches | EqualityOperator | `Math.abs(across) < rock.radius` | Survived |
| sim.js:235 | extraApproaches | ArithmeticOperator | `rock.radius ** 2 + across ** 2` | Survived |
| sim.js:246 | extraApproaches | ArithmeticOperator | `spawnTime + (NAVIGATION.exitRange - approach.spawnRange) / s` | Survived |
| sim.js:248 | extraApproaches | ArrayDeclaration | `[]` | Survived |
| sim.js:254 | extraApproaches | ArithmeticOperator | `gap / (1 - SPAWN.jitter + random() * 2 * SPAWN.jitter)` | Survived |
| sim.js:259 | arrive | StringLiteral | `""` | NoCoverage |
| sim.js:265 | arrive | ArithmeticOperator | `bearing - (approach.threatening === false ? 0 : 180)` | Survived |
| sim.js:266 | arrive | ConditionalExpression | `false` | Survived |
| sim.js:267 | arrive | ConditionalExpression | `false` | Survived |
| sim.js:269 | arrive | ConditionalExpression | `true` | Survived |
| sim.js:269 | arrive | StringLiteral | `''` | Survived |
| sim.js:269 | arrive | StringLiteral | `""` | Survived |
| sim.js:269 | arrive | StringLiteral | `"Stryker was here!"` | Survived |
| sim.js:272 | arrive | StringLiteral | `""` | Survived |
| sim.js:279 | createState | StringLiteral | `""` | Survived |
| sim.js:288 | createState | ArithmeticOperator | `0.08 - random * 0.04` | Survived |
| sim.js:288 | createState | ArrayDeclaration | `["Stryker was here"]` | Survived |
| sim.js:289 | createState | ObjectLiteral | `{}` | Survived |
| sim.js:302 | perception | ObjectLiteral | `{}` | Survived |
| sim.js:309 | perception | EqualityOperator | `elapsed <= off` | Survived |
| sim.js:357 | keyLamp | ConditionalExpression | `false` | Survived |
| sim.js:360 | keyLamp | ConditionalExpression | `true` | Survived |
| sim.js:360 | keyLamp | EqualityOperator | `edge >= keying.down` | Survived |
| sim.js:371 | keyLamp | EqualityOperator | `state.time * 1000 - keying.events.at(-1).up > 7 * keying.uni` | Survived |
| sim.js:388 | blastHorn | ConditionalExpression | `false` | Survived |
| sim.js:388 | blastHorn | EqualityOperator | `ship.status !== 'safe'` | Survived |
| sim.js:388 | blastHorn | StringLiteral | `""` | Survived |
| sim.js:401 | blastHorn | ConditionalExpression | `false` | Survived |
| sim.js:405 | blastHorn | ConditionalExpression | `true` | Survived |
| sim.js:407 | blastHorn | ArithmeticOperator | `bearingTo(ship) - 30` | Survived |
| sim.js:421 | navigationHelm | ArithmeticOperator | `vessel.yawRate * sign * spec.T - spec.K * Math.max(0, vessel` | Survived |
| sim.js:422 | navigationHelm | MethodExpression | `Math.min(0, vessel.rudder * sign)` | Survived |
| sim.js:423 | navigationHelm | ArithmeticOperator | `headingError(target, vessel.heading) / sign` | Survived |
| sim.js:427 | updateNavigation | ConditionalExpression | `false` | Survived |
| sim.js:431 | updateNavigation | EqualityOperator | `(rock.x - ship.x) * east + (rock.y - ship.y) * south + rock.` | Survived |
| sim.js:443 | chooseAvoidance | EqualityOperator | `offset < NAVIGATION.maxOffset` | Survived |
| sim.js:452 | chooseAvoidance | ObjectLiteral | `{}` | NoCoverage |
| sim.js:452 | chooseAvoidance | StringLiteral | `""` | NoCoverage |
| sim.js:457 | clearsManeuver | EqualityOperator | `elapsed <= NAVIGATION.predictionSeconds` | Survived |
| sim.js:457 | clearsManeuver | AssignmentOperator | `elapsed -= TICK` | Survived |
| sim.js:460 | clearsManeuver | ConditionalExpression | `false` | Survived |
| sim.js:460 | clearsManeuver | StringLiteral | `""` | Survived |
| sim.js:463 | clearsManeuver | EqualityOperator | `Math.hypot(vessel.x - rock.x, vessel.y - rock.y) < rock.radi` | Survived |
| sim.js:464 | clearsManeuver | EqualityOperator | `Math.abs(headingError(target, vessel.heading)) <= NAVIGATION` | Survived |
| sim.js:465 | clearsManeuver | ConditionalExpression | `true` | Survived |
| sim.js:465 | clearsManeuver | EqualityOperator | `Math.abs(vessel.yawRate) <= NAVIGATION.settleYaw` | Survived |
| sim.js:470 | clearsManeuver | ConditionalExpression | `true` | Survived |
| sim.js:470 | clearsManeuver | EqualityOperator | `navigation.phase !== 'resume'` | Survived |
| sim.js:473 | clearsManeuver | BooleanLiteral | `true` | NoCoverage |
| sim.js:473 | clearsManeuver | ConditionalExpression | `false` | Survived |
| sim.js:473 | clearsManeuver | EqualityOperator | `Math.cos(headingError(vessel.heading, navigation.course) * R` | Survived |
| sim.js:476 | clearsManeuver | BooleanLiteral | `true` | NoCoverage |
| sim.js:484 | tick | ArithmeticOperator | `steer * 24 / dt` | Survived |
| sim.js:486 | tick | ArithmeticOperator | `0.08 - 0.08 * state.time / NIGHT_SECONDS` | Survived |
| sim.js:486 | tick | ArithmeticOperator | `0.08 / state.time` | Survived |
| sim.js:488 | tick | ConditionalExpression | `true` | Survived |
| sim.js:488 | tick | EqualityOperator | `state.time - time <= 2` | Survived |
| sim.js:488 | tick | ArithmeticOperator | `state.time + time` | Survived |
| sim.js:497 | tick | ConditionalExpression | `true` | Survived |
| sim.js:499 | tick | ConditionalExpression | `true` | Survived |
| sim.js:499 | tick | EqualityOperator | `state.time > ship.reactAt` | Survived |
| sim.js:500 | tick | ConditionalExpression | `true` | Survived |
| sim.js:514 | tick | EqualityOperator | `ship.spawnTime >= state.time - dt` | Survived |
| sim.js:517 | tick | ConditionalExpression | `true` | Survived |
| sim.js:517 | tick | EqualityOperator | `Math.hypot(ship.x - rock.x, -ship.y - rock.y) < rock.radius` | Survived |
| sim.js:520 | tick | EqualityOperator | `Math.hypot(ship.x, ship.y) >= NAVIGATION.exitRange` | Survived |
| sim.js:521 | tick | EqualityOperator | `ship.x * Math.sin(ship.heading * RAD) - ship.y * Math.cos(sh` | Survived |
| sim.js:521 | tick | ArithmeticOperator | `ship.x / Math.sin(ship.heading * RAD)` | Survived |
| sim.js:521 | tick | ArithmeticOperator | `ship.y / Math.cos(ship.heading * RAD)` | Survived |
| sim.js:528 | tick | ObjectLiteral | `{}` | Survived |
| sim.js:533 | tick | ConditionalExpression | `false` | Survived |
| sim.js:533 | tick | BlockStatement | `{}` | Survived |
| sim.js:533 | tick | EqualityOperator | `state.time > NIGHT_SECONDS` | Survived |
| sim.js:534 | tick | StringLiteral | `""` | Survived |
| sim.js:535 | tick | BooleanLiteral | `true` | Survived |
| sim.js:536 | tick | BooleanLiteral | `true` | Survived |
| sim.js:544 | step | StringLiteral | `""` | Survived |
| sim.js:546 | step | ConditionalExpression | `false` | Survived |
| sim.js:547 | step | StringLiteral | `""` | Survived |
| sim.js:550 | step | StringLiteral | `''` | Survived |
| sim.js:553 | step | ArithmeticOperator | `NIGHT_SECONDS + state.time` | Survived |
| sim.js:554 | step | ConditionalExpression | `true` | Survived |
| sim.js:554 | step | EqualityOperator | `remaining >= 1e-9` | Survived |
| sim.js:560 | step | ConditionalExpression | `false` | Survived |
| sim.js:560 | step | EqualityOperator | `NIGHT_SECONDS - state.time <= 1e-8` | Survived |
| sim.js:560 | step | ArithmeticOperator | `NIGHT_SECONDS + state.time` | Survived |
| sim.js:560 | step | BlockStatement | `{}` | Survived |
| sim.js:563 | step | BooleanLiteral | `true` | Survived |

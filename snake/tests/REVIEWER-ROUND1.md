# Reviewer input/color repair and individual survivors

This is the test-only repair for PR147 FINDINGS round1. The public README's
Arrow/WASD and Space/P contracts, HTML player legend and independent reviewer
examples supply expectations. No product, workflow, dependency or design changes.

The suite keeps core methods real, including Renderer. Browser DOM/Canvas2D,
clock, timers, storage and randomness are explicit external ports; no proxy or
product-method replacement judges a recorded call history. Every arrow/WASD
alias starts from a fresh perpendicular heading in each active/inactive state.
Real multiplayer input for documented working players 1–3 covers counts 2/3/4;
pressed keys, repeat suppression after another legal heading, release, actual
model movement and routing isolation are asserted. Each Space/p/P key really
pauses and resumes state/UI without changing the run.

Supported player/control colors match the independent HTML legend; all primary
colors are valid literal hex values and glow data cannot be empty. The original
color-uniqueness assertion remains. A real two-player Game.update wall outcome
requires player 1 victory text and literal#00d4ff UI color, not only a potentially
undefined model color.

The three existing named skip guards remain unchanged. Their original bug
expectations are preserved; the player 4 assertion in the same named regression
explicitly extends its original real-browser up case to all four numpad
requests with fresh perpendicular headings. This records the existing product
bug, without asserting synthetic Num8 events as successful browser input.
Focused opt-in execution still fails exactly the original three named bugs by
ERR_ASSERTION. No new skip, tolerance, timeout, retry or gate is introduced.

## Actual validation

From repository root:

```sh
node --test --test-concurrency=2 --experimental-test-coverage --test-coverage-include='snake/js/*.js' snake/tests/logic.test.mjs
SNAKE_RUN_KNOWN_BUGS=1 node --test --test-concurrency=2 --test-name-pattern='corrupt saved|player four|a released multiplayer' snake/tests/logic.test.mjs
node --check snake/tests/logic.test.mjs
node --check snake/tests/harness.mjs
git diff --check
```

Frozen final53 pass/zero fail/three known skips,412.004968 ms. Opt-in command
expected exit 1 with exactly three ERR_ASSERTION failures/zero skips,80.797646 ms.
Loaded native coverage 85.35% lines/94.69% reported branches/87.50% functions;
five mutation modules 100% lines. Renderer is real but Canvas is a browser-port
fake, so no pixel, real layout/keyboard or physical-browser claim is made.

Both configured Stryker 9.6.1 runs completed with identical complete source,
config and all 531 ID/operator/location/replacement descriptors; concurrency 2,
coverage analysis off,1000 ms timeout/factor 1.5 unchanged. Published49-case baseline:
472 Killed/1 Timeout/58 Survived. Frozen53-case final:494/1/36. Strict88.89%->93.03%;
including timeout 89.08%->93.22%. All prior kills and the timeout retained;
22 survivors killed. No numeric break threshold is configured or introduced.
Main/game/renderer are integration-only and outside that five-module score.

From snake/ with the slot's already installed optional tools:

```sh
HEAVY_WAIT=0 TMPDIR="$CODEX_BURN_WORK/tmp" XDG_CACHE_HOME="$CODEX_BURN_WORK/cache" npm_config_cache="$CODEX_BURN_WORK/cache/npm" agent-mutate node "$CODEX_BURN_WORK/toon37-face-tools/node_modules/@stryker-mutator/core/bin/stryker.js" run stryker.config.mjs
```

Six guarded standalone source controls prove sensitivity. All original suites
pass49 with three known skips. The four deleted WASD setter statements and
empty real Game.togglePause each fail exactly one new assertion (52 pass);
exact Stryker 126 config removal fails two actual color assertions (51 pass).
Skips remain three, and no syntax/import/runtime failure counts. Manual
main/game faults are outside-set seeded controls and get no mutation score
credit. Product checkout remains unchanged. The first missing-Renderer-init
fixture trial's two TypeErrors are archived setup diagnostics; real public
Renderer.init establishes page setup without weakening any assertion.

## Existing assertion changes

The twelve rows below are the complete existing-assertion edit/deletion ledger.
Root independently parsed published/final test ASTs:228 old assert calls,
273 new; exactly these twelve old expressions lack identical counterparts,
with no uncovered removal. All other old assertions remain byte-identical.

| Published line/assertion | Frozen counterpart | Reason |
| --- | --- | --- |
|347 assert.deepEqual(calls,[[2,{x:0,y:-1}]])|376–380 actual player 2 queued up, player 1 stillright, W pressed and real head5,4|Eliminate Multiplayer.setPlayerDirection fake; judge real target/outcome.|
|350 assert.equal(calls.length,2)|389–394 W release clearspressed; newpress queuesup and real head4,3|Eliminate dispatch-count oracle; prove release re-enables real input after a changed legal heading.|
|354 assert.equal(calls.length,2)|395–400 unchanged actual players after Escape, Escape absent from pressed set|Preserve unrelated-key no-effect semantics with real state.|
|369 assert.equal(event.prevented,0), MENU/GAMEOVER ArrowUp|427 state-based expected0 for EVERY arrow/WASD alias in both inactive states|Fresh perpendicular input instances; original prevent-default assertion remains for all prior cases and expands coverage.|
|371 assert.deepEqual(calls,[])|428–430 inactive aliases preserve real nextDirection/current direction|Remove Snake.setDirection fake; preserve no steering outside play/pause.|
|377 assert.deepEqual(calls.at(-1),expected)|428–435 literal desired real nextDirection, applied direction and head delta for each freshalias/state|Remove stale spy-history oracle; every alias must actually steer independently.|
|378 assert.equal(event.prevented,1), active aliases|427 expected1 in PLAYING/PAUSED for same aliases|Same behavior asserted using state-selected expectedvalue, not weakened.|
|385 assert.equal(calls.length,before)|442–446 whole real Snake snapshot unchanged after Escape|Preserve unrelated-key no-effect semantics without a functionfake.|
|397 assert.equal(event.prevented,1), six loop events|459 pause.prevented1 and465 resume.prevented1, for each Space/p/P|Same six events now toggle real states and actual overlay.|
|400 assert.equal(paused,6)|460–469 actual PAUSED/PLAYING, overlayflex/none, framecancel, body/score retained, for each pausekey|Eliminate Game.togglePause fake; six calls now each produce required game/UI outcome.|
|403 nested assert.fail('multiplayer input reached single-player snake') in replacement Snake.setDirection|473–485 actual singleSnake remains byte-identical while player 2 queues/movesup and pressed W clears onkeyup|Remove the last core-function fake; preserve route-isolation semantics through real models.|
|509 player-four named skip: assert.deepEqual(plain(Multiplayer.getPlayer(4).snake.nextDirection),{x:0,y:-1})|654 same real browser-up assertion as first loop case, plus down/left/right with fresh perpendicular setup|Extend the SAME named product-bug regression to all documented numpad keys. Original failing-up semantic retained; total named skips remains three, no fake Num8 success asserted.|

## Individual survivors

For the 12 direction rows, the supported domain is initialized models with
plain numeric unit-cardinal headings/requests: up, down, left, right. On a
perpendicular request both component comparisons in either same/opposite pair
are false; forcing one component true leaves the other false. OR can newly
reject only same/opposite directions, already ignored by the companion guard.
The previously queued legal turn therefore remains unchanged. IDs 192/195/202/204
and407/410/417/419 change individual X/Y comparisons, not entire guards. This is
a domain argument, not a claim for diagonal/zero/nonfinite vectors, accessors,
replaced methods, uninitialized models or arbitrary internal side effects.

| ID / source | Public path | Assessment and exact limit |
| --- | --- | --- |
| 30 / `js/controls.js:44` | Controls.activePlayers initial value; getPlayerFromKey/getControlScheme/handleKeyDown | **Initialized-domain compatibility; preconfiguration gap.** Normal multiplayer init/setActivePlayers and resetToSinglePlayer establish the active list; existing tests require [1..count] and reset [1]. Empty preconfiguration can change a direct fresh Controls.getPlayerFromKey(ArrowUp) call. That raw preconfiguration lookup is not a documented browser input path; do not call the initial arrays identical or infer a full bootstrap proof from this domain. |
| 72 / `js/controls.js:109` | Controls.handleKeyDown(event), guard at109 | **Mapped-key domain equivalence argument; not arbitrary-event equivalence.** For configured active controls, public getPlayerFromKey/getDirectionFromKey maps each recognized key to a real unit-cardinal direction. For this successful-mapping domain the direction guard is satisfied; making it true cannot change the required real turn. Real ignored-key/repeat tests bound additional examples, not arbitrary event objects, altered control maps or null directions. A finite configured-key paired probe is the fallback if more evidence is needed. |
| 84 / `js/food.js:8` | Food.position before Food.spawn; spawn/checkCollision | **Equivalent after required spawn; raw pre-spawn state undocumented.** README gameplay requires food spawning; existing real spawn tests establish bounded coordinates and reject occupied cells. The initial position object is replaced before that initialized domain is observed. {} is not equivalent to the raw pre-spawn object, but no normal post-spawn difference is demonstrated. |
| 138 / `js/multiplayer.js:16` | Multiplayer.players before initMultiplayer/resetToSinglePlayer | **Equivalent after initialization/reset; raw pre-init inspection excluded.** Real init constructs the requested players and reset yields []; both are explicit existing assertions. A sentinel initial element can distinguish direct pre-init scans, which are outside the demonstrated active multiplayer lifecycle. No claim for arbitrary direct pre-init method calls. |
| 139 / `js/multiplayer.js:22` | Multiplayer.gameMode default; isMultiplayer() | **Undocumented literal representation; public single-mode result retained.** Public behavior is single mode versus multiplayer, with real mode-query tests. Empty initial tag is not the documented multiplayer selection, so the boolean single-mode result is retained. Exact internal default-tag spelling is not a documented serialized/public protocol; raw string identity differs. |
| 154 / `js/multiplayer.js:62` | Multiplayer.createSnake(playerId), arithmetic at62 | **Constructor-local observation gap; not declared universally equivalent.** The public supported IDs 1–4 have explicit initial positions, contiguous bodies, cardinal headings and valid color/control contracts in the tests/HTML. The historical test README mentions an unused local offset; this descriptor is the sole surviving createSnake playerId arithmetic. Those facts support a candidate unused-constructor-calculation explanation, not a new proof of data flow. No body was read and no public output difference was demonstrated. If stronger evidence is required, pair full constructed model plus legal movement for IDs 1–4; do not invent player IDs or an offset requirement. |
| 177 / `js/multiplayer.js:90` | Multiplayer.resetToSinglePlayer(), string at90 | **Undocumented literal representation; tested reset behavior retained.** Existing reset assertions require no players, one-player count, no winner, controls [1], and isMultiplayer false. The supported query/reset outcomes are preserved in the executed suite; exact private reset-mode spelling is not separately documented. No assertion for arbitrary raw tag identity is justified. |
| 191 / `js/multiplayer.js:107` | Multiplayer.setPlayerDirection; opposite predicate AND -> OR | **Equivalent under initialized unit-cardinal transition contract.** opposite predicate AND -> OR. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 192 / `js/multiplayer.js:107` | Multiplayer.setPlayerDirection; X-opposite comparison -> true | **Equivalent under initialized unit-cardinal transition contract.** X-opposite comparison -> true. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 195 / `js/multiplayer.js:107` | Multiplayer.setPlayerDirection; Y-opposite comparison -> true | **Equivalent under initialized unit-cardinal transition contract.** Y-opposite comparison -> true. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 201 / `js/multiplayer.js:112` | Multiplayer.setPlayerDirection; same-heading predicate AND -> OR | **Equivalent under initialized unit-cardinal transition contract.** same-heading predicate AND -> OR. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 202 / `js/multiplayer.js:112` | Multiplayer.setPlayerDirection; X-same comparison -> true | **Equivalent under initialized unit-cardinal transition contract.** X-same comparison -> true. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 204 / `js/multiplayer.js:112` | Multiplayer.setPlayerDirection; Y-same comparison -> true | **Equivalent under initialized unit-cardinal transition contract.** Y-same comparison -> true. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 224 / `js/multiplayer.js:154` | Multiplayer.checkCollisions(), participant collection at154 | **Bounded executed compatibility; not full equivalence.** Exact guarded paired probe: p3 first dies at a wall during real Game.update; later p1 enters retained in-bounds p3 tail. BOTH base and224 eliminate p1, leave p2 winner/GAMEOVER, and write Player 2 Wins with #00ff88. This refutes the proposed ignored-corpse oracle. Food/occupancy exclusion did not establish collision semantics. The observation is bounded to that actual scenario; no full collection-filter equivalence claim or new test/score credit. |
| 262 / `js/multiplayer.js:176` | Multiplayer.checkCollisions(), condition at176 -> true | **Unresolved internal evaluation guard; no demonstrated normal-path gap.** Descriptor/signature alone does not prove the guarded work is observationally redundant. Existing real wall/self/other/head collision tests pass this mutant, but passing cases are not a universal equivalence proof. A supported paired case with a player becoming wall/self-dead during the current collision phase could compare all players alive/body/score and final winner/UI. Do not guess the predicate body, invent a dead-ignore rule, use setter counts, or add a test without an executed public difference. |
| 285 / `js/multiplayer.js:187` | Multiplayer.checkCollisions(), condition at187 -> false | **Unresolved early-exit evaluation; no demonstrated normal-path gap.** Deleting an early stop may merely continue collision checks after elimination, but that body-level premise was not inspected/proved here. Public state is final elimination/winner, not internal predicate/write count. Existing real collision cases survive; a legal 3–4-player overlapping-collision paired outcome probe is a possible check if required. No blanket guard-equivalence claim and no new assertion absent demonstrated difference. |
| 337 / `js/multiplayer.js:253` | Multiplayer.isGameOver(), block253–256 removed | **Terminal-bookkeeping coverage limit; no demonstrated ordinary-run gap.** Fresh zero-alive draw and one-alive winner contracts are exercised; init clears stale winner before a new run. A prior winner followed by manually eliminating the last survivor and calling isGameOver again might expose stale bookkeeping, but that is post-terminal/manual-state behavior unless reproduced through a supported normal restart. Do not call it a known bug repair or require an undocumented stale-state rule. Exact body effect remains unproved under this no-body audit. |
| 354 / `js/multiplayer.js:291` | Multiplayer.stopCountdown(), guard at291 -> true | **Equivalent under standard browser timer semantics.** Normal setInterval returns a valid handle; stop removes it and resets countdown/handle. Repeated stop on null/absent handle has the same browser-visible result because clearInterval of a nonactive handle is a no-op. This excludes throwing/custom timer fakes, artificial callback invocation after cancellation, and using external call counts as gameplay semantics. |
| 368 / `js/snake.js:8` | Snake.body initial value; Snake.init(playerId) | **Equivalent after real Snake.init; pre-init data differs.** The existing real initialization test explicitly requires three contiguous initialized segments; normal supported movement/rendering follows initialization. The changed initial value is not the initialized model. Arbitrary raw pre-init access is distinguishable and is not declared equivalent; no normal post-init output difference is demonstrated. |
| 369 / `js/snake.js:11` | Snake.direction initial value; Snake.init(playerId) | **Equivalent after real Snake.init; pre-init data differs.** The existing real initialization test explicitly requires initialized right-facing direction; normal supported movement/rendering follows initialization. The changed initial value is not the initialized model. Arbitrary raw pre-init access is distinguishable and is not declared equivalent; no normal post-init output difference is demonstrated. |
| 370 / `js/snake.js:14` | Snake.nextDirection initial value; Snake.init(playerId) | **Equivalent after real Snake.init; pre-init data differs.** The existing real initialization test explicitly requires initialized right-facing queued direction; normal supported movement/rendering follows initialization. The changed initial value is not the initialized model. Arbitrary raw pre-init access is distinguishable and is not declared equivalent; no normal post-init output difference is demonstrated. |
| 371 / `js/snake.js:17` | Snake.growing initial value; Snake.init(playerId) | **Equivalent after real Snake.init; pre-init data differs.** The existing real initialization test explicitly requires no carried queued growth; normal supported movement/rendering follows initialization. The changed initial value is not the initialized model. Arbitrary raw pre-init access is distinguishable and is not declared equivalent; no normal post-init output difference is demonstrated. |
| 372 / `js/snake.js:23` | Snake.color initial value; Snake.init(playerId) | **Equivalent after real Snake.init; pre-init data differs.** The existing real initialization test explicitly requires initialized player color/fallback; normal supported movement/rendering follows initialization. The changed initial value is not the initialized model. Arbitrary raw pre-init access is distinguishable and is not declared equivalent; no normal post-init output difference is demonstrated. |
| 406 / `js/snake.js:81` | Snake.setDirection; opposite predicate AND -> OR | **Equivalent under initialized unit-cardinal transition contract.** opposite predicate AND -> OR. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 407 / `js/snake.js:81` | Snake.setDirection; X-opposite comparison -> true | **Equivalent under initialized unit-cardinal transition contract.** X-opposite comparison -> true. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 410 / `js/snake.js:81` | Snake.setDirection; Y-opposite comparison -> true | **Equivalent under initialized unit-cardinal transition contract.** Y-opposite comparison -> true. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 416 / `js/snake.js:86` | Snake.setDirection; same-heading predicate AND -> OR | **Equivalent under initialized unit-cardinal transition contract.** same-heading predicate AND -> OR. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 417 / `js/snake.js:86` | Snake.setDirection; X-same comparison -> true | **Equivalent under initialized unit-cardinal transition contract.** X-same comparison -> true. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 419 / `js/snake.js:86` | Snake.setDirection; Y-same comparison -> true | **Equivalent under initialized unit-cardinal transition contract.** Y-same comparison -> true. The domain argument above applies to this individual comparison/operator: perpendicular requests still pass, while any newly rejected same/opposite request is already ignored by the companion public guard contract. Queued turns remain unchanged for ignored requests. Not a claim for diagonal/zero/NaN/infinite vectors, accessors, replaced methods or uninitialized models. |
| 474 / `js/state.js:8` | GameState.MENU string tag | **Undocumented exact tag spelling; startup-coherence limit.** Public behavior is an inactive start menu and later explicit state transitions, not a serialized literal MENU value. Other state tags remain distinct in this individual mutation. Because the initial currentState is a separate declaration, this is not claimed to be a globally consistent alpha-renaming; raw constructor equality/bootstrap paths beyond the public real-state tests remain a limitation. No concrete visible startup failure was demonstrated. |
| 475 / `js/state.js:9` | GameState.PLAYING string tag | **Undocumented exact tag spelling; tested active-state behavior retained.** Real input/movement/pause consumers in the tests use the public PLAYING constant and actual state/UI outcomes; the altered string is still distinct from other tags. Literal private tag identity is not a documented external format. No claim for third-party code comparing a hard-coded string or untested initialization paths. |
| 476 / `js/state.js:10` | GameState.PAUSED string tag | **Undocumented exact tag spelling; real pause/resume outcomes retained.** Real key-driven pause/resume asserts PAUSED/PLAYING identity through constants plus overlay/frame/run data. A different private tag spelling is not itself a missing public outcome; it remains distinct. No equivalence claimed for a hard-coded external paused string protocol that is not documented. |
| 477 / `js/state.js:11` | GameState.GAMEOVER string tag | **Undocumented exact tag spelling; real terminal UI outcomes retained.** Normal Game.update winner/collision tests require GAMEOVER plus actual result UI. Changing a private string tag does not contradict that public contract when consumers use its constant. Raw string equality by undocumented clients and untested bootstrap variants are excluded. |
| 478 / `js/state.js:14` | GameState.currentState initial tag | **Inactive/pre-start representation; not raw-model equivalence.** Public HTML starts with start-screen shown and game/gameover screens hidden. Initial empty state remains non-PLAYING/non-PAUSED; play/pause/terminal paths establish their named states. A direct raw currentState==MENU constructor assertion would distinguish it, but that spelling/equality is not a public persisted format. No normal start-screen behavior difference was demonstrated; bootstrap consistency is an explicit limit. |
| 479 / `js/state.js:17` | GameState.gameMode initial tag; isMultiplayer() | **Undocumented initial mode-tag spelling; single-mode behavior retained.** HTML defaults to Single Player. Empty initial tag and normal single selection both are non-multiplayer under the tested public query; explicit HTML mode selections still use single/multiplayer as inputs. No claim that raw initial tag identity is unchanged or that arbitrary mode strings are supported. |
| 485 / `js/state.js:49` | GameState.ghostTrail; explicit settings initialization and normal Game.init bootstrap | **Explicit-settings compatibility; normal-bootstrap coverage remains unverified.** Existing real GameState.init/loadGhostTrail cases require false with empty storage and true only for serialized true. They do not establish whether normal Game.init overwrites the constructor value before the public BUTTON/OFF UI is ready. The one prepared exact 485 bootstrap probe returned guard exit 75 before Python/Node. Standby was canceled after a renewed reviewer reservation; no outcome, added test, skip, score change or normal-bootstrap equivalence is claimed. This is an explicit resource-blocked follow-up limit. |

All 36 survivors stay in the full 531 denominator, with no blanket cosmetic,
reachability or universal-equivalence claim. IDs 154/262/285/337 explicitly retain
observation/data-flow/terminal limits; no additional normal-path difference was
demonstrated by the read-only assessment. Raw/preconfiguration fields are not
claimed identical. No survivor is labeled a repair of one of the named bugs
without evidence. Timeout89 removes the food-spawn loop body and remains one
uncredited timeout, not an assertion kill.

A guarded exact 224 assessment first eliminates player 3 at a wall through real
Game.update, then has a living player enter the retained in-bounds tail on a
later frame. BOTH base and224 eliminate player 1, leave player 2 winner/GAMEOVER,
and display Player 2 Wins with#00ff88. This refutes the proposed dead-ignore
oracle: food/occupancy exclusion did not define collision behavior. The paired
observation is bounded to that scenario, receives no score credit and justifies
no new test or universal filter-equivalence claim.

## Attribution owner handoff

The normal author repair commit carries Co-authored-by and burn Agent trailers;
published history is not rewritten. Finding4's model label remains an
independent authorized-maintainer/automation requirement before merge. COMMON
prohibits this TESTS author from applying or creating labels. Last read labels
were empty; no label is claimed present. The PR body/reviewer response records
that handoff. The author never reviews/readies/merges/closes this draft.

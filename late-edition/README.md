# LATE EDITION // 1947

**1947 noir newsroom and broadsheet paste-up RTS.** Run the night desk of
*The Evening Star*: send reporters into the rain, lay out tomorrow's page and
keep useful secrets in the file drawer. The desk uses the ten-token art bible,
self-hosted period type and tactile paper objects.

## How to Play (1-2-3 Night Editor Workflow)

Open on a desktop at **1280×720 or larger**. The masthead shows your saved best
circulation. Click **Start the night shift** or press **Enter** to take the desk.
Lou Vance rings with a 30-second assignment; **Skip [Esc]** or Escape dismisses it
immediately, even mid-line. The title, call and idle first desk consume no edition
time: **night one's clock starts only after a successful dispatch**. A lead click
with no selected pass sends Jack Vance, the first reporter. Invalid or locked
orders leave the clock waiting. Publishing is unavailable before that dispatch.

The payroll opens gradually:

| Night | New tools |
| --- | --- |
| 1 | Reporters Jack and Peggy, leads and the page |
| 2 | Clara Reyes, photographer (`3`) |
| 3 | Knuckles Malone, fixer (`4`), and Guard Press (`E`) |
| 4 | Wiretap (`Q`), hush-money (`W`), night line (`T`) and automatic dilemmas (`Y`/`N`) |

Unavailable passes/actions stay off the desk and their shortcuts do nothing.
Saboteurs arrive no earlier than night three, when you can counter them.
Each edition runs **210 seconds** at 1×, or about 105 seconds at 2×. Lead lifetime
is 112 seconds; rival spawn intervals and the 40%-of-night phone window scale from
the former 90-second edition. Lead replenishment remains 0.65/s when below three,
with immediate replacement of scooped leads, preserving dispatch pace per minute.

Below either minimum dimension, **The desk is too small** covers the desk and
pauses both play and Lou's call. Resize back to resume the same state, including
an intentional pause. Reduced-motion preferences freeze canvas rain, fog, walking bob and title parallax,
disable CSS animation and reveal Lou's dialogue immediately; Skip remains available.
Reloading during the opening returns to an idle title. After a completed edition,
the title also offers **Continue the run (Edition N)** and **New run**; New run
asks before overwriting a valid saved run (see save/load below).


1. **① Pick a Manila Press Pass (`[1]`–`[4]` or Click Pass at Bottom-Left):**
   - **[1] Jack Vance (`BEAT-1` Reporter)** & **[2] Peggy Sullivan (`BEAT-2` Reporter)** — Investigate breaking city leads and file exclusive front-page scoops.
   - **[3] Clara Reyes (`FLASH-1` Photographer)** — Snaps Speed Graphic halftone photo proof on active leads (**1.8×** front-page circulation & revenue multiplier) and stuns rival operatives with her flashbulb.
   - **[4] "Knuckles" Malone (`ENFORCE-1` Street Fixer)** — Intercepts *Daily Herald* rival reporters and *Observer Syndicate* saboteurs (+$35 bounty per neutralization).
2. **② Click a Breaking Lead on the Map (or Pinned Yellow Telegram Wire Slip):**
   - Dispatches your selected operative along street avenues to investigate the lead before rival *Daily Herald* reporters scoop it.
3. **③ Lock up, lay out the page, then roll the presses:**
   - Scoops arrive **unplaced** in the copy tray. At **11:00 PM** (175 seconds),
     the desk shifts to paste-up and focuses the first story. Press **L** or click
     **Lock up the page** after the first dispatch to start earlier. Dispatch orders
     close during paste-up; assignments already in the field keep working.
   - Select a story with **Tab**, **arrow keys**, or a click. Drag its galley proof
     onto a slot, or assign with **1/B Banner (2.0×)**, **2/F Fold (1.5×)**,
     **3/P Photo (1.6×)**, **4/E Editorial (1.2×)**, **5/I Inside**, **6/S Spike**.
     These keys take precedence over operative/repair/pause keys during paste-up;
     the pause button still works. Enter/Space activates focused controls.
   - Occupied slots reject new copy. Select placed copy and press **U** or **Delete**
     (or Return to tray) before moving it; one story can never occupy two slots.
     **Inside** takes any count, at **¼ value, series bonuses, trust and heat**,
     rounded per story. Spike removes tray, front-page or Inside copy from scoring
     and files it as a dossier in the persistent drawer (see below).
   - A CRIME/GRAFT/SYNDICATE accusation in the Banner adds **8 extra heat**.
     An empty Banner prints its **wire stand-in and costs 6 trust**, including when
     other copy is placed. A wholly empty paper also retains its −12 trust and
     −1,800-reader penalty (−18 trust total).
   - **A** is an optional assist: fills only empty front-page slots from the tray,
     preserves manual placements, flags the edition **ASSISTED**, and subtracts
     **500 readers once per edition**, even if invoked on an empty tray. The flag
     and penalty appear in the projection and press report. Manual layout is the default.
   - Press **Space** away from controls or pull **ROLL PRESSES** to publish early.
     At midnight the paper prints **only what is placed**; pending drags are canceled,
     with unplaced stories retained in the tray. Escape cancels a drag without moving copy.

When trust reaches zero or saboteurs destroy the presses, the **PAPER FOLDED**
telegram shows the reason, edition reached, this run's peak circulation, and final
front page (the current paste-up if it has copy, otherwise the last printed page).
**Start a new night shift**, Enter or Space starts a fresh seed and Lou’s opening call;
the saved all-time record remains. Space on the telegram never rolls presses.

Keyboard-only: use **Tab/Shift+Tab** to reach passes, wire leads, scoops and page
slots; **Enter/Space** activates the focused control. **[1]–[4]** selects a pass before paste-up.
Space away from controls rolls presses; on an edition report it continues.
Reports move focus to their action and restore the previous control on dismissal.

## The file drawer — ink or leverage (#86)

Spike copy during paste-up to file its subject, tags and evidence. **D** (desk
drawer) or the tab at the left desk edge slides a manila folder over the map
(up to 420px wide), keeping the whole broadsheet visible; **D / Esc** closes it.
The slide lasts 180ms and is immediate with reduced motion. D works at the desk and during paste-up; **F / 2**
assigns Fold during paste-up. An open drawer blocks page/desk shortcuts.
Tab/Shift+Tab reach every action; Enter/Space uses the focused button. Carbon dots
show nights remaining; red pinholes count exposure. The drawer holds **six files**.
When full, spiking returns `drawer-full` without moving copy: choose **Shred** on a
specific dossier to admit the pending story, or **Cancel spike**. A deadline or
edition change cancels that pending choice. Shredding is permanent.

Files start at **3 freshness** and age once on each successful publish, including
that night's print. At zero they expire and are automatically shredded with a wire
notice (zero-freshness cards use yellow if rendered before cleanup). Drawer state,
subject status, pending calls and raid protection survive editions and participate
in the canonical hash. Reset clears them. The edition-boundary autosave preserves
this state, including source age/exposure and scheduled burned-source calls (see below).

- **Favor: police tip** consumes the file and puts a high-value lead in its subject's
  district immediately. A city with four active leads rejects without consuming it.
  Tip copy carries source age/exposure through investigation and re-filing; calling
  another contact cannot wash the same evidence into fresh cash payments.
- **Favor: stop goon / raid** removes one Observer goon, or banks protection against
  the next goon spawn. Protection persists across editions; duplicate protection rejects.
- **Favor: kill rival story** denies the Herald's current target lead to rivals;
  player investigation remains possible. No current rival assignment rejects.
- **Squeeze: cash / protection** pays `12 × weight × freshness` dollars, or reduces
  heat by `3 × weight`. It retains the file and increases exposure by one, then rolls
  the seeded burn chance `0.15 + 0.2 × exposure`: 35%, 55%, 75%, 95%, then guaranteed.
  Dead subjects and subjects exposed by publication or a prior burn reject blackmail.
  Burning destroys the file and schedules a private-line call **1–2 editions later**,
  even before the normal night-four phone unlock. Pay **$120**, or lose **12 trust**
  and gain **18 heat**. An unaffordable payoff rejects; timeout or printing with the
  call unanswered takes the trust/heat outcome. Due calls queue behind existing calls.
- **Print later** consumes the dossier into tray copy stamped **EXCLUSIVE — HELD**.
  It earns **+50% value** if its subject's arc/publication progressed since filing,
  otherwise **−25%**. Re-filing carries the original value, age and exposure, so it
  cannot refresh leverage or compound bonuses. Held tray copy also ages on publish.

The pure API is `useFile(uid, action, target?) → {ok, reason, effects}`: actions are
`favor` (`tip`, `stop`, `kill`), `squeeze` (`cash`, `protection`), and `print-later`
(no target). `shredFile(uid)` has the same result shape. Rejections are atomic,
including unknown IDs/actions/targets, expired evidence and closed-desk gates.
The retained `spikedStories` collection contains dossiers, each with a source-story
snapshot for printing later; `subjectStates` holds dead/exposed subjects.

All balance numbers live in `FILE_DRAWER` in `js/config.js`. Weight is the story's
value divided by 75, rounded up and clamped to 1–5. Even an adversarial RNG that
always evades burns cannot extract more than **$900 per fresh weight-5 dossier**
(five payments of $180). Re-filing cannot reset this bound. The economy regression
plays **20 seeds × 20 full nights × 2 bots**, with no synthetic scoops or stat resets:
a greedy bot squeezes every surplus file repeatedly for cash, and an ink-only bot
never spikes. Both must survive and total funds must stay below **$100,000**,
including print revenue. This ceiling is a test budget, not an in-game cash clamp.
The dedicated tests also attack repeated same-tick payment and print/re-file loops.

## Saving and continuing (#87)

The run autosaves **after you dismiss the press-run report**, ready for the next
edition. The report freezes the sim. Closing/reloading the page writes only while
still at that boundary (`clockSec === 0`, after a completed edition and dismissed
report). During an edition, the previous checkpoint remains intact: reloading
returns to its start. Mid-edition saves are deliberately unavailable because
replaying a partial night after seeing dispatch or burn outcomes would undermine
the deterministic checkpoint and allow save-scumming.

A valid save shows **Continue the run (Edition N)** on the title; it resumes the
desk directly, with that edition's payroll unlocks, tray, drawer, arcs, rivals,
source status, raid protection and queued calls intact. **New run** asks to confirm
overwriting. Cancel keeps the save. Game over removes the run save; best circulation
uses a separate key and survives. A damaged file displays **The morgue file is
damaged** and lets you start fresh. Blocked storage and quota errors show a notice
without stopping play; failed writes leave the last checkpoint untouched.

`LateEditionSim.serialize()` returns a JSON string; static
`LateEditionSim.deserialize(json)` returns `{ok: true, sim}` or `{ok: false, reason}`.
The pure sim has no browser storage dependency. `js/save.js` validates an explicit
allowlist; `js/adapters.js` reads/writes/removes the `lateEdition.run` key.
The format is `{format: 'late-edition-save', version: 1, seed, rngState, state}`.
`state.edition` is the next edition/unlock night. RNG state is restored directly,
without replaying draws. Arbitrary injected RNG implementations cannot serialize.
Display history (peak and last page) is retained; browser ports, best scores,
wire timestamps and decorative city effects are rebuilt rather than deserialized.

Version 0 means no defined format and is cleanly refused with an older-file
message. Future versions are also refused with an unsupported-version message.
Malformed/non-finite values, negative funds, trust/heat/HP outside their ranges,
more than six files, duplicate live UIDs, invalid counters, missing fields and
non-boundary snapshots are **rejected, never clamped**. Unknown fields and
`__proto__`/`constructor`/`prototype` keys are ignored; subject dictionaries retain
null prototypes. Inputs are capped at 2,000,000 characters with bounded inventories,
strings and nesting prescribed by the schema to bound decoding work.

The save suite checks round-trip hashes and a real seeded playthrough saved after
edition 2 then played for three further editions against uninterrupted play.
Adversarial tests cover malformed, mismatched and unsupported versions, tampered
values, duplicate inventory, pollution keys, quota/read/delete failures and the
report boundary. Browser tests exercise reload/Continue with a retained dossier,
overwrite cancel/confirm, mid-edition unload, corruption/version notices, storage
failures and game-over deletion.

## Tech Stack & File Layout

- Zero external runtime dependencies — self-contained ES modules + HTML5 2D Canvas + WebAudio synthesizer + original `.mp3` SFX.
- Procedural Canvas2D noir city and hat-and-coat silhouettes; two retained desk/press illustrations ([asset notes](assets/README.md)).

```text
late-edition/
├── index.html          # Two-Zone 1947 Mahogany Desk: Left Dispatch Blotter + Right Cream Broadsheet
├── css/
│   └── style.css       # Burled mahogany, strict art tokens, manila press passes & newsprint grain
├── js/
│   ├── dom.js          # Keyed DOM reconciliation; dynamic copy uses textContent
│   ├── main.js         # UI controller, wire stand-in/paste-up renderer & input bindings
│   ├── hotkeys.js      # Shared phase-specific shortcut table; collision-tested by Node
│   ├── sim.js          # 1947 city-dispatch, rival AI & edition economy, injected ports & canonical state hash
│   ├── rng.js          # Mulberry32 seeded PRNG, validated integer bounds & array selection
│   ├── adapters.js     # Safe run/score persistence, audio ports & URL seed parsing
│   ├── save.js         # Versioned save allowlist, validation and resource limits
│   ├── opening.js      # Pure 30-second cold-open text clock and reduced-motion reveal
│   ├── presentation.js # Display-only clock, wire, banner & status formatting
│   ├── city.js         # Fixed-seed cosmetic building generator, independent of gameplay RNG
│   ├── silhouettes.js  # Shared Canvas2D street figures and staff portraits
│   ├── renderer.js     # Cached oblique city/title layers, wet streets, fog & dynamic figures
│   ├── config.js       # Districts, operative roster, front-page slots & story catalog
│   └── audio.js        # Hybrid MP3 + procedural WebAudio typewriter, flashbulb & press SFX
└── assets/
    ├── audio/          # Newsroom & street MP3 sound effects
    └── sprites/        # Retained editor portrait & rotary press art; unit PNGs retired
```

## Status and Direction

Playable with investigative story arcs, rival scoop races and rotary-phone dilemmas.
The sim is deterministic: equal seeds, ordered inputs and elapsed-time steps produce
equal gameplay hashes. Browser storage, audio and clocks are injected ports.
See [AGENTS.md](AGENTS.md) for the module map and verification commands. ESLint, stylelint and HTML validation are
enforced in CI alongside adversarial gameplay tests and at least 80% line coverage
for `js/sim.js`. [docs/DIRECTION.md](docs/DIRECTION.md) is the creative direction
and art bible. Manual layout, the file drawer and the desk art pass are implemented;
the oblique silhouette city and shared operative portraits are implemented (#89). At 1280×720 and larger, all four
front-page slots stay visible together in both desk and paste-up. Grid tracks
share the available height; compact slot excerpts yield to complete headlines.
Only the copy tray and Inside list scroll when crowded, not the page or slots.

## Deterministic runs

Open `?seed=81` to choose the run's seed (`0` and signed safe integers are valid).
Missing/invalid seeds use `Date.now()` in `main.js`. Mulberry32 normalizes seeds to
unsigned 32-bit values. The browser supplies storage/audio adapters and a monotonic
clock; headless callers can use `new LateEditionSim({ seed: 81 })` with no browser.
An injected `rng` overrides `seed` and must provide `nextFloat()`; optional
`getState()` is included in the hash. Reset rewinds the built-in seeded generator;
callers own the lifecycle/reset of an injected generator.

Call `step(seconds)` with the same deltas and ordered commands for a replay.
Nonfinite, negative and zero deltas do nothing, including consuming no randomness.
Valid deltas subdivide into **at most 50 ms** steps; each call processes at most
**10 seconds**, dropping additional catch-up time to bound work after a long stall.
Normal frame-sized deltas keep their existing timing. A seed alone does not make
independently timed browser clicks/frame sequences identical.

`getStateHash()` returns eight hex digits: FNV-1a over UTF-8 canonical JSON
(sorted object keys, ordered arrays) of gameplay state, RNG state/draw count,
IDs/counters, economy, movement, leads, arcs, dilemmas, edition summaries and the
last-published time (which prevents duplicate publication within a sim tick).
Stored best scores, adapters, wire messages/timestamps, traffic, banners,
flashes, callouts and all cosmetic fields (colors/accents, labels, district signage,
operative descriptions, summary copy, angles and animation phases) are excluded:
they never drive gameplay. The injected `now()` supplies wire event timestamps
only; gameplay time always comes from `step()`. City geometry and rain use their own fixed cosmetic seed, independently of the
gameplay generator; renderer animation uses its own display clock.

The golden test runs five full 210-second editions with progressive payroll,
dispatches, investigation, manual placement during paste-up, rivals, fortification
and night-four/five phone choices, asserting a pinned hash after each print.
Issue #86 repins the hashes for story subjects, subject publication state/progress,
pending burned-source calls and raid protection; replay inputs are unchanged.
Issue #88 performs a one-time repin as cosmetics leave the hash; recursive filtering
applies to the entire projection and preserves ordered arrays. The same replay also
checks every print's circulation, funds, credibility, heat, press HP, edition, scoops
and drawer against [a snapshot](tests/fixtures/pre88-gameplay.json) recorded by
running pre-#88 commit `2c8b14e` and verifying its original goldens. Gameplay is unchanged.
#100 removes the duplicate Herald district standings row and repins the hashes.
A reserved publish-time RNG draw preserves all later seeded gameplay. The
pre-#88 snapshot compares player state only (no rival rows) and remains untouched.
Standings now contain only the Herald and Observer alongside the player paper;
save validation rejects unknown/duplicate rivals. Existing v1 checkpoints discard
only the validated historical third row when loaded; new saves contain two rivals.
Storage reads that are absent, corrupt, nonnumeric, negative or nonfinite become
zero. Blocked reads and quota-exceeded writes never interrupt play; the current
run's best is retained in memory.

New simulations and `reset()` begin at `phase: "title"`. Call `startNightShift()`,
then `finishColdOpen()` to enter the desk; a successful dispatch releases the
first-night clock. The UI drives the separate `ColdOpen` presentation clock.
`deskTooSmall` stops simulation without changing `paused` or the opening phase.
`lockUp()` enters `phase: "paste-up"`; `placeStory(uid, slotId)`, `unplace(uid)` and
`spike(uid)` return `{ok, reason}` and reject atomically outside active paste-up,
including at/after the deadline, behind reports, on a folded run or a small desk.
Slot IDs are `banner`, `above_fold`, `photo_expose`, `editorial`, `inside`.
`spike(uid)` is the SPIKE command, separate from placement; `spikedStories` persists
as dossier cards until consumed, shredded or expired. `insideStories` is cleared on print. `assistLayout()` owns assist scoring.
The numeric `edition` counter is retained for compatibility; its scoring flag lives
in `editionLayout.assisted` and is captured as `editionSummary.assisted` before reset.
Projection and publishing use the same scoring function.

Publishing returns `true` on success and `false` for a duplicate in the same sim
tick, a destroyed press or a finished run. The first print can happen at time zero after dispatch;
another requires simulated time to advance. Reset clears the guard and returns to title.

## Development checks

Use Node 22.22+ (22.x) or 24.8+. From `late-edition/`:

```bash
npm ci
npm run lint
npm run test:coverage
```

`lint:js`, `lint:css` and `lint:html` run ESLint 10 flat config, stylelint's
standard config and html-validate's recommended checks separately. There are no
rule relaxations or lint disables. `npm test` checks deliberately bad fixtures,
lint failure exit codes, clean real sources, PRNG validation, five-edition golden
replays and adversarial sim/adapter inputs; fixtures are excluded from normal
lint runs. `test:coverage` runs the same suite with native Node coverage, includes
only `js/sim.js`, and fails below 80% line coverage. The area suites pin current
dispatch, publish, phone, economy, arc, race and sabotage behavior; fuzz tests run
50 seeds through three editions of legal/illegal commands and both terminal paths,
checking numeric bounds, unique plates and sticky game over after every action.
The classic-script fixture exercises `no-implicit-globals`, which
cannot fire for module-scoped declarations. Documentation checks and their shell
self-tests are listed in [AGENTS.md](AGENTS.md).
The hotkey suite builds the complete application shortcut map from `HOTKEYS` in
`js/hotkeys.js`, rejecting duplicate keys in each desk, paste-up, drawer-open or
modal phase. Injected collisions include the original F/Fold/drawer regression.
Browser regressions verify F plates Fold without opening the drawer, D toggles
in both desk phases, and drawer/modal overlays prevent shortcut leakage.

These are development dependencies only; the game still deploys without a build.
The root `.dockerignore` excludes `late-edition/node_modules/` and
`late-edition/tests/` because the Dockerfile copies the repository into the static
server image. Tests and their deliberately invalid fixtures are never game assets.

## Browser verification (#83–#87)

Use the supported Node version in `package.json` (22.22+ in 22.x, or 24.8+):

```bash
npm ci
npm run lint
npm run test:coverage
npx playwright install chromium
npm run test:e2e
# Repeat the desk input regressions, including the permanent 4x CPU case:
npm run test:e2e -- e2e/desk.spec.js --repeat-each=5
```

Playwright starts Python's static HTTP server at the repository root on port 8123.
The tests in `e2e/` are linted and excluded from the explicit `tests/*.test.mjs`
Node test glob and Docker image. GitHub's `late-edition` job installs Chromium
with its OS dependencies, runs the suite and uploads the HTML report, screenshots
and traces on failure. Reports go to ignored `playwright-report/` and `test-results/`.

Each browser test checks console errors and uncaught exceptions. Tests use the
existing `window.lateEditionApp` inspection handle to force trust collapse and
hostile copy. The click contract is **100 actual pointer clicks on currently live
lead buttons = exactly 100 calls returning true from `dispatchOperativeToLead`**,
with simulation time advancing throughout, at both normal speed and 4× CPU
slowdown through Chromium's CDP. Every pointerdown must target a live lead;
no failed clicks are excluded or retried. Same-frame regressions force a scoop
(with immediate replacement) and expiry between display ticks, asserting that
obsolete buttons disappear while surviving keyed buttons stay attached.
Separate cases hold a pointer down across changing renders, verify keyed
node/focus/hover retention, remove stale
leads, inject HTML-shaped text, hold restart keys and resize during keyboard-only
play through one published edition. Every scenario records actual requests
before navigation and rejects external origins; no remote stylesheet interception can hide a request. Art cases assert
all four font families load, then block all fonts and verify the fallback layout
at 1280×720, including 200% CSS layout zoom (magnification plus reflow, rather than
CDP pinch-only scaling), paste-up, drawer and publication. Container queries keep
magnified controls reachable by scrolling. The minimum physical desk gate remains
1280×720; browser-frame dimensions distinguish 200% browser zoom from a smaller
window without treating Retina DPR as zoom. Screenshots for the PR are maintained
by the owner.

Gameplay lists, including Inside copy, reconcile keyed nodes; unchanged subtrees stay attached between
250 ms display ticks. Lead membership also reconciles immediately after each
simulation frame that changes IDs/order, so scooped or expired leads cannot
remain clickable until the next display tick. Container event delegation is bound
once. Runtime DOM copy uses `createElement`/`textContent`, with no `innerHTML`
templates. Sim history
(`peakCirculation`, `lastPrintedFrontPage`) is display-only and excluded from
canonical gameplay hashes; deterministic replay behavior remains unchanged.

The shared browser helper takes existing desk scenarios through Start, Skip and
first dispatch. Opening tests separately force a mid-line skip, reload, a missing
selection, locked keys, every payroll unlock, the full 30-second call, exact
1279×720 / 1280×719 rejection and 1280×720 acceptance, resize recovery during play
and the call, retained user pause, and live reduced-motion preference changes.

Paste-up browser cases exercise pointer drags, occupied-slot rejection, plated
spiking, all six keyboard destinations, Tab/arrow selection and unplacing, canceled
drags, deadline expiry during both pointer and keyboard input, empty-banner trust,
and visibly scored assist. Run browser suites sequentially: concurrent Playwright
runs share and clear the same report/artifact directories.

Drawer browser cases cover spike → open → police tip → visible lead, keyboard-only
squeezing with stable focus, full-drawer shred selection, cancel, and deadline
invalidation of a pending spike. Fuzzing includes file use/shredding, enforces six
files maximum and unique UIDs across drawer, tray, Inside and page.


## Art and font credits (#88)

[Font credits and OFL licenses](assets/fonts/README.md) cover League Gothic
(The League of Moveable Type: Tyler Finck, Caroline Hadilaksono, Micah Rich),
Old Standard TT (Alexey Kryukov),
Courier Prime (Alan Dague-Greene) and UnifrakturMaguntia (j. 'mach' wust / Peter
Wiegel). The pinned google/fonts TTFs are converted to Latin WOFF2 by
[scripts/build-fonts.py](scripts/build-fonts.py), using fonttools and Brotli in a
venv. No font or runtime asset uses an external origin. Unifraktur is reserved
for mixed-case The Evening Star mastheads; the fallback stacks are Impact/Arial Narrow,
Georgia and Courier New. The title masthead stays on one line at supported
sizes. All four broadsheet slots fit together without scrolling at supported
desk sizes; grid tracks share available height. Body excerpts end in an ellipsis
after two lines (one in compact slots), with secondary decks/bylines omitted in
compact slots. Headlines remain complete. At 200% zoom, the document reflows
and scrolls with intrinsic slot heights to keep controls reachable.

The ten CSS root colors mirror `PALETTE` in `js/palette.js`. The custom stylelint
plugin runs core `color-no-hex` and `function-disallowed-list` rules outside root
declarations; Node tests forbid JS hex/rgb literals outside the palette, and
compute every text-role contrast (minimum **4.66:1**, maximum **15.34:1**).
Carbon dots have newsprint backing because blue on aged stock fails 4.5:1.
Grain is a small inline monochrome SVG; rotations are deterministic and shadows
fall down/right from one lamp. Paper and stamp animations last 120ms and switch
off for reduced motion. The city geometry and procedural silhouettes follow #89 below.

The caption baseline counts non-whitespace static label text nodes in
`index.html`, excluding comments, script/style, attributes and fields replaced
at runtime (the fixture lists the exact dynamic IDs), including static controls:
**74 → 37 nodes** (50% reduction), **286 → 99 words** (65.4%). Including initial
dynamic placeholders, all body text nodes fall **103 → 44**, and words
**395 → 121**. The browser checks the static caption counts against the committed
pre-#88 baseline fixture, so removing a temporary placeholder cannot count as a
caption reduction.

District accents and every other color field are cosmetic and excluded from the
gameplay hash. No legacy palette checksum data is needed; recoloring must leave
the hash unchanged while changes to gameplay values must still be detected.


## Silhouette city and performance (#89, 2.10.0)

The Weegee / *The Big Clock* / *Sweet Smell of Success* map uses 30-degree oblique
roofs with lighter top faces over ink-dark fronts, lamp-directed soft street shadows,
setbacks/parapets, smoke cornices and fire escapes, solid water-tower silhouettes,
sparse sodium windows and wet lamp reflections. Each neighbourhood has one landmark:
City Hall dome, Pier 14 cranes/pier, Herald clock tower, Observer warehouse sign,
Evening Star press room/rooftop sign, trust bank columns, meatpacking stacks and the
Velvet marquee. Pier cranes have solid masts, booms and counterweights. Mahogany
only warms masses near lamps. All eight small street signs slide along their district curbs to avoid
telegram flags, headlines and series badges, stepping into an adjoining street when
four flags cover both curbs. An impossible fixture covering the whole map retains
one stable sign at the least occluded curb position.
Rain and drifting edge fog obscure the outskirts without changing gameplay visibility.

`js/city.js` derives six buildings per district from fixed seed **1947** and district
identity. The stream is separate from simulation RNG, and generation order does not
matter. `js/silhouettes.js` draws the same fedora/trench coat figures on the map and
staff passes: camera/flash reflector for Clara, broad shoulders for Knuckles, brass
hats for Herald men and a red cigarette ember for Observer goons. Selected staff have
a sodium ground ring and small number badges. Map figures are scaled 1.6×, with long
cast shadows and a larger camera/flash reflector; pass portraits retain their scale. Telegram flags are
pinned exactly at lead coordinates, with sodium glow; arc yarn remains red. Herald sedans use sodium
headlights; only Observer raids use police-blue cones. Scoops get a brief Weegee
flash; the photographer's existing snap produces a flashbulb star. No unit PNG is
loaded; the editor portrait and press plate remain in use (see asset notes).

`NoirCityRenderer` caches city geometry/lamps, ink-only edge shading, and three title depth
layers on detached canvases at the displayed size × DPR. Caches rebuild on size/DPR
changes only, after the initial local font load settles. Each frame composites these layers and draws traffic, figures, leads,
threads, collision-offset street signs, weather and callouts. Title layers dissolve
into an ink-to-faint-mahogany/sodium horizon through low-contrast dark haze, with an
ink-black near skyline, bridge, solid water towers and sparse windows. The Evening
Star sign, slow parallax and a low-alpha sodium municipal searchlight complete it.
Reduced motion freezes rain, fog, bob and parallax and suppresses scoop/camera flashes; title pixels remain
identical across frames, including after changing the preference during play.

The presentation never writes simulation state or changes coordinates, hit radii,
input priority or dispatch rules. Existing five-edition golden hashes and the recorded
pre-#88 gameplay-equality fixture remain unchanged. Tests compare gameplay hashes and
RNG state before/after real cold-cache, warm-cache, resize and DPR rendering. Invalid
cosmetic seeds/geometry reject; outputs never share mutable building/window arrays.
Browser cases click ten distinct actual addresses at both 1280×720 and 1920×1080,
exercise inside/outside hit boundaries, unit priority and closed-dispatch rejection,
and reject console errors and all `unit_*.png` network requests. The 1600×900 review
regression also rejects smoke-grey distant pixels and brightened corners, forces
flags onto every district’s usual sign position and attaches title/map screenshots.

The performance scenarios launch Chromium with ANGLE **SwiftShader** at 1080p.
They record five seconds of live rAF intervals/render costs, then invoke the real
renderer 150 times synchronously with fixed dt. Both live and deterministic render
p95 must be **<8ms**, or **<16ms with CDP 4× CPU throttling**. The batch follows
live sampling so its queued raster work cannot bias presentation measurements.
Gameplay hash/RNG and warm-cache identity must remain unchanged by the batch.

Frame p95 **<20ms** remains mandatory on the unthrottled run when independent
foreground calibration (empty page, then a blank full-viewport canvas) achieves
**≥55fps and p95 <20ms**. Slow or software rendering hosts still enforce renderer
budgets; no environment variable or game frame rate can waive them. Calibration,
render costs, frame intervals and waiver reasons are attached to the browser report.
Missing/corrupt calibration fails, and an adversarial test starves rAF while making
the real renderer exceed its budget to verify that the batch still collects 150
samples and exposes the slow calls.

Paper grain uses the original SVG turbulence baked once to a 120×120 PNG tile;
small drifting-fog sprites follow displayed resolution/DPR, and street-sign widths
and collision positions are cached until lead display geometry changes. Rain
remains one stroked path; no per-frame shadow blur or resolution cap was added.
See [profiling notes](docs/PERFORMANCE.md) for the PR #101 diagnosis, trace commands,
local before/after measurements and the limits of CPU submission timing.

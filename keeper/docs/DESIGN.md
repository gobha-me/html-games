# Keeper — Design

*Creative director: Grok Bot. Status: v1 locked for build. Changes to anything
marked **LOCKED** need the director's sign-off; everything else is open to
playtest feedback.*

> You keep the light on Skerry Rock through one long night of fog. The sea is
> black except where your beam falls. You cannot watch everything. Choose.

## 1. Pillars (LOCKED)

1. **Attention is the resource.** The only thing scarcer than light is time.
   Every second the beam spends on one patch of sea is a second it is not on
   another. All tension comes from this; we add no timers, meters or combos to
   manufacture it.
2. **Darkness is the canvas.** The screen is ~85 % black. The beam is the
   only meaningful light source and is the thing that *reveals* the world —
   ships, rocks, wreckage, swimmers are simply not drawn outside it (except
   for faint cues listed in §5).
3. **Quiet.** No music during play. Wind, sea, the turning mechanism, the
   horn, the lamp shutter. Silence is a feature; a sound must earn its place.
4. **The keeper speaks with their hands.** Communication is physical: the
   horn is held, the Morse lamp is keyed by the player in real Morse. No
   menus of canned messages.
5. **The log is the story.** No cutscenes, no dialogue boxes. What you saw
   and wrote down, night after night, is the narrative. The mystery is
   discovered, never announced.

The deliberate opposite of *Late Edition*: one person, one light, one
decision at a time, nothing to juggle.

## 2. Core loop

**Moment to moment (seconds):** watch the beam sweep → glimpse something at the
edge of the light → decide: hold the beam there, keep sweeping, or swing back →
identify it (silhouette, running lights, behaviour) → act (horn, lamp, log) →
the rest of the sea has been dark this whole time.

**Per night (~8–10 minutes real time):** dusk → fog thickens → a scripted set
of ships and events plays out over the night → dawn ends the night → the
log is reviewed and a short morning summary (ships safe, lost, logged) is
shown.

**Across nights (v1: 5 nights):** log entries accumulate; specific
observations unlock or alter later nights; the final night resolves the
mystery according to what the keeper actually recorded.

## 3. The beam (LOCKED core verb)

- The light rotates clockwise continuously at **sweep speed** (one full
  revolution = **12 s** at default). A full sweep costs real time — that cost
  is the game.
- **Steer:** `←/→` (or `A/D`) push the rotation speed between **slow** (one
  rev ≈ 30 s) and **fast** (one rev ≈ 6 s). Reversing direction is **not**
  allowed: a lighthouse lens turns one way; to look back you must go round.
  *(This is the single most important feel decision; see playtest Q1.)*
- **Hold:** `Space` (held) clutches the lens — the beam stops on its bearing.
  Holding is free but the rest of the sea is blind.
- Mouse: hovering a bearing does nothing (we don't want point-and-click
  aiming). Mouse is used only for the log UI.
- Beam is a cone ~**14°** wide, reach to the fog horizon. Fog density
  (per night, varying) shortens effective reach; objects beyond reach show at
  most as a brief smear.
- Afterimage: a lit object stays faintly visible for **~1.5 s** after the beam
  leaves (fading phosphor-like), so the player can track motion between
  sweeps without seeing everything.
- Warning budgets use the **12 s default revolution**, regardless of the
  player's current speed. Fast adds opportunities; slow and hold deliberately
  spend them. See **Fairness: sweep budget** in §7.

## 4. Controls (desktop, keyboard-first)

| Key | Action |
|---|---|
| `←` / `A` | Slow the sweep |
| `→` / `D` | Speed the sweep |
| `Space` (hold) | Hold the beam on its bearing |
| `H` (hold) | Foghorn (sounds while held) |
| `K` (hold/tap) | Signal-lamp key — tap = dot, hold = dash |
| `L` | Open / close the keeper's log |
| `Esc` / `P` | Pause |
| `?` | Controls card |

One shared key table in code; a test fails on any duplicate binding (the
Late Edition F/D lesson). Gamepad is a non-goal for v1.
Controls appear on the title card, in the persistent bottom bar, and in a
watch overlay for the first **8 s of simulation time**. First keyboard or
pointer input fades that overlay; pause stops its clock, restart restores it.
Reduced motion removes the fade transition.

## 5. The sea, the rocks, the fog

- Top-down, radial: the lighthouse sits at the centre-bottom third of the
  screen on Skerry Rock; the sea fans out around it. World is a polar map
  (bearing, range) with ships moving in world coordinates.
- **The Teeth**: a reef band north-east of the light, and a few isolated
  rocks, are fixed and known (drawn faintly on the keeper's chart overlay,
  never on the sea itself). A ship whose course crosses a rock **wrecks**.
- **Off-beam cues** (the only things visible in the dark): a ship's running
  lights as tiny points *if* it is showing them and within half the reach;
  the sound of an engine (panned by bearing) once audio lands. Smugglers
  show neither.

## 6. Ships & behaviours

All ships start on seeded deterministic courses and use the same physical
maneuvering model. The first watch opens with its original trawler and adds
seeded traffic; the simulation, horn and renderer operate on a fleet, with
independent responses for each ship.

| Ship | Look | Behaviour | What you must do |
|---|---|---|---|
| **Trawler** (v1 issue 1) | squat hull, mast, running lights | Plods a course that may cross the Teeth. | Find it with the beam; broadcast the horn early → it alters course away. Unwarned → wreck. |
| **Steamer / coaster** | long hull, two lights | Faster, wider turning circle — warn earlier. | Horn earlier; may ask by lamp "WHAT LIGHT" — answer the station code. |
| **Smuggler** | low dark launch, no lights | Runs dark close to the rocks, slows when lit, flees if lit for > 3 s. Never wrecks (knows the water). | Notice and **log** it (bearing, time). Holding the beam on it is a choice: you learn more, but everything else goes dark. |
| **Lifeboat / boat in distress** | small, flare or lamp flashing SOS | Drifts toward the rocks; flashes `SOS` in Morse. | Light it (so the shore boat can find it), signal `K`-style acknowledgement, and log it. Unlit too long → lost. |
| **Swimmer / wreckage** (mystery nights) | tiny, only visible in beam | Drifts. | See it. Log it. |

### Seeded additional traffic (kspawn)

`planSpawns(seed, { night = 1 } = {})` returns only the extra approaches,
ordered by spawn time, with consecutive unique ids `ship-1`, `ship-2`, etc.
Seeds must be integers in [0, 2³²−1]; invalid seeds or nights outside 1–5
throw `RangeError`. Planning uses a private seeded LCG, never the wall clock
or `Math.random`, and cannot be changed by mutating a previous result.
`createState(seed)` keeps its original seed validation and opening trawler
trajectory, then stores `[trawler, ...extras]` in `state.schedule`.

All public pacing tunables live in the frozen `SPAWN` export:

| Tunable | Default | Meaning |
|---|---:|---|
| `firstMin` | 24 s | Earliest first extra arrival, at the second default revolution. |
| `firstMax` | 36 s | Latest first extra arrival, at the third default revolution. |
| `intervalStart` | 40 s | Unjittered gap at the beginning of the 180 s watch. |
| `intervalEnd` | 18 s | Unjittered gap at dawn; the ramp uses the entire watch duration. |
| `jitter` | 0.25 | Each gap is multiplied by a seeded factor in [0.75, 1.25]. |
| `maxActive` | 3 | Maximum overlapping inclusive active windows, including the opener. |
| `lastSpawn` | 120 s | Latest allowed arrival; the final minute introduces no new ships. |
| `minBearingGap` | 20° | Minimum circular bearing separation for overlapping windows. |
| `threatShare` | 0.6 | Probability that a candidate takes a reef-threatening course, before rejection. |

The first extra time is drawn within [`firstMin`, `firstMax`]. After an
accepted arrival at time `t`, the next gap is
`(intervalStart + (intervalEnd − intervalStart) × t / NIGHT_SECONDS) × jitterFactor`.
Each slot tries at most **eight** seeded candidates. Capacity, separation and
fairness are never relaxed. An exhausted slot ends the plan: accepting a
later slot could violate the maximum gap between consecutive accepted ships.
Rejection can change the final proportion of threatening traffic.

Threatening traffic approaches the isolated north-west rock on bearings
within ±3° of its centre. This separates it from the opening trawler's
north-east lane. It uses the hull's cruise speed, maximum crew delay and
physics-derived maneuver allowance. Four-pass nights use trawlers for these
approaches because a coaster's full turn and warning window do not fit the
464.8 m horizon; later nights can admit coasters too. Clear traffic can use
either hull and sails **outward** from 464.8 m, beyond every inflated reef
disc. Its entire straight course remains clear even beyond dawn; no collision
immunity or special horn response is needed. Both use the shared ship physics.

Every entry declares `type`, `spawnTime`, `bearing`, `speed`, `threatening`,
`responseSeconds`, `turnRadius`, `pnrRange`, `spawnRange` and `exitTime`.
The inclusive active window is **[spawnTime, exitTime]**. The opener and
threatening traffic conservatively reserve capacity until dawn, since a
warning can prevent their projected impact and prolong their voyage. Clear
traffic reserves its outbound trip to the 590 m chart boundary, plus two
fixed ticks to cover arrival/exit quantization, or until dawn if earlier.
Terminal ships remain in the fleet for wrecks, afterimages and the morning
summary; their continued presence does not reuse a reserved window early.

A planned ship joins `state.ships` on the first fixed tick whose time reaches
its spawn time, with status `underway`. It travels only the portion of that
tick after arrival, and can hear a fresh horn on that tick. A horn already
held at arrival sends no new broadcast. The existing renderer visits every
fleet member through `perception`; unseen future ships have no live hull.
Morning records use version 2 for multiple safe/wrecked outcomes while still
reading legacy one-ship version 1 records from the existing storage key.

### Horn broadcast and directed lamp

The **horn is an omnidirectional broadcast** meaning “rocks near”, never an
aimed command. Every ship at distance ≤ `hornRange(fogDensity)` hears each
blast: range is **700 − 350 × fogDensity metres**, strictly decreasing from
700 m in clear air to 350 m in the densest fog. Beam illumination, running
lights and afterimages have no bearing on hearing. Pressing H starts one
broadcast; holding sustains its sound, releasing and pressing sends another.

Each honest captain projects its straight track against the reef discs over
**`THREAT_HORIZON_SECONDS = 120` seconds** (including the exact endpoint).
An endangered ship turns toward safe water, away from the nearest reef; a safe
ship holds course. A reef 10 km down the track beyond that horizon does not
make the ship endangered, for either horn response or trust. A dark smuggler
deterministically ignores the horn or veers onto a course away from the
lighthouse. Seeded crew delays vary within the hull's reaction band below;
fleet ordering cannot change those draws.

### Foghorn trust, spam and visual feedback (#109)

- **Trust starts at 1**, remains within [0,1], and recovers at **0.01 per
  simulated second** throughout the night, capped at 1. Recovery continues
  while the horn is held, during ignored periods and after wrecks; dawn stops
  it. Lower trust increases delay within the hull's band and reduces the
  seeded turn-away probability.
- A press edge (**false → true**) emits one blast. If no endangered ship hears
  it, trust falls by **0.25**, floored at zero. Any endangered listener makes
  an accepted blast useful, regardless of whether its captain obeys. Danger
  outside hearing range does not justify a blast.
- `state.blasts` retains recent blast timestamps. A blast is **spam on the
  fourth press**, when at least three earlier blasts are **strictly less than
  20 seconds old**. An earlier blast exactly 20.000 seconds old no longer
  counts. Spam sets `state.hornIgnoredUntil = blastTime + 30` (initially 0).
- Spam and every blast while `time < hornIgnoredUntil` elicit **no new ship
  response**, course command or `warnedAt`; each costs 0.25 trust even with
  endangered listeners. Previously scheduled maneuvers continue. Blasts
  during the ignore window **never extend its deadline**. At the exact expiry,
  a new blast can be heard (or start a fresh spam window if its history warrants).
- Holding H sustains audio but sends **no further broadcasts**. A ship entering
  range during that hold must wait for release and repress. Paused/help modes
  do not step the sim, so H there creates no blast, trust change or ring.
  Every UI mode change clears held keys and `state.horn`, allowing a fresh
  press after resuming.
- `hornRings(state)` returns one `{ radius, alpha, ignored }` per blast with
  age in **[0,2)** seconds. Radius is `hornRange(state.fog) × age / 2`, alpha
  is `1 − age / 2`, and ignored status is fixed at emission (recent ignored
  timestamps live in `state.ignoredBlasts`). Rings expand around the lighthouse
  to the current fog-limited hearing range, independently of held H or mute.
  Ignored rings are **dimmed and dashed**. The HUD shows skipper trust as a
  percentage; the read-only automation snapshot exposes the exact trust and
  ignore deadline.

### Directed lamp

The **Morse lamp is directed**: it addresses only the ship currently in the
beam. A lamp message is not a broadcast horn and cannot warn unseen ships.
The lamp/decoder remains future work (§8); this split governs its integration.

### Maneuvering physics (#120)

`js/physics.js` is pure: metres, seconds, north-positive y, and heading in
degrees clockwise from north, normalized to [0,360). The canvas simulation
converts its south-positive y at the boundary. Both run at **1/60 s**; frame
hitches use the same fixed substeps, with a final fractional step if needed.
No wall clock, browser globals or unseeded randomness is allowed in either
module (the same lint guard and coverage gate apply).
`createVessel(type, { x, y, heading, speed, id, smuggler })` requires explicit
finite x, y and heading: missing or undefined values throw `RangeError`.
Only speed (hull cruise), id (type) and smuggler (false) default.

The commanded rudder is clamped to ±35° and swings at the hull's limited
rate. First-order Nomoto yaw follows `T × yawAcceleration + yawRate =
K × rudder × speed/cruiseSpeed`. The exponential yaw update preserves
continuous turns and reversals instead of snapping the bow to a new bearing.
At zero speed there is no steerage or rotation. Linear thrust and drag give
acceleration/deceleration: full throttle settles at cruise speed in straight
water, while full rudder adds 25% drag (80% cruise equilibrium). Integration
uses midpoint yaw/translation. A delayed escape helm turns away from the
reef, then anticipates rudder/yaw inertia to settle onto the reciprocal
course. The renderer rotates the hull and running lights from this physical
heading; remembered poses retain the last observed heading.

The tactical diameter is measured by starting straight at cruise, applying
full rudder, and interpolating transverse displacement at 180° heading
change, including rudder/yaw startup and speed loss. Tuned measurements:

| Hull | Length (m) | Cruise (m/s) | Rudder rate (°/s) | K (1/s) | T (s) | Reaction (s) | Diameter (m / lengths) |
|---|---:|---:|---:|---:|---:|---|---|
| Trawler | 12 | 1.1 | 7.5 | 0.08 | 4.5 | 1.8–2.5 | **45.32 / 3.78** |
| Coaster | 30 | 3 | 5 | 0.05 | 8 | 2–2.5 | **197.99 / 6.60** |
| Speedboat | 6 | 6 | 90 | 1.2 | 0.35 | 1–1.4 | **16.44 / 2.74** |
| Lifeboat | 8 | 3 | 55 | 0.45 | 0.7 | 1.1–1.7 | **21.92 / 2.74** |

### Physical point of no return

`pointOfNoReturn(vessel, rocks)` returns a conservative warning lead in
seconds **before projected straight-track impact** (zero for a clear track
or stationary vessel). It simulates maximum crew delay and both full-rudder
escape turns, measuring their maximum forward travel. A separating plane
before every forward reef disc includes neighbours beside the initial track;
clearing that plane prevents steering into an adjacent rock. The lead also
reserves two fixed ticks for scheduling/integration. The simulation uses
identical reef discs, inflated by its 8 m hull clearance, for prediction,
PONR and collision.

Each radial approach still declares spawn time, bearing, speed, response
seconds, `turnRadius`, reef-entry `pnrRange` and spawn range. The generic
sweep-budget API remains compatible with #118: for live physical approaches,
`responseSeconds` is the hull's maximum crew delay and `turnRadius` is the
**effective maneuver allowance**, `speed × (pointOfNoReturn − responseSeconds)`,
rather than the old constant angular-rate circle radius. The radial reef
entry is computed from the actual lane/disc intersection. Thus the budget's
warning boundary is exactly `pnrRange + speed × pointOfNoReturn`.

At seed 108, the trawler's reef entry is **362.31 m**, physical lead **31.28 s**,
warning boundary **396.72 m**, and derived spawn **462.72 m**. It has **60 s**
before PONR and wrecks unwarned near **91.28 s**. Cruise was tuned to 1.1 m/s
to fit the full physical turn and default sweep quota inside the watch's
shortest fog reach (464.8 m). A ship that has turned onto a clear escape
track counts safe and continues sailing, even if still on the chart at dawn.

Fast vessels (**speed ≥ `FAST_SHIP_SPEED`, currently 8 chart m/s**) expose
`perception(state).engineCue = { bearing, intensity }` while underway and
unlit, including beyond fog reach. Intensity is `1 / (1 + range / fogReach)`,
increasing toward the listener. Lit, safe, wrecked or slower ships return
`null`. This is a deterministic audio hook only; engine synthesis/panning
lands in #115. It reveals no hull pose, and is not credited as a beam pass.

## 7. Failure & success

- **No game over mid-night.** Wrecks happen and are remembered — the sea goes
  on. This is a quiet game; failure is a weight, not a reset.
- A night ends at dawn. Morning summary: ships passed safely, wrecked,
  distress answered, entries logged.
- **The lamp-keeper's record**: three wrecks across the run and the Board
  relieves you after the night (soft ending, "Relieved of duty"); you may
  restart the night.
- Success is surviving all five nights; the *ending* depends on the log (§9).
- Scoring is deliberately understated: no points on screen during play.
- An invalid ship schedule **refuses to start**: the title card displays the
  offending ship index, reason and pass count, and disables Take the watch.
  Validation runs at load and again on every start/restart.

### Fairness: sweep budget

Each ship independently gets at least **N beam passes** from its first
visible moment (entry into fog reach, or spawn if already inside) through
PNR. Nights 1–5 require **4, 4, 3, 3, 2** passes. Concurrent ships never
divide or share this budget; later pressure comes from concurrency.

The guarantee is budgeted against **`BUDGET_PERIOD_SECONDS = 12`**, the
default clockwise revolution. `spawnRangeFor` derives the minimum range:

```
warningBoundary = pnrRange + speed × responseSeconds + turnRadius
                = pnrRange + speed × pointOfNoReturn  # live physical approaches
minimumSpawnRange = warningBoundary + speed × (N + 1) × 12
```

The extra revolution covers worst-case phase: a ship just behind the beam
waits nearly 12 s for its first pass. **Fog reach must extend at least to
this minimum range too.** Moving a ship farther outside the fog cannot buy
visible warning time. If the horizon cannot fit the budget, reduce speed or
adjust the approach/visibility; spawning farther away alone is insufficient.
Night 1 validates against its shortest reach over the entire watch (464.8 m).

Additional traffic uses this same minimum horizon and its selected night's
pass quota. Each threatening candidate must fit its **entire** derived spawn
range within 464.8 m and pass `validateSchedule` at the actual initial beam
phase (285°). Its PNR is strictly after first visibility. The extra revolution
also protects other beam phases; tests independently enumerate crossings for
every scheduled ship across 500 seeds. Capacity and bearing separation apply
to every overlapping pair, including the opening trawler, and never divide
the individual warning budget. Clear outbound traffic has no reef PNR;
its nonnegative radial budget fields keep full-schedule validation compatible.

The pure `validateSchedule(schedule, { night, fogReach, period, phase0 })`
computes each radial ship's first-visible and PNR times, then uses
`passesBetween` to count centre-line crossings in **(firstVisible, PNR]**.
The opening instant is excluded, the closing instant included; **exactly N
is valid, N−1 is rejected**. Missing/non-finite or impossible physical fields,
PNR before visibility, and insufficient passes produce indexed violations.
Invalid night parameters throw rather than silently weakening the budget.

The design guarantee assumes the player leaves the lens at default speed.
Accelerating toward a **6 s** revolution adds passes. Slowing toward **30 s**
or holding the beam trades attention to one bearing for darkness elsewhere;
those deliberate choices are **not covered** by the guarantee. A speed
change mid-window does not change the schedule's 12 s design budget.
`passesBetween` describes a constant period; tests of piecewise periods
carry the actual beam phase into each new segment, with held segments
adding zero passes. The validator never pretends a held beam is sweeping.

## 8. Morse signal lamp

The lamp is a **directed channel** to the vessel currently in the beam; the
omnidirectional horn is the separate broadcast warning channel (§6).

- Real International Morse. `K` down < **250 ms** = dot, ≥ 250 ms = dash
  (threshold adapts slightly to the player's own average dot length,
  bounded 150–400 ms). Letter gap ≥ 3 dot-units, word gap ≥ 7.
- Lamp flashes are visible on screen as the shutter opening; a sliding
  strip shows what was sent, decoded live (`·−·` → `R`). Unrecognised
  sequences show as `?` — no autocorrect.
- Ships signal back in Morse at a readable speed (≈ 8 WPM in v1), visible as
  a blinking point that the player must read; an optional **reference card**
  (`?`) shows the alphabet. A setting slows incoming to 5 WPM.
- Vocabulary v1 (small, fixed): `SOS`, `K` (go ahead), `R` (received), `AR`
  (end), `WHAT LIGHT` / station code `SKR`, `ROCKS`, `STEER N|S|E|W`,
  `WHO`. Ships respond to a parsed message; nonsense gets `?` back or nothing.
- Pure, deterministic decoder in its own module, exhaustively tested.

## 9. The log & the mystery

**Log mechanic.** `L` opens a paper page (the only warm, lit UI in the game).
Each entry is assembled, not typed: *time* (auto) · *bearing* (current
beam bearing, auto) · *what* (choose from things the beam actually
revealed this night — you cannot log what you did not see) · *note*
(optional pick from a short list, e.g. "running dark", "signalled SOS",
"no name visible", "same boat as before"). The page persists across nights
(localStorage, versioned schema).

**Arc outline (v1 = 5 nights; content written in the mystery issues):**

1. **Night 1 — The Light.** Tutorial by situation, not text: a trawler, then
   another; one runs for the Teeth. A dark launch slips past once near dawn
   — most players will miss it.
2. **Night 2 — Running Dark.** The launch returns, same bearing, same hour.
   A coaster asks `WHAT LIGHT`. If you logged the launch on night 1, it now
   appears in a "seen before" note option.
3. **Night 3 — Distress.** A boat flashes `SOS` near the Teeth while the
   launch passes on the far side. You cannot light both. Whichever you
   choose is recorded.
4. **Night 4 — The Previous Keeper.** Wreckage drifts in: a crate stencilled
   with the Board's mark. The trawler skipper lamps `WHO KEEPS`. The first
   pages of the log (written by the previous keeper, present from night 1)
   now read differently: he logged the launch too, then stopped.
5. **Night 5 — Fog Bank.** The thickest fog. The launch comes in toward the
   rock itself. Ending depends on entries: whether you logged the launch
   consistently, whether you answered the distress, and whether you signal
   the launch away from the rocks or let it hit them.

The answer (director's bible, not in UI): the previous keeper was paid to
keep the light *off* the launch's course, and stopped logging it; the
crate is the Board's own supplies being run out. Endings: **Report** (log
is complete; you hand it over at relief), **Silence** (you stopped logging,
like him), **Lost** (the launch wrecks). No ending is labelled good.

## 10. Art direction (LOCKED)

- Canvas 2D. Background `#05070a`-ish blue-black. Fog is a slow, layered
  noise field that the beam lights up (the beam is *visible in the fog*,
  volumetric-looking cone), so the light itself is the main visual.
- Objects are flat silhouettes lit from the light's direction; colour only
  from lamps: warm sodium beam, red/green running lights, white Morse
  flashes, a flare's magenta.
- The rock and lantern room at the bottom are a small, dark shape; the
  lens's glint is the brightest pixel on screen.
- UI is minimal: a thin bearing ring at the edge, the clock, and (when
  open) the log page. No HUD bars.
- Readability floor: every interactive object must be identifiable within
  1 s of being lit at default fog. Respect `prefers-reduced-motion`
  (no fog drift, no screen shake).

### Lamp anchor and pixel detail (kbeam-ISSUE)

The existing overhead view, compass ring, chart, labels, layout and HUD
colours stay fixed. The chart uses a 1280×720 logical canvas, translated to
**(640,478)** and scaled by **0.86**. Renderer exports are safe to import in
Node: browser access happens only when `createRenderer(canvas)` is called.

- Frozen `LAMP = { x: 0, y: 0 }` is the single lamp centre in chart coordinates.
  `beamOrigin(beamDegrees)` returns that same point for every finite numeric
  bearing, including negative bearings and multiple turns; other values throw
  `TypeError`. Cone and radial beam glow translate to that origin. Lantern,
  symmetric rotating lamp housing, halo and brightest glint centre on `LAMP`.
- `toScreen(point, { width, height })` shares `draw()`'s transform and returns
  **canvas backing pixels**: `x = (640 + point.x × 0.86) × width / 1280`,
  `y = (478 + point.y × 0.86) × height / 720`. Resize rounds CSS dimensions
  multiplied by DPR (capped at 2); pass those backing dimensions, without
  applying DPR again. Width and height scale independently, as before.
- Skerry Rock keeps its small footprint with stepped rock tiers, shoreline
  highlights, shaded ledges, masonry bands, a railed gallery and lantern
  details. Foundations render beneath the beam; the lantern/glint render last.
  Surf advances through four pixel phases at two phases per simulation second,
  using only `state.time`. Reduced motion fixes surf at phase zero and freezes
  fog drift. No wall clock or random draws enter either animation.

`tests/renderer.test.mjs` checks import purity with throwing browser-global
getters, thousands of bearings, invalid inputs and screen mapping across sizes
and DPRs. `e2e/renderer.spec.js` samples the brightest pixels at the beam start
at ten bearings, at 1280×720 and 1600×900 with DPR 1 and 2. It compares their
centroid to the lamp position within 0.75 backing pixels and inspects real
cone/glow draw coordinates to catch an offset concealed by the glint. Separate
shoreline pixel comparisons verify deterministic animation and reduced motion.

## 11. Audio direction (LOCKED rules)

- WebAudio synthesis or CC0/CC-BY assets with credits only.
- Bed: wind (filtered noise, slowly modulated), sea (low noise with swell
  envelope). Lens mechanism: very faint rhythmic tick tied to rotation speed.
- Foghorn: two-tone diaphone synthesis (low, long, beating). Lamp: shutter
  click on key down/up. Ship engines: low chug panned by bearing.
- A master mute, and the game is fully playable muted (every audio cue has
  a visual counterpart).

## 12. Scope v1

Desktop ≥ 1280×720, vanilla HTML/CSS/JS ES modules, no build step, no
runtime dependencies. Five nights, five ship types, horn, lamp, log, three
endings, save/resume per night. Simulation in a pure module (`js/sim.js`,
seeded RNG, no DOM/time globals — same lint guard as Late Edition) so it
can be tested headlessly. Rendering/audio/input are thin adapters.

Tooling mirrors `late-edition/`: ESLint (flat, `--max-warnings 0`),
Stylelint, html-validate, `node --test` with ≥ 80 % line coverage on
sim modules, Playwright e2e, its own CI job. NOLINT/disable comments only
specific with an inline reason.

## 13. Non-goals (v1)

Mobile/touch, gamepad, multiplayer, procedural infinite mode, voice acting,
music during play, a map editor, difficulty settings beyond the Morse speed
option, 3D/WebGL, any monetisation, achievements.

## 14. Playtest questions for the user

1. **No reverse sweep** — does being unable to swing back feel like
   meaningful tension, or just frustrating? (Fallback: allow reverse at
   half speed.)
2. Is a 12 s default revolution the right cost? Too slow and it's boring,
   too fast and nothing is a choice.
3. Is the afterimage (~1.5 s) enough to track a ship between sweeps?
4. In the first playable, did you notice the trawler before it was in
   danger, and did the horn's effect read clearly?
5. Is the screen *too* dark on your monitor?
6. Does the silence feel deliberate or empty?

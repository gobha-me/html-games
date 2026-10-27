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
- **The Teeth**: a fixed reef band north-east of the light. Isolated hazards
  are seeded per night; all are charted (drawn faintly on the keeper's chart
  overlay, never on the sea itself). A ship whose course crosses a rock **wrecks**.
- **Off-beam cues** (the only things visible in the dark): a ship's running
  lights as tiny points *if* it is showing them and within half the reach;
  the sound of an engine (panned by bearing) once audio lands. Smugglers
  show neither.

## 6. Ships & behaviours

All ships start on seeded deterministic courses and use the same physical
maneuvering model. The first watch opens with a trawler on a seeded hazard lane and adds
seeded traffic; the simulation, horn and renderer operate on a fleet, with
independent responses for each ship.

| Ship | Look | Behaviour | What you must do |
|---|---|---|---|
| **Trawler** (v1 issue 1) | squat hull, mast, running lights | Plods a course that may cross the Teeth. | Find it with the beam; broadcast the horn early → it alters course away. Unwarned → wreck. |
| **Steamer / coaster** | long hull, two lights | Faster, wider turning circle — warn earlier. | Horn earlier; may ask by lamp "WHAT LIGHT" — answer the station code. |
| **Smuggler** | low dark launch, no lights | Runs dark close to the rocks, slows when lit, flees if lit for > 3 s. Never wrecks (knows the water). | Notice and **log** it (bearing, time). Holding the beam on it is a choice: you learn more, but everything else goes dark. |
| **Lifeboat / boat in distress** | small, flare or lamp flashing SOS | Drifts toward the rocks; flashes `SOS` in Morse. | Light it (so the shore boat can find it), signal `K`-style acknowledgement, and log it. Unlit too long → lost. |
| **Swimmer / wreckage** (mystery nights) | tiny, only visible in beam | Drifts. | See it. Log it. |

### Ship variety mechanics (#111)

The immutable numeric exports in `sim.js` define these deterministic rules:

- **Dark launch:** `type: 'speedboat', smuggler: true` has no running lights
  or replies. While beam-lit, throttle is `SMUGGLER_LIT_THROTTLE = 0.5`,
  approaching half cruise speed through the existing thrust/drag model;
  darkness restores full throttle. Continuous illumination accumulates in
  `litSeconds` and resets on any unlit tick. **Strictly more than**
  `SMUGGLER_FLEE_SECONDS = 3` sets response `flee`, overriding a horn veer.
  Exactly 3 seconds does not flee. The launch turns radially away from the
  lighthouse, keeps that outward course and eventually exits. It still slows
  if lit while fleeing. Reef contact never assigns it a wreck.
- **Distress lifeboat:** distress is opt-in via the specialty's `distress: true`
  flag; a generic `lifeboat` hull retains ordinary honest navigation and horn behavior.
  A distress boat remains `underway` until saved
  or lost. On arrival it heads toward the nearest hazard at
  `LIFEBOAT_DRIFT_THROTTLE = 0.15` (0.45 m/s straight cruise), stopping at
  reef contact while awaiting rescue rather than entering the wreck path.
  It starts a repeating `keyingFor('SOS', incomingWpm)` reply immediately;
  a seven-unit word gap separates calls. The normal `perception.signal`
  path exposes its flash point within fog reach, without revealing its hull.
  It has no running lights. Horns do not steer or rescue it.
  `unlitSeconds` runs only while underway and **resets to zero on every lit
  tick**. At `LIFEBOAT_LOST_SECONDS = 24` (two default sweeps) without light,
  it becomes `lost`, stops drifting/flashing, and cannot be rescued later.
  Light alone buys time; rescue requires a directed `K`, `R` or `AR` message
  addressed to this boat while it is currently beam-lit at completion, using
  §8's same single-recipient rules. Rescue sets `safe`, stops drift and SOS,
  and counts in `summary().safe`. Other messages leave its SOS running.
- **Coaster:** an underway honest coaster asks `WHAT LIGHT` once after
  `COASTER_ASK_SECONDS = 1` continuous second of beam illumination. An unlit
  tick resets that continuous timer; the once-only `askedLight` flag survives
  darkness. Its question uses the normal incoming-WPM reply flashes. Directed
  `SKR` receives the existing `R` acknowledgement. Hull turning remains the
  wider coaster tuning in `HULLS`.

Specialties are **opt-in scripted approaches**, leaving `planSpawns` and
default `createState` traffic and all five night pass quotas unchanged.
The pure exported builder accepts
`specialtyApproach({ id, type = 'speedboat', smuggler = true, bearing,
spawnTime = 0, spawnRange = 464.8 })`. For `type: 'lifeboat'`, `smuggler`
defaults to false and must remain false, and the result sets `distress: true`.
Bearings wrap; ids must be unique
within a watch. The result carries all radial `validateSchedule` fields,
reserves `exitTime = NIGHT_SECONDS`, and may be appended to `state.schedule`:

```js
const state = createState(108);
state.schedule.push(specialtyApproach({
  id: 'distress-1', type: 'lifeboat', bearing: 50, spawnTime: 1,
}));
```

`step` installs entries with `spawnTime` strictly after the previous tick and
at or before the current tick, preserving `type`, `smuggler`, `distress` and
initial `speed`. For time-zero scripts, use the pure exported
`installSpecialty(state, approach)` helper with a `specialtyApproach` result:

```js
const state = installSpecialty(createState(108), specialtyApproach({
  id: 'distress-0', type: 'lifeboat', bearing: 50,
}));
```

The helper returns a new state, adds the schedule entry, and immediately
arrives entries due at the state's current time; future entries await `step`.
It rejects duplicate ids and past arrivals. Removing an already-arrived hull
does not cause ticks to resurrect it from the schedule. Launches start
outward; distress boats instead point toward their nearest hazard on arrival.
Scripts must reserve capacity and bearing separation against existing
traffic and run `validateSchedule` after installation; the builder does not
silently remove regular traffic or weaken its warning budget. An explicitly
shortened `spawnRange` may fail validation. Night/mystery placement is #114.
The watch remains `NIGHT_SECONDS = 180`; layout, lamp anchor and compass stay
fixed. `summary()` adds an ever-seen `lost` count alongside its existing
`safe`, `wrecked`, and `unseen` fields. Lost hulls obey the same beam/afterimage
boundary and have no off-beam lights or signals.

### Fixed Teeth, seeded hazards and fleet traffic (#108)

The deeply frozen `TEETH` export is the permanent north-east reef landmark,
in south-positive canvas/chart metres, in this order:

| Kind | x | y | Radius |
|---|---:|---:|---:|
| reef | 210 | −255 | 24 m |
| reef | 244 | −238 | 18 m |
| reef | 274 | −219 | 14 m |

`planHazards(seed, { night = 1 } = {})` always starts with fresh copies of
these three discs, then adds **3–7 seeded hazards**, for **6–10 total**. The
first two Teeth intentionally overlap as one reef band. The isolated rock
from the original chart is not part of `TEETH`; additional rocks stay seeded.
The chart keeps its “THE TEETH · CHARTED REEF · KEEP CLEAR” label over the
fixed landmark. Overhead view, compass, labels, chart transform and layout
stay fixed.

Each disc is `{ kind: 'reef'|'shoal'|'wreck', x, y, radius }`. The private LCG
stream mixes seed and night; repeated calls cannot share mutable objects.
Both `planHazards` and `planSpawns` require uint32 seeds and integer nights
1–5 (`RangeError` for invalid inputs). `createState(seed = 108)` retains its
`TypeError` seed contract, installs the complete night-one chart (Teeth
first) in `state.hazards`, and stores the opening trawler plus extras in
`state.schedule`. Pure modules use no DOM, wall clock or `Math.random`.

The frozen `HAZARD` export lists every seeded generation bound:

| Tunable | Default | Meaning |
|---|---:|---|
| `minCount`, `maxCount` | 3, 7 | Inclusive number of seeded hazards, excluding the three Teeth. |
| `minRadius`, `maxRadius` | 6 m, 34 m | Inclusive permitted seeded radii. |
| `smallCount`, `smallMaxRadius` | 2, 10 m | First two seeded hazards have radii in [6,10]. |
| `minCentre`, `maxCentre` | 160 m, 250 m | Seeded radial centre sampling interval. |
| `angleJitter` | 4° | Independent ± jitter around equal angular sectors; zero for four sectors to preserve quadrants. |

A seeded phase covers 0–360°. Equal sectors spread seeded hazards over at
least three chart quadrants. For three sectors, their minimum separation
exceeds 90°; four sectors share an unjittered rotation; five to seven cannot
fit into only two quadrants. At seven sectors the minimum separation is
`360°/7 − 8°`; `2 × 160 × sin((360°/7 − 8°)/2) > 2 × 34` guarantees
nonoverlapping seeded discs without retries. Every seeded outer edge is at
most **284 m** from the lighthouse, while every Tooth's inner edge is beyond
**306 m**. Thus seeded hazards clear every Tooth by at least
**`CLEAR_MARGIN = 20` m**, for every valid seed/night. These conservative
bounds also satisfy centres within **430 m** and edges at least **90 m**
from the lighthouse (seeded edges are at least 126 m). Seeded kinds are
selected uniformly. Rendering uses the existing dotted chart ink with reef
crosses, shoal waves and wreck hulls. Collisions, threat checks, horn
response, physical PONR, avoidance and rendering all consume the complete
`state.hazards`, including the fixed Teeth.

`planSpawns(seed, { night = 1 } = {})` returns only extras, ordered by time,
with unique consecutive ids `ship-1`, `ship-2`, etc. The opener aims through
the outermost seeded hazard (centre range plus radius) outside the Teeth's
north-east quadrant (`x ≤ 0` or `y ≥ 0`). Three seeded quadrants guarantee
such a lane. A direct opening course through the distant Teeth would not fit
four visible warning passes inside worst-case fog. The frozen `SPAWN` export:

| Tunable | Default | Meaning |
|---|---:|---|
| `firstMin`, `firstMax` | 24 s, 36 s | First extra's arrival interval. |
| `intervalStart`, `intervalEnd` | 40 s, 18 s | Unjittered gap ramped across the full 180 s watch. |
| `jitter` | 0.25 | Gap multiplier sampled in [0.75,1.25]. |
| `maxActive` | 3 | Inclusive overlapping reservations, opener included. |
| `lastSpawn` | 120 s | Last possible slot. |
| `minBearingGap` | 20° | Circular separation for overlapping reservations. |
| `threatShare` | 0.6 | Threat probability before rejection, except fallback candidate. |

The frozen `TRAFFIC` export supplies admission details:

| Tunable | Default | Meaning |
|---|---:|---|
| `attempts` | 8 | Maximum candidates per slot; final candidate is clear outbound traffic in the widest available bearing gap. |
| `lateAfter` | 80 s | Admit additional long-lived threatening approaches only after this time. |
| `maxThreats` | 2 | Maximum dawn-long threat reservations including the opener. |
| `bearingJitter` | 3° | ± offset around any chart hazard's bearing for threatening extras. |
| `openingJitter` | 0.5° | ± offset around the selected outermost seeded hazard for the opener. |

After **every slot** at `t`, accepted or exhausted, advance by
`(intervalStart + (intervalEnd − intervalStart) × t / NIGHT_SECONDS) × jitterFactor`.
Exhausting eight candidates never ends planning. Capacity, separation and
fairness remain mandatory. Early rotating berths use outbound coasters;
their faster exits avoid filling all berths with dawn-long trawlers. The
final clear candidate prevents random rejection alone from silencing traffic.
Across seeds 0–499, every night has an arrival after 80 s, and consecutive
accepted gaps (including opener to first extra) never exceed
**2 × intervalStart × (1 + jitter) = 100 s**. Skipped slots can exceed the
single-slot jitter envelope; the two-slot bound applies to accepted traffic.
Rejection and fallback change the final threatening share.

Threatening extras aim through a chart hazard, including the fixed Teeth when
the warning budget permits. Four-pass nights use trawlers; later nights may
admit coasters if their entire physical warning
budget fits the worst-fog horizon, **464.8 m**. Clear traffic starts at that
horizon and sails outward beyond every hazard. Every entry declares `type`,
`spawnTime`, `bearing`, `speed`, `threatening`, `responseSeconds`, `turnRadius`,
`pnrRange`, `spawnRange`, `exitTime`. Reservations cover inclusive
`[spawnTime, exitTime]`: threats through dawn, outbound coasters through the
600 m exit plus two fixed ticks, capped at dawn. Terminal hulls remain in the
fleet for perception and records without extending reservations.

An arrival enters `state.ships` on the first tick reaching its spawn time,
travels only that tick's post-spawn fraction, and starts with `everSeen: false`
and an explicit off-chart `destination`. A held horn never sends a fresh
broadcast to later arrivals. The renderer visits the fleet through perception.
Version 2 morning records retain safe/wrecked counts (including zero/zero);
legacy version 1 records still require exactly one outcome.

### Horn broadcast and directed lamp

The **horn is an omnidirectional broadcast** meaning “rocks near”, never an
aimed command. Every ship at distance ≤ `hornRange(fogDensity)` hears each
blast: range is **700 − 350 × fogDensity metres**, strictly decreasing from
700 m in clear air to 350 m in the densest fog. Beam illumination, running
lights and afterimages have no bearing on hearing. Pressing H starts one
broadcast; holding sustains its sound, releasing and pressing sends another.

Each honest captain projects its straight track against the reef discs over
**`THREAT_HORIZON_SECONDS = 120` seconds** (including the exact endpoint).
An endangered honest ship plans the smallest physically clear course offset
and later resumes its destination; a clear ship holds course. A reef 10 km down the track beyond that horizon does not
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
uses midpoint yaw/translation. The delayed navigation helm reserves remaining
yaw and rudder-slew travel before adding more helm, settling smoothly onto
the avoidance course. The renderer rotates the hull and running lights from this physical
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

### Destinations and minimal avoidance

Every spawned vessel's destination is **1600 m along its initial course**,
which places it more than 600 m from the lighthouse for every generated
spawn. Honest captains initially sail straight toward it. A warning schedules
crew reaction once; at that instant the planner starts from the actual hull
pose, rudder, yaw and speed, so the crew delay is physically included.

`CLEAR_MARGIN = 20` m is exported. Search heading offsets in **1° steps**,
checking both sides of each angle (port breaks equal-angle ties), through
179°. Each candidate uses `stepVessel` at **1/60 s**, the same helm as live
navigation, and **every** hazard inflated by the 8 m hull allowance plus the
20 m margin. The first physically clear complete maneuver wins. It holds one
outbound avoidance course until the originally threatening discs are astern
of the original course with their full clearance. Once a direct destination
track also clears every padded disc, it turns once toward its destination.
The return leg is also physically checked against all discs.
A settled leg is checked for infinite straight-track threats; there is no
unchecked jump past an obstacle. No candidate may depend on a later zig-zag.

The helm permits one rudder direction per leg, unwinding to zero to settle
without oscillation. The return helm has the opposite sign, so actual heading
changes flip sign **at most once** over the maneuver (rudder braking is not
an extra commanded course). Repeated horns do not restart or replan it.
If no candidate clears, the original collision course continues normally;
there is no collision immunity or synthetic rescue. The smuggler's separately
seeded ignore/veer response remains outside the honest-captain planner.

The frozen `NAVIGATION` export contains all navigation tunables:

| Tunable | Default | Meaning |
|---|---:|---|
| `exitRange` | 600 m | Safe only beyond this distance **and heading outward**. |
| `destinationLeg` | 1600 m | Initial course distance from spawn to destination. |
| `maxOffset`, `searchStep` | 179°, 1° | Both-sided minimal heading search. |
| `predictionSeconds` | 2400 s | Maximum physical trajectory lookahead per candidate, independent of the shorter watch. |
| `settleDegrees`, `settleYaw` | 0.05°, 0.01°/s | Settled-leg tolerances before the infinite straight-track check. |
| `helmGain` | 1.5 | Heading error gain after reserving coast from yaw and rudder slew. |

Hull allowance is **8 m**. Crew, rudder, yaw and cruise tunables remain in
`HULLS` above. Watch duration is `NIGHT_SECONDS = 180`; fog ramps linearly
from 0.08 to `NIGHT_FOG_MAX = 0.16` over that watch, giving the 464.8 m planning
horizon. Wrecks use the 8 m allowance; planned safe maneuvers and schedule
budgets additionally reserve `CLEAR_MARGIN`.

### Physical point of no return

`pointOfNoReturn(vessel, rocks)` returns conservative warning seconds before
projected straight-track entry (zero for a clear track or stationary hull).
It simulates maximum crew delay and both full-rudder turns, measuring maximum
forward travel. A separating plane before every forward disc accounts for
neighbours outside the original track, with two fixed ticks reserved for
scheduling/integration. Rotationally invariant straight-at-cruise excursions
are measured once per hull; noncruise or turning hulls are measured live.

For generated approaches the input discs include **8 + 20 m** clearance.
`pnrRange` is the actual radial entry into those padded discs, and
`turnRadius = speed × (pointOfNoReturn − responseSeconds)` carries the physical
maneuver allowance rather than a constant angular-rate circle. Thus schedule
warning boundaries include the new margin as well as crew/rudder/yaw delay.
The opening approach still budgets **60 s** before PONR on night one; its
lane, range and unwarned impact clock now vary with the seeded layout.
A clear maneuver still on the chart at dawn remains `underway`, even when
it has been observed and warned; only an outward exit beyond 600 m is safe.

Fast vessels (**speed ≥ `FAST_SHIP_SPEED`, currently 8 chart m/s**) expose
`perception(state).engineCue = { bearing, intensity }` while underway and
unlit, including beyond fog reach. Intensity is `1 / (1 + range / fogReach)`,
increasing toward the listener. Lit, safe, wrecked or slower ships return
`null`. This is a deterministic audio hook only; engine synthesis/panning
lands in #115. It reveals no hull pose, and is not credited as a beam pass.

## 7. Failure & success

- **No game over mid-night.** Wrecks happen and are remembered — the sea goes
  on. This is a quiet game; failure is a weight, not a reset.
- A night ends at dawn. `summary(state)` returns `{ safe, wrecked, unseen, lost }`.
  Safe/wrecked/lost count **only ever-seen ships**. Each arrival starts unseen;
  any tick with beam illumination or visible running lights permanently latches
  `everSeen = true`. Horn hearing, engine cues and unobserved maneuvers never
  imply a sighting. Never-seen ships of **any status** count in `unseen`.
  The dawn panel shows observed safe/wrecked outcomes and, when nonzero,
  “n passed unseen”. Observed underway ships are not credited as safe.
  Rescued lifeboats count as safe; observed distress losses appear separately.
  Persistent distress records and entries logged remain later milestones.
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
# pnrRange and pointOfNoReturn both use discs padded by 8 + CLEAR_MARGIN
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
the individual warning budget. The opening lane follows a seeded hazard
outside the fixed Teeth's quadrant, and every threatened candidate derives
PNR from the complete chart, including all three Teeth with hull and
`CLEAR_MARGIN` padding. Fixing the landmark never weakens the pass quota or
moves a warning window beyond visible fog reach.
The adversarial suites check the exact fixed prefix, deep immutability,
caller isolation, seeded count and size bounds, Tooth clearance, quadrant
boundaries, south-positive collisions, and schedule validity over
500 seeds × five nights, alongside scattered uint32 geometry samples and
independent physical budget tests.
Clear outbound traffic has no reef PNR;
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

- Real International Morse, keyed by `K` through the shared bindings table.
  Initial dot-unit **125 ms**: down < **250 ms** = dot, ≥ 250 ms = dash.
  After each dot, the unit becomes the mean of the most recent five dots
  (or all dots so far). Threshold = clamp(2 × unit, 150, 400) ms. Dashes
  never adapt the unit. Gaps use the unit before the next press: < 3 units
  continues a letter, ≥ 3 separates letters, ≥ 7 separates words.
- The keyed lantern housing and open/shuttered indicator show outgoing
  flashes. The strip decodes live, including a provisional held symbol
  (`·−·` → `R`); unrecognised sequences show `?`, with no autocorrect.
  Long messages scroll to their latest symbols/text within the strip.
- After ≥ 7 idle units, select **one underway ship lit at completion**.
  No illuminated recipient means no effect or reply, even if a ship has an
  afterimage or lies within horn range. The strip retains the last sent
  message and indicates whether a vessel was addressed. Starting another
  message resets adaptation to 125 ms. Pause, help, focus loss, restart and
  dawn shutter the lamp; mode changes discard incomplete keying so a held
  key never becomes a synthetic dash or sends a partial warning on resume.
- **Word-gap clarification for #110:** the same 7-unit gap cannot both
  finish an arbitrary message and introduce its next word. Reserve the
  unfinished vocabulary prefixes `WHAT` and `STEER` through that gap, until
  a second word completes them. All other text dispatches at the normal
  idle boundary. Opening help cancels an abandoned prefix.
- Honest ships reply at **8 WPM**, or **5 WPM** selected under `?` controls.
  The setting applies to future replies and survives watch restart within
  the page. Flash units are 1200/WPM ms: dots 1u, dashes 3u; dark gaps 1u
  within letters, 3u between letters, 7u between words. Reply points are
  visible through the full fog reach, including off beam, without exposing
  an unobserved hull. Wrecked or dark ships never flash. Replies carry no
  on-screen translation; read the blinking point. The optional reference
  card under `?` lists all 36 letters/digits and the vocabulary and can stay
  open during play. Neither signal changes the chart, compass or layout.
- Vocabulary v1 (small, fixed): `SOS`, `K` (go ahead), `R` (received), `AR`
  (end), `WHAT LIGHT` / station code `SKR`, `ROCKS`, `STEER N|S|E|W`,
  `WHO`. Honest replies: `WHO` → callsign, `WHAT LIGHT` → `SKR`, `K` → `K`,
  `ROCKS`/`STEER`/`SKR` → `R`; `R`/`AR` → silence; `SOS`/nonsense → `?`.
  Smugglers always stay silent. Only `ROCKS` changes navigation: if the
  addressed honest captain is endangered within the existing 120 s horizon,
  warn once, allow the hull's maximum crew delay, then run §6's same minimal
  avoidance and return to destination. No horn blast, trust cost, broadcast,
  spam suppression or trust-dependent refusal applies to the lamp. `STEER`
  currently acknowledges only; it does not replace the avoidance controller.
- Pure `js/morse.js`, with no DOM, wall clock or randomness: frozen `MORSE`,
  strict letters/digits `encode`, `decodeLetter`, `decodeKeying`, exact
  uppercase `parseMessage`, `keyingFor` and `shipReply`. Times are milliseconds;
  event arrays require finite 0 ≤ down < up and each down > previous up.
  Empty input decodes to empty text; unknown sequences decode to `?`.
  `encode` rejects punctuation; `keyingFor('?')` alone additionally supports
  the standard `..--..` error reply. Coverage includes Morse alongside sim
  and physics. Exhaustive unit tests exercise all symbols, vocabulary,
  ±1 ms gap/press edges, adaptation bounds, invalid events and garbage;
  integration/browser tests cover directed delivery, no recipient, pause
  cancellation, multiword commands, live decoding and actual reply blinking.

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

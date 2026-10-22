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

All ships follow scripted courses (seeded, deterministic) with simple
reactive rules.

| Ship | Look | Behaviour | What you must do |
|---|---|---|---|
| **Trawler** (v1 issue 1) | squat hull, mast, running lights | Plods a course that may cross the Teeth. | Light it, then sound the horn while it's lit/close → it alters course away. Unwarned → wreck. |
| **Steamer / coaster** | long hull, two lights | Faster, wider turning circle — warn earlier. | Horn earlier; may ask by lamp "WHAT LIGHT" — answer the station code. |
| **Smuggler** | low dark launch, no lights | Runs dark close to the rocks, slows when lit, flees if lit for > 3 s. Never wrecks (knows the water). | Notice and **log** it (bearing, time). Holding the beam on it is a choice: you learn more, but everything else goes dark. |
| **Lifeboat / boat in distress** | small, flare or lamp flashing SOS | Drifts toward the rocks; flashes `SOS` in Morse. | Light it (so the shore boat can find it), signal `K`-style acknowledgement, and log it. Unlit too long → lost. |
| **Swimmer / wreckage** (mystery nights) | tiny, only visible in beam | Drifts. | See it. Log it. |

Reaction to the horn: any lit-or-near (< 40 % range) lighted vessel that hears
the horn within its *warning window* turns away. Horn spam has a cost:
each blast after the third in 20 s makes nearby honest skippers ignore it
for a while ("the light's crying wolf").

Each radial approach declares spawn time, bearing, speed, response seconds,
turn radius, reef/PNR range and spawn range. PNR is the last warning boundary:
`pnrRange + speed × responseSeconds + turnRadius`. Courses and warning
parameters must match the live simulation, not just a validation fixture.
The first-watch trawler now approaches the Teeth radially at **1.5 chart m/s**;
its turn radius is speed divided by angular turn rate (22°/s in radians).
Its derived spawn range is about **459.25 m**, yielding 60 s to PNR and an
unwarned wreck near 65 s. A vessel that turns north clear of all charted reefs
counts safe and continues sailing, even if it has not left the chart by dawn.

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
minimumSpawnRange = warningBoundary + speed × (N + 1) × 12
```

The extra revolution covers worst-case phase: a ship just behind the beam
waits nearly 12 s for its first pass. **Fog reach must extend at least to
this minimum range too.** Moving a ship farther outside the fog cannot buy
visible warning time. If the horizon cannot fit the budget, reduce speed or
adjust the approach/visibility; spawning farther away alone is insufficient.
Night 1 validates against its shortest reach over the entire watch (464.8 m).

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

# Keeper

Keep the light on Skerry Rock through a black, fog-bound night. The Teeth stay
fixed on the north-east chart; a trawler approaches seeded hazards, followed
by seeded trawler and coaster traffic. Find endangered ships with the beam
and broadcast the horn early enough for
their crews to turn away. Failure stays with you until morning.

## How to play

Open `keeper/` from the arcade using a static server at the repository root.
Select **Take the watch**. Each of the five watches lasts nine real minutes; the
unwarned trawler reaches the seeded hazards after its warning window. The
default 12-second sweep guarantees at least four passes before the last safe
warning time.
Slowing or holding deliberately trades those chances for attention elsewhere.

At dawn, review this night's observed outcomes and the run's cumulative
wrecks, then take the next night or **Restart this night**. Three observed
wrecks across the run lead to **Relieved of duty** after dawn. Retry keeps
earlier mornings and their wrecks but clears the current attempt. Completing
night five finishes the watch sequence; mystery endings are a later milestone.
The morning's logged count remains zero: the persistent log is separate from
run history and survives retries and new runs.

The watch saves locally once per second and when leaving the page or opening
a menu. Reload and choose **Resume night N**, or review a saved morning.
Time away does not advance the sea. A storage warning means this browser
cannot retain progress; play remains available. **Start a new run** replaces
the saved watch. Abrupt browser termination can lose the latest second.

- **← / A**, **→ / D**: slow / accelerate clockwise rotation (30–6 seconds
  per revolution; default 12). Release to keep the selected speed.
- **Space**, held: clutch the lens on its current bearing.
- **H**, held: sound the broadcast horn. Every ship in fog-limited audible
  range hears it, even off-beam. Endangered captains turn after a seeded crew
  delay; safe ships hold course. Last-second warnings can still end in a wreck.
- **K**, keyed: flash the directed signal lamp at the vessel in the beam.
  Short presses are dots, long presses dashes; the live strip decodes your
  keying. Leave 3 dot-units between letters and 7 to send. `WHAT` and `STEER`
  wait for a second word. `ROCKS` warns only the lit ship, without a trust
  penalty. Ships blink replies at 8 WPM; **?** offers 5 WPM and an optional
  alphabet reference card. Hold Space to keep the recipient lit until sending.
- **Esc / P**: pause. **?**: controls. Focus loss also pauses and releases keys.
- **L**: open / close the keeper’s paper log, including from the title or dawn
  card to review saved pages. The watch pauses while it is open. Choose an
  observed vessel and an optional preset note, then **Enter in the log**.
  Time and current beam bearing are automatic. **Esc / P** also closes the page;
  returning to a paused card keeps the watch paused. Horn, lamp and steering
  presses are ignored while writing; release and press again after closing.
- **Mute horn** silences audio without changing the warning mechanic.

Controls appear on the title card and briefly over the watch (eight seconds,
or until first input), as well as the persistent bottom bar and **?** card.

The faint dotted marks are the keeper's chart, not visible rocks. A ship's hull
is visible only in the cone or a fading 1.5-second remembered image. Running
lights can show within half the fog reach. False alarms reduce captain trust,
slowing reactions and making warnings less likely to be followed. Each press
is one broadcast; holding sustains the sound without warning newly arriving
ships. Only a reef impact within 120 seconds counts as danger. Trust recovers
by 1% per simulated second. The fourth blast in under 20 seconds makes skippers
ignore horns for 30 seconds; ignored blasts also erode trust and do not extend
that window. Expanding rings show each blast even when muted; dashed, dim rings
mean it was ignored. The HUD shows current skipper trust. The Morse
lamp addresses only the vessel lit when the message finishes.

In scripted encounters, dark launches slow in the beam and flee after more
than three continuous seconds of light. A lifeboat repeats `SOS`: illuminate
it and send `K`, `R` or `AR` while keeping it in the beam to rescue it. Any
lit tick resets its 24-second loss timer; light alone does not complete rescue.
A coaster may ask `WHAT LIGHT` after one continuous second in the beam;
answer `SKR` for its `R` acknowledgement.

## Tech

Vanilla HTML/CSS/ES modules, Canvas 2D, a pure deterministic seeded simulation,
and a synthesized WebAudio horn. No build step or runtime dependencies.
Respects reduced motion by stopping fog drift. Designed for desktop ≥1280×720.

From `keeper/` (Node ^22.22 or ≥24.8):

```sh
npm ci
npm run lint
npm run test:coverage
npx playwright install chromium
npm run test:e2e
```

Playwright serves the repository root with `python3 -m http.server` on port
8124. Its explicit `?e2e=1` mode, only under browser automation, exposes
`window.__keeper` with read-only seed/state snapshots and a simulation advance
helper. It does not exist during normal play. Tests use real keyboard input;
the helper compresses the wait for dawn without altering the course or outcome.

## Status

Issue #113: five nine-minute nights, monotonic night-indexed fog, cumulative
morning records, third-wreck relief with restart-night, and versioned mid-run
save/resume, integrated with ship variety (#111) and the keeper's log (#112).
Invalid or inaccessible storage never prevents play. Mystery scripts/endings
and ambient wind/sea audio remain later milestones. The full design is in [docs/DESIGN.md](docs/DESIGN.md).
Issue #118 adds pure sweep-budget helpers, schedule rejection on load/start,
a retuned radial trawler and a fast-ship engine-cue stub for #115. The five
night pass minima are defined and preserved; engine audio remains future work.
Issue #120 adds deterministic rudder/Nomoto hull physics, broadcast horns for
the fleet, physical PONR budgeting, and smooth rendered turns. Four hull types
are tuned and tested.
Issue #109 completes the foghorn trust/recovery and spam rules, with muted-play
visual rings and a trust readout.
Issue #110 adds the pure International Morse decoder, directed signal lamp,
live strip, ship replies, incoming-speed setting and optional reference card.
Issue #111 adds dark-launch flight and reef immunity, distress drift/repeating
SOS/directed rescue, a separate lost tally, and coaster identification asks.
Specialty ships are available through the pure `specialtyApproach` schedule
builder documented in DESIGN §6; default traffic stays trawlers/coasters until
the mystery-night scripts (#114). The watch now lasts 540 seconds (#113).
Issue #112 adds the assembled keeper’s log. Choices come only from this watch’s
`everSeen` vessels, including vessels already departed or lost; old entries
never unlock unseen choices on a replay. Notes are the keeper’s own observations,
not automatic encounter facts. The `keeper.log.v1` localStorage document holds
`{ version: 1, entries }`; each entry stores seed, night, simulation seconds,
current beam bearing, observed vessel id/type and a preset note. It is separate
from `keeper.record.v1` and survives restarting the watch. Invalid or unsupported
documents open a fresh page; blocked storage or quota errors keep entries for
the current visit and show a status message. Later mystery scripts and endings
remain future work.
The kspawn pacing change adds seeded arrivals from 24–36 seconds onward,
with jittered gaps (50→24 seconds over the watch), at most three overlapping
active windows, separated bearings and independent warning budgets. Traffic stops arriving by 480
seconds; clear outbound ships never cross reefs. Observed fleet outcomes persist in
the morning record. All pacing tunables are documented in DESIGN §6.

The Teeth are three fixed reef discs on every chart. Each seed/night adds
3–7 deterministic hazards with at least 20 m clearance from the Teeth. The
opening trawler approaches a seeded hazard outside their north-east quadrant
so its full warning window fits within fog reach.
Warned honest captains take the smallest physically clear course change, then
resume their off-chart destinations. A ship is safe only after heading outward
beyond 600 m; a clear hull still underway at dawn is not a saved outcome. Dawn
counts only ships observed in the beam or by running lights, and reports
unseen arrivals separately. Rejected spawn slots no longer end traffic.

## File layout

- `index.html`, `css/keeper.css` — interface and layout.
- `js/physics.js` — pure hull dynamics, tactical diameter, horn broadcast and PONR.
- `js/morse.js` — pure Morse alphabet, adaptive decoder, vocabulary and reply timing.
- `js/sim.js` — seeded world, beam, perception, horn reaction, collisions, dawn.
- `js/main.js` — keyboard, browser clock, panels, storage adapter.
- `js/renderer.js`, `js/audio.js` — canvas and horn adapters.
- `js/keys.js` — shared bindings and control labels.
- `js/record.js` — defensive versioned morning-record parser.
- `js/log.js` — pure observation choices, entry assembly and versioned log parser.
- `js/save.js` — pure full-state save codec, validation and alias restoration.
- `tests/`, `e2e/` — adversarial Node tests and Playwright browser tests.

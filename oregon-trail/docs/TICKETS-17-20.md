# Ticket Specs — Phase 4 (UI & Polish)

All UI/polish tickets are **parallelizable** once the engine (Phase 2) is complete.

---

## Ticket 17: `game-ui` — Main Game Rendering

**Goal:** Render the main game UI: resource bars, decision panel, event display, day counter.

**Acceptance Criteria:**
- [ ] Resource bars display all 6 resources (Food, Money, Ammo, Health, Morale, Wagon) with labels, values, and units.
- [ ] Decision panel shows 3 decision groups: Pace (Steady/Fast/Rest), Rationing (Full/Meager/Bare), Action (Hunt/Trade/Repair/Explore/Nothing).
- [ ] Each decision group uses radio buttons or toggle buttons.
- [ ] "Next Day" button is disabled until all 3 decisions are made.
- [ ] Event display area shows the current event's title, description, and party member quotes.
- [ ] Day counter shows current day number and total distance traveled.
- [ ] Current landmark/region is displayed.
- [ ] UI is responsive and readable on desktop and tablet.
- [ ] Earth-tone theme consistent with DESIGN.md aesthetic.

**Files Allowed:** `oregon-trail/js/ui.js` (create), `oregon-trail/index.html` (modify — add UI structure), `oregon-trail/css/style.css` (modify — add UI styles).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

---

## Ticket 18: `end-screen` — Win/Lose/Partial End Screen

**Goal:** Render end screen with outcome, journey stats, and replay option.

**Acceptance Criteria:**
- [ ] Three end states rendered: Win (reached Willamette Valley), Lose (all dead or wagon destroyed), Partial (bittersweet — heavy losses).
- [ ] Win screen shows: days taken, miles traveled, events survived, final reputation standings, party members alive.
- [ ] Lose screen shows: how far the party got (distance/landmark), cause of failure, somber summary text.
- [ ] Partial screen shows: same stats as win but with a "at what cost?" framing and Trail Ledger display.
- [ ] "Start New Journey" button restarts the game.
- [ ] End screen is visually distinct from the main game screen.
- [ ] Party member quotes appear on the end screen (Optimist for win, Tender for partial, Pragmatist for lose).

**Files Allowed:** `oregon-trail/js/end-screen.js` (create), `oregon-trail/index.html` (modify — add end screen container), `oregon-trail/css/style.css` (modify — add end screen styles).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

---

## Ticket 19: `stats-panel` — Journey Summary & Trail Ledger Display

**Goal:** Render persistent stats panel showing resources, party status, and Trail Ledger reputation.

**Acceptance Criteria:**
- [ ] Stats panel is visible during gameplay (sidebar or collapsible panel).
- [ ] Displays all 6 resource values with current/max indicators.
- [ ] Displays all 4 party members with name, HP, and alive status.
- [ ] Trail Ledger displays 4 faction bars with qualitative labels (Trusted/Friendly/Neutral/Suspect/Hostile).
- [ ] Faction bars use color coding: green (Trusted/Friendly), gray (Neutral), orange (Suspect), red (Hostile).
- [ ] Stats panel can be toggled visible/hidden.
- [ ] Journey summary shows: day, distance, current landmark, events encountered this leg.

**Files Allowed:** `oregon-trail/js/stats-panel.js` (create), `oregon-trail/index.html` (modify — add stats panel container), `oregon-trail/css/style.css` (modify — add stats panel styles).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

---

## Ticket 20: `audio-hooks` — Synthesized Sound Effects

**Goal:** Add optional synthesized sound effects for key events (stretch goal for v0.1).

**Acceptance Criteria:**
- [ ] Sound effects use Web Audio API (no external audio files).
- [ ] Effects for: day advance (subtle click), event trigger (chime), resource gain (positive tone), resource loss (negative tone), game over (somber tone).
- [ ] Mute/unmute toggle in the UI.
- [ ] Audio is opt-in — muted by default.
- [ ] All sounds are short (< 1 second) and non-intrusive.
- [ ] Graceful fallback if Web Audio API is not available (no errors).

**Files Allowed:** `oregon-trail/js/audio.js` (create), `oregon-trail/js/main.js` (modify — wire up audio triggers), `oregon-trail/index.html` (modify — add mute toggle).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

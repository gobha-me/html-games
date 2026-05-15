# Ticket Specs — Phase 1 & 2 (Skeleton + Engine)

---

## Ticket 1: `scaffold` — Directory, Launcher Card, Hello Trail Page

**Goal:** Create the `oregon-trail/` directory structure, add the launcher card to `games.json`, and ship a "Hello, Trail" page with the back-to-arcade link. This is the **only ticket that must land first**.

**Acceptance Criteria:**
- [ ] `oregon-trail/index.html` renders a "Hello, Trail" page with game title, intro paragraph, and a "Start Journey" placeholder button.
- [ ] `oregon-trail/css/style.css` exists with basic styling (game header, centered layout, earth-tone theme).
- [ ] `oregon-trail/js/main.js` exists (stub that logs "Oregon Trail loaded").
- [ ] `oregon-trail/README.md` exists with placeholder description and file layout.
- [ ] `oregon-trail/CHANGELOG.md` exists with a v0.1 header.
- [ ] `oregon-trail/DESIGN.md` exists (copy from parent PR).
- [ ] Launcher card added to `games.json`: slug `oregon-trail`, title `Oregon Trail`, icon `🏕️`, tag `Trail Sim`, theme `trail`, href `oregon-trail/`.
- [ ] Page includes `<a href="../" class="back-to-arcade">← Back to Arcade</a>`.
- [ ] Page includes `<link rel="stylesheet" href="../shared/back-to-arcade.css">`.
- [ ] Page includes `<link rel="icon" href="../favicon.svg" type="image/svg+xml">`.

**Files Allowed:** `oregon-trail/index.html`, `oregon-trail/css/style.css`, `oregon-trail/js/main.js`, `oregon-trail/README.md`, `oregon-trail/CHANGELOG.md`, `oregon-trail/DESIGN.md`, `games.json`.

**Files NOT Allowed:** `index.html` at repo root. Any other game directory.

**Notes:** `games.json` is shared — `git pull --rebase origin main` before pushing. See `2048/index.html` for standard page structure.

---

## Ticket 2: `turn-loop` — Day Cycle with Pace/Ration/Action Decisions

**Goal:** Implement the core day loop: player selects pace, rationing, and action; game advances state.

**Acceptance Criteria:**
- [ ] Player can select one of 3 pace options: Steady, Fast, Rest.
- [ ] Player can select one of 3 rationing options: Full, Meager, Bare.
- [ ] Player can select one of 5 action options: Hunt, Trade, Repair, Explore, Nothing.
- [ ] After selections are confirmed, the game advances one day.
- [ ] UI shows current day number and distance traveled.
- [ ] "Next Day" button is disabled until all 3 decisions are made.
- [ ] Decisions reset each day.

**Files Allowed:** `oregon-trail/js/turn-loop.js` (create), `oregon-trail/js/main.js` (modify — wire up), `oregon-trail/index.html` (modify — add decision UI elements), `oregon-trail/css/style.css` (modify — add decision UI styles).

**Files NOT Allowed:** `games.json`, `oregon-trail/DESIGN.md`, any other game directory.

**Design Reference:** See `DESIGN.md` → Core Loop section. Pace affects distance/food/illness; rationing affects morale/food; action triggers specific resource changes.

---

## Ticket 3: `resources` — Resource State Model

**Goal:** Implement the resource model with starting values, daily decay, and modification API.

**Acceptance Criteria:**
- [ ] Six resources tracked: Food (lbs), Money ($), Ammo (rounds), Health (HP/member), Morale (0–100), Wagon Condition (0–100).
- [ ] Starting values: Food=800, Money=200, Ammo=50, Health=10 per member, Morale=60, Wagon=80.
- [ ] Daily decay applied based on pace and rationing choices (see DESIGN.md table).
- [ ] Public API: `resources.get(name)`, `resources.set(name, value)`, `resources.modify(name, delta)`.
- [ ] Resources clamp to valid ranges (0 min, no max except Morale/Wagon at 100).
- [ ] UI displays all resource values with labels and units.

**Files Allowed:** `oregon-trail/js/resources.js` (create), `oregon-trail/js/main.js` (modify — integrate), `oregon-trail/index.html` (modify — add resource display), `oregon-trail/css/style.css` (modify — add resource bar styles).

**Files NOT Allowed:** `games.json`, `oregon-trail/DESIGN.md`, any other game directory.

**Design Reference:** See `DESIGN.md` → Resource Model table for exact units, starting values, and decay rates.

---

## Ticket 4: `party` — Party State with 4 Archetypes

**Goal:** Implement party member state: 4 members with individual HP, shared morale.

**Acceptance Criteria:**
- [ ] Four party members initialized: The Pragmatist, The Optimist, The Skeptic, The Tender.
- [ ] Each member has: name, archetype, HP (starts at 10), alive status.
- [ ] Party-wide Morale (0–100, starts at 60) is shared.
- [ ] Public API: `party.getMember(index)`, `party.damageMember(index, amount)`, `party.healMember(index, amount)`, `party.getMorale()`, `party.setMorale(value)`.
- [ ] When a member's HP reaches 0, they are marked incapacitated (not immediately removed).
- [ ] When all members are incapacitated, trigger game-over condition.
- [ ] UI displays each member's name, HP, and alive status.

**Files Allowed:** `oregon-trail/js/party.js` (create), `oregon-trail/js/main.js` (modify — integrate), `oregon-trail/index.html` (modify — add party display), `oregon-trail/css/style.css` (modify — add party member styles).

**Files NOT Allowed:** `games.json`, `oregon-trail/DESIGN.md`, any other game directory.

**Design Reference:** See `DESIGN.md` → Character Voices section for archetype names and personality descriptions.

---

## Ticket 5: `event-runner` — Event Dispatcher with Reputation Effects

**Goal:** Implement event dispatcher: select event by category, apply effects, update Trail Ledger reputation.

**Acceptance Criteria:**
- [ ] Six event categories: Weather, Illness, Encounter, Terrain Hazard, Opportunity, Moral Choice.
- [ ] Event selection is weighted by current region (landmark leg) and reputation.
- [ ] Each event has: title, description, category, effects (resource deltas, reputation deltas), and optional party member quotes.
- [ ] Trail Ledger tracks four faction scores: Native Tribes, Fellow Settlers, River Traders, Outlaws (each −100 to +100, starting at 0).
- [ ] Reputation is displayed qualitatively: Trusted (+50–100), Friendly (+10–49), Neutral (−9–+9), Suspect (−49–−10), Hostile (−100–−50).
- [ ] Public API: `eventRunner.dispatch(category?)`, `eventRunner.getEvent(id)`, `eventRunner.applyEffects(event)`, `reputation.get(faction)`, `reputation.modify(faction, delta)`.
- [ ] Events are displayed in the UI with description, effects summary, and party member commentary.

**Files Allowed:** `oregon-trail/js/event-runner.js` (create), `oregon-trail/js/reputation.js` (create), `oregon-trail/js/events/*.js` (create — event data files), `oregon-trail/js/main.js` (modify — integrate), `oregon-trail/index.html` (modify — add event display area), `oregon-trail/css/style.css` (modify — add event display styles).

**Files NOT Allowed:** `games.json`, `oregon-trail/DESIGN.md`, any other game directory.

**Design Reference:** See `DESIGN.md` → Event Taxonomy and Trail Ledger sections.

---

## Ticket 6: `save-load` — localStorage Persistence

**Goal:** Implement save/load of full game state to localStorage.

**Acceptance Criteria:**
- [ ] `save()` serializes full game state (resources, party, reputation, day, distance, event history) to localStorage under key `oregon-trail-save`.
- [ ] `load()` deserializes saved state and restores all game variables.
- [ ] `hasSave()` returns boolean indicating whether a save exists.
- [ ] `deleteSave()` removes the saved state.
- [ ] Auto-save triggers after each day advances.
- [ ] "Continue Journey" button appears on the title screen if a save exists.
- [ ] Save data includes a version field for future migration.

**Files Allowed:** `oregon-trail/js/save-load.js` (create), `oregon-trail/js/main.js` (modify — integrate save/load calls), `oregon-trail/index.html` (modify — add continue button).

**Files NOT Allowed:** `games.json`, `oregon-trail/DESIGN.md`, any other game directory.

**Design Reference:** See `DESIGN.md` → Resource Model and Party State sections for the full state shape.

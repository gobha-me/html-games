# Ticket Specs — Phase 3 (Content)

All content tickets are **parallelizable** — they can proceed simultaneously once the engine (Phase 2) is complete. Each writes data-only files (JSON/JS event arrays) that the event-runner consumes.

---

## Ticket 7: `weather-events` — Weather Event Corpus

**Goal:** Write 8–12 weather events: storms, droughts, heat waves, early frost, blizzards.

**Acceptance Criteria:**
- [ ] Minimum 8 events, target 12.
- [ ] Each event has: `id`, `title`, `description`, `effects` (resource deltas), `regionWeights` (which legs this can appear in), and 1–2 party member quotes.
- [ ] Events cover: thunderstorm, drought, heat wave, early frost, blizzard, hail, dust storm, fog.
- [ ] Effects are faction-neutral (no reputation changes).
- [ ] High Morale mitigates some effects (better preparation).
- [ ] Low Wagon Condition amplifies damage.
- [ ] Events are written in the earthy, procedural-historical tone per DESIGN.md.

**Files Allowed:** `oregon-trail/js/events/weather.js` (create or modify).

**Files NOT Allowed:** Any engine files (`turn-loop.js`, `resources.js`, `party.js`, `event-runner.js`, `reputation.js`, `save-load.js`). `games.json`. `DESIGN.md`.

---

## Ticket 8: `illness-events` — Illness Event Corpus

**Goal:** Write 8–12 illness events: cholera, dysentery, fever, snakebite, broken bones.

**Acceptance Criteria:**
- [ ] Minimum 8 events, target 12.
- [ ] Each event has: `id`, `title`, `description`, `effects` (HP deltas, morale deltas), `regionWeights`, and 1–2 party member quotes (Tender should appear frequently).
- [ ] Events cover: cholera, dysentery, fever, snakebite, broken bone, food poisoning, exhaustion, infection.
- [ ] Each event offers a choice: rest (recover HP, lose days/food) or push on (risk worsening).
- [ ] High Native Tribes rep may unlock herbal remedy option (+HP recovery).
- [ ] Events are written in the earthy, procedural-historical tone per DESIGN.md.

**Files Allowed:** `oregon-trail/js/events/illness.js` (create or modify).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

---

## Ticket 9: `encounter-events` — Encounter Event Corpus

**Goal:** Write 10–15 encounter events: Native tribes, settlers, traders, scouts, army patrols.

**Acceptance Criteria:**
- [ ] Minimum 10 events, target 15.
- [ ] Each event has: `id`, `title`, `description`, `effects` (resource + reputation deltas), `regionWeights`, `choices` (2–3 options with different outcomes), and 2–3 party member quotes.
- [ ] Events cover: Pawnee band, Sioux hunting party, Mormon wagon train, river trader, mountain scout, army patrol, Mormon Battalion, freedman's wagon, Chinese merchant, Shoshone guide.
- [ ] Each event has at least 2 choices with different reputation consequences.
- [ ] Outcomes vary based on current faction standing (e.g., high Tribes rep → better trade rates).
- [ ] Events are the primary driver of reputation change.
- [ ] Events are written in the earthy, procedural-historical tone per DESIGN.md.

**Files Allowed:** `oregon-trail/js/events/encounter.js` (create or modify).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

---

## Ticket 10: `terrain-events` — Terrain Hazard Event Corpus

**Goal:** Write 8–12 terrain hazard events: river crossings, mountain passes, desert stretches, rockslides.

**Acceptance Criteria:**
- [ ] Minimum 8 events, target 12.
- [ ] Each event has: `id`, `title`, `description`, `effects` (wagon condition, resource deltas), `regionWeights`, `choices` (2–3 options), and 1–2 party member quotes.
- [ ] Events cover: swollen river crossing, mountain pass in snow, desert water shortage, rockslide, mud bog, steep descent, quicksand, fallen tree blocking trail.
- [ ] High Outlaw rep may reveal dangerous shortcuts (faster but riskier).
- [ ] High Settler rep may reveal safer alternate routes (slower but safer).
- [ ] Events test Wagon Condition and resource reserves.
- [ ] Events are written in the earthy, procedural-historical tone per DESIGN.md.

**Files Allowed:** `oregon-trail/js/events/terrain.js` (create or modify).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

---

## Ticket 11: `opportunity-events` — Opportunity Event Corpus

**Goal:** Write 8–12 opportunity events: hunting bonanzas, shortcut discoveries, abandoned supply caches.

**Acceptance Criteria:**
- [ ] Minimum 8 events, target 12.
- [ ] Each event has: `id`, `title`, `description`, `effects` (resource deltas), `regionWeights`, `choices` (accept/decline or risk/reward), and 1–2 party member quotes (Optimist should appear frequently).
- [ ] Events cover: buffalo herd, abandoned wagon, hidden spring, gold rush detour, berry patch, fishing spot, trading post sale, meteor sighting (morale boost).
- [ ] Each event offers a resource gain at some cost or risk.
- [ ] Events are written in the earthy, procedural-historical tone per DESIGN.md.

**Files Allowed:** `oregon-trail/js/events/opportunity.js` (create or modify).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

---

## Ticket 12: `moral-events` — Moral Choice Event Corpus

**Goal:** Write 8–12 moral choice events: help stranded travelers, share supplies, abandon the weak.

**Acceptance Criteria:**
- [ ] Minimum 8 events, target 12.
- [ ] Each event has: `id`, `title`, `description`, `effects` (resource + reputation + morale deltas), `regionWeights`, `choices` (2–3 options with strong moral weight), and 2–3 party member quotes (Tender and Skeptic should contrast).
- [ ] Events cover: stranded family begging for food, injured stranger on trail, party member wants to turn back, dispute over supplies, abandoned child, sick traveler asking for medicine, thief caught in camp, rival wagon train in trouble.
- [ ] Moral choices are the strongest drivers of reputation change.
- [ ] Each choice has immediate morale consequences.
- [ ] Events are written in the earthy, procedural-historical tone per DESIGN.md.

**Files Allowed:** `oregon-trail/js/events/moral.js` (create or modify).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

---

## Ticket 13: `party-voices` — Party Member Voice Definitions

**Goal:** Write voice definitions for 4 archetypes with sample quotes per event category.

**Acceptance Criteria:**
- [ ] Four voice profiles defined: The Pragmatist, The Optimist, The Skeptic, The Tender.
- [ ] Each profile includes: archetype name, personality description, speaking style notes, and 3–5 sample quotes per event category (weather, illness, encounter, terrain, opportunity, moral).
- [ ] Minimum 18 quotes per archetype (3 × 6 categories), target 30 (5 × 6).
- [ ] Quotes are distinct in voice: Pragmatist uses numbers/trade-offs, Optimist notices beauty/hope, Skeptic questions/warns, Tender shows empathy/moral urgency.
- [ ] Quotes are written in the earthy, procedural-historical tone per DESIGN.md.
- [ ] Data structure: `{ archetype: string, quotes: { category: string[] } }`.

**Files Allowed:** `oregon-trail/js/events/voices.js` (create).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`.

---

## Ticket 14: `plains-flavor` — Plains Regional Flavor (Legs 1–4)

**Goal:** Write flavor text and event variations for the Plains leg: Fort Kearney → Chimney Rock → Fort Laramie → Independence Rock.

**Acceptance Criteria:**
- [ ] Landmark descriptions for 4 locations: Fort Kearney, Chimney Rock, Fort Laramie, Independence Rock.
- [ ] Each landmark has: arrival text (shown when reaching it), departure text (shown when leaving), and 2–3 region-specific event variations.
- [ ] Plains events emphasize: prairie weather, river crossings (Platte, North Platte), buffalo herds, Pawnee encounters.
- [ ] Flavor text is written in the earthy, procedural-historical tone per DESIGN.md.
- [ ] Data structure: `{ landmark: string, leg: number, arrival: string, departure: string, eventVariations: [] }`.

**Files Allowed:** `oregon-trail/js/events/regions/plains.js` (create).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`. Other region files.

---

## Ticket 15: `mountains-flavor` — Mountains Regional Flavor (Legs 5–8)

**Goal:** Write flavor text and event variations for the Mountains leg: South Pass → Soda Springs → Fort Hall → Snake River.

**Acceptance Criteria:**
- [ ] Landmark descriptions for 4 locations: South Pass, Soda Springs, Fort Hall, Snake River.
- [ ] Each landmark has: arrival text, departure text, and 2–3 region-specific event variations.
- [ ] Mountain events emphasize: altitude sickness, cold weather, difficult passes, Shoshone encounters, river fording.
- [ ] Flavor text is written in the earthy, procedural-historical tone per DESIGN.md.
- [ ] Data structure matches plains.js for consistency.

**Files Allowed:** `oregon-trail/js/events/regions/mountains.js` (create).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`. Other region files.

---

## Ticket 16: `desert-flavor` — Desert & River Regional Flavor (Legs 9–12)

**Goal:** Write flavor text and event variations for the final leg: Blue Mountains → The Dalles → Columbia River Gorge → Willamette Valley.

**Acceptance Criteria:**
- [ ] Landmark descriptions for 4 locations: Blue Mountains, The Dalles, Columbia River Gorge, Willamette Valley.
- [ ] Each landmark has: arrival text, departure text, and 2–3 region-specific event variations.
- [ ] Final leg events emphasize: exhaustion, dwindling supplies, river navigation (raft vs. land route), anticipation of arrival.
- [ ] Willamette Valley arrival triggers the win condition text.
- [ ] Flavor text is written in the earthy, procedural-historical tone per DESIGN.md.
- [ ] Data structure matches plains.js/mountains.js for consistency.

**Files Allowed:** `oregon-trail/js/events/regions/desert.js` (create).

**Files NOT Allowed:** Any engine files. `games.json`. `DESIGN.md`. Other region files.

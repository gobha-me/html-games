# Oregon Trail — v0.1 Roadmap

Linear build order. Each phase must complete before the next begins.
Within a phase, tickets are parallelizable unless noted.

## Phase 1: Skeleton (1 ticket — MUST land first)

| # | Ticket | What |
|---|--------|------|
| 1 | `scaffold` | Create `oregon-trail/` dir, `index.html`, `css/`, `js/`, `README.md`, `CHANGELOG.md`. Add launcher card to `games.json`. Ship "Hello, Trail" page with back-to-arcade link. |

## Phase 2: Engine (5 tickets — parallel after skeleton merges)

| # | Ticket | What |
|---|--------|------|
| 2 | `turn-loop` | Day cycle: player picks pace/ration/action → game advances state. |
| 3 | `resources` | Resource model: food, money, ammo, health, morale, wagon with decay/modification API. |
| 4 | `party` | Party state: 4 archetypes with individual HP, shared morale. |
| 5 | `event-runner` | Event dispatcher: select by category, apply effects, update Trail Ledger reputation. |
| 6 | `save-load` | localStorage persistence of full game state. |

## Phase 3: Content (10 tickets — parallel after engine merges)

| # | Ticket | What |
|---|--------|------|
| 7 | `weather-events` | 8–12 weather events (storms, droughts, frost, etc.). |
| 8 | `illness-events` | 8–12 illness events (cholera, dysentery, fever, injury). |
| 9 | `encounter-events` | 10–15 encounter events (tribes, settlers, traders, scouts). |
| 10 | `terrain-events` | 8–12 terrain hazard events (river crossings, passes, desert). |
| 11 | `opportunity-events` | 8–12 opportunity events (hunting, shortcuts, caches). |
| 12 | `moral-events` | 8–12 moral choice events (help strangers, share, abandon). |
| 13 | `party-voices` | 4 archetype voice definitions with sample quotes per category. |
| 14 | `plains-flavor` | Regional flavor for legs 1–4 (Fort Kearney → Fort Laramie). |
| 15 | `mountains-flavor` | Regional flavor for legs 5–8 (South Pass → Fort Hall). |
| 16 | `desert-flavor` | Regional flavor for legs 9–12 (Fort Hall → Willamette Valley). |

## Phase 4: UI & Polish (4 tickets — parallel after engine merges)

| # | Ticket | What |
|---|--------|------|
| 17 | `game-ui` | Main rendering: resource bars, decision panel, event display, day counter. |
| 18 | `end-screen` | Win/lose/partial end screen with journey stats and replay option. |
| 19 | `stats-panel` | Persistent stats panel + Trail Ledger reputation display. |
| 20 | `audio-hooks` | Synthesized sound effects for key events (stretch goal). |

## Dependencies

```
Phase 1 (skeleton)
  └─ Phase 2 (engine: 2–6)
       ├─ Phase 3 (content: 7–16)
       └─ Phase 4 (UI/polish: 17–20)
```

All tickets within a phase are parallelizable. Phase 3 and Phase 4 can proceed in parallel once Phase 2 is complete.

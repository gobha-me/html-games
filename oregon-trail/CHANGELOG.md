# Changelog

All notable changes to Oregon Trail live here.

The format is based on [Keep-a-Changelog](https://keepachangelog.com/en/1.1.0/).

## [v0.1] — Playable Core — 2026-05

The playable core: a full day-cycle turn loop with resources, party, events, regional flavor, UI, and end screen.

### Added

- **Turn-loop / day cycle** — pace, ration, and action decisions per day; `advanceTurn()` drives the game forward (#222, PR #243)
- **Resource state** — food, ammo, money, health tracking with consumption logic (#223, PR #244)
- **Party state** — 4 archetypes (Leader, Navigator, Scout, Medic) with individual stats (#224, PR #245)
- **Event-runner** — event dispatcher with reputation effects and category-weighted selection (#225, PR #246)
- **Save/load** — localStorage persistence for game state (#226, PR #247)
- **Weather events** — weather event corpus with rain, storm, drought, fog, and heat variants (#227, PR #249)
- **Illness events** — illness event corpus with cholera, dysentery, fever, and broken bone (#228, PR #252)
- **Encounter events** — 12 encounter events (bandits, traders, settlers, river crossing, etc.) (#229, PR #254)
- **Terrain hazard events** — terrain events covering rockslides, flash floods, sandstorms, and more (#230, PR #255)
- **Opportunity events** — opportunity event corpus for hunting, foraging, and trading chances (#231, PR #256)
- **Moral choice events** — moral choice event corpus with ethical dilemmas and reputation consequences (#232, PR #259)
- **Event wiring** — all event corpora wired into event-runner dispatcher (#258, PR #261)
- **Party voices** — party member voice definitions with contextual quotes (#233, PR #262)
- **Plains regional flavor** — event flavor data for legs 1–4 (Kansas/Nebraska plains) (#234, PR #269)
- **Mountains regional flavor** — event flavor data for legs 5–8 (Rocky Mountains) (#235, PR #271)
- **Desert & river regional flavor** — event flavor data for legs 9–12 (Wyoming desert, Snake River) (#236, PR #272)
- **Main game UI** — full in-game UI rendering with resource bars, party status, event display, and decision buttons (#237, PR #274)
- **End screen** — Win/Lose/Partial outcomes with Trail Ledger summary (#238, PR #277)
- **Stats panel + trail ledger** — persistent stats panel with cumulative trail ledger tracking (#239, PR #320)

### Changed

- **README** — status updated from "scaffold" to "playable core" (PR #308)

### Fixed

- **Next-Day crash** — `handleNextDay` now passes decisions to `advanceTurn` (#278, PR #278)
- **dispatchEvent return value** — correctly unpack `{event, outcome}` in `handleNextDay` (PR #300)
- **Event imports** — wire OPPORTUNITY and MORAL event imports into event-runner (PR #302)
- **Regional flavor wiring** — connect regional flavor data into turn loop and UI (PR #303)
- **Event category distribution** — `selectEventCategory()` now distributes across all 6 categories (PR #305)
- **End screen ledger path** — correct ledger path reference in end screen (PR #307)
- **Party voices display** — wire PARTY_VOICES into event display (PR #310)
- **Trade ammo** — allow Trade action to buy ammo, not just food (PR #313)
- **Game-over button state** — disable pace/ration/action buttons at game over (PR #318)

## [v0.1-pre] — Scaffold

- Created `oregon-trail/` directory structure with `css/`, `js/`, `js/events/`, `js/events/regions/`
- Added "Hello, Trail" landing page (`index.html`) with back-to-arcade link
- Added minimal game styling (`css/style.css`)
- Registered game in `games.json` launcher
- Initialized project documentation (README, CHANGELOG)

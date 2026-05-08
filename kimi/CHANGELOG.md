# Changelog

All notable changes to the Kimi — Factory Defense game will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [2026-01-16]

### Added
- `waveSpawnComplete` state flag for clean wave completion detection
- Burst-spawn wave system — all enemies spawn in a quick burst at wave start
- Wave display states: "Spawning..." during burst, "Wave Active" during combat
- Achievement modal CSS styling (overlay, content cards, locked/unlocked states, animations)
- `openAchievements()` function alias for HTML button compatibility

### Changed
- **Wave system**: Replaced continuous `setInterval` spawn model with burst spawning (all enemies spawn at 200ms intervals, then stop)
- **State model**: Simplified from `enemiesInWave` + `enemiesSpawnedThisWave` (2 integers) to `waveSpawnComplete` (1 boolean)
- **Wave display**: Changed from ambiguous `Enemies: 5/8` to clear `Spawned: 5/8 | Alive: 3` format

### Fixed
- Wave progression stuck on wave 1 (#39, #40) — caused by broken continuous spawn model and boss minions bypassing wave quota
- Achievements button not opening modal (#37) — function name mismatch between HTML (`openAchievements`) and JS (`showAchievementsModal`)
- HTML/JS modal ID conflict — static `<div id="achievement-modal">` vs dynamic `<div id="achievementsModal">`
- Missing modal CSS styling — dynamic modal had no styles and would be invisible

### Removed
- Static achievement modal HTML from `defence.html` (replaced by JS-generated modal)
- Continuous spawn interval (`setInterval(spawnEnemies, 3000)`)
- Old `spawnEnemies` function

### Known Issues
- **Boss minions temporarily disabled** — bosses will not spawn minions to prevent quota bugs. Bosses still spawn and are extra tough. Tracked in #88.

### Recommendations
- **Short-term**: Add difficulty selection splash screen (Easy/Normal/Hard/Nightmare modes)
- **Long-term**: Re-implement boss minions with proper wave quota counting; add wave preview showing enemy types before spawn; add difficulty scaling options; add per-difficulty achievements

### Commits
- 97b20c91 — `refactor(waves): Completely redesign wave spawn system for clarity`
- 900b2c80 — `refactor(game-state): Update state to support new wave system`
- 7f1a7111 — `refactor(main): Remove continuous spawn interval, use burst spawning`
- 36280366 — `refactor(enemies): Remove old spawnEnemies function, expose needed functions`
- 9c1ae191 — Wave display clarity
- 82f18e1c — `fix(achievements): Add missing function aliases`
- 8e71ff4d — `fix(html): Remove duplicate achievement modal`
- 4ed334b5 — `fix(css): Add proper styling for achievement modal`
- 955c45f1 — Wave progression patch
- 79fa11d0 — Initial documentation
- 635bfe7c — Updated bug report

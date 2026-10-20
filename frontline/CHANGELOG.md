# Changelog — Frontline // Hexwire

## [0.3.0] — 2026-10-20 — Unified Dual-Style Engine (Issue #9)
- **Unified Engine (`engine.js`):** Consolidated `frontline/` and `hexwire/` into a single style-switching rules engine supporting **Frontline (1918 Dieselpunk)**, **Hexwire (2099 Street Magic)**, and **Rift War (Crossover)**.
- **Dynamic Ruleset Shifts:**
  - *Frontline:* 24-card pool with positional `M/R` melee vs. emplacement ranged firepower.
  - *Hexwire:* 26-card pool with 3 factions (`Chrome`, `Street`, `Hex`), `Strike` overwatch, **Puppeteer** (`Subvert ≤2` unit-stacking), and **Possession** (`5⚡` mind-control).
  - *Rift War:* Hybrid 26-card pool combining positional `M/R` units with `Rift Puppeteer` and `Rift Possession`.
- **Dual Tutorials:** Preserved both Frontline's 5-drill *Field Training* curriculum and Hexwire's 8-step interactive *Street Lessons* (including *THE SOLVE* exact-lethal final puzzle).
- **Dual Venice Art & WebAudio SFX:** Bundled both `art/` (1918 trenches) and `art-hw/` (2099 neon-noir) WebP portrait libraries plus era-tuned synthesized WebAudio sound effects (`js/sfx.js`).
- **Namespace-Safe Persistence:** Saved decks, ratings, and W–L records persist independently per style (`fl_*`, `hw_*`, `rf_*`) in `localStorage`.

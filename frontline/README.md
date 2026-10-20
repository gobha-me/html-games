# ⚔️🎴 Frontline // Hexwire — Dual-Style Tactical Card Battler

A unified **3-lane × 2-row tactical card battler** featuring a **dynamic style-driven rules engine** (`engine.js`) that shifts rulesets, card pools, Venice portrait art, synthesized WebAudio SFX, and tutorials on the fly across three playable card styles:

1. **⚔ FRONTLINE · 1918 TRENCHES (Dieselpunk)**
   - **Positional M/R Ruleset:** Every unit carries two powers — **Melee (`M`)** on the front **Line**, and **Ranged (`R`)** from rear **Emplacements** (safe while the line in front holds).
   - **24-card Standard Issue Pool** + 5-drill **Field Training** curriculum (*Hold the Line* through *Break Through* final exam).
   - **Meridian Campaign War Ladder** & Officer Commissions.
2. **🎴 HEXWIRE · 2099 STREET MAGIC (Cyberpunk)**
   - **Overwatch + Subvert/Possession Ruleset:** Three city blocks wide across **Chrome**, **Street**, and **Hex** crews. Front-row operatives brawl on the **Street**; back-row operatives fire from **Overwatch** using `Strike`.
   - **26-card Pool** unlocking **Puppeteer** (`Subvert ≤2` — seizes an enemy unit in its lane and hides beneath it until destroyed) and **Possession** (`5⚡` — permanently steals an enemy unit of cost ≤2).
   - **8-step Street Curriculum** culminating in **THE SOLVE** exact-lethal puzzle, plus simulated Algorand wallet connect and **The Block / Syndicate Floor** lobbies.
3. **⚡ RIFT WAR · CROSSOVER (1918 × 2099)**
   - **Hybrid Ruleset:** Combines Frontline's positional `M/R` artillery math with Hexwire's `Rift Puppeteer` (`Subvert ≤2`) and `Rift Possession` cards in a 26-card crossover pool.

---

## 🎮 How to Play

### Objective
Reduce the rival HQ / runner from **20 morale / life to 0** before yours breaks.

### Turn Structure
1. **Requisition / Fence (once per turn):** Tap **Requisition** (or **Fence a card**), then a card in hand to bank it for **+1 permanent supply/energy** (**+2** if the card costs `4+`). Supply/energy refills every turn.
2. **Deploy Operatives & Units:** Tap a unit card, then an empty slot on your half of the board:
   - **Front Row (`THE LINE` / `STREET`):** Fights down its sector/block with melee power and protects the back row behind it.
   - **Back Row (`EMPLACEMENT` / `OVERWATCH`):** Fires over the front row without taking retaliation damage, protected as long as the front slot is occupied.
3. **Issue Orders / Cast Hexes:** Play direct damage (`Artillery Strike` / `Hexbolt`), board wipes (`Creeping Barrage` / `Grid Surge`), buffs (`Fortify` / `Combat Stims`), card draw (`Intel Report` / `Datamine`), repositioning (`Forced March` / `Blinkstep`), or mind-control (`Possession`).
4. **End Turn:** Combat resolves automatically from left to right (Sector A→C / Block 1→3), front row then back row.

### Keywords Across Styles

| Frontline (1918) | Hexwire (2099) | Mechanics |
|---|---|---|
| **Bulwark (`BLW`)** | **Guard (`GRD`)** | Enemies in this lane must strike this unit first — even before an exposed front or back row. |
| **Plated (`PLT`)** | **Ward (`WRD`)** | Absorbs the first hit with zero damage taken. |
| **Rally X (`R+X`)** | **Rally X (`R+X`)** | On deploy: grants `+X` power permanently to adjacent allies. |
| **Rapid (`RPD`)** | **Wired (`WIRED`)** | Fights on the turn it deploys (skips *Dig In* / *ZZZ*). |
| **Gas (`GAS`)** | **Curse (`CURSE`)** | Any damage dealt destroys the target outright. |
| **Overrun (`OVR`)** | **Pierce (`PRC`)** | Excess lethal damage on a front-row kill spills through to the rival HQ/face. |
| — *(Rift & Hexwire)* | **Subvert ≤2 (`SBV≤2`)** | On deploy: seizes an enemy unit of cost ≤2 in this lane and hides beneath it until the host dies. |

---

## 📁 File Layout

```text
frontline/
├── index.html                 # Shell, fonts, animations, module entry
├── engine.js                  # Unified dual-style rules engine + heuristic AI (globalThis.FL)
├── README.md                  # This documentation
├── CHANGELOG.md               # Shipped milestone history
├── ART-DIRECTION-HEXWIRE.md   # Cyberpunk visual direction notes
├── venice-asset-brief.md      # Dieselpunk art/audio brief
├── ui-art-notes.md            # Display & focal crop notes
├── art/                       # Frontline 1918 Venice WebP portraits + board_field.webp
├── art-hw/                    # Hexwire 2099 Venice WebP portraits + board_field.webp
└── js/
    ├── main.js                # Bootstrap, URL ?style= support, reactive render loop
    ├── state.js               # Reactive state store
    ├── store.js               # Per-style localStorage persistence (fl_*, hw_*, rf_*)
    ├── theme.js               # Card names, AI crews, 8-step HW_LESSONS, ladder tiers
    ├── match.js               # Match flow, 5-drill TUT_LESSONS + 8-step HW_LESSONS, style switcher
    ├── deck.js                # 24-card roster/crew builder CRUD
    ├── art.js                 # Style-aware Venice portrait loader + focal crop map
    ├── labels.js              # Style-aware keyword badges
    ├── sfx.js                 # Synthesized WebAudio SFX per era
    ├── dom.js                 # Hyperscript DOM helper
    └── views/
        ├── stylebar.js        # Top Style / Ruleset Switcher Bar
        ├── home.js            # Frontline HQ / Hexwire Street Hub / Rift Command
        ├── match.js           # 3×2 tactical board, hand scroller, tutorial panels
        ├── rosters.js         # Roster / Crew deckbuilder with hover/tap card zoom
        ├── ladder.js          # War Ladder / Syndicate Standings
        └── overlays.js        # Card zoom, Weathervane / Credstick coin flip, Wallet modal, Settings
```

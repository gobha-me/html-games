# ⚔️ Frontline — The Great Works War

A dieselpunk trench-warfare **card battler**. Field infantry on the line, dig
artillery into the emplacements behind them, and requisition supply from the
rear across three sectors. First HQ to break 20 morale loses.

This is a **self-contained vanilla playtest client** for the Frontline design.
It reuses the design's pure-logic rules engine (`engine.js`) byte-for-byte and
recreates the Claude Design prototype UI in plain ES modules — no build step,
no framework, no backend.

> **Status: playtest client.** HTML-Games is not the permanent home for this
> project — it is advanced playtesting. If the game proves fun, the code moves
> to a project-specific repo where the real server / economy / chain platform
> (see `Tech Decisions`) gets built. The full backend stack (authoritative
> multiplayer, Postgres/Redis, real matchmaking, NFT minting) is **out of scope
> here** and deferred to that repo.

## 🎮 How to Play

### Objective
Reduce the enemy HQ's **morale to 0** before yours breaks. Both sides start at
20 morale (tunable in settings).

### The board
- **3 sectors** (A / B / C), each with two rows:
  - **The line** (front) — melee troops that fight down their sector.
  - **Emplacements** (back) — Bombard units that fire over the line, safe while
    the line in front of them holds.
- A **sector strip** between the armies shows each side's projected threat
  (`↓` enemy, `↑` yours) per sector.

### A turn
1. **Requisition** once per turn: tap **Requisition**, then a hand card, to bank
   it for **+1 permanent supply** (**+2** if it costs 4+). Supply refills each
   turn.
2. **Deploy**: tap a card, then an empty position — the line for melee,
   emplacements for Bombard units. Fresh troops are *entrenching* (can't act the
   turn they arrive) unless they have **Rapid**.
3. **Orders** (spells): Artillery Strike (3 dmg to a unit), Creeping Barrage
   (1 dmg to all enemies), Fortify (+1 pow / +2 ♥), Intel Report (draw 2),
   Forced March (move one of your units).
4. **End turn** — combat resolves automatically, then the enemy commander moves.

### Keywords
| Tag | Name | Effect |
|---|---|---|
| BLW | Bulwark | Must be destroyed before units behind it are hit |
| PLT | Plated | Ignores the first point of damage each hit |
| ⁂X | Bombard | Fires from the back row for X |
| R+X | Rally | Buffs row neighbours by X |
| RPD | Rapid | Can act the turn it deploys |
| GAS | Gas | Poisons on hit |
| OVR | Overrun | Excess damage carries to the HQ |

Flanks (`◀x y▶`) lend firepower to a unit's row neighbours — order your
formation to stack sectors.

### Modes
- **Skirmish vs AI** — a ranked match against a randomised enemy commander.
  Win **+18** standing, lose **−12** (floor 800).
- **Field Training** — a one-turn guided tutorial, then a live finish against a
  green conscript company. No standing change.
- **Rosters** — build 24-card decks (max 2 copies each), star a default.
- **War Ladder** — the season standings, you inserted among the sim commanders.
- **⚙ Settings** — playtest knobs: starting morale (5–40) and Fast AI.

## 🛠 Tech

- **Vanilla ES modules**, zero dependencies, zero build step — the source *is*
  the deployed artifact (served by `python3 -m http.server` behind Traefik).
- `engine.js` — the design's pure-logic rules engine + heuristic AI
  (`globalThis.FL`), **copied verbatim** from the design handoff. Never edited;
  the dieselpunk names are applied to `FL.POOL` at runtime.
- A tiny `h()` hyperscript helper + a `state` / `setState(patch)` → full re-render
  loop mirrors the prototype's reactive model.
- `localStorage` persists rosters, standing, and playtest prefs.
- **Venice art drop-in**: cards and the battlefield show optional venice-generated
  WebP art (board cell + hand-card art window) and fall back to the text card if
  absent — see [`art/README.md`](art/README.md).

## 📁 File layout

```
frontline/
├── index.html            # dieselpunk shell: fonts, CSS, #app root, module entry
├── engine.js             # rules + AI, verbatim from the design handoff (do NOT edit)
├── venice-asset-brief.md # the art/audio generation spec
├── art/                  # venice drop-in target (cards/{id}.webp, env/board_field.webp)
│   └── README.md         # naming contract
└── js/
    ├── main.js           # bootstrap: load engine, restore saves, mount render loop
    ├── theme.js          # dieselpunk names, AI decks, ladder tiers, helpers
    ├── store.js          # localStorage + sim ladder + prefs
    ├── state.js          # app state + setState/ping + myTurn
    ├── deck.js           # roster CRUD (2-copy / 24-cap rules)
    ├── match.js          # match flow + player actions (ported 1:1 from the prototype)
    ├── dom.js            # h() hyperscript helper
    ├── art.js            # venice art hooks (onerror text fallback)
    ├── labels.js         # keyword tag builders
    └── views/            # home · rosters · ladder · match · overlays
```

## 🔗 Credits

Rules, card pool, AI, and dieselpunk visual direction from the *Frontline* Claude
Design blend. Engine reused unmodified so the eventual production port stays a
faithful translation.

# 🎴 Hexwire — Street Magic

A neon-noir cyberpunk **lane card-battler**. Magic didn't return — it *leaked out
of the network*. Field street crews across three city blocks, fence cursed
hardware for power, and drop the rival crew from **20 life to 0**.

This is a **self-contained vanilla playtest client** for the Hexwire design. It
reuses the design's pure-logic rules engine (`engine.js`) byte-for-byte and
recreates the Claude Design prototype UI in plain ES modules — no build step, no
framework, no backend.

> **Status: playtest client.** HTML-Games is not the permanent home for this
> project — it is advanced playtesting. If the game proves fun, the code moves to
> a project-specific repo where the real server / economy / chain platform gets
> built. The full backend stack (authoritative multiplayer, matchmaking, wallet
> custody, on-chain cards) is **out of scope here** and deferred to that repo.
> The lobbies, ladders, and wallet connect in this build are **simulated**.

Hexwire and the sibling **Frontline** game share the same base rules engine but
are distinct games with strongly divergent themes (Frontline = dieselpunk trench
war; Hexwire = cyberpunk street magic). Their saves are isolated —
Hexwire namespaces all `localStorage` under `hw_`.

## 🎮 How to Play

### Objective
Reduce the rival crew's **life to 0** before yours breaks. Both sides start at 20.

### The board
- **3 blocks**, each with two rows:
  - **Street** (front) — melee crews that fight down their block.
  - **Overwatch** (back) — Strike units that fire over the street, safe while a
    friendly unit holds the street in front of them.
- A **block strip** between the crews shows each side's projected threat
  (`↓` enemy, `↑` yours) per block. An unanswered block is a damage clock on a face.

### A turn
1. **Fence** once per turn: tap **Fence a card**, then a hand card, to bank it for
   **+1 permanent income** (**+2** if it costs 4+). Energy refills to your income
   every turn — there is no passive ramp, so fencing is the whole economy.
2. **Deploy**: tap a card, then an empty cell — street for melee, overwatch for
   Strike units. Fresh units can't act the turn they land unless they are **Wired**.
3. **Cast** (spells): Hexbolt (3 dmg to a unit), Grid Surge (1 dmg to all enemies),
   Combat Stims (+1 pow / +2 ♥), Datamine (draw 2), Blinkstep (move one of your
   units), **Possession** (steal an enemy unit into an empty cell — two-step target).
4. **End turn** — combat resolves block-by-block automatically, then the rival crew moves.

### Keywords
| Tag | Name | Effect |
|---|---|---|
| GRD | Guard | Must be destroyed before units behind it are hit |
| WRD | Ward | Ignores the first point of damage each hit |
| ⚔X | Strike | Fires from the overwatch row for X, no retaliation |
| R+X | Rally | Buffs row neighbours by X |
| WIRED | Wired | Can act the turn it deploys |
| CURSE | Curse | Poisons on hit |
| PRC | Pierce | Excess damage carries to the enemy face |
| SBV≤X | Subvert | On deploy, steals an enemy unit of cost ≤X beneath it |

Flanks (`◀x y▶`) lend firepower to a unit's block neighbours — order your crew to
stack a block. **Subvert / Possession** are the signature move: a stolen unit
hides beneath the thief — kill the top unit to expose and reclaim it.

### Modes
- **Play vs AI** — a match against a randomised rival crew, with a rated result
  when a wallet is connected.
- **Tutorial** — a six-step guided walkthrough, then a live finish. No record change.
- **Decks** — build 24-card decks (max 2 copies each), star a default.
- **Lobbies / Ladders** — THE BLOCK (casual) and SYNDICATE FLOOR (rated, wallet-gated),
  plus Standard / Collector ladders. All simulated in this build.

## 🛠 Tech

- **Vanilla ES modules**, zero dependencies, zero build step — the source *is* the
  deployed artifact (served by `python3 -m http.server` behind Traefik).
- `engine.js` — the design's pure-logic rules engine + heuristic AI (`globalThis.FL`),
  **copied verbatim** from the design handoff. Never edited; the cyberpunk display
  names live in `FL.POOL`.
- A tiny `h()` hyperscript helper + a `state` / `setState(patch)` → full re-render
  loop mirrors the prototype's reactive model.
- `localStorage` (all `hw_`-prefixed) persists decks, the simulated wallet, and record.
- **Venice art drop-in**: cards and the battlefield show optional venice-generated
  WebP art (board cell + hand-card art window + roster thumbnail) and fall back to
  the text card if absent — see [`art/README.md`](art/README.md).

## 📁 File layout

```
hexwire/
├── index.html          # neon-noir shell: CSS, keyframes, #app root, module entry
├── engine.js           # rules + AI, verbatim from the design handoff (do NOT edit)
├── ART-DIRECTION.md    # the venice art/audio generation spec
├── art/                # venice drop-in target (cards/{id}.webp, env/board_field.webp)
│   └── README.md       # naming contract
└── js/
    ├── main.js         # bootstrap: load engine, restore saves, mount render loop
    ├── theme.js        # faction colors, AI crews, ladder, tutorial steps, helpers
    ├── store.js        # localStorage (hw_ keys) + simulated wallet + record
    ├── state.js        # app state + setState/ping + myTurn
    ├── deck.js         # deck CRUD (2-copy / 24-cap rules) + wallet connect
    ├── match.js        # match flow + player actions (ported 1:1 from the prototype)
    ├── dom.js          # h() hyperscript helper
    ├── art.js          # venice art hooks (onerror text fallback)
    ├── labels.js       # keyword tag builders
    └── views/          # home · rosters · match · overlays
```

## 🔗 Credits

Rules, card pool, AI, and neon-noir visual direction from the *Hexwire* Claude
Design blend. Engine reused unmodified so the eventual production port stays a
faithful translation.

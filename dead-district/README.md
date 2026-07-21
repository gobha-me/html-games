# 🧟 DEAD DISTRICT

A mature, top-down survival-horror wave shooter. They own the streets now —
take them back. Hold out against escalating waves of the horde for as long as
you can.

> ⚠️ **18+ / mature content.** Graphic violence, blood, and gore. The game
> opens with a built-in age gate; entry requires confirming you are 18 or older.

## 🎮 How to Play

### Objective
Survive. Each wave sends more of the horde at you than the last. There's no
finish line — push your score and survival time as far as you can before you go
down.

### Controls
- **WASD** or **Arrow keys** — move
- **Mouse** — aim
- **Click / hold** — fire (ammo is unlimited)
- **P** — pause / resume
- **M** — mute / unmute
- **Touch** — left half of screen: virtual stick to move; right half: hold to
  aim & fire; **❚❚** button (next to mute) pauses

### Rules
1. Zombies spawn from the edges of the map and close on your position.
2. Shoot them before they reach you — contact drains your health.
3. Clearing a wave triggers a short breather, then the next, larger wave.
4. Downed enemies sometimes drop **pickups** (health) — grab them to stay alive.
5. Game over when your health hits zero.

## 👹 Enemies

| Type   | Behavior                              | Score |
|--------|---------------------------------------|-------|
| Walker | Standard shambler                     | 10    |
| Runner | Fast, low-HP; appears more often late | 15    |
| Brute  | Huge, tanky, high-damage; every 3rd wave and rising odds thereafter | 40 |

Enemy HP, speed, and spawn counts scale with the wave number, so the pressure
never lets up.

## 🏆 Scoring
Score accrues per kill (see table above). Your best score is saved to
`localStorage` (`dd_hiscore`) and shown on the menu as **BEST SCORE**.

## 🎯 Features
- Wave-based survival with per-wave difficulty scaling
- Three enemy archetypes with distinct HP / speed / threat profiles
- Brute mini-boss cadence (every third wave, with rising random odds)
- Blood, gore particles, and spent-casing effects
- Health pickups dropped on kill (brutes drop them far more often)
- Web Audio SFX (shotgun, hits, groans, deaths) + background music, mutable
- Dual virtual-stick touch controls for phones/tablets
- Built-in 18+ age gate, pause, and a stats-rich game-over screen
- High-score persistence via `localStorage`

## 🛠️ Tech Stack
Vanilla HTML / CSS / JS. Single `<canvas>` render loop, no build step, no
dependencies. Art and audio are baked PNG + MP3 assets under `assets/`.

## 📁 File Layout
```
dead-district/
├── index.html          # markup: age gate, canvas, HUD, menu, pause, game-over
├── css/style.css       # horror-red theme, overlays, back-to-arcade link
├── js/game.js          # game loop, spawning, waves, combat, scoring
└── assets/
    ├── img/            # player, zombie, brute, blood, pickup, ground, backgrounds
    └── audio/          # shotgun, hit, groan, death SFX + music
```

## 📌 Status
Playable, v1.1.0. Imported into the arcade from a standalone prototype; registered
on the launcher with a blood-crimson (`#c81e1e`) theme. Mobile/touch supported via
dual virtual sticks (see Controls).

---
← [Back to Arcade](../)

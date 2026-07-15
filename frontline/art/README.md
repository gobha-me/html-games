# Frontline art drop-in

This folder is the **venice drop-in target**. Nothing here is required — the game
renders as text cards without it. Drop a WebP named after a card's **canonical id**
and it appears with that card (board cell + hand-card art window), with **zero code
changes**. If a file is missing or fails to load, the card silently falls back to
its text layout (`js/art.js` removes the image `onerror`).

Art here is **WebP** (converted from the venice 1024×1280 PNG masters, downscaled to
~640×800 for web). WebP is opaque here but supports alpha if a future asset needs it.
Generate directly with venice via `--format webp`, or drop in your own.

See [`../venice-asset-brief.md`](../venice-asset-brief.md) for the full art/audio
generation spec (style, palette, prompts).

## Naming contract

```
art/
├── cards/<id>.webp     # one per card id below (portrait art, ~640×800)
└── env/board_field.webp # optional battlefield backdrop behind the grid (~20% opacity)
```

The `<id>` is the engine's canonical id from `engine.js` `FL.POOL` — **not** the
dieselpunk display name. The mapping:

### Units
| id | Card |
|---|---|
| `scout` | Recon Runner |
| `skirm` | Trench Raider |
| `picket` | Sandbag Line |
| `foot` | Rifleman |
| `archer` | Mortar Team |
| `shieldb` | Barricade Crew |
| `duel` | Shock Trooper |
| `adder` | Gas Grenadier |
| `banner` | Signal Officer |
| `vet` | Line Sergeant |
| `cross` | Field Gun |
| `warden` | Bunker Guard |
| `champ` | Armored Car |
| `lancer` | Breacher Tank |
| `marks` | Howitzer |
| `outrider` | Dispatch Rider |
| `van` | Land Dreadnought |
| `ballista` | Rail Cannon |
| `warlord` | Field Marshal |

### Orders
| id | Card |
|---|---|
| `bolt` | Artillery Strike |
| `volley` | Creeping Barrage |
| `reinf` | Fortify |
| `insight` | Intel Report |
| `redeploy` | Forced March |

## Notes

- On the **board**, art fills the dark cell behind a bottom-up scrim so the light
  unit text (name / power / ♥) stays legible. In the **hand**, the art shows in a
  window at the top of the card with the paper text panel below it. Portrait framing
  (subject centered, upper two-thirds) reads best in the ~80px board cells and the
  ~106px-wide hand-card art window.
- Paths are relative to `frontline/index.html`, so they resolve correctly under
  the `/games` strip-prefix on deploy. Do not use leading `/` or absolute URLs.

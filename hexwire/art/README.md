# Hexwire art drop-in

This folder is the **venice drop-in target**. Nothing here is required — the game
renders as text cards without it. Drop a WebP named after a card's **canonical id**
and it appears with that card (board cell + hand-card art window + roster thumbnail),
with **zero code changes**. If a file is missing or fails to load, the card silently
falls back to its text layout (`js/art.js` removes the image `onerror`).

Art here is **WebP** (converted from the venice 1024×1280 masters, downscaled to
~640×800 for web). WebP is opaque here but supports alpha if a future asset needs it.
Generate directly with venice via `--format webp`, or drop in your own.

See [`../ART-DIRECTION.md`](../ART-DIRECTION.md) for the full art/audio generation
spec (style, palette, per-card prompt seeds).

## Naming contract

```
art/
├── cards/<id>.webp      # one per card id below (portrait art, ~640×800)
└── env/board_field.webp # optional battlefield backdrop behind the grid (~18% opacity)
```

The `<id>` is the engine's canonical id from `engine.js` `FL.POOL` — **not** the
cyberpunk display name. The mapping:

### Units
| id | Card | Faction |
|---|---|---|
| `scout` | Lookout | STREET |
| `skirm` | Ripper | CHROME |
| `picket` | Bouncer | STREET |
| `foot` | Ganger | STREET |
| `archer` | Watch Drone | CHROME |
| `shieldb` | Riot Shield | STREET |
| `duel` | Switchblade | STREET |
| `adder` | Curseblade | HEX |
| `banner` | Fixer | STREET |
| `vet` | Merc | STREET |
| `cross` | Gun Drone | CHROME |
| `warden` | Wardkeeper | HEX |
| `champ` | Enforcer | STREET |
| `lancer` | Breacher | CHROME |
| `marks` | Sniper | CHROME |
| `outrider` | Chromed Rider | CHROME |
| `van` | Bound Golem | HEX |
| `ballista` | Railgun | CHROME |
| `warlord` | Kingpin | STREET |
| `puppet` | Puppeteer | HEX |

### Spells
| id | Card |
|---|---|
| `bolt` | Hexbolt |
| `volley` | Grid Surge |
| `reinf` | Combat Stims |
| `insight` | Datamine |
| `redeploy` | Blinkstep |
| `possess` | Possession |

## Notes

- On the **board**, art fills the dark cell behind a bottom-up scrim so the light
  unit text (name / power / ♥) stays legible. In the **hand**, the art shows in a
  window at the top of the card with the text panel below it. In the **roster pool**
  it renders as a 44×56 thumbnail with the cost badge on its corner. Portrait framing
  (subject centered, upper two-thirds) reads best across all three sizes.
- Paths are relative to `hexwire/index.html`, so they resolve correctly under the
  `/games` strip-prefix on deploy. Do not use leading `/` or absolute URLs.

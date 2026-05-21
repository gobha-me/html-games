# Oregon Trail

A turn-based journey along the historic Oregon Trail (1848). Lead your party from Independence, Missouri to the Willamette Valley, managing resources, making moral choices, and building a reputation on the trail.

## Status

**v0.1 — Playable Core.** Full day-loop, six event corpora (weather/illness/encounter/terrain/opportunity/moral), party voices, Trail Ledger end screen, and auto-save shipped. Known issues: see open tickets. Stretch goals for v0.2: audio hooks (#240), persistent stats panel (#239).

## How to Run

1. Clone the [HTML-Games](https://github.com/xcaliber/HTML-Games) repository.
2. Open `index.html` in a browser to access the arcade launcher.
3. Click the **Oregon Trail** card, or navigate directly to `oregon-trail/index.html`.

## File Structure

```
oregon-trail/
├── index.html              # Game entry point
├── css/
│   ├── style.css           # Base styles
│   ├── game.css            # Game screen styles
│   └── end-screen.css      # End screen / Trail Ledger styles
├── js/
│   ├── turn-loop.js        # Day-loop engine
│   ├── ui.js               # Decisions panel & HUD
│   ├── resources.js        # Resource model
│   ├── party.js            # Party state & voices
│   ├── save-load.js        # Auto-save / load
│   ├── event-runner.js     # Event dispatch
│   ├── region-runner.js    # Regional flavor dispatch
│   ├── end-screen.js       # Win/Lose/Partial + Trail Ledger
│   ├── events/
│   │   ├── weather.js      # Weather event corpus
│   │   ├── illness.js      # Illness event corpus
│   │   ├── encounter.js    # Encounter event corpus
│   │   ├── terrain.js      # Terrain event corpus
│   │   ├── opportunity.js  # Opportunity event corpus
│   │   ├── moral.js        # Moral choice event corpus
│   │   ├── party-voices.js # Party voice archetypes
│   │   └── regions/
│   │       ├── plains.js   # Plains regional flavor
│   │       ├── mountains.js # Mountains regional flavor
│   │       └── desert.js   # Desert regional flavor
├── README.md               # This file
├── CHANGELOG.md            # Version history
├── DESIGN.md               # Game design document
└── docs/
    ├── ROADMAP.md          # Development roadmap
    └── TICKETS-17-20.md    # Phase 4 ticket specs
```

## Design

See [DESIGN.md](DESIGN.md) for the full design document, including the Trail Ledger reputation system, core gameplay loop, and resource model.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the phased development plan.

## License

Part of the HTML-Games collection.

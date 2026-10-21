# Late Edition // 1947 — Creative Direction (decisions locked 2026-10-21)

## Vision in one line
**You run the night desk of a city paper. Every story you print is a weapon, and every story you *don't* print is leverage.**

The newspaper is the front. The real game is the **file drawer**, the secrets you hold back. Each night you decide what the city reads at dawn, and that decision is the moment the whole game builds to.

## Pillars
1. **The front page is the decision.** No auto-plating. Every edition ends with you laying out the page by hand: what goes above the fold, what gets buried, and what gets *spiked into the file drawer* for later. Everything else in the edition feeds this moment.
2. **Ink or leverage.** Each verified story can be printed (readers, trust, heat) or filed (leverage you spend later on favors, protection, blackmail and buyouts). That choice is the "information empire" the pitch promised.
3. **Diegetic, tactile, one desk.** Every piece of UI is a physical object on the desk: a telegram, a press pass, a phone, a galley proof, a carbon. Nothing is a widget, and captions only explain things the objects can't show.
4. **The city remembers.** Arcs, sources, rivals and the people you burned carry over between nights. Consequences arrive later, by phone, at the worst possible time.
5. **Midnight is a show.** The press run is a payoff sequence: plate, roll, spin-up, papers fly, newsboy cry, then the morning-after headline from the rivals.

## Mood
Rain at 11:40 PM. Sodium lamps, wet asphalt, cigarette smoke caught in a desk lamp. Tired, clever, a little compromised. The register is *Sweet Smell of Success*, not cartoon gangsters.

## Art bible
**Palette (strict; no other hues in the UI):**
| Role | Hex | Use |
|---|---|---|
| Night ink | `#0E0D0C` | backgrounds, the city's black |
| Mahogany | `#2A1710` | desk |
| Smoke | `#6B655C` | inactive, muted |
| Newsprint | `#EDE4CE` | the paper and the cards |
| Aged newsprint | `#D9CBA8` | stand-ins, old files |
| Lamp sodium | `#E8A23A` | the single highlight; selection; the clock |
| Brass | `#B5893F` | the hardware |
| Stamp red | `#A3221B` | danger, deadlines, SPIKED/KILLED |
| Telegram yellow | `#EAD58A` | incoming wire only |
| Police-light blue (rare) | `#3E5A78` | the precinct and raids only, desaturated |
Delete the Tailwind cyan, emerald and rose entirely. State is shown by *ink, stamp and position*, not by hue.

**Type (self-hosted WOFF2, open licenses; no CDN):**
- Banner and headlines: a condensed gothic (e.g. *League Gothic* / *Oswald*-class, or *Alfa Slab* for the masthead only).
- Body copy: a Century/Ionic newspaper serif (e.g. *Old Standard TT* or *Libre Caslon Text*).
- Wire and teletype: a typewriter face (e.g. *Special Elite* / *Courier Prime*).
- The masthead is a single blackletter or engraved wordmark, used nowhere else.
- Only three faces live in the UI, with no Playfair. Caps get tracking. The broadsheet has rules, column gutters and justified text with hyphenation.

**UI motifs:** paper with grain and slight rotation. Rubber stamps (VERIFIED, SPIKED, KILLED, EXCLUSIVE). Carbon-copy blue only on the file drawer. Pins and yarn on the corkboard. A bakelite phone that physically rings and shakes. The flip clock. Every card casts a soft shadow from a single desk lamp at the top left.

**City map:** a sodium-lit nightscape at an oblique angle, with silhouette buildings and a few lit windows. Districts are shown by *street signage and neighbourhood*, not neon outlines. Fog and rain are the fog-of-war. Operatives are small hat-and-coat silhouettes, which replaces the pixel sprites.

**Motion:** paper slaps (fast in, a tiny settle), stamps (scale overshoot plus ink bleed), type setting letter by letter on the plate, a press spin-up montage, and the phone shake. Nothing eases like a web app.

**Sound (free-licensed or synthesized only):** a rain-and-city ambience bed, a newsroom murmur that thickens toward midnight, the typewriter, the teletype chatter on the wire, the phone bell, the press roar, and a newsboy "EXTRA!". Sparse muted-trumpet and upright-bass cues sit at the edition start and at five minutes to midnight. The procedural bell stays as the fallback.

**Touchstones:** *Sweet Smell of Success* (1957), *The Big Clock* (1948), *Ace in the Hole*, Weegee's flash photography, *L.A. Noire* (the desk and the case files), *Papers, Please* (the desk as the whole interface), *Frostpunk* (moral dilemmas under a timer), *Return of the Obra Dinn* (restraint). For layout, real 1940s front pages: NY Daily News, the Herald Tribune.

## The 5 biggest moves
1. **A foundation reset.** Use a seeded deterministic sim, split the pure sim from the DOM, add tests, ESLint and a smoke test, fix the game-over screen and the dropped clicks, and rewrite the stale AGENTS.md. Nothing creative is safe to build until this exists.
2. **Hand layout as the climax.** Drag stories onto a real broadsheet grid, with a choice to print, bury or spike each one. Remove auto-plating.
3. **The file drawer (the information empire).** Spiked stories become leverage, which you spend on favors (police tip-offs, a stopped raid, a killed rival story) and blackmail with blowback.
4. **An art-bible pass.** Apply the strict palette, self-hosted period type and a diegetic desk with weight and shadow, plus a redrawn noir city.
5. **Sound and the midnight show.** Add an ambience bed, music cues and the press-run sequence, plus a title screen and the morning-after.

## Draft issues (logical order; NOT created)
Every code issue carries these standard ACs: **ESLint clean (no blanket disables; any `eslint-disable-next-line <rule> -- reason` is specific), adversarial tests cover the unhappy paths listed, CI green, CHANGELOG updated.**

### 1. chore(late-edition): replace stale AGENTS.md with a current architecture + conventions doc
Body: The 829-line AGENTS.md describes the deleted ICD/Three.js project. Replace it with a document of at most 150 lines covering the module map, the sim/UI boundary, determinism rules, art-bible pointers, test and lint commands, and best-practice exceptions with their reasons. Backfill CHANGELOG for #77 (2.2.0).
AC: No references to deleted paths (a linkcheck-style grep in CI fails on `icds/`, `design/` or `roadmap.md`). Naming is canonicalized (one paper name, rival names) in a lore table.

### 2. chore(late-edition): ESLint + stylelint + html-validate in CI
Body: Add flat-config ESLint (recommended rules plus no-unused-vars, eqeqeq, no-implicit-globals), stylelint-config-standard, and html-validate for index.html, with a scoped CI job for `late-edition/**`.
AC: CI fails on lint errors (proven by a deliberately bad fixture in the test run). It catches the malformed `paper-projected- readers` id, which gets fixed. Zero blanket disables.

### 3. refactor(late-edition): seeded deterministic sim, pure core
Body: Inject a seeded PRNG (mulberry32) and a clock into `LateEditionSim`. Move localStorage, audio and string formatting behind adapters, so that `sim.js` imports no DOM. The README's "deterministic" claim becomes true.
AC: The same seed plus the same input script gives an identical state hash after 5 editions (golden test). A grep test confirms no `Math.random` and no `window`/`document` in `sim.js`. Adversarial cases: dt NaN, negative, 0 and 10 s; a corrupted or absent localStorage value; and a storage write that throws a quota error.

### 4. test(late-edition): adversarial sim suite (node:test)
Body: Restore coverage the rewrite dropped, with the unhappy paths first.
AC: Tests cover dispatching to an expired or nonexistent lead, an unknown operative id, all operatives busy, publishing with 0 plated slots, double publish in one tick, dilemma timeout with no answer, bribe with insufficient funds, heat >100 and trust <0 clamping, press HP hitting 0 mid-publish, arc part plated out of order, and a rival and the player completing the same lead in the same tick. Coverage of `sim.js` is at least 80% lines, enforced via `--experimental-test-coverage`.

### 5. fix(late-edition): game-over screen + stable input (no innerHTML churn)
Body: Render a "PAPER FOLDED" end screen with `gameOverReason`, the final front page and a restart button. Replace the 250 ms innerHTML rebuilds with keyed diffs or a dirty-flag update, so hover, focus and click survive.
AC: A Playwright smoke test (new CI job) forces trust to 0 and asserts the end screen plus a working restart. 100 scripted lead clicks during live play give 100 dispatches. A keyboard-only playthrough of 1 edition passes. No console errors. Adversarial: clicking during a rebuild, pressing Space on the end screen, and resizing mid-edition.

### 6. feat(late-edition): title screen, cold open & first-night onboarding
Body: A title card (masthead over the rainy city, "Start the night shift", continue or best run), plus a 30 s cold open: the phone rings, Lou Vance gives the first assignment, and the clock starts only when the player dispatches. Progressive disclosure means night 1 shows only reporters and the page. Photo, fixer, wiretap and the phone unlock on nights 2 to 4.
AC: The clock doesn't advance before the first dispatch (test). Each unlock gets a test. Reduced-motion is respected. Adversarial: skipping the intro mid-line, a first click on a lead with no operative, and reloading during the cold open.

### 7. feat(late-edition): hand layout — print / bury / spike
Body: Remove auto-plating. At 11:00 PM the desk shifts to the paste-up, and the player drags or keys stories into Banner, Fold, Photo, Inside (buried) or Spike. Slot weights stay, and placement also shifts trust and heat (an accusation in the banner raises heat more).
AC: The `A` auto-plate key is removed or becomes an optional assist that is flagged in scoring. Layout is fully keyboard-operable. Tests: a story can't be in two slots, a slot can't take two stories, spiking a story that's already plated, the deadline expiring mid-drag (the page publishes what's placed), and an empty banner (stand-in plus a trust penalty).

### 8. feat(late-edition): the file drawer — leverage economy
Body: Spiked stories become dossier cards. Spend them to call in favors (a police tip moves a lead, a goon is stopped, a rival story is killed) or for blackmail (cash or protection, with a chance of a burned-source phone call later). Files decay as the news ages. This is the "information empire" pillar.
AC: The drawer state persists across editions and through the save. Balance is set by a sim test: there's no infinite cash loop over 20 seeded nights (an automated bot asserts the bounds). Adversarial: using a file that has expired, using the same file twice, blackmailing someone who is already dead or exposed, and a drawer at capacity.

### 9. feat(late-edition): save / load the run
Body: An autosave at each edition end, plus "Continue" on the title. The save format is versioned.
AC: Round-trip equality test. Adversarial: truncated JSON, a wrong version, values tampered out of range, storage full, and a save from an older version migrating (or being cleanly refused with a message).

### 10. art(late-edition): palette + self-hosted type + diegetic desk pass
Body: Apply the art bible. Strict palette tokens with every Tailwind hue deleted, WOFF2 fonts self-hosted with their OFL licenses committed, captions cut by half or more, and paper grain, lamp shadow and rotation on the cards. Replace the neon district outlines.
AC: stylelint rule (`color-no-hex` outside `:root` tokens) passes. A test asserts there are zero requests to external origins (the Playwright network log). Before and after screenshots are attached to the PR. The game is legible at 1280×720. Adversarial: fonts blocked (the fallback stack must keep the layout), and 200% zoom.

### 11. art(late-edition): noir city map redraw + operative silhouettes
Body: An oblique silhouette skyline with sodium light pools, lit windows, rain streaks, fog as the fog-of-war, street-sign district labels, and hat-and-coat silhouettes for the operatives.
AC: 60 fps at 1080p on the CI SwiftShader smoke test, with a frame-time budget assert of p95 under 20 ms. Leads stay clickable (hit-tests stay out of the art and are covered by tests). Reduced-motion mode is supported.

### 12. audio(late-edition): ambience bed, music cues & the midnight press-run show
Body: Rain and newsroom loops whose intensity rises toward midnight, a muted-trumpet sting at five to midnight, a phone bell, the teletype, the press spin-up, a newsboy "EXTRA!", and a morning-after rival headline card. Add volume sliders for music, ambience and SFX.
AC: An audio fetch failure falls back silently (test with blocked requests). Mute persists. No AudioContext starts before a user gesture. Total audio is under 2 MB. Every asset's license or generator provenance is documented.

## Locked decisions (2026-10-21)
1. The file drawer (ink vs leverage) is the heart of the game.
2. Art: silhouette noir illustration; the pixel sprites are retired.
3. Editions run about 3 to 4 minutes (target 210 s), with optional 2× speed.
4. Tone: grounded *Sweet Smell of Success* cynicism.
5. The paper is **The Evening Star**. "Metropolitan Chronicle" is retired.
6. Audio is free-licensed (CC0/CC-BY with attribution) or synthesized only. No paid generation.
7. Desktop-only, with a 1280×720 minimum and a "desk too small" card below that size.
8. Adversarial tests and lint are required by the owner's standing rules, which override #12's pruning.

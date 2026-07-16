# UI/Art Implementation Notes — for Claude Code
Intent notes for the four visual requests. The goal in all four: the art is the product — chrome yields to art, but rules text and numbers must never lose legibility.

## 1. Battlefield background visibility
Problem: the board panel + 12 cell tiles are opaque, hiding ~98% of the battlefield background art.
Intent: the background should read as the terrain the fight is happening ON, not a border decoration.
- Make the board container fully transparent; drop its solid fill entirely.
- Cells: translucent fills, not solid — occupied ~`rgba(surface, 0.55–0.7)`, empty ~`rgba(surface, 0.25–0.35)` with the existing dashed/solid borders kept at full opacity (borders carry the grid readability, fills don't have to).
- Legibility floor: every text element inside a cell sits on its own local scrim — a subtle radial/linear gradient behind the text block or a 1px text shadow + `backdrop-filter: blur(2px)` on the unit chip only. Test rule: stat numbers must pass ~4.5:1 contrast against the WORST region of the bg art, not the average.
- The mid-strip (sector threat readouts) and top/bottom HUD bars may stay near-opaque — they're instruments, not terrain.
- Dim the bg art itself ~15–25% (single overlay on the image, not on the board) so it never competes; tune per final art.

## 2. Card art zoom in the deck builder
- Interaction: hover (desktop) after ~250ms delay, and click/tap (mobile) on the art thumbnail → large preview; Esc/click-away closes.
- The zoom shows the FULL rendered card at readable size (~420–480px wide): full-bleed art, name, cost, M/R/♥, keywords with their reminder text, edition/serial line for owned prints.
- One shared overlay component, anchored so it never covers the list row you're pointing at (flip side based on viewport half).
- Preload the large art on row hover-intent; never block the list on it.

## 3. Deployed card slots — taller
- Yes: grow board cells vertically so the deployed unit renders as a mini-card (art visible), target ratio ~3:4 per cell instead of the current squat rectangle.
- Constraint: the full 4-row board + hand + controls must still fit a 1080p viewport without scrolling — take the space from the log/dispatches area (collapse it to a 1-line ticker with expand-on-click) before shrinking anything else.
- If it doesn't fit: art-behind-stats treatment (cell shows art as the tile's background with the stat strip at the bottom) beats scrolling or shrinking the hand.

## 4. Hand cards — art crop is card-dependent
Root fix, not a CSS tweak: add a per-card `focal` field to the card catalog (single source: `cards.yaml`, flows into art metadata from the venice pipeline).
- `focal: top | center | bottom` (or a 0–1 y-fraction if we want finer control) — authored once per card when the art is accepted, used EVERYWHERE the art crops: hand, board cells, deck-builder rows, ladder avatars.
- Implementation: `object-fit: cover; object-position: 50% var(--focal-y)`.
- Default `center`; the art-acceptance checklist (venice brief §4) gains a line: "focal point recorded".
- Hand cards keep their current fixed height; the focal crop is what fixes the "wrong slice" problem.

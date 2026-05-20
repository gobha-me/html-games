# discussion · accessibility

**Status:** open · pre-architecture · first-pass checklist below
**Cites:** Design Doc §13 (HUD) · ICD-06 (deadline events)

The MVP accessibility floor. Not exhaustive, not committed — a first pass to
keep code sessions from painting us into a corner.

## Motion

- Rain and fog are mood-load-bearing but can be a vestibular trigger. Provide
  a `--reduce-motion` toggle that dampens rain intensity to 0.2 and freezes
  fog at midpoint.

## Audio cues

- **The deadline non-visual signal**: audio sting + HUD shake at T-30s, both
  hung off `DEADLINE_WARNING` (ICD-06). The audio sting is the *primary* cue;
  the HUD shake is the redundant visual.
- Avoid high-frequency-only cues. Deadline sting should be a low-mid bass
  thud, not a treble bell.

## Color

- The palette is monochrome-on-paper with bleed-red accents. Bleed-red is the
  only color carrier — never put information in color alone. Pair every red
  signal with a typographic or iconographic cue.
- Test against deuteranopia and protanopia simulators when the HUD lands (0.9).

## Keyboard

- Every mouse action has a keyboard equivalent. WASD pan is the camera. Tab
  cycles units; Space dispatches.

Revisit at the post-0.9 re-eval.

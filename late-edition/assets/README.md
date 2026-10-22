# Late Edition assets

Map architecture, weather, title skyline, lead flags and operative portraits are
procedural Canvas2D art in `../js/renderer.js`, `../js/city.js` and
`../js/silhouettes.js`. All colors derive from `../js/palette.js`; cosmetic
seed 1947 never advances gameplay randomness. There are no runtime unit images.

`paper-grain.png` is the original #88 monochrome SVG turbulence filter baked at
120×120 once with Chromium Canvas2D. Its monochrome luminance is encoded as black
with inverse-luminance alpha, then tiled at the same 0.065 opacity using normal
source-over. This matches the old multiply operation within one 8-bit channel step
on every palette color, including ink, without destination-dependent CSS blend
surfaces that stalled SwiftShader presentation (PR #101). No third-party artwork.
Rebuild from the retained filter
source with `node e2e/bake-paper-grain.js` from this directory's parent. This
removes both runtime filter evaluation and blend surfaces without changing the grain.

The four retired `unit_*.png` pixel sprites were deleted in 2.10.0 (#89).
`sprite` fields in historical saves/roster records remain harmless compatibility
metadata; rendering uses operative roles, without changing saved gameplay state.

The two original retained illustrations are still used:

- `sprites/portrait_editor.png`: Lou Vance's desk portrait in `../index.html`.
- `sprites/masthead_press.png`: press/file-photo plate in `../js/main.js`, including
  the empty darkroom stand-in. It no longer substitutes a retired unit sprite.

`audio/` retains the three existing newsroom/press/camera cues.
[Font credits, licenses and reproducible provenance](fonts/README.md) cover the
self-hosted WOFF2 assets. No external runtime asset or font service is required.

# Keeper #141 renderer regression slice

`unknown-ship-regression.spec.js` calls the public `createRenderer(canvas).draw()`
with real Canvas 2D in headless Chromium. Its fixture derives from the public
`createState(108)` trawler at range 200. A second capture turns the beam away
from that same vessel before it has an afterimage. The test checks that this
capture shows only the running lights and masks the pixels they change.
Each beam position has its own empty background for comparison. The four
known hull types and the unknown fallback must each contribute pixels
outside the mask. No renderer, drawing command, perception function or
logging function is replaced.

The checks require an arbitrary unknown type to draw without throwing, contribute
visible pixels, log once for each ship/type pair (including revisiting a previous
pair), and allow a caller's native requestAnimationFrame chain to draw three
frames. Current main already passes fallback/frame checks. Only its observed
missing diagnostic is a named expected failure; setup and fixture assertions run
before that annotation. A separate logging fix will make it an unexpected pass;
the test lane must then remove the annotation. The active fallback/frame checks
guard the freeze reported against the separate #116 renderer in #143.

After installing the locked tools and Playwright Chromium, run from `keeper/`:

```sh
heavy-run npm run test:e2e -- e2e/unknown-ship-regression.spec.js --workers=1 --retries=0
KEEPER_141_RED=1 heavy-run npm run test:e2e -- e2e/unknown-ship-regression.spec.js --workers=1 --retries=0
```

The second command exposes the missing-log assertion as an ordinary failure on
unchanged main. The tests capture draw exceptions and assert their absence, so
a renderer that throws fails by assertion rather than an uncaught browser error.

This slice covers the renderer and its caller's frame chain. It does not inject
an unknown hull into the actual game loop: main's documented e2e state hook is
read-only, and main has no `save.js`/`parseSave` surface yet. Save rejection, valid
resume and the actual main-loop acceptance remain pending the separate #145
save/resume surface. No #143/#145 files, product code, existing assertions or CI
configuration are changed.

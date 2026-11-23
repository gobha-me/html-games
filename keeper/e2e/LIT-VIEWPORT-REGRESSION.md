# Keeper #140 native Canvas viewport regression

This issue-derived suite exercises `createRenderer(canvas).draw()` in headless
Chromium with a native, displayed Canvas 2D surface. It uses the five supported
viewports from #140: 1280×720, 1366×768, 1600×900, 1920×1080 and 2560×1440.

The fixture clones the real `createState(108)` trawler, positions it at `(0,330)`
south of the light, and aims the real beam using `bearingTo`. It checks `isLit`,
`perception().hull` and fog reach before applying the named expected failure.
At fixed simulation time and reduced motion, it compares every viewport pixel
with and without the vessel. At least one pixel must differ. This is an
existence check, not a visual taste or identifiability threshold. The entire
viewport is eligible so the test accepts either the hull or an edge indicator,
as the issue permits; it does not require a particular `toScreen` mapping.

An on-screen lit vessel at `(0,-200)` is the positive control at every size.
The absent-vessel background must redraw identically. Import failures, draw
exceptions, incorrect dimensions and invalid/unlit fixtures fail ordinary
assertions before the expected-fail annotation; they cannot supply bug evidence.
The southern cases attach numeric native-canvas visibility evidence.

From `keeper/`, after installing the repository's locked development tools and
headless Chromium:

```sh
heavy-run npm run test:e2e -- e2e/lit-viewport-regression.spec.js --workers=1 --retries=0
KEEPER_140_RED=1 heavy-run npm run test:e2e -- e2e/lit-viewport-regression.spec.js --workers=1 --retries=0
```

The first command retains the named #140 expected failures. The second exposes
them as real assertion failures on unchanged main. A separate product fix that
makes a southern hull or edge indicator visible will cause an unexpected pass
until the expected-fail annotations are removed by the test lane.

No product files, existing assertions, CI/workflows or #143/#145 files are
changed. The suite covers native renderer output; it does not prove the main
requestAnimationFrame lifecycle or locked-scene pixel invariance. Run the
repository's full lint, tests and configured mutation gate before publication.

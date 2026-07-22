# Changelog

All notable changes to BACKBEAT are documented here. Format: Keep a Changelog.

## [1.0.0] - 2026-07-22

### Added
- Initial release: 4-lane rhythm game (vanilla JS + Web Audio + canvas).
- Hit detection with perfect/good/miss windows across Easy/Normal/Hard.
- Score, combo, accuracy HUD and results screen; localStorage high score.
- Audio-offset calibration control (player-tunable latency compensation).
- Ship track "Backbeat Anthem" (Venice-generated instrumental, ~120 BPM, 90s).
- Note chart generated via onset-detection (`tools/chartgen.py`), 150 notes.
- Generated hit SFX and background art.
- Touch-tap lane input for mobile; pause/resume; Back to Arcade link.

### Notes
- Chart is beat-calculated, not hand-timed — human playtest pending on groove
  and default offset. See README "Status".

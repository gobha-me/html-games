# discussion · difficulty-selector

**Status:** committed-direction · frequency-scaling only · deferred to Tier-1 run-meta layer
**Settled:** [`../architecture/re-eval-after-0.6.md`](../architecture/re-eval-after-0.6.md) §3.5 Q4
**Cites:** Design Doc §19 · §20 TBD

Frequency-scaling vs aggression-scaling — which knob do we expose?

- **Frequency-scaling**: more leads, more raids, more rival actions per
  edition. The game gets *louder*. Easier to author (single multiplier).
- **Aggression-scaling**: same volume, but rivals act more decisively (raid
  earlier, bribe more aggressively, poison more leads). The game gets
  *sharper*. Harder to author but reads as more honest difficulty.

**Working position:** post-MVP, **frequency-scaling only**. Single multiplier
on rival tick cadence + lead-spawn cadence. Aggression-scaling is a Tier-2+
concern.

This is parked. The slice ships at a single tuning. Settle when the loop is
playable end-to-end and we know what "too hard" actually means.

# discussion · rival-state-visibility

**Status:** committed-direction · partial dossier locked · posture vocabulary `{calm, scheming, hostile}` · medium-band
**Settled:** [`../architecture/re-eval-after-0.6.md`](../architecture/re-eval-after-0.6.md) §3.5 Q5
**Cites:** Design Doc §10 · §13 (HUD) · Rival AI Spec

How much of rival state does the player see directly vs infer?

Two ends of the spectrum:

- **Fog-of-war.** Player infers rival state from the front pages they print,
  the goons they spot, the wire deals they offer. Reads as period-authentic
  (you read about your rivals in the morning paper) and rewards observation.
- **Dossier.** Player sees explicit rival meters — Star's aggression, Herald's
  cash, Observer's attention. Reads as RTS-legible and lowers the floor for
  new players.

Recommendation today (not committed): a **partial-information dossier**. The
player sees rival *posture* (calm / scheming / hostile), not raw meters. Front
pages tell the rest of the story. Fog-of-war as the default with a Tipster
unlock (§08) that reveals more.

Settle at the post-0.6 re-eval, after the first loop plays through.

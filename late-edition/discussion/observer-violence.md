# discussion · observer-violence

**Status:** **settled at PRE-1.0 (v0.10.4)** — ICD-02 v0.3 §Observer state
machine + §Notes inter-rival paragraph lifts the design HTML's `DESPERATE` /
`PARTNER_REQUEST` mechanism as the Observer's survival surface. The
discussion's *partner-fund-violence* variant (Observer funding another rival's
raid) is **out of scope for Tier-1**. Revisit at a Tier-2 re-eval if playtest
shows the Observer needs a teeth-baring move beyond informational pressure.
**Cites:** Design Doc §10 (fail-state) · Rival AI Spec §05 (Observer) ·
[`../icds/ICD-02-rival-world.md`](../icds/ICD-02-rival-world.md) v0.3

## The question

Should the Observer ever fight back?

The original posture (pre-PRE-1.0): the Observer is a journalistic rival, not
a goon-shop — it exposes and discredits but doesn't raid the Bureau. The press
is destroyable only by the Evening Star.

The design space the parking note held open: a **partner-fund Tier IV
mechanism** where, late in a run, the Observer can fund another rival's raid
(laundering violence through someone else's hands). This kept the Observer's
character intact while giving it a teeth-baring move once the player was
consistently out-truthing it.

## PRE-1.0 resolution

The design HTML's §DESPERATE state ([`../design/rival-ai-spec.html`](../design/rival-ai-spec.html)
line 750) already provides the Observer's survival mechanism: when Observer
cash drops below $200, the rival emits a one-time `PARTNER_REQUEST` —
$500 from the player keeps the Observer alive for 5 editions in exchange for
the player NOT printing in one nominated district. This is the *informational*
survival path the Observer character calls for. It is **not** violence; it
is a survival lever the Observer offers to the player.

ICD-02 v0.3 lifts the DESPERATE state into the contract (PRE-1.0). The
discussion's partner-fund-violence variant — Observer funding another
rival's `RAID_BUREAU` against the player — is **rejected for Tier-1**:

1. The design HTML's §06 interaction matrix has only one inter-rival
   violence cell, and it goes the **other** direction (Star raids
   Observer when Observer publishes against Star instead of player).
   The Observer is the target of inter-rival violence, not its
   underwriter.
2. The Observer's load-bearing tone commitment is *"never hostile
   except via information"* (rival-ai-spec.html §05). Laundered
   violence would still be violence on the Observer's ledger; it
   breaks the character.
3. The `PARTNER_REQUEST` survival mechanism already gives the
   Observer a teeth-baring move (the player must choose between
   $500 + heat cooperation and the Observer's PUBLISH counter-
   narrative continuing). The discussion's partner-fund-violence
   variant solves a problem the design HTML has already solved.

If a Tier-2 playtest finds the Observer's pressure stale even with the
`PARTNER_REQUEST` mechanism + Star-vs-Observer raid cell (3) wiring,
this doc can be reopened at the next re-eval. Until then: closed.

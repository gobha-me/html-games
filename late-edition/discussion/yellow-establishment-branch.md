# discussion · yellow-establishment-branch

**Status:** open · pre-architecture · settles when Tier-1 approaches
**Cites:** Design Doc §11 · §20 TBD

The cumulative-heat heuristic that decides which tech-tree branch the player
ends up on.

Working sketch (not committed):

- Track **cumulative non-truthful headlines published** vs **cumulative
  truthful headlines published** across the whole run.
- At each tier-up moment, evaluate the ratio:
  - `non_truthful / total > 0.55` → **Yellow** branch
  - `truthful / total > 0.55` → **Establishment** branch
  - otherwise → undecided, presented as a player choice at tier-up
- Once a branch is committed, the heuristic is sticky (you don't slide back).

The math is one line. The hard questions are narrative:

- What do the two endings look like?
- Are there visible *tells* during the run that the branch is tipping?
  (Probably yes — front-page tone shifts.)
- Can the player see the ratio, or do they infer?

This is fuzzy until late-Tier-1. The heuristic above is good enough as a
**placeholder so the data shape doesn't foreclose it**: every printed `Story`
already carries `truthful: boolean` (ICD-05), so the cumulative counts are
free.

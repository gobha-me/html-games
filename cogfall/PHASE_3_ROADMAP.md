# Cogfall Phase 3 Roadmap (12 sessions)

## Context

Phase 1 + 2a–2m + 2n-1/2/3 are all shipped. Cogfall (TypeScript hex 4X, PixiJS,
268 tests, SAVE_VERSION=5) is feature-complete on the roadmap that landed
through 2026-04-29: save/load, seeded RNG, mapgen, naval, espionage, AI,
culture, polish, mod support, telemetry, replay viewer, debug overlay, hot-seat
MP, multi-slot build queue, threat overlay, screen shake, hit-flash, unit
tween.

The user wants Phase 3 mapped as a **roadmap spanning 10+ sessions** that mixes
structural refactors, non-UI changes, balance, content, animations, and AI
work — not a single feature pass. This planning session produces the roadmap
only; each subsequent session will have its own plan-then-approve-then-execute
cycle per `feedback_workflow.md`.

Why this shape: codebase exploration found the AI module modular but
single-path, victory conditions faction-agnostic, scenarios non-existent (random
maps only), animation layer thin (only 3 effects), and tech tree flat (19 techs,
no eras). Tier 1 lays foundations that unblock multiple later sessions; Tier 2
delivers the distinctiveness ("uniquely Claude") features; Tier 3 adds content
depth; Tier 4 closes with balance and perf. Optional Tier 5 lists ambitious
follow-ups.

## Goals & non-goals

- **Goals:** roadmap of 10–12 sessions, each ~3–6 commits, ordered so
  foundations precede dependents; each session standalone-shippable.
- **Non-goals:** NOT executing any session this turn. NOT pre-locking session
  scope below the bullet level (each session will get its own plan).
- **Carry-forwards** (don't violate without explicit revisit):
  - KISS / preserve prototype byte-feel during refactors
  - No PBEM/Plinth feature work — keep seams clean
  - `dist/` rebuild + commit at the end of any session that touches `cogfall/src/`
  - Always `git pull --rebase` before push, never force-push
  - Add to decision-log block at top of `cogfall/src/core/state.ts` when new
    "kept on purpose" choices land

---

## Tier 1 — Foundations (Sessions 1–3)

These three are infrastructure that unblock multiple later sessions. Land them
first.

### Session 1 — Animation event bus

**What:** Add `cogfall/src/render/animations.ts` as a small event bus (`emit`,
`on`) for game events that animate. Wire existing effects through it (combat
hit-flash, screen shake, unit-move tween). New events: `turnEnd`,
`techComplete`, `cityBuilt`, `unitKilled`, `victoryReached`. No new visuals
yet — just rewire existing.

**Why first:** Sessions 4 (turn-end / tech anims) and 6 (combat resolution
anims) both depend on this seam. Without it, each session would invent its own
hook pattern and we'd end up with 3 different conventions.

**Critical files:**
- new: `cogfall/src/render/animations.ts`
- `cogfall/src/render/combatEffects.ts` (subscribes to `unitKilled` etc.)
- `cogfall/src/render/unitTweens.ts` (already hook-shaped — adapt)
- `cogfall/src/systems/turn.ts`, `systems/combat.ts`, `systems/research.ts` (emit sites)

**Risk:** low — pure refactor, all 268 tests must stay green.

### Session 2 — Per-faction AI personality dispatch

**What:** Today `data/personalities.ts` has 5 named templates referenced by
faction.personality. Refactor so each `Faction` carries its own `AIBehavior`
record (extending the personality scalars with optional override hooks for
`pickTech`, `pickBuild`, `unitPriority`). Existing `PERSONALITIES` table
becomes default-fillers; per-faction overrides are opt-in.

**Why second:** Session 5 (AI variety) and Session 7 (faction-flavored
victories) both need per-faction dispatch. Current single-path AI can't deliver
"Iron Legion telegraphs war earlier; Aetheric maxes science" without this.

**Critical files:**
- `cogfall/src/data/personalities.ts`, `cogfall/src/data/factions.ts`
- `cogfall/src/ai/strategy.ts`, `ai/techAI.ts`, `ai/cityAI.ts`, `ai/unitAI.ts`
- `cogfall/tests/ai.test.ts` (439 LOC — must stay green)

**Risk:** medium — touches all AI files. Discipline: keep behavior
byte-identical for default factions; new overrides are opt-in.

### Session 3 — Scenario system scaffold

**What:** Add `ScenarioDef` type (`{id, name, description, factions: [{idx, startQ, startR, startTechs?, startBuildings?}], mapGenOverrides?, victoryOverrides?}`),
`SCENARIOS` registry, and a setup-screen dropdown ("Random map" + N
scenarios — but ship with zero scenarios yet, only "Random"). `setupGame()`
gains a scenario branch that bypasses `findFactionStarts()` when a scenario is
chosen. Save format: scenario id stored in `SerializedGameState` (additive — no
SAVE_VERSION bump per item-8 precedent in decision log).

**Why third:** Session 8 ships 3 hand-authored scenarios. Without scaffold,
Session 8 has to invent the system *and* author content in one go.

**Critical files:**
- new: `cogfall/src/data/scenarios.ts`
- `cogfall/src/systems/setup.ts`
- `cogfall/src/ui/setupScreen.ts` (or wherever the form lives)
- `cogfall/src/core/state.ts` (Serialized*)

**Risk:** low–medium. Save migration is additive only.

---

## Tier 2 — Distinctiveness (Sessions 4–7)

Features that make Cogfall feel "uniquely Claude" vs Qwen's vanilla 4X.

### Session 4 — Turn-end & tech-unlock animations

**What:** Use Session 1's bus. Subtle full-screen wipe + chime at turn-end
(skipped during AI batch turns). Sparkle + text-pop on tech complete (pulse
from research panel, expanding ring). Building-complete pulse on city sprite.
PixiJS-native; respect prefers-reduced-motion.

**Why:** turn-end and tech-discovery are the two highest-frequency moments
where animation makes the game feel alive. Currently both pass silently.

**Critical files:**
- new: `cogfall/src/render/turnTransition.ts`, `render/techPop.ts`
- subscribers via Session 1's bus

**Risk:** low.

### Session 5 — AI personality variety

**What:** Use Session 2's per-faction overrides to make each faction's AI play
distinctly:
- **Iron Legion:** earlier war-telegraph thresholds; tech bias toward gunpowder/steam_armor; aggressive frontier expansion.
- **Aetheric Order:** science weight 1.5×; refuses war until grand_apparatus prereqs done; aether-mech rush.
- **Coalition of Coin:** war-averse (high gold-cost-of-war heuristic); economic buildings prioritized; trades aggressively (depends on Session 9 if shipped first).
- **Verdant Pact:** turtle (max defense + culture); cultural-hegemony preferred path.
- **Cogwright Guild:** balanced industrial baseline (current default).

**Why:** highest-leverage distinctiveness feature. Existing
`tests/ai.test.ts` provides safety net; add per-faction tests for the new
behaviors.

**Critical files:**
- `cogfall/src/ai/strategy.ts`, `ai/techAI.ts`, `ai/diploAI.ts`, `ai/cityAI.ts`
- `cogfall/src/data/factions.ts`, `data/personalities.ts`

**Risk:** medium. AI changes affect AI-vs-AI determinism — add seeded
regression test.

### Session 6 — Combat resolution animations

**What:** Use Session 1's bus. Unit-death dissolve (sprite scale-down +
fade), attacker victory-glow, sparkle particles on critical hits. Move
`combatEffects.ts` shake / hit-flash to be a subscriber instead of being
called directly from `combat.ts` (consistency with Session 1 pattern).

**Critical files:**
- `cogfall/src/render/combatEffects.ts` (refactored as bus subscriber)
- new: `cogfall/src/render/unitDeath.ts`, `render/critSparkle.ts`
- `cogfall/src/systems/combat.ts` (replace direct calls with `emit`)

**Risk:** low (visual layer only; combat math untouched).

### Session 7 — Faction-flavored victory paths

**What:** Same mechanics, faction-flavored presentations + per-faction
threshold/cost adjustments:
- **Verdant Pact:** "World-Tree Bloom" — cultural-hegemony at 35% (vs 40%).
- **Aetheric Order:** "Aether Ascension" — `grand_apparatus` cost 320 (vs 360).
- **Iron Legion:** "Steel Throne" — domination, +flavor ending.
- **Coalition of Coin:** "Mercantile Hegemony" — economic at 4500 gold for 3 turns (vs 5000).
- **Cogwright Guild:** keeps default Grand Apparatus path.

End-game victory message uses faction-specific flavor copy.

**Critical files:**
- `cogfall/src/systems/turn.ts` (victory checks read faction overrides)
- `cogfall/src/systems/culture.ts` (cultural threshold per faction)
- `cogfall/src/data/factions.ts` (`victoryProfile` field)
- `cogfall/tests/turn.test.ts`, `tests/culture.test.ts` (add per-faction cases)

**Risk:** medium — touches victory logic, well-tested.

---

## Tier 3 — Content depth (Sessions 8–10)

### Session 8 — Three named scenarios

**What:** Use Session 3 scaffold. Author:
1. **"The Aether Ascendancy"** — Aetheric Order vs 3 enemies, science-rush map (low resource density, dense aether nodes).
2. **"Steamguild Civil War"** — two Cogwright factions facing off (forces 6th faction slot or temporary Cogwright-A/B variant).
3. **"Coastal Conquest"** — heavy water map, 2 island starts, naval-focused with Iron Legion + Coalition.

Each ships with custom map seed, faction starts, optional scenario-only victory
override.

**Critical files:** populate `cogfall/src/data/scenarios.ts`; possibly add
`cogfall/src/data/factionVariants.ts` for Cogwright A/B.

**Risk:** low–medium. Bulk of work is content + balance feel-out.

### Session 9 — Diplomacy depth

**What:** Trade agreements (gold↔tech, gold↔resource), alliances (mutual war
with one named enemy, breaks if either accepts peace), tribute (one-shot gold
demand under threat). Extends `diploAI.ts`. New diplomacy panel in UI.
Replay-safe (uses seeded RNG only on roll; player-initiated stays on
Math.random per item-2 carry-forward).

**Critical files:**
- `cogfall/src/ai/diploAI.ts`
- new: `cogfall/src/systems/diplomacy.ts`, `ui/diplomacyPanel.ts`
- `cogfall/src/core/state.ts` (treaties array — additive serialization)

**Risk:** medium-high. New subsystem, new save fields, new AI surface. May
deserve splitting across two sessions if scope grows.

**Shipped as S9a (one-shot exchanges):** gold-for-tech trades, gold-for-aether
trades, and gold-tribute demands all resolve immediately through pure functions
in `systems/diplomacy.ts`. AI calls them after the existing peace ↔ war pass
in `diploAI.ts`; player UI calls them from `diploModal.ts`'s inline action
sub-panel (Offer Trade…, Demand Tribute…). Per-faction voice for every new log
line lives in `data/diplomacyVoice.ts`. No new persistent state, no
SAVE_VERSION bump — only durable effect is a grudge bump on refusal. Decision-
log item 15 in `core/state.ts` covers the contract. See PR for S9a; S9b picks
up alliances + persistent treaties next session.

### Session 10 — Endgame polish

**What:**
- **Score breakdown screen:** end-of-game modal shows per-faction resource /
  building / tech contribution to score.
- **Replay highlights:** button on replay viewer that auto-jumps to key turns
  (first city founded, first war declared, first tech-unlock per branch,
  victory turn).
- **Retrospective stats panel:** quick stats (turns played, units lost, tiles
  controlled peak, etc.).

**Critical files:**
- new: `cogfall/src/ui/scoreBreakdown.ts`, `ui/replayHighlights.ts`, `ui/statsPanel.ts`
- `cogfall/src/systems/telemetry.ts` (already records events — query layer)

**Risk:** low. Pure additive UI.

---

## Tier 4 — Quality & balance (Sessions 11–12)

### Session 11 — Second balance pass

**What:** Validate 2n-3 speculative numbers (aether 0.1, Verdant 0.15, Hard AI
5/5/10). Use telemetry-driven AI-vs-AI batch tests for fast iteration.
Specific candidates:
- Tech-cost reshape: gunpowder / aetherics / banking all currently 100 —
  differentiate.
- River mechanics: convert visual-only → +0.5 movement cost, +0.1 defense, or
  +1 commerce yield (one of three; pick after thinking through replay parity).
  Touches decision-log item 5.
- Cultural-vs-gold lock-in asymmetry from old pivot menu.
- Faction-victory thresholds from Session 7 retuned via real playthroughs.

**Critical files:**
- `cogfall/src/data/techs.ts`
- `cogfall/src/systems/movement.ts`, `systems/combat.ts`, `systems/city.ts` (river)
- balance numbers in `cogfall/src/data/balance.ts` (or wherever they live)

**Risk:** medium. Balance changes need replay-parity check; SAVE_VERSION may
need bump if river mechanics change yields persisted into saves.

### Session 12 — Performance + structural cleanup

**What:**
- Benchmark `Map<TileKey,Tile>` vs flat array on the largest map size; flip if
  ≥15% gain (decision-log item 1).
- Memoize `aiFactionMilitaryStrength` (called per AI turn).
- Lazy-load replay modal (only wire on first open).
- Text pooling in `pixi.ts` if profiling shows GC pressure.
- Tighten any dead/duplicate code surfaced from Tier 2/3 work.

**Critical files:** profile-driven; specific files identified during the
session itself.

**Risk:** low–medium. Map-shape flip is the only one that could break replay
parity if iteration order differs — needs explicit deterministic-iteration
guard.

---

## Optional Tier 5 — Ambitious follow-ups (Sessions 13+)

If the user wants to keep going:

- **Era / age progression** — major structural shift. Techs gated by era; era
  transition cinematic; building/unit availability gates. Would bump
  SAVE_VERSION and require tech-tree restructure.
- **Expanded faction roster** — 6th and 7th factions with novel mechanics
  (e.g. nomadic faction with no fixed cities; underground faction with tunnel
  movement).
- **New tech branches** — diplomacy tree (treaties, espionage techs as a
  branch), exploration tree.
- **Mod system extensions** — mods can define scenarios, eras, victory paths.
- **Drag-and-drop build queue reorder** — was on pivot menu; deferred until
  arrows feel slow.

---

## Verification

This is a planning-only output. No code changes this session.

When each session executes:
1. Open with a 3–6 bullet plan, get approval, then code (per `feedback_workflow.md`).
2. After each commit-unit: run `npm test`, `npm run build`, `npm run lint` from
   `cogfall/`. Report pass/fail before moving on.
3. End of session: rebuild `cogfall/dist/`, commit dist separately, `git pull
   --rebase`, push.
4. Manual smoke: load `http://localhost:8000/cogfall/dist/` after dist commit;
   spot-check the new feature.
5. Update memory (`project_cogfall.md`, `project_phase2_plan.md`) at end of
   session if a "kept on purpose" decision-log item lands or the phase narrative
   advances.

## Critical files summary (touched across roadmap)

- `cogfall/src/core/state.ts` — decision log + Serialized*
- `cogfall/src/ai/*` — Sessions 2, 5, 9
- `cogfall/src/render/*` — Sessions 1, 4, 6
- `cogfall/src/systems/turn.ts`, `systems/combat.ts`, `systems/culture.ts` — Sessions 7, 11
- `cogfall/src/data/factions.ts`, `data/personalities.ts`, `data/scenarios.ts` (new), `data/techs.ts` — Sessions 2, 3, 5, 7, 8, 11
- `cogfall/src/ui/*` — Sessions 9, 10
- `cogfall/dist/` — rebuilt at end of every session that touches `cogfall/src/`

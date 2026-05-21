# ICD-07 · Audio Bus

**Status:** v0.1 (PRE-0.10 — channel vocabulary, ducking rules, press-silence beat, asset-manifest reference; no in-tree caller yet — Tier-1 audio milestone is the first consumer)
**Band:** medium (no caller within the N=3 window; band tightens to strong when the audio milestone enters the N-window)
**First caller:** Tier-1 audio milestone (TBD — schedule fuzzy until [`../architecture/00-overview.md`](../architecture/00-overview.md) §Fuzzy → §Medium promotion of "Audio system at large")
**Source:** [`../design/design-doc.html`](../design/design-doc.html) §14 (audio direction) + §05 (core loop heartbeat) · [`../design/audio-manifest.html`](../design/audio-manifest.html) (Supplement C — 6 beds · 6 music stems · 24 SFX · 60 VO lines)

## Purpose

What the simulation hands the audio layer each time a sound needs to play.
Keeps simulation pure (sim emits cues by id); keeps audio dumb (the bus
routes cues to channels, applies ducking, hands assets to the playback
engine). The audio bus never reaches back into world state — it consumes
cue ids and `FxEvent`s from [ICD-01](ICD-01-world-renderer.md) §`FxEvent`
union, nothing else.

Authoring the contract at v0.1 ahead of any code lets asset generation
land in parallel to the Tier-1 audio milestone — the manifest in
[Supplement C](../design/audio-manifest.html) is sized, prompted, and
ready to record against this vocabulary the moment a caller arrives.

## Channel vocabulary

The bus exposes four channels; every cue belongs to exactly one. The
union is locked at v0.1.

```ts
type AudioChannel =
  | 'ambient'   // city beds, weather, the press heartbeat, foghorn cycle
  | 'music'     // cool-jazz quartet stems (adaptive mix; swells DOWN to deadline)
  | 'sfx'       // discrete one-shots: typewriters, goon combat, UI clicks, FX-event co-emits
  | 'vo';       // single radio announcer character; comments on yesterday's edition
```

- **`ambient`** is the always-on bed. Constant city ambience (rain on
  awnings, distant streetcars, a foghorn every 90 s); the Bureau adds
  the soft mechanical heartbeat of the press. The bed is the channel
  that *carries the press-silence beat* (see §The press-silence beat
  below) — Design Doc §14, the only audio beat called out as load-
  bearing in the design doc.
- **`music`** is the cool-jazz quartet — brushes on drums, upright bass,
  muted trumpet, occasional piano. Six stems (MUS-01..MUS-06 in
  Supplement C) at one tempo (~76 bpm) and one key (C minor) so the
  layer can be added or stripped in real time. Adaptive mixing is the
  load-bearing commitment — the *quality* of the deadline-approach
  experience depends on it.
- **`sfx`** is every discrete one-shot. Diegetic sounds (typewriters
  when stories file, a wet match for cigarettes, the phone in the Bureau
  ringing for a hot lead, goons sounding like windshield wipers across
  linoleum), UI clicks, and the FX-event co-emit channel (ICD-01 v0.6
  `FxEvent` kinds — see §FxEvent ↔ SFX cue-table below).
- **`vo`** is the radio announcer — one character, ~60 lines for MVP.
  Late-night broadcasts comment on yesterday's edition; what the player
  printed yesterday changes what he says tonight. He starts amused and
  ends afraid. **VO is the only voice in the game** (no protagonist VO,
  Design Doc §14).

## Ducking rules

When two channels overlap on a beat, the bus applies the table below.
Ducking is a temporary attenuation of the *target* channel for the
duration of the *trigger*, with a linear ramp in / out of `rampMs` ms
on each end.

| Trigger | Target | By | Ramp in/out | Source |
|---|---|---|---|---|
| `vo` plays | `music` | −9 dB | 250 ms | radio convention — speech intelligibility |
| `vo` plays | `ambient` | −3 dB | 250 ms | same |
| `sfx` (any) | none | — | — | SFX never ducks anything; one-shots ride on top |
| `music.deadline_ramp` (T-30s) | `music` (own layers) | adaptive drop | 30 s | Design Doc §14 — *"bed thins to just bass and rain at T-30s"* |
| `cycle.print_fire` (T0) | `music` → MUS-06 tag | crossfade | 4 s | Design Doc §14 — *"full quartet returns in a celebratory eight-bar tag"* |
| `cycle.debrief_open` | `ambient` (city) | −6 dB | 500 ms | newspaper-page-flip foley sits above; bed pulls back |
| `press.silence` (see §below) | `ambient.press_*` | −∞ dB (mute) | 800 ms ramp out · 0 ms ramp in | Design Doc §14 — *"the first time the press goes silent…"* |

- **Why VO ducks ambient but not SFX.** SFX one-shots are short enough
  (typewriter clack, phone ring, gunshot) that ducking them produces a
  ducked-then-popped effect that's worse than the overlap. Ambient is
  long-form and tolerates a few-dB pull-back gracefully.
- **Why music never ducks under SFX.** The cool-jazz bed is the
  game's *spine*; a UI click or a goon footfall pulling the music
  down would feel wrong. The few moments where music *does* drop are
  scripted (deadline ramp · print-fire tag · press silence), not
  reactive.
- **Determinism.** Ducking is a presentation-layer concern; no sim
  state depends on it. Save / load does not capture duck-state
  (cf. [ICD-04](ICD-04-save-schema.md) §Notes — save cadence is
  cycle-begin + game-over, both audio-quiet moments by construction).

## The press-silence beat

The single load-bearing audio beat the design doc calls out by name.
Design Doc §14:

> The Bureau adds the soft mechanical heartbeat of the press — present
> even when off. **The first time the press goes silent is the first
> time the player notices it was there.**

The press heartbeat is an `ambient`-channel cue (AMB-04 in Supplement C);
during print fire it crossfades up to AMB-05 (press running). Both go
silent on:

- **`CYCLE_GAME_OVER`** (the Press destroyed, [ICD-06](ICD-06-print-cycle.md)
  §Event vocabulary). The 800 ms ramp-out of the heartbeat is the
  audio companion to the *"THE PRESS BURNS"* terminal screen — the
  player hears the absence before reading the words.
- **(Optional, Tier-1+)** a *deliberate* press-stop trigger (e.g., a
  Tier-1 story-beat where the player chooses to halt the run); not in
  the v0.1 vocabulary, parked in §Open questions.

The beat is **directional only**: the bus mutes the press bed, then
*never re-arms it* within the same run. There is no fade-in pair for
this duck-out — that's the entire point. Re-arming requires a fresh
`World` (the next run boots the bed back on at `CYCLE_BEGIN.edition === 1`).

## FxEvent ↔ SFX cue-table

The renderer's [ICD-01 v0.6](ICD-01-world-renderer.md) §`FxEvent` union
co-emits with the audio bus on the `sfx` channel. Each `FxEvent.kind`
maps to a Supplement-C cue id (or a small set):

| `FxEvent.kind` | SFX cue(s) | Notes |
|---|---|---|
| `'pickup'` | SFX-01 (folder rustle) | one-shot at `at: Vec3` |
| `'verify'` | SFX-02 (camera shutter) + flash co-emit | the bus fires both as one beat |
| `'flash'` | SFX-02 (camera shutter) | redundant trigger — see §Notes |
| `'print'` | SFX-06 (press fire) + MUS-06 tag entry | cross-fade music to MUS-06 |
| `'death'` | SFX-08..10 (goon combat) per `unit_kind` | mapped by kind at producer site |
| `'raid_warning'` | SFX-14 (klaxon) + music duck to MUS-05 | sets the tension stem |

The mapping is **medium-band** at v0.1: cue ids may shift as the
Supplement-C catalog is recorded; the *channels* and *trigger sites*
are locked. Producer-side wiring is the PR-D scope (the same PR that
lights up the visual FX channel — audit C-07 has the two channels co-
firing).

## Asset reference (Supplement C)

The audio prompt manifest at
[`../design/audio-manifest.html`](../design/audio-manifest.html)
catalogs every cue this contract will ever route, sized for the full
ship:

- **6 ambient beds** (AMB-01..AMB-06) — including AMB-04 press heartbeat
  and AMB-05 press running, both load-bearing for §The press-silence
  beat above.
- **6 music stems** (MUS-01..MUS-06) — quartet stems for adaptive
  mixing, with MUS-05 (T-30s tension) and MUS-06 (deadline tag) as the
  named hooks for the ducking table above.
- **24 SFX cues** (SFX-01..SFX-24) — diegetic + UI + combat + FX co-
  emit, phase-tagged T0 / T1 / T2 per Supplement-C §06.
- **60 VO lines** (VO-001..VO-060) — the radio announcer character
  across a 30-edition arc, branching on yesterday-printed-truth-vs-lie.

96 prompts total. Phase tags in Supplement-C §06 partition the catalog
by ship tier — the Tier-1 audio milestone records the T0 + T1 subset;
T2 covers the shippable run.

## Subscriber expectations

| Subsystem | Subscribes to | First milestone |
|---|---|---|
| *(none at v0.1)* | — | Tier-1 audio milestone (TBD) |

The contract is authored ahead of any caller per METHODOLOGY §3.2 —
this is the "author the ICD when a contract crosses a code-session
boundary that hasn't been authored yet" case. Asset generation runs
in parallel; the first code consumer enters the table when the
audio-system band tightens from fuzzy to medium.

## Notes

- **The audio bus is the only thing that sees cue ids.** Sim emits
  `FxEvent`s through ICD-01's `WorldFrame.effects` channel; the bus
  consumes the projection and translates kinds to cue ids per
  §FxEvent ↔ SFX cue-table. Sim never names a cue id directly.
- **Channel ownership.** Every cue belongs to one channel. AMB-04
  (press heartbeat) is `ambient`; MUS-05 (T-30s tension) is `music`;
  SFX-02 (camera shutter) is `sfx`; VO-007 (whatever the announcer
  says at edition 7) is `vo`. The mapping is asset-manifest data, not
  code — the bus reads it from a generated cue-table whose schema this
  ICD does not yet pin (parked in §Open questions).
- **The `'flash'` ↔ `'verify'` redundancy.** ICD-01 v0.6 ships both
  as separate `FxEvent` kinds because the visual layer wants the flash
  to fire on the print sting (no `'verify'` co-event) as well as on
  the photog camera. The audio bus collapses both kinds to SFX-02 at
  the cue-table — sim emits whichever fits the trigger site, audio
  doesn't care which arrived.

## Open questions

- **Cue-table schema.** The producer-side mapping from `FxEvent.kind`
  to cue id is given as a §FxEvent ↔ SFX cue-table here, but the
  authoritative format (JSON file? const module? per-asset metadata?)
  is unspecified until the first caller. The schema lands at the
  Tier-1 audio milestone with the engine selection. Cue ids themselves
  may shift between Supplement-C v0.1 and the recorded master — the
  table is medium-band on values, locked on *channels*.
- **Engine selection.** Web Audio API direct vs. Tone.js vs. Howler.js
  vs. minimal own-wrapper. No commitment at v0.1 — depends on the
  adaptive-mixing demand the §Ducking rules table puts on the engine
  (Tone.js wins if real-time stem crossfading proves hard with Web
  Audio scheduling primitives; minimal wrapper wins if it doesn't).
- **Player-initiated press silence.** Tier-1 story beats may want to
  *deliberately* halt the press as a player choice (a refusal beat
  echoing the Yellow / Establishment branch). The v0.1 §press-silence
  beat scopes to `CYCLE_GAME_OVER` only; expanding the trigger surface
  is a Tier-1 question.
- **Run-resume audio state.** Save / load (ICD-04) doesn't capture
  duck-state today because cadence puts saves at audio-quiet moments
  (cycle-begin + game-over). If a Tier-1 milestone moves the save
  cadence — or adds a mid-edition save trigger — the bus may need a
  `serialize()` / `deserialize()` pair. Parked until that milestone.

## Deviation policy

Adding a channel to `AudioChannel`, adding a row to the §Ducking rules
table, or changing the §press-silence beat trigger set is an architecture
session, not a deviation — stop and run a paper session. Adding a cue id
to the manifest, or remapping an existing cue, is a Supplement-C edit
plus a §FxEvent ↔ SFX cue-table update; that lands in the same PR as the
code that consumes it (Constraint #4 of the methodology), no separate
paper session needed.

## Revision history

- **v0.1** (PRE-0.10, 2026-05-21) — Initial author. Channel vocabulary
  locked (`'ambient' | 'music' | 'sfx' | 'vo'`); §Ducking rules table
  authored from Design Doc §14 (VO ducks music/ambient; SFX ducks
  nothing; music adaptive ramp at T-30s; print-fire tag; press silence);
  §press-silence beat lifted from §14's *"first time the press goes
  silent"* commitment as the single load-bearing one-way mute, tied to
  `CYCLE_GAME_OVER`; §FxEvent ↔ SFX cue-table authored against ICD-01
  v0.6's six `FxEvent` kinds; §Asset reference points at Supplement C
  (96-prompt manifest at `design/audio-manifest.html`); §Subscriber
  expectations table empty (no caller until Tier-1 audio milestone
  enters the N-window). Audit G-08 / re-eval-after-0.9 §3 PRE-0.10
  schedules this slot.

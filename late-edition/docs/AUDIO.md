# Night desk sound — #90

The **MIXER** on the brass rail has independent Music, Ambience and SFX sliders.
**SOUND [M]** mutes all three without changing the slider values. The controls
work with keyboard focus/arrow keys. Settings persist separately from run saves,
including after a new run or reload. Unsupported versions and malformed values
fall back to defaults; finite numeric volumes clamp to 0–1. Blocked/full storage
leaves the in-memory controls usable.

The `lateEdition.audio` localStorage record is versioned:

```json
{"version":1,"muted":false,"volumes":{"music":0.45,"ambience":0.35,"sfx":0.65}}
```

Rain, filtered newsroom murmur and mechanical hum grow from one-quarter to full
intensity as the six-hour edition approaches midnight. A sparse original horn
and bass phrase marks the edition's first clock tick. A muted-trumpet sting fires
once when the clock crosses **11:55 PM** (355/360 of the 210-second edition).
The phone, wire teletype, typewriter, dispatch, camera and bribe are short cues.
Printing plays a motor sweep and press clatter, then a source-filter synthesized
“EXTRA!” street cry. No downloaded audio, speech service or platform voice is
required. [Generator provenance](../assets/audio/CREDITS.md) documents every cue;
shipped audio assets total **0 bytes**.

The report shows plates locking, the spinning press, flying papers and the
captioned newsboy call, then a morning-after **Daily Herald** card comparing its
street sales with the printed Evening Star. The player can dismiss at any stage;
leaving the report cancels scheduled press/voice nodes. Reduced motion immediately
shows the morning card and disables the paper animation. All cues are optional:
no clue, deadline or decision depends on hearing them.

## Boundaries and lifecycle

- `sim.js` only emits named events through `createAudioAdapter`. It imports no
  browser audio/storage APIs and consumes no audio RNG. Legacy named sink methods
  remain supported for injected ports. Exceptions and rejected sink promises are
  swallowed at the adapter boundary, so device failures cannot change gameplay.
- `main.js` supplies the audio port, scene intensity, pause gates and trusted
  gesture listeners. Synthetic DOM events and programmatic sim commands cannot
  create a context. Pointer/key listeners run in capture before gameplay commands
  and remain installed so later gestures can retry an unsuccessful unlock.
- `NoirAudio` reads settings without constructing an AudioContext. It creates
  three channel gains and one master only on `resume()` from a trusted gesture.
  Missing constructors, construction errors, graph failures and rejected resumes
  silently leave the desk playable; the next gesture can retry. No network paths
  exist, so blocked sample requests require no special recovery or console log.
- Hidden tabs, the desk-too-small screen and manual pause suspend the context.
  Their gates combine: foregrounding cannot override the small-desk pause.
  Transitions serialize and reconcile a changed gate after an in-flight resume
  or suspend. Rejection cannot produce an infinite retry loop; UI refreshes do
  not retry failed autoplay. The master also fades to zero while blocked.
- The reusable two-second noise buffer uses a separate fixed cosmetic RNG.
  Envelopes and delays use the WebAudio clock, which freezes during suspension.
  No audio timers run on the main thread. Ended nodes disconnect; mute cancels
  pending finite cues; at most 64 finite voices can exist under hostile input.
  The three loop sources are retained for the app lifetime and mixed to silence
  on the title/reports, avoiding graph allocation every UI tick.

## Verification

`tests/audio.test.mjs` forces corrupt/future settings, invalid types and bounds,
blocked/quota storage, absent/throwing contexts, graph failure, resume rejection,
both pause-transition races, suspend rejection, voice saturation/cleanup, deadline
crossings, double print and five-edition hash equality with synthesized audio on,
muted, absent and throwing. The existing golden replay remains unchanged.

`e2e/audio.spec.js` tests trusted versus synthetic gestures, broken browser audio,
blocked audio routes (zero sample requests), persistent sliders/mute, overlapping
pause gates, all press stages, early dismissal and reduced motion. Native offline
rendering checks every cue produces finite nonzero samples, including the late
street cry, while mute/zero music produce silence. Every browser case rejects
console errors and uncaught exceptions. SwiftShader budget tests unlock the real
audio bed before profiling; the existing budgets are unchanged.

Run the full checks from the game's README; focused audio checks:

```bash
node --test tests/audio.test.mjs
npx playwright test e2e/audio.spec.js
npx playwright test e2e/performance.spec.js
```

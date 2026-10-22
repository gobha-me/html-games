# Audio provenance — issue #90

All sound is synthesized by the project-authored WebAudio code in
[`../../js/audio.js`](../../js/audio.js), under the repository's MIT license.
No paid generation, recordings, downloaded samples or third-party audio are used.
The three legacy MP3 files were removed because their free-license provenance
was undocumented. Shipped audio files: **0 bytes**, below the **2 MB** budget.

| Sound | Generator |
| --- | --- |
| Rain | Two-second fixed-seed (1947) white-noise buffer through a broad 2.2 kHz bandpass, looped locally. |
| Newsroom murmur and machinery | Same noise through a narrow 420 Hz bandpass, plus a 58 Hz triangle hum. Both beds rise with the in-world clock. |
| Muted trumpet and upright bass | Short sawtooth notes through parallel 900/1600 Hz resonances, with a low triangle pluck. Opening phrase and 11:55 phrase. Original note sequences, no composition sampled. |
| Phone bell | Paired 1180/1480 Hz sine partials in a mechanical double-ring cadence. |
| Teletype and wire bell | Seven filtered-noise key strikes, followed by a 1318.5 Hz sine bell. |
| Dispatch, typewriter, camera, bribe | Oscillator glides or short filtered-noise envelopes. |
| Rotary press | 32–125 Hz motor sweep and fourteen accelerating-texture noise strikes. |
| Newsboy “EXTRA!” | Source-filter speech: pitched sawtooth with EH/AH formant banks and filtered-noise /ks/ and /tr/ consonants. Original synthetic street cry, also captioned in the press show. No browser/platform speech engine. |

All envelopes and delays use the audio clock; no audio timers or network requests.
Noise uses its own cosmetic RNG, independent of simulation state. The reusable
noise buffer is generated only after a gesture and consumes approximately 384 KB
at 48 kHz (runtime memory, not a shipped audio asset).

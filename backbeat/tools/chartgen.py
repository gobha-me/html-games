#!/usr/bin/env python3
"""
BACKBEAT — chart generation / BPM analysis.

Two jobs:
  1. analyze: detect BPM + beat onsets from an audio file (via ffmpeg PCM out)
  2. generate: emit a charts/<name>.json with notes placed on beats

This is how the agent charts a track it cannot hear: onset energy peaks
drive note placement, so the chart is beat-calculated, not hand-timed.

Usage:
  python3 tools/chartgen.py analyze assets/track.wav
  python3 tools/chartgen.py generate assets/track.wav --title "X" --bpm 120 \
      --audio assets/track.ogg --out charts/x.json [--density 1.0]
"""
import argparse, json, math, struct, subprocess, sys, wave
from array import array


def read_pcm_mono(path, rate=22050):
    """Decode any audio to mono 16-bit PCM via ffmpeg, return (samples, rate)."""
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(rate),
           "-f", "s16le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return array("h", struct.unpack(f"<{len(raw)//2}h", raw)), rate


def onset_envelope(samples, rate, hop=512, win=1024):
    """Simple spectral-flux onset strength. Returns (times[], strength[])."""
    n = len(samples)
    env = []
    times = []
    prev_energy = 0.0
    for start in range(0, n - win, hop):
        frame = samples[start:start + win]
        energy = sum(s * s for s in frame) / win
        flux = max(0.0, energy - prev_energy)
        env.append(flux)
        times.append(start / rate)
        prev_energy = energy
    return times, env


def detect_onsets(times, env, threshold_ratio=0.3, min_gap=0.18):
    """Peak-pick onsets above a running threshold, min_gap seconds apart."""
    if not env:
        return []
    peak = max(env)
    thresh = peak * threshold_ratio
    onsets = []
    last = -1.0
    for t, e in zip(times, env):
        if e >= thresh and (t - last) >= min_gap:
            onsets.append(round(t, 3))
            last = t
    return onsets


def estimate_bpm(onsets):
    """Median inter-onset interval → BPM, snapped to a musical range."""
    if len(onsets) < 3:
        return None
    iois = [b - a for a, b in zip(onsets, onsets[1:]) if 0.2 < b - a < 2.0]
    if not iois:
        return None
    iois.sort()
    med = iois[len(iois) // 2]
    bpm = 60.0 / med
    # snap into 70..180
    while bpm < 70: bpm *= 2
    while bpm > 180: bpm /= 2
    return round(bpm, 1)


def generate_chart(onsets, bpm, audio, title, density=1.0):
    """Place notes on detected onsets, distributed across 4 lanes."""
    notes = []
    lane = 0
    # thin or thicken by density: density 1.0 = every onset
    step = max(1, round(1.0 / max(0.25, min(density, 2.0))))
    for i, t in enumerate(onsets):
        if i % step != 0:
            continue
        # vary lane with a walk so it feels played, not random
        lane = (lane + (1 if i % 3 else -1)) % 4
        notes.append({"time": t, "lane": lane})
    return {
        "title": title,
        "artist": "Venice (generated)",
        "audio": audio,
        "bpm": bpm,
        "offset": 0,
        "notes": notes
    }


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("analyze")
    a.add_argument("audio")

    g = sub.add_parser("generate")
    g.add_argument("audio_path")           # used for analysis
    g.add_argument("--audio", required=True)  # path the game will fetch
    g.add_argument("--title", required=True)
    g.add_argument("--out", required=True)
    g.add_argument("--bpm", type=float, default=None)
    g.add_argument("--density", type=float, default=1.0)

    args = ap.parse_args()
    src = args.audio if args.cmd == "analyze" else args.audio_path
    samples, rate = read_pcm_mono(src)
    times, env = onset_envelope(samples, rate)
    onsets = detect_onsets(times, env)
    bpm = estimate_bpm(onsets)

    if args.cmd == "analyze":
        print(json.dumps({"bpm": bpm, "onsets": len(onsets),
                          "first_onsets": onsets[:12]}, indent=2))
        return

    bpm = args.bpm or bpm or 120.0
    chart = generate_chart(onsets, bpm, args.audio, args.title, args.density)
    with open(args.out, "w") as f:
        json.dump(chart, f, indent=2)
    print(f"wrote {args.out}: {len(chart['notes'])} notes @ {bpm} BPM")


if __name__ == "__main__":
    main()

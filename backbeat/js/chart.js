// ============================================================================
// BACKBEAT // OVERDRIVE — Chart Loader & Musical Beatmap Generator
// Supports Tap Notes, Hold/Sustain Ribbons (duration > 0), and Multi-Lane Chords
// ============================================================================

import { DIFFICULTY } from './config.js';

export async function buildTrackChart(track, difficultyId = 'normal') {
  const diff = DIFFICULTY[difficultyId] || DIFFICULTY.normal;

  if (track.chartUrl) {
    try {
      const res = await fetch(track.chartUrl);
      if (res.ok) {
        const raw = await res.json();
        return adaptAnthemChart(raw, track, diff);
      }
    } catch (_) {
      // Fallback to procedural chart if offline/file error
    }
  }

  return generateProceduralChart(track, diff);
}

function adaptAnthemChart(raw, track, diff) {
  const baseNotes = (raw.notes || [])
    .map((n) => ({ time: Number(n.time), lane: Number(n.lane) }))
    .filter((n) => Number.isFinite(n.time) && n.lane >= 0 && n.lane <= 3)
    .sort((a, b) => a.time - b.time);

  const notes = [];
  const beatSec = 60 / (raw.bpm || track.bpm || 120);

  for (let i = 0; i < baseNotes.length; i++) {
    // Club filters every 3rd dense note
    if (diff.id === 'club' && i % 3 === 1) continue;

    const src = baseNotes[i];
    const next = baseNotes[i + 1];
    const gap = next ? next.time - src.time : 2.0;

    // Add Hold/Sustain ribbon when there is room in the measure
    let duration = 0;
    if (diff.allowHolds && i % 5 === 2 && gap >= beatSec * 1.35) {
      duration = Math.min(gap - 0.18, beatSec * 1.5);
    }

    notes.push({
      id: notes.length,
      time: src.time,
      lane: src.lane,
      duration: Number(duration.toFixed(3)),
      chord: false,
    });

    // Add simultaneous 2-lane chord bursts on downbeats for Tour/Hyperdrive/Encore
    if (diff.allowChords && duration === 0 && i % (diff.id === 'tour' ? 8 : 5) === 0 && gap > 0.32) {
      const partnerLane = (src.lane + 2) % 4;
      notes.push({
        id: notes.length,
        time: src.time,
        lane: partnerLane,
        duration: 0,
        chord: true,
      });
      notes[notes.length - 2].chord = true;
    }

    // Encore adds 16th-note syncopated fills between quarter notes
    if (diff.id === 'encore' && duration === 0 && gap >= beatSec * 0.92 && i % 2 === 0) {
      notes.push({
        id: notes.length,
        time: Number((src.time + beatSec * 0.5).toFixed(3)),
        lane: (src.lane + 1) % 4,
        duration: 0,
        chord: false,
      });
    }
  }

  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  const maxTime = notes.length ? notes[notes.length - 1].time + 3.0 : track.duration;

  return {
    title: track.title,
    artist: track.artist,
    bpm: raw.bpm || track.bpm,
    offset: Number(raw.offset) || 0,
    duration: Math.max(track.duration, Math.ceil(maxTime)),
    notes,
  };
}

export function generateProceduralChart(track, diff) {
  const bpm = track.bpm;
  const beatSec = 60 / bpm;
  const stepSec = beatSec / 2; // 8th-note grid
  const totalSteps = Math.floor((track.duration - 3.5) / stepSec);
  const notes = [];

  // Deterministic PRNG per track + difficulty
  let seed = hashString(`${track.id}:${diff.id}`);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Musical phrase patterns per genre
  const patterns = {
    synthwave: [
      [0, -1, 1, -1, 2, -1, 3, 2],
      [3, -1, 2, -1, 1, 0, 2, -1],
      [0, 1, 2, -1, 3, 2, 1, -1],
    ],
    chiptune: [
      [0, 1, 2, 3, 2, 1, 0, 2],
      [3, 1, 2, 0, 1, 3, 2, -1],
      [0, 2, 1, 3, 0, 1, 2, 3],
    ],
    industrial: [
      [0, -1, 0, 3, 1, -1, 2, 3],
      [1, 1, -1, 2, 0, -1, 3, 2],
      [3, -1, 1, -1, 0, 2, 3, -1],
    ],
    anthem: [
      [0, -1, 2, -1, 1, -1, 3, 2],
      [2, 1, 0, -1, 3, 2, 1, -1],
    ],
  };

  const bank = patterns[track.synthStyle] || patterns.synthwave;
  const laneOccupiedUntil = [0, 0, 0, 0];

  for (let s = 4; s < totalSteps; s++) {
    const t = Number((s * stepSec).toFixed(3));
    const bar = Math.floor(s / 8);
    const stepInBar = s % 8;
    const pat = bank[bar % bank.length];
    let lane = pat[stepInBar];

    if (lane < 0) {
      // On Hyperdrive / Encore, fill some offbeats
      if ((diff.id === 'hyperdrive' || diff.id === 'encore') && rand() < 0.42) {
        lane = Math.floor(rand() * 4);
      } else {
        continue;
      }
    }

    // Club skips odd 8th notes except downbeats
    if (diff.id === 'club' && stepInBar % 2 === 1 && rand() < 0.78) continue;
    if (diff.id === 'tour' && stepInBar % 2 === 1 && rand() < 0.35) continue;

    if (t < laneOccupiedUntil[lane] + 0.12) continue;

    // Hold note on bar openers or phrase endings
    let duration = 0;
    if (
      diff.allowHolds &&
      (stepInBar === 0 || stepInBar === 4) &&
      bar % 2 === 1 &&
      rand() < 0.48
    ) {
      duration = Number((beatSec * (rand() < 0.5 ? 1.0 : 1.5)).toFixed(3));
      laneOccupiedUntil[lane] = t + duration + 0.15;
    } else {
      laneOccupiedUntil[lane] = t + 0.14;
    }

    notes.push({
      id: notes.length,
      time: t,
      lane,
      duration,
      chord: false,
    });

    // Simultaneous 2-lane chord on strong downbeats
    if (
      diff.allowChords &&
      duration === 0 &&
      stepInBar === 0 &&
      bar % (diff.id === 'tour' ? 2 : 1) === 0
    ) {
      const altLane = (lane + (rand() < 0.65 ? 2 : 1)) % 4;
      if (t >= laneOccupiedUntil[altLane] + 0.12) {
        laneOccupiedUntil[altLane] = t + 0.14;
        notes[notes.length - 1].chord = true;
        notes.push({
          id: notes.length,
          time: t,
          lane: altLane,
          duration: 0,
          chord: true,
        });
      }
    }

    // Encore 16th-note burst fills
    if (diff.id === 'encore' && duration === 0 && stepInBar === 6 && rand() < 0.65) {
      const burstLane = (lane + 1) % 4;
      const burstTime = Number((t + stepSec * 0.5).toFixed(3));
      if (burstTime >= laneOccupiedUntil[burstLane] + 0.1) {
        laneOccupiedUntil[burstLane] = burstTime + 0.1;
        notes.push({
          id: notes.length,
          time: burstTime,
          lane: burstLane,
          duration: 0,
          chord: false,
        });
      }
    }
  }

  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  return {
    title: track.title,
    artist: track.artist,
    bpm,
    offset: 0,
    duration: track.duration,
    notes,
  };
}

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

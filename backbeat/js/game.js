// ============================================================================
// BACKBEAT // OVERDRIVE — Rhythm Simulation, Hold Ribbons, Chords & Overdrive
// ============================================================================

import { DIFFICULTY, JUDGE, SCORE, LANES, judgeOffset, computeLetterGrade } from './config.js';

export class Game {
  constructor(chart, difficultyId = 'normal', audioOffsetMs = 0) {
    this.chart = chart;
    this.difficulty = difficultyId;
    this.diff = DIFFICULTY[difficultyId] || DIFFICULTY.normal;
    this.audioOffsetSec = (audioOffsetMs + (chart.offset || 0) * 1000) / 1000;

    this.notes = (chart.notes || []).map((n, idx) => ({
      id: idx,
      time: n.time,
      lane: n.lane,
      duration: n.duration || 0,
      chord: Boolean(n.chord),
      judged: null,
      hitTime: null,
      offsetMs: 0,
      holding: false,
      holdCompleted: false,
      nextTickTime: n.time + 0.07,
    }));

    this.laneHeld = [false, false, false, false];
    this.activeHolds = [null, null, null, null];

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.tally = { perfect: 0, good: 0, miss: 0, holds: 0 };

    // Timing offset statistics (ms)
    this.lastOffsetMs = 0;
    this.offsetSumMs = 0;
    this.offsetCount = 0;

    // Overdrive Fever (0..100 charge; 2x multiplier for 8 seconds when active)
    this.overdriveCharge = 0;
    this.overdriveActive = false;
    this.overdriveTimer = 0;
    this.lastOverdriveUpdateSec = 0;

    // Auto-DJ Demo Mode
    this.autoPlay = false;

    this.lastJudgement = null; // { type, lane, offsetMs, at }
    this.finished = false;
  }

  now(audioTimeSec) {
    return audioTimeSec - this.audioOffsetSec;
  }

  activateOverdrive() {
    if (this.overdriveActive || this.overdriveCharge < 50) return false;
    this.overdriveActive = true;
    this.overdriveTimer = 7.5 * (this.overdriveCharge / 100);
    this.overdriveCharge = 0;
    return true;
  }

  press(lane, audioTimeSec, onHitCallback = null) {
    if (lane < 0 || lane >= LANES || this.finished) return null;
    this.laneHeld[lane] = true;

    const t = this.now(audioTimeSec);
    const goodWin = this.diff.good / 1000;

    let best = null;
    let bestAbs = Infinity;
    for (const note of this.notes) {
      if (note.lane !== lane || note.judged) continue;
      const off = t - note.time;
      const abs = Math.abs(off);
      if (abs <= goodWin && abs < bestAbs) {
        best = note;
        bestAbs = abs;
      }
      if (note.time - t > goodWin) break;
    }

    if (!best) return null;

    const offsetMs = Math.round((t - best.time) * 1000);
    const absMs = Math.abs(offsetMs);
    const judgement = judgeOffset(absMs, this.difficulty) || JUDGE.MISS;

    this.applyJudge(best, judgement, t, offsetMs);

    if (judgement !== JUDGE.MISS && best.duration > 0) {
      best.holding = true;
      best.nextTickTime = t + 0.065;
      this.activeHolds[lane] = best;
    }

    if (onHitCallback) {
      onHitCallback(lane, judgement, offsetMs, best);
    }
    return judgement;
  }

  release(lane, audioTimeSec) {
    if (lane < 0 || lane >= LANES) return;
    this.laneHeld[lane] = false;
    const held = this.activeHolds[lane];
    if (held) {
      const t = this.now(audioTimeSec);
      const goodWinSec = (this.diff.good || 120) / 1000;
      if (t >= held.time + held.duration - goodWinSec) {
        held.holdCompleted = true;
        this.tally.holds++;
        this.score += Math.round(120 * this.diff.scoreMul * (this.overdriveActive ? 2.0 : 1.0));
      }
      held.holding = false;
      this.activeHolds[lane] = null;
    }
  }

  applyJudge(note, judgement, t, offsetMs = 0) {
    note.judged = judgement;
    note.hitTime = t;
    note.offsetMs = offsetMs;
    this.tally[judgement]++;

    const feverMul = this.overdriveActive ? 2.0 : 1.0;

    if (judgement === JUDGE.MISS) {
      this.combo = 0;
    } else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.lastOffsetMs = offsetMs;
      this.offsetSumMs += offsetMs;
      this.offsetCount++;

      const base = SCORE[judgement] || 100;
      const comboMul = Math.min(4.0, 1 + Math.floor(this.combo / 10) * 0.25);
      this.score += Math.round(base * this.diff.scoreMul * comboMul * feverMul);

      if (!this.overdriveActive) {
        this.overdriveCharge = Math.min(
          100,
          this.overdriveCharge + (judgement === JUDGE.PERFECT ? 4.5 : 2.5)
        );
      }
    }

    this.lastJudgement = {
      type: judgement,
      lane: note.lane,
      offsetMs,
      at: performance.now(),
    };
  }

  update(audioTimeSec, onHitCallback = null) {
    if (this.finished) return;
    const t = this.now(audioTimeSec);
    const dt = Math.max(0, Math.min(0.1, t - this.lastOverdriveUpdateSec));
    this.lastOverdriveUpdateSec = t;

    // Overdrive timer decay
    if (this.overdriveActive) {
      this.overdriveTimer -= dt;
      if (this.overdriveTimer <= 0) {
        this.overdriveTimer = 0;
        this.overdriveActive = false;
      }
    }

    // Auto-DJ Demo Mode: hit notes right on the beat & sustain hold ribbons
    if (this.autoPlay) {
      for (const note of this.notes) {
        if (!note.judged && t >= note.time) {
          this.press(note.lane, audioTimeSec, onHitCallback);
          if (note.duration === 0) {
            this.laneHeld[note.lane] = false;
          }
        }
        if (note.judged && note.duration > 0) {
          const endT = note.time + note.duration;
          if (t < endT) {
            this.laneHeld[note.lane] = true;
            note.holding = true;
            this.activeHolds[note.lane] = note;
          } else if (note.holding) {
            this.release(note.lane, audioTimeSec);
          }
        }
      }
      if (this.overdriveCharge >= 100 && !this.overdriveActive) {
        this.activateOverdrive();
      }
    }

    // Process active hold ribbons (tick score while held)
    const feverMul = this.overdriveActive ? 2.0 : 1.0;
    for (let lane = 0; lane < LANES; lane++) {
      const held = this.activeHolds[lane];
      if (!held) continue;
      const endT = held.time + held.duration;
      if (t >= endT) {
        held.holding = false;
        held.holdCompleted = true;
        this.activeHolds[lane] = null;
        this.tally.holds++;
        this.score += Math.round(120 * this.diff.scoreMul * feverMul);
      } else if (this.laneHeld[lane] && t >= held.nextTickTime) {
        held.nextTickTime += 0.07;
        this.score += Math.round(SCORE.holdTick * this.diff.scoreMul * feverMul);
        this.tally.holds++;
      }
    }

    // Mark unhit notes past the good window as misses
    const goodWin = this.diff.good / 1000;
    for (const note of this.notes) {
      if (note.judged) continue;
      if (t - note.time > goodWin) {
        this.applyJudge(note, JUDGE.MISS, t, Math.round(goodWin * 1000));
        if (onHitCallback) {
          onHitCallback(note.lane, JUDGE.MISS, 99, note);
        }
      } else {
        break;
      }
    }
  }

  checkFinished(audioDurationSec, audioTimeSec) {
    if (this.finished) return true;
    const t = this.now(audioTimeSec);
    const allJudged = this.notes.every(
      (n) => n.judged && (!n.duration || !n.holding || t >= n.time + n.duration)
    );
    const pastEnd = t > audioDurationSec + 0.6;
    if (allJudged || pastEnd) {
      this.finished = true;
      return true;
    }
    return false;
  }

  getAccuracy() {
    const total = this.tally.perfect + this.tally.good + this.tally.miss;
    if (total === 0) return 100;
    const weighted = this.tally.perfect * 1.0 + this.tally.good * 0.55;
    return Number(((weighted / total) * 100).toFixed(1));
  }

  getMeanOffsetMs() {
    if (this.offsetCount === 0) return 0;
    return Math.round(this.offsetSumMs / this.offsetCount);
  }

  getGradeInfo() {
    return computeLetterGrade(this.getAccuracy());
  }

  results() {
    const accuracy = this.getAccuracy();
    const { grade, color } = computeLetterGrade(accuracy);
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy,
      grade,
      gradeColor: color,
      perfect: this.tally.perfect,
      good: this.tally.good,
      holds: this.tally.holds,
      miss: this.tally.miss,
      meanOffsetMs: this.getMeanOffsetMs(),
    };
  }
}

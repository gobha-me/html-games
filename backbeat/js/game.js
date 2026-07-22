/**
 * BACKBEAT — game state + hit detection.
 * Pure logic: given the audio clock and a chart, track notes, judge inputs,
 * and report score/combo/accuracy. No DOM here (renderer reads this state).
 */

import { DIFFICULTY, JUDGE, SCORE, LANES, judgeOffset } from './config.js';

export class Game {
  constructor(chart, difficulty, audioOffsetMs = 0) {
    this.chart = chart;
    this.difficulty = difficulty;
    this.diff = DIFFICULTY[difficulty];
    this.audioOffsetSec = (audioOffsetMs + (chart.offset || 0) * 1000) / 1000;

    // Per-note runtime state. judged: null | 'perfect' | 'good' | 'miss'
    this.notes = chart.notes.map(n => ({ time: n.time, lane: n.lane, judged: null, hitTime: null }));

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.tally = { perfect: 0, good: 0, miss: 0 };
    this.lastJudgement = null; // {type, at} for the HUD flash
    this.finished = false;
  }

  /** audio time in seconds, corrected by user+chart offset */
  now(audioTimeSec) { return audioTimeSec - this.audioOffsetSec; }

  /**
   * Handle a lane press. Returns the judgement ('perfect'|'good'|null).
   * Finds the nearest unjudged note in that lane within the good window.
   */
  press(lane, audioTimeSec) {
    if (lane < 0 || lane >= LANES || this.finished) return null;
    const t = this.now(audioTimeSec);
    const goodWin = this.diff.good / 1000;

    let best = null, bestAbs = Infinity;
    for (const note of this.notes) {
      if (note.lane !== lane || note.judged) continue;
      const off = t - note.time;             // negative = early, positive = late
      const abs = Math.abs(off);
      if (abs <= goodWin && abs < bestAbs) { best = note; bestAbs = abs; }
      if (note.time - t > goodWin) break;    // sorted; no closer notes ahead
    }

    if (!best) return null; // a press with no note in window = no penalty (avoids mashing grief)

    const absMs = bestAbs * 1000;
    const judgement = judgeOffset(absMs, this.difficulty) || JUDGE.MISS;
    this.applyJudge(best, judgement, t);
    return judgement;
  }

  applyJudge(note, judgement, t) {
    note.judged = judgement;
    note.hitTime = t;
    this.tally[judgement]++;
    if (judgement === JUDGE.MISS) {
      this.combo = 0;
    } else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += Math.round(SCORE[judgement] * this.diff.scoreMul * (1 + this.combo * 0.01));
    }
    this.lastJudgement = { type: judgement, at: performance.now() };
  }

  /**
   * Advance: mark notes that passed the good window unhit as misses.
   * Also detects track end.
   */
  update(audioTimeSec) {
    if (this.finished) return;
    const t = this.now(audioTimeSec);
    const goodWin = this.diff.good / 1000;
    for (const note of this.notes) {
      if (note.judged) continue;
      if (t - note.time > goodWin) this.applyJudge(note, JUDGE.MISS, t);
      else break; // sorted by time
    }
  }

  /** All notes judged → done. */
  checkFinished(audioDurationSec, audioTimeSec) {
    if (this.finished) return true;
    const allJudged = this.notes.every(n => n.judged);
    const pastEnd = this.now(audioTimeSec) > audioDurationSec + 0.5;
    if (allJudged || pastEnd) { this.finished = true; return true; }
    return false;
  }

  getAccuracy() {
    const total = this.tally.perfect + this.tally.good + this.tally.miss;
    if (total === 0) return 100;
    const weighted = this.tally.perfect * 1.0 + this.tally.good * 0.5;
    return Math.round((weighted / total) * 100);
  }

  results() {
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: this.getAccuracy(),
      perfect: this.tally.perfect,
      good: this.tally.good,
      miss: this.tally.miss
    };
  }
}

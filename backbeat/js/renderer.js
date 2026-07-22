/**
 * BACKBEAT — canvas renderer.
 * Draws lanes, the hit line, falling notes, and hit/miss flashes.
 * Notes move toward the line as audio time approaches their hit time.
 */

import { LANES, LANE_COLORS, NOTE_LEAD_BASE, JUDGE } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.laneW = this.W / LANES;
    this.hitLineY = this.H - 90;
    this.noteH = 22;
    this.flashes = []; // {lane, color, at}
  }

  addFlash(lane, judgement) {
    const color = judgement === JUDGE.PERFECT ? '#00ffcc' : judgement === JUDGE.GOOD ? '#ffd21f' : '#ff3b3b';
    this.flashes.push({ lane, color, at: performance.now() });
  }

  draw(game, audioTimeSec, noteSpeed) {
    const { ctx, W, H, laneW, hitLineY } = this;
    ctx.clearRect(0, 0, W, H);

    // lanes
    for (let i = 0; i < LANES; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(i * laneW, 0, laneW, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeRect(i * laneW, 0, laneW, H);
    }

    // hit line
    ctx.fillStyle = 'rgba(0,212,255,0.15)';
    ctx.fillRect(0, hitLineY - 4, W, 8);
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(0, hitLineY - 1, W, 2);

    // notes
    const t = game.now(audioTimeSec);
    const lead = NOTE_LEAD_BASE / noteSpeed / 1000; // seconds a note is visible
    for (const note of game.notes) {
      if (note.judged === JUDGE.MISS || note.judged === JUDGE.PERFECT || note.judged === JUDGE.GOOD) continue;
      const dt = note.time - t;             // seconds until hit
      if (dt > lead) continue;              // not yet spawned
      if (dt < -0.2) continue;              // passed (will be judged miss by update)
      const progress = 1 - (dt / lead);     // 0 (top) → 1 (line)
      const y = progress * hitLineY;
      this.drawNote(note.lane, y, LANE_COLORS[note.lane]);
    }

    // receptors (static targets at the line)
    for (let i = 0; i < LANES; i++) {
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.strokeRect(i * laneW + 8, hitLineY - this.noteH / 2, laneW - 16, this.noteH);
      ctx.globalAlpha = 1;
    }

    // hit flashes
    const nowMs = performance.now();
    this.flashes = this.flashes.filter(f => nowMs - f.at < 180);
    for (const f of this.flashes) {
      const a = 1 - (nowMs - f.at) / 180;
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.fillRect(f.lane * laneW, hitLineY - 30, laneW, 60);
      ctx.globalAlpha = 1;
    }
  }

  drawNote(lane, y, color) {
    const { ctx, laneW } = this;
    const x = lane * laneW;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    this.roundRect(x + 8, y - this.noteH / 2, laneW - 16, this.noteH, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  roundRect(x, y, w, h, r) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

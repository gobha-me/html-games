// ============================================================================
// BACKBEAT // OVERDRIVE — 3D Perspective Highway, FFT Stage & Cyber-DJ Renderer
// ============================================================================

import { LANES, LANE_COLORS, LANE_LABELS, JUDGE } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 800;
    this.H = 760;
    this.dpr = 1;

    this.flashes = []; // { lane, color, judge, at }
    this.particles = []; // { x, y, vx, vy, color, alpha, size }
    this.shockwaves = []; // { lane, color, radius, alpha }

    // Preload pixel-art Cyber-DJ sprite
    this.djSprite = new Image();
    this.djSprite.onload = () => {
      if (this._lastArgs) {
        const [g, t, s, tr] = this._lastArgs;
        this.draw(g, t, s, tr);
      }
    };
    this.djSprite.src = 'assets/art/cyber_dj.png';

    // Deterministic starfield
    this.stars = Array.from({ length: 56 }, (_, i) => ({
      u: ((i * 73) % 100) / 100,
      v: ((i * 41) % 100) / 100,
      r: (i % 3) * 0.6 + 0.8,
      phase: i * 0.7,
    }));
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(460, Math.floor(rect.width));
    this.H = Math.max(520, Math.floor(rect.height));

    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
  }

  // Perspective highway geometry helpers
  // u = 0 at horizonY, u = 1 at hitLineY
  project(laneFloat, u) {
    const horizonY = this.H * 0.31;
    const hitLineY = this.H * 0.855;
    const topHalfW = this.W * 0.125;
    const botHalfW = this.W * 0.39;

    // Non-linear perspective foreshortening for authentic 3D depth
    const p = u >= 0 ? Math.pow(u, 1.55) : -Math.pow(-u, 1.3);
    const y = horizonY + p * (hitLineY - horizonY);
    const halfW = topHalfW + p * (botHalfW - topHalfW);
    const cx = this.W * 0.5;
    const normLane = (laneFloat / LANES) * 2 - 1; // -1 .. +1
    const x = cx + normLane * halfW;
    const laneWidthAtDepth = (halfW * 2) / LANES;
    const scale = 0.32 + 0.68 * Math.max(0.1, p);
    return { x, y, laneW: laneWidthAtDepth, scale, p };
  }

  addFlash(lane, judgement) {
    const color =
      judgement === JUDGE.PERFECT
        ? '#00ffcc'
        : judgement === JUDGE.GOOD
        ? '#ffd21f'
        : '#ff3b5c';
    this.flashes.push({ lane, color, judge: judgement, at: performance.now() });

    const pos = this.project(lane + 0.5, 1.0);
    if (judgement !== JUDGE.MISS) {
      this.shockwaves.push({
        x: pos.x,
        y: pos.y,
        color: LANE_COLORS[lane],
        r: 10,
        alpha: 0.95,
      });
      for (let i = 0; i < 14; i++) {
        const ang = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.3;
        const spd = 2.2 + Math.random() * 4.5;
        this.particles.push({
          x: pos.x,
          y: pos.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 1.4,
          color: i % 2 === 0 ? LANE_COLORS[lane] : '#ffffff',
          alpha: 1,
          size: 2.5 + Math.random() * 2.5,
        });
      }
    }
  }

  draw(game, audioTimeSec, spectrum, track) {
    this._lastArgs = [game, audioTimeSec, spectrum, track];
    const { ctx, W, H } = this;
    const t = game.now(audioTimeSec);
    const bpm = (game.chart && game.chart.bpm) || (track && track.bpm) || 120;
    const beatFloat = (Math.max(0, t) * bpm) / 60;
    const beatPulse = Math.pow(Math.max(0, 1 - (beatFloat % 1)), 2.2);

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Studio Stage Backdrop & Synthwave Horizon
    this.drawStageBackdrop(ctx, W, H, t, beatPulse, spectrum, track, game.overdriveActive);

    // 2. 3D Perspective 4-Lane Highway
    this.drawPerspectiveHighway(ctx, W, H, game, t, beatFloat, beatPulse);

    // 3. Falling Notes, Chords & Hold/Sustain Ribbons
    this.drawNotesAndRibbons(ctx, game, t);

    // 4. Receptor Docks, Hit Shockwaves & Particle Sparks
    this.drawReceptorsAndFX(ctx, game, t);

    // 5. Center Stage Judgement & Millisecond Offset Callout
    this.drawCenterJudgement(ctx, W, H, game);

    ctx.restore();
  }

  drawStageBackdrop(ctx, W, H, t, beatPulse, spectrum, track, overdrive) {
    const horizonY = H * 0.31;
    const cx = W * 0.5;
    const accent = overdrive ? '#ffd21f' : (track && track.accent) || '#00d4ff';

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, overdrive ? '#1a0926' : '#05060f');
    skyGrad.addColorStop(0.31, overdrive ? '#320d3e' : '#120924');
    skyGrad.addColorStop(1, '#04050a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Twinkling stars
    for (const st of this.stars) {
      const a = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.5 + st.phase));
      ctx.fillStyle = `rgba(210, 230, 255, ${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(st.u * W, st.v * (horizonY - 12), st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sweeping Stage Lasers
    const laserCount = overdrive ? 8 : 4;
    ctx.save();
    for (let i = 0; i < laserCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const baseX = cx + side * (W * 0.16 + (i >> 1) * 45);
      const sway = Math.sin(t * 2.4 + i * 1.1) * 0.42;
      const topX = baseX + Math.sin(sway) * 240;
      const col = LANE_COLORS[i % LANES];
      const grad = ctx.createLinearGradient(baseX, horizonY, topX, 0);
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = grad;
      ctx.globalAlpha = overdrive ? 0.42 : 0.22;
      ctx.lineWidth = overdrive ? 3.2 : 1.8;
      ctx.beginPath();
      ctx.moveTo(baseX, horizonY);
      ctx.lineTo(topX, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Retro-Synthwave Sun Halo behind Cyber-DJ
    const sunR = 66 + beatPulse * 7;
    const sunGrad = ctx.createLinearGradient(cx, horizonY - sunR * 1.7, cx, horizonY);
    sunGrad.addColorStop(0, overdrive ? '#fffbeb' : '#ff2ec4');
    sunGrad.addColorStop(0.55, accent);
    sunGrad.addColorStop(1, 'rgba(18, 9, 36, 0.1)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, horizonY - 14, sunR, Math.PI, 0, false);
    ctx.fill();

    // Dual-Wing 28-Band Real-Time FFT Spectrum Bars flanking the DJ Stage
    if (spectrum && spectrum.length > 0) {
      const bins = 26;
      const startXLeft = cx - 96;
      const startXRight = cx + 96;
      const wingW = Math.max(90, cx - 114);
      const barStep = wingW / bins;
      const barW = Math.max(3, barStep - 2.5);

      for (let i = 0; i < bins; i++) {
        const val = spectrum[i] / 255;
        const barH = Math.max(4, val * (horizonY * 0.72));
        const col = i < 8 ? '#00d4ff' : i < 17 ? '#ff2ec4' : '#ffd21f';

        ctx.fillStyle = col;
        ctx.globalAlpha = 0.82;
        // Left wing (mirrored outward)
        const lx = startXLeft - (i + 1) * barStep;
        ctx.fillRect(lx, horizonY - barH, barW, barH);
        // Peak cap
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx, horizonY - barH - 3, barW, 2);

        // Right wing
        ctx.fillStyle = col;
        const rx = startXRight + i * barStep;
        ctx.fillRect(rx, horizonY - barH, barW, barH);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rx, horizonY - barH - 3, barW, 2);
      }
      ctx.globalAlpha = 1;
    }

    // Pixel-Art Cyber-DJ Deck Sprite at Center Horizon
    if (this.djSprite && this.djSprite.complete && this.djSprite.naturalWidth > 0) {
      const djW = 176;
      const djH = 132;
      const bounce = beatPulse * 5;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.djSprite,
        cx - djW * 0.5,
        horizonY - djH + 14 + bounce,
        djW,
        djH
      );
      ctx.restore();
    }

    // Horizon Neon Divider Line
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.fillRect(0, horizonY - 1.5, W, 3);
    ctx.shadowBlur = 0;
  }

  drawPerspectiveHighway(ctx, W, H, game, t, beatFloat, beatPulse) {
    const horizonY = H * 0.31;
    // Ambient outer perspective grid wings
    ctx.strokeStyle = game.overdriveActive
      ? 'rgba(255, 210, 31, 0.16)'
      : 'rgba(168, 85, 247, 0.13)';
    ctx.lineWidth = 1;
    for (let g = -8; g <= 12; g++) {
      if (g >= 0 && g <= LANES) continue;
      const pTop = this.project(g, 0);
      const pBot = this.project(g, 1.15);
      ctx.beginPath();
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBot.x, pBot.y);
      ctx.stroke();
    }

    // 4-Lane Highway Surface Trapezoid
    const topL = this.project(0, 0);
    const topR = this.project(LANES, 0);
    const botL = this.project(0, 1.16);
    const botR = this.project(LANES, 1.16);

    const hwGrad = ctx.createLinearGradient(0, horizonY, 0, H);
    hwGrad.addColorStop(0, game.overdriveActive ? 'rgba(42, 16, 58, 0.92)' : 'rgba(10, 14, 28, 0.92)');
    hwGrad.addColorStop(0.85, 'rgba(7, 10, 20, 0.97)');
    hwGrad.addColorStop(1, 'rgba(4, 6, 14, 0.99)');

    ctx.fillStyle = hwGrad;
    ctx.beginPath();
    ctx.moveTo(topL.x, topL.y);
    ctx.lineTo(topR.x, topR.y);
    ctx.lineTo(botR.x, botR.y);
    ctx.lineTo(botL.x, botL.y);
    ctx.closePath();
    ctx.fill();

    // Active Key-Hold Lane Laser Beams
    for (let lane = 0; lane < LANES; lane++) {
      if (game.laneHeld[lane]) {
        const lTop = this.project(lane, 0);
        const rTop = this.project(lane + 1, 0);
        const lBot = this.project(lane, 1.12);
        const rBot = this.project(lane + 1, 1.12);

        const beamGrad = ctx.createLinearGradient(0, horizonY, 0, H * 0.86);
        beamGrad.addColorStop(0, 'rgba(0,0,0,0)');
        beamGrad.addColorStop(1, LANE_COLORS[lane] + '38');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(lTop.x, lTop.y);
        ctx.lineTo(rTop.x, rTop.y);
        ctx.lineTo(rBot.x, rBot.y);
        ctx.lineTo(lBot.x, lBot.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Scrolling Beat / Measure Lines down the highway
    const leadSec = game.diff.leadSec;
    const bpm = (game.chart && game.chart.bpm) || 120;
    const beatSec = 60 / bpm;
    const firstBeat = Math.floor(t / beatSec);
    for (let b = firstBeat; b < firstBeat + 12; b++) {
      const bt = b * beatSec;
      const dt = bt - t;
      if (dt < -0.15 || dt > leadSec) continue;
      const u = 1 - dt / leadSec;
      const leftPt = this.project(0, u);
      const rightPt = this.project(LANES, u);
      const isBar = b % 4 === 0;
      ctx.strokeStyle = isBar
        ? 'rgba(255, 255, 255, 0.24)'
        : 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = isBar ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(leftPt.x, leftPt.y);
      ctx.lineTo(rightPt.x, rightPt.y);
      ctx.stroke();
    }

    // Lane Divider Rails
    for (let i = 0; i <= LANES; i++) {
      const p0 = this.project(i, 0);
      const p1 = this.project(i, 1.16);
      const isOuter = i === 0 || i === LANES;
      ctx.strokeStyle = isOuter
        ? game.overdriveActive
          ? '#ffd21f'
          : '#00d4ff'
        : 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = isOuter ? 2.6 : 1.2;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  drawNotesAndRibbons(ctx, game, t) {
    const leadSec = game.diff.leadSec;

    // 1. First pass: Draw Hold/Sustain Ribbons & Simultaneous Chord Tie-Bars
    let prevChordNote = null;
    for (const note of game.notes) {
      if (note.judged === JUDGE.MISS) continue;

      const headDt = note.time - t;
      const tailDt = note.time + (note.duration || 0) - t;

      // Skip if completely past or not yet on highway
      if (tailDt < -0.12 || headDt > leadSec) continue;

      // Draw Hold/Sustain Ribbon if duration > 0
      if (note.duration > 0 && !note.holdCompleted) {
        const uHead = note.holding
          ? 1.0
          : Math.min(1.08, Math.max(0, 1 - headDt / leadSec));
        const uTail = Math.min(1.05, Math.max(0, 1 - tailDt / leadSec));

        if (uHead > uTail) {
          const pHeadL = this.project(note.lane + 0.22, uHead);
          const pHeadR = this.project(note.lane + 0.78, uHead);
          const pTailL = this.project(note.lane + 0.22, uTail);
          const pTailR = this.project(note.lane + 0.78, uTail);

          const col = LANE_COLORS[note.lane];
          const ribGrad = ctx.createLinearGradient(0, pTailL.y, 0, pHeadL.y);
          ribGrad.addColorStop(0, col + '35');
          ribGrad.addColorStop(1, note.holding ? '#ffffffcc' : col + 'aa');

          ctx.fillStyle = ribGrad;
          ctx.beginPath();
          ctx.moveTo(pTailL.x, pTailL.y);
          ctx.lineTo(pTailR.x, pTailR.y);
          ctx.lineTo(pHeadR.x, pHeadR.y);
          ctx.lineTo(pHeadL.x, pHeadL.y);
          ctx.closePath();
          ctx.fill();

          // Center energy spine
          const pHeadC = this.project(note.lane + 0.5, uHead);
          const pTailC = this.project(note.lane + 0.5, uTail);
          ctx.strokeStyle = note.holding ? '#ffffff' : col;
          ctx.lineWidth = Math.max(1.5, 3 * pHeadC.scale);
          ctx.beginPath();
          ctx.moveTo(pTailC.x, pTailC.y);
          ctx.lineTo(pHeadC.x, pHeadC.y);
          ctx.stroke();

          // Tail end-cap
          const capH = Math.max(4, 10 * pTailC.scale);
          ctx.fillStyle = col;
          ctx.fillRect(
            pTailL.x,
            pTailL.y - capH * 0.5,
            pTailR.x - pTailL.x,
            capH
          );
        }
      }

      // Draw Simultaneous Chord Tie-Bar between two unjudged notes at the same timestamp
      if (!note.judged && note.chord) {
        if (prevChordNote && Math.abs(prevChordNote.time - note.time) < 0.005) {
          const u = 1 - headDt / leadSec;
          if (u >= 0 && u <= 1.05) {
            const pA = this.project(prevChordNote.lane + 0.5, u);
            const pB = this.project(note.lane + 0.5, u);
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = Math.max(2, 5 * pA.scale);
            ctx.beginPath();
            ctx.moveTo(pA.x, pA.y);
            ctx.lineTo(pB.x, pB.y);
            ctx.stroke();
          }
        }
        prevChordNote = note;
      }
    }

    // 2. Second pass: Draw 3D Beveled Synth Note Heads (back-to-front)
    for (const note of game.notes) {
      if (note.judged) continue;
      const dt = note.time - t;
      if (dt > leadSec || dt < -0.14) continue;

      const u = 1 - dt / leadSec;
      const pL = this.project(note.lane + 0.08, u);
      const pR = this.project(note.lane + 0.92, u);
      const w = pR.x - pL.x;
      const h = Math.max(6, 22 * pL.scale);
      const x = pL.x;
      const y = pL.y - h * 0.5;
      const color = game.overdriveActive ? '#ffd21f' : LANE_COLORS[note.lane];

      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 * pL.scale;
      this.roundRect(x, y, w, h, Math.max(2, 6 * pL.scale));
      ctx.fill();
      ctx.shadowBlur = 0;

      // Crisp white specular core bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        x + w * 0.14,
        y + h * 0.28,
        w * 0.72,
        Math.max(2, h * 0.34)
      );

      // Gold rim for simultaneous chord notes
      if (note.chord) {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.6;
        this.roundRect(x, y, w, h, Math.max(2, 6 * pL.scale));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawReceptorsAndFX(ctx, game, t) {
    const leftHit = this.project(0, 1.0);
    const rightHit = this.project(LANES, 1.0);

    // Glowing Receptor Strike Bar
    ctx.fillStyle = 'rgba(0, 212, 255, 0.22)';
    ctx.fillRect(leftHit.x, leftHit.y - 5, rightHit.x - leftHit.x, 10);
    ctx.fillStyle = game.overdriveActive ? '#ffd21f' : '#00ffcc';
    ctx.fillRect(leftHit.x, leftHit.y - 1.5, rightHit.x - leftHit.x, 3);

    // 4 Receptor Key Docks (D F J K)
    for (let i = 0; i < LANES; i++) {
      const pL = this.project(i + 0.08, 1.0);
      const pR = this.project(i + 0.92, 1.0);
      const pC = this.project(i + 0.5, 1.0);
      const w = pR.x - pL.x;
      const h = 24;
      const pressed = game.laneHeld[i];
      const col = LANE_COLORS[i];

      ctx.save();
      ctx.fillStyle = pressed ? col + '55' : 'rgba(12, 17, 32, 0.88)';
      ctx.strokeStyle = col;
      ctx.lineWidth = pressed ? 3 : 2;
      this.roundRect(pL.x, pC.y - h * 0.5 + (pressed ? 2 : 0), w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Key Label below receptor
      ctx.fillStyle = pressed ? '#ffffff' : col;
      ctx.font = '700 13px "Orbitron", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LANE_LABELS[i], pC.x, pC.y + 28);
      ctx.restore();

      // Continuous spark fountain while holding a sustain ribbon
      if (game.activeHolds[i] && game.laneHeld[i]) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = col;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(pC.x, pC.y, 9 + Math.sin(t * 28) * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Hit Flash Columns
    const nowMs = performance.now();
    this.flashes = this.flashes.filter((f) => nowMs - f.at < 190);
    for (const f of this.flashes) {
      const a = 1 - (nowMs - f.at) / 190;
      const pL = this.project(f.lane + 0.05, 0.72);
      const pR = this.project(f.lane + 0.95, 0.72);
      const bL = this.project(f.lane + 0.05, 1.04);
      const bR = this.project(f.lane + 0.95, 1.04);

      const grad = ctx.createLinearGradient(0, pL.y, 0, bL.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, f.color);

      ctx.save();
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(pL.x, pL.y);
      ctx.lineTo(pR.x, pR.y);
      ctx.lineTo(bR.x, bR.y);
      ctx.lineTo(bL.x, bL.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.r += 2.8;
      sw.alpha -= 0.055;
      if (sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, sw.r * 1.35, sw.r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.14;
      pt.alpha -= 0.04;
      if (pt.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = pt.alpha;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
      ctx.restore();
    }
  }

  drawCenterJudgement(ctx, W, H, game) {
    const cx = W * 0.5;
    const cy = H * 0.52;

    if (game.combo >= 2) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 32px "Orbitron", monospace';
      ctx.fillStyle = game.overdriveActive ? '#ffd21f' : 'rgba(255, 255, 255, 0.88)';
      ctx.fillText(`${game.combo}×`, cx, cy - 26);

      ctx.font = '700 10px "Orbitron", monospace';
      ctx.fillStyle = game.overdriveActive ? '#fde047' : '#94a3b8';
      ctx.fillText(game.overdriveActive ? '2× OVERDRIVE FEVER' : 'COMBO STREAK', cx, cy - 6);
      ctx.restore();
    }

    if (game.lastJudgement) {
      const age = performance.now() - game.lastJudgement.at;
      if (age < 520) {
        const a = Math.min(1, 1 - age / 520);
        const j = game.lastJudgement;
        const label =
          j.type === JUDGE.PERFECT
            ? 'PERFECT!'
            : j.type === JUDGE.GOOD
            ? 'GOOD'
            : 'MISS';
        const color =
          j.type === JUDGE.PERFECT
            ? '#00ffcc'
            : j.type === JUDGE.GOOD
            ? '#ffd21f'
            : '#ff3b5c';

        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.font = '900 22px "Orbitron", monospace';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillText(label, cx, cy + 24);
        ctx.shadowBlur = 0;

        if (j.type !== JUDGE.MISS) {
          const sign = j.offsetMs > 0 ? '+' : '';
          const tag =
            Math.abs(j.offsetMs) <= 8
              ? 'DEAD-ON'
              : j.offsetMs < 0
              ? 'EARLY'
              : 'LATE';
          ctx.font = '600 11px monospace';
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(`${sign}${j.offsetMs}ms ${tag}`, cx, cy + 42);
        }
        ctx.restore();
      }
    }
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

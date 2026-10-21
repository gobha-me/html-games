// ============================================================================
// BACKBEAT // OVERDRIVE — Full-Bleed 3D Perspective Neon Highway, Outrun
// Wireframe Mountains, Pumping Stage Subwoofers & 3D Synth Keycap Renderer
// ============================================================================

import { LANES, LANE_COLORS, LANE_LABELS, JUDGE } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 1440;
    this.H = 900;
    this.dpr = 1;

    this.flashes = []; // { lane, color, judge, at }
    this.particles = []; // { x, y, vx, vy, color, alpha, size }
    this.shockwaves = []; // { x, y, color, r, alpha }

    // Preload pixel-art Cyber-DJ sprite
    this.djSprite = new Image();
    this.djSprite.onload = () => {
      if (this._lastArgs) {
        const [g, t, s, tr] = this._lastArgs;
        this.draw(g, t, s, tr);
      }
    };
    this.djSprite.src = 'assets/art/cyber_dj.png';

    // Deterministic starfield across the upper sky
    this.stars = Array.from({ length: 76 }, (_, i) => ({
      u: ((i * 73 + 17) % 100) / 100,
      v: ((i * 41 + 29) % 100) / 100,
      r: (i % 3) * 0.6 + 0.7,
      phase: i * 0.7,
    }));
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(640, Math.floor(rect.width));
    this.H = Math.max(520, Math.floor(rect.height));

    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
  }

  // Perspective highway geometry helpers
  // u = 0 at horizonY, u = 1 at hitLineY
  project(laneFloat, u) {
    const horizonY = this.H * 0.33;
    const hitLineY = this.H * 0.855;
    // Full-bleed stage proportions: highway commands center 46% at bottom, tapering to 11% at horizon
    const topHalfW = Math.min(105, this.W * 0.068);
    const botHalfW = Math.min(350, this.W * 0.245);

    const p = u >= 0 ? Math.pow(u, 1.58) : -Math.pow(-u, 1.3);
    const y = horizonY + p * (hitLineY - horizonY);
    const halfW = topHalfW + p * (botHalfW - topHalfW);
    const cx = this.W * 0.5;
    const normLane = (laneFloat / LANES) * 2 - 1; // -1 .. +1
    const x = cx + normLane * halfW;
    const laneWidthAtDepth = (halfW * 2) / LANES;
    const scale = 0.30 + 0.70 * Math.max(0.08, p);
    return { x, y, laneW: laneWidthAtDepth, scale, p };
  }

  addFlash(lane, judgement, isChord = false) {
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
        color: isChord ? '#ffd21f' : LANE_COLORS[lane],
        r: isChord ? 18 : 12,
        alpha: 0.98,
      });
      const count = isChord ? 24 : 16;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const spd = (isChord ? 3.2 : 2.4) + Math.random() * 5.0;
        this.particles.push({
          x: pos.x,
          y: pos.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 1.6,
          color: isChord && i % 3 === 0 ? '#ffd21f' : i % 2 === 0 ? LANE_COLORS[lane] : '#ffffff',
          alpha: 1,
          size: 2.5 + Math.random() * 2.8,
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
    const beatPulse = Math.pow(Math.max(0, 1 - (beatFloat % 1)), 2.1);

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Full-Bleed Synthwave Concert Stage Backdrop, Outrun Sun, Mountains & Speaker Stacks
    this.drawStageBackdrop(ctx, W, H, t, beatFloat, beatPulse, spectrum, track, game.overdriveActive);

    // 2. 3D Perspective 4-Lane Highway & Scrolling Synthwave Grid Floor
    this.drawPerspectiveHighway(ctx, W, H, game, t, beatFloat, beatPulse, track);

    // 3. Falling 3D Beveled Notes, Chords & Hold/Sustain Ribbons
    this.drawNotesAndRibbons(ctx, game, t);

    // 4. 3D Molded Receptor Keycaps, Hit Shockwaves & Particle Sparks
    this.drawReceptorsAndFX(ctx, game, t);

    // 5. Center Stage Judgement & Millisecond Timing Bar
    this.drawCenterJudgement(ctx, W, H, game);

    ctx.restore();
  }

  drawStageBackdrop(ctx, W, H, t, beatFloat, beatPulse, spectrum, track, overdrive) {
    const horizonY = H * 0.33;
    const cx = W * 0.5;
    const accent = overdrive ? '#ffd21f' : (track && track.accent) || '#00d4ff';

    // Deep Synthwave Night Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, overdrive ? '#160624' : '#04050d');
    skyGrad.addColorStop(0.22, overdrive ? '#2e0b3d' : '#100724');
    skyGrad.addColorStop(0.33, overdrive ? '#4c1152' : '#240c3b');
    skyGrad.addColorStop(0.34, '#070814');
    skyGrad.addColorStop(1, '#03040a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Twinkling Starfield
    for (const st of this.stars) {
      const a = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.5 + st.phase));
      ctx.fillStyle = `rgba(216, 236, 255, ${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(st.u * W, st.v * (horizonY - 24), st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sweeping Concert Truss Lasers
    const laserCount = overdrive ? 10 : 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < laserCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const baseX = cx + side * (110 + (i >> 1) * 85);
      const sway = Math.sin(t * 2.3 + i * 1.05) * 0.48;
      const topX = baseX + Math.sin(sway) * 320;
      const col = LANE_COLORS[i % LANES];
      const grad = ctx.createLinearGradient(baseX, horizonY, topX, 0);
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = grad;
      ctx.globalAlpha = overdrive ? 0.44 : 0.24;
      ctx.lineWidth = overdrive ? 3.4 : 2.0;
      ctx.beginPath();
      ctx.moveTo(baseX, horizonY);
      ctx.lineTo(topX, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Classic 1989 Outrun Sliced Sunset Disk behind the Cyber-DJ
    const sunR = 92 + beatPulse * 8;
    const sunCy = horizonY - 8;
    ctx.save();
    ctx.beginPath();
    // Clip out horizontal retro scanline slices in the lower half of the sun
    ctx.rect(cx - sunR - 10, sunCy - sunR - 10, (sunR + 10) * 2, sunR * 0.42);
    for (let s = 0; s < 6; s++) {
      const sliceY = sunCy - sunR * 0.58 + s * (sunR * 0.11);
      const sliceH = Math.max(2, sunR * 0.075 - s * 1.1);
      ctx.rect(cx - sunR - 10, sliceY, (sunR + 10) * 2, sliceH);
    }
    ctx.clip();

    const sunGrad = ctx.createLinearGradient(cx, sunCy - sunR, cx, horizonY);
    sunGrad.addColorStop(0, overdrive ? '#fffbeb' : '#fde047');
    sunGrad.addColorStop(0.45, '#ff2ec4');
    sunGrad.addColorStop(1, accent);
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, sunCy, sunR, Math.PI, 0, false);
    ctx.fill();
    ctx.restore();

    // Synthwave Wireframe Horizon Mountains (Left & Right of Center Stage)
    this.drawWireframeMountains(ctx, W, horizonY, cx, accent, beatPulse);

    // Dual-Wing 28-Band FFT Spectrum Equalizer (Uses live WebAudio spectrum OR BPM-synced synth wave in preview mode!)
    const bins = 26;
    const startXLeft = cx - 155;
    const startXRight = cx + 155;
    const wingW = Math.min(360, Math.max(120, cx - 180));
    const barStep = wingW / bins;
    const barW = Math.max(3.5, barStep - 3);

    // Check if WebAudio analyser has active signal; if in pre-play attract mode, generate BPM-synced spectrum!
    let hasSignal = false;
    if (spectrum && spectrum.length > 0) {
      for (let i = 0; i < 12; i++) {
        if (spectrum[i] > 4) {
          hasSignal = true;
          break;
        }
      }
    }

    for (let i = 0; i < bins; i++) {
      let val = 0;
      if (hasSignal && spectrum) {
        val = spectrum[i] / 255;
      } else {
        // Procedural BPM-locked equalizer curve so the stage is alive even before clicking Play
        const freqCurve = Math.exp(-i * 0.065);
        const wave1 = 0.5 + 0.5 * Math.sin(t * 6.5 - i * 0.35);
        const wave2 = 0.5 + 0.5 * Math.cos(t * 11.2 + i * 0.55);
        val = Math.min(1, (0.22 + beatPulse * 0.52 * freqCurve + 0.28 * wave1 * wave2) * (0.45 + 0.55 * freqCurve));
      }
      const barH = Math.max(5, val * (horizonY * 0.52));
      const col = i < 8 ? '#00d4ff' : i < 17 ? '#ff2ec4' : '#ffd21f';

      ctx.fillStyle = col;
      ctx.globalAlpha = 0.84;
      const lx = startXLeft - (i + 1) * barStep;
      ctx.fillRect(lx, horizonY - barH, barW, barH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx, horizonY - barH - 3, barW, 2);

      ctx.fillStyle = col;
      const rx = startXRight + i * barStep;
      ctx.fillRect(rx, horizonY - barH, barW, barH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx, horizonY - barH - 3, barW, 2);
    }
    ctx.globalAlpha = 1;

    // Dual Pumping Stage Subwoofer Stacks flanking the Cyber-DJ Booth
    this.drawSubwooferStack(ctx, cx - 122, horizonY - 72, 42, 70, accent, beatPulse);
    this.drawSubwooferStack(ctx, cx + 80, horizonY - 72, 42, 70, accent, beatPulse);

    // Pixel-Art Cyber-DJ Deck Sprite at Center Horizon
    if (this.djSprite && this.djSprite.complete && this.djSprite.naturalWidth > 0) {
      const djW = 184;
      const djH = 138;
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
    ctx.shadowBlur = 14;
    ctx.fillRect(0, horizonY - 1.5, W, 3);
    ctx.shadowBlur = 0;
  }

  drawWireframeMountains(ctx, W, horizonY, cx, accent, beatPulse) {
    ctx.save();
    const peaks = [
      { x: 0, h: 48 },
      { x: W * 0.08, h: 96 },
      { x: W * 0.16, h: 62 },
      { x: W * 0.25, h: 112 },
      { x: W * 0.34, h: 44 },
      { x: cx - 100, h: 10 },
      { x: cx + 100, h: 10 },
      { x: W * 0.66, h: 48 },
      { x: W * 0.75, h: 116 },
      { x: W * 0.84, h: 64 },
      { x: W * 0.92, h: 92 },
      { x: W, h: 52 },
    ];

    ctx.fillStyle = '#090616';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.55 + beatPulse * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (const pt of peaks) {
      ctx.lineTo(pt.x, horizonY - pt.h);
    }
    ctx.lineTo(W, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vertical wireframe facets from peaks to horizon
    ctx.strokeStyle = 'rgba(255, 46, 196, 0.25)';
    ctx.lineWidth = 1;
    for (const pt of peaks) {
      if (pt.h > 20) {
        ctx.beginPath();
        ctx.moveTo(pt.x, horizonY - pt.h);
        ctx.lineTo(pt.x - 24, horizonY);
        ctx.moveTo(pt.x, horizonY - pt.h);
        ctx.lineTo(pt.x + 24, horizonY);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawSubwooferStack(ctx, x, y, w, h, accent, beatPulse) {
    ctx.save();
    ctx.fillStyle = '#0b0e1d';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    this.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    const cx = x + w * 0.5;
    for (const cy of [y + h * 0.28, y + h * 0.72]) {
      const r = 11 + beatPulse * 3.2;
      ctx.strokeStyle = '#ff2ec4';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx, cy, 4 + beatPulse * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPerspectiveHighway(ctx, W, H, game, t, beatFloat, beatPulse, track) {
    const horizonY = H * 0.33;
    const accent = game.overdriveActive ? '#ffd21f' : (track && track.accent) || '#00d4ff';

    // 1. Outrun Scrolling Perspective Floor Grid outside the Highway
    ctx.save();
    ctx.strokeStyle = game.overdriveActive
      ? 'rgba(255, 210, 31, 0.18)'
      : 'rgba(255, 46, 196, 0.15)';
    ctx.lineWidth = 1;
    // Radial vanishing lines
    for (let g = -12; g <= 16; g++) {
      if (g >= 0 && g <= LANES) continue;
      const pTop = this.project(g, 0);
      const pBot = this.project(g, 1.18);
      ctx.beginPath();
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBot.x, pBot.y);
      ctx.stroke();
    }
    // Scrolling horizontal floor scanlines
    const gridOffset = (beatFloat * 0.5) % 1;
    for (let s = 0; s < 10; s++) {
      const u = (s + gridOffset) / 10;
      const pt = this.project(0, u);
      const pR = this.project(LANES, u);
      ctx.strokeStyle = `rgba(0, 212, 255, ${(0.04 + u * 0.12).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, pt.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.moveTo(pR.x, pt.y);
      ctx.lineTo(W, pt.y);
      ctx.stroke();
    }
    ctx.restore();

    // 2. 4-Lane Highway Surface Trapezoid with Neon Side Bumper Bump-Rails
    const topL = this.project(0, 0);
    const topR = this.project(LANES, 0);
    const botL = this.project(0, 1.18);
    const botR = this.project(LANES, 1.18);

    const hwGrad = ctx.createLinearGradient(0, horizonY, 0, H);
    hwGrad.addColorStop(0, game.overdriveActive ? 'rgba(46, 16, 62, 0.94)' : 'rgba(9, 13, 28, 0.94)');
    hwGrad.addColorStop(0.85, 'rgba(6, 9, 20, 0.98)');
    hwGrad.addColorStop(1, 'rgba(3, 5, 12, 0.99)');

    ctx.fillStyle = hwGrad;
    ctx.beginPath();
    ctx.moveTo(topL.x, topL.y);
    ctx.lineTo(topR.x, topR.y);
    ctx.lineTo(botR.x, botR.y);
    ctx.lineTo(botL.x, botL.y);
    ctx.closePath();
    ctx.fill();

    // 3. Active Key-Hold Lane Laser Beams
    for (let lane = 0; lane < LANES; lane++) {
      if (game.laneHeld[lane]) {
        const lTop = this.project(lane, 0);
        const rTop = this.project(lane + 1, 0);
        const lBot = this.project(lane, 1.14);
        const rBot = this.project(lane + 1, 1.14);

        const beamGrad = ctx.createLinearGradient(0, horizonY, 0, H * 0.86);
        beamGrad.addColorStop(0, 'rgba(0,0,0,0)');
        beamGrad.addColorStop(1, LANE_COLORS[lane] + '44');
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

    // 4. Scrolling Beat / Measure Lines down the highway
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
        ? 'rgba(255, 255, 255, 0.28)'
        : 'rgba(148, 163, 184, 0.11)';
      ctx.lineWidth = isBar ? 2.0 : 1;
      ctx.beginPath();
      ctx.moveTo(leftPt.x, leftPt.y);
      ctx.lineTo(rightPt.x, rightPt.y);
      ctx.stroke();
    }

    // 5. Outer Glowing Metallic Chassis Rails, Scrolling Rail Chevrons & Inner Lane Dividers
    const railScroll = (beatFloat * 0.5) % 1;
    for (let c = 0; c < 8; c++) {
      const u = (c + railScroll) / 8;
      const pLOut = this.project(-0.18, u);
      const pLIn = this.project(0, u);
      const pRIn = this.project(LANES, u);
      const pROut = this.project(LANES + 0.18, u);
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.25 + u * 0.55;
      ctx.lineWidth = Math.max(1.5, 3.2 * pLIn.scale);
      ctx.beginPath();
      ctx.moveTo(pLOut.x, pLOut.y - 6 * pLIn.scale);
      ctx.lineTo(pLIn.x, pLIn.y);
      ctx.moveTo(pROut.x, pROut.y - 6 * pRIn.scale);
      ctx.lineTo(pRIn.x, pRIn.y);
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i <= LANES; i++) {
      const p0 = this.project(i, 0);
      const p1 = this.project(i, 1.18);
      const isOuter = i === 0 || i === LANES;
      ctx.save();
      if (isOuter) {
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3.5;
      } else {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.26)';
        ctx.lineWidth = 1.3;
      }
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.restore();
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

      if (tailDt < -0.12 || headDt > leadSec) continue;

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
          ribGrad.addColorStop(1, note.holding ? '#ffffffdd' : col + 'bb');

          ctx.fillStyle = ribGrad;
          ctx.beginPath();
          ctx.moveTo(pTailL.x, pTailL.y);
          ctx.lineTo(pTailR.x, pTailR.y);
          ctx.lineTo(pHeadR.x, pHeadR.y);
          ctx.lineTo(pHeadL.x, pHeadL.y);
          ctx.closePath();
          ctx.fill();

          const pHeadC = this.project(note.lane + 0.5, uHead);
          const pTailC = this.project(note.lane + 0.5, uTail);
          ctx.strokeStyle = note.holding ? '#ffffff' : col;
          ctx.lineWidth = Math.max(1.5, 3.2 * pHeadC.scale);
          ctx.beginPath();
          ctx.moveTo(pTailC.x, pTailC.y);
          ctx.lineTo(pHeadC.x, pHeadC.y);
          ctx.stroke();

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

      if (!note.judged && note.chord) {
        if (prevChordNote && Math.abs(prevChordNote.time - note.time) < 0.005) {
          const u = 1 - headDt / leadSec;
          if (u >= 0 && u <= 1.05) {
            const pA = this.project(prevChordNote.lane + 0.5, u);
            const pB = this.project(note.lane + 0.5, u);
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = Math.max(2.5, 5.5 * pA.scale);
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
      const h = Math.max(7, 24 * pL.scale);
      const bevelH = Math.max(2, 6 * pL.scale);
      const x = pL.x;
      const y = pL.y - h * 0.5;
      const color = game.overdriveActive ? '#ffd21f' : LANE_COLORS[note.lane];

      ctx.save();
      // Lower 3D bevel lip
      ctx.fillStyle = '#090d1a';
      this.roundRect(x, y + bevelH, w, h, Math.max(2, 6 * pL.scale));
      ctx.fill();

      // Main glowing note body
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 * pL.scale;
      this.roundRect(x, y, w, h, Math.max(2, 6 * pL.scale));
      ctx.fill();
      ctx.shadowBlur = 0;

      // Crisp white specular core bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        x + w * 0.14,
        y + h * 0.26,
        w * 0.72,
        Math.max(2, h * 0.34)
      );

      if (note.chord) {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.8;
        this.roundRect(x, y, w, h, Math.max(2, 6 * pL.scale));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawReceptorsAndFX(ctx, game, t) {
    const leftHit = this.project(0, 1.0);
    const rightHit = this.project(LANES, 1.0);

    // Glowing Receptor Strike Laser Bar
    ctx.fillStyle = 'rgba(0, 212, 255, 0.25)';
    ctx.fillRect(leftHit.x - 8, leftHit.y - 5, rightHit.x - leftHit.x + 16, 10);
    ctx.fillStyle = game.overdriveActive ? '#ffd21f' : '#00ffcc';
    ctx.fillRect(leftHit.x - 8, leftHit.y - 1.5, rightHit.x - leftHit.x + 16, 3);

    // 4 Molded 3D Arcade Receptor Keycaps (D F J K)
    for (let i = 0; i < LANES; i++) {
      const pL = this.project(i + 0.07, 1.0);
      const pR = this.project(i + 0.93, 1.0);
      const pC = this.project(i + 0.5, 1.0);
      const w = pR.x - pL.x;
      const h = 28;
      const pressed = game.laneHeld[i];
      const col = LANE_COLORS[i];
      const dy = pressed ? 3 : 0;

      ctx.save();
      // Key-well base shadow
      ctx.fillStyle = '#050811';
      this.roundRect(pL.x - 2, pC.y - h * 0.5 + 5, w + 4, h + 2, 7);
      ctx.fill();

      // Main 3D receptor cap
      ctx.fillStyle = pressed ? col + '66' : 'rgba(12, 18, 36, 0.92)';
      ctx.strokeStyle = pressed ? '#ffffff' : col;
      ctx.lineWidth = pressed ? 3 : 2.2;
      this.roundRect(pL.x, pC.y - h * 0.5 + dy, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Inner target slot bar
      ctx.fillStyle = pressed ? '#ffffff' : col + '88';
      ctx.fillRect(pL.x + w * 0.2, pC.y - 2 + dy, w * 0.6, 4);

      // Key Label Pill below receptor
      ctx.fillStyle = 'rgba(8, 12, 24, 0.9)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.4;
      this.roundRect(pC.x - 18, pC.y + 20, 36, 20, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pressed ? '#ffffff' : col;
      ctx.font = '800 12px "Orbitron", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LANE_LABELS[i], pC.x, pC.y + 30.5);
      ctx.restore();

      if (game.activeHolds[i] && game.laneHeld[i]) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = col;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(pC.x, pC.y, 10 + Math.sin(t * 28) * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Hit Flash Columns
    const nowMs = performance.now();
    this.flashes = this.flashes.filter((f) => nowMs - f.at < 190);
    for (const f of this.flashes) {
      const a = 1 - (nowMs - f.at) / 190;
      const pL = this.project(f.lane + 0.04, 0.68);
      const pR = this.project(f.lane + 0.96, 0.68);
      const bL = this.project(f.lane + 0.04, 1.04);
      const bR = this.project(f.lane + 0.96, 1.04);

      const grad = ctx.createLinearGradient(0, pL.y, 0, bL.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, f.color);

      ctx.save();
      ctx.globalAlpha = a * 0.58;
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
      sw.r += 3.0;
      sw.alpha -= 0.055;
      if (sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, sw.r * 1.4, sw.r * 0.55, 0, 0, Math.PI * 2);
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
    const cy = H * 0.50;

    if (game.combo >= 2) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 36px "Orbitron", monospace';
      ctx.fillStyle = game.overdriveActive ? '#ffd21f' : 'rgba(255, 255, 255, 0.90)';
      ctx.shadowColor = game.overdriveActive ? '#ffd21f' : '#00d4ff';
      ctx.shadowBlur = 12;
      ctx.fillText(`${game.combo}×`, cx, cy - 28);
      ctx.shadowBlur = 0;

      ctx.font = '700 10px "Orbitron", monospace';
      ctx.fillStyle = game.overdriveActive ? '#fde047' : '#94a3b8';
      ctx.fillText(game.overdriveActive ? '⚡ 2× OVERDRIVE FEVER ⚡' : 'COMBO STREAK', cx, cy - 8);
      ctx.restore();
    }

    if (game.combo === 0 && !game.lastJudgement) {
      const promptY = H * 0.78;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '800 12px "Orbitron", monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 12;
      ctx.fillText('STRIKE [D] [F] [J] [K] OR [ENTER] TO DROP THE BEAT', cx, promptY);
      ctx.shadowBlur = 0;
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
      ctx.fillText('LIVE HIGHWAY PREVIEW · HOLD RIBBONS · [SPACE] 2× OVERDRIVE', cx, promptY + 16);
      ctx.restore();
      return;
    }

    if (game.lastJudgement) {
      const age = performance.now() - game.lastJudgement.at;
      if (age < 560) {
        const a = Math.min(1, 1 - age / 560);
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
        ctx.font = '900 24px "Orbitron", monospace';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
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
          ctx.font = '600 11px "IBM Plex Mono", monospace';
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(`${sign}${j.offsetMs}ms ${tag}`, cx, cy + 43);

          // Center-Stage Early/Late Precision Tick Bar right on the highway
          const barW = 136;
          const barY = cy + 53;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
          ctx.fillRect(cx - barW * 0.5, barY, barW, 4);
          ctx.fillStyle = '#00ffcc';
          ctx.fillRect(cx - 20, barY, 40, 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(cx - 1, barY - 2, 2, 8);
          const offClamped = Math.max(-55, Math.min(55, j.offsetMs));
          const tickX = cx + (offClamped / 55) * (barW * 0.46);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.fillRect(tickX - 2, barY - 3, 4, 10);
          ctx.shadowBlur = 0;
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

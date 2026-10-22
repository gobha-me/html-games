import { CONE_DEGREES, fogReach, perception, hornRings } from './sim.js';
const RAD = Math.PI / 180;
const ORIGIN = { x: 640, y: 478 };
const SCALE = 0.86;
export const LAMP = Object.freeze({ x: 0, y: 0 });

export function beamOrigin(beamDegrees) {
  if (!Number.isFinite(beamDegrees)) throw new TypeError('Beam bearing must be finite.');
  return LAMP;
}

function chartTransform({ width, height }) {
  return {
    x: ORIGIN.x * width / 1280,
    y: ORIGIN.y * height / 720,
    scaleX: SCALE * width / 1280,
    scaleY: SCALE * height / 720,
  };
}

// Dimensions are backing pixels: callers include DPR when starting from CSS sizes.
export function toScreen(point, size) {
  const transform = chartTransform(size);
  return { x: transform.x + point.x * transform.scaleX, y: transform.y + point.y * transform.scaleY };
}

function disc(ctx, x, y, radius, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}
function cone(ctx, beam, reach) {
  const angle = (beam - 90) * RAD;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.arc(0, 0, reach, angle - CONE_DEGREES / 2 * RAD, angle + CONE_DEGREES / 2 * RAD);
  ctx.closePath();
}
function beamAndFog(ctx, state, reduced) {
  const reach = fogReach(state.fog);
  const origin = beamOrigin(state.beam);
  ctx.save(); ctx.translate(origin.x, origin.y);
  cone(ctx, state.beam, reach); ctx.clip();
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
  glow.addColorStop(0, 'rgba(255,223,158,0.68)');
  glow.addColorStop(0.12, 'rgba(240,205,132,0.26)');
  glow.addColorStop(0.58, 'rgba(202,180,130,0.13)');
  glow.addColorStop(1, 'rgba(202,184,143,0)');
  ctx.fillStyle = glow; ctx.fillRect(-reach, -reach, reach * 2, reach * 2);
  const drift = reduced ? 0 : state.time;
  // Deterministic layered banks: only the cone reveals their slow drift.
  for (let i = 0; i < 32; i++) {
    const x = Math.sin(i * 17.31 + drift * 0.012) * 470;
    const y = Math.cos(i * 5.77 + drift * 0.008) * 470;
    const radius = 24 + i % 5 * 16;
    const fog = ctx.createRadialGradient(x, y, 0, x, y, radius);
    fog.addColorStop(0, 'rgba(224,211,180,0.09)');
    fog.addColorStop(1, 'rgba(224,211,180,0)');
    disc(ctx, x, y, radius, fog);
  }
  // Crosswise haze breaks up the beam instead of outlining a flat triangle.
  ctx.strokeStyle = 'rgba(212,204,178,0.035)'; ctx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    const y = -430 + i * 54 + Math.sin(drift * 0.07 + i) * 12;
    ctx.ellipse(0, y, 480, 26, -0.12, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
function chart(ctx, hazards) {
  ctx.strokeStyle = '#202b2c'; ctx.fillStyle = '#58615c'; ctx.lineWidth = 0.7;
  ctx.font = '10px "Courier New", monospace'; ctx.textAlign = 'center';
  const radius = 452;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const a = (degrees - 90) * RAD, major = degrees % 30 === 0;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.lineTo(Math.cos(a) * (radius - (major ? 10 : 4)), Math.sin(a) * (radius - (major ? 10 : 4))); ctx.stroke();
    if (major) ctx.fillText(`${degrees === 0 ? 'N' : degrees.toString().padStart(3, '0')}`, Math.cos(a) * (radius + 16), Math.sin(a) * (radius + 16) + 3);
  }
  // These symbols are ink on the chart overlay, never rock silhouettes in unlit sea.
  ctx.setLineDash([2, 5]);
  for (const rock of hazards) {
    ctx.beginPath(); ctx.arc(rock.x, rock.y, rock.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    if (rock.kind === 'shoal') {
      ctx.moveTo(rock.x - 5, rock.y); ctx.lineTo(rock.x - 2, rock.y - 2);
      ctx.lineTo(rock.x + 2, rock.y + 2); ctx.lineTo(rock.x + 5, rock.y);
    } else if (rock.kind === 'wreck') {
      ctx.moveTo(rock.x - 5, rock.y - 2); ctx.lineTo(rock.x + 5, rock.y - 2);
      ctx.lineTo(rock.x + 2, rock.y + 3); ctx.lineTo(rock.x - 2, rock.y + 3); ctx.closePath();
    } else {
      ctx.moveTo(rock.x - 3, rock.y - 3); ctx.lineTo(rock.x + 3, rock.y + 3);
      ctx.moveTo(rock.x + 3, rock.y - 3); ctx.lineTo(rock.x - 3, rock.y + 3);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]); ctx.fillStyle = '#56605c';
  ctx.fillText('T H E  T E E T H', 264, -284);
  ctx.fillStyle = '#3b4643'; ctx.font = '9px "Courier New", monospace';
  ctx.fillText('CHARTED REEF · KEEP CLEAR', 266, -269);
}
function hull(ctx, pose, opacity) {
  ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.heading * RAD); ctx.globalAlpha = opacity;
  ctx.fillStyle = pose.status === 'wrecked' ? '#444941' : '#b0ad98';
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(7, -7); ctx.lineTo(8, 10);
  ctx.lineTo(-7, 10); ctx.lineTo(-7, -7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#303834'; ctx.fillRect(-4, -3, 8, 9);
  ctx.strokeStyle = '#d0c9ac'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 10); ctx.moveTo(-10, -2); ctx.lineTo(10, -2); ctx.stroke();
  if (pose.status === 'wrecked') {
    ctx.strokeStyle = '#060a0b'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(7, 6); ctx.stroke();
  }
  ctx.restore();
}
function runningLights(ctx, ship) {
  ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.heading * RAD);
  disc(ctx, -6, -4, 1.25, '#cf4842');
  disc(ctx, 6, -4, 1.25, '#62ac86');
  ctx.restore();
}
// Axis-aligned steps keep the original small island footprint and overhead view.
const SHORE = [
  [-48, 24], [-40, 24], [-40, 12], [-32, 12], [-32, 2], [-24, 2],
  [-24, -4], [-8, -4], [-8, -10], [8, -10], [8, -13], [16, -13],
  [16, -7], [28, -7], [28, 0], [38, 0], [38, 10], [44, 10],
  [44, 22], [51, 22], [51, 32], [43, 32], [43, 39], [31, 39],
  [31, 48], [15, 48], [15, 45], [-9, 45], [-9, 44], [-24, 44],
  [-24, 38], [-38, 38], [-38, 32], [-48, 32],
];

function pixelShape(ctx, points, colour) {
  ctx.fillStyle = colour; ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath(); ctx.fill();
}

function skerryRock(ctx, state, reduced) {
  pixelShape(ctx, SHORE, '#182427');
  // Four discrete surf phases: repeatable at a given simulation time, no clock/RNG.
  const phase = reduced ? 0 : Math.floor(state.time * 2) % 4;
  for (let i = 0; i < SHORE.length; i += 2) {
    const [x, y] = SHORE[i];
    const swell = (i / 2 + phase) % 4;
    ctx.fillStyle = swell === 0 ? '#52615b' : '#2b3c3e';
    ctx.fillRect(x - 2 - swell, y + swell, 5 + swell, 2);
  }
  pixelShape(ctx, [
    [-42, 23], [-34, 23], [-34, 9], [-22, 9], [-22, 1], [-5, 1],
    [-5, -6], [12, -6], [12, 0], [26, 0], [26, 7], [35, 7],
    [35, 18], [44, 18], [44, 31], [34, 31], [34, 39], [22, 39],
    [22, 43], [-20, 43], [-20, 36], [-34, 36], [-34, 29], [-42, 29],
  ], '#0e1517');
  pixelShape(ctx, [
    [-30, 16], [-23, 16], [-23, 5], [-9, 5], [-9, -1], [12, -1],
    [12, 5], [24, 5], [24, 12], [32, 12], [32, 27], [23, 27],
    [23, 34], [-20, 34], [-20, 28], [-30, 28],
  ], '#25302e');
  ctx.fillStyle = '#354039'; ctx.fillRect(-22, 8, 11, 3); ctx.fillRect(21, 15, 8, 3);
  ctx.fillStyle = '#19221f'; ctx.fillRect(-25, 25, 18, 4); ctx.fillRect(13, 29, 10, 3);
  ctx.fillStyle = '#101a1b'; ctx.fillRect(-16, 35, 11, 2); ctx.fillRect(34, 24, 6, 3);

  // Concentric masonry bands and a railed gallery, seen from above the lantern.
  ctx.save(); ctx.translate(LAMP.x, LAMP.y);
  pixelShape(ctx, [[-12, -10], [12, -10], [12, 10], [9, 10], [9, 19], [-9, 19], [-9, 10], [-12, 10]], '#131c1d');
  ctx.fillStyle = '#42493e'; ctx.fillRect(-9, -7, 18, 23);
  ctx.fillStyle = '#242d2c'; ctx.fillRect(-6, -4, 12, 17);
  ctx.fillStyle = '#5a5c49'; ctx.fillRect(-9, 7, 18, 3); ctx.fillRect(-8, 13, 16, 2);
  ctx.fillStyle = '#10191b'; ctx.fillRect(-15, -15, 30, 30);
  ctx.fillStyle = '#414b42'; ctx.fillRect(-14, -14, 28, 28);
  ctx.fillStyle = '#1e2928'; ctx.fillRect(-12, -12, 24, 24);
  ctx.fillStyle = '#65705b';
  for (const x of [-14, -2, 12]) {
    ctx.fillRect(x, -15, 2, 3); ctx.fillRect(x, 12, 2, 3);
  }
  ctx.fillRect(-15, -1, 3, 2); ctx.fillRect(12, -1, 3, 2);
  ctx.restore();
}

function lighthouse(ctx, beam, keyed) {
  ctx.save(); ctx.translate(LAMP.x, LAMP.y);
  ctx.fillStyle = '#6d7056'; ctx.fillRect(-9, -9, 18, 18);
  ctx.fillStyle = '#303c35'; ctx.fillRect(-7, -7, 14, 14);
  ctx.fillStyle = '#101a1b';
  for (const x of [-9, 7]) {
    ctx.fillRect(x, -9, 2, 2); ctx.fillRect(x, 7, 2, 2);
  }
  ctx.save(); ctx.rotate((beam - 90) * RAD);
  ctx.fillStyle = '#a18b5c'; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
  const glint = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
  glint.addColorStop(0, 'rgba(255,232,183,0.55)'); glint.addColorStop(1, 'rgba(255,232,183,0)');
  disc(ctx, 0, 0, 15, glint); disc(ctx, 0, 0, 2, '#fff0c9');
  if (keyed) {
    ctx.strokeStyle = '#fff0c9'; ctx.lineWidth = 2;
    ctx.strokeRect(-8, -8, 16, 16);
  }
  ctx.restore();
  ctx.font = '10px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#707974';
  ctx.fillText('S K E R R Y  R O C K', 0, 70);
}

function drawHornRings(ctx, state) {
  ctx.save();
  ctx.lineWidth = 2;
  for (const ring of hornRings(state)) {
    ctx.globalAlpha = ring.alpha * (ring.ignored ? 0.35 : 0.8);
    ctx.strokeStyle = '#d9c18a';
    ctx.setLineDash(ring.ignored ? [6, 8] : []);
    ctx.beginPath(); ctx.arc(0, 0, ring.radius, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  resize();
  return {
    resize,
    draw(state, reduced = false) {
      ctx.setTransform(canvas.width / 1280, 0, 0, canvas.height / 720, 0, 0);
      ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, 1280, 720);
      const transform = chartTransform(canvas);
      ctx.save(); ctx.setTransform(transform.scaleX, 0, 0, transform.scaleY, transform.x, transform.y);
      chart(ctx, state.hazards); skerryRock(ctx, state, reduced); beamAndFog(ctx, state, reduced);
      // All vessel drawing goes through the perception boundary.
      for (const ship of state.ships) {
        const view = perception(state, ship);
        if (view.hull) hull(ctx, view.hull, view.opacity);
        if (!ship.smuggler && (view.runningLights || (view.lit && ship.status !== 'wrecked'))) runningLights(ctx, ship);
        if (view.signal) {
          disc(ctx, ship.x, ship.y, 7, 'rgba(255,240,201,0.18)');
          disc(ctx, ship.x, ship.y, 3, '#fff0c9');
        }
      }
      drawHornRings(ctx, state);
      lighthouse(ctx, state.beam, state.lamp);
      ctx.restore();
    },
  };
}

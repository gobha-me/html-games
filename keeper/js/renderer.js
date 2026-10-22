import { CONE_DEGREES, fogReach, ROCKS, perception, hornRings } from './sim.js';
const RAD = Math.PI / 180;
const ORIGIN = { x: 640, y: 478 };
const SCALE = 0.86;

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
  ctx.save(); cone(ctx, state.beam, reach); ctx.clip();
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
function chart(ctx) {
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
  for (const rock of ROCKS) {
    ctx.beginPath(); ctx.arc(rock.x, rock.y, rock.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rock.x - 3, rock.y - 3); ctx.lineTo(rock.x + 3, rock.y + 3);
    ctx.moveTo(rock.x + 3, rock.y - 3); ctx.lineTo(rock.x - 3, rock.y + 3); ctx.stroke();
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
function lighthouse(ctx, beam) {
  ctx.fillStyle = '#0e1517';
  ctx.beginPath(); ctx.moveTo(-48, 28); ctx.lineTo(-25, -3); ctx.lineTo(7, -13);
  ctx.lineTo(37, 5); ctx.lineTo(51, 31); ctx.lineTo(23, 48); ctx.lineTo(-24, 44); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#202b2b'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#242d2c'; ctx.fillRect(-8, -3, 16, 22);
  ctx.fillStyle = '#3a4039'; ctx.fillRect(-9, -6, 18, 6);
  ctx.save(); ctx.rotate((beam - 90) * RAD);
  ctx.fillStyle = '#a18b5c'; ctx.fillRect(-3, -3, 10, 6); ctx.restore();
  const glint = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
  glint.addColorStop(0, 'rgba(255,232,183,0.55)'); glint.addColorStop(1, 'rgba(255,232,183,0)');
  disc(ctx, 0, 0, 15, glint); disc(ctx, 0, 0, 2, '#fff0c9');
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
      ctx.save(); ctx.translate(ORIGIN.x, ORIGIN.y); ctx.scale(SCALE, SCALE);
      chart(ctx); beamAndFog(ctx, state, reduced);
      // All vessel drawing goes through the perception boundary.
      for (const ship of state.ships) {
        const view = perception(state, ship);
        if (view.hull) hull(ctx, view.hull, view.opacity);
        if (!ship.smuggler && (view.runningLights || (view.lit && ship.status !== 'wrecked'))) runningLights(ctx, ship);
      }
      drawHornRings(ctx, state);
      lighthouse(ctx, state.beam);
      ctx.restore();
    },
  };
}

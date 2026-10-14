// sprites.js — Procedural 24/32-Bit Pixel Art Atlas + 2.5D Sobel Normal/Specular Map + Emissive Mask
(function (global) {
  'use strict';

  const ATLAS_SIZE = 512;
  const CELL = 64; // 8x8 grid of 64x64 pixel-art cells

  const SPRITE_CELLS = {
    floor_slate:     { col: 0, row: 0 },
    floor_vault:     { col: 1, row: 0 },
    floor_exec:      { col: 2, row: 0 },
    wall_bulkhead:   { col: 3, row: 0 },
    door_closed:     { col: 4, row: 0 },
    glass_wall:      { col: 5, row: 0 },
    server_rack:     { col: 6, row: 0 },
    exec_desk:       { col: 7, row: 0 },

    operative:       { col: 0, row: 1 },
    guard_patrol:    { col: 1, row: 1 },
    guard_heavy:     { col: 2, row: 1 },
    guard_exec:      { col: 3, row: 1 },
    turret_drone:    { col: 4, row: 1 },
    corpse_guard:    { col: 5, row: 1 },
    crate_cover:     { col: 6, row: 1 },
    elevator_pad:    { col: 7, row: 1 },
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function buildAtlases() {
    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = ATLAS_SIZE;
    albedoCanvas.height = ATLAS_SIZE;
    const aCtx = albedoCanvas.getContext('2d');
    const aImg = aCtx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
    const aData = aImg.data;

    const emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = ATLAS_SIZE;
    emissiveCanvas.height = ATLAS_SIZE;
    const eCtx = emissiveCanvas.getContext('2d');
    const eImg = eCtx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
    const eData = eImg.data;

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = ATLAS_SIZE;
    normalCanvas.height = ATLAS_SIZE;
    const nCtx = normalCanvas.getContext('2d');
    const nImg = nCtx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
    const nData = nImg.data;

    const heightBuf = new Float32Array(ATLAS_SIZE * ATLAS_SIZE);
    const specBuf = new Float32Array(ATLAS_SIZE * ATLAS_SIZE);

    function setPixel(cx, cy, lx, ly, r, g, b, a, h, spec, er, eg, eb) {
      if (lx < 0 || lx >= CELL || ly < 0 || ly >= CELL) return;
      const x = cx * CELL + lx;
      const y = cy * CELL + ly;
      const idx = y * ATLAS_SIZE + x;
      const p = idx * 4;
      aData[p]     = clamp(Math.round(r), 0, 255);
      aData[p + 1] = clamp(Math.round(g), 0, 255);
      aData[p + 2] = clamp(Math.round(b), 0, 255);
      aData[p + 3] = clamp(Math.round(a), 0, 255);
      heightBuf[idx] = clamp(h, 0, 1);
      specBuf[idx]   = clamp(spec, 0, 1);
      eData[p]     = clamp(Math.round(er || 0), 0, 255);
      eData[p + 1] = clamp(Math.round(eg || 0), 0, 255);
      eData[p + 2] = clamp(Math.round(eb || 0), 0, 255);
      eData[p + 3] = 255;
    }

    // 1. floor_slate (0,0) — Rich wet cyberpunk architectural slate tiles with beveled seams & puddles
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const tx = x % 32;
        const ty = y % 32;
        const mortar = tx === 0 || ty === 0 || tx === 31 || ty === 31;
        const bevel = tx === 1 || ty === 1 || tx === 30 || ty === 30;
        const n = ((x * 37 + y * 73) ^ (x * 13)) & 15;
        const puddle = Math.sin(x * 0.13 + y * 0.11) * Math.cos(x * 0.09 - y * 0.15) > 0.36;

        let r = 44 + n * 0.8;
        let g = 56 + n * 0.95;
        let b = 78 + n * 1.15;
        let h = mortar ? 0.05 : bevel ? 0.18 : 0.34 + (n / 15) * 0.08;
        let spec = puddle ? 0.92 : 0.45;
        let er = 0, eg = 0, eb = 0;

        if (mortar) {
          r = 22; g = 28; b = 40;
        } else if (bevel) {
          r = 34; g = 44; b = 62;
        } else if (puddle) {
          r += 8; g += 16; b += 26;
          h = 0.26;
        }
        // Subtle floor circuit inlay
        if (x === 32 && y > 14 && y < 50 && y % 6 < 3) {
          r = 20; g = 155; b = 190;
          er = 0; eg = 55; eb = 75;
        }
        setPixel(0, 0, x, y, r, g, b, 255, h, spec, er, eg, eb);
      }
    }

    // 2. floor_vault (1,0) — Brushed cryo-titanium industrial grating
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const border = x < 2 || y < 2 || x >= 62 || y >= 62;
        const tread = ((x + y) % 8 === 0 && (x - y + 64) % 8 < 4) || ((x - y + 64) % 8 === 0 && (x + y) % 8 < 4);
        let r = 46, g = 60, b = 82;
        let h = 0.28;
        let spec = 0.68;
        let er = 0, eg = 0, eb = 0;
        if (border) {
          r = 26; g = 34; b = 48; h = 0.08; spec = 0.30;
        } else if (tread) {
          r = 74; g = 94; b = 124; h = 0.48; spec = 0.95;
        }
        if (x === 31 && (y === 8 || y === 55)) {
          r = 0; g = 210; b = 245; er = 0; eg = 90; eb = 130;
        }
        setPixel(1, 0, x, y, r, g, b, 255, h, spec, er, eg, eb);
      }
    }

    // 3. floor_exec (2,0) — Executive penthouse crimson-obsidian marble with brass inlay
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const trim = (x === 0 || y === 0 || x === 31 || y === 31);
        const grain = ((x * 7 + y * 31) & 7) - 3;
        let r = 64 + grain * 1.4, g = 32 + grain, b = 48 + grain * 1.2;
        let h = 0.30;
        let spec = 0.62;
        if (trim) {
          r = 148; g = 114; b = 46; h = 0.40; spec = 0.95;
        }
        setPixel(2, 0, x, y, r, g, b, 255, h, spec, 0, 0, 0);
      }
    }

    // 4. wall_bulkhead (3,0) — Heavy 3D beveled steel bulkhead block with top armor plate & rivets
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const dEdge = Math.min(x, y, CELL - 1 - x, CELL - 1 - y);
        const h = clamp(0.40 + dEdge * 0.045, 0.40, 0.98);
        // Directional top-left highlight / bottom-right bevel for crisp 2.5D readability
        const bevelBias = ((CELL - x) + (CELL - y)) / (CELL * 2) * 28 - 14;
        let r = 74 + Math.min(dEdge, 14) * 3.2 + bevelBias;
        let g = 90 + Math.min(dEdge, 14) * 3.8 + bevelBias;
        let b = 118 + Math.min(dEdge, 14) * 4.4 + bevelBias;
        let spec = 0.85;
        let er = 0, eg = 0, eb = 0;

        if (dEdge < 2) {
          r = 32; g = 40; b = 56;
        } else if (dEdge === 4) {
          // Recessed neon cyan trim channel (subtle, not overpowering)
          r = 30; g = 195; b = 235;
          er = 0; eg = 85; eb = 115;
          spec = 1.0;
        } else if (dEdge > 11) {
          // Inner armored roof cap with diagonal rib pattern
          const rib = ((x + y) % 10) < 3;
          if (rib) {
            r -= 14; g -= 16; b -= 18;
          }
          // Corner rivets
          const rx = x === 15 || x === 48;
          const ry = y === 15 || y === 48;
          if (rx && ry) {
            r += 35; g += 38; b += 42;
          }
        }
        setPixel(3, 0, x, y, r, g, b, 255, h, spec, er, eg, eb);
      }
    }

    // 5. door_closed (4,0) — High-visibility hazard blast door with hydraulic bars
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        if (y < 14 || y > 49) {
          setPixel(4, 0, x, y, 0, 0, 0, 0, 0, 0, 0, 0, 0);
          continue;
        }
        const stripe = ((x + y) % 14) < 7;
        const border = y < 18 || y > 45 || x < 4 || x > 59;
        let r = stripe ? 235 : 46;
        let g = stripe ? 170 : 54;
        let b = stripe ? 24 : 68;
        let h = border ? 0.62 : 0.86;
        let spec = 0.85;
        let er = 0, eg = 0, eb = 0;
        if (border) {
          r = 88; g = 102; b = 126;
        }
        if (x > 26 && x < 38 && y > 26 && y < 38) {
          r = 255; g = 50; b = 120;
          er = 200; eg = 30; eb = 90;
        }
        setPixel(4, 0, x, y, r, g, b, 255, h, spec, er, eg, eb);
      }
    }

    // 6. glass_wall (5,0) — Translucent cyan architectural security glass
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        if (y < 20 || y > 43) {
          setPixel(5, 0, x, y, 0, 0, 0, 0, 0, 0, 0, 0, 0);
          continue;
        }
        const frame = x < 4 || x > 59 || y <= 21 || y >= 42;
        const glare = ((x + y * 2) % 17) < 4;
        let r = frame ? 90 : (glare ? 190 : 55);
        let g = frame ? 125 : (glare ? 250 : 210);
        let b = frame ? 155 : 255;
        let a = frame ? 255 : (glare ? 230 : 175);
        let h = frame ? 0.78 : 0.64;
        let er = frame ? 0 : 15;
        let eg = frame ? 30 : 110;
        let eb = frame ? 45 : 145;
        setPixel(5, 0, x, y, r, g, b, a, h, 0.98, er, eg, eb);
      }
    }

    // 7. server_rack (6,0) — Solid 3D cryo-server cabinet with status LEDs
    for (let y = 6; y < 58; y++) {
      for (let x = 8; x < 56; x++) {
        const edge = Math.min(x - 8, y - 6, 55 - x, 57 - y);
        let r = 56 + edge * 2.4;
        let g = 70 + edge * 2.8;
        let b = 96 + edge * 3.2;
        let h = clamp(0.50 + edge * 0.035, 0.50, 0.92);
        let er = 0, eg = 0, eb = 0;
        if (edge < 3) {
          r = 36; g = 46; b = 64;
        } else if (y % 7 === 0 && x > 14 && x < 50) {
          const led = (x % 8 < 5);
          if (led) {
            const isPink = ((x + y) % 16 === 0);
            r = isPink ? 255 : 0;
            g = isPink ? 65 : 240;
            b = isPink ? 155 : 255;
            er = r * 0.75; eg = g * 0.75; eb = b * 0.75;
          }
        }
        setPixel(6, 0, x, y, r, g, b, 255, h, 0.88, er, eg, eb);
      }
    }

    // 8. exec_desk (7,0) — Mahogany/chrome executive desk with glowing holo-blotter
    for (let y = 10; y < 54; y++) {
      for (let x = 6; x < 58; x++) {
        const border = x < 9 || x > 54 || y < 13 || y > 50;
        const holo = x > 20 && x < 44 && y > 22 && y < 42;
        let r = border ? 130 : (holo ? 30 : 96);
        let g = border ? 95  : (holo ? 195 : 54);
        let b = border ? 45  : (holo ? 235 : 68);
        let h = holo ? 0.72 : 0.58;
        let er = 0;
        let eg = holo ? 95 : 0;
        let eb = holo ? 135 : 0;
        setPixel(7, 0, x, y, r, g, b, 255, h, 0.85, er, eg, eb);
      }
    }

    // Helper for humanoid top-down 2.5D character sprites facing +X (East)
    function drawCharacter(cellCol, cellRow, cfg) {
      const cx = 28;
      const cy = 32;
      for (let y = 0; y < CELL; y++) {
        for (let x = 0; x < CELL; x++) {
          const dx = x - cx;
          const dy = y - cy;

          const coatRx = 13;
          const coatRy = cfg.wideShoulders ? 19 : 16;
          const coatDist = (dx * dx) / (coatRx * coatRx) + (dy * dy) / (coatRy * coatRy);

          const hdx = x - (cx + 2);
          const hdy = y - cy;
          const headDist = (hdx * hdx + hdy * hdy) / (8.2 * 8.2);

          const inGunArm = (x >= cx + 4 && x <= cx + 22 && y >= cy + 3 && y <= cy + 10);
          const inGunBarrel = (x >= cx + 16 && x <= cx + 33 && y >= cy + 4 && y <= cy + 8);
          const inLaserTip = (x >= cx + 30 && x <= cx + 33 && y >= cy + 5 && y <= cy + 7);
          const inLeftArm = (x >= cx + 2 && x <= cx + 17 && y >= cy - 11 && y <= cy - 3 && (x + y * 0.7 < cx + cy * 0.7 + 13));

          if (inLaserTip) {
            setPixel(cellCol, cellRow, x, y, cfg.visor[0], cfg.visor[1], cfg.visor[2], 255, 0.82, 1.0, cfg.visor[0], cfg.visor[1], cfg.visor[2]);
          } else if (inGunBarrel) {
            setPixel(cellCol, cellRow, x, y, 120, 138, 165, 255, 0.76, 0.95, 0, 0, 0);
          } else if (headDist <= 1.0) {
            const h = 0.74 + (1.0 - headDist) * 0.25;
            const isVisor = (hdx >= 2.5 && Math.abs(hdy) <= 4.6);
            if (isVisor) {
              setPixel(cellCol, cellRow, x, y, cfg.visor[0], cfg.visor[1], cfg.visor[2], 255, h + 0.03, 1.0, cfg.visor[0], cfg.visor[1], cfg.visor[2]);
            } else {
              const shade = 0.85 + (1.0 - headDist) * 0.30;
              setPixel(cellCol, cellRow, x, y, cfg.head[0] * shade, cfg.head[1] * shade, cfg.head[2] * shade, 255, h, 0.80, 0, 0, 0);
            }
          } else if (coatDist <= 1.0 || inGunArm || inLeftArm) {
            const normD = coatDist <= 1.0 ? coatDist : 0.65;
            const h = 0.40 + (1.0 - normD) * 0.38;
            const trim = Math.abs(coatDist - 0.84) < 0.15 || (Math.abs(dy) > 10 && Math.abs(dx) < 3.5);
            const col = trim ? cfg.trim : cfg.coat;
            const shade = 0.82 + (1.0 - normD) * 0.35;
            const er = trim ? cfg.trim[0] * 0.45 : cfg.coat[0] * 0.12;
            const eg = trim ? cfg.trim[1] * 0.45 : cfg.coat[1] * 0.12;
            const eb = trim ? cfg.trim[2] * 0.45 : cfg.coat[2] * 0.12;
            setPixel(cellCol, cellRow, x, y, col[0] * shade, col[1] * shade, col[2] * shade, 255, h, cfg.spec, er, eg, eb);
          }
        }
      }
    }

    // 9. Operative (0,1) — Midnight-cobalt cyber trenchcoat + glowing cyan pauldrons & visor
    drawCharacter(0, 1, {
      coat: [68, 92, 134],
      trim: [0, 235, 255],
      head: [95, 118, 155],
      visor: [0, 250, 255],
      spec: 0.90,
      wideShoulders: false,
    });

    // 10. Guard Patrol (1,1) — EuroCorp white/steel carapace armor + amber visor
    drawCharacter(1, 1, {
      coat: [195, 210, 232],
      trim: [255, 165, 25],
      head: [130, 148, 175],
      visor: [255, 185, 0],
      spec: 0.82,
      wideShoulders: false,
    });

    // 11. Guard Heavy (2,1) — Crimson juggernaut ballistic armor + red visor
    drawCharacter(2, 1, {
      coat: [165, 48, 68],
      trim: [255, 55, 95],
      head: [115, 42, 56],
      visor: [255, 40, 70],
      spec: 0.92,
      wideShoulders: true,
    });

    // 12. Guard Exec HVT (3,1) — Syndicate Director in royal violet/gold cyber-suit
    drawCharacter(3, 1, {
      coat: [155, 52, 175],
      trim: [255, 215, 65],
      head: [240, 200, 110],
      visor: [255, 65, 220],
      spec: 0.95,
      wideShoulders: false,
    });

    // 13. Turret Drone (4,1) — Armored rotary sentry turret
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const dx = x - 30;
        const dy = y - 32;
        const r2 = dx * dx + dy * dy;
        const barrel = x >= 34 && x <= 58 && Math.abs(dy) <= 5 && Math.abs(dy) >= 2;
        if (barrel) {
          setPixel(4, 1, x, y, 120, 138, 165, 255, 0.78, 0.95, 0, 0, 0);
        } else if (r2 <= 196) {
          const h = 0.48 + (1 - r2 / 196) * 0.45;
          const eye = r2 <= 30 && dx > 0;
          if (eye) {
            setPixel(4, 1, x, y, 255, 45, 80, 255, 0.95, 1.0, 255, 45, 80);
          } else {
            setPixel(4, 1, x, y, 105, 122, 148, 255, h, 0.88, 0, 0, 0);
          }
        }
      }
    }

    // 14. Corpse Guard (5,1) — Downed sparking cyborg silhouette
    for (let y = 14; y < 50; y++) {
      for (let x = 8; x < 56; x++) {
        const dx = (x - 32) / 20;
        const dy = (y - 32) / 11;
        if (dx * dx + dy * dy <= 1.0) {
          const spark = (x * 19 + y * 31) % 29 === 0;
          setPixel(
            5, 1, x, y,
            spark ? 0 : 75,
            spark ? 235 : 52,
            spark ? 255 : 78,
            240,
            0.30,
            0.65,
            0,
            spark ? 200 : 0,
            spark ? 255 : 0
          );
        }
      }
    }

    // 15. Elevator Extraction Pad (7,1) — Glowing emerald extraction zone
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const dEdge = Math.min(x, y, CELL - 1 - x, CELL - 1 - y);
        const ring = dEdge >= 4 && dEdge <= 7;
        const chevron = Math.abs((x - 32) + Math.abs(y - 32) - 10) < 3;
        let r = 28, g = 68, b = 58;
        let er = 0, eg = 0, eb = 0;
        if (ring || chevron) {
          r = 0; g = 255; b = 157;
          er = 0; eg = 165; eb = 105;
        }
        setPixel(7, 1, x, y, r, g, b, 255, ring ? 0.40 : 0.26, 0.85, er, eg, eb);
      }
    }

    // Compute 2.5D Tangent-Space Normal Map via cell-clamped 3x3 Sobel filter
    const strength = 5.5;
    for (let cy = 0; cy < 8; cy++) {
      for (let cx = 0; cx < 8; cx++) {
        for (let ly = 0; ly < CELL; ly++) {
          for (let lx = 0; lx < CELL; lx++) {
            const x = cx * CELL + lx;
            const y = cy * CELL + ly;
            const idx = y * ATLAS_SIZE + x;
            const p = idx * 4;

            const sampleH = (ox, oy) => {
              const sx = clamp(lx + ox, 0, CELL - 1) + cx * CELL;
              const sy = clamp(ly + oy, 0, CELL - 1) + cy * CELL;
              return heightBuf[sy * ATLAS_SIZE + sx];
            };

            const tl = sampleH(-1, -1), tc = sampleH(0, -1), tr = sampleH(1, -1);
            const ml = sampleH(-1,  0),                      mr = sampleH(1,  0);
            const bl = sampleH(-1,  1), bc = sampleH(0,  1), br = sampleH(1,  1);

            const dX = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
            const dY = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

            let nx = -dX * strength;
            let ny = -dY * strength;
            let nz = 1.0;
            const len = Math.hypot(nx, ny, nz) || 1.0;
            nx /= len; ny /= len; nz /= len;

            nData[p]     = clamp(Math.round((nx * 0.5 + 0.5) * 255), 0, 255);
            nData[p + 1] = clamp(Math.round((ny * 0.5 + 0.5) * 255), 0, 255);
            nData[p + 2] = clamp(Math.round((nz * 0.5 + 0.5) * 255), 0, 255);
            nData[p + 3] = clamp(Math.round(specBuf[idx] * 255), 0, 255);
          }
        }
      }
    }

    aCtx.putImageData(aImg, 0, 0);
    nCtx.putImageData(nImg, 0, 0);
    eCtx.putImageData(eImg, 0, 0);

    return {
      ATLAS_SIZE,
      CELL,
      SPRITE_CELLS,
      albedoCanvas,
      normalCanvas,
      emissiveCanvas,
      getUV(name) {
        const c = SPRITE_CELLS[name] || SPRITE_CELLS.floor_slate;
        return {
          u0: (c.col * CELL) / ATLAS_SIZE,
          v0: (c.row * CELL) / ATLAS_SIZE,
          u1: ((c.col + 1) * CELL) / ATLAS_SIZE,
          v1: ((c.row + 1) * CELL) / ATLAS_SIZE,
          px: c.col * CELL,
          py: c.row * CELL,
        };
      },
    };
  }

  global.BreachSprites = { buildAtlases };
})(window);

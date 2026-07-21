'use strict';
/* =====================================================================
   DEAD DISTRICT — top-down survival horror shooter (18+)
   All art/audio assets generated with Venice.ai
   ===================================================================== */

// ---------------------------------------------------------------- setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- assets
const IMG = {}, SND = {};
const IMG_SRC = {
  player:  'assets/img/player.png',
  zombie:  'assets/img/zombie.png',
  brute:   'assets/img/brute.png',
  blood:   'assets/img/blood.png',
  pickup:  'assets/img/pickup.png',
  ground:  'assets/img/ground.png',
};
const SND_SRC = {
  shotgun:      'assets/audio/shotgun.mp3',
  zombieDeath:  'assets/audio/zombie_death.mp3',
  groan:        'assets/audio/groan.mp3',
  hit:          'assets/audio/hit.mp3',
  shell:        'assets/audio/shell.mp3',
  music:        'assets/audio/music.mp3',
};

let muted = false, audioUnlocked = false;

function loadImages(cb) {
  const keys = Object.keys(IMG_SRC);
  let done = 0;
  keys.forEach(k => {
    const im = new Image();
    im.onload = () => { done++; if (done === keys.length) cb(); };
    im.onerror = () => { done++; if (done === keys.length) cb(); };
    im.src = IMG_SRC[k];
    IMG[k] = im;
  });
}
function loadSounds() {
  Object.keys(SND_SRC).forEach(k => {
    const a = new Audio(SND_SRC[k]);
    a.preload = 'auto';
    SND[k] = a;
  });
  SND.music.loop = true;
  SND.music.volume = 0.42;
}
function play(name, vol = 1, rate = 1) {
  if (muted || !audioUnlocked || !SND[name]) return;
  try {
    const a = SND[name].cloneNode();
    a.volume = clamp(vol, 0, 1);
    a.playbackRate = rate;
    a.play().catch(() => {});
  } catch (e) {}
}
function startMusic() {
  if (!audioUnlocked) return;
  SND.music.muted = muted;
  SND.music.play().catch(() => {});
}

// ---------------------------------------------------------------- input
const keys = {};
const mouse = { x: W / 2, y: H / 2, down: false };
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
  if (e.key.toLowerCase() === 'm') toggleMute();
  if (e.key.toLowerCase() === 'p') togglePause();
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
window.addEventListener('mouseup', () => mouse.down = false);
canvas.addEventListener('contextmenu', e => e.preventDefault());

function toggleMute() {
  muted = !muted;
  $('mute').textContent = muted ? '🔇' : '🔊';
  if (SND.music) SND.music.muted = muted;
}

// ---------------------------------------------------------------- world
const WORLD = { w: 2600, h: 2600 };
const TILE = 512;

// decor: wrecked cars & barricades (drawn as vector shapes over asphalt)
const decor = [];
(function buildDecor() {
  const spots = [
    [400, 500], [900, 1900], [1500, 700], [2100, 1500], [600, 1400],
    [1800, 2200], [2300, 600], [1100, 1100], [300, 2100], [2000, 300],
  ];
  const cols = ['#3d2f2a', '#2c3a3d', '#41322c', '#333a2c', '#3a2c38', '#413a2c'];
  spots.forEach(([x, y], i) => {
    decor.push({ x, y, a: rand(0, Math.PI * 2), c: cols[i % cols.length], w: rand(110, 150), h: rand(55, 70), type: 'car' });
  });
  for (let i = 0; i < 14; i++) {
    const r = rand(18, 42), blobs = [];
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2;
      blobs.push({ ox: Math.cos(a) * r * 0.5, oy: Math.sin(a) * r * 0.4, br: r * rand(0.3, 0.55) });
    }
    decor.push({ x: rand(150, WORLD.w - 150), y: rand(150, WORLD.h - 150), a: rand(0, Math.PI * 2), type: 'rubble', r, blobs });
  }
})();

// ---------------------------------------------------------------- state
const S = { AGE: 0, MENU: 1, PLAY: 2, PAUSE: 3, OVER: 4 };
let state = S.AGE;

const player = {
  x: WORLD.w / 2, y: WORLD.h / 2, r: 20, a: 0,
  hp: 100, maxHp: 100, speed: 240,
  fireCd: 0, spread: 0.14, pellets: 7, dmg: 34,
  hurtT: 0,
};
const cam = { x: 0, y: 0, shake: 0, sx: 0, sy: 0 };
let zombies = [], bloods = [], particles = [], pickups = [], floaters = [], casings = [];
let score = 0, kills = 0, wave = 0, waveT = 0, betweenT = 3, spawnQueue = 0, spawnT = 0;
let elapsed = 0, gameTime = 0, lastGroan = 0;
let groundPattern = null;

// ---------------------------------------------------------------- sprites
// All sprites were generated facing UP (top-down), so drawn rotation = angle - PI/2
function drawSprite(img, x, y, w, h, angle, alpha = 1) {
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.save();
  ctx.translate(x - cam.x + cam.sx, y - cam.y + cam.sy);
  ctx.rotate(angle - Math.PI / 2);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// drop shadow under characters
function shadow(x, y, r) {
  ctx.save();
  ctx.translate(x - cam.x + cam.sx, y - cam.y + cam.sy);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(4, 8, r, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- spawning
function edgeSpawnPos() {
  const m = 60, side = randInt(0, 3);
  // spawn just outside the current camera view but inside the world
  const vw = { l: cam.x - m, r: cam.x + W + m, t: cam.y - m, b: cam.y + H + m };
  let x, y;
  if (side === 0)      { x = rand(vw.l, vw.r); y = vw.t; }
  else if (side === 1) { x = rand(vw.l, vw.r); y = vw.b; }
  else if (side === 2) { x = vw.l; y = rand(vw.t, vw.b); }
  else                 { x = vw.r; y = rand(vw.t, vw.b); }
  return { x: clamp(x, 40, WORLD.w - 40), y: clamp(y, 40, WORLD.h - 40) };
}

function spawnZombie(forceType) {
  const p = edgeSpawnPos();
  let type = forceType;
  if (!type) {
    const roll = Math.random();
    const bruteChance = clamp(0.04 + wave * 0.022, 0, 0.32);
    const runnerChance = clamp(0.12 + wave * 0.03, 0, 0.45);
    type = roll < bruteChance ? 'brute' : roll < bruteChance + runnerChance ? 'runner' : 'walker';
  }
  const base = {
    walker: { hp: 60 + wave * 8,  speed: rand(52, 74) + wave * 2.2,  r: 19, size: rand(58, 70),  dmg: 9,  score: 10, img: 'zombie' },
    runner: { hp: 34 + wave * 5,  speed: rand(128, 158) + wave * 3,  r: 16, size: rand(50, 60),  dmg: 7,  score: 15, img: 'zombie' },
    brute:  { hp: 260 + wave * 34, speed: rand(30, 40) + wave * 1.2, r: 30, size: rand(96, 112), dmg: 22, score: 40, img: 'brute'  },
  }[type];
  zombies.push({
    ...base, type, x: p.x, y: p.y,
    maxHp: base.hp,
    a: rand(0, Math.PI * 2),
    atkCd: 0, hitT: 0, wob: rand(0, Math.PI * 2), wobS: rand(2, 4),
    tint: type === 'runner' ? 'rgba(255,120,90,0.28)' : null,
  });
}

function spawnPickup(x, y) {
  pickups.push({ x, y, r: 22, t: 0, life: 14 });
}

function spawnBlood(x, y, big) {
  bloods.push({
    x, y, s: big ? rand(120, 190) : rand(55, 110),
    a: rand(0, Math.PI * 2), alpha: 0.92,
  });
  if (bloods.length > 90) bloods.shift();
}

function spawnGore(x, y, n, pow) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, pow);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.3, 0.9), t: 0, r: rand(1.5, 4.5),
      c: Math.random() < 0.8 ? `rgb(${randInt(120, 200)},${randInt(4, 22)},${randInt(4, 18)})` : '#3a0d05',
    });
  }
}

function spawnCasing(x, y, a) {
  casings.push({ x, y, vx: Math.cos(a) * rand(90, 150), vy: Math.sin(a) * rand(90, 150), t: 0, life: rand(2.5, 4), a: rand(0, 7), va: rand(-12, 12) });
  if (casings.length > 30) casings.shift();
}

function floater(x, y, txt, c) {
  floaters.push({ x, y, txt, c, t: 0 });
}

// ---------------------------------------------------------------- combat
function shoot() {
  player.fireCd = 0.45;
  cam.shake = Math.min(cam.shake + 9, 14);
  play('shotgun', 0.85, rand(0.95, 1.05));
  setTimeout(() => play('shell', 0.5, rand(0.9, 1.1)), 260);

  const mz = 46;
  const mx = player.x + Math.cos(player.a) * mz;
  const my = player.y + Math.sin(player.a) * mz;
  spawnCasing(player.x, player.y, player.a + Math.PI / 2);

  for (let i = 0; i < player.pellets; i++) {
    const a = player.a + rand(-player.spread, player.spread);
    const range = rand(430, 560);
    const step = 8;
    let hitSomething = false;
    for (let d = step; d <= range; d += step) {
      const px = mx + Math.cos(a) * d, py = my + Math.sin(a) * d;
      for (const z of zombies) {
        if (z.hp > 0 && dist2(px, py, z.x, z.y) < (z.r + 3) * (z.r + 3)) {
          damageZombie(z, player.dmg * rand(0.8, 1.25), a);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) break;
      // faint tracer spark near the muzzle
      if (d < 120 && Math.random() < 0.25) {
        particles.push({ x: px, y: py, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.12, t: 0, r: 1.4, c: 'rgba(255,190,90,0.9)' });
      }
    }
  }
  // muzzle flash
  muzzle = { x: mx, y: my, t: 0.06 };
}
let muzzle = null;

function damageZombie(z, dmg, shotA) {
  z.hp -= dmg;
  z.hitT = 0.12;
  z.x += Math.cos(shotA) * 6;
  z.y += Math.sin(shotA) * 6;
  spawnGore(z.x, z.y, 6, 160);
  play('hit', 0.55, rand(0.85, 1.2));
  if (z.hp <= 0) killZombie(z);
}

function killZombie(z) {
  kills++;
  score += z.score;
  floater(z.x, z.y - 20, '+' + z.score, '#d8b13c');
  spawnBlood(z.x, z.y, z.type === 'brute');
  spawnGore(z.x, z.y, z.type === 'brute' ? 34 : 18, z.type === 'brute' ? 300 : 220);
  play('zombieDeath', 0.7, rand(0.85, 1.15));
  if (Math.random() < (z.type === 'brute' ? 0.5 : 0.085)) spawnPickup(z.x, z.y);
  z.dead = true;
}

function hurtPlayer(dmg, srcA) {
  if (player.hurtT > 0) return;
  player.hurtT = 0.6;
  player.hp -= dmg;
  cam.shake = Math.min(cam.shake + 12, 20);
  $('dmgFlash').classList.remove('on');
  void $('dmgFlash').offsetWidth;
  $('dmgFlash').classList.add('on');
  $('vignette').classList.add('hurt');
  setTimeout(() => $('vignette').classList.remove('hurt'), 220);
  spawnGore(player.x, player.y, 8, 140);
  play('hit', 0.8, 0.7);
  if (srcA !== undefined) {
    player.x += Math.cos(srcA) * 14;
    player.y += Math.sin(srcA) * 14;
  }
  if (player.hp <= 0) { player.hp = 0; gameOver(); }
}

// ---------------------------------------------------------------- waves
function nextWave() {
  wave++;
  waveT = 0;
  spawnQueue = Math.min(4 + wave * 2, 34);
  spawnT = 0;
  floater(player.x, player.y - 60, 'WAVE ' + wave, '#c81e1e');
  if (wave % 3 === 0) spawnZombie('brute');
}

// ---------------------------------------------------------------- flow
function resetGame() {
  player.x = WORLD.w / 2; player.y = WORLD.h / 2;
  player.hp = player.maxHp; player.fireCd = 0; player.hurtT = 0;
  zombies = []; bloods = []; particles = []; pickups = []; floaters = []; casings = [];
  score = 0; kills = 0; wave = 0; betweenT = 0.8; spawnQueue = 0;
  gameTime = 0; cam.shake = 0; muzzle = null;
}

function startGame() {
  audioUnlocked = true;
  resetGame();
  state = S.PLAY;
  $('menu').classList.add('hidden');
  $('gameover').classList.add('hidden');
  $('hud').classList.remove('hidden');
  startMusic();
}

function gameOver() {
  state = S.OVER;
  spawnBlood(player.x, player.y, true);
  spawnGore(player.x, player.y, 40, 320);
  const hs = +(localStorage.getItem('dd_hiscore') || 0);
  if (score > hs) localStorage.setItem('dd_hiscore', score);
  $('goScore').textContent = score;
  $('goKills').textContent = kills;
  $('goWave').textContent = wave;
  const t = Math.floor(gameTime);
  $('goTime').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  const causes = [
    'The horde dragged you down.',
    'Torn apart in the dark.',
    'The district feeds tonight.',
    'You bled out on cold asphalt.',
    'They were hungrier than you were lucky.',
  ];
  $('goCause').textContent = causes[randInt(0, causes.length - 1)];
  setTimeout(() => { $('gameover').classList.remove('hidden'); $('hud').classList.add('hidden'); }, 900);
}

function togglePause() {
  if (state === S.PLAY) { state = S.PAUSE; $('pause').classList.remove('hidden'); SND.music.pause(); }
  else if (state === S.PAUSE) { state = S.PLAY; $('pause').classList.add('hidden'); startMusic(); }
}

// ---------------------------------------------------------------- update
function update(dt) {
  elapsed += dt;

  // --- player movement
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (dx || dy) {
    const l = Math.hypot(dx, dy);
    player.x += (dx / l) * player.speed * dt;
    player.y += (dy / l) * player.speed * dt;
  }
  player.x = clamp(player.x, 30, WORLD.w - 30);
  player.y = clamp(player.y, 30, WORLD.h - 30);

  // --- aim (world space)
  const wx = mouse.x + cam.x - cam.sx, wy = mouse.y + cam.y - cam.sy;
  player.a = Math.atan2(wy - player.y, wx - player.x);

  // --- fire
  player.fireCd -= dt;
  player.hurtT -= dt;
  if (mouse.down && player.fireCd <= 0) shoot();

  // --- camera
  cam.x = clamp(player.x - W / 2, 0, WORLD.w - W);
  cam.y = clamp(player.y - H / 2, 0, WORLD.h - H);
  if (WORLD.w < W) cam.x = (WORLD.w - W) / 2;
  if (WORLD.h < H) cam.y = (WORLD.h - H) / 2;
  cam.shake = Math.max(0, cam.shake - dt * 34);
  cam.sx = rand(-cam.shake, cam.shake);
  cam.sy = rand(-cam.shake, cam.shake);

  // --- waves & spawning
  waveT += dt;
  if (spawnQueue > 0) {
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnZombie();
      spawnQueue--;
      spawnT = clamp(1.35 - wave * 0.07, 0.32, 1.35) * rand(0.7, 1.3);
    }
  } else if (zombies.length === 0) {
    betweenT -= dt;
    if (betweenT <= 0) { nextWave(); betweenT = 4.2; }
  }

  // --- zombies
  for (const z of zombies) {
    if (z.dead) continue;
    z.wob += dt * z.wobS;
    const ta = Math.atan2(player.y - z.y, player.x - z.x);
    // wobble lurch toward player
    z.a = ta + Math.sin(z.wob) * 0.28;
    const sp = z.speed * (z.hitT > 0 ? 0.35 : 1);
    z.x += Math.cos(z.a) * sp * dt;
    z.y += Math.sin(z.a) * sp * dt;
    z.hitT -= dt;
    z.atkCd -= dt;

    // separation (cheap, sampled)
    for (const o of zombies) {
      if (o === z || o.dead) continue;
      const d2 = dist2(z.x, z.y, o.x, o.y);
      const min = (z.r + o.r) * 0.8;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (min - d) / d * 0.5;
        z.x += (z.x - o.x) * push; z.y += (z.y - o.y) * push;
      }
    }

    // attack
    if (dist2(z.x, z.y, player.x, player.y) < (z.r + player.r + 6) ** 2 && z.atkCd <= 0) {
      z.atkCd = 1.0;
      hurtPlayer(z.dmg, Math.atan2(player.y - z.y, player.x - z.x));
    }
  }
  zombies = zombies.filter(z => !z.dead);

  // ambient groans
  if (elapsed - lastGroan > rand(3.5, 7) && zombies.length) {
    lastGroan = elapsed;
    play('groan', rand(0.25, 0.5), rand(0.8, 1.25));
  }

  // --- pickups
  for (const p of pickups) {
    p.t += dt; p.life -= dt;
    if (dist2(p.x, p.y, player.x, player.y) < (p.r + player.r) ** 2) {
      const heal = randInt(18, 30);
      player.hp = clamp(player.hp + heal, 0, player.maxHp);
      floater(player.x, player.y - 34, '+' + heal + ' HP', '#5ad05a');
      p.life = 0;
      play('shell', 0.6, 1.4);
    }
  }
  pickups = pickups.filter(p => p.life > 0);

  // --- particles / casings / floaters
  for (const pt of particles) {
    pt.t += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.9; pt.vy *= 0.9;
  }
  particles = particles.filter(p => p.t < p.life);
  for (const c of casings) {
    c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt;
    c.vx *= 0.86; c.vy *= 0.86; c.a += c.va * dt;
  }
  casings = casings.filter(c => c.t < c.life);
  for (const f of floaters) { f.t += dt; f.y -= 42 * dt; }
  floaters = floaters.filter(f => f.t < 1.3);

  if (muzzle) { muzzle.t -= dt; if (muzzle.t <= 0) muzzle = null; }
  // regen a sliver of health between kills so long runs are possible
  if (player.hp < player.maxHp && player.hurtT <= 0 && zombies.length === 0) {
    player.hp = clamp(player.hp + 6 * dt, 0, player.maxHp);
  }
  gameTime += dt;

  // --- HUD
  const hpPct = clamp(player.hp / player.maxHp * 100, 0, 100);
  $('healthBar').style.width = hpPct + '%';
  $('healthText').textContent = Math.ceil(player.hp);
  $('ammo').textContent = '∞';
  $('score').textContent = score;
  $('wave').textContent = 'WAVE ' + Math.max(wave, 1);
}

// ---------------------------------------------------------------- render
function render() {
  ctx.clearRect(0, 0, W, H);

  // ground
  if (!groundPattern && IMG.ground.complete && IMG.ground.naturalWidth) {
    groundPattern = ctx.createPattern(IMG.ground, 'repeat');
  }
  ctx.save();
  ctx.translate(-cam.x + cam.sx, -cam.y + cam.sy);
  if (groundPattern) {
    ctx.fillStyle = groundPattern;
    ctx.fillRect(cam.x - cam.sx, cam.y - cam.sy, W, H);
  } else {
    ctx.fillStyle = '#191919';
    ctx.fillRect(cam.x - cam.sx, cam.y - cam.sy, W, H);
  }
  // world edge
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
  ctx.restore();

  // decor (rubble then cars)
  for (const d of decor) {
    if (d.x < cam.x - 200 || d.x > cam.x + W + 200 || d.y < cam.y - 200 || d.y > cam.y + H + 200) continue;
    ctx.save();
    ctx.translate(d.x - cam.x + cam.sx, d.y - cam.y + cam.sy);
    ctx.rotate(d.a);
    if (d.type === 'car') {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(-d.w / 2 + 5, -d.h / 2 + 7, d.w, d.h);
      ctx.fillStyle = d.c;
      ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      ctx.fillStyle = 'rgba(15,20,24,.85)';
      ctx.fillRect(-d.w * 0.22, -d.h / 2 + 5, d.w * 0.32, d.h - 10); // cabin
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(-d.w / 2 + 4, -d.h / 2 + 4, 10, d.h - 8);          // crushed hood
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
      ctx.strokeRect(-d.w / 2, -d.h / 2, d.w, d.h);
    } else {
      ctx.fillStyle = 'rgba(10,10,10,.7)';
      for (const b of d.blobs) {
        ctx.beginPath();
        ctx.arc(b.ox, b.oy, b.br, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // blood decals
  for (const b of bloods) {
    if (b.x < cam.x - 220 || b.x > cam.x + W + 220 || b.y < cam.y - 220 || b.y > cam.y + H + 220) continue;
    ctx.save();
    ctx.translate(b.x - cam.x + cam.sx, b.y - cam.y + cam.sy);
    ctx.rotate(b.a);
    ctx.globalAlpha = b.alpha;
    if (IMG.blood.complete && IMG.blood.naturalWidth) ctx.drawImage(IMG.blood, -b.s / 2, -b.s / 2, b.s, b.s);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // casings
  for (const c of casings) {
    ctx.save();
    ctx.translate(c.x - cam.x + cam.sx, c.y - cam.y + cam.sy);
    ctx.rotate(c.a);
    ctx.globalAlpha = clamp(1.4 - c.t / c.life, 0, 1);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(-4, -1.6, 8, 3.2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // pickups
  for (const p of pickups) {
    const bob = Math.sin(p.t * 4) * 3;
    const blink = p.life < 3 ? (Math.sin(p.t * 14) > 0 ? 1 : 0.25) : 1;
    shadow(p.x, p.y + bob, 18);
    ctx.save();
    ctx.globalAlpha = blink * 0.5;
    ctx.fillStyle = '#5ad05a';
    ctx.beginPath();
    ctx.arc(p.x - cam.x + cam.sx, p.y - cam.y + cam.sy + bob, 26 + Math.sin(p.t * 4) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawSprite(IMG.pickup, p.x, p.y + bob, 46, 46, Math.PI / 2, blink);
  }

  // zombies
  for (const z of zombies) {
    shadow(z.x, z.y, z.r * 1.1);
    drawSprite(IMG[z.img], z.x, z.y, z.size, z.size, z.a);
    if (z.hitT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = z.hitT * 4;
      drawSprite(IMG[z.img], z.x, z.y, z.size, z.size, z.a);
      ctx.restore();
    }
    if (z.tint) {
      // runners get a faint ember ring so they read as "fast" in the dark
      ctx.save();
      ctx.strokeStyle = 'rgba(255,90,50,.4)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(z.x - cam.x + cam.sx, z.y - cam.y + cam.sy, z.r + 6 + Math.sin(elapsed * 6 + z.wob) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // hp bar for brutes
    if (z.type === 'brute' && z.hp < z.maxHp) {
      const w = 56;
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(z.x - w / 2 - cam.x + cam.sx, z.y - z.size / 2 - 12 - cam.y + cam.sy, w, 6);
      ctx.fillStyle = '#c81e1e';
      ctx.fillRect(z.x - w / 2 - cam.x + cam.sx, z.y - z.size / 2 - 12 - cam.y + cam.sy, w * clamp(z.hp / z.maxHp, 0, 1), 6);
    }
  }

  // player
  shadow(player.x, player.y, player.r * 1.15);
  if (player.hurtT > 0.25) ctx.globalAlpha = 0.65;
  drawSprite(IMG.player, player.x, player.y, 62, 67, player.a);
  ctx.globalAlpha = 1;

  // muzzle flash
  if (muzzle) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(muzzle.x - cam.x + cam.sx, muzzle.y - cam.y + cam.sy, 2, muzzle.x - cam.x + cam.sx, muzzle.y - cam.y + cam.sy, 46);
    g.addColorStop(0, 'rgba(255,240,180,.95)');
    g.addColorStop(0.4, 'rgba(255,160,60,.55)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(muzzle.x - cam.x + cam.sx, muzzle.y - cam.y + cam.sy, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // particles
  for (const pt of particles) {
    ctx.globalAlpha = clamp(1 - pt.t / pt.life, 0, 1);
    ctx.fillStyle = pt.c;
    ctx.beginPath();
    ctx.arc(pt.x - cam.x + cam.sx, pt.y - cam.y + cam.sy, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // darkness mask with flashlight cone
  const px = player.x - cam.x + cam.sx, py = player.y - cam.y + cam.sy;
  ctx.save();
  // radial pool of light around player
  let g = ctx.createRadialGradient(px, py, 60, px, py, 420);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0.86)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // cone in aim direction
  ctx.globalCompositeOperation = 'destination-out';
  ctx.translate(px, py);
  ctx.rotate(player.a);
  const cone = ctx.createLinearGradient(0, 0, 620, 0);
  cone.addColorStop(0, 'rgba(0,0,0,0.55)');
  cone.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 620, -0.42, 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // floaters
  ctx.save();
  ctx.font = 'bold 17px Segoe UI, Arial';
  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = clamp(1.4 - f.t, 0, 1);
    ctx.fillStyle = f.c;
    ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.txt, f.x - cam.x + cam.sx, f.y - cam.y + cam.sy);
    ctx.fillText(f.txt, f.x - cam.x + cam.sx, f.y - cam.y + cam.sy);
  }
  ctx.restore();

  // crosshair
  ctx.save();
  ctx.strokeStyle = 'rgba(255,60,60,.9)';
  ctx.lineWidth = 1.6;
  const cr = 9 + Math.sin(elapsed * 5) * 1.2;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, cr, 0, Math.PI * 2);
  ctx.moveTo(mouse.x - cr - 5, mouse.y); ctx.lineTo(mouse.x - cr + 2, mouse.y);
  ctx.moveTo(mouse.x + cr + 5, mouse.y); ctx.lineTo(mouse.x + cr - 2, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - cr - 5); ctx.lineTo(mouse.x, mouse.y - cr + 2);
  ctx.moveTo(mouse.x, mouse.y + cr + 5); ctx.lineTo(mouse.x, mouse.y + cr - 2);
  ctx.stroke();
  ctx.restore();
}

// menu background idle render (slow pan behind menu overlays)
function renderIdle() {
  const t = performance.now() / 1000;
  ctx.clearRect(0, 0, W, H);
  if (!groundPattern && IMG.ground.complete && IMG.ground.naturalWidth) {
    groundPattern = ctx.createPattern(IMG.ground, 'repeat');
  }
  if (groundPattern) {
    ctx.save();
    ctx.translate(-(t * 12 % TILE), -(t * 7 % TILE));
    ctx.fillStyle = groundPattern;
    ctx.fillRect(0, 0, W + TILE, H + TILE);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- loop
let lastT = performance.now();
function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (state === S.PLAY) { update(dt); render(); }
  else if (state === S.PAUSE) { render(); }
  else { renderIdle(); }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- wiring
$('ageYes').addEventListener('click', () => {
  audioUnlocked = true;
  // unlock audio on this user gesture
  Object.values(SND).forEach(a => { try { a.load(); } catch (e) {} });
  $('ageGate').classList.add('hidden');
  state = S.MENU;
  $('menu').classList.remove('hidden');
  const hs = +(localStorage.getItem('dd_hiscore') || 0);
  if (hs > 0) $('hiscore').textContent = 'BEST SCORE: ' + hs;
});
$('ageNo').addEventListener('click', () => {
  document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;color:#666;font-family:Arial;letter-spacing:2px;">Come back when you\'re 18.</div>';
});
$('startBtn').addEventListener('click', startGame);
$('retryBtn').addEventListener('click', startGame);
$('pause').addEventListener('click', togglePause);
$('mute').addEventListener('click', toggleMute);

loadSounds();
loadImages(() => {}); // sprites pop in as they finish loading
requestAnimationFrame(loop);

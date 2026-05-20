// Late Edition — Feel Test
// A tiny cel-shaded noir vignette: rainy city block, leads pinging across the map,
// a lone reporter you can dispatch with a click. Conveys color/fog/rain/outline language.

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const root = document.getElementById('feel-test');
const hud = document.getElementById('feel-test-hud');
if (!root) throw new Error('feel-test root not found');

const W = () => root.clientWidth;
const H = () => root.clientHeight;

// --- renderer -------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(W(), H());
renderer.setClearColor(0xc8c4bc, 1);
root.appendChild(renderer.domElement);

// --- scene + fog -----------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc8c4bc, 22, 60);

// orthographic isometric camera
const aspect = () => W() / H();
const frustum = 22;
const camera = new THREE.OrthographicCamera(
  -frustum * aspect() / 2, frustum * aspect() / 2,
  frustum / 2, -frustum / 2,
  0.1, 200
);
camera.position.set(40, 35, 40);
camera.lookAt(0, 0, 0);

// --- lights ----------------------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(15, 25, 8);
scene.add(key);

// --- toon material with 2-step gradient -----------------------------------
function makeGradient(steps) {
  const c = document.createElement('canvas');
  c.width = steps; c.height = 1;
  const ctx = c.getContext('2d');
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    // 3-band: shadow, mid, light — kept monochrome
    const v = Math.round(60 + t * 180);
    ctx.fillStyle = `rgb(${v},${v},${v - 4})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}
const gradient = makeGradient(3);

function toon(color = 0xdedacd) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient });
}

function withOutline(mesh, color = 0x0a0a0c, thickness = 1.2) {
  // edges geometry for crisp ink outlines
  const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, linewidth: thickness })
  );
  mesh.add(lines);
  return mesh;
}

// --- ground ---------------------------------------------------------------
const groundGeo = new THREE.PlaneGeometry(120, 120);
const ground = new THREE.Mesh(groundGeo, toon(0xb8b4ac));
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

// street grid lines
const gridMat = new THREE.LineBasicMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.35 });
const gridGeo = new THREE.BufferGeometry();
const gridPts = [];
for (let i = -30; i <= 30; i += 6) {
  gridPts.push(-30, 0.01, i, 30, 0.01, i);
  gridPts.push(i, 0.01, -30, i, 0.01, 30);
}
gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
scene.add(new THREE.LineSegments(gridGeo, gridMat));

// --- buildings ------------------------------------------------------------
const buildings = [];
const rng = mulberry32(7);

const blockSize = 5;
const positions = [];
for (let gx = -2; gx <= 2; gx++) {
  for (let gz = -2; gz <= 2; gz++) {
    if (gx === 0 && gz === 0) continue; // central plaza
    positions.push([gx * blockSize, gz * blockSize]);
  }
}

for (const [x, z] of positions) {
  const h = 2 + Math.floor(rng() * 5);
  const w = 2.4 + rng() * 0.6;
  const d = 2.4 + rng() * 0.6;
  const shade = 0xc5c1b8 - Math.floor(rng() * 30) * 0x010101;
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, toon(shade));
  mesh.position.set(x, h / 2, z);
  withOutline(mesh);

  // a few "lit windows" — tiny emissive planes (we'll fake with bright unlit)
  const winCount = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < winCount; i++) {
    const isLit = rng() > 0.55;
    const wm = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.35),
      new THREE.MeshBasicMaterial({ color: isLit ? 0xf0e6c8 : 0x222222 })
    );
    const side = Math.floor(rng() * 4);
    const yy = -h / 2 + 0.6 + Math.floor(rng() * Math.max(1, h - 1));
    if (side === 0) { wm.position.set(w / 2 + 0.01, yy, (rng() - 0.5) * (d - 0.4)); wm.rotation.y = Math.PI / 2; }
    if (side === 1) { wm.position.set(-w / 2 - 0.01, yy, (rng() - 0.5) * (d - 0.4)); wm.rotation.y = -Math.PI / 2; }
    if (side === 2) { wm.position.set((rng() - 0.5) * (w - 0.4), yy, d / 2 + 0.01); }
    if (side === 3) { wm.position.set((rng() - 0.5) * (w - 0.4), yy, -d / 2 - 0.01); wm.rotation.y = Math.PI; }
    mesh.add(wm);
  }
  scene.add(mesh);
  buildings.push(mesh);
}

// --- the bureau (player HQ) — taller, marked with a "press" antenna ------
const bureauGeo = new THREE.BoxGeometry(3.2, 7, 3.2);
const bureau = new THREE.Mesh(bureauGeo, toon(0x2a2a2c));
bureau.position.set(0, 3.5, 0);
withOutline(bureau, 0x0a0a0c);
scene.add(bureau);
// red rooftop sign (our only color)
const sign = new THREE.Mesh(
  new THREE.BoxGeometry(2.6, 0.5, 0.15),
  new THREE.MeshBasicMaterial({ color: 0xc0212a })
);
sign.position.set(0, 7.4, 0);
bureau.add(new THREE.Object3D()); // anchor
scene.add(sign);
// antenna
const ant = new THREE.Mesh(
  new THREE.CylinderGeometry(0.04, 0.04, 2, 6),
  new THREE.MeshBasicMaterial({ color: 0x0a0a0c })
);
ant.position.set(0, 8.2, 0);
scene.add(ant);

// --- reporter unit --------------------------------------------------------
const reporter = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
  toon(0x1c1c1f)
);
body.position.y = 0.55;
withOutline(body);
reporter.add(body);
// hat (fedora!)
const brim = new THREE.Mesh(
  new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16),
  toon(0x0e0e10)
);
brim.position.y = 1.05;
withOutline(brim);
reporter.add(brim);
const crown = new THREE.Mesh(
  new THREE.CylinderGeometry(0.26, 0.28, 0.22, 16),
  toon(0x0e0e10)
);
crown.position.y = 1.18;
withOutline(crown);
reporter.add(crown);
reporter.position.set(0, 0, 2);
scene.add(reporter);

// --- lead markers (red diamonds) ------------------------------------------
const leads = [];
function spawnLead() {
  // pick a random street-corner position (avoid the bureau)
  let p;
  do {
    p = new THREE.Vector3(
      (Math.floor(rng() * 5) - 2) * blockSize,
      0,
      (Math.floor(rng() * 5) - 2) * blockSize
    );
    // offset to street between blocks
    p.x += blockSize / 2 * (rng() > 0.5 ? 1 : -1);
    p.z += blockSize / 2 * (rng() > 0.5 ? 1 : -1);
  } while (p.length() < 2 || leads.some(l => l.position.distanceTo(p) < 2));

  const g = new THREE.OctahedronGeometry(0.35, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xc0212a }));
  m.position.copy(p);
  m.position.y = 1.2;
  m.userData.spin = rng() * Math.PI * 2;
  m.userData.bob = rng() * Math.PI * 2;
  // outline
  const e = new THREE.EdgesGeometry(g);
  m.add(new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0x0a0a0c })));
  scene.add(m);
  leads.push(m);
}
for (let i = 0; i < 4; i++) spawnLead();

// --- rain (instanced lines) ------------------------------------------------
const RAIN_COUNT = 600;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_COUNT * 6);
const rainVel = new Float32Array(RAIN_COUNT);
for (let i = 0; i < RAIN_COUNT; i++) {
  const x = (Math.random() - 0.5) * 60;
  const z = (Math.random() - 0.5) * 60;
  const y = Math.random() * 25;
  rainPos[i * 6 + 0] = x;
  rainPos[i * 6 + 1] = y;
  rainPos[i * 6 + 2] = z;
  rainPos[i * 6 + 3] = x + 0.1;
  rainPos[i * 6 + 4] = y - 0.6;
  rainPos[i * 6 + 5] = z;
  rainVel[i] = 0.5 + Math.random() * 0.4;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0x6b6864, transparent: true, opacity: 0.55 });
const rain = new THREE.LineSegments(rainGeo, rainMat);
scene.add(rain);

// --- interaction ----------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let target = null;     // Vector3 target on ground
let pickedLead = null; // lead carried by reporter
let returningHome = false;
let stats = { leads: 0, stories: 0, ink: 24, edition: 1 };

function updateHud() {
  if (!hud) return;
  hud.innerHTML = `
    <div class="hud-row"><span>LEADS</span><b>${stats.leads}</b></div>
    <div class="hud-row"><span>STORIES</span><b>${stats.stories}</b></div>
    <div class="hud-row"><span>INK</span><b>${stats.ink}</b></div>
    <div class="hud-row"><span>EDITION</span><b>№ ${String(stats.edition).padStart(3, '0')}</b></div>
    <div class="hud-hint">${pickedLead ? 'RETURN TO BUREAU' : 'CLICK A RED LEAD'}</div>
  `;
}
updateHud();

function onPointerDown(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  // first try lead pickup
  const leadHit = raycaster.intersectObjects(leads, false)[0];
  if (leadHit && !pickedLead) {
    target = leadHit.object.position.clone();
    target.y = 0;
    target.userData = { kind: 'lead', obj: leadHit.object };
    return;
  }
  // otherwise click on ground
  const groundHit = raycaster.intersectObject(ground, false)[0];
  if (groundHit) {
    target = groundHit.point.clone();
    target.y = 0;
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

// --- resize ---------------------------------------------------------------
function onResize() {
  renderer.setSize(W(), H());
  camera.left = -frustum * aspect() / 2;
  camera.right = frustum * aspect() / 2;
  camera.top = frustum / 2;
  camera.bottom = -frustum / 2;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// --- animate --------------------------------------------------------------
const tmp = new THREE.Vector3();
let t0 = performance.now();
let leadTimer = 0;
function tick() {
  const t = performance.now();
  const dt = Math.min(0.05, (t - t0) / 1000);
  t0 = t;

  // rain fall
  const posAttr = rainGeo.getAttribute('position');
  const arr = posAttr.array;
  for (let i = 0; i < RAIN_COUNT; i++) {
    arr[i * 6 + 1] -= rainVel[i] * 18 * dt;
    arr[i * 6 + 4] -= rainVel[i] * 18 * dt;
    if (arr[i * 6 + 4] < 0) {
      const y = 20 + Math.random() * 6;
      arr[i * 6 + 1] = y;
      arr[i * 6 + 4] = y - 0.6;
    }
  }
  posAttr.needsUpdate = true;

  // lead bob / spin
  for (const l of leads) {
    l.userData.spin += dt * 1.2;
    l.userData.bob += dt * 2.4;
    l.rotation.y = l.userData.spin;
    l.position.y = 1.2 + Math.sin(l.userData.bob) * 0.12;
  }

  // reporter movement
  if (target) {
    tmp.copy(target).sub(reporter.position);
    tmp.y = 0;
    const dist = tmp.length();
    if (dist > 0.15) {
      tmp.normalize();
      reporter.position.addScaledVector(tmp, 3.5 * dt);
      reporter.rotation.y = Math.atan2(tmp.x, tmp.z);
      // little bounce
      reporter.children[0].position.y = 0.55 + Math.abs(Math.sin(t * 0.012)) * 0.08;
    } else {
      // arrived
      if (target.userData && target.userData.kind === 'lead') {
        const obj = target.userData.obj;
        // pick up
        scene.remove(obj);
        leads.splice(leads.indexOf(obj), 1);
        pickedLead = obj;
        stats.leads += 1;
        // attach mini diamond above reporter
        pickedLead.scale.setScalar(0.6);
        pickedLead.position.set(0, 1.7, 0);
        reporter.add(pickedLead);
        // head home
        target = new THREE.Vector3(0, 0, 2);
        target.userData = { kind: 'home' };
        returningHome = true;
        updateHud();
      } else if (target.userData && target.userData.kind === 'home' && pickedLead) {
        // file the story
        reporter.remove(pickedLead);
        pickedLead = null;
        stats.leads -= 1;
        stats.stories += 1;
        stats.ink = Math.max(0, stats.ink - 2);
        if (stats.stories % 3 === 0) stats.edition += 1;
        target = null;
        returningHome = false;
        // flash bureau red briefly
        flashBureau();
        updateHud();
      } else {
        target = null;
      }
    }
  }

  // periodically spawn new leads
  leadTimer += dt;
  if (leadTimer > 6 && leads.length < 6) {
    leadTimer = 0;
    spawnLead();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function flashBureau() {
  const orig = sign.material.color.getHex();
  sign.scale.setScalar(1.4);
  let f = 0;
  const id = setInterval(() => {
    f++;
    sign.scale.setScalar(1 + (1.4 - 1) * Math.max(0, 1 - f / 8));
    if (f > 8) { clearInterval(id); sign.scale.setScalar(1); }
  }, 40);
}

tick();

// --- tiny prng -------------------------------------------------------------
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

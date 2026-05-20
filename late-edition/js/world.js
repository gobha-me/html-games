// Late Edition — milestone 0.1 — world render scaffold.
// Scene · camera · toon pipeline · fog · rain · ground grid.
// Lifted from js/feel-test.js with all game logic stripped.
// ICD-01 boundary (WorldFrame → renderer) is *not* materialized here:
// at 0.1 there is no simulation, so the split would be noise. It lands
// at 0.2 when the first units arrive.

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const root = document.getElementById('world');
if (!root) throw new Error('world root not found');

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

// --- toon material with 3-step gradient -----------------------------------
function makeGradient(steps) {
  const c = document.createElement('canvas');
  c.width = steps; c.height = 1;
  const ctx = c.getContext('2d');
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
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

// Outline helper retained for the upcoming building/unit milestones; unused at 0.1.
function withOutline(mesh, color = 0x0a0a0c, thickness = 1.2) {
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
let t0 = performance.now();
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

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

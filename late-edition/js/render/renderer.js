// Late Edition — renderer.
// Owns the three.js scene; consumes WorldFrame and draws it. Never reaches
// back into world state (ICD-01 §Notes "renderer never reaches back").
// Exposes screenToGridCell(clientX, clientY) so input can convert screen
// coords to a GridCell without poking the scene graph directly.
//
// Toon pipeline, fog, rain are lifted from v0.1 js/world.js byte-for-byte
// — preserve the cel-shaded aesthetic (strong-band commitment).

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { TILE } from '../sim/world-state.js';

const FRUSTUM = 22;
const RAIN_COUNT = 600;

export class Renderer {
  constructor(root) {
    this.root = root;
    this.W = () => root.clientWidth;
    this.H = () => root.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(this.W(), this.H());
    this.renderer.setClearColor(0xc8c4bc, 1);
    root.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc8c4bc, 22, 60);

    this.camera = new THREE.OrthographicCamera(
      -FRUSTUM * this._aspect() / 2, FRUSTUM * this._aspect() / 2,
      FRUSTUM / 2, -FRUSTUM / 2,
      0.1, 200,
    );
    this.camera.position.set(40, 35, 40);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(15, 25, 8);
    this.scene.add(key);

    this.gradient = makeGradient(3);

    this._buildGround();
    this._buildRain();
    this._buildSelectionRing();

    this.buildingMeshes = new Map(); // id → THREE.Group
    this.unitMeshes = new Map();     // id → { group, interp:{prev,curr,tickStart,tickDur} }

    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.raycaster = new THREE.Raycaster();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._onResize();
  }

  // Convert client (px) → world XZ → GridCell. Returns null if outside grid bounds.
  screenToGridCell(clientX, clientY, gridW, gridH) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    const cell = {
      x: Math.round((hit.x + 27) / TILE),
      y: Math.round((hit.z + 27) / TILE),
    };
    if (cell.x < 0 || cell.y < 0 || cell.x >= gridW || cell.y >= gridH) return null;
    return cell;
  }

  // Apply a WorldFrame. alpha ∈ [0,1] is the interpolation factor between
  // the previous sim tick and the current one (ICD-01 v0.3: renderer lerps).
  apply(frame, alpha = 1) {
    this._syncBuildings(frame.buildings);
    this._syncUnits(frame.units, alpha);
    this._stepRain();
    this.renderer.render(this.scene, this.camera);
  }

  // Tell the renderer a new sim tick just happened so it can latch interp endpoints.
  noteTick(frame, tickDurationSec) {
    for (const u of frame.units) {
      const entry = this.unitMeshes.get(u.id);
      if (!entry) continue;
      entry.prev = { ...entry.curr };
      entry.curr = { x: u.pos.x, z: u.pos.z, facing: u.facing };
      entry.tickDur = tickDurationSec;
    }
  }

  _syncBuildings(buildings) {
    for (const b of buildings) {
      let g = this.buildingMeshes.get(b.id);
      if (!g) {
        g = buildBureauMesh(this.gradient);
        this.buildingMeshes.set(b.id, g);
        this.scene.add(g);
      }
      g.position.set(b.pos.x, b.pos.y, b.pos.z);
    }
  }

  _syncUnits(units, alpha) {
    const seen = new Set();
    for (const u of units) {
      seen.add(u.id);
      let entry = this.unitMeshes.get(u.id);
      if (!entry) {
        const group = buildReporterMesh(this.gradient);
        this.scene.add(group);
        entry = {
          group,
          prev: { x: u.pos.x, z: u.pos.z, facing: u.facing },
          curr: { x: u.pos.x, z: u.pos.z, facing: u.facing },
          tickDur: 1 / 30,
        };
        this.unitMeshes.set(u.id, entry);
      }
      const a = Math.max(0, Math.min(1, alpha));
      const x = entry.prev.x + (entry.curr.x - entry.prev.x) * a;
      const z = entry.prev.z + (entry.curr.z - entry.prev.z) * a;
      entry.group.position.set(x, 0, z);
      entry.group.rotation.y = entry.curr.facing;
      const ring = entry.group.getObjectByName('selectRing');
      if (ring) ring.visible = u.selected;
    }
    for (const [id, entry] of this.unitMeshes) {
      if (!seen.has(id)) {
        this.scene.remove(entry.group);
        this.unitMeshes.delete(id);
      }
    }
  }

  _buildGround() {
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const ground = new THREE.Mesh(groundGeo, toon(this.gradient, 0xb8b4ac));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.scene.add(ground);

    const gridMat = new THREE.LineBasicMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.35 });
    const gridGeo = new THREE.BufferGeometry();
    const gridPts = [];
    for (let i = -30; i <= 30; i += 6) {
      gridPts.push(-30, 0.01, i, 30, 0.01, i);
      gridPts.push(i, 0.01, -30, i, 0.01, 30);
    }
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
    this.scene.add(new THREE.LineSegments(gridGeo, gridMat));
  }

  _buildRain() {
    this.rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(RAIN_COUNT * 6);
    this.rainVel = new Float32Array(RAIN_COUNT);
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
      this.rainVel[i] = 0.5 + Math.random() * 0.4;
    }
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({ color: 0x6b6864, transparent: true, opacity: 0.55 });
    this.scene.add(new THREE.LineSegments(this.rainGeo, rainMat));
    this._lastRainTime = performance.now();
  }

  _stepRain() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastRainTime) / 1000);
    this._lastRainTime = now;
    const posAttr = this.rainGeo.getAttribute('position');
    const arr = posAttr.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      arr[i * 6 + 1] -= this.rainVel[i] * 18 * dt;
      arr[i * 6 + 4] -= this.rainVel[i] * 18 * dt;
      if (arr[i * 6 + 4] < 0) {
        const y = 20 + Math.random() * 6;
        arr[i * 6 + 1] = y;
        arr[i * 6 + 4] = y - 0.6;
      }
    }
    posAttr.needsUpdate = true;
  }

  _buildSelectionRing() {
    // Template; per-unit ring is cloned in buildReporterMesh.
    this._ringGeo = new THREE.RingGeometry(1.0, 1.3, 24);
    this._ringMat = new THREE.MeshBasicMaterial({
      color: 0xfff2c2, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
    });
  }

  _ring() {
    const ring = new THREE.Mesh(this._ringGeo, this._ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.name = 'selectRing';
    ring.visible = false;
    return ring;
  }

  _aspect() { return this.W() / this.H(); }

  _onResize() {
    this.renderer.setSize(this.W(), this.H());
    this.camera.left = -FRUSTUM * this._aspect() / 2;
    this.camera.right = FRUSTUM * this._aspect() / 2;
    this.camera.top = FRUSTUM / 2;
    this.camera.bottom = -FRUSTUM / 2;
    this.camera.updateProjectionMatrix();
  }
}

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

function toon(gradient, color = 0xdedacd) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient });
}

function withOutline(mesh, color = 0x0a0a0c) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color }),
  );
  mesh.add(lines);
  return mesh;
}

function buildBureauMesh(gradient) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4, 4.5), toon(gradient, 0x8a8278));
  body.position.y = 2;
  withOutline(body);
  group.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.4, 4.8), toon(gradient, 0x5a554d));
  roof.position.y = 4.2;
  withOutline(roof);
  group.add(roof);
  return group;
}

function buildReporterMesh(gradient) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.8), toon(gradient, 0x3a3a3a));
  body.position.y = 0.95;
  withOutline(body);
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), toon(gradient, 0xd9c8a8));
  head.position.y = 2.05;
  withOutline(head);
  group.add(head);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.95), toon(gradient, 0x1c1c1c));
  hat.position.y = 2.5;
  withOutline(hat);
  group.add(hat);

  // Selection ring (toggled via UnitView.selected).
  const ringGeo = new THREE.RingGeometry(1.0, 1.3, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c2, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.name = 'selectRing';
  ring.visible = false;
  group.add(ring);

  return group;
}

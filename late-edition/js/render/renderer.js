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
// 0.10.2 (C-06): baseline rain count is 600 lines per Design Doc §15 / the
// 0.1 lift. The deadline ramp scales the draw-range up by `frame.rain.intensity`
// (1 → 2 across the last 30 s), capped at 1500 lines. We allocate the full
// 1500-line buffer once at boot so the ramp is a draw-range tweak, not a
// geometry reallocation.
const RAIN_COUNT = 600;
const RAIN_MAX = 1500;

// 0.10.1 (G-07): Block zoom step is the close-in counterpart to the City
// frustum. Design Doc §12 "two steps: City (frustum ≈22) and Block (frustum
// ≈10)" with a 250 ms ease-out cubic transition. WASD pan integrates a
// velocity supplied by input.js; clamp to the grid extent so the player
// cannot lose the bureau by panning off the world.
const FRUSTUM_CITY = 22;
const FRUSTUM_BLOCK = 10;
const ZOOM_EASE_MS = 250;
const PAN_CLAMP = 27;  // half-width of the grid in world units (TILE * GRID_W / 2 ≈ 30 minus a small margin)

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

    // 0.10.1 (G-07) view state — pan offset (XZ ground plane) + zoom
    // step. Both are renderer-local: the sim never sees the view; the
    // WorldFrame's cameraTarget stays canonically (0,0,0) per ICD-01 v0.6.
    this._pan = { x: 0, z: 0 };
    this._panVel = { x: 0, z: 0 };
    this._zoomLevel = 'city';
    this._frustum = FRUSTUM_CITY;
    this._zoomEase = null;  // { fromFrustum, toFrustum, startMs, durMs } | null
    this._lastFrameMs = null;

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
    this.leadMeshes = new Map();     // id → THREE.Group  (0.3 LeadView)

    // 0.10.2 (C-07): ephemeral FX mesh tracking. Each active effect carries
    // its mesh, spawn time, ttl, and (optionally) anchor offset so _stepFx
    // can animate it. Pool is unbounded but TTLs are short (200–1000 ms);
    // the active set rarely exceeds ~10 in practice. ICD-01 v0.6 §FxEvent —
    // renderer owns the visual lifetime; sim queue is drained-once.
    this._fxActive = [];

    // 0.10.2 (D-09): lit-window state. Each entry is { mesh, lit, nextFlipMs };
    // the flicker tick toggles `lit` on a 5–15 s random period to keep ~40%
    // of windows lit at any moment. Built lazily during _syncBuildings the
    // first time each building is mounted.
    this._windows = [];

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
    this._updateView();
    this._syncBuildings(frame.buildings);
    this._syncUnits(frame.units, alpha);
    this._syncLeads(frame.leads);
    // 0.10.2 (D-09): fog.near is now sim-driven (ramp 22 → 14 over last 60 s).
    // ICD-01 v0.6.2 §Notes — the ramp lives in World.snapshot(); the renderer
    // just lifts the value onto the THREE.Fog uniform every frame.
    if (frame.fog) {
      this.scene.fog.near = frame.fog.near;
      this.scene.fog.far = frame.fog.far;
    }
    // 0.10.2 (C-06): rain intensity is now sim-driven (ramp 1 → 2 over last 30 s).
    this._stepRain(frame.rain?.intensity ?? 1);
    // 0.10.2 (D-09): per-frame window flicker tick.
    this._stepWindowFlicker(performance.now());
    // 0.10.2 (C-07): drain WorldFrame.effects and spawn ephemeral FX meshes
    // for the six FxEvent kinds. ICD-01 v0.6 §Notes — drained queue, lifetime
    // one frame on the producer side; the renderer owns each effect's TTL.
    if (frame.effects && frame.effects.length > 0) this._consumeEffects(frame.effects);
    this._stepFx(performance.now());
    this.renderer.render(this.scene, this.camera);
  }

  // 0.10.1 (G-07): input.js feeds a pan velocity (world units / sec) and a
  // zoom step; the renderer integrates per frame. Pan velocity is supplied
  // as a vector — input.js owns the WASD-key set and computes the resultant.
  setPanVelocity(vx, vz) {
    this._panVel.x = vx;
    this._panVel.z = vz;
  }

  setZoom(level) {
    if (level !== 'city' && level !== 'block') return;
    if (level === this._zoomLevel) return;
    const target = level === 'block' ? FRUSTUM_BLOCK : FRUSTUM_CITY;
    this._zoomEase = {
      fromFrustum: this._frustum,
      toFrustum: target,
      startMs: performance.now(),
      durMs: ZOOM_EASE_MS,
    };
    this._zoomLevel = level;
  }

  // Per-frame view integration. Splits camera-update concerns from
  // mesh-sync — keeps apply() readable and lets future PRs (PR-D rain
  // ramp, etc.) layer on without touching pan/zoom math.
  _updateView() {
    const now = performance.now();
    const dt = this._lastFrameMs == null ? 0 : Math.min(0.1, (now - this._lastFrameMs) / 1000);
    this._lastFrameMs = now;

    // Pan integration with grid-extent clamp.
    if (this._panVel.x !== 0 || this._panVel.z !== 0) {
      this._pan.x = Math.max(-PAN_CLAMP, Math.min(PAN_CLAMP, this._pan.x + this._panVel.x * dt));
      this._pan.z = Math.max(-PAN_CLAMP, Math.min(PAN_CLAMP, this._pan.z + this._panVel.z * dt));
    }

    // Zoom ease-out cubic. The 250 ms beat is short enough to read as a
    // crisp step, long enough to avoid pop. Releases when t hits 1.
    if (this._zoomEase) {
      const elapsed = now - this._zoomEase.startMs;
      const t = Math.min(1, elapsed / this._zoomEase.durMs);
      const k = 1 - Math.pow(1 - t, 3);
      this._frustum = this._zoomEase.fromFrustum + (this._zoomEase.toFrustum - this._zoomEase.fromFrustum) * k;
      if (t >= 1) this._zoomEase = null;
    }

    // Camera position + lookAt translate together so the isometric angle
    // is preserved — we are panning the target, not orbiting around it.
    this.camera.position.set(40 + this._pan.x, 35, 40 + this._pan.z);
    this.camera.lookAt(this._pan.x, 0, this._pan.z);
    this._applyFrustum(this._frustum);
  }

  _applyFrustum(frustum) {
    this.camera.left = -frustum * this._aspect() / 2;
    this.camera.right = frustum * this._aspect() / 2;
    this.camera.top = frustum / 2;
    this.camera.bottom = -frustum / 2;
    this.camera.updateProjectionMatrix();
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
        g = buildBuildingMesh(this.gradient, b.kind);
        this.buildingMeshes.set(b.id, g);
        this.scene.add(g);
        // 0.10.2 (D-09): attach lit windows as children of each building group
        // the first time it's mounted. Subsequent frames just translate.
        this._attachWindows(g, b.kind);
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
        const group = buildUnitMesh(this.gradient, u.kind);
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
      // 0.3: UnitView.carrying === 'lead' surfaces as a folder over the sprite.
      const folder = entry.group.getObjectByName('carryFolder');
      const wantsFolder = u.carrying === 'lead';
      if (wantsFolder && !folder) entry.group.add(buildFolderMesh(this.gradient));
      else if (!wantsFolder && folder) entry.group.remove(folder);
    }
    for (const [id, entry] of this.unitMeshes) {
      if (!seen.has(id)) {
        this.scene.remove(entry.group);
        this.unitMeshes.delete(id);
      }
    }
  }

  // LeadView mesh pool. Add/remove markers as ids enter/leave frame.leads.
  // Tint is per flavor (vice / violence / money / labor); the renderer never
  // reads age_ms for 0.3 — that field is plumbed for future decay/pulse FX.
  _syncLeads(leads) {
    const seen = new Set();
    for (const lead of leads) {
      seen.add(lead.id);
      let g = this.leadMeshes.get(lead.id);
      if (!g) {
        g = buildLeadMesh(this.gradient, lead.flavor);
        this.leadMeshes.set(lead.id, g);
        this.scene.add(g);
      }
      g.position.set(lead.pos.x, lead.pos.y, lead.pos.z);
    }
    for (const [id, g] of this.leadMeshes) {
      if (!seen.has(id)) {
        this.scene.remove(g);
        this.leadMeshes.delete(id);
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
    // 0.10.2 (C-06): allocate the full ramp-cap pool (1500 lines) at boot so
    // the per-frame intensity ramp is a draw-range tweak. Baseline visible
    // count is RAIN_COUNT (600); the deadline ramp scales up to RAIN_MAX.
    this.rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(RAIN_MAX * 6);
    this.rainVel = new Float32Array(RAIN_MAX);
    for (let i = 0; i < RAIN_MAX; i++) {
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
    this.rainGeo.setDrawRange(0, RAIN_COUNT * 2); // *2 because each line = 2 vertices
    const rainMat = new THREE.LineBasicMaterial({ color: 0x6b6864, transparent: true, opacity: 0.55 });
    this.scene.add(new THREE.LineSegments(this.rainGeo, rainMat));
    this._lastRainTime = performance.now();
  }

  _stepRain(intensity = 1) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastRainTime) / 1000);
    this._lastRainTime = now;
    // Scale visible line count by intensity, capped at RAIN_MAX (Design Doc §15).
    const visibleLines = Math.max(0, Math.min(RAIN_MAX, Math.round(RAIN_COUNT * intensity)));
    this.rainGeo.setDrawRange(0, visibleLines * 2);
    const posAttr = this.rainGeo.getAttribute('position');
    const arr = posAttr.array;
    // Only step the visible lines — off-screen lines stay put and rejoin
    // the simulation when the ramp re-includes them.
    for (let i = 0; i < visibleLines; i++) {
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

  // 0.10.2 (C-07): drain FxEvents into ephemeral meshes. ICD-01 v0.6 §FxEvent
  // — six kinds, each anchored at `at: Vec3`. Visuals are deliberately
  // minimal noir-palette beats; the audio cues authored at ICD-07 land later.
  _consumeEffects(events) {
    const now = performance.now();
    for (const ev of events) {
      const at = ev.at ?? { x: 0, y: 0, z: 0 };
      if (ev.kind === 'pickup') this._spawnFx(buildPickupRing(),  at, now, 220, 'pickup');
      else if (ev.kind === 'verify') this._spawnFx(buildVerifyFlash(),   at, now, 320, 'verify');
      else if (ev.kind === 'print')  this._spawnFx(buildPrintSprite(),   at, now, 850, 'print');
      else if (ev.kind === 'death')  this._spawnFx(buildDeathCross(),    at, now, 420, 'death');
      else if (ev.kind === 'raid_warning') this._spawnFx(buildRaidWarning(), at, now, 1000, 'raid_warning');
      // `flash` is reserved for future co-emit with `verify` — no Tier-0 visual.
    }
  }

  _spawnFx(mesh, at, nowMs, ttlMs, kind) {
    mesh.position.set(at.x, at.y ?? 0, at.z);
    this.scene.add(mesh);
    this._fxActive.push({ mesh, kind, spawnedMs: nowMs, ttlMs });
  }

  // Per-frame FX animation tick. Each kind interprets `t ∈ [0,1]` as the
  // normalized lifetime (0 at spawn, 1 at expiry). At t≥1 the mesh is
  // disposed and removed from the scene. Kept inline (not pooled) — TTLs
  // are short enough that GC churn is negligible vs. the cost of pooling.
  _stepFx(nowMs) {
    if (this._fxActive.length === 0) return;
    const survivors = [];
    for (const entry of this._fxActive) {
      const t = (nowMs - entry.spawnedMs) / entry.ttlMs;
      if (t >= 1) {
        this.scene.remove(entry.mesh);
        disposeMesh(entry.mesh);
        continue;
      }
      animateFx(entry, t);
      survivors.push(entry);
    }
    this._fxActive = survivors;
  }

  // 0.10.2 (D-09): per-frame window flicker tick. Each window is independent;
  // its visibility toggles on a random schedule so the building reads as
  // "lights on inside" without a synchronized pulse. Convergence is ~40% lit
  // at any moment (lit holds: 4–8 s; dark holds: 8–14 s).
  _stepWindowFlicker(nowMs) {
    for (const w of this._windows) {
      if (nowMs >= w.nextFlipMs) {
        w.lit = !w.lit;
        w.mesh.visible = w.lit;
        const holdMs = w.lit ? (4000 + Math.random() * 4000) : (8000 + Math.random() * 6000);
        w.nextFlipMs = nowMs + holdMs;
      }
    }
  }

  _attachWindows(group, kind) {
    // Per-building window placement. Each kind has 4 windows on its facade —
    // small emissive quads at fixed offsets, child of the building group so
    // they translate together. MeshBasicMaterial (no light reaction) reads
    // as a self-lit panel against the toon-shaded body.
    const layout = WINDOW_LAYOUTS[kind] ?? WINDOW_LAYOUTS.bureau;
    const now = performance.now();
    for (const [wx, wy, wz, ry] of layout) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xf6c860 });
      const mesh = new THREE.Mesh(WINDOW_GEO, mat);
      mesh.position.set(wx, wy, wz);
      mesh.rotation.y = ry;
      group.add(mesh);
      // Initial lit state random so a fresh load doesn't show a synchronized
      // first-frame all-on; staggered initial flip times achieve the same.
      const lit = Math.random() < 0.4;
      mesh.visible = lit;
      this._windows.push({
        mesh,
        lit,
        nextFlipMs: now + (lit ? 4000 + Math.random() * 4000 : 8000 + Math.random() * 6000),
      });
    }
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
    this._applyFrustum(this._frustum);
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

function buildBuildingMesh(gradient, kind) {
  if (kind === 'darkroom')      return buildDarkroomMesh(gradient);
  if (kind === 'branch_bureau') return buildBranchBureauMesh(gradient);
  return buildBureauMesh(gradient);
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

// 0.10.0 (G-01): Branch Bureau — smaller-than-Bureau silhouette, tan body
// (district outpost), red awning over the entrance to read as a newsstand-
// scale "office that obviously can be taken out in 20s." Reads alongside
// the Bureau without being mistaken for it.
function buildBranchBureauMesh(gradient) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 3.2), toon(gradient, 0xa68f6f));
  body.position.y = 1.4;
  withOutline(body);
  group.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 3.5), toon(gradient, 0x5e4a2e));
  roof.position.y = 2.95;
  withOutline(roof);
  group.add(roof);
  // Awning — short red brim over one face. Visual signature.
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.7), toon(gradient, 0xc0212a));
  awning.position.set(0, 1.9, 1.7);
  withOutline(awning);
  group.add(awning);
  return group;
}

// 0.4: Darkroom — squatter than Bureau, dark-red body (developer-chemical
// stain), darker roof. Reads as "off-bureau workspace" against the paper fog.
function buildDarkroomMesh(gradient) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 4.2), toon(gradient, 0x6b3a3a));
  body.position.y = 1.6;
  withOutline(body);
  group.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.35, 4.5), toon(gradient, 0x2a1818));
  roof.position.y = 3.4;
  withOutline(roof);
  group.add(roof);
  // Safelight: tiny red lamp on the roof — readable visual signature for
  // "this is the Darkroom" without needing a label.
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), toon(gradient, 0xc0212a));
  lamp.position.set(1.4, 3.8, 1.4);
  withOutline(lamp);
  group.add(lamp);
  return group;
}

// Muted noir-palette flavor tints — consistent with --paper fog at #c8c4bc.
const LEAD_FLAVOR_COLOR = {
  vice:     0x8a3a4a, // wine
  violence: 0x4a3a3a, // dried blood
  money:    0x6a7a4a, // tarnished olive
  labor:    0x4a5a7a, // worker blue
};

function buildLeadMesh(gradient, flavor) {
  const group = new THREE.Group();
  const color = LEAD_FLAVOR_COLOR[flavor] ?? 0x6a6a6a;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.15), toon(gradient, color));
  slab.position.y = 0.6;
  withOutline(slab);
  group.add(slab);
  return group;
}

function buildFolderMesh(gradient) {
  const folder = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.18), toon(gradient, 0xd9c896));
  folder.position.set(0, 1.35, 0.5);
  folder.name = 'carryFolder';
  withOutline(folder);
  return folder;
}

function buildUnitMesh(gradient, kind) {
  if (kind === 'photog') return buildPhotogMesh(gradient);
  if (kind === 'goon')   return buildGoonMesh(gradient);
  if (kind === 'fixer')  return buildFixerMesh(gradient);
  if (kind === 'editor') return buildEditorMesh(gradient);
  return buildReporterMesh(gradient);
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
  group.add(makeSelectRing());
  return group;
}

// 0.4: Photog — same silhouette family as Reporter (read as person), but
// distinguishable. Brown jacket vs reporter's dark coat; flat cap (shorter
// brim than the fedora); a slung camera box on the chest as the silhouette
// signal.
function buildPhotogMesh(gradient) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.8), toon(gradient, 0x5a3f2a));
  body.position.y = 0.95;
  withOutline(body);
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), toon(gradient, 0xd9c8a8));
  head.position.y = 2.05;
  withOutline(head);
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.18, 0.85), toon(gradient, 0x2a2a2a));
  cap.position.y = 2.48;
  withOutline(cap);
  group.add(cap);
  // Camera box — chest-slung, dark, small. Visual distinguisher from the
  // reporter's empty front.
  const camera = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.25), toon(gradient, 0x141414));
  camera.position.set(0, 1.3, 0.45);
  withOutline(camera);
  group.add(camera);
  group.add(makeSelectRing());
  return group;
}

function makeSelectRing() {
  const ringGeo = new THREE.RingGeometry(1.0, 1.3, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfff2c2, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.name = 'selectRing';
  ring.visible = false;
  return ring;
}

// 0.7.0: Goon — squatter than reporter (heavier body), almost-black coat,
// pulled-low flat cap. Faceless silhouette — the visual signal is "thug
// from a district edge", not a character. No select ring (goons are not
// player units).
function buildGoonMesh(gradient) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.45, 0.9), toon(gradient, 0x1c1818));
  body.position.y = 0.85;
  withOutline(body);
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 0.65), toon(gradient, 0x8a7560));
  head.position.y = 1.9;
  withOutline(head);
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.18, 0.95), toon(gradient, 0x0a0a0c));
  cap.position.y = 2.25;
  withOutline(cap);
  group.add(cap);
  return group;
}

// 0.7.1: Editor — newsroom desk worker. Shirt-sleeved (no coat) so the
// silhouette reads "indoor" against the trench-coated field units; green
// eyeshade visor on the head as the defining signal (newsroom uniform);
// dark vest over the shirt. No select ring — Editor is stationary (Design
// Doc §17 "Stationed at the Bureau") and dispatch is rejected at sim level.
function buildEditorMesh(gradient) {
  const group = new THREE.Group();
  // Shirt body — pale, no coat (distinguishes from coated field units).
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.8), toon(gradient, 0xb8b0a0));
  body.position.y = 0.6;
  withOutline(body);
  group.add(body);
  // Vest — dark, waist-up, sits over the shirt.
  const vest = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.85, 0.82), toon(gradient, 0x2a2520));
  vest.position.y = 1.25;
  withOutline(vest);
  group.add(vest);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), toon(gradient, 0xd9c8a8));
  head.position.y = 2.05;
  withOutline(head);
  group.add(head);
  // Eyeshade visor — flat green brim, no crown. The signature.
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.15, 0.6), toon(gradient, 0x3a6a3a));
  visor.position.set(0, 2.4, 0.15);
  withOutline(visor);
  group.add(visor);
  return group;
}

// 0.7.0: Fixer — taller silhouette (trench coat), brim hat, dark red accent
// (kerchief at neck) reads against the noir palette so the player can pick
// the fixer out of the crowd at a glance.
function buildFixerMesh(gradient) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 0.8), toon(gradient, 0x2a2520));
  body.position.y = 1.0;
  withOutline(body);
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), toon(gradient, 0xd9c8a8));
  head.position.y = 2.15;
  withOutline(head);
  group.add(head);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 1.05), toon(gradient, 0x141414));
  brim.position.y = 2.55;
  withOutline(brim);
  group.add(brim);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.7), toon(gradient, 0x141414));
  crown.position.y = 2.78;
  withOutline(crown);
  group.add(crown);
  // Kerchief — small red accent at the throat.
  const kerchief = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.2), toon(gradient, 0xc0212a));
  kerchief.position.set(0, 1.75, 0.45);
  withOutline(kerchief);
  group.add(kerchief);
  group.add(makeSelectRing());
  return group;
}

// 0.10.2 (D-09): shared window geometry — small upright rectangles attached
// to each building. Per-kind placement is in WINDOW_LAYOUTS. Materials are
// MeshBasicMaterial (self-lit) so they read against fog regardless of light
// direction. Outline lines would distract — bare quads only.
const WINDOW_GEO = new THREE.PlaneGeometry(0.45, 0.55);

// Tuples are [x, y, z, rotationY]. Y is local to the building group; the
// building's body sits at varying heights so we hand-tune per kind.
const WINDOW_LAYOUTS = {
  bureau: [
    [-1.3, 1.6, 2.26, 0],
    [ 1.3, 1.6, 2.26, 0],
    [-1.3, 2.7, 2.26, 0],
    [ 1.3, 2.7, 2.26, 0],
    [-2.26, 1.6, 0,  Math.PI / 2],
    [-2.26, 2.7, 0,  Math.PI / 2],
  ],
  branch_bureau: [
    [-0.9, 1.4, 1.61, 0],
    [ 0.9, 1.4, 1.61, 0],
    [-1.61, 1.4, 0,  Math.PI / 2],
    [ 1.61, 1.4, 0,  Math.PI / 2],
  ],
  darkroom: [
    // Darkroom has no big windows by design (it's a darkroom) — just one
    // tiny safelight slit on each visible face.
    [-1.2, 1.0, 2.11, 0],
    [ 1.2, 1.0, 2.11, 0],
    [-2.11, 1.0, 0,  Math.PI / 2],
    [ 2.11, 1.0, 0,  Math.PI / 2],
  ],
};

// 0.10.2 (C-07): FxEvent visual builders. Each returns a mesh ready to be
// added to the scene at the emit's world-space anchor. Lifetimes are short
// (200–1000 ms) and `animateFx` interprets `t ∈ [0,1]` per kind.

function buildPickupRing() {
  const geo = new THREE.RingGeometry(0.4, 0.6, 24);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfff2c2, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  return mesh;
}

function buildVerifyFlash() {
  const geo = new THREE.PlaneGeometry(2.4, 2.4);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 1.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 1.2;
  return mesh;
}

function buildPrintSprite() {
  // White paper page that rises and scales — reads as "the front page just
  // came off the press" hovering above the Darkroom.
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1.0, 1.4);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf3eee2, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
  });
  const page = new THREE.Mesh(geo, mat);
  page.position.y = 2.8;
  // Subtle masthead bar so the page reads as "newspaper", not "blank rectangle".
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.95 }),
  );
  bar.position.set(0, 3.35, 0.01);
  group.add(page);
  group.add(bar);
  return group;
}

function buildDeathCross() {
  // Two crossed dark-red bars, lying flat on the ground at the death tile.
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x8a1a1a, transparent: true, opacity: 0.95 });
  const a = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.18), mat);
  a.position.y = 0.05;
  a.rotation.y = Math.PI / 4;
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.18), mat);
  b.position.y = 0.05;
  b.rotation.y = -Math.PI / 4;
  group.add(a);
  group.add(b);
  return group;
}

function buildRaidWarning() {
  // Red exclamation: a vertical bar with a dot below, hovering over the
  // raid's spawn tile. Pulses opacity over its 1-second lifetime.
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xc0212a, transparent: true, opacity: 0.95 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), mat);
  bar.position.y = 2.5;
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat);
  dot.position.y = 1.6;
  group.add(bar);
  group.add(dot);
  return group;
}

// 0.10.2 (C-07): animate one ephemeral FX mesh. `t` is the normalized
// lifetime (0 at spawn, 1 at expiry). Each kind has its own beat — the
// shared rule is "rises, expands, and fades."
function animateFx(entry, t) {
  const mesh = entry.mesh;
  if (entry.kind === 'pickup') {
    const scale = 1 + t * 2;
    mesh.scale.set(scale, scale, scale);
    setOpacity(mesh, 0.95 * (1 - t));
  } else if (entry.kind === 'verify') {
    // Bright snap → fast fade. Inverse-curve fade so the first 30% reads
    // as "instant flash", the rest as decay.
    setOpacity(mesh, 1.0 - Math.pow(t, 0.4));
  } else if (entry.kind === 'print') {
    // Rise + grow + fade out at the end.
    const scale = 0.6 + t * 0.8;
    mesh.scale.set(scale, scale, scale);
    mesh.position.y = (entry.basePosY ?? 0) + t * 1.5;
    setOpacity(mesh, t > 0.7 ? (1 - (t - 0.7) / 0.3) * 0.95 : 0.95);
  } else if (entry.kind === 'death') {
    setOpacity(mesh, 0.95 * (1 - t));
  } else if (entry.kind === 'raid_warning') {
    // Pulse: opacity oscillates twice over the lifetime.
    const pulse = 0.5 + 0.5 * Math.cos(t * Math.PI * 4);
    setOpacity(mesh, 0.4 + 0.55 * pulse);
  }
}

function setOpacity(mesh, opacity) {
  mesh.traverse((node) => {
    if (node.material) node.material.opacity = opacity;
  });
}

function disposeMesh(mesh) {
  mesh.traverse((node) => {
    if (node.geometry) node.geometry.dispose?.();
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose?.());
      else node.material.dispose?.();
    }
  });
}

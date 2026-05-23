// Late Edition — HUD corkboard (milestone 0.9; 0.10.1 adds the tutorial pin).
//
// The HUD is a corkboard. The 3D viewport is a window punched through it.
// Resource readouts are pinned index cards along the top; the deadline is a
// torn-edge ticker strip across the top of the viewport; selected unit,
// story queue, and threats are dossiers along the bottom.
// (Design Doc §13; ICD-01 v0.5 §HudState.)
//
// Pure renderer-side projection. Sim is the canonical source — HUD reads
// `frame.hud` + `frame.units` + `frame.buildings` + `frame.leads` and never
// reaches back into world state. Zero ICD changes at 0.9 — every field
// consumed here was already projected at v0.8 or earlier.
//
// Three sibling region projectors live behind one facade so main.js stays
// a single line. Each region diffs its own DOM (different change cadence —
// top cards mostly change at edition boundaries; the deadline ticker
// changes every frame; the dossier flips on selection).
//
// Projection helpers (`pickSelected`, `countByKind`, `tierHistogram`,
// `formatMs`, `formatEdition`) are exported so `tests/hud.test.mjs` can
// exercise them in node without jsdom.

import { currentTutorialBeat, BEAT_COPY } from './sim/tutorial.js';
import { getDistrict } from './sim/districts.js';
import { ARCHIVE_CAP } from './sim/world-state.js';
import { tileToPixel, worldXZToPixel, frustumQuad, GRID_W, MARGIN } from './render/minimap.js';
import { leadColorHex } from './render/lead-colors.js';
import { activeRemainingMs } from './slow-mo.js';

// Aligned with cycle-clock's DEADLINE_WARNING fire at T-30s (Design Doc §13 strip-
// turns-red beat). The optional CRITICAL_MS = 5_000 tighter pulse is deferred —
// the 10s pulse stays the locked Late Edition tension beat.
const WARNING_MS = 30_000;
const CRITICAL_MS = 10_000;

const UNIT_KIND_LABEL = {
  reporter: 'Reporter',
  photog:   'Photog',
  fixer:    'Fixer',
  editor:   'Editor',
  goon:     'Goon',
};

// 1.3.1 (#playtest-bug-1 + #playtest-bug-5): role caption shown under each
// selected unit's kind/state line. The v1.3.0 playtest revealed that the
// player has no way to learn unit functions — a Fixer was dispatched to the
// Darkroom (where only the Photog plates leads) and the game silently walked
// the Fixer there, parked it, and went back to IDLE. Similarly the Editor
// dispatch is rejected at sim level with no UI hint. One line in the dossier
// makes the role-affordance discoverable: the Photog caption is the single
// load-bearing line for the inner loop (the player sees "Plates leads at the
// Darkroom" and the Darkroom dispatch becomes self-teaching).
//
// Exported so tests/hud.test.mjs can lock the map and pin a regression if a
// kind is renamed in world-state.js without a caption update here.
export const ROLE_CAPTIONS = {
  reporter: 'Picks up leads in the field',
  photog:   'Plates leads at the Darkroom',
  fixer:    'Intercepts goons',
  editor:   'Stationed at the Bureau — directs your reporters',
};

// 1.1.1 (#334 · ICD-01 v0.6.6) — building dossier labels. Reads against the
// BuildingKind union from world-state.js. New kinds added there must extend
// this map (defensive fallback uses the raw kind for unknowns).
const BUILDING_KIND_LABEL = {
  bureau:         'Bureau',
  branch_bureau:  'Branch Bureau',
  darkroom:       'Darkroom',
  switchboard:    'Switchboard',
};

const UNIT_STATE_LABEL = {
  idle:     'Idle',
  walking:  'Walking',
  carrying: 'Carrying',
};

const LEAD_TIER_ORDER = ['whisper', 'investigation', 'arc'];
const LEAD_FLAVOR_ORDER = ['vice', 'violence', 'money', 'labor'];

export function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatEdition(n) {
  return `№ ${String(n).padStart(3, '0')}`;
}

export function pickSelected(units) {
  return units.find((u) => u.selected) ?? null;
}

export function countByKind(units, kind) {
  let n = 0;
  for (const u of units) if (u.kind === kind) n++;
  return n;
}

export function tierHistogram(leads) {
  const tiers = {};
  for (const t of LEAD_TIER_ORDER) tiers[t] = 0;
  const flavors = {};
  for (const f of LEAD_FLAVOR_ORDER) flavors[f] = 0;
  for (const l of leads) {
    if (Object.hasOwn(tiers, l.tier)) tiers[l.tier]++;
    if (Object.hasOwn(flavors, l.flavor)) flavors[l.flavor]++;
  }
  return { tiers, flavors };
}

export class HudCorkboard {
  // 1.0.1 (ICD-09 §HUD surface): `actions` carries player-gesture callbacks
  // the dossier wires to sim mutators. Today: { toggleArchive(storyId),
  // pickArcBranch(id, label), getView(), acceptPartnerOffer(),
  // declinePartnerOffer() }.
  // The HUD stays projection-only; gestures route through callbacks instead
  // of the HUD holding a World reference.
  // 1.1.2 (#337): `actions.getView` is the renderer-side read-only window
  // for the minimap's frustum overlay. Optional — when absent, the minimap
  // still draws everything except the frustum rect.
  // 1.2.0 (ICD-02 v0.3.3): `actions.acceptPartnerOffer` /
  // `declinePartnerOffer` wire the Observer partner-deal chip in the
  // Threats panel.
  constructor(roots, actions = {}) {
    this.top      = new TopCards(roots.topCards);
    this.deadline = new DeadlineStrip(roots.deadline);
    this.dossier  = new Dossier(roots.dossier, actions);
    // 0.10.1 (G-09): the tutorial-note pin sits above the resource cards;
    // hides itself when currentTutorialBeat() returns null (edition ≥ 3
    // or after the 30 s welcome window). Re-derives every frame so a
    // save/load lands on the correct beat with no persistence.
    this.tutorial = new TutorialNote(roots.tutorial);
    // 1.1.2 (#337): minimap is optional — when no canvas is mounted (or
    // the host page omits it), the rest of the HUD still functions.
    this.minimap = roots.minimap ? new Minimap(roots.minimap, actions) : null;
    // 1.3.1 (#playtest-bug-7): slow-mo pill — transient HUD readout that
    // surfaces the remaining active window. Reads via actions.getSlowMo()
    // each frame; hides itself when the window expires.
    this.slowMoPill = roots.slowMoPill ? new SlowMoPill(roots.slowMoPill, actions) : null;
    // 1.3.1 (#playtest-bug-3b): zoom pill — transient HUD readout that
    // surfaces the current zoom step for 1.2s after every [ / ] press
    // (including clamp-at-endpoint presses, which were previously invisible).
    // Reads zoomCallCount + zoomStep via actions.getView().
    this.zoomPill = roots.zoomPill ? new ZoomPill(roots.zoomPill, actions) : null;
  }

  apply(frame) {
    const bureau = frame.buildings.find((b) => b.kind === 'bureau');
    const bureauHp = bureau ? Math.ceil(bureau.hp) : 0;
    this.top.apply(frame.hud, bureauHp);
    this.deadline.apply(frame.hud);
    this.dossier.apply(frame, bureauHp);
    this.tutorial.apply(frame);
    if (this.minimap) this.minimap.apply(frame);
    if (this.slowMoPill) this.slowMoPill.apply(frame);
    if (this.zoomPill) this.zoomPill.apply(frame);
  }
}

// 1.3.1 (#playtest-bug-7): slow-mo pill. Visible only while the active
// 5 s window is counting down; reads remaining ms from the shared slow-mo
// state via actions.getSlowMo(). Pure projection — the player gesture
// (Space) lives in input.js; the loop owns the state transition; this
// just renders.
//
// Exported as a class so future host pages can wire it without the full
// HudCorkboard (e.g. a settings-screen "demo" of slow-mo).
export class SlowMoPill {
  constructor(rootEl, actions = {}) {
    this.root = rootEl;
    this.getSlowMo = typeof actions.getSlowMo === 'function' ? actions.getSlowMo : null;
    this.now = typeof actions.now === 'function' ? actions.now : () => performance.now();
    this._visible = false;
    this._lastText = '';
  }

  apply(_frame) {
    if (!this.getSlowMo) return;
    const state = this.getSlowMo();
    const remaining = activeRemainingMs(state, this.now());
    if (remaining <= 0) {
      if (this._visible) { this.root.hidden = true; this._visible = false; }
      return;
    }
    if (!this._visible) { this.root.hidden = false; this._visible = true; }
    // Tenths of a second — fast enough that the player sees a countdown,
    // not so fast that it shimmers. 5.0 → 0.1 over the 5 s active window.
    const seconds = (remaining / 1000).toFixed(1);
    const text = `SLOW-MO · ${seconds}s`;
    if (text !== this._lastText) {
      this.root.textContent = text;
      this._lastText = text;
    }
  }
}

// 1.3.1 (#playtest-bug-3b): zoom pill. Surfaces "ZOOM N/M" for 1.2 s after
// every renderer.stepZoom call. Detects calls via the monotonically-
// incrementing zoomCallCount on the view object (renderer increments even
// when clamped at endpoints so the player learns the boundary by seeing
// the same number repeat).
export class ZoomPill {
  constructor(rootEl, actions = {}) {
    this.root = rootEl;
    this.getView = typeof actions.getView === 'function' ? actions.getView : null;
    this.now = typeof actions.now === 'function' ? actions.now : () => performance.now();
    this._lastCallCount = null;  // null distinguishes "no view yet" from "0 presses"
    this._showUntilMs = 0;
    this._lastText = '';
    this._visible = false;
  }

  apply(_frame) {
    if (!this.getView) return;
    const view = this.getView();
    if (!view || typeof view.zoomCallCount !== 'number') return;
    const now = this.now();
    // First sighting of the view: latch the counter without firing the pill.
    if (this._lastCallCount === null) {
      this._lastCallCount = view.zoomCallCount;
    } else if (view.zoomCallCount !== this._lastCallCount) {
      this._lastCallCount = view.zoomCallCount;
      this._showUntilMs = now + ZOOM_PILL_VISIBLE_MS;
      const text = `ZOOM ${view.zoomStep + 1}/${view.zoomStepCount}`;
      if (text !== this._lastText) {
        this.root.textContent = text;
        this._lastText = text;
      }
    }
    const wantVisible = now < this._showUntilMs;
    if (wantVisible && !this._visible) { this.root.hidden = false; this._visible = true; }
    else if (!wantVisible && this._visible) { this.root.hidden = true; this._visible = false; }
  }
}

const ZOOM_PILL_VISIBLE_MS = 1200;

// 1.2.0 (ICD-02 v0.3.3 §DESPERATE body): partner-offer chip renders inside
// the Threats panel when WorldFrame.partnerOffer is non-null. Exported for
// hud.test.mjs.
export function renderPartnerOfferChip(offer) {
  const districtName = getDistrict(offer.district)?.name ?? offer.district;
  return `<div class="partner-offer" data-role="partner-offer">`
    + `<span class="po-headline">The Observer offers a deal</span>`
    + `<span class="po-terms">$${offer.cost} · ${offer.editions} editions · spare ${escapeHtml(districtName)}</span>`
    + `<span class="po-actions">`
    + `<button type="button" class="po-btn po-accept" data-action="partner-accept">Accept</button>`
    + `<button type="button" class="po-btn po-decline" data-action="partner-decline">Decline</button>`
    + `</span>`
    + `</div>`;
}

// 1.2.0: passive breadcrumb when the deal is active. No interaction — the
// player has already committed; the breadcrumb just confirms the constraint.
export function renderActivePartnerDealLine(deal) {
  const districtName = getDistrict(deal.district)?.name ?? deal.district;
  const eds = deal.editionsRemaining;
  return `<span class="partner-deal-line">Partner deal · ${eds} edition${eds === 1 ? '' : 's'} left · ${escapeHtml(districtName)} blocked</span>`;
}

class TutorialNote {
  constructor(rootEl) {
    this.root = rootEl;
    this.bodyEl = rootEl.querySelector('.body');
    this._lastBeat = undefined;  // distinct from null so the first apply latches
  }

  apply(frame) {
    const beat = currentTutorialBeat(frame);
    if (beat === this._lastBeat) return;
    this._lastBeat = beat;
    if (beat === null) {
      this.root.hidden = true;
      return;
    }
    this.root.hidden = false;
    this.bodyEl.textContent = BEAT_COPY[beat];
    this.root.dataset.beat = beat;
  }
}

// 1.1.2 (#337) — minimap HUD widget. North-up top-down projection of the
// 10×10 grid; reads frame.buildings/units/leads/stories/selectedBuilding,
// plus the renderer's view state via actions.getView() (pan + frustum +
// aspect) for the frustum overlay. Sub-millisecond redraw per frame.
//
// Colors lifted from js/render/renderer.js so the minimap reads as the same
// world the 3D scene draws: bureau-awning red, branch-bureau body brown,
// darkroom mast dark, switchboard tan, fixer-kerchief red, editor-visor
// green, etc. Goons are drawn as pure ink so the player sees them as
// danger irrespective of the noir palette.
//
// Lead flavor colors live in js/render/lead-colors.js (1.3.1) so this
// projection and the 3D scene's lead-diamond mesh stay in lockstep.
//
// Projection helpers (tileToPixel / worldXZToPixel / frustumQuad) are pure
// — see js/render/minimap.js and tests/minimap.test.mjs.
const MINIMAP_COLORS = {
  background: '#ece8df',         // --paper
  grid:       'rgba(106, 100, 92, 0.18)',  // --mid 18%
  districtDocks:    'rgba(74, 90, 122, 0.18)',  // labor-blue tint
  districtHillside: 'rgba(106, 122, 74, 0.18)', // money-olive tint
  bureau:        '#c0212a',
  branch_bureau: '#6b3a3a',
  darkroom:      '#1c1818',
  switchboard:   '#a68f6f',
  reporter: '#5a3f2a',
  photog:   '#3a3a3a',
  fixer:    '#c0212a',
  editor:   '#3a6a3a',
  goon:     '#0a0a0c',           // --ink
  selectionRing: '#f6c860',      // yellow ring (matches renderer.js selection)
  frustum:       '#0a0a0c',      // --ink
};

// District spawn rects, mirrored from js/sim/districts.js so the minimap
// doesn't have to import the full module for two 4×4 boxes. Tile coords
// (x, y, w, h). Re-confirm against districts.js on any T0 → T1 expansion.
const MINIMAP_DISTRICTS = [
  { id: 'docks',    rect: { x: 1, y: 1, w: 4, h: 4 }, fill: MINIMAP_COLORS.districtDocks },
  { id: 'hillside', rect: { x: 6, y: 1, w: 4, h: 4 }, fill: MINIMAP_COLORS.districtHillside },
];

class Minimap {
  constructor(canvasEl, actions = {}) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.size = canvasEl.width;  // square — width === height
    this.getView = actions.getView ?? null;
  }

  apply(frame) {
    const { ctx, size } = this;

    // 1. Clear + paper background.
    ctx.fillStyle = MINIMAP_COLORS.background;
    ctx.fillRect(0, 0, size, size);

    // 2. District overlays (faint colored fills inside the spawn rects).
    for (const d of MINIMAP_DISTRICTS) {
      const tl = tileToPixel({ x: d.rect.x, y: d.rect.y }, size);
      const br = tileToPixel({ x: d.rect.x + d.rect.w - 1, y: d.rect.y + d.rect.h - 1 }, size);
      const cell = (size - 2 * MARGIN) / GRID_W;
      ctx.fillStyle = d.fill;
      ctx.fillRect(tl.px - cell / 2, tl.py - cell / 2, (br.px - tl.px) + cell, (br.py - tl.py) + cell);
    }

    // 3. Grid lines (faint, every tile boundary).
    ctx.strokeStyle = MINIMAP_COLORS.grid;
    ctx.lineWidth = 1;
    const cell = (size - 2 * MARGIN) / GRID_W;
    ctx.beginPath();
    for (let i = 0; i <= GRID_W; i++) {
      const p = MARGIN + i * cell + 0.5;  // +0.5 keeps 1px lines crisp on integer pixel grid
      ctx.moveTo(MARGIN, p);              ctx.lineTo(size - MARGIN, p);
      ctx.moveTo(p, MARGIN);              ctx.lineTo(p, size - MARGIN);
    }
    ctx.stroke();

    // 4. Leads (small diamond, flavor-colored — shared with 3D scene via
    // js/render/lead-colors.js so a flavor recolor lands in both surfaces).
    for (const l of frame.leads ?? []) {
      const { px, py } = tileToPixel(l.pos, size);
      drawDiamond(ctx, px, py, 2.5, leadColorHex(l.flavor));
    }

    // 5. Buildings (kind-colored squares).
    const sel = frame.selectedBuilding;
    for (const b of frame.buildings ?? []) {
      const { px, py } = tileToPixel(b.pos, size);
      const fill = MINIMAP_COLORS[b.kind] ?? MINIMAP_COLORS.bureau;
      const r = 3;  // half-side of the 6×6 building square
      ctx.fillStyle = fill;
      ctx.fillRect(Math.round(px - r), Math.round(py - r), r * 2, r * 2);
      // Selection ring — match the renderer's selectionRing yellow.
      if (sel && sel.id === b.id) {
        ctx.strokeStyle = MINIMAP_COLORS.selectionRing;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(Math.round(px - r) - 1.5, Math.round(py - r) - 1.5, r * 2 + 3, r * 2 + 3);
      }
    }

    // 6. Units (filled circle, kind-colored). Player-controlled units render
    // first so they sit beneath goons (red over brown for an intercept beat).
    // Goons that survived the world's visibility filter (Switchboard LoS +
    // Bureau-adjacency reveal) draw in ink so the player sees the threat.
    for (const u of frame.units ?? []) {
      const { px, py } = tileToPixel(u.pos, size);
      const fill = MINIMAP_COLORS[u.kind] ?? MINIMAP_COLORS.goon;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(px, py, u.kind === 'goon' ? 2.5 : 2, 0, Math.PI * 2);
      ctx.fill();
      // Selection ring on selected unit too (mirrors the 3D yellow ring).
      if (u.selected) {
        ctx.strokeStyle = MINIMAP_COLORS.selectionRing;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 7. Frustum overlay — 4-vertex rhombus from frustumQuad on the ground.
    // Drawn last so it sits on top of everything. The rhombus is naturally
    // rotated ~45° in world XZ space because the iso camera reads "screen
    // right" as the NE-SW diagonal on the ground; players quickly learn
    // that the rhombus is the visible area.
    if (this.getView) {
      const view = this.getView();
      if (view) {
        const quad = frustumQuad(view.pan, view.frustum, view.aspect);
        ctx.strokeStyle = MINIMAP_COLORS.frustum;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < quad.length; i++) {
          const { px, py } = worldXZToPixel(quad[i], size);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
}

function drawDiamond(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx,     cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx,     cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
}

class TopCards {
  constructor(rootEl) {
    this.root = rootEl;
    this.cards = {
      edition:  rootEl.querySelector('[data-card="edition"] .val'),
      deadline: rootEl.querySelector('[data-card="deadline"] .val'),
      leads:    rootEl.querySelector('[data-card="leads"] .val'),
      stories:  rootEl.querySelector('[data-card="stories"] .val'),
      ink:      rootEl.querySelector('[data-card="ink"] .val'),
      cash:     rootEl.querySelector('[data-card="cash"] .val'),
      heat:     rootEl.querySelector('[data-card="heat"] .val'),
    };
    this.heatCard = rootEl.querySelector('[data-card="heat"]');
    this._last = {};
  }

  apply(hud, _bureauHp) {
    const next = {
      edition:  formatEdition(hud.edition),
      deadline: formatMs(hud.deadline_ms),
      leads:    String(hud.resources.leads),
      stories:  String(hud.resources.stories),
      ink:      String(hud.resources.ink),
      cash:     `$ ${hud.resources.cash}`,
      heat:     String(hud.resources.heat),
    };
    for (const k of Object.keys(next)) {
      if (this._last[k] !== next[k]) {
        this.cards[k].textContent = next[k];
        this._last[k] = next[k];
      }
    }
    // Heat is reverse currency — design doc §06 ties §19 thresholds at 40/60/80.
    // Use 40 as the visual hot line; matches the heat-driven raid trigger.
    const hot = hud.resources.heat >= 40;
    if (this._lastHot !== hot) {
      this.heatCard.classList.toggle('is-hot', hot);
      this._lastHot = hot;
    }
  }
}

class DeadlineStrip {
  constructor(rootEl) {
    this.root = rootEl;
    this.valEl = rootEl.querySelector('.val');
    this.edEl  = rootEl.querySelector('.ed');
    this._lastVal = '';
    this._lastEd = '';
    this._lastClass = '';
  }

  apply(hud) {
    const val = formatMs(hud.deadline_ms);
    if (val !== this._lastVal) {
      this.valEl.textContent = val;
      this._lastVal = val;
    }
    const ed = `Edition ${formatEdition(hud.edition)}`;
    if (ed !== this._lastEd) {
      this.edEl.textContent = ed;
      this._lastEd = ed;
    }
    let cls = '';
    if (hud.deadline_ms <= CRITICAL_MS && hud.deadline_ms > 0) cls = 'is-critical';
    else if (hud.deadline_ms <= WARNING_MS && hud.deadline_ms > 0) cls = 'is-warning';
    if (cls !== this._lastClass) {
      this.root.classList.remove('is-warning', 'is-critical');
      if (cls) this.root.classList.add(cls);
      this._lastClass = cls;
    }
  }
}

class Dossier {
  // 1.0.1: `actions` carries the HUD's player-gesture callbacks. Today only
  // toggleArchive(storyId) is consumed; future row clicks (e.g., select-from-
  // queue) attach the same way.
  // 1.2.0 (ICD-02 v0.3.3): `acceptPartnerOffer` / `declinePartnerOffer`
  // wire the Threats-panel partner chip.
  constructor(rootEl, actions = {}) {
    this.root = rootEl;
    this.actions = actions;
    this.selectedEl = rootEl.querySelector('[data-panel="selected"]');
    this.selectedBody = this.selectedEl.querySelector('.body');
    this.queueEl = rootEl.querySelector('[data-panel="queue"]');
    this.queueBody = this.queueEl.querySelector('.body');
    this.threatsEl = rootEl.querySelector('[data-panel="threats"]');
    this.threatsBody = this.threatsEl.querySelector('.body');
    this._lastSelected = null;
    this._lastQueue = '';
    this._lastThreats = '';
    // 1.0.1 (ICD-09 v0.1.1 §Open Q1 close): per-story row left-click toggles
    // verified ↔ archived. Single delegated listener on the queue body so
    // it survives every innerHTML rebuild in _applyQueue.
    this.queueBody.addEventListener('click', (ev) => this._onQueueClick(ev));
    // 1.2.0 (ICD-02 v0.3.3): partner-offer Accept / Decline chip in Threats.
    // Delegated listener on the threats body so it survives every innerHTML
    // rebuild in _applyThreats. Same pattern as the queue-row toggle above.
    this.threatsBody.addEventListener('click', (ev) => this._onThreatsClick(ev));
  }

  apply(frame, bureauHp) {
    this._applySelected(frame.units, frame.selectedBuilding ?? null);
    this._applyQueue(
      frame.leads,
      frame.stories ?? [],
      frame.hud.resources.stories,
      frame.hud.resources.archived ?? 0,
    );
    this._applyThreats(
      frame.units,
      bureauHp,
      frame.partnerOffer ?? null,
      frame.activePartnerDeal ?? null,
    );
  }

  // 1.1.1 (#334 · ICD-01 v0.6.6): selection card now serves units OR buildings.
  // Building selection wins when present — sim already enforces mutual
  // exclusivity (selectBuilding/selectUnit clear each other), so this is a
  // read-side check, not a precedence rule.
  _applySelected(units, selectedBuilding) {
    if (selectedBuilding) {
      this._applySelectedBuilding(selectedBuilding);
      return;
    }
    const u = pickSelected(units);
    // 1.0.1 (ICD-01 v0.6 §UnitView.stats projector): bake stats into the
    // diff key so the Reporter trio change re-renders the pane.
    const statsKey = u && u.stats ? `${u.stats.nerve}/${u.stats.nose}/${u.stats.legs}` : '';
    const key = u ? `unit|${u.id}|${u.kind}|${u.state}|${u.carrying ?? ''}|${statsKey}` : '';
    if (key === this._lastSelected) return;
    this._lastSelected = key;
    if (!u) {
      this.selectedEl.classList.add('empty');
      this.selectedBody.innerHTML = 'No selection';
      return;
    }
    this.selectedEl.classList.remove('empty');
    const kindLabel = UNIT_KIND_LABEL[u.kind] ?? u.kind;
    const stateLabel = UNIT_STATE_LABEL[u.state] ?? u.state;
    const carryingNote = u.carrying === 'lead' ? ' · Carrying lead' : '';
    // 1.0.1: §13 Selected · Reporter trio ("Nerve 6 · Nose 8 · Legs 4"). Only
    // Reporter UnitView carries `stats` at Tier-0; other kinds skip the line.
    const statsLine = u.stats
      ? `<span class="stats">Nerve ${u.stats.nerve} · Nose ${u.stats.nose} · Legs ${u.stats.legs}</span>`
      : '';
    // 1.3.1: role caption (see ROLE_CAPTIONS comment above). Goons get no
    // caption (they're not player units; selecting them shouldn't even be
    // possible at the input layer, but defend anyway). Unknown kinds skip
    // silently so adding a new UnitKind doesn't crash the dossier.
    const roleCaption = ROLE_CAPTIONS[u.kind];
    const roleLine = roleCaption ? `<span class="unit-role">${escapeHtml(roleCaption)}</span>` : '';
    this.selectedBody.innerHTML = `${escapeHtml(kindLabel)}<span class="note">${escapeHtml(stateLabel)}${escapeHtml(carryingNote)}</span>${statsLine}${roleLine}`;
  }

  _applySelectedBuilding(b) {
    const key = `building|${b.id}|${b.kind}|${b.hp}/${b.hp_max}|${b.district}`;
    if (key === this._lastSelected) return;
    this._lastSelected = key;
    this.selectedEl.classList.remove('empty');
    const kindLabel = BUILDING_KIND_LABEL[b.kind] ?? b.kind;
    const districtLabel = getDistrict(b.district)?.name ?? b.district;
    const hp = Math.ceil(b.hp);
    this.selectedBody.innerHTML = `${escapeHtml(kindLabel)}<span class="note">${hp}/${b.hp_max} HP · ${escapeHtml(districtLabel)}</span>`;
  }

  _applyQueue(leads, stories, storyCount, archivedCount) {
    const { tiers, flavors } = tierHistogram(leads);
    const tierLine = LEAD_TIER_ORDER
      .filter((t) => tiers[t] > 0)
      .map((t) => `${tiers[t]} ${t}`)
      .join(' · ');
    const flavorLine = LEAD_FLAVOR_ORDER
      .filter((f) => flavors[f] > 0)
      .map((f) => `${f} ${flavors[f]}`)
      .join(' · ');
    const verifiedCount = storyCount;
    const headline = leads.length === 0
      ? 'No active leads'
      : `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'} on the board`;
    const noteParts = [];
    if (tierLine) noteParts.push(tierLine);
    if (flavorLine) noteParts.push(flavorLine);
    // 1.0.1 (ICD-09 §HUD surface): `verified: N · archived: M/5`. Cap surfaces
    // so the player has feedback when the cap fills.
    noteParts.push(`verified: ${verifiedCount}`);
    noteParts.push(`archived: ${archivedCount}/${ARCHIVE_CAP}`);
    const note = noteParts.join(' · ');
    // Per-story rows for verified + archived held at Darkroom. Left-click on
    // a row routes through this.actions.toggleArchive(storyId).
    // 1.1.0 (ICD-10 v0.1.1 §HUD surface): arc stories surface a branch-pick
    // chip-strip; investigation chain stories surface their depth as
    // "Investigation N/3" in the meta line. Arc breadcrumb sits above the
    // headline so the player sees the arc name before the episode title.
    const rowsHtml = stories.map((s) => renderStoryRow(s)).join('');
    const key = `${headline}||${note}||${stories.map((s) => `${s.id}:${s.state}:${s.arc_branch_label ?? ''}`).join('|')}`;
    if (key === this._lastQueue) return;
    this._lastQueue = key;
    const isEmpty = leads.length === 0 && storyCount === 0 && archivedCount === 0;
    this.queueEl.classList.toggle('empty', isEmpty);
    this.queueBody.innerHTML = `${escapeHtml(headline)}<span class="note">${escapeHtml(note)}</span>${rowsHtml}`;
  }

  _onQueueClick(ev) {
    if (!(ev.target instanceof Element)) return;
    // 1.1.0 (ICD-10 v0.1.1 §Open-Q3): arc branch-pick chip click. Routes
    // through this.actions.pickArcBranch(storyId, label). The chip carries
    // both data-story-id and data-branch-label; check the more-specific
    // action first so the outer toggle-archive listener doesn't swallow it.
    const branchChip = ev.target.closest('[data-action="pick-branch"]');
    if (branchChip) {
      ev.stopPropagation();
      const storyId = branchChip.dataset.storyId;
      const label = branchChip.dataset.branchLabel;
      if (storyId && label && typeof this.actions.pickArcBranch === 'function') {
        this.actions.pickArcBranch(storyId, label);
      }
      return;
    }
    const target = ev.target.closest('[data-action="toggle-archive"]');
    if (!target) return;
    const storyId = target.dataset.storyId;
    if (!storyId || typeof this.actions.toggleArchive !== 'function') return;
    this.actions.toggleArchive(storyId);
  }

  _applyThreats(units, bureauHp, partnerOffer, activePartnerDeal) {
    const goons = countByKind(units, 'goon');
    const headline = goons === 0 ? 'Streets quiet' : `${goons} ${goons === 1 ? 'goon' : 'goons'} abroad`;
    const note = `Press ${bureauHp} HP`;
    // 1.2.0 (ICD-02 v0.3.3 §DESPERATE body): partner-deal surfaces. The chip
    // shows when a PARTNER_REQUEST is outstanding; the breadcrumb shows
    // while the accepted deal ticks down. Both panels can coexist with goons
    // / press-hp lines — the Threats card now carries multiple concerns.
    const offerHtml = partnerOffer ? renderPartnerOfferChip(partnerOffer) : '';
    const dealHtml = activePartnerDeal ? renderActivePartnerDealLine(activePartnerDeal) : '';
    const offerKey = partnerOffer
      ? `offer:${partnerOffer.district}:${partnerOffer.cost}:${partnerOffer.editions}`
      : '';
    const dealKey = activePartnerDeal
      ? `deal:${activePartnerDeal.district}:${activePartnerDeal.editionsRemaining}`
      : '';
    const key = `${headline}||${note}||${offerKey}||${dealKey}`;
    if (key === this._lastThreats) return;
    this._lastThreats = key;
    const isEmpty = goons === 0 && !partnerOffer && !activePartnerDeal;
    this.threatsEl.classList.toggle('empty', isEmpty);
    this.threatsBody.innerHTML =
      `${escapeHtml(headline)}<span class="note">${escapeHtml(note)}</span>${dealHtml}${offerHtml}`;
  }

  _onThreatsClick(ev) {
    if (!(ev.target instanceof Element)) return;
    const accept = ev.target.closest('[data-action="partner-accept"]');
    if (accept) {
      ev.stopPropagation();
      if (typeof this.actions.acceptPartnerOffer === 'function') this.actions.acceptPartnerOffer();
      return;
    }
    const decline = ev.target.closest('[data-action="partner-decline"]');
    if (decline) {
      ev.stopPropagation();
      if (typeof this.actions.declinePartnerOffer === 'function') this.actions.declinePartnerOffer();
    }
  }
}


function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// 1.1.0 (ICD-10 v0.1.1 §HUD surface): one Story queue row. Renders the base
// row (headline + meta), then layers HOLD chip, Investigation chain depth,
// and Arc breadcrumb + branch chips when the corresponding fields are set.
// Exported for hud.test.mjs.
export function renderStoryRow(s) {
  const districtName = getDistrict(s.district)?.name ?? s.district;
  const archivedChip = s.state === 'archived' ? '<span class="chip is-hold">HOLD</span>' : '';
  const cls = s.state === 'archived' ? 'story-row is-archived' : 'story-row';
  // Investigation chain depth — "Investigation 2/3" appended to meta line.
  const chainSuffix = s.chain_depth
    ? ` · Investigation ${s.chain_depth}/3`
    : '';
  // Arc breadcrumb + branch chip strip. The arc id is encoded in the episode
  // id prefix (e.g. 'longshoreman_strike.walkout' → 'Longshoreman Strike').
  let arcLine = '';
  if (s.arc_episode_id) {
    const arcLabel = arcDisplayName(s.arc_episode_id.split('.')[0]);
    const pickedNote = s.arc_branch_label
      ? `<span class="arc-picked">Picked: ${escapeHtml(s.arc_branch_label)}</span>`
      : '';
    const chipsHtml = (s.branch_choices ?? []).map((c) =>
      `<button type="button" class="arc-chip" data-action="pick-branch" data-story-id="${escapeHtml(s.id)}" data-branch-label="${escapeHtml(c.label)}">${escapeHtml(c.label)}</button>`,
    ).join('');
    arcLine = `<div class="arc-line">Arc · ${escapeHtml(arcLabel)}${pickedNote}${chipsHtml ? `<span class="arc-chips">${chipsHtml}</span>` : ''}</div>`;
  }
  return `<div class="${cls}" data-action="toggle-archive" data-story-id="${escapeHtml(s.id)}">${arcLine}${archivedChip}<span class="hl">${escapeHtml(s.headline)}</span><span class="meta">${escapeHtml(s.flavor)} · ${escapeHtml(districtName)}${escapeHtml(chainSuffix)}</span></div>`;
}

function arcDisplayName(arcId) {
  // 'longshoreman_strike' → 'Longshoreman Strike'. Title-case each underscore
  // segment; defensive against unknown arc ids (returns the raw id).
  return arcId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

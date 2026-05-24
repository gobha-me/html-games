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

import { currentTutorialBeat, BEAT_COPY, TUTORIAL_BEATS } from './sim/tutorial.js';
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

export function displaySelected(units) {
  return pickSelected(units) ?? units.find((u) => u.kind === 'reporter') ?? null;
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
    this.dossier  = new Dossier(roots.dossier, actions);
    this.tutorial = new TutorialBubble(roots.tutorial);
    this.minimap = roots.minimap ? new Minimap(roots.minimap, actions, roots.minimapLabel) : null;
    this.slowMoPill = roots.slowMoPill ? new SlowMoPill(roots.slowMoPill, actions) : null;
    this.zoomPill = roots.zoomPill ? new ZoomPill(roots.zoomPill, actions) : null;
    this.helpPopover = roots.helpPopover
      ? new HelpPopover(roots.helpPopover, actions)
      : null;
  }

  apply(frame) {
    const bureau = frame.buildings.find((b) => b.kind === 'bureau');
    const bureauHp = bureau ? Math.ceil(bureau.hp) : 0;
    this.top.apply(frame.hud, bureauHp);
    this.dossier.apply(frame, bureauHp);
    this.tutorial.apply(frame);
    if (this.minimap) this.minimap.apply(frame);
    if (this.slowMoPill) this.slowMoPill.apply(frame);
    if (this.zoomPill) this.zoomPill.apply(frame);
    if (this.helpPopover) this.helpPopover.apply(frame);
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

// 1.4.0: settings popover. Gear-icon button toggles a panel that exposes
// player-tunable preferences: pan-speed multiplier (already wired through
// js/preferences.js at v1.3.1 — this surfaces the slider for it) + per-
// channel audio mute toggles against the audio-bus mute(channel?) primitive
// shipped unwired at v1.3.0. Renderer-only: no sim contact, no ICD bumps.
//
// Element refs are passed in directly rather than queried from a root so
// the class is testable against minimal stubs (mirrors the SlowMoPill/
// ZoomPill stub-element pattern in tests/hud.test.mjs). main.js queries
// the DOM and assembles the refs object.
//
// channelButtons is an array of { channel, el } pairs; channel === undefined
// for the master toggle, else one of AUDIO_CHANNELS ('sfx' / 'amb' / 'mus'
// / 'vo'). Buttons should carry a data-channel attribute matching their
// channel id ('master' for the undefined channel) so the click handler can
// recover it without an in-class lookup.
export class HelpPopover {
  constructor(refs, actions = {}) {
    this.helpButton    = refs.helpButton ?? null;
    this.panel         = refs.panel ?? null;
    this.slider        = refs.slider ?? null;
    this.sliderValue   = refs.sliderValue ?? null;
    this.closeButton   = refs.closeButton ?? null;
    this.channelButtons = Array.isArray(refs.channelButtons) ? refs.channelButtons : [];
    this.actions = actions;
    this._open = false;

    if (this.helpButton && typeof this.helpButton.addEventListener === 'function') {
      this.helpButton.addEventListener('click', () => this.toggle());
    }
    if (this.closeButton && typeof this.closeButton.addEventListener === 'function') {
      this.closeButton.addEventListener('click', () => this.close());
    }
    if (this.slider && typeof this.slider.addEventListener === 'function') {
      this.slider.addEventListener('input', () => this._onSliderInput());
    }
    for (const entry of this.channelButtons) {
      if (entry && entry.el && typeof entry.el.addEventListener === 'function') {
        entry.el.addEventListener('click', () => this._onChannelToggleClick(entry));
      }
    }
    // Document-level: outside-click + Escape. Both optional — tests pass
    // refs.document = null to skip them. Browser defaults to globalThis.document.
    const doc = refs.document !== undefined
      ? refs.document
      : (typeof document !== 'undefined' ? document : null);
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('click', (ev) => this._onDocumentClick(ev));
      doc.addEventListener('keydown', (ev) => this._onKeydown(ev));
    }

    // First open() snapshots the persisted state into the controls. We do
    // NOT refresh at construction because the action callbacks may close
    // over modules built after the HUD (audioBus is constructed after
    // HudCorkboard in main.js; calling its getter from the constructor
    // would dereference an undefined variable).
  }

  apply(_frame) { /* event-driven; nothing to do per frame */ }

  toggle() { if (this._open) this.close(); else this.open(); }

  open() {
    if (this._open) return;
    this._open = true;
    if (this.panel) this.panel.hidden = false;
    if (this.helpButton && typeof this.helpButton.setAttribute === 'function') {
      this.helpButton.setAttribute('aria-expanded', 'true');
    }
    this._refresh();
  }

  close() {
    if (!this._open) return;
    this._open = false;
    if (this.panel) this.panel.hidden = true;
    if (this.helpButton && typeof this.helpButton.setAttribute === 'function') {
      this.helpButton.setAttribute('aria-expanded', 'false');
    }
  }

  isOpen() { return this._open; }

  _refresh() {
    if (this.slider && typeof this.actions.getPanSpeedMultiplier === 'function') {
      const v = this.actions.getPanSpeedMultiplier();
      this.slider.value = String(v);
      if (this.sliderValue) this.sliderValue.textContent = formatPanSpeedLabel(v);
    }
    if (typeof this.actions.getChannelMuted === 'function') {
      for (const entry of this.channelButtons) {
        if (!entry || !entry.el) continue;
        const muted = this.actions.getChannelMuted(entry.channel) === true;
        renderChannelButtonState(entry.el, muted);
      }
    }
  }

  _onSliderInput() {
    if (!this.slider) return;
    const v = Number(this.slider.value);
    if (!Number.isFinite(v) || v <= 0) return;
    if (typeof this.actions.setPanSpeedMultiplier === 'function') {
      this.actions.setPanSpeedMultiplier(v);
    }
    if (this.sliderValue) this.sliderValue.textContent = formatPanSpeedLabel(v);
  }

  _onChannelToggleClick(entry) {
    if (!entry || !entry.el) return;
    if (typeof this.actions.toggleChannelMute === 'function') {
      this.actions.toggleChannelMute(entry.channel);
    }
    if (typeof this.actions.getChannelMuted === 'function') {
      const muted = this.actions.getChannelMuted(entry.channel) === true;
      renderChannelButtonState(entry.el, muted);
    }
  }

  _onDocumentClick(ev) {
    if (!this._open) return;
    const target = ev && ev.target;
    if (!target) return;
    if (this.helpButton && typeof this.helpButton.contains === 'function' && this.helpButton.contains(target)) return;
    if (this.panel && typeof this.panel.contains === 'function' && this.panel.contains(target)) return;
    this.close();
  }

  _onKeydown(ev) {
    if (!this._open) return;
    if (ev && ev.key === 'Escape') this.close();
  }
}

// One decimal place, multiplier "×" suffix. "1.0×" reads as the default;
// "2.5×" reads as "two and a half times faster" without a units gloss.
// Exported for tests so the format lock survives a copy refactor.
export function formatPanSpeedLabel(v) {
  return `${Number(v).toFixed(1)}×`;
}

function renderChannelButtonState(el, muted) {
  if (el.classList && typeof el.classList.toggle === 'function') {
    el.classList.toggle('is-muted', muted);
  }
  if (typeof el.setAttribute === 'function') {
    el.setAttribute('aria-pressed', String(muted));
  }
}

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

// 1.5.0 (ICD-02 v0.3.4 §Herald §BUYOUT body): buyout-offer chip renders in
// the Threats panel when WorldFrame.buyoutOffer is non-null. Accept routes
// to the Establishment ending (game-over overlay mounts with the win
// banner); Decline locks Herald into PUNISH for the rest of the run.
// Mirrors renderPartnerOfferChip — same Accept | Decline shape, same
// data-action attribute routing through Dossier._onThreatsClick. Exported
// for hud.test.mjs.
export function renderBuyoutOfferChip(offer) {
  const amountStr = `$${offer.amount.toLocaleString('en-US')}`;
  return `<div class="buyout-offer" data-role="buyout-offer">`
    + `<span class="bo-headline">The Herald offers a buyout</span>`
    + `<span class="bo-terms">${escapeHtml(amountStr)} · Establishment ending</span>`
    + `<span class="bo-actions">`
    + `<button type="button" class="bo-btn bo-accept" data-action="buyout-accept">Accept</button>`
    + `<button type="button" class="bo-btn bo-decline" data-action="buyout-decline">Decline</button>`
    + `</span>`
    + `</div>`;
}

class TutorialBubble {
  constructor(rootEl) {
    this.root = rootEl;
    this.bodyEl = rootEl.querySelector('.body');
    this.stepEl = rootEl.querySelector('.step');
    this._lastBeat = undefined;
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
    if (this.stepEl) {
      const idx = TUTORIAL_BEATS.indexOf(beat) + 1;
      this.stepEl.textContent = `${idx} / ${TUTORIAL_BEATS.length}`;
    }
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
  constructor(canvasEl, actions = {}, labelEl = null) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.size = canvasEl.width;
    this.getView = actions.getView ?? null;
    this.labelEl = labelEl;
    this._lastLabel = '';
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

    if (this.labelEl) {
      const bureau = frame.buildings.find((b) => b.kind === 'bureau');
      const label = bureau ? `Press · ${Math.ceil(bureau.hp)} HP` : '';
      if (label !== this._lastLabel) {
        this.labelEl.textContent = label;
        this._lastLabel = label;
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
      edition:  rootEl.querySelector('[data-stat="edition"] .v'),
      deadline: rootEl.querySelector('[data-stat="deadline"] .v'),
      leads:    rootEl.querySelector('[data-stat="leads"] .v'),
      stories:  rootEl.querySelector('[data-stat="stories"] .v'),
      ink:      rootEl.querySelector('[data-stat="ink"] .v'),
      cash:     rootEl.querySelector('[data-stat="cash"] .v'),
      heat:     rootEl.querySelector('[data-stat="heat"] .v'),
    };
    this.deadlineStat = rootEl.querySelector('[data-stat="deadline"]');
    this.heatStat = rootEl.querySelector('[data-stat="heat"]');
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
    let dlCls = '';
    if (hud.deadline_ms <= CRITICAL_MS && hud.deadline_ms > 0) dlCls = 'is-critical';
    else if (hud.deadline_ms <= WARNING_MS && hud.deadline_ms > 0) dlCls = 'is-warning';
    if (dlCls !== this._lastDlCls) {
      this.deadlineStat.classList.remove('is-warning', 'is-critical');
      if (dlCls) this.deadlineStat.classList.add(dlCls);
      this._lastDlCls = dlCls;
    }
    const hot = hud.resources.heat >= 40;
    if (this._lastHot !== hot) {
      this.heatStat.classList.toggle('is-hot', hot);
      this._lastHot = hot;
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
      frame.buyoutOffer ?? null,
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
    const u = displaySelected(units);
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

  _applyThreats(units, bureauHp, partnerOffer, activePartnerDeal, buyoutOffer) {
    const goons = countByKind(units, 'goon');
    const headline = goons === 0 ? 'Streets quiet' : `${goons} ${goons === 1 ? 'goon' : 'goons'} abroad`;
    const note = `Press ${bureauHp} HP`;
    // 1.2.0 (ICD-02 v0.3.3 §DESPERATE body): partner-deal surfaces. The chip
    // shows when a PARTNER_REQUEST is outstanding; the breadcrumb shows
    // while the accepted deal ticks down. Both panels can coexist with goons
    // / press-hp lines — the Threats card now carries multiple concerns.
    // 1.5.0 (ICD-02 v0.3.4 §BUYOUT body): Herald buyout chip joins the
    // Threats card alongside partner-deal surfaces. Both chips can outstand
    // at once (different rivals); both route via Dossier._onThreatsClick.
    const offerHtml = partnerOffer ? renderPartnerOfferChip(partnerOffer) : '';
    const dealHtml = activePartnerDeal ? renderActivePartnerDealLine(activePartnerDeal) : '';
    const buyoutHtml = buyoutOffer ? renderBuyoutOfferChip(buyoutOffer) : '';
    const offerKey = partnerOffer
      ? `offer:${partnerOffer.district}:${partnerOffer.cost}:${partnerOffer.editions}`
      : '';
    const dealKey = activePartnerDeal
      ? `deal:${activePartnerDeal.district}:${activePartnerDeal.editionsRemaining}`
      : '';
    const buyoutKey = buyoutOffer ? `buyout:${buyoutOffer.amount}` : '';
    const key = `${headline}||${note}||${offerKey}||${dealKey}||${buyoutKey}`;
    if (key === this._lastThreats) return;
    this._lastThreats = key;
    const isEmpty = goons === 0 && !partnerOffer && !activePartnerDeal && !buyoutOffer;
    this.threatsEl.classList.toggle('empty', isEmpty);
    this.threatsBody.innerHTML =
      `${escapeHtml(headline)}<span class="note">${escapeHtml(note)}</span>${dealHtml}${offerHtml}${buyoutHtml}`;
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
      return;
    }
    // 1.5.0 (ICD-02 v0.3.4 §Herald §BUYOUT body): Accept | Decline chip in
    // Threats. Same delegated-listener pattern as the partner chip above;
    // Accept routes to the Establishment ending via World.acceptBuyout;
    // Decline locks Herald into PUNISH via World.declineBuyout.
    const buyoutAccept = ev.target.closest('[data-action="buyout-accept"]');
    if (buyoutAccept) {
      ev.stopPropagation();
      if (typeof this.actions.acceptBuyout === 'function') this.actions.acceptBuyout();
      return;
    }
    const buyoutDecline = ev.target.closest('[data-action="buyout-decline"]');
    if (buyoutDecline) {
      ev.stopPropagation();
      if (typeof this.actions.declineBuyout === 'function') this.actions.declineBuyout();
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
  // 1.5.0 (ICD-01 v0.6.8 · ICD-02 v0.3.4 §Herald §PUNISH body): scooped
  // stories carry a [SCOOPED] badge in the dossier row. The row is non-
  // interactive (no toggle-archive routing) for scooped lead-state stories
  // since they're not held at the Darkroom — the dossier surfaces the loss
  // only. Scooped verified-at-Darkroom rows can still be archived (player
  // may want to clear the queue), so the toggle-archive routing stays on
  // those rows. CSS class is-scooped lets the surface style itself.
  const scoopedChip = s.scooped ? '<span class="chip is-scooped">SCOOPED</span>' : '';
  let cls = s.state === 'archived' ? 'story-row is-archived' : 'story-row';
  if (s.scooped) cls += ' is-scooped';
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
  return `<div class="${cls}" data-action="toggle-archive" data-story-id="${escapeHtml(s.id)}">${arcLine}${archivedChip}${scoopedChip}<span class="hl">${escapeHtml(s.headline)}</span><span class="meta">${escapeHtml(s.flavor)} · ${escapeHtml(districtName)}${escapeHtml(chainSuffix)}</span></div>`;
}

function arcDisplayName(arcId) {
  // 'longshoreman_strike' → 'Longshoreman Strike'. Title-case each underscore
  // segment; defensive against unknown arc ids (returns the raw id).
  return arcId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

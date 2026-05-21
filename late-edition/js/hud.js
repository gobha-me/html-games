// Late Edition — HUD corkboard (milestone 0.9).
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
  constructor(roots) {
    this.top      = new TopCards(roots.topCards);
    this.deadline = new DeadlineStrip(roots.deadline);
    this.dossier  = new Dossier(roots.dossier);
  }

  apply(frame) {
    const bureau = frame.buildings.find((b) => b.kind === 'bureau');
    const bureauHp = bureau ? Math.ceil(bureau.hp) : 0;
    this.top.apply(frame.hud, bureauHp);
    this.deadline.apply(frame.hud);
    this.dossier.apply(frame, bureauHp);
  }
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
  constructor(rootEl) {
    this.root = rootEl;
    this.selectedEl = rootEl.querySelector('[data-panel="selected"]');
    this.selectedBody = this.selectedEl.querySelector('.body');
    this.queueEl = rootEl.querySelector('[data-panel="queue"]');
    this.queueBody = this.queueEl.querySelector('.body');
    this.threatsEl = rootEl.querySelector('[data-panel="threats"]');
    this.threatsBody = this.threatsEl.querySelector('.body');
    this._lastSelected = null;
    this._lastQueue = '';
    this._lastThreats = '';
  }

  apply(frame, bureauHp) {
    this._applySelected(frame.units);
    this._applyQueue(frame.leads, frame.hud.resources.stories);
    this._applyThreats(frame.units, bureauHp);
  }

  _applySelected(units) {
    const u = pickSelected(units);
    const key = u ? `${u.id}|${u.kind}|${u.state}|${u.carrying ?? ''}` : '';
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
    this.selectedBody.innerHTML = `${escapeHtml(kindLabel)}<span class="note">${escapeHtml(stateLabel)}${escapeHtml(carryingNote)}</span>`;
  }

  _applyQueue(leads, storyCount) {
    const { tiers, flavors } = tierHistogram(leads);
    const tierLine = LEAD_TIER_ORDER
      .filter((t) => tiers[t] > 0)
      .map((t) => `${tiers[t]} ${t}`)
      .join(' · ');
    const flavorLine = LEAD_FLAVOR_ORDER
      .filter((f) => flavors[f] > 0)
      .map((f) => `${f} ${flavors[f]}`)
      .join(' · ');
    const headline = leads.length === 0
      ? 'No active leads'
      : `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'} on the board`;
    const noteParts = [];
    if (tierLine) noteParts.push(tierLine);
    if (flavorLine) noteParts.push(flavorLine);
    noteParts.push(`${storyCount} in flight`);
    const note = noteParts.join(' · ');
    const key = `${headline}||${note}`;
    if (key === this._lastQueue) return;
    this._lastQueue = key;
    const isEmpty = leads.length === 0 && storyCount === 0;
    this.queueEl.classList.toggle('empty', isEmpty);
    this.queueBody.innerHTML = `${escapeHtml(headline)}<span class="note">${escapeHtml(note)}</span>`;
  }

  _applyThreats(units, bureauHp) {
    const goons = countByKind(units, 'goon');
    const headline = goons === 0 ? 'Streets quiet' : `${goons} ${goons === 1 ? 'goon' : 'goons'} abroad`;
    const note = `Press ${bureauHp} HP`;
    const key = `${headline}||${note}`;
    if (key === this._lastThreats) return;
    this._lastThreats = key;
    const isEmpty = goons === 0;
    this.threatsEl.classList.toggle('empty', isEmpty);
    this.threatsBody.innerHTML = `${escapeHtml(headline)}<span class="note">${escapeHtml(note)}</span>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

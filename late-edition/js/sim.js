// ============================================================================
// LATE EDITION // 1947 — Noir Newspaper, Field Operatives & Press Cycle Sim
// ============================================================================

import {
  WORLD_W,
  WORLD_H,
  EDITION_DURATION_SEC,
  EDITION_TIME_SCALE,
  LEAD_LIFETIME_SEC,
  isUnlocked,
  DISTRICTS,
  OPERATIVE_ROSTER,
  FRONT_PAGE_SLOTS,
  STORY_CATALOG,
  INVESTIGATIVE_ARCS,
  EDITORIAL_DILEMMAS,
} from './config.js';

import { mulberry32 } from './rng.js';
import { createAudioAdapter, sanitizeBestScore } from './adapters.js';
import { presentation } from './presentation.js';

// Match the browser frame cap. Bound catch-up work as well as movement per tick.
export const MAX_SUBSTEP_SEC = 0.05;
export const MAX_CATCHUP_SEC = 10;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function withoutCosmetics(record) {
  const cosmeticKeys = ['angle', 'stepPhase', 'state', 'color', 'headline', 'subdeck',
    'seriesBadge', 'arcTitle', 'arcCode', 'districtName', 'name', 'callsign', 'roleLabel',
    'sprite', 'label', 'caller', 'prompt', 'acceptLabel', 'rejectLabel', 'wire'];
  return Object.fromEntries(Object.entries(record)
    .filter(([key]) => !cosmeticKeys.includes(key))
    .map(([key, value]) => [key, value && typeof value === 'object'
      ? withoutCosmetics(value) : value]));
}

export class LateEditionSim {
  constructor({ seed = 0, rng, storage, audio, now } = {}) {
    this.seed = seed;
    this.injectedRng = rng;
    this.storage = storage;
    this.audio = createAudioAdapter(audio);
    // The default clock follows simulated time; callers may inject a replay clock.
    this.now = now ?? (() => this.time * 1000);
    this.highCirculation = 0;
    try {
      this.highCirculation = sanitizeBestScore(this.storage?.readBest());
    } catch {
      // Custom adapters may fail too; persistence is optional for gameplay.
    }
    this.reset();
  }

  reset() {
    this.rng = this.injectedRng ?? mulberry32(this.seed);
    this.randomDraws = 0;
    this.nextRivalUid = 1;
    this.time = 0;
    this.edition = 1;
    this.maxEditions = 5;
    this.clockSec = 0;
    this.phase = 'title';
    this.awaitingFirstDispatch = true;
    this.deskTooSmall = false;
    this.speed = 1;
    this.paused = false;
    this.gameOver = false;
    this.victory = false;
    this.gameOverReason = '';
    this.editionSummary = null;
    this.wireLog = [];

    this.cash = 340;
    this.circulation = 18400;
    // Display-only run history; saved all-time best is a separate statistic.
    this.peakCirculation = this.circulation;
    this.lastPrintedFrontPage = null;
    this.credibility = 74; // 0..100
    this.syndicateHeat = 22; // 0..100
    this.pressHp = 100; // 0..100
    this.editionsPrinted = 0;
    this.lastPublishedTime = null;
    this.scoopsTotal = 0;

    this.districts = DISTRICTS.map((d) => ({ ...d }));
    this.hq = this.districts.find((d) => d.isHQ);

    // Operatives spaced cleanly along Press Row plaza
    this.operatives = OPERATIVE_ROSTER.map((op, idx) => ({
      ...op,
      x: this.hq.x + this.hq.w * 0.5 + (idx - 1.5) * 96,
      y: this.hq.y + this.hq.h + 36,
      targetX: this.hq.x + this.hq.w * 0.5 + (idx - 1.5) * 96,
      targetY: this.hq.y + this.hq.h + 36,
      angle: 0,
      state: 'IDLE AT HQ',
      targetLeadId: null,
      targetRivalId: null,
      flashCooldown: 0,
      stepPhase: idx * 1.4,
    }));
    this.selectedOpId = this.operatives[0].id;

    // Active Leads on City Map
    this.nextLeadUid = 1;
    this.leads = [];
    this.catalogIdx = 0;

    // Multi-Edition Investigative Story Arc Progress (0 = unstarted, 1..3 = highest plated part)
    this.arcProgress = {
      red_hook: 0,
      transit_graft: 0,
      tenement_torch: 0,
    };
    this.arcRotation = 0;

    // Midnight Rotary-Phone Editorial Dilemmas
    this.activeDilemma = null;
    this.dilemmaIdx = 0;
    this.dilemmaTriggeredThisEdition = false;

    // Scooped Stories & 4 Front-Page Broadsheet Slots
    this.scoopedStories = [];
    this.frontPage = {
      banner: null,
      above_fold: null,
      photo_expose: null,
      editorial: null,
    };

    // Rival Agents (Herald Scoopers & Observer Syndicate Goons)
    this.rivals = [];
    this.rivalSpawnTimer = 9 * EDITION_TIME_SCALE;

    // Visual Flashbulbs, Floating Callouts & Traffic Cabs
    this.flashes = []; // { x, y, r, alpha, color }
    this.callouts = []; // { x, y, text, color, life }
    this.cabs = [
      { x: 200, y: 365, vx: 78, vy: 0 },
      { x: 1180, y: 615, vx: -82, vy: 0 },
      { x: 485, y: 180, vx: 0, vy: 74 },
      { x: 915, y: 820, vx: 0, vy: -76 },
    ];

    this.banner = {
      title: 'EDITION #1 // EVENING WIRE OPEN',
      sub: 'SELECT A REPORTER. SEND THEM TO A WIRE SLIP. THE CLOCK CAN WAIT.',
      timer: 5.5,
    };

    this.rivalStandings = [
      { id: 'herald', name: 'The Daily Herald', circulation: 21500, color: '#eab308' },
      { id: 'observer', name: 'The Observer Syndicate', circulation: 19800, color: '#f43f5e' },
      { id: 'gazette', name: 'The Daily Herald (Midtown)', circulation: 15200, color: '#c084fc' },
    ];

    this.logWire('NIGHT DESK OPEN — Rotary presses warmed for the 12:00 AM deadline.', 'ops');

    // Seed 3 initial leads across the city
    this.spawnLead('cityhall');
    this.spawnLead('docks');
    this.spawnLead('redlight');
    this.selectedLeadId = this.leads[0] ? this.leads[0].uid : null;
  }

  startNightShift() {
    if (this.phase !== 'title' || this.deskTooSmall) return false;
    this.phase = 'cold-open';
    this.audio.phoneRing();
    return true;
  }

  finishColdOpen() {
    if (this.phase !== 'cold-open') return false;
    this.phase = 'desk';
    return true;
  }

  operativeAvailable(op) {
    return Boolean(op && isUnlocked(op.role, this.edition));
  }

  selectOperative(id) {
    const op = this.operatives.find((candidate) => candidate.id === id);
    if (this.phase !== 'desk' || this.deskTooSmall || !this.operativeAvailable(op)) return false;
    this.selectedOpId = id;
    return true;
  }

  canDispatch() {
    return this.phase === 'desk' && !this.deskTooSmall && !this.gameOver;
  }

  logWire(text, tone = 'info') {
    this.wireLog.unshift({
      time: this.getClockString(),
      at: this.now(),
      text,
      tone,
    });
    if (this.wireLog.length > 24) this.wireLog.length = 24;
  }

  calculateEditionProjection() {
    let cashDelta = 110;
    let circDelta = 0;
    let credDelta = 0;
    let heatDelta = 0;
    let platedCount = 0;
    let seriesBonusReaders = 0;

    for (const slot of FRONT_PAGE_SLOTS) {
      const st = this.frontPage[slot.id];
      if (!st) continue;
      platedCount++;
      const photoMul = st.photoVerified ? (slot.prefersPhoto ? 1.85 : 1.45) : 1.0;
      const rivalMul = st.scoopedByRival && !st.photoVerified ? 0.5 : 1.0;
      const storyCash = Math.round(st.baseValue * slot.mul * photoMul * rivalMul);
      cashDelta += storyCash;
      circDelta += Math.round(storyCash * 14);
      credDelta += st.credibility + slot.credBonus;
      heatDelta += st.heat + slot.heatDelta;

      if (st.arcPart) {
        const arcReaderBonus =
          st.arcPart === 3 ? 4500 : st.arcPart === 2 ? 2500 : 1200;
        const arcCashBonus =
          st.arcPart === 3 ? 190 : st.arcPart === 2 ? 110 : 60;
        seriesBonusReaders += arcReaderBonus;
        circDelta += arcReaderBonus;
        cashDelta += arcCashBonus;
        if (st.arcPart === 3) {
          heatDelta -= 12;
        }
      }
    }

    if (platedCount === 0) {
      credDelta -= 12;
      circDelta -= 1800;
    }

    return {
      cashDelta,
      circDelta,
      credDelta,
      heatDelta,
      platedCount,
      seriesBonusReaders,
    };
  }

  setBanner(title, sub, timer = 3.5) {
    this.banner = { title, sub, timer };
  }

  addCallout(x, y, text, color = '#ffd47a') {
    this.callouts.push({ x, y, text, color, life: 1.4 });
  }

  getClockString() {
    return presentation.clock(this.clockSec);
  }

  nextFloat() {
    this.randomDraws++;
    return this.rng.nextFloat();
  }

  getStateHash() {
    // Hash gameplay and future-driving counters, not adapters, saved records,
    // wire timestamps/messages, banners, traffic, flashes or display-only fields.
    const state = {};
    for (const key of ['phase', 'awaitingFirstDispatch', 'deskTooSmall', 'time', 'edition', 'maxEditions', 'clockSec', 'speed', 'paused',
      'gameOver', 'victory', 'cash', 'circulation', 'credibility', 'syndicateHeat',
      'pressHp', 'editionsPrinted', 'lastPublishedTime', 'scoopsTotal', 'selectedOpId', 'selectedLeadId',
      'nextLeadUid', 'nextRivalUid', 'catalogIdx', 'arcProgress', 'arcRotation',
      'dilemmaIdx', 'dilemmaTriggeredThisEdition', 'rivalSpawnTimer', 'randomDraws']) {
      state[key] = this[key];
    }
    state.rng = this.rng.getState?.() ?? null;
    for (const key of ['operatives', 'leads', 'scoopedStories', 'rivals', 'rivalStandings', 'districts']) {
      state[key] = this[key].map(withoutCosmetics);
    }
    state.frontPage = Object.fromEntries(Object.entries(this.frontPage)
      .map(([key, story]) => [key, story && withoutCosmetics(story)]));
    state.activeDilemma = this.activeDilemma && withoutCosmetics(this.activeDilemma);
    state.editionSummary = this.editionSummary;
    // FNV-1a over UTF-8 canonical JSON; sorted object keys, ordered arrays.
    let hash = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(JSON.stringify(canonical(state)))) {
      hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  spawnLead(preferredDistrictId = null) {
    if (this.leads.length >= 4) return null;

    // Check if we can spawn an unlocked Investigative Story Arc part (max 2 active arc leads at once)
    const activeArcLeads = this.leads.filter((l) => Boolean(l.arcId));
    let arcChoice = null;
    if (activeArcLeads.length < 2) {
      for (let i = 0; i < INVESTIGATIVE_ARCS.length; i++) {
        const arc =
          INVESTIGATIVE_ARCS[(this.arcRotation + i) % INVESTIGATIVE_ARCS.length];
        const currentDone = this.arcProgress[arc.id] || 0;
        const nextPartNum = currentDone + 1;
        if (nextPartNum > 3) continue;

        const alreadyPresent =
          this.leads.some((l) => l.arcId === arc.id) ||
          this.scoopedStories.some((s) => s.arcId === arc.id) ||
          Object.values(this.frontPage).some(
            (s) => s && s.arcId === arc.id && s.arcPart === nextPartNum
          );
        if (!alreadyPresent) {
          const partObj = arc.parts.find((p) => p.part === nextPartNum);
          if (partObj) {
            arcChoice = { arc, partObj };
            this.arcRotation++;
            break;
          }
        }
      }
    }

    let template;
    if (arcChoice) {
      template = {
        ...arcChoice.partObj,
        arcId: arcChoice.arc.id,
        arcCode: arcChoice.arc.shortCode,
        arcTitle: arcChoice.arc.title,
        arcPart: arcChoice.partObj.part,
        seriesBadge: presentation.seriesBadge(arcChoice.arc, arcChoice.partObj),
      };
    } else {
      template = STORY_CATALOG[this.catalogIdx % STORY_CATALOG.length];
      this.catalogIdx++;
    }

    const distId = preferredDistrictId || template.district;
    const dist =
      this.districts.find((d) => d.id === distId) ||
      this.districts.find((d) => !d.isHQ && !d.isRival);

    // Offset slightly inside/around district building front entrance
    const jitterX = ((this.nextLeadUid * 53) % 120) - 60;
    const x = Math.max(90, Math.min(WORLD_W - 90, dist.x + dist.w * 0.5 + jitterX));
    const y =
      dist.y < 400
        ? dist.y + dist.h + 26
        : dist.y - 26;

    const lead = {
      uid: `lead_${this.nextLeadUid++}`,
      beat: template.beat,
      color: template.color,
      districtId: dist.id,
      districtName: dist.name,
      headline: template.headline,
      subdeck: template.subdeck,
      baseValue: template.baseValue + (this.edition - 1) * 20,
      credibility: template.credibility,
      heat: template.heat,
      arcId: template.arcId || null,
      arcCode: template.arcCode || null,
      arcTitle: template.arcTitle || null,
      arcPart: template.arcPart || 0,
      seriesBadge: template.seriesBadge || null,
      x,
      y,
      progress: 0, // 0..100
      photoVerified: false,
      rivalProgress: 0, // Rival tabloid scoop progress 0..100
      scoopedByRival: false,
      timeLeft: LEAD_LIFETIME_SEC,
    };

    this.leads.push(lead);
    this.logWire(presentation.leadFlash(lead), 'info');
    return lead;
  }

  dispatchOperativeToLead(opId, leadUid) {
    if (!this.canDispatch()) return false;
    const op = this.operatives.find((o) => o.id === opId) || this.operatives[0];
    const lead = this.leads.find((l) => l.uid === leadUid);
    if (!this.operativeAvailable(op) || !lead || lead.timeLeft <= 0) return false;
    // A missing selection deliberately falls back to the first reporter.
    if (!this.operatives.some((candidate) => candidate.id === this.selectedOpId)) this.selectedOpId = op.id;
    this.awaitingFirstDispatch = false;

    op.targetLeadId = lead.uid;
    op.targetRivalId = null;
    op.targetX = lead.x + (op.role === 'photographer' ? 22 : -18);
    op.targetY = lead.y + 8;
    op.state = presentation.enRoute(lead);

    this.audio.dispatch();
    this.addCallout(lead.x, lead.y - 16, presentation.dispatched(op), op.color);
    this.logWire(presentation.dispatchLog(op, lead), 'ops');
    return true;
  }

  dispatchOperativeToPoint(opId, wx, wy) {
    if (!this.canDispatch()) return false;
    // Reject malformed input before it can introduce nonfinite movement state.
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return;
    const op = this.operatives.find((o) => o.id === opId) || this.operatives[0];
    if (!this.operativeAvailable(op)) return false;

    // 1. Check if clicked near an active Lead
    for (const lead of this.leads) {
      if (Math.hypot(wx - lead.x, wy - lead.y) <= 46) {
        this.dispatchOperativeToLead(op.id, lead.uid);
        return;
      }
    }

    // 2. Check if clicked near an active Rival Agent
    for (const rv of this.rivals) {
      if (Math.hypot(wx - rv.x, wy - rv.y) <= 42) {
        this.awaitingFirstDispatch = false;
        op.targetRivalId = rv.id;
        op.targetLeadId = null;
        op.targetX = rv.x;
        op.targetY = rv.y;
        op.state = presentation.intercepting(rv);
        this.audio.dispatch();
        this.addCallout(rv.x, rv.y - 14, 'INTERCEPT ORDERED', '#10b981');
        return;
      }
    }

    // 3. Otherwise move operative to city street coordinate
    this.awaitingFirstDispatch = false;
    op.targetLeadId = null;
    op.targetRivalId = null;
    op.targetX = Math.max(50, Math.min(WORLD_W - 50, wx));
    op.targetY = Math.max(50, Math.min(WORLD_H - 50, wy));
    op.state = 'PATROLLING BEAT';
    this.audio.dispatch();
  }

  autoDispatchBestForLead(leadUid) {
    const lead = this.leads.find((l) => l.uid === leadUid);
    if (!lead) return;

    // Prefer selected operative if suitable, else idle reporter/photographer
    const sel = this.operatives.find((o) => o.id === this.selectedOpId);
    if (sel && sel.role !== 'fixer') {
      this.dispatchOperativeToLead(sel.id, lead.uid);
      return;
    }
    const rep =
      this.operatives.find((o) => o.role === 'reporter' && !o.targetLeadId) ||
      this.operatives[0];
    this.dispatchOperativeToLead(rep.id, lead.uid);
  }

  plateStoryToFrontPage(storyUid, preferredSlotId = null) {
    // A misspelled slot must not remove a story into an unprintable property.
    if (preferredSlotId !== null && !FRONT_PAGE_SLOTS.some((slot) => slot.id === preferredSlotId)) {
      return false;
    }
    const idx = this.scoopedStories.findIndex((s) => s.uid === storyUid);
    const story = idx >= 0 ? this.scoopedStories[idx] : null;
    if (!story) return false;

    let slotId = preferredSlotId;
    if (!slotId) {
      if (story.photoVerified && !this.frontPage.photo_expose) {
        slotId = 'photo_expose';
      } else {
        const order = ['banner', 'above_fold', 'photo_expose', 'editorial'];
        slotId = order.find((k) => !this.frontPage[k]) || 'banner';
      }
    }

    // If slot already had a story, return it to queue
    if (this.frontPage[slotId]) {
      this.scoopedStories.push(this.frontPage[slotId]);
    }

    this.scoopedStories.splice(idx, 1);
    this.frontPage[slotId] = story;
    this.audio.typewriter();
    return true;
  }

  spawnRivalAgent() {
    if (this.rivals.length >= 3) return;
    // No unavoidable press attacks before the fixer and repairs join the payroll.
    const isGoon = isUnlocked('fixer', this.edition) &&
      (this.syndicateHeat >= 35 || this.nextFloat() < 0.45);

    if (isGoon) {
      const obs = this.districts.find((d) => d.id === 'observer_hq');
      this.rivals.push({
        id: `rv_${this.nextRivalUid++}`,
        type: 'goon',
        label: 'OBSERVER MOB ENFORCER',
        x: obs.x + 20,
        y: obs.y + obs.h * 0.5,
        angle: Math.PI,
        speed: 78,
        hp: 100,
        stunTimer: 0,
        targetLeadId: null,
      });
    } else if (this.leads.length > 0) {
      const her = this.districts.find((d) => d.id === 'herald_hq');
      // Target the highest-value unscooped lead on the map
      const targetLead =
        [...this.leads]
          .filter((l) => !l.scoopedByRival)
          .sort((a, b) => b.baseValue - a.baseValue)[0] || this.leads[0];
      this.rivals.push({
        id: `rv_${this.nextRivalUid++}`,
        type: 'herald',
        label: 'DAILY HERALD SCOOPER',
        x: her.x + her.w - 10,
        y: her.y + her.h * 0.5,
        angle: 0,
        speed: 90,
        hp: 80,
        stunTimer: 0,
        targetLeadId: targetLead.uid,
      });
      this.logWire(
        presentation.rivalAlert(targetLead),
        'danger'
      );
    }
  }

  // Newsroom Special Operations
  triggerWiretap() {
    if (!isUnlocked('wiretap', this.edition) || this.phase !== 'desk' || this.deskTooSmall) return false;
    if (this.cash < 65) return false;
    this.cash -= 65;
    this.spawnLead();
    this.spawnLead();
    this.audio.wireBell();
    this.setBanner(
      'SWITCHBOARD WIRETAP ACTIVE',
      '2 EXCLUSIVE CITY LEADS INTERCEPTED ON POLICE BAND',
      3.2
    );
    return true;
  }

  acceptSyndicateBribe() {
    if (!isUnlocked('bribe', this.edition) || this.phase !== 'desk' || this.deskTooSmall) return false;
    this.cash += 160;
    this.credibility = Math.max(0, this.credibility - 10);
    this.syndicateHeat = Math.max(0, this.syndicateHeat - 16);
    this.audio.bribe();
    this.setBanner(
      'SYNDICATE HUSH-MONEY ACCEPTED (+$160)',
      'CREDIBILITY -10% · SYNDICATE HEAT REDUCED',
      3.2
    );
    return true;
  }

  fortifyPressRoom() {
    if (!isUnlocked('fortify', this.edition) || this.phase !== 'desk' || this.deskTooSmall) return false;
    if (this.cash < 75) return false;
    this.cash -= 75;
    this.pressHp = 100;
    // Clear any goons near HQ
    this.rivals = this.rivals.filter((r) => r.type !== 'goon');
    this.audio.typewriter();
    this.setBanner(
      'ROTARY PRESS ROOM REINFORCED',
      'PRESS INTEGRITY 100% · OBSERVER SABOTEURS REPELLED',
      3.0
    );
    return true;
  }

  triggerRotaryDilemma() {
    if (!isUnlocked('phone', this.edition) || this.phase !== 'desk' || this.deskTooSmall) return false;
    if (this.activeDilemma) return this.activeDilemma;
    const template =
      EDITORIAL_DILEMMAS[this.dilemmaIdx % EDITORIAL_DILEMMAS.length];
    this.dilemmaIdx++;
    this.activeDilemma = {
      ...template,
      timer: 26,
    };
    this.audio.phoneRing();
    this.logWire(
      presentation.phoneRing(template),
      'ops'
    );
    return this.activeDilemma;
  }

  resolveDilemma(accept = true) {
    if (!this.activeDilemma) return false;
    const eff = accept
      ? this.activeDilemma.acceptEffect
      : this.activeDilemma.rejectEffect;
    this.cash = Math.max(0, this.cash + (eff.cash || 0));
    this.circulation = Math.max(2000, this.circulation + (eff.circulation || 0));
    this.peakCirculation = Math.max(this.peakCirculation, this.circulation);
    this.credibility = Math.max(
      0,
      Math.min(100, this.credibility + (eff.credibility || 0))
    );
    this.syndicateHeat = Math.max(
      0,
      Math.min(100, this.syndicateHeat + (eff.heat || 0))
    );
    this.logWire(eff.wire, accept ? 'ops' : 'scoop');
    this.activeDilemma = null;
    this.audio.typewriter();
    return true;
  }

  publishEdition() {
    if (!this.canDispatch() || this.awaitingFirstDispatch) return false;
    if (this.gameOver || this.pressHp <= 0 || this.lastPublishedTime === this.time) return false;
    // Claim this tick before calling ports: repeated/reentrant inputs print once.
    this.lastPublishedTime = this.time;
    let editionCash = 110; // Base newsstand sales
    let circDelta = 0;
    let credDelta = 0;
    let heatDelta = 0;
    let platedCount = 0;

    for (const slot of FRONT_PAGE_SLOTS) {
      const st = this.frontPage[slot.id];
      if (!st) continue;
      platedCount++;
      const photoMul = st.photoVerified ? (slot.prefersPhoto ? 1.85 : 1.45) : 1.0;
      const rivalMul = st.scoopedByRival && !st.photoVerified ? 0.5 : 1.0;
      const storyCash = Math.round(st.baseValue * slot.mul * photoMul * rivalMul);
      editionCash += storyCash;
      circDelta += Math.round(storyCash * 14);
      credDelta += st.credibility + slot.credBonus;
      heatDelta += st.heat + slot.heatDelta;

      if (st.arcId && st.arcPart) {
        const arcReaderBonus =
          st.arcPart === 3 ? 4500 : st.arcPart === 2 ? 2500 : 1200;
        const arcCashBonus =
          st.arcPart === 3 ? 190 : st.arcPart === 2 ? 110 : 60;
        circDelta += arcReaderBonus;
        editionCash += arcCashBonus;
        if (st.arcPart === 3) {
          heatDelta -= 12;
        }
        this.arcProgress[st.arcId] = Math.max(
          this.arcProgress[st.arcId] || 0,
          st.arcPart
        );
        if (st.arcPart < 3) {
          this.logWire(
            presentation.arcPublished(st, arcReaderBonus),
            'scoop'
          );
        } else {
          this.logWire(
            presentation.arcFinale(st),
            'scoop'
          );
        }
      }
    }

    if (platedCount === 0) {
      // Blank front page penalty
      credDelta -= 12;
      circDelta -= 1800;
    }

    this.cash += editionCash;
    this.circulation = Math.max(2000, this.circulation + circDelta);
    this.credibility = Math.max(0, Math.min(100, this.credibility + credDelta));
    this.syndicateHeat = Math.max(0, Math.min(100, this.syndicateHeat + heatDelta));
    this.editionsPrinted++;
    this.peakCirculation = Math.max(this.peakCirculation, this.circulation);
    // Snapshot before clearing the paste-up; later plating must not rewrite the
    // final printed front page shown when the paper folds.
    this.lastPrintedFrontPage = Object.fromEntries(Object.entries(this.frontPage)
      .map(([slot, story]) => [slot, story && { ...story }]));

    if (this.circulation > this.highCirculation) {
      this.highCirculation = this.circulation;
      try {
        this.storage?.writeBest(this.highCirculation);
      } catch {
        // Storage may be blocked or full; retain the best score in memory this run.
      }
    }

    const printedEditionNum = this.edition;
    this.editionSummary = {
      edition: printedEditionNum,
      reason: 'PRESS RUN COMPLETE',
      slottedCount: platedCount,
      circDelta,
      cashDelta: editionCash,
      credDelta,
      heatDelta,
      totalCirculation: this.circulation,
      totalFunds: this.cash,
      credibility: this.credibility,
      heat: this.syndicateHeat,
    };

    for (const rv of this.rivalStandings) {
      rv.circulation = Math.max(8000, rv.circulation + Math.round((this.nextFloat() - 0.35) * 2400));
    }

    this.logWire(
      presentation.editionPrinted(printedEditionNum, circDelta, editionCash),
      'scoop'
    );

    // Clear plated front page for next night's edition
    this.frontPage = {
      banner: null,
      above_fold: null,
      photo_expose: null,
      editorial: null,
    };
    this.clockSec = 0;
    this.edition++;
    this.dilemmaTriggeredThisEdition = false;
    this.activeDilemma = null;

    this.audio.pressRun();
    this.flashes.push({
      x: this.hq.x + this.hq.w * 0.5,
      y: this.hq.y + this.hq.h * 0.5,
      r: 18,
      alpha: 0.95,
      color: '#ffd47a',
    });

    this.setBanner(
      presentation.editionBanner(this.edition - 1, editionCash),
      presentation.circulationBanner(this.circulation, circDelta, this.credibility),
      4.5
    );

    // Ensure fresh leads on map for the new edition
    while (this.leads.length < 3) {
      this.spawnLead();
    }
    return true;
  }

  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.paused || this.gameOver || this.phase !== 'desk' ||
      this.deskTooSmall || (this.edition === 1 && this.awaitingFirstDispatch)) return;
    // Consume up to 10 seconds in <=50 ms slices, never a teleport-sized tick.
    // The catch-up cap prevents hostile finite deltas from monopolizing the loop.
    const elapsed = Math.min(dt, MAX_CATCHUP_SEC);
    const fullSteps = Math.floor(elapsed / MAX_SUBSTEP_SEC);
    for (let i = 0; i < fullSteps && !this.paused && !this.gameOver; i++) {
      this._step(MAX_SUBSTEP_SEC);
    }
    const remainder = elapsed - fullSteps * MAX_SUBSTEP_SEC;
    if (remainder > 0 && !this.paused && !this.gameOver) this._step(remainder);
  }

  _step(dt) {
    this.time += dt;
    this.clockSec += dt;

    if (this.banner.timer > 0) {
      this.banner.timer = Math.max(0, this.banner.timer - dt);
    }

    // The night line comes onto the payroll on night four, at 40% of the edition.
    if (
      isUnlocked('phone', this.edition) &&
      this.clockSec >= EDITION_DURATION_SEC * 0.4 &&
      !this.dilemmaTriggeredThisEdition &&
      !this.activeDilemma
    ) {
      this.dilemmaTriggeredThisEdition = true;
      this.triggerRotaryDilemma();
    }

    if (this.activeDilemma) {
      this.activeDilemma.timer -= dt;
      if (this.activeDilemma.timer <= 0) {
        this.resolveDilemma(false);
      }
    }

    // Midnight print deadline reached!
    if (this.clockSec >= EDITION_DURATION_SEC) {
      this.publishEdition();
    }

    // Maintain at least 3 active leads on the city map
    if (this.leads.length < 3 && this.nextFloat() < dt * 0.65) {
      this.spawnLead();
    }

    // Spawn Rival Agents periodically
    this.rivalSpawnTimer -= dt;
    if (this.rivalSpawnTimer <= 0) {
      this.rivalSpawnTimer = Math.max(6.5, 13.5 - this.edition * 0.9) * EDITION_TIME_SCALE;
      this.spawnRivalAgent();
    }

    // Update Traffic Cabs
    for (const cab of this.cabs) {
      cab.x += cab.vx * dt;
      cab.y += cab.vy * dt;
      if (cab.x > WORLD_W + 40) cab.x = -40;
      if (cab.x < -40) cab.x = WORLD_W + 40;
      if (cab.y > WORLD_H + 40) cab.y = -40;
      if (cab.y < -40) cab.y = WORLD_H + 40;
    }

    // Update Operatives
    const fixer = this.operatives.find((o) => o.role === 'fixer');
    if (this.operativeAvailable(fixer) && !fixer.targetRivalId && this.rivals.length > 0) {
      // Fixer automatically moves to intercept nearest rival agent!
      const rv = this.rivals[0];
      fixer.targetRivalId = rv.id;
    }

    for (const op of this.operatives) {
      if (!this.operativeAvailable(op)) continue;
      if (op.flashCooldown > 0) op.flashCooldown = Math.max(0, op.flashCooldown - dt);

      // Track target Rival if intercepting
      if (op.targetRivalId) {
        const rv = this.rivals.find((r) => r.id === op.targetRivalId);
        if (rv) {
          op.targetX = rv.x;
          op.targetY = rv.y;
        } else {
          op.targetRivalId = null;
          op.state = 'IDLE ON BEAT';
        }
      }

      // Move toward target
      const dx = op.targetX - op.x;
      const dy = op.targetY - op.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        op.angle = Math.atan2(dy, dx);
        const step = Math.min(dist, op.speed * dt);
        op.x += (dx / dist) * step;
        op.y += (dy / dist) * step;
        op.stepPhase += dt * 9;
      } else {
        // Arrived at target Lead?
        if (op.targetLeadId) {
          const lead = this.leads.find((l) => l.uid === op.targetLeadId);
          if (!lead) {
            op.targetLeadId = null;
            op.state = 'AWAITING ORDERS';
          } else if (op.role === 'photographer') {
            if (!lead.photoVerified) {
              lead.photoVerified = true;
              lead.progress = Math.min(100, lead.progress + 28);
              this.audio.shutter();
              this.flashes.push({
                x: lead.x,
                y: lead.y,
                r: 12,
                alpha: 1.0,
                color: '#ffffff',
              });
              this.addCallout(
                lead.x,
                lead.y - 20,
                '📸 PHOTO PROOF CAPTURED (1.8×)',
                '#38bdf8'
              );
              op.state = 'DARKROOM PROOF READY';
              op.targetLeadId = null;
            } else {
              lead.progress = Math.min(100, lead.progress + dt * 16);
              op.state = presentation.assisting(lead);
            }
          } else {
            // Reporter investigating lead
            op.state = presentation.investigating(lead);
            lead.progress += dt * 24 * op.workRate;
            if (lead.progress >= 100) {
              this.completeLeadScoop(lead);
              op.targetLeadId = null;
              op.state = 'SCOOP FILED!';
            }
          }
        }
      }

      // Fixer / Photographer interaction with Rivals
      for (let i = this.rivals.length - 1; i >= 0; i--) {
        const rv = this.rivals[i];
        const rDist = Math.hypot(op.x - rv.x, op.y - rv.y);
        if (op.role === 'fixer' && rDist <= 34) {
          this.addCallout(
            rv.x,
            rv.y - 16,
            presentation.routed(rv),
            '#10b981'
          );
          this.cash += 35;
          this.rivals.splice(i, 1);
          op.targetRivalId = null;
          op.state = 'THREAT NEUTRALIZED';
        } else if (
          op.role === 'photographer' &&
          rDist <= 65 &&
          op.flashCooldown <= 0 &&
          rv.stunTimer <= 0
        ) {
          rv.stunTimer = 4.5;
          op.flashCooldown = 7.0;
          this.flashes.push({
            x: op.x,
            y: op.y,
            r: 10,
            alpha: 0.95,
            color: '#38bdf8',
          });
          this.addCallout(rv.x, rv.y - 14, '📸 FLASHBULB STUN!', '#38bdf8');
        }
      }
    }

    // Update Rival Agents
    for (let i = this.rivals.length - 1; i >= 0; i--) {
      const rv = this.rivals[i];
      if (rv.stunTimer > 0) {
        rv.stunTimer -= dt;
        continue;
      }

      if (rv.type === 'herald') {
        const lead =
          this.leads.find((l) => l.uid === rv.targetLeadId) || this.leads[0];
        if (!lead) {
          this.rivals.splice(i, 1);
          continue;
        }
        rv.targetLeadId = lead.uid;
        const dx = lead.x - rv.x;
        const dy = lead.y - rv.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 14) {
          rv.angle = Math.atan2(dy, dx);
          rv.x += (dx / dist) * rv.speed * dt;
          rv.y += (dy / dist) * rv.speed * dt;
        } else {
          lead.rivalProgress += dt * 15;
          if (lead.rivalProgress >= 100) {
            lead.rivalProgress = 100;
            const playerContesting =
              lead.progress >= 20 ||
              this.operatives.some((op) => op.targetLeadId === lead.uid);

            if (this.rivalStandings[0]) {
              this.rivalStandings[0].circulation += 1400;
            }

            if (playerContesting) {
              lead.scoopedByRival = true;
              this.addCallout(
                lead.x,
                lead.y - 16,
                '⚠️ RIVAL BEAT US (0.5× UNLESS PHOTO VERIFIED)',
                '#eab308'
              );
              this.logWire(
                presentation.contested(lead),
                'danger'
              );
            } else {
              this.addCallout(
                lead.x,
                lead.y - 16,
                '⚠️ SCOOP STOLEN BY DAILY HERALD!',
                '#eab308'
              );
              this.credibility = Math.max(0, this.credibility - 5);
              this.logWire(
                presentation.stolen(lead),
                'danger'
              );
              this.leads = this.leads.filter((l) => l.uid !== lead.uid);
            }
            this.rivals.splice(i, 1);
          }
        }
      } else {
        // Observer Syndicate Goon marches toward Evening Star HQ to sabotage the Rotary Press
        const tx = this.hq.x + this.hq.w * 0.5;
        const ty = this.hq.y + this.hq.h * 0.5;
        const dx = tx - rv.x;
        const dy = ty - rv.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 32) {
          rv.angle = Math.atan2(dy, dx);
          rv.x += (dx / dist) * rv.speed * dt;
          rv.y += (dy / dist) * rv.speed * dt;
        } else {
          this.pressHp = Math.max(0, this.pressHp - dt * 6.5);
          if (this.pressHp <= 0) {
            this.gameOver = true;
            this.gameOverReason =
              'ROTARY PRESS DESTROYED BY OBSERVER SYNDICATE SABOTEURS';
          }
        }
      }
    }

    // Expire old uninvestigated leads
    for (let i = this.leads.length - 1; i >= 0; i--) {
      const l = this.leads[i];
      l.timeLeft -= dt;
      if (l.timeLeft <= 0) {
        this.addCallout(l.x, l.y, 'LEAD WENT COLD', '#94a3b8');
        this.leads.splice(i, 1);
      }
    }

    // Update Flashbulbs & Callouts
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].r += dt * 190;
      this.flashes[i].alpha -= dt * 1.9;
      if (this.flashes[i].alpha <= 0) this.flashes.splice(i, 1);
    }
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      this.callouts[i].y -= dt * 18;
      this.callouts[i].life -= dt;
      if (this.callouts[i].life <= 0) this.callouts.splice(i, 1);
    }

    if (this.credibility <= 0) {
      this.gameOver = true;
      this.gameOverReason =
        'PUBLIC TRUST COLLAPSED — READERS ABANDONED THE EVENING STAR';
    }
  }

  completeLeadScoop(lead) {
    // A stale completion must not duplicate a story or its scoop counter.
    if (!lead || !this.leads.some((active) => active.uid === lead.uid)) return false;
    this.leads = this.leads.filter((l) => l.uid !== lead.uid);
    this.scoopsTotal++;

    const story = {
      uid: lead.uid,
      beat: lead.beat,
      color: lead.color,
      headline: lead.headline,
      subdeck: lead.subdeck,
      baseValue: lead.baseValue,
      credibility: lead.credibility,
      heat: lead.heat,
      photoVerified: lead.photoVerified,
      scoopedByRival: Boolean(lead.scoopedByRival),
      arcId: lead.arcId || null,
      arcCode: lead.arcCode || null,
      arcTitle: lead.arcTitle || null,
      arcPart: lead.arcPart || 0,
      seriesBadge: lead.seriesBadge || null,
    };

    this.scoopedStories.push(story);
    // Auto-plate into the first open front-page slot so players immediately see their broadsheet fill up!
    const openOrder = story.photoVerified
      ? ['photo_expose', 'banner', 'above_fold', 'editorial']
      : ['banner', 'above_fold', 'editorial', 'photo_expose'];
    const openSlot = openOrder.find((k) => !this.frontPage[k]);
    if (openSlot) {
      this.plateStoryToFrontPage(story.uid, openSlot);
    } else {
      this.audio.wireBell();
    }

    this.addCallout(
      lead.x,
      lead.y - 22,
      presentation.scooped(lead),
      '#ffd47a'
    );
    this.spawnLead();
    return true;
  }
}

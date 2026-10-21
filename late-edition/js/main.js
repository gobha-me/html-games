// ============================================================================
// LATE EDITION // 1947 — Main Application Controller
// ============================================================================

import { h, reconcile } from './dom.js';
import { FRONT_PAGE_SLOTS, isUnlocked, deskFits } from './config.js';
import { LateEditionSim } from './sim.js';
import { NoirCityRenderer } from './renderer.js';
import { ColdOpen } from './opening.js';
import { NoirAudio } from './audio.js';
import { createAudioAdapter, createStorageAdapter, resolveSeed } from './adapters.js';

const LAYOUT_KEYS = { '1': 'banner', b: 'banner', '2': 'above_fold', f: 'above_fold',
  '3': 'photo_expose', p: 'photo_expose', '4': 'editorial', e: 'editorial',
  '5': 'inside', i: 'inside', '6': 'spike', s: 'spike' };

const EDITOR_QUOTES = [
  '"Rain\'s washing the blood off Pier 14, kid. Get Vance and Reyes on the street before the Herald steals our banner."',
  '"City Hall\'s shredding zoning ledgers at midnight. Send Sullivan and back her up with Malone\'s Tommy gun."',
  '"A front page without a Speed Graphic photo is just a sermon. Get Reyes\' flashbulb on that exclusive!"',
  '"Observer syndicate goons are prowling Press Row. Keep Malone near HQ or reinforce the rotary press room."',
  '"Deadline\'s breathing down our neck! Plate your highest-value scoops above the fold before midnight."',
];

class LateEditionApp {
  constructor() {
    this.audio = new NoirAudio();
    const params = new URLSearchParams(window.location.search);
    this.sim = new LateEditionSim({
      seed: resolveSeed(params.get('seed'), Date.now()),
      storage: createStorageAdapter(() => window.localStorage),
      audio: createAudioAdapter(this.audio),
      now: () => performance.now(),
    });
    this.canvas = document.getElementById('city-canvas');
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.coldOpen = new ColdOpen(this.motionPreference.matches);
    this.renderer = new NoirCityRenderer(this.canvas, { reducedMotion: this.motionPreference.matches });
    this.titleRenderer = new NoirCityRenderer(document.getElementById('title-city'), {
      reducedMotion: this.motionPreference.matches,
    });
    this.motionPreference.addEventListener('change', (event) => {
      this.coldOpen.reducedMotion = event.matches;
      this.renderer.reducedMotion = event.matches;
      this.titleRenderer.reducedMotion = event.matches;
      this._renderOpening();
    });
    this.selectedStoryUid = null;
    this.lastFrameTime = performance.now();
    this.uiTickAccum = 0;
    this.modalMode = null;
    this.focusBeforeModal = null;

    this._bindEvents();
    this._updateDeskSize();

    if (params.get('preview') === 'showcase' || params.get('preview') === 'combat') {
      this._setupShowcaseState();
    }

    this._syncFullUI();
    this.renderer.render(this.sim, 0.016);
    requestAnimationFrame((t) => this._loop(t));
  }

  _setupShowcaseState() {
    this.sim.startNightShift();
    this.sim.finishColdOpen();
    this.sim.edition = 4;
    this.sim.spawnRivalAgent();
    if (this.sim.leads[0]) {
      this.sim.dispatchOperativeToLead('rep_1', this.sim.leads[0].uid);
      this.sim.leads[0].progress = 72;
      this.sim.leads[0].photoVerified = true;
    }
    if (this.sim.leads[1]) {
      this.sim.dispatchOperativeToLead('photog_1', this.sim.leads[1].uid);
      this.sim.leads[1].progress = 48;
    }
    if (this.sim.leads[2]) {
      this.sim.dispatchOperativeToLead('rep_2', this.sim.leads[2].uid);
      this.sim.leads[2].progress = 84;
    }
    for (let i = 0; i < 24; i++) {
      this.sim.step(0.2);
    }

    // Add 3 verified stories and plate 2 into the Front Page Broadsheet
    const demoStories = [
      {
        uid: 'demo_story_1',
        beat: 'SCANDAL',
        color: '#f43f5e',
        headline: 'TRANSIT COMMISSIONER CAUGHT AT BLUE VELVET WITH MOB PAYMASTER',
        subdeck: 'Speed Graphic flashbulb captures leather satchel changing hands in velvet booth #4.',
        baseValue: 230,
        credibility: 11,
        heat: 14,
        photoVerified: true,
        arcId: 'transit_graft',
        arcCode: 'ARC B',
        arcTitle: 'CITY HALL TRANSIT KICKBACKS',
        arcPart: 2,
        seriesBadge: 'ARC B · SERIES PART II/III',
      },
      {
        uid: 'demo_story_2',
        beat: 'SYNDICATE',
        color: '#ef4444',
        headline: 'TORRIO COLD-STORAGE VAULT HIDES BOOTLEG PRINTING PLATES',
        subdeck: 'Counterfeit ration stamps and union ballot boxes seized behind meat hooks.',
        baseValue: 210,
        credibility: 10,
        heat: 15,
        photoVerified: true,
        arcId: 'red_hook',
        arcCode: 'ARC A',
        arcTitle: 'RED HOOK DOCKSIDE SYNDICATE',
        arcPart: 1,
        seriesBadge: 'ARC A · SERIES PART I/III',
      },
      {
        uid: 'demo_story_3',
        beat: 'GRAFT',
        color: '#f59e0b',
        headline: 'MAYOR’S BROTHER TIED TO PHANTOM PAVING PAYROLL',
        subdeck: 'Auditor ledgers show $400,000 routed to nonexistent asphalt crews in Ward 4.',
        baseValue: 175,
        credibility: 7,
        heat: 10,
        photoVerified: false,
      },
    ];
    this.sim.scoopedStories.push(...demoStories);
    this.sim.lockUp();
    this.sim.placeStory('demo_story_1', 'banner');
    this.sim.placeStory('demo_story_2', 'photo_expose');
    this.sim.placeStory('demo_story_3', 'above_fold');
    this.sim.triggerRotaryDilemma();
    this.sim.banner.timer = 0;
    this.sim.flashes.push({
      x: this.sim.operatives[2].x,
      y: this.sim.operatives[2].y,
      r: 34,
      alpha: 0.9,
      color: '#38bdf8',
    });
  }

  _bindListEvents() {
    const delegate = (id, selector, action) => {
      const container = document.getElementById(id);
      container.addEventListener('click', (event) => {
        const target = event.target.closest(selector);
        if (!target || !container.contains(target) || this.sim.gameOver || this.modalMode || !['desk', 'paste-up'].includes(this.sim.phase) || this.sim.deskTooSmall) return;
        if (['lead-list', 'operative-list'].includes(id) && !this.sim.canDispatch()) return;
        action(target);
        this._syncFullUI();
      });
      container.addEventListener('keydown', (event) => {
        const target = event.target.closest('[role="button"]');
        if (target && (event.key === 'Enter' || event.code === 'Space')) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) target.click();
        }
      });
    };
    delegate('lead-list', '[data-lead-id]', (target) => {
      this.sim.selectedLeadId = target.dataset.leadId;
      this.sim.dispatchOperativeToLead(this.sim.selectedOpId, target.dataset.leadId);
    });
    delegate('operative-list', '[data-select-op], [data-dispatch-op], [data-op-id]', (target) => {
      const opId = target.dataset.selectOp ?? target.dataset.dispatchOp ?? target.dataset.opId;
      if (!this.sim.selectOperative(opId)) return;
      if (target.dataset.dispatchOp) {
        const uid = this.sim.selectedLeadId || this.sim.leads[0]?.uid;
        if (uid) this.sim.dispatchOperativeToLead(opId, uid);
      } else this.audio.typewriter();
    });
    delegate('scoop-tray', '[data-story-uid]', (target) => {
      this.selectedStoryUid = target.dataset.storyUid;
    });
    delegate('layout-slots', '[data-slot-id]', (target) => {
      const story = this.sim.frontPage[target.dataset.slotId];
      if (story) this.selectedStoryUid = story.uid;
      else this._assignStory(target.dataset.slotId);
    });
    delegate('inside-stories', '[data-story-uid]', (target) => { this.selectedStoryUid = target.dataset.storyUid; });
    delegate('layout-destinations', '[data-slot-id]', (target) => this._assignStory(target.dataset.slotId));
    this._bindPointerLayout();
  }

  _bindEvents() {
    document.getElementById('btn-start-shift').addEventListener('click', () => this._startShift());
    document.getElementById('btn-skip-intro').addEventListener('click', () => this._skipIntro());
    window.addEventListener('resize', () => this._updateDeskSize());
    this._bindListEvents();
    const unlockAudio = () => this.audio.resume();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    this.canvas.addEventListener('mousemove', (e) => {
      const pt = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.renderer.mouseWorld = pt;

      let hoveredOp = null;
      for (const op of this.sim.operatives) {
        if (!this.sim.operativeAvailable(op)) continue;
        if (Math.hypot(op.x - pt.x, op.y - pt.y) <= 30) {
          hoveredOp = op.id;
          break;
        }
      }
      this.renderer.hoverOperativeId = hoveredOp;

      let hoveredLead = null;
      for (const lead of this.sim.leads) {
        if (Math.hypot(lead.x - pt.x, lead.y - pt.y) <= 34) {
          hoveredLead = lead.uid;
          break;
        }
      }
      this.renderer.hoverLeadId = hoveredLead;
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.sim.gameOver || this.modalMode || this.sim.phase !== 'desk' || this.sim.deskTooSmall) return;
      const pt = this.renderer.screenToWorld(e.clientX, e.clientY);

      for (const op of this.sim.operatives) {
        if (!this.sim.operativeAvailable(op)) continue;
        if (Math.hypot(op.x - pt.x, op.y - pt.y) <= 30) {
          if (!this.sim.selectOperative(op.id)) return;
          this.audio.typewriter();
          this._syncFullUI();
          return;
        }
      }

      for (const lead of this.sim.leads) {
        if (Math.hypot(lead.x - pt.x, lead.y - pt.y) <= 36) {
          this.sim.selectedLeadId = lead.uid;
          this.sim.dispatchOperativeToLead(this.sim.selectedOpId, lead.uid);
          this._syncFullUI();
          return;
        }
      }

      this.sim.dispatchOperativeToPoint(this.sim.selectedOpId, pt.x, pt.y);
      this._syncFullUI();
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.sim.gameOver || this.modalMode || this.sim.phase !== 'desk' || this.sim.deskTooSmall) return;
      const op = this.sim.operatives.find((o) => o.id === this.sim.selectedOpId);
      if (op) {
        op.targetLeadId = null;
        op.targetRivalId = null;
        op.targetX = this.sim.hq.x + this.sim.hq.w * 0.5;
        op.targetY = this.sim.hq.y + this.sim.hq.h + 24;
        op.state = 'RETURNING TO HQ';
        this.audio.dispatch();
        this._syncFullUI();
      }
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.sim.paused = !this.sim.paused;
      this._syncSpeedButtons();
    });
    document.getElementById('btn-speed-1').addEventListener('click', () => {
      this.sim.paused = false;
      this.sim.speed = 1;
      this._syncSpeedButtons();
    });
    document.getElementById('btn-speed-2').addEventListener('click', () => {
      this.sim.paused = false;
      this.sim.speed = 2;
      this._syncSpeedButtons();
    });

    const btnAudio = document.getElementById('btn-audio');
    btnAudio.addEventListener('click', () => {
      const muted = this.audio.toggleMute();
      btnAudio.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
      btnAudio.classList.toggle('active', !muted);
    });

    document.getElementById('btn-lock-page').addEventListener('click', () => {
      this.sim.lockUp();
      this._syncFullUI();
    });
    document.getElementById('btn-unplace').addEventListener('click', () => {
      this._layoutResult(this.sim.unplace(this.selectedStoryUid));
    });

    document.getElementById('btn-roll-press').addEventListener('click', () => {
      this.sim.publishEdition();
      this._syncFullUI();
    });

    document.getElementById('btn-auto-layout').addEventListener('click', () => {
      this._autoLayoutBestStories();
      this._syncFullUI();
    });

    document.getElementById('act-wiretap').addEventListener('click', () => {
      this.sim.triggerWiretap();
      this._syncFullUI();
    });
    document.getElementById('act-bribe').addEventListener('click', () => {
      this.sim.acceptSyndicateBribe();
      this._syncFullUI();
    });
    document.getElementById('act-fortify').addEventListener('click', () => {
      this.sim.fortifyPressRoom();
      this._syncFullUI();
    });
    const actPhone = document.getElementById('act-phone');
    if (actPhone) {
      actPhone.addEventListener('click', () => {
        this.sim.triggerRotaryDilemma();
        this._syncFullUI();
      });
    }
    const btnDilemmaAccept = document.getElementById('btn-dilemma-accept');
    if (btnDilemmaAccept) {
      btnDilemmaAccept.addEventListener('click', () => {
        this.sim.resolveDilemma(true);
        this._syncFullUI();
      });
    }
    const btnDilemmaReject = document.getElementById('btn-dilemma-reject');
    if (btnDilemmaReject) {
      btnDilemmaReject.addEventListener('click', () => {
        this.sim.resolveDilemma(false);
        this._syncFullUI();
      });
    }

    document.getElementById('btn-modal-continue').addEventListener('click', () => {
      if (this.sim.gameOver) {
        this._restart();
      } else {
        this.sim.editionSummary = null;
        this._syncFullUI();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (this.sim.deskTooSmall) return;
      // Consume held activation keys even when restart has moved focus to Skip.
      if ((e.code === 'Space' || e.key === 'Enter') && e.repeat) {
        e.preventDefault();
        return;
      }
      if (!['desk', 'paste-up'].includes(this.sim.phase)) {
        if (this.sim.phase === 'title' && e.key === 'Enter' && !e.target?.closest('a')) {
          e.preventDefault();
          if (!e.repeat) this._startShift();
        } else if (this.sim.phase === 'cold-open' && e.key === 'Escape') {
          e.preventDefault();
          this._skipIntro();
        }
        return;
      }
      const modalButton = document.getElementById('btn-modal-continue');
      if (this.sim.gameOver || this.sim.editionSummary) {
        if (e.key === 'Tab') {
          e.preventDefault();
          modalButton.focus();
        } else if (e.code === 'Space' || e.key === 'Enter') {
          // Consume the activation before resetting: the same Space must never
          // fall through to the new run's press lever (including held repeats).
          e.preventDefault();
          if (!e.repeat) modalButton.click();
        }
        return;
      }
      if (e.target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      // Let native controls own Space/Enter so keyboard dispatch cannot print.
      if (e.code === 'Space' && e.target?.closest('button, a, [role="button"]')) return;
      const k = e.key.toLowerCase();
      if (this.sim.phase === 'paste-up') {
        if (e.key === 'Escape') { this._cancelDrag(); return; }
        if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
          e.preventDefault();
          const stories = [...this.sim.scoopedStories, ...Object.values(this.sim.frontPage).filter(Boolean), ...this.sim.insideStories];
          const index = stories.findIndex((story) => story.uid === this.selectedStoryUid);
          const direction = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : -1;
          const nextIndex = index < 0 ? (direction > 0 ? 0 : stories.length - 1) : (index + direction + stories.length) % stories.length;
          this.selectedStoryUid = stories[nextIndex]?.uid ?? null;
          this._syncFullUI();
          document.querySelector(`[data-story-uid="${this.selectedStoryUid}"]`)?.focus();
          return;
        }
        if (LAYOUT_KEYS[k]) {
          e.preventDefault();
          this._assignStory(LAYOUT_KEYS[k]);
          return;
        }
        if (k === 'u' || e.key === 'Delete') {
          e.preventDefault();
          this._layoutResult(this.sim.unplace(this.selectedStoryUid));
          return;
        }
      }
      if (k === 'l') {
        this.sim.lockUp();
        this._syncFullUI();
      } else if (['1', '2', '3', '4'].includes(k)) {
        const idx = Number(k) - 1;
        if (this.sim.selectOperative(this.sim.operatives[idx]?.id)) {
          this.audio.typewriter();
          this._syncFullUI();
        }
      } else if (k === 'a') {
        this._autoLayoutBestStories();
        this._syncFullUI();
      } else if (k === 'q') {
        this.sim.triggerWiretap();
        this._syncFullUI();
      } else if (k === 'w') {
        this.sim.acceptSyndicateBribe();
        this._syncFullUI();
      } else if (k === 'e') {
        this.sim.fortifyPressRoom();
        this._syncFullUI();
      } else if (k === 't') {
        this.sim.triggerRotaryDilemma();
        this._syncFullUI();
      } else if (k === 'y' && this.sim.activeDilemma) {
        this.sim.resolveDilemma(true);
        this._syncFullUI();
      } else if (k === 'n' && this.sim.activeDilemma) {
        this.sim.resolveDilemma(false);
        this._syncFullUI();
      } else if (k === 'p') {
        this.sim.paused = !this.sim.paused;
        this._syncSpeedButtons();
      } else if (k === 'm') {
        const muted = this.audio.toggleMute();
        btnAudio.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (this.sim.editionSummary) {
          this.sim.editionSummary = null;
        } else {
          this.sim.publishEdition();
        }
        this._syncFullUI();
      }
    });
  }

  _layoutResult(result) {
    document.getElementById('layout-status').textContent = result.ok ? 'Copy desk updated.' : `Cannot assign: ${result.reason}.`;
    this._syncFullUI();
  }

  _assignStory(slotId, uid = this.selectedStoryUid) {
    this._layoutResult(slotId === 'spike' ? this.sim.spike(uid) : this.sim.placeStory(uid, slotId));
  }

  _autoLayoutBestStories() {
    this._layoutResult(this.sim.assistLayout());
  }

  _cancelDrag() {
    this.drag?.ghost?.remove();
    this.drag = null;
    document.querySelectorAll('.drop-target').forEach((node) => node.classList.remove('drop-target'));
  }

  _bindPointerLayout() {
    const paper = document.querySelector('.broadsheet-pasteup');
    paper.addEventListener('focusin', (event) => {
      const source = event.target.closest('[data-story-uid]');
      if (source && this.sim.canLayout() && this.selectedStoryUid !== source.dataset.storyUid) {
        this.selectedStoryUid = source.dataset.storyUid;
        this._syncFullUI();
      }
    });
    paper.addEventListener('pointerdown', (event) => {
      const source = event.target.closest('[data-story-uid]');
      if (!source || event.button !== 0 || !this.sim.canLayout()) return;
      this.selectedStoryUid = source.dataset.storyUid;
      this.drag = { uid: this.selectedStoryUid, edition: this.sim.edition, pointerId: event.pointerId,
        x: event.clientX, y: event.clientY, moved: false };
      // Capture survives leaving the paper; pointerup still resolves through hit-testing.
      source.setPointerCapture(event.pointerId);
    });
    window.addEventListener('pointermove', (event) => {
      const drag = this.drag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!this.sim.canLayout() || drag.edition !== this.sim.edition) { this._cancelDrag(); return; }
      if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.ghost = document.createElement('div');
        drag.ghost.className = 'drag-copy';
        drag.ghost.textContent = 'GALLEY PROOF';
        drag.ghost.setAttribute('aria-hidden', 'true');
        document.body.append(drag.ghost);
      }
      drag.ghost.style.left = `${event.clientX + 12}px`;
      drag.ghost.style.top = `${event.clientY + 12}px`;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-slot-id]');
      document.querySelectorAll('.drop-target').forEach((node) => node.classList.remove('drop-target'));
      target?.classList.add('drop-target');
    });
    window.addEventListener('pointerup', (event) => {
      const drag = this.drag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-slot-id]');
      if (drag.moved) {
        // Swallow only the click synthesized from this drag, never the next keyboard activation.
        const suppressClick = (click) => { click.preventDefault(); click.stopImmediatePropagation(); };
        paper.addEventListener('click', suppressClick, { once: true, capture: true });
        setTimeout(() => paper.removeEventListener('click', suppressClick, true), 0);
        if (target && drag.edition === this.sim.edition && this.sim.canLayout()) this._assignStory(target.dataset.slotId, drag.uid);
      }
      this._cancelDrag();
    });
    window.addEventListener('pointercancel', () => this._cancelDrag());
    window.addEventListener('blur', () => this._cancelDrag());
  }

  _syncSpeedButtons() {
    document
      .getElementById('btn-pause')
      .classList.toggle('active', this.sim.paused);
    document
      .getElementById('btn-speed-1')
      .classList.toggle('active', !this.sim.paused && this.sim.speed === 1);
    document
      .getElementById('btn-speed-2')
      .classList.toggle('active', !this.sim.paused && this.sim.speed === 2);
  }

  _syncTopBar() {
    document.getElementById('hud-edition').textContent =
      `#${this.sim.edition}`;
    document.getElementById('hud-clock').textContent =
      this.sim.getClockString();
    document.getElementById('hud-circulation').textContent =
      this.sim.circulation.toLocaleString();
    document.getElementById('hud-funds').textContent = `$${this.sim.cash}`;
    document.getElementById('hud-credibility').textContent =
      `${this.sim.credibility}%`;
    document.getElementById('hud-heat').textContent =
      `${this.sim.syndicateHeat}%`;

    const selOp =
      this.sim.operatives.find((o) => o.id === this.sim.selectedOpId) ||
      this.sim.operatives[0];
    if (selOp) {
      const idx = this.sim.operatives.indexOf(selOp) + 1;
      document.getElementById('map-selection-status').textContent =
        `UNIT [${idx}] ${selOp.name.toUpperCase()} (${selOp.roleLabel}) — CLICK ANY BREAKING LEAD ON MAP TO DISPATCH`;
    }
  }

  _renderOperativesRoster() {
    const spriteMap = {
      reporter: 'assets/sprites/unit_reporter.png',
      photographer: 'assets/sprites/unit_photographer.png',
      fixer: 'assets/sprites/unit_fixer.png',
    };
    reconcile(document.getElementById('operative-list'), this.sim.operatives.flatMap((op, idx) => this.sim.operativeAvailable(op) ? [
      h('div', `op-card ${op.id === this.sim.selectedOpId ? 'selected' : ''}`, [
        h('button', 'op-pass-top op-select', [
          h('span', 'op-avatar-wrap', [
            h('span', 'op-key', idx + 1),
            h('img', 'op-avatar', [], { src: spriteMap[op.sprite], alt: op.name }),
          ]),
          h('span', 'op-info', [
            h('span', 'op-name-row', op.name),
            h('span', 'op-role', `${op.roleLabel} · ${op.callsign}`),
          ]),
        ], { 'data-select-op': op.id, 'aria-pressed': op.id === this.sim.selectedOpId }),
        h('div', 'op-pass-bottom', [
          h('div', 'op-status', op.state),
          h('button', 'op-dispatch-btn', 'SEND', {
            'data-dispatch-op': op.id, 'aria-label': `Send ${op.name} to selected lead`,
          }),
        ]),
      ], { 'data-op-id': op.id }, op.id)] : []));
  }

  _renderLeadsList() {
    this.renderedLeadIds = this.sim.leads.map((lead) => lead.uid);
    document.getElementById('leads-count').textContent = `${this.sim.leads.length} ACTIVE`;
    reconcile(document.getElementById('lead-list'), this.sim.leads.map((lead) =>
      h('button', `lead-item ${lead.uid === this.sim.selectedLeadId ? 'selected' : ''}`, [
        h('span', 'lead-top', [
          h('span', 'lead-cat', `${lead.beat} · $${lead.baseValue}`, { style: `color:${lead.color}` }),
          h('span', 'series-badge', lead.arcCode ? `${lead.arcCode}·P${lead.arcPart}/3` : '', lead.arcCode ? {} : { hidden: '' }),
          h('span', '', `${Math.ceil(lead.timeLeft)}s ${lead.photoVerified ? '· 📸 1.8×' : lead.scoopedByRival ? '· ⚠️ 0.5×' : ''}`),
        ]),
        h('span', 'lead-headline', lead.headline),
        h('span', 'lead-bars', [
          h('span', 'progress-track', [h('span', 'progress-fill player', [], { style: `width:${Math.round(lead.progress)}%` })], { title: `Investigation ${Math.round(lead.progress)}%` }),
          h('span', 'progress-track', [h('span', 'progress-fill rival', [], { style: `width:${Math.round(lead.rivalProgress)}%` })], { title: `Rival Herald ${Math.round(lead.rivalProgress)}%` }),
        ]),
      ], { 'data-lead-id': lead.uid }, lead.uid)));
  }

  _renderScoopTrayAndWire() {
    const stories = this.sim.scoopedStories;
    reconcile(document.getElementById('scoop-tray'), stories.length ? stories.map((st) =>
      h('button', `scoop-chip ${st.uid === this.selectedStoryUid ? 'selected-copy' : ''}`, [
        h('span', 'scoop-chip-top', [
          h('span', '', `${st.beat} ${st.seriesBadge ? `· ${st.seriesBadge}` : ''} ${st.photoVerified ? '📸 1.8×' : ''}`, {}),
          h('span', '', `+$${st.baseValue}`),
        ]),
        h('span', 'scoop-chip-title', st.headline),
      ], { type: 'button', 'data-story-uid': st.uid, 'aria-pressed': String(st.uid === this.selectedStoryUid) }, st.uid)) : [
      h('div', 'scoop-chip', [
        h('div', 'scoop-chip-top', [h('span', '', 'NO UNPLACED COPY'), h('span', '', 'DISPATCH UNITS [1–4]')]),
        h('div', 'scoop-chip-title', 'Scoops wait here for paste-up. Lock up at 11 PM, or press L after dispatch.'),
      ], { style: 'grid-column:1 / -1;opacity:0.8' }, 'empty'),
    ]);
    // Entries are stable objects, even if two messages have identical copy/time.
    reconcile(document.getElementById('wire-log'), this.sim.wireLog.slice(0, 7).map((entry) =>
      h('div', `wire-entry ${entry.tone}`, `[${entry.time}] ${entry.text}`, {}, entry)));
  }

  _renderBroadsheetAndPress() {
    document.getElementById('paper-edition-label').textContent =
      `VOL. LVIII · LATE NIGHT EDITION #${this.sim.edition}`;
    const proj = this.sim.calculateEditionProjection();
    document.getElementById('paper-projected-readers').textContent =
      `EST. ${proj.circDelta >= 0 ? '+' : ''}${proj.circDelta.toLocaleString()} READERS`;
    this._renderFrontPage(document.getElementById('layout-slots'), this.sim.frontPage, true);
    reconcile(document.getElementById('inside-stories'), this.sim.insideStories.map((story) =>
      h('button', `scoop-chip ${story.uid === this.selectedStoryUid ? 'selected-copy' : ''}`, story.headline,
        { type: 'button', 'data-story-uid': story.uid, 'aria-pressed': String(story.uid === this.selectedStoryUid) }, story.uid)));
    document.getElementById('spiked-count').textContent = `${this.sim.spikedStories.length} SPIKED`;
    document.getElementById('assist-note').textContent = this.sim.editionLayout.assisted ? 'ASSISTED · −500 READERS' : 'MANUAL PASTE-UP';

    document.getElementById('proj-circ').textContent =
      `${proj.circDelta >= 0 ? '+' : ''}${proj.circDelta.toLocaleString()}`;
    document.getElementById('proj-cash').textContent = `+$${proj.cashDelta}`;
    document.getElementById('proj-cred').textContent =
      `${proj.credDelta >= 0 ? '+' : ''}${proj.credDelta}%`;
    document.getElementById('proj-heat').textContent =
      `${proj.heatDelta >= 0 ? '+' : ''}${proj.heatDelta}%`;

    const inkColorMap = { herald: '#1e3a8a', observer: '#991b1b', gazette: '#334155' };
    const allPapers = [
      { id: 'player', name: '★ The Evening Star (You)', circulation: this.sim.circulation, inkColor: '#b91c1c' },
      ...this.sim.rivalStandings.map((r) => ({ ...r, inkColor: inkColorMap[r.id] || '#1e293b' })),
    ].sort((a, b) => b.circulation - a.circulation);
    const maxCirc = Math.max(40000, ...allPapers.map((p) => p.circulation));
    reconcile(document.getElementById('rival-standings'), allPapers.map((p) =>
      h('div', 'rival-row', [
        h('div', 'rival-row-top', [
          h('span', '', p.name, { style: `color:${p.inkColor}` }),
          h('span', '', p.circulation.toLocaleString()),
        ]),
        h('div', 'progress-track', [h('div', 'progress-fill', [], {
          style: `width:${Math.min(100, Math.round(p.circulation / maxCirc * 100))}%;background:${p.inkColor}`,
        })]),
      ], { 'data-paper-id': p.id }, p.id)));
  }

  _renderFrontPage(slotsEl, page, interactive = false) {

    const bodyCopyByBeat = {
      SCANDAL:
        'Sworn testimony sealed by the Municipal Court clerk confirms late-night meetings between precinct brass and syndicate fixers. Watchmen on the night shift recorded license plates matching three city limousines parked behind the alley entrance until 2:15 A.M.',
      SYNDICATE:
        'Federal Treasury agents and Evening Star reporters traced the unmarked manifests through three dummy cold-storage holding companies. Armed lookouts fled down the freight elevator moments before flashbulbs illuminated the subterranean vault.',
      GRAFT:
        'Canceled municipal vouchers examined under the night desk lamp reveal duplicate payouts signed by the controller’s office every Friday since April. Civic auditors demand an immediate grand-jury subpoena of all Fourth Ward ledgers.',
      CRIME:
        'Harbor patrolmen cordoned off the fog-shrouded slip after night stevedores discovered the tampered manifest lockbox. Detectives believe the contraband was unloaded under cover of the 11:00 P.M. squall before customs cutters arrived.',
    };

    const standInBySlot = {
      banner: {
        stamp: 'WIRE STAND-IN · CLICK MAP LEAD FOR 2.0× SCOOP',
        headline: 'CITY COUNCIL DEBATES HARBOR DREDGING APPROPRIATION',
        deck: 'Routine municipal bond hearing adjourns without roll-call vote; replace this dull wire filler with an exclusive street scoop.',
        body: 'Aldermen spent four hours reviewing dredging contracts for the outer channel before tabling the measure until November. Night editors are holding the top banner plate open for breaking crime or graft dispatches from our precinct reporters.',
      },
      above_fold: {
        stamp: 'WIRE STAND-IN · 1.5× ABOVE-THE-FOLD',
        headline: 'AUTUMN SQUALL DELAYS EVENING COMMUTER FERRIES',
        deck: 'Cross-harbor schedule resumes at dawn; dispatch Vance [1] or Sullivan [2] to replace this wire brief.',
        body: 'Harbor Master bulletins report twenty-minute delays along the Staten slip due to heavy October rain and southwest gusts. Commuters crowded the terminal waiting room until the 9:15 P.M. steamer cleared the breakwater.',
      },
      photo_expose: {
        stamp: 'DARKROOM PLATE · SEND CLARA [3] FOR 1.8× PHOTO',
        headline: 'COURTHOUSE ANNEX REPAIRS ENTER FOURTH MONTH',
        deck: 'Scaffolding remains over east portico; send Photographer Clara Reyes [3] to a crime scene for a 1.8× Speed Graphic exposé.',
        body: 'Public Works crews completed masonry pointing on the third-floor cornice Tuesday afternoon. A front-page Speed Graphic flashbulb exclusive in this column multiplies story value and circulation.',
      },
      editorial: {
        stamp: 'WIRE STAND-IN · 1.2× EDITORIAL COLUMN (-8% HEAT)',
        headline: 'MUNICIPAL COAL RESERVES REPORTED ADEQUATE BY BOARD',
        deck: 'Winter stockpiles at eighty percent capacity; plating a story here also cools Syndicate Mob Heat by -8%.',
        body: 'Fuel commissioners assured building superintendents that rail shipments from the anthracite valley remain on schedule despite wet switchyards.',
      },
    };

    if (!isUnlocked('photographer', this.sim.edition)) {
      standInBySlot.photo_expose.stamp = 'DARKROOM · NOT YET ON PAYROLL · NIGHT 2';
      standInBySlot.photo_expose.deck = 'The darkroom opens on night two. Until then, fill this column with a reporter’s copy.';
    }
    reconcile(slotsEl, FRONT_PAGE_SLOTS.map((slot) => {
      const st = page[slot.id];
      const filler = standInBySlot[slot.id] || standInBySlot.banner;
      const photo = slot.id === 'photo_expose' && isUnlocked('photographer', this.sim.edition);
      const photoNote = st?.photoVerified ? (st.scoopedByRival ? ' · 📸 COUNTER-SCOOP 1.8×' : ' · 📸 1.8× PHOTO') : st?.scoopedByRival ? ' · ⚠️ RIVAL 0.5×' : '';
      return h('article', `paper-slot ${st ? '' : 'empty'} ${st?.uid === this.selectedStoryUid ? 'selected-copy' : ''}`, [
        h('div', 'slot-meta', [
          h('span', '', `${slot.label}${st ? ` (${slot.mul}×)` : ''}`),
          h('span', st ? '' : 'galley-stamp', st ? `${st.beat} · $${st.baseValue}${photoNote}` : filler.stamp),
        ]),
        h('span', st?.seriesBadge ? 'series-stamp' : '', st?.seriesBadge ? `${st.seriesBadge} (+${st.arcPart === 3 ? '4,500' : st.arcPart === 2 ? '2,500' : '1,200'} RDRS)` : '', st?.seriesBadge ? {} : { hidden: '' }),
        ...(photo ? [h('div', 'halftone-photo-box', [
          h('img', 'halftone-photo-img', [], {
            src: st ? 'assets/sprites/masthead_press.png' : 'assets/sprites/unit_photographer.png',
            alt: st ? 'Speed Graphic Exposé' : 'Darkroom Plate',
          }),
          h('div', 'halftone-caption-bar', [
            h('span', '', st ? `📸 SPEED GRAPHIC // ${st.beat}` : 'DARKROOM PLATE OPEN'),
            h('span', '', st ? (st.photoVerified ? 'VERIFIED 1.8×' : 'FILE PHOTO') : '📸 1.8× PHOTO BONUS'),
          ]),
        ])] : []),
        h('div', st ? '' : 'standin-copy', [
          h('div', 'slot-headline', st ? st.headline : filler.headline),
          h('div', 'slot-deck', st ? st.subdeck : filler.deck),
          h('div', 'slot-byline', st ? 'By Staff Correspondent · Metropolis, Oct. 1947' : '', st ? {} : { hidden: '' }),
          h('div', 'slot-body-copy', st ? (bodyCopyByBeat[st.beat] || bodyCopyByBeat.CRIME) : filler.body),
        ]),
      ], { 'data-slot-id': slot.id, ...(interactive ? {
        role: 'button', tabindex: '0', 'aria-label': st ? `Select ${st.headline}` : `Place selected copy in ${slot.label}`,
        ...(st ? { 'data-story-uid': st.uid } : {}),
      } : {}) }, slot.id);
    }));
  }

  _restart() {
    // A restart is a new night, not a replay of ?seed=. Keep deterministic reset
    // in the sim; the browser alone owns fresh entropy for this user action.
    const entropy = new Uint32Array(1);
    crypto.getRandomValues(entropy);
    this.sim.seed = entropy[0] === (this.sim.seed >>> 0) ? (entropy[0] + 1) >>> 0 : entropy[0];
    this._cancelDrag();
    this.sim.reset();
    this.sim.startNightShift();
    this.coldOpen = new ColdOpen(this.motionPreference.matches);
    this.selectedStoryUid = null;
    this.renderer.hoverLeadId = null;
    this.renderer.hoverOperativeId = null;
    this.uiTickAccum = 0;
    this.lastFrameTime = performance.now();
    this._syncFullUI();
    document.getElementById('btn-skip-intro').focus();
  }

  _renderModal() {
    const modal = document.getElementById('edition-modal');
    const sum = this.sim.editionSummary;
    const folded = this.sim.gameOver;
    const mode = folded ? 'folded' : sum ? 'summary' : null;
    const changed = mode !== this.modalMode;
    if (mode && !this.modalMode) this.focusBeforeModal = document.activeElement;
    modal.classList.toggle('hidden', !mode);
    modal.classList.toggle('paper-folded', folded);
    // Native inert removes the covered desk from pointer and keyboard navigation.
    const covered = Boolean(mode) || !['desk', 'paste-up'].includes(this.sim.phase) || this.sim.deskTooSmall;
    document.querySelector('.brass-rail').inert = covered;
    document.querySelector('.desk-workspace').inert = covered;
    this.modalMode = mode;
    if (!mode) {
      if (changed && this.focusBeforeModal?.isConnected) this.focusBeforeModal.focus();
      return;
    }
    document.getElementById('modal-kicker').textContent = folded ? 'THE EVENING STAR // STOP PRESS TELEGRAM' : `ROTARY PRESS REPORT // EDITION #${sum.edition}`;
    document.getElementById('modal-title').textContent = folded ? 'PAPER FOLDED' : `EXTRA! EXTRA! EDITION #${sum.edition} HITS THE STREETS`;
    document.getElementById('modal-subtitle').textContent = folded ? this.sim.gameOverReason :
      `Printed ${sum.slottedCount} stories (${sum.insideCount} inside). ${sum.assisted ? 'ASSISTED: −500 readers. ' : ''}${sum.emptyBanner ? 'WIRE STAND-IN: −6 trust. ' : ''}Managing Editor Lou Vance reviews the morning street sales:`;
    const metrics = folded ? [
      ['EDITION REACHED', `#${this.sim.edition}`],
      ['PEAK CIRCULATION', this.sim.peakCirculation.toLocaleString()],
    ] : [
      ['CIRCULATION SHIFT', `${sum.circDelta >= 0 ? '+' : ''}${sum.circDelta.toLocaleString()} (${sum.totalCirculation.toLocaleString()})`],
      ['STREET & AD REVENUE', `+$${sum.cashDelta} ($${sum.totalFunds})`],
      ['CREDIBILITY RATING', `${sum.credibility}% (${sum.credDelta >= 0 ? '+' : ''}${sum.credDelta}%)`],
      ['SYNDICATE MOB HEAT', `${sum.heat}%`],
    ];
    reconcile(document.getElementById('modal-metrics'), metrics.map(([label, value]) =>
      h('div', 'modal-metric-box', [h('span', '', label), h('strong', '', value)], {}, label)));
    const final = document.getElementById('final-front-page');
    final.hidden = !folded;
    if (folded) {
      // Preserve the current paste-up if it has copy; otherwise show the last
      // printed page, since publishEdition clears the desk for the next edition.
      const hasCopy = Object.values(this.sim.frontPage).some(Boolean);
      this._renderFrontPage(document.getElementById('final-layout-slots'),
        hasCopy ? this.sim.frontPage : this.sim.lastPrintedFrontPage ?? this.sim.frontPage);
    }
    const button = document.getElementById('btn-modal-continue');
    button.textContent = folded ? 'Start a new night shift' : 'START NEXT NIGHT SHIFT [SPACE]';
    if (changed && !this.sim.deskTooSmall) button.focus();
  }

  _renderRotaryPhone() {
    const card = document.getElementById('rotary-phone-card');
    if (!card) return;
    const d = this.sim.activeDilemma;
    if (!d) {
      card.classList.add('hidden');
      return;
    }
    card.classList.remove('hidden');
    document.getElementById('rotary-caller').textContent = d.caller;
    document.getElementById('rotary-timer').textContent =
      `${Math.max(1, Math.ceil(d.timer))}s`;
    document.getElementById('rotary-prompt').textContent = d.prompt;
    document.getElementById('btn-dilemma-accept').textContent = d.acceptLabel;
    document.getElementById('btn-dilemma-reject').textContent = d.rejectLabel;
  }

  _syncFullUI() {
    const layout = this.sim.phase === 'paste-up';
    document.querySelector('.desk-workspace').classList.toggle('paste-up-active', layout);
    document.getElementById('pasteup-controls').hidden = !layout;
    document.getElementById('btn-lock-page').disabled = layout || this.sim.awaitingFirstDispatch;
    document.getElementById('btn-auto-layout').disabled = !layout;
    if (this.drag && (!this.sim.canLayout() || this.drag.edition !== this.sim.edition)) this._cancelDrag();
    if (layout && !this.wasLayout && !this.modalMode) {
      this.selectedStoryUid = this.sim.scoopedStories[0]?.uid ?? null;
    }
    const enterLayout = layout && !this.wasLayout;
    this.wasLayout = layout;
    this._renderOpening();
    this._renderUnlocks();
    this._syncTopBar();
    this._syncSpeedButtons();
    this._renderOperativesRoster();
    this._renderLeadsList();
    this._renderScoopTrayAndWire();
    this._renderBroadsheetAndPress();
    this._renderRotaryPhone();
    this._renderModal();
    if (enterLayout) document.querySelector('#scoop-tray button')?.focus();

    document.getElementById('editor-directive').textContent = this.sim.edition === 1 ?
      'Pick a reporter’s pass. Click a wire slip. We need names before midnight.' :
      EDITOR_QUOTES[(this.sim.edition - 1 + this.sim.scoopsTotal) % EDITOR_QUOTES.length];
  }

  _startShift() {
    if (!this.sim.startNightShift()) return;
    this.coldOpen = new ColdOpen(this.motionPreference.matches);
    this._syncFullUI();
    document.getElementById('btn-skip-intro').focus();
  }

  _skipIntro() {
    if (!this.sim.finishColdOpen()) return;
    this._syncFullUI();
    document.querySelector('#operative-list .op-select')?.focus();
  }

  _updateDeskSize() {
    const tooSmall = !deskFits(window.innerWidth, window.innerHeight);
    if (tooSmall === this.sim.deskTooSmall) return;
    if (tooSmall) this.focusBeforeResize = document.activeElement;
    this.sim.deskTooSmall = tooSmall;
    // Reset the frame origin: time spent behind the card is never caught up.
    this.lastFrameTime = performance.now();
    this._syncFullUI();
    if (!tooSmall && this.focusBeforeResize?.isConnected) this.focusBeforeResize.focus();
  }

  _renderOpening() {
    const { phase, deskTooSmall } = this.sim;
    document.getElementById('title-screen').hidden = phase !== 'title' || deskTooSmall;
    document.getElementById('cold-open').hidden = phase !== 'cold-open' || deskTooSmall;
    document.getElementById('desk-too-small').hidden = !deskTooSmall;
    document.getElementById('opening-arcade').hidden = ['desk', 'paste-up'].includes(phase) && !deskTooSmall;
    document.getElementById('edition-modal').inert = deskTooSmall;
    document.getElementById('title-best').textContent = `Best circulation: ${this.sim.highCirculation.toLocaleString()}`;
    if (phase === 'cold-open') {
      reconcile(document.getElementById('lou-lines'), this.coldOpen.lines.map((line, i) =>
        h('p', '', line, {}, i)));
    }
  }

  _renderUnlocks() {
    for (const [id, feature] of Object.entries({
      'act-wiretap': 'wiretap', 'act-bribe': 'bribe',
      'act-fortify': 'fortify', 'act-phone': 'phone',
    })) document.getElementById(id).hidden = !isUnlocked(feature, this.sim.edition);
    document.getElementById('btn-roll-press').disabled = this.sim.awaitingFirstDispatch;
  }

  _loop(now) {
    const rawDt = Math.max(0.001, Math.min(0.05, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    const dt = rawDt * (this.sim.speed || 1);

    if (this.sim.phase === 'cold-open' && !this.sim.deskTooSmall) {
      if (this.coldOpen.advance(rawDt)) this._skipIntro();
      else this._renderOpening();
    }
    const previousPhase = this.sim.phase;
    const previousEdition = this.sim.edition;
    this.sim.step(dt);
    if (previousPhase !== this.sim.phase || previousEdition !== this.sim.edition) this._syncFullUI();
    // Scoops replace a lead immediately, often without changing the list length.
    // Reconcile membership in this frame so the next pointer event cannot hit
    // a stale button during the 250 ms display-refresh gap. Countdown/progress
    // updates keep their normal cadence; surviving keyed buttons stay attached.
    const rendered = this.renderedLeadIds ?? [];
    if (this.sim.leads.length !== rendered.length ||
        this.sim.leads.some((lead, i) => lead.uid !== rendered[i])) {
      this._renderLeadsList();
    }
    if (this.sim.phase === 'title' && !this.sim.deskTooSmall) this.titleRenderer.renderTitle(rawDt);
    else this.renderer.render(this.sim, this.sim.deskTooSmall ? 0 : rawDt);

    this.uiTickAccum += rawDt;
    if (this.uiTickAccum >= 0.25) {
      this.uiTickAccum = 0;
      this._syncFullUI();
    }

    requestAnimationFrame((t) => this._loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.lateEditionApp = new LateEditionApp();
});

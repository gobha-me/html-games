import { PALETTE } from './palette.js';
// ============================================================================
// LATE EDITION // 1947 — Main Application Controller
// ============================================================================

import { h, reconcile, setText } from './dom.js';
import { FILE_DRAWER, FRONT_PAGE_SLOTS, EDITION_DURATION_SEC, isUnlocked, deskFits } from './config.js';
import { LateEditionSim } from './sim.js';
import { NoirCityRenderer } from './renderer.js';
import { drawSilhouette } from './silhouettes.js';
import { ColdOpen } from './opening.js';
import { NoirAudio } from './audio.js';
import { createAudioAdapter, createStorageAdapter, resolveSeed } from './adapters.js';
import { hotkeyAction } from './hotkeys.js';

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
    this.savedRun = null;
    this.saveNotice = '';
    const stored = this.sim.storage.readRun();
    if (!stored.ok) this.saveNotice = stored.reason;
    else if (stored.json !== null) {
      const loaded = LateEditionSim.deserialize(stored.json);
      if (loaded.ok) this.savedRun = loaded.sim;
      else this.saveNotice = loaded.reason;
    }
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
    this.drawerOpen = false;
    this.pendingSpike = null;
    this.selectedStoryUid = null;
    this.lastFrameTime = performance.now();
    this.uiTickAccum = 0;
    this.modalMode = null;
    this.pressElapsed = 0;
    this.focusBeforeModal = null;

    this._bindEvents();
    this._updateDeskSize();

    if (params.get('preview') === 'showcase' || params.get('preview') === 'combat') {
      this._setupShowcaseState();
    }

    this._syncFullUI();
    // Do not submit a hidden desk's city textures while the full-screen title
    // owns presentation; the frame loop keeps the same phase-based ownership.
    if (this.sim.phase === 'title' && !this.sim.deskTooSmall) this.titleRenderer.renderTitle(0.016);
    else this.renderer.render(this.sim, 0.016);
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
        color: PALETTE.stampRed,
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
        color: PALETTE.stampRed,
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
        color: PALETTE.stampRed,
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
      color: PALETTE.newsprintAged,
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
      } else this.audio.emit('typewriter');
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
    delegate('drawer-files', '[data-file-action]', (button) => {
      const uid = button.dataset.fileUid;
      const action = button.dataset.fileAction;
      const result = action === 'shred' ? this.sim.shredFile(uid) :
        this.sim.useFile(uid, action, button.dataset.fileTarget);
      if (result.ok && action === 'shred' && this.pendingSpike) {
        const pending = this.pendingSpike;
        this.pendingSpike = null;
        this._layoutResult(this.sim.spike(pending.uid));
      }
      const status = document.getElementById('drawer-status');
      setText(status, result.ok ? 'The file has done its work.' : `Cannot use file: ${result.reason}.`);
      if (result.ok && result.effects.killedLead) {
        const stamp = document.createElement('span');
        stamp.className = 'rubber-stamp';
        setText(stamp, 'KILLED');
        status.replaceChildren(stamp);
      }
      // Consumed cards disappear. Keep keyboard focus inside the drawer.
      this._syncFullUI();
      if (!button.isConnected) document.querySelector('#drawer-files button')?.focus();
      if (!button.isConnected && !this.sim.spikedStories.length) document.getElementById('btn-close-drawer').focus();
    });
    this._bindPointerLayout();
  }

  _bindEvents() {
    document.getElementById('btn-drawer').addEventListener('click', () => this._toggleDrawer());
    document.getElementById('btn-close-drawer').addEventListener('click', () => this._toggleDrawer(false));
    document.getElementById('btn-cancel-burn').addEventListener('click', () => {
      this.pendingSpike = null;
      setText(document.getElementById('drawer-status'), 'Copy stays on the desk.');
      this._syncFullUI();
      document.getElementById('btn-close-drawer').focus();
    });
    document.getElementById('btn-start-shift').addEventListener('click', () => this._startShift());
    document.getElementById('btn-continue-run').addEventListener('click', () => this._continueRun());
    window.addEventListener('beforeunload', () => {
      if (this.sim.gameOver) this._discardSave();
      else if (this.sim.canSave()) this._autosave();
    });
    document.getElementById('btn-skip-intro').addEventListener('click', () => this._skipIntro());
    window.addEventListener('resize', () => this._updateDeskSize());
    this._bindListEvents();
    const unlockAudio = (event) => {
      if (event.isTrusted) void this.audio.resume();
    };
    // Capture unlocks before the gesture's command emits a cue. Keep listening
    // so a rejected autoplay/device resume can retry on a later real gesture.
    window.addEventListener('pointerdown', unlockAudio, { capture: true });
    window.addEventListener('keydown', unlockAudio, { capture: true });
    document.addEventListener('visibilitychange', () => this._syncAudioPause());

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
          this.audio.emit('typewriter');
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
        this.audio.emit('dispatch');
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
      this.audio.toggleMute();
      this._syncAudioControls();
    });
    for (const channel of ['music', 'ambience', 'sfx']) {
      document.getElementById(`volume-${channel}`).addEventListener('input', (event) => {
        this.audio.setVolume(channel, Number(event.target.value) / 100);
        this._syncAudioControls();
      });
    }
    this._syncAudioControls();

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
        this._dismissReport();
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
      const phase = this.sim.gameOver || this.sim.editionSummary ? 'modal' :
        this.drawerOpen ? 'drawer-open' : this.sim.phase;
      const action = hotkeyAction(phase, e.code === 'Space' ? ' ' : e.key);
      if (!['desk', 'paste-up'].includes(this.sim.phase)) {
        if (action === 'start-shift' && !e.target?.closest('a')) {
          e.preventDefault();
          if (!e.repeat) {
            if (e.target?.closest('button')) e.target.closest('button').click();
            else if (this.savedRun) this._continueRun();
            else this._startShift();
          }
        } else if (action === 'skip-intro') {
          e.preventDefault();
          this._skipIntro();
        }
        return;
      }
      const modalButton = document.getElementById('btn-modal-continue');
      if (this.sim.gameOver || this.sim.editionSummary) {
        if (action === 'focus-modal') {
          e.preventDefault();
          modalButton.focus();
        } else if (action === 'activate-modal') {
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
      if (action === 'toggle-drawer') {
        e.preventDefault();
        if (!e.repeat) this._toggleDrawer();
        return;
      }
      if (this.drawerOpen) {
        if (action === 'close-drawer') { e.preventDefault(); this._toggleDrawer(false); }
        return; // Native Tab/Enter/Space operate the dossier's small buttons.
      }
      if (this.sim.phase === 'paste-up') {
        if (action === 'cancel-drag') { this._cancelDrag(); return; }
        if (action === 'next-story' || action === 'previous-story') {
          e.preventDefault();
          const stories = [...this.sim.scoopedStories, ...Object.values(this.sim.frontPage).filter(Boolean), ...this.sim.insideStories];
          const index = stories.findIndex((story) => story.uid === this.selectedStoryUid);
          const direction = action === 'next-story' ? 1 : -1;
          const nextIndex = index < 0 ? (direction > 0 ? 0 : stories.length - 1) : (index + direction + stories.length) % stories.length;
          this.selectedStoryUid = stories[nextIndex]?.uid ?? null;
          this._syncFullUI();
          document.querySelector(`[data-story-uid="${this.selectedStoryUid}"]`)?.focus();
          return;
        }
        if (action?.startsWith('place:')) {
          e.preventDefault();
          this._assignStory(action.slice('place:'.length));
          return;
        }
        if (action === 'unplace') {
          e.preventDefault();
          this._layoutResult(this.sim.unplace(this.selectedStoryUid));
          return;
        }
      }
      if (action === 'lock-up') {
        this.sim.lockUp();
        this._syncFullUI();
      } else if (action?.startsWith('select-operative:')) {
        const idx = Number(action.slice('select-operative:'.length));
        if (this.sim.selectOperative(this.sim.operatives[idx]?.id)) {
          this.audio.emit('typewriter');
          this._syncFullUI();
        }
      } else if (action === 'assist') {
        this._autoLayoutBestStories();
        this._syncFullUI();
      } else if (action === 'wiretap') {
        this.sim.triggerWiretap();
        this._syncFullUI();
      } else if (action === 'bribe') {
        this.sim.acceptSyndicateBribe();
        this._syncFullUI();
      } else if (action === 'fortify') {
        this.sim.fortifyPressRoom();
        this._syncFullUI();
      } else if (action === 'phone') {
        this.sim.triggerRotaryDilemma();
        this._syncFullUI();
      } else if (action === 'accept-dilemma' && this.sim.activeDilemma) {
        this.sim.resolveDilemma(true);
        this._syncFullUI();
      } else if (action === 'reject-dilemma' && this.sim.activeDilemma) {
        this.sim.resolveDilemma(false);
        this._syncFullUI();
      } else if (action === 'pause') {
        this.sim.paused = !this.sim.paused;
        this._syncSpeedButtons();
      } else if (action === 'mute') {
        this.audio.toggleMute();
        this._syncAudioControls();
      } else if (action === 'publish') {
        e.preventDefault();
        if (this.sim.editionSummary) {
          this._dismissReport();
        } else {
          this.sim.publishEdition();
        }
        this._syncFullUI();
      }
    });
  }

  _layoutResult(result) {
    setText(document.getElementById('layout-status'), result.ok ? 'Copy desk updated.' : `Cannot assign: ${result.reason}.`);
    this._syncFullUI();
  }

  _assignStory(slotId, uid = this.selectedStoryUid) {
    const result = slotId === 'spike' ? this.sim.spike(uid) : this.sim.placeStory(uid, slotId);
    this._layoutResult(result);
    if (result.reason === 'drawer-full') {
      this.pendingSpike = { uid, edition: this.sim.edition };
      setText(document.getElementById('drawer-status'), 'DRAWER FULL. Choose a file to shred before spiking this story.');
      this._toggleDrawer(true);
      document.querySelector('#drawer-files [data-file-action="shred"]')?.focus();
    }
  }

  _toggleDrawer(open = !this.drawerOpen) {
    if (!this.sim.canUseDrawer()) return;
    this.drawerOpen = open;
    if (!open) this.pendingSpike = null;
    this._syncFullUI();
    if (open) (document.querySelector('#drawer-files button') || document.getElementById('btn-close-drawer')).focus();
    else document.getElementById('btn-drawer').focus();
  }

  _renderDrawer() {
    const available = this.sim.canUseDrawer();
    if (!available) { this.drawerOpen = false; this.pendingSpike = null; }
    if (this.pendingSpike && (!this.sim.canLayout() || this.pendingSpike.edition !== this.sim.edition)) this.pendingSpike = null;
    document.getElementById('file-drawer').inert = !available;
    const handle = document.getElementById('btn-drawer');
    setText(handle, `FILES [D] · ${this.sim.spikedStories.length}/${FILE_DRAWER.capacity}`);
    handle.setAttribute('aria-expanded', String(this.drawerOpen));
    document.getElementById('file-drawer').classList.toggle('open', this.drawerOpen);
    document.getElementById('drawer-body').hidden = !this.drawerOpen;
    document.getElementById('btn-cancel-burn').hidden = !this.pendingSpike;
    const actions = [['favor', 'tip', 'Favor: police tip'], ['favor', 'stop', 'Favor: stop goon / raid'],
      ['favor', 'kill', 'Favor: kill rival story'], ['squeeze', 'cash', 'Squeeze: cash'],
      ['squeeze', 'protection', 'Squeeze: protection'], ['print-later', null, 'Print later'], ['shred', null, 'Shred']];
    reconcile(document.getElementById('drawer-files'), this.sim.spikedStories.map((file) =>
      h('article', `dossier${file.freshness <= 0 ? ' expired' : ''}`, [
        h('h3', '', file.subject),
        h('p', 'file-tags', file.tags.join(' · ')),
        h('p', '', `WEIGHT ${file.weight} · $${FILE_DRAWER.cashPerWeightNight * file.weight * file.freshness} / −${FILE_DRAWER.protectionPerWeight * file.weight} HEAT`),
        h('p', '', `NEXT SQUEEZE: ${Math.min(100, Math.round((FILE_DRAWER.burnBase + FILE_DRAWER.burnPerExposure * (file.exposure + 1)) * 100))}% BURN RISK`),
        h('p', 'carbon-dots', '●'.repeat(Math.max(0, file.freshness)) + '○'.repeat(Math.max(0, FILE_DRAWER.freshness - file.freshness)),
          { 'aria-label': `${file.freshness} nights fresh` }),
        h('p', 'exposure-holes', '•'.repeat(file.exposure), { 'aria-label': `${file.exposure} exposure pinholes` }),
        h('div', 'file-actions', actions.map(([action, target, label]) => h('button', 'file-button', label,
          { type: 'button', 'data-file-uid': file.uid, 'data-file-action': action,
            ...(target ? { 'data-file-target': target } : {}) }, `${action}-${target}`))),
      ], { 'data-file-uid': file.uid }, file.uid)));
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
        setText(drag.ghost, 'GALLEY PROOF');
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
    this._syncAudioPause();
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
    setText(document.getElementById('hud-edition'), `#${this.sim.edition}`);
    setText(document.getElementById('hud-clock'), this.sim.getClockString());
    setText(document.getElementById('hud-circulation'), this.sim.circulation.toLocaleString());
    setText(document.getElementById('hud-funds'), `$${this.sim.cash}`);
    setText(document.getElementById('hud-credibility'), `${this.sim.credibility}%`);
    setText(document.getElementById('hud-heat'), `${this.sim.syndicateHeat}%`);

    const selOp =
      this.sim.operatives.find((o) => o.id === this.sim.selectedOpId) ||
      this.sim.operatives[0];
    if (selOp) {
      const idx = this.sim.operatives.indexOf(selOp) + 1;
      setText(document.getElementById('map-selection-status'), `[${idx}] ${selOp.name.toUpperCase()}`);
    }
  }

  _renderOperativesRoster() {
    reconcile(document.getElementById('operative-list'), this.sim.operatives.flatMap((op, idx) => this.sim.operativeAvailable(op) ? [
      h('div', `op-card ${op.id === this.sim.selectedOpId ? 'selected' : ''}`, [
        h('button', 'op-pass-top op-select', [
          h('span', 'op-avatar-wrap', [
            h('span', 'op-key', idx + 1),
            h('canvas', 'op-avatar', [], { width: 64, height: 64, role: 'img', 'aria-label': op.name, 'data-role': op.role }),
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
    for (const portrait of document.querySelectorAll('.op-avatar')) {
      if (portrait.dataset.painted) continue;
      const ctx = portrait.getContext('2d');
      ctx.translate(30, 56);
      ctx.scale(1.2, 1.2);
      drawSilhouette(ctx, portrait.dataset.role);
      portrait.dataset.painted = 'true';
    }
  }

  _renderLeadsList() {
    this.renderedLeadIds = this.sim.leads.map((lead) => lead.uid);
    setText(document.getElementById('leads-count'), `${this.sim.leads.length} ACTIVE`);
    reconcile(document.getElementById('lead-list'), this.sim.leads.map((lead) =>
      h('button', `lead-item ${lead.uid === this.sim.selectedLeadId ? 'selected' : ''}`, [
        h('span', 'lead-top', [
          h('span', 'lead-cat', `${lead.beat} · $${lead.baseValue}`, {}),
          h('span', 'series-badge', lead.arcCode ? `${lead.arcCode}·P${lead.arcPart}/3` : '', lead.arcCode ? {} : { hidden: '' }),
          h('span', '', `${Math.ceil(lead.timeLeft)}s ${lead.photoVerified ? '· PHOTO 1.8×' : lead.scoopedByRival ? '· RIVAL 0.5×' : ''}`),
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
          h('span', '', `${st.beat} ${st.seriesBadge ? `· ${st.seriesBadge}` : ''} ${st.photoVerified ? 'PHOTO 1.8×' : ''}`, {}),
          h('span', '', `+$${st.baseValue}`),
        ]),
        h('span', 'scoop-chip-title', st.headline),
      ], { type: 'button', 'data-story-uid': st.uid, 'aria-pressed': String(st.uid === this.selectedStoryUid) }, st.uid)) : [
      h('div', 'scoop-chip', [
        h('div', 'scoop-chip-top', [h('span', '', 'NO COPY'), h('span', '', '[1–4]')]),
        h('div', 'scoop-chip-title', 'Lock up [L] · 11 PM'),
      ], { style: 'grid-column:1 / -1' }, 'empty'),
    ]);
    // Entries are stable objects, even if two messages have identical copy/time.
    reconcile(document.getElementById('wire-log'), this.sim.wireLog.slice(0, 7).map((entry) =>
      h('div', `wire-entry ${entry.tone}`, `[${entry.time}] ${entry.text}`, {}, entry)));
  }

  _renderBroadsheetAndPress() {
    setText(document.getElementById('paper-edition-label'), `EDITION #${this.sim.edition}`);
    const proj = this.sim.calculateEditionProjection();
    setText(document.getElementById('paper-projected-readers'), `EST. ${proj.circDelta >= 0 ? '+' : ''}${proj.circDelta.toLocaleString()} READERS`);
    this._renderFrontPage(document.getElementById('layout-slots'), this.sim.frontPage, true);
    reconcile(document.getElementById('inside-stories'), this.sim.insideStories.map((story) =>
      h('button', `scoop-chip ${story.uid === this.selectedStoryUid ? 'selected-copy' : ''}`, story.headline,
        { type: 'button', 'data-story-uid': story.uid, 'aria-pressed': String(story.uid === this.selectedStoryUid) }, story.uid)));
    setText(document.getElementById('spiked-count'), `${this.sim.spikedStories.length} SPIKED`);
    setText(document.getElementById('assist-note'), this.sim.editionLayout.assisted ? 'ASSISTED · −500 READERS' : 'MANUAL PASTE-UP');

    setText(document.getElementById('proj-circ'), `${proj.circDelta >= 0 ? '+' : ''}${proj.circDelta.toLocaleString()}`);
    setText(document.getElementById('proj-cash'), `+$${proj.cashDelta}`);
    setText(document.getElementById('proj-cred'), `${proj.credDelta >= 0 ? '+' : ''}${proj.credDelta}%`);
    setText(document.getElementById('proj-heat'), `${proj.heatDelta >= 0 ? '+' : ''}${proj.heatDelta}%`);

    const inkColorMap = { herald: PALETTE.brass, observer: PALETTE.stampRed };
    const allPapers = [
      { id: 'player', name: '★ The Evening Star (You)', circulation: this.sim.circulation, inkColor: PALETTE.stampRed },
      ...this.sim.rivalStandings.map((r) => ({ ...r, inkColor: inkColorMap[r.id] || PALETTE.smoke })),
    ].sort((a, b) => b.circulation - a.circulation);
    const maxCirc = Math.max(40000, ...allPapers.map((p) => p.circulation));
    reconcile(document.getElementById('rival-standings'), allPapers.map((p) =>
      h('div', 'rival-row', [
        h('div', 'rival-row-top', [
          // Names stay night ink for legibility on newsprint (aged-paper ink failed contrast); the bar carries the paper's colour.
          h('span', '', p.name),
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
        stamp: 'WIRE STAND-IN',
        headline: 'CITY COUNCIL DEBATES HARBOR DREDGING APPROPRIATION',
        deck: 'Bond hearing adjourns without a vote.',
        body: 'Aldermen tabled the outer-channel contracts until November.',
      },
      above_fold: {
        stamp: 'WIRE STAND-IN',
        headline: 'AUTUMN SQUALL DELAYS EVENING COMMUTER FERRIES',
        deck: 'Cross-harbor service resumes at dawn.',
        body: 'Harbor Master bulletins report twenty-minute delays along the Staten slip due to heavy October rain and southwest gusts. Commuters crowded the terminal waiting room until the 9:15 P.M. steamer cleared the breakwater.',
      },
      photo_expose: {
        stamp: 'WIRE STAND-IN',
        headline: 'COURTHOUSE ANNEX REPAIRS ENTER FOURTH MONTH',
        deck: 'Scaffolding remains over the east portico.',
        body: 'Public Works crews finished the third-floor cornice Tuesday.',
      },
      editorial: {
        stamp: 'WIRE STAND-IN',
        headline: 'MUNICIPAL COAL RESERVES REPORTED ADEQUATE BY BOARD',
        deck: 'Winter stockpiles reach eighty percent.',
        body: 'Fuel commissioners assured building superintendents that rail shipments from the anthracite valley remain on schedule despite wet switchyards.',
      },
    };

    if (!isUnlocked('photographer', this.sim.edition)) {
      standInBySlot.photo_expose.stamp = 'DARKROOM · NIGHT 2';
      standInBySlot.photo_expose.deck = 'Darkroom opens night two.';
    }
    reconcile(slotsEl, FRONT_PAGE_SLOTS.map((slot) => {
      const st = page[slot.id];
      const filler = standInBySlot[slot.id] || standInBySlot.banner;
      const photo = slot.id === 'photo_expose' && isUnlocked('photographer', this.sim.edition);
      const photoNote = st?.photoVerified ? ' · PHOTO 1.8×' : st?.scoopedByRival ? ' · RIVAL 0.5×' : '';
      return h('article', `paper-slot ${st ? '' : 'empty'} ${st?.uid === this.selectedStoryUid ? 'selected-copy' : ''}`, [
        h('div', 'slot-meta', [
          h('span', '', `${({ banner: 'BANNER [1/B]', above_fold: 'FOLD [2/F]', photo_expose: 'PHOTO [3/P]', editorial: 'EDITORIAL [4/E]' })[slot.id]}${st ? ` (${slot.mul}×)` : ''}`),
          h('span', st ? 'rubber-stamp' : 'galley-stamp', st ? `${st.seriesBadge ? 'EXCLUSIVE' : 'VERIFIED'}${photoNote}` : filler.stamp),
        ]),
        h('span', st?.seriesBadge ? 'series-stamp' : '', st?.seriesBadge ? `${st.seriesBadge} (+${st.arcPart === 3 ? '4,500' : st.arcPart === 2 ? '2,500' : '1,200'} RDRS)` : '', st?.seriesBadge ? {} : { hidden: '' }),
        ...(photo ? [h('div', 'halftone-photo-box', [
          h('img', 'halftone-photo-img', [], {
            src: 'assets/sprites/masthead_press.png',
            alt: st ? 'Speed Graphic Exposé' : 'Darkroom Plate',
          }),
          h('div', 'halftone-caption-bar', [
            h('span', '', st ? `PHOTO · ${st.beat}` : 'DARKROOM PLATE OPEN'),
            h('span', '', st ? (st.photoVerified ? 'VERIFIED 1.8×' : 'FILE PHOTO') : 'PHOTO 1.8×'),
          ]),
        ])] : []),
        h('div', st ? '' : 'standin-copy', [
          h('div', 'slot-headline', st ? st.headline : filler.headline),
          h('div', 'slot-deck', st ? st.subdeck : filler.deck),
          h('div', 'slot-byline', st ? 'By Staff' : '', st ? {} : { hidden: '' }),
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
    if (folded && this.modalMode !== 'folded') this._discardSave();
    const changed = mode !== this.modalMode;
    if (sum !== this.shownPressSummary) {
      if (this.shownPressSummary) this.audio.cancel('press');
      this.shownPressSummary = sum;
      this.pressElapsed = 0;
    }
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
    const elapsed = this.motionPreference.matches ? 4 : this.pressElapsed;
    const stage = elapsed < 0.6 ? 'plates' : elapsed < 1.5 ? 'rolling' : elapsed < 2.25 ? 'papers' : elapsed < 3.25 ? 'extra' : 'morning';
    const show = document.getElementById('press-show');
    show.hidden = folded;
    show.dataset.stage = stage;
    setText(document.getElementById('press-caption'), {
      plates: 'PLATES LOCKED · THE ROTARY PRESS TAKES THE PAGE',
      rolling: 'ROLLERS TURN · THE PRESS GATHERS SPEED',
      papers: 'FRESH INK · PAPERS FLY OFF THE ROLL',
      extra: 'NEWSBOY: “EXTRA! EXTRA!”',
      morning: 'DAWN · THE RIVAL PAPER IS ON THE STAND',
    }[stage]);
    const morning = document.getElementById('morning-after');
    morning.hidden = folded || stage !== 'morning';
    if (sum && !folded) {
      const herald = this.sim.rivalStandings.find((paper) => paper.id === 'herald');
      setText(document.getElementById('rival-headline'), herald.circulation >= sum.totalCirculation ?
        'HERALD LEADS THE MORNING STREET SALES' : 'EVENING STAR STEALS A MARCH ON THE HERALD');
      setText(document.getElementById('rival-deck'),
        `The Daily Herald · ${herald.circulation.toLocaleString()} readers. The Evening Star · ${sum.totalCirculation.toLocaleString()} readers. The city remembers edition #${sum.edition}.`);
    }
    setText(document.getElementById('modal-kicker'), folded ? 'THE EVENING STAR // STOP PRESS TELEGRAM' : `ROTARY PRESS REPORT // EDITION #${sum.edition}`);
    setText(document.getElementById('modal-title'), folded ? 'PAPER FOLDED' : `EXTRA! EXTRA! EDITION #${sum.edition} HITS THE STREETS`);
    setText(document.getElementById('modal-subtitle'), folded ? this.sim.gameOverReason :
      `Printed ${sum.slottedCount} stories (${sum.insideCount} inside). ${sum.assisted ? 'ASSISTED: −500 readers. ' : ''}${sum.emptyBanner ? 'WIRE STAND-IN: −6 trust. ' : ''}Managing Editor Lou Vance reviews the morning street sales:`);
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
    setText(button, folded ? 'Start a new night shift' : 'START NEXT NIGHT SHIFT [SPACE]');
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
    setText(document.getElementById('rotary-caller'), d.caller);
    setText(document.getElementById('rotary-timer'), `${Math.max(1, Math.ceil(d.timer))}s`);
    setText(document.getElementById('rotary-prompt'), d.prompt);
    setText(document.getElementById('btn-dilemma-accept'), d.acceptLabel);
    setText(document.getElementById('btn-dilemma-reject'), d.rejectLabel);
  }

  _syncFullUI() {
    this._syncAudioPause();
    this.audio.setScene({ active: this.sim.phase !== 'title' && !this.sim.editionSummary && !this.sim.gameOver,
      progress: this.sim.clockSec / EDITION_DURATION_SEC });
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
    this._renderDrawer();
    this._renderModal();
    if (enterLayout) document.querySelector('#scoop-tray button')?.focus();

    setText(document.getElementById('editor-directive'), this.sim.edition === 1 ?
      'Pick a reporter’s pass. Click a wire slip. We need names before midnight.' :
      EDITOR_QUOTES[(this.sim.edition - 1 + this.sim.scoopsTotal) % EDITOR_QUOTES.length]);
  }

  _discardSave() {
    this.savedRun = null;
    const result = this.sim.storage.clearRun();
    this.saveNotice = result.ok ? '' : result.reason;
  }

  _autosave() {
    if (!this.sim.canSave()) return;
    try {
      const result = this.sim.storage.writeRun(this.sim.serialize());
      this.saveNotice = result.ok ? `Run saved. Edition ${this.sim.edition} is on file.` : result.reason;
    } catch {
      // A rejected/oversized snapshot must never interrupt the live run. Keep the
      // previous checkpoint intact and tell the editor that this one was not saved.
      this.saveNotice = 'The run could not be saved. The last checkpoint is unchanged.';
    }
    setText(document.getElementById('save-status'), this.saveNotice);
  }

  _dismissReport() {
    if (!this.sim.editionSummary || this.sim.gameOver) return;
    this.sim.editionSummary = null;
    this._autosave();
  }

  _continueRun() {
    if (!this.savedRun || this.sim.phase !== 'title' || this.sim.deskTooSmall) return;
    // Keep browser ports outside the pure deserializer and its stored object.
    const { storage, audio, now, highCirculation } = this.sim;
    this.sim = this.savedRun;
    this.savedRun = null;
    Object.assign(this.sim, { storage, audio, now, highCirculation, deskTooSmall: false });
    // Constructor display copy describes night one. Rebuild it for this checkpoint
    // without carrying stale wire messages or timestamps into the resumed desk.
    this.sim.wireLog = [];
    this.sim.setBanner(`EDITION #${this.sim.edition} // NIGHT DESK REOPENED`,
      'THE MORGUE FILE IS BACK ON THE DESK. THE CITY REMEMBERS.', 4.5);
    this.sim.logWire(`RUN CONTINUED: Edition ${this.sim.edition}. Drawer and city records restored.`, 'ops');
    this.lastFrameTime = performance.now();
    this.uiTickAccum = 0;
    this.saveNotice = '';
    this._syncFullUI();
    document.querySelector('#operative-list .op-select')?.focus();
  }

  _startShift() {
    if (this.sim.phase !== 'title' || this.sim.deskTooSmall) return;
    if (this.savedRun && !window.confirm('Start a new run and overwrite the saved run?')) return;
    this._discardSave();
    this.sim.startNightShift();
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
    // Browser zoom shrinks innerWidth but leaves the browser frame width alone.
    // Recover the physical desk dimensions at >=125% magnification; ordinary
    // window borders are below that threshold. CSS/container queries handle the
    // smaller layout viewport. Do not use DPR: Retina screens also report 2.
    const frameScale = window.outerWidth / window.innerWidth;
    const zoom = frameScale >= 1.25 ? frameScale : 1;
    const tooSmall = !deskFits(window.innerWidth * zoom, window.innerHeight * zoom);
    if (tooSmall === this.sim.deskTooSmall) return;
    if (tooSmall) this.focusBeforeResize = document.activeElement;
    this.sim.deskTooSmall = tooSmall;
    // Reset the frame origin: time spent behind the card is never caught up.
    this.lastFrameTime = performance.now();
    this._syncFullUI();
    if (!tooSmall && this.focusBeforeResize?.isConnected) this.focusBeforeResize.focus();
  }

  _syncAudioControls() {
    const button = document.getElementById('btn-audio');
    setText(button, this.audio.muted ? 'SOUND: OFF [M]' : 'SOUND: ON [M]');
    button.classList.toggle('active', !this.audio.muted);
    button.setAttribute('aria-pressed', String(this.audio.muted));
    for (const channel of ['music', 'ambience', 'sfx']) {
      const value = String(Math.round(this.audio.settings[channel] * 100));
      document.getElementById(`volume-${channel}`).value = value;
      setText(document.getElementById(`volume-${channel}-value`), `${value}%`);
    }
  }

  _syncAudioPause() {
    void this.audio.setSuspended(document.hidden || this.sim.deskTooSmall || this.sim.paused);
  }

  _renderOpening() {
    const { phase, deskTooSmall } = this.sim;
    if (phase !== 'title' || deskTooSmall) this.titleRenderer.releaseTitle();
    document.getElementById('title-screen').hidden = phase !== 'title' || deskTooSmall;
    document.getElementById('cold-open').hidden = phase !== 'cold-open' || deskTooSmall;
    document.getElementById('desk-too-small').hidden = !deskTooSmall;
    document.getElementById('opening-arcade').hidden = ['desk', 'paste-up'].includes(phase) && !deskTooSmall;
    document.getElementById('edition-modal').inert = deskTooSmall;
    const continueButton = document.getElementById('btn-continue-run');
    continueButton.hidden = !this.savedRun;
    if (this.savedRun) setText(continueButton, `Continue the run (Edition ${this.savedRun.edition})`);
    setText(document.getElementById('btn-start-shift'), this.savedRun ? 'New run' : 'Start the night shift');
    setText(document.getElementById('title-save-notice'), this.saveNotice);
    setText(document.getElementById('save-status'), this.saveNotice);
    setText(document.getElementById('title-best'), `Best circulation: ${this.sim.highCirculation.toLocaleString()}`);
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
    if (this.sim.editionSummary && !document.hidden && !this.sim.deskTooSmall && !this.sim.paused) this.pressElapsed += rawDt;

    if (this.sim.phase === 'cold-open' && !this.sim.deskTooSmall) {
      if (this.coldOpen.advance(rawDt)) this._skipIntro();
      else this._renderOpening();
    }
    const previousPhase = this.sim.phase;
    const previousEdition = this.sim.edition;
    const wasGameOver = this.sim.gameOver;
    this.sim.step(dt);
    if (wasGameOver !== this.sim.gameOver || previousPhase !== this.sim.phase || previousEdition !== this.sim.edition) this._syncFullUI();
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
    else {
      this.titleRenderer.releaseTitle();
      this.renderer.render(this.sim, this.sim.deskTooSmall ? 0 : rawDt);
    }

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

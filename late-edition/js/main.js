// ============================================================================
// LATE EDITION // 1947 — Main Application Controller
// ============================================================================

import { FRONT_PAGE_SLOTS } from './config.js';
import { LateEditionSim } from './sim.js';
import { NoirCityRenderer } from './renderer.js';
import { NoirAudio } from './audio.js';

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
    this.sim = new LateEditionSim(this.audio);
    this.canvas = document.getElementById('city-canvas');
    this.renderer = new NoirCityRenderer(this.canvas);
    this.selectedStoryUid = null;
    this.lastFrameTime = performance.now();
    this.uiTickAccum = 0;

    this._bindEvents();

    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'showcase' || params.get('preview') === 'combat') {
      this._setupShowcaseState();
    }

    this._syncFullUI();
    this.renderer.render(this.sim, 0.016);
    requestAnimationFrame((t) => this._loop(t));
  }

  _setupShowcaseState() {
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
        headline: 'DA’S STAR WITNESS SPOTTED IN BLUE VELVET VIP BOOTH',
        subdeck: 'Speed Graphic flashbulb catches grand-jury informant toasting Syndicate counsel.',
        baseValue: 220,
        credibility: 9,
        heat: 12,
        photoVerified: true,
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
    this.sim.plateStoryToFrontPage('demo_story_1', 'banner');
    this.sim.plateStoryToFrontPage('demo_story_2', 'photo_expose');
    this.sim.plateStoryToFrontPage('demo_story_3', 'above_fold');
    this.sim.banner.timer = 0;
    this.sim.flashes.push({
      x: this.sim.operatives[2].x,
      y: this.sim.operatives[2].y,
      r: 34,
      alpha: 0.9,
      color: '#38bdf8',
    });
  }

  _bindEvents() {
    const unlockAudio = () => this.audio.resume();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    this.canvas.addEventListener('mousemove', (e) => {
      const pt = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.renderer.mouseWorld = pt;

      let hoveredOp = null;
      for (const op of this.sim.operatives) {
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
      const pt = this.renderer.screenToWorld(e.clientX, e.clientY);

      for (const op of this.sim.operatives) {
        if (Math.hypot(op.x - pt.x, op.y - pt.y) <= 30) {
          this.sim.selectedOpId = op.id;
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

    document.getElementById('btn-modal-continue').addEventListener('click', () => {
      if (this.sim.gameOver) {
        this.sim.reset();
      } else {
        this.sim.editionSummary = null;
      }
      this._syncFullUI();
    });

    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (['1', '2', '3', '4'].includes(k)) {
        const idx = Number(k) - 1;
        if (this.sim.operatives[idx]) {
          this.sim.selectedOpId = this.sim.operatives[idx].id;
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

  _autoLayoutBestStories() {
    for (const slot of FRONT_PAGE_SLOTS) {
      if (!this.sim.frontPage[slot.id] && this.sim.scoopedStories.length > 0) {
        this.sim.plateStoryToFrontPage(this.sim.scoopedStories[0].uid, slot.id);
      }
    }
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
    const container = document.getElementById('operative-list');
    const spriteMap = {
      reporter: 'assets/sprites/unit_reporter.png',
      photographer: 'assets/sprites/unit_photographer.png',
      fixer: 'assets/sprites/unit_fixer.png',
    };

    container.innerHTML = this.sim.operatives
      .map((op, idx) => {
        const isSel = op.id === this.sim.selectedOpId;
        return `
          <div class="op-card ${isSel ? 'selected' : ''}" data-op-id="${op.id}">
            <div class="op-pass-top">
              <div class="op-avatar-wrap">
                <span class="op-key">${idx + 1}</span>
                <img src="${spriteMap[op.sprite]}" alt="${op.name}" class="op-avatar" />
              </div>
              <div class="op-info">
                <div class="op-name-row">${op.name}</div>
                <div class="op-role">${op.roleLabel} · ${op.callsign}</div>
              </div>
            </div>
            <div class="op-pass-bottom">
              <div class="op-status">${op.state}</div>
              <button class="op-dispatch-btn" data-dispatch-op="${op.id}" title="Dispatch to selected lead">
                SEND
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('.op-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.op-dispatch-btn')) return;
        this.sim.selectedOpId = card.dataset.opId;
        this.audio.typewriter();
        this._syncFullUI();
      });
    });

    container.querySelectorAll('.op-dispatch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const opId = btn.dataset.dispatchOp;
        this.sim.selectedOpId = opId;
        const targetUid =
          this.sim.selectedLeadId ||
          (this.sim.leads[0] && this.sim.leads[0].uid);
        if (targetUid) {
          this.sim.dispatchOperativeToLead(opId, targetUid);
          this._syncFullUI();
        }
      });
    });
  }

  _renderLeadsList() {
    const container = document.getElementById('lead-list');
    document.getElementById('leads-count').textContent =
      `${this.sim.leads.length} ACTIVE`;

    container.innerHTML = this.sim.leads
      .map((lead) => {
        const isSel = lead.uid === this.sim.selectedLeadId;
        return `
          <div class="lead-item ${isSel ? 'selected' : ''}" data-lead-id="${lead.uid}">
            <div class="lead-top">
              <span class="lead-cat" style="color:${lead.color}">${lead.beat} · $${lead.baseValue}</span>
              <span>${Math.ceil(lead.timeLeft)}s ${lead.photoVerified ? '· 📸 1.8×' : ''}</span>
            </div>
            <div class="lead-headline">${lead.headline}</div>
            <div class="lead-bars">
              <div class="progress-track" title="Investigation ${Math.round(lead.progress)}%">
                <div class="progress-fill player" style="width:${Math.round(lead.progress)}%"></div>
              </div>
              <div class="progress-track" title="Rival Herald ${Math.round(lead.rivalProgress)}%">
                <div class="progress-fill rival" style="width:${Math.round(lead.rivalProgress)}%"></div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('.lead-item').forEach((item) => {
      item.addEventListener('click', () => {
        const leadUid = item.dataset.leadId;
        this.sim.selectedLeadId = leadUid;
        this.sim.dispatchOperativeToLead(this.sim.selectedOpId, leadUid);
        this._syncFullUI();
      });
    });
  }

  _renderScoopTrayAndWire() {
    const tray = document.getElementById('scoop-tray');
    if (this.sim.scoopedStories.length === 0) {
      tray.innerHTML = `
        <div class="scoop-chip" style="grid-column: 1 / -1; opacity: 0.8;">
          <div class="scoop-chip-top"><span>ALL SCOOPS PLATED ON FRONT PAGE</span><span>DISPATCH UNITS [1–4]</span></div>
          <div class="scoop-chip-title">Verified scoops automatically plate into open columns on the right-hand broadsheet.</div>
        </div>
      `;
    } else {
      tray.innerHTML = this.sim.scoopedStories
        .map((st) => {
          return `
            <div class="scoop-chip" data-story-uid="${st.uid}">
              <div class="scoop-chip-top">
                <span style="color:${st.color}">${st.beat} ${st.photoVerified ? '📸 1.8×' : ''}</span>
                <span>+$${st.baseValue}</span>
              </div>
              <div class="scoop-chip-title">${st.headline}</div>
            </div>
          `;
        })
        .join('');

      tray.querySelectorAll('.scoop-chip[data-story-uid]').forEach((el) => {
        el.addEventListener('click', () => {
          const uid = el.dataset.storyUid;
          this.selectedStoryUid = uid;
          this.sim.plateStoryToFrontPage(uid);
          this._syncFullUI();
        });
      });
    }

    const wire = document.getElementById('wire-log');
    wire.innerHTML = this.sim.wireLog
      .slice(0, 7)
      .map(
        (entry) =>
          `<div class="wire-entry ${entry.tone}">[${entry.time}] ${entry.text}</div>`
      )
      .join('');
  }

  _renderBroadsheetAndPress() {
    document.getElementById('paper-edition-label').textContent =
      `VOL. LVIII · LATE NIGHT EDITION #${this.sim.edition}`;

    const proj = this.sim.calculateEditionProjection();
    document.getElementById('paper-projected- readers').textContent =
      `EST. ${proj.circDelta >= 0 ? '+' : ''}${proj.circDelta.toLocaleString()} READERS`;

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

    const slotsEl = document.getElementById('layout-slots');
    slotsEl.innerHTML = FRONT_PAGE_SLOTS.map((slot) => {
      const st = this.sim.frontPage[slot.id];
      const isPhotoSlot = slot.id === 'photo_expose';
      if (!st) {
        const filler = standInBySlot[slot.id] || standInBySlot.banner;
        return `
          <div class="paper-slot empty" data-slot-id="${slot.id}">
            <div class="slot-meta">
              <span>${slot.label}</span>
              <span class="galley-stamp">${filler.stamp}</span>
            </div>
            ${
              isPhotoSlot
                ? `<div class="halftone-photo-box">
                     <img src="assets/sprites/unit_photographer.png" alt="Darkroom Plate" class="halftone-photo-img" />
                     <div class="halftone-caption-bar"><span>DARKROOM PLATE OPEN</span><span>📸 1.8× PHOTO BONUS</span></div>
                   </div>`
                : ''
            }
            <div class="standin-copy">
              <div class="slot-headline">${filler.headline}</div>
              <div class="slot-deck">${filler.deck}</div>
              <div class="slot-body-copy">${filler.body}</div>
            </div>
          </div>
        `;
      }
      const bodyText = bodyCopyByBeat[st.beat] || bodyCopyByBeat.CRIME;
      return `
        <div class="paper-slot" data-slot-id="${slot.id}">
          <div class="slot-meta">
            <span>${slot.label} (${slot.mul}×)</span>
            <span>${st.beat} · $${st.baseValue} ${st.photoVerified ? '· 📸 1.8× PHOTO' : ''}</span>
          </div>
          ${
            isPhotoSlot
              ? `<div class="halftone-photo-box">
                   <img src="assets/sprites/masthead_press.png" alt="Speed Graphic Exposé" class="halftone-photo-img" />
                   <div class="halftone-caption-bar"><span>📸 SPEED GRAPHIC // ${st.beat}</span><span>${st.photoVerified ? 'VERIFIED 1.8×' : 'FILE PHOTO'}</span></div>
                 </div>`
              : ''
          }
          <div class="slot-headline">${st.headline}</div>
          <div class="slot-deck">${st.subdeck}</div>
          <div class="slot-byline">By Staff Correspondent · Metropolis, Oct. 1947</div>
          <div class="slot-body-copy">${bodyText}</div>
        </div>
      `;
    }).join('');

    slotsEl.querySelectorAll('.paper-slot').forEach((slotEl) => {
      slotEl.addEventListener('click', () => {
        const slotId = slotEl.dataset.slotId;
        if (this.sim.scoopedStories.length > 0) {
          const candidate =
            this.sim.scoopedStories.find((s) => s.uid === this.selectedStoryUid) ||
            this.sim.scoopedStories[0];
          this.sim.plateStoryToFrontPage(candidate.uid, slotId);
          this._syncFullUI();
        }
      });
    });

    document.getElementById('proj-circ').textContent =
      `${proj.circDelta >= 0 ? '+' : ''}${proj.circDelta.toLocaleString()}`;
    document.getElementById('proj-cash').textContent = `+$${proj.cashDelta}`;
    document.getElementById('proj-cred').textContent =
      `${proj.credDelta >= 0 ? '+' : ''}${proj.credDelta}%`;
    document.getElementById('proj-heat').textContent =
      `${proj.heatDelta >= 0 ? '+' : ''}${proj.heatDelta}%`;

    const standingsEl = document.getElementById('rival-standings');
    const inkColorMap = {
      herald: '#1e3a8a',
      observer: '#991b1b',
      gazette: '#334155',
    };
    const allPapers = [
      {
        name: '★ Metropolitan Chronicle (You)',
        circulation: this.sim.circulation,
        inkColor: '#b91c1c',
      },
      ...this.sim.rivalStandings.map((r) => ({
        ...r,
        inkColor: inkColorMap[r.id] || '#1e293b',
      })),
    ].sort((a, b) => b.circulation - a.circulation);

    const maxCirc = Math.max(40000, ...allPapers.map((p) => p.circulation));
    standingsEl.innerHTML = allPapers
      .map((p) => {
        const pct = Math.min(100, Math.round((p.circulation / maxCirc) * 100));
        return `
          <div class="rival-row">
            <div class="rival-row-top">
              <span style="color:${p.inkColor}">${p.name}</span>
              <span style="color:#14100a">${p.circulation.toLocaleString()}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%; background:${p.inkColor}"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  _renderModal() {
    const modal = document.getElementById('edition-modal');
    const sum = this.sim.editionSummary;
    if (!sum) {
      modal.classList.add('hidden');
      return;
    }
    modal.classList.remove('hidden');

    document.getElementById('modal-kicker').textContent =
      `ROTARY PRESS REPORT // EDITION #${sum.edition}`;
    document.getElementById('modal-title').textContent =
      `EXTRA! EXTRA! EDITION #${sum.edition} HITS THE STREETS`;
    document.getElementById('modal-subtitle').textContent =
      `Plated ${sum.slottedCount}/4 front-page columns. Managing Editor Lou Vance reviews the morning street sales:`;

    document.getElementById('modal-metrics').innerHTML = `
      <div class="modal-metric-box">
        <span>CIRCULATION SHIFT</span>
        <strong class="accent-gold">${sum.circDelta >= 0 ? '+' : ''}${sum.circDelta.toLocaleString()} (${sum.totalCirculation.toLocaleString()})</strong>
      </div>
      <div class="modal-metric-box">
        <span>STREET &amp; AD REVENUE</span>
        <strong class="accent-emerald">+$${sum.cashDelta} ($${sum.totalFunds})</strong>
      </div>
      <div class="modal-metric-box">
        <span>CREDIBILITY RATING</span>
        <strong class="accent-cyan">${sum.credibility}% (${sum.credDelta >= 0 ? '+' : ''}${sum.credDelta}%)</strong>
      </div>
      <div class="modal-metric-box">
        <span>SYNDICATE MOB HEAT</span>
        <strong class="accent-crimson">${sum.heat}%</strong>
      </div>
    `;
  }

  _syncFullUI() {
    this._syncTopBar();
    this._syncSpeedButtons();
    this._renderOperativesRoster();
    this._renderLeadsList();
    this._renderScoopTrayAndWire();
    this._renderBroadsheetAndPress();
    this._renderModal();

    const quoteIdx =
      (this.sim.edition - 1 + this.sim.scoopsTotal) % EDITOR_QUOTES.length;
    document.getElementById('editor-directive').textContent =
      EDITOR_QUOTES[quoteIdx];
  }

  _loop(now) {
    const rawDt = Math.max(0.001, Math.min(0.05, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    const dt = rawDt * (this.sim.speed || 1);

    this.sim.step(dt);
    this.renderer.render(this.sim, rawDt);

    this.uiTickAccum += rawDt;
    if (this.uiTickAccum >= 0.25) {
      this.uiTickAccum = 0;
      this._syncTopBar();
      this._renderOperativesRoster();
      this._renderLeadsList();
      this._renderScoopTrayAndWire();
      this._renderBroadsheetAndPress();
      this._renderModal();
    }

    requestAnimationFrame((t) => this._loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.lateEditionApp = new LateEditionApp();
});

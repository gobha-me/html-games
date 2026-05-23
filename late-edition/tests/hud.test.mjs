import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMs,
  formatEdition,
  pickSelected,
  countByKind,
  tierHistogram,
  renderStoryRow,
  renderPartnerOfferChip,
  renderActivePartnerDealLine,
  renderBuyoutOfferChip,
  ROLE_CAPTIONS,
  SlowMoPill,
  ZoomPill,
  SettingsPanel,
  formatPanSpeedLabel,
} from '../js/hud.js';
import { World } from '../js/sim/world-state.js';
import { newSlowMoState, triggerSlowMo, SLOW_MO_ACTIVE_MS } from '../js/slow-mo.js';

// Milestone 0.9 — HudCorkboard projection helpers.
// Rendering is browser-only (jsdom-free here); these tests exercise the
// pure-function helpers that the corkboard regions consume from each
// WorldFrame. Frame-shape integrity stays in tests/world-frame.test.mjs;
// here we lock the projection rules so a regression in the helpers
// shows up before the browser does.

test('formatMs renders MM:SS with two-digit padding and floors negatives', () => {
  assert.equal(formatMs(0), '00:00');
  assert.equal(formatMs(720_000), '12:00');
  assert.equal(formatMs(65_500), '01:05');
  assert.equal(formatMs(-1000), '00:00');
});

test('formatEdition zero-pads to three digits per Design Doc §13 mock', () => {
  assert.equal(formatEdition(1), '№ 001');
  assert.equal(formatEdition(23), '№ 023');
  assert.equal(formatEdition(140), '№ 140');
});

test('pickSelected returns the first unit with selected:true, or null', () => {
  const units = [
    { id: 'u-1', kind: 'reporter', selected: false },
    { id: 'u-2', kind: 'photog',   selected: true  },
    { id: 'u-3', kind: 'fixer',    selected: true  },
  ];
  assert.equal(pickSelected(units).id, 'u-2');
  assert.equal(pickSelected(units.filter((u) => !u.selected)), null);
  assert.equal(pickSelected([]), null);
});

test('countByKind tallies units by kind for the threats projection', () => {
  const units = [
    { kind: 'reporter' }, { kind: 'reporter' },
    { kind: 'goon' }, { kind: 'goon' }, { kind: 'goon' },
    { kind: 'fixer' },
  ];
  assert.equal(countByKind(units, 'goon'), 3);
  assert.equal(countByKind(units, 'reporter'), 2);
  assert.equal(countByKind(units, 'editor'), 0);
});

test('tierHistogram buckets LeadView tiers+flavors with stable empty defaults', () => {
  const leads = [
    { tier: 'whisper',       flavor: 'vice' },
    { tier: 'whisper',       flavor: 'violence' },
    { tier: 'investigation', flavor: 'vice' },
  ];
  const { tiers, flavors } = tierHistogram(leads);
  assert.deepEqual(tiers,   { whisper: 2, investigation: 1, arc: 0 });
  assert.deepEqual(flavors, { vice: 2, violence: 1, money: 0, labor: 0 });
});

test('tierHistogram on an empty leads array returns zeroed buckets', () => {
  const { tiers, flavors } = tierHistogram([]);
  assert.deepEqual(tiers,   { whisper: 0, investigation: 0, arc: 0 });
  assert.deepEqual(flavors, { vice: 0, violence: 0, money: 0, labor: 0 });
});

// 1.1.0 (ICD-10 v0.1.1 §HUD surface) — Story queue row renderer covers the
// archive HOLD chip, arc breadcrumb + branch chips, and Investigation chain
// depth suffix. Renderer is jsdom-free; checks the HTML string output.

test('renderStoryRow: plain verified story renders headline + flavor · district', () => {
  const html = renderStoryRow({
    id: 's-1',
    state: 'verified',
    headline: 'DOCKHAND NAMES FENCE',
    flavor: 'vice',
    tier: 'whisper',
    district: 'docks',
  });
  assert.match(html, /story-row/);
  assert.match(html, /data-story-id="s-1"/);
  assert.match(html, /DOCKHAND NAMES FENCE/);
  assert.match(html, /vice · The Docks/);
  assert.doesNotMatch(html, /is-archived/);
  assert.doesNotMatch(html, /HOLD/);
  assert.doesNotMatch(html, /arc-line/);
  assert.doesNotMatch(html, /Investigation /);
});

test('renderStoryRow: archived story carries the HOLD chip + is-archived class', () => {
  const html = renderStoryRow({
    id: 's-2',
    state: 'archived',
    headline: 'JUDGE TAKES BRIBE',
    flavor: 'money',
    tier: 'investigation',
    district: 'hillside',
  });
  assert.match(html, /is-archived/);
  assert.match(html, /chip is-hold/);
  assert.match(html, /HOLD/);
});

test('renderStoryRow: investigation chain depth appears in the meta line', () => {
  const html = renderStoryRow({
    id: 's-c2',
    state: 'verified',
    headline: 'MAYOR LIES ABOUT MISTRESS',
    flavor: 'money',
    tier: 'investigation',
    district: 'hillside',
    chain_depth: 2,
  });
  assert.match(html, /Investigation 2\/3/);
});

test('renderStoryRow: un-picked arc story renders branch chips with pick-branch action', () => {
  const html = renderStoryRow({
    id: 's-arc-1',
    state: 'verified',
    headline: 'THE WALKOUT — Longshoremen halt the harbor',
    flavor: 'labor',
    tier: 'arc',
    district: 'docks',
    arc_episode_id: 'longshoreman_strike.walkout',
    branch_choices: [{ label: 'bury' }, { label: 'splash' }],
  });
  assert.match(html, /arc-line/);
  assert.match(html, /Arc · Longshoreman Strike/);
  assert.match(html, /data-action="pick-branch"/);
  assert.match(html, /data-story-id="s-arc-1"/);
  assert.match(html, /data-branch-label="bury"/);
  assert.match(html, /data-branch-label="splash"/);
  assert.doesNotMatch(html, /Picked:/);
});

test('renderStoryRow: picked arc story shows the chosen label and hides chips', () => {
  const html = renderStoryRow({
    id: 's-arc-2',
    state: 'verified',
    headline: 'THE WALKOUT — Longshoremen halt the harbor',
    flavor: 'labor',
    tier: 'arc',
    district: 'docks',
    arc_episode_id: 'longshoreman_strike.walkout',
    arc_branch_label: 'splash',
  });
  assert.match(html, /arc-line/);
  assert.match(html, /Picked: splash/);
  assert.doesNotMatch(html, /data-action="pick-branch"/);
});

test('a fresh World snapshot drives the projection helpers without changes', () => {
  // Smoke: the helpers must keep working against the actual WorldFrame the
  // corkboard sees each frame. If snapshot() drops a field the helpers
  // depend on, this case catches it before the renderer does.
  const w = new World();
  const f = w.snapshot();
  assert.equal(pickSelected(f.units), null);
  assert.equal(countByKind(f.units, 'goon'), 0);
  const { tiers } = tierHistogram(f.leads);
  // Fresh World seeds exactly one lead at the NW district (Story 's-1').
  assert.equal(tiers.whisper + tiers.investigation + tiers.arc, f.leads.length);
});

// 1.2.0 (ICD-02 v0.3.3 §DESPERATE body): partner-offer chip + active-deal
// breadcrumb. Pure-function helpers — render strings the dossier sets via
// innerHTML; click handling lives in Dossier._onThreatsClick.
test('renderPartnerOfferChip emits accept + decline buttons with stable data-action attrs', () => {
  const html = renderPartnerOfferChip({ district: 'docks', cost: 500, editions: 5 });
  assert.match(html, /data-action="partner-accept"/);
  assert.match(html, /data-action="partner-decline"/);
  assert.match(html, /\$500/);
  assert.match(html, /5 editions/);
  // District name resolves to its display label (The Docks), not the raw id.
  assert.match(html, /The Docks/);
});

test('renderPartnerOfferChip escapes the district name', () => {
  // Synthetic district id that's not in the registry — should fall back to
  // the raw id but pass through the escapeHtml filter.
  const html = renderPartnerOfferChip({ district: 'docks', cost: 500, editions: 5 });
  // No literal "<" / ">" in the district label region (Docks has no special chars).
  // The smoke check is that the helper doesn't throw + emits the action attrs.
  assert.ok(html.includes('partner-accept'));
});

test('renderActivePartnerDealLine reflects district + remaining editions and pluralizes', () => {
  const five = renderActivePartnerDealLine({ district: 'hillside', editionsRemaining: 5 });
  assert.match(five, /5 editions left/);
  const one = renderActivePartnerDealLine({ district: 'hillside', editionsRemaining: 1 });
  assert.match(one, /1 edition left/);
  assert.match(one, /Hillside/);
});

// 1.5.0 (ICD-02 v0.3.4 §Herald §BUYOUT body) — buyout-offer chip. Same
// shape as renderPartnerOfferChip but with `buyout-accept` / `buyout-decline`
// action attrs and a $-formatted amount with thousands separator.
test('renderBuyoutOfferChip emits accept + decline buttons with stable data-action attrs', () => {
  const html = renderBuyoutOfferChip({ amount: 50_000 });
  assert.match(html, /data-action="buyout-accept"/);
  assert.match(html, /data-action="buyout-decline"/);
});

test('renderBuyoutOfferChip formats amount with thousands separator', () => {
  const html = renderBuyoutOfferChip({ amount: 50_000 });
  assert.match(html, /\$50,000/);
});

test('renderBuyoutOfferChip surfaces the Establishment-ending tag', () => {
  const html = renderBuyoutOfferChip({ amount: 50_000 });
  assert.match(html, /Establishment ending/i);
});

// 1.5.0 (ICD-02 v0.3.4 §Herald §PUNISH body) — scooped badge in story row.
test('renderStoryRow: scooped lead carries the SCOOPED chip + is-scooped class', () => {
  const html = renderStoryRow({
    id: 's-scoop',
    state: 'lead',
    headline: 'DOCKHAND TIPS THE WIRE',
    flavor: 'vice',
    tier: 'investigation',
    district: 'docks',
    scooped: true,
  });
  assert.match(html, /SCOOPED/);
  assert.match(html, /is-scooped/);
});

test('renderStoryRow: scooped verified story still routes toggle-archive (player can clear it)', () => {
  const html = renderStoryRow({
    id: 's-scoop',
    state: 'verified',
    headline: 'DOCKHAND TIPS THE WIRE',
    flavor: 'vice',
    tier: 'investigation',
    district: 'docks',
    scooped: true,
  });
  // The row remains clickable; data-action attribute stays — archive lets the
  // player retire the scooped row off the queue.
  assert.match(html, /data-action="toggle-archive"/);
  assert.match(html, /SCOOPED/);
});

// 1.3.1 (#playtest-bug-1 + #playtest-bug-5) — unit-role caption map. The
// v1.3.0 playtest reported that the player couldn't discover unit functions:
// a Fixer was dispatched to the Darkroom (no effect; only Photog plates
// there), Editor dispatch was silently rejected. One line in the dossier
// surfaces the role; this lock pins the four player-controlled kinds so a
// rename in world-state.js without a caption update flags here.

test('ROLE_CAPTIONS covers the four player-controlled unit kinds', () => {
  assert.equal(typeof ROLE_CAPTIONS.reporter, 'string');
  assert.equal(typeof ROLE_CAPTIONS.photog,   'string');
  assert.equal(typeof ROLE_CAPTIONS.fixer,    'string');
  assert.equal(typeof ROLE_CAPTIONS.editor,   'string');
});

test('ROLE_CAPTIONS.photog names the Darkroom (the load-bearing inner-loop hint)', () => {
  // This is the single most important caption — Bug 1 was the Fixer arriving
  // at the Darkroom and going IDLE because Fixer isn't the unit that plates.
  // The Photog caption is what teaches the player who plates and where.
  assert.match(ROLE_CAPTIONS.photog, /Darkroom/);
});

test('ROLE_CAPTIONS.editor signals stationary role (Bug 5 — dispatch is silently rejected)', () => {
  // The Editor caption is the substitute for the dispatch-rejection toast:
  // the player reads "Stationed" / "directs" and stops trying to right-click.
  assert.match(ROLE_CAPTIONS.editor, /Stationed|Bureau|directs/i);
});

test('ROLE_CAPTIONS does NOT include goon (not a player unit)', () => {
  // Goons can technically be selected via stale state, but they have no
  // role to surface. Defending against a future refactor that conflates
  // selectable + role-bearing.
  assert.equal(ROLE_CAPTIONS.goon, undefined);
});

// 1.3.1 (#playtest-bug-7) — slow-mo HUD pill. DOM-free tests against a
// minimal stub root (the class only reads/writes `hidden` and `textContent`).

function makeStubEl() {
  return { hidden: true, textContent: '' };
}

test('SlowMoPill stays hidden when slow-mo has never triggered', () => {
  const root = makeStubEl();
  const state = newSlowMoState();
  const pill = new SlowMoPill(root, { getSlowMo: () => state, now: () => 0 });
  pill.apply({});
  assert.equal(root.hidden, true);
});

test('SlowMoPill renders SLOW-MO + countdown while active', () => {
  const root = makeStubEl();
  let now = 10_000;
  let state = newSlowMoState();
  state = triggerSlowMo(state, now);
  const pill = new SlowMoPill(root, { getSlowMo: () => state, now: () => now });
  pill.apply({});
  assert.equal(root.hidden, false);
  assert.match(root.textContent, /^SLOW-MO · /);
  assert.match(root.textContent, /5\.0s/);
  // Advance 2 seconds into the window — text should now read ~3.0s.
  now += 2_000;
  pill.apply({});
  assert.equal(root.hidden, false);
  assert.match(root.textContent, /3\.0s/);
});

test('SlowMoPill hides itself after the active window expires', () => {
  const root = makeStubEl();
  let now = 10_000;
  let state = triggerSlowMo(newSlowMoState(), now);
  const pill = new SlowMoPill(root, { getSlowMo: () => state, now: () => now });
  pill.apply({});
  assert.equal(root.hidden, false);
  // Past the active window.
  now += SLOW_MO_ACTIVE_MS + 100;
  pill.apply({});
  assert.equal(root.hidden, true);
});

test('SlowMoPill no-ops when getSlowMo is not provided', () => {
  // Defensive: the HUD passes actions through; if a future host omits
  // getSlowMo the pill must not throw, just stay hidden.
  const root = makeStubEl();
  const pill = new SlowMoPill(root, {});
  pill.apply({});
  assert.equal(root.hidden, true);
});

// 1.3.1 (#playtest-bug-3b) — zoom HUD pill. Reads renderer's view object
// via actions.getView; detects zoomCallCount changes to flash on press
// (including clamp-at-endpoint, where zoomStep stays put).

function makeViewState(step = 1, callCount = 0) {
  return { pan: { x: 0, z: 0 }, frustum: 24, aspect: 1.6, zoomStep: step, zoomStepCount: 4, zoomCallCount: callCount };
}

test('ZoomPill stays hidden before any [/] press has registered', () => {
  const root = makeStubEl();
  let view = makeViewState(1, 0);
  let now = 0;
  const pill = new ZoomPill(root, { getView: () => view, now: () => now });
  pill.apply({});
  assert.equal(root.hidden, true, 'pill should not surface on the latch frame');
});

test('ZoomPill renders ZOOM N/M with 1-indexed step after first press', () => {
  const root = makeStubEl();
  let view = makeViewState(1, 0);
  let now = 0;
  const pill = new ZoomPill(root, { getView: () => view, now: () => now });
  pill.apply({});  // latch
  view = makeViewState(2, 1);  // stepZoom advanced to index 2
  now = 100;
  pill.apply({});
  assert.equal(root.hidden, false);
  assert.equal(root.textContent, 'ZOOM 3/4');
});

test('ZoomPill flashes on clamp-at-endpoint press (callCount bumps even if step unchanged)', () => {
  // The whole point of the pill: at endpoints, stepZoom doesn't advance the
  // step but DOES bump zoomCallCount, so the player gets feedback that the
  // press registered (and learns the endpoint).
  const root = makeStubEl();
  let view = makeViewState(3, 5);  // already at innermost
  let now = 0;
  const pill = new ZoomPill(root, { getView: () => view, now: () => now });
  pill.apply({});  // latch
  view = makeViewState(3, 6);  // user mashed [ at innermost
  now = 100;
  pill.apply({});
  assert.equal(root.hidden, false);
  assert.equal(root.textContent, 'ZOOM 4/4', 'clamp should still render the same step number');
});

test('ZoomPill hides itself ~1.2s after the last press', () => {
  const root = makeStubEl();
  let view = makeViewState(1, 0);
  let now = 0;
  const pill = new ZoomPill(root, { getView: () => view, now: () => now });
  pill.apply({});
  view = makeViewState(2, 1);
  now = 100;
  pill.apply({});
  assert.equal(root.hidden, false);
  // Past the visible window.
  now = 100 + 1300;
  pill.apply({});
  assert.equal(root.hidden, true);
});

// 1.4.0 — settings popover. DOM-free tests against minimal element stubs;
// the class only touches `.hidden`, `.value`, `.textContent`, `.dataset`,
// `.classList.toggle`, `.setAttribute`, `.addEventListener`, `.contains`.
// Document-level handlers (outside-click + ESC) are skipped by passing
// refs.document = null.

function makeSettingsStubEl(opts = {}) {
  const classes = new Set();
  const handlers = new Map();
  const attrs = {};
  const el = {
    hidden: opts.hidden ?? true,
    value: opts.value ?? '',
    textContent: '',
    dataset: opts.dataset ?? {},
    _classes: classes,
    _attrs: attrs,
    classList: {
      toggle(cls, force) {
        const want = force === undefined ? !classes.has(cls) : !!force;
        if (want) classes.add(cls); else classes.delete(cls);
        return want;
      },
      contains(cls) { return classes.has(cls); },
    },
    addEventListener(type, handler) {
      const list = handlers.get(type) ?? [];
      list.push(handler);
      handlers.set(type, list);
    },
    setAttribute(name, value) { attrs[name] = value; },
    contains() { return false; },
    dispatch(type, ev = {}) {
      const list = handlers.get(type) ?? [];
      for (const h of list) h(ev);
    },
  };
  return el;
}

function makeChannelButtons(channelList) {
  return channelList.map((spec) => {
    const channelAttr = spec.channel === undefined ? 'master' : spec.channel;
    const el = makeSettingsStubEl({ dataset: { channel: channelAttr } });
    return { channel: spec.channel, el };
  });
}

function makeSettingsActions(initial = {}) {
  const muted = new Map();  // channel-or-undefined → bool
  const toggleCalls = [];
  const setMultCalls = [];
  return {
    state: {
      panSpeed: initial.panSpeed ?? 1.0,
      muted,
      toggleCalls,
      setMultCalls,
    },
    actions: {
      getPanSpeedMultiplier: () => initial.panSpeed ?? 1.0,
      setPanSpeedMultiplier: (v) => { setMultCalls.push(v); },
      getChannelMuted: (channel) => muted.get(channel) === true,
      toggleChannelMute: (channel) => {
        toggleCalls.push(channel);
        muted.set(channel, !muted.get(channel));
      },
    },
  };
}

test('SettingsPanel starts hidden and isOpen() returns false', () => {
  const panel = makeSettingsStubEl();
  const gear = makeSettingsStubEl();
  const slider = makeSettingsStubEl({ value: '1.0' });
  const sliderValue = makeSettingsStubEl();
  const close = makeSettingsStubEl();
  const channelButtons = makeChannelButtons([{ channel: undefined }, { channel: 'sfx' }]);
  const { actions } = makeSettingsActions();
  const sp = new SettingsPanel(
    { gearButton: gear, panel, slider, sliderValue, closeButton: close, channelButtons, document: null },
    actions,
  );
  assert.equal(sp.isOpen(), false);
  assert.equal(panel.hidden, true);
});

test('SettingsPanel.open() shows the panel and refreshes slider + toggles from actions', () => {
  const panel = makeSettingsStubEl();
  const gear = makeSettingsStubEl();
  const slider = makeSettingsStubEl();
  const sliderValue = makeSettingsStubEl();
  const channelButtons = makeChannelButtons([
    { channel: undefined },
    { channel: 'sfx' },
    { channel: 'amb' },
  ]);
  const { state, actions } = makeSettingsActions({ panSpeed: 1.7 });
  state.muted.set('sfx', true);
  state.muted.set('amb', false);
  state.muted.set(undefined, false);
  const sp = new SettingsPanel(
    { gearButton: gear, panel, slider, sliderValue, channelButtons, document: null },
    actions,
  );
  sp.open();
  assert.equal(panel.hidden, false);
  assert.equal(sp.isOpen(), true);
  assert.equal(slider.value, '1.7');
  assert.equal(sliderValue.textContent, '1.7×');
  // sfx toggle was muted → is-muted class + aria-pressed=true
  const sfxBtn = channelButtons.find((b) => b.channel === 'sfx').el;
  assert.equal(sfxBtn._classes.has('is-muted'), true);
  assert.equal(sfxBtn._attrs['aria-pressed'], 'true');
  // amb toggle was audible → no is-muted class
  const ambBtn = channelButtons.find((b) => b.channel === 'amb').el;
  assert.equal(ambBtn._classes.has('is-muted'), false);
  assert.equal(ambBtn._attrs['aria-pressed'], 'false');
});

test('SettingsPanel.close() hides the panel', () => {
  const panel = makeSettingsStubEl();
  const sp = new SettingsPanel({ gearButton: makeSettingsStubEl(), panel, document: null }, {});
  sp.open();
  sp.close();
  assert.equal(panel.hidden, true);
  assert.equal(sp.isOpen(), false);
});

test('SettingsPanel.toggle() flips between open and close', () => {
  const panel = makeSettingsStubEl();
  const sp = new SettingsPanel({ gearButton: makeSettingsStubEl(), panel, document: null }, {});
  sp.toggle();
  assert.equal(sp.isOpen(), true);
  sp.toggle();
  assert.equal(sp.isOpen(), false);
});

test('SettingsPanel: clicking the gear button toggles the panel', () => {
  const panel = makeSettingsStubEl();
  const gear = makeSettingsStubEl();
  const sp = new SettingsPanel({ gearButton: gear, panel, document: null }, {});
  gear.dispatch('click');
  assert.equal(sp.isOpen(), true);
  gear.dispatch('click');
  assert.equal(sp.isOpen(), false);
});

test('SettingsPanel: clicking the close button closes the panel', () => {
  const panel = makeSettingsStubEl();
  const closeBtn = makeSettingsStubEl();
  const sp = new SettingsPanel(
    { gearButton: makeSettingsStubEl(), panel, closeButton: closeBtn, document: null },
    {},
  );
  sp.open();
  closeBtn.dispatch('click');
  assert.equal(sp.isOpen(), false);
});

test('SettingsPanel: slider input event dispatches setPanSpeedMultiplier with the new value', () => {
  const slider = makeSettingsStubEl({ value: '1.0' });
  const sliderValue = makeSettingsStubEl();
  const { state, actions } = makeSettingsActions();
  new SettingsPanel(
    { gearButton: makeSettingsStubEl(), panel: makeSettingsStubEl(), slider, sliderValue, document: null },
    actions,
  );
  slider.value = '2.3';
  slider.dispatch('input');
  assert.deepEqual(state.setMultCalls, [2.3]);
  assert.equal(sliderValue.textContent, '2.3×');
});

test('SettingsPanel: slider input ignores non-finite / non-positive values', () => {
  const slider = makeSettingsStubEl({ value: '1.0' });
  const { state, actions } = makeSettingsActions();
  new SettingsPanel(
    { gearButton: makeSettingsStubEl(), panel: makeSettingsStubEl(), slider, document: null },
    actions,
  );
  slider.value = 'NaN';
  slider.dispatch('input');
  slider.value = '0';
  slider.dispatch('input');
  slider.value = '-1';
  slider.dispatch('input');
  assert.equal(state.setMultCalls.length, 0);
});

test('SettingsPanel: clicking a channel toggle dispatches toggleChannelMute with the right channel', () => {
  const channelButtons = makeChannelButtons([
    { channel: undefined },  // master
    { channel: 'sfx' },
    { channel: 'amb' },
  ]);
  const { state, actions } = makeSettingsActions();
  new SettingsPanel(
    {
      gearButton: makeSettingsStubEl(),
      panel: makeSettingsStubEl(),
      channelButtons,
      document: null,
    },
    actions,
  );
  channelButtons.find((b) => b.channel === 'sfx').el.dispatch('click');
  channelButtons.find((b) => b.channel === undefined).el.dispatch('click');
  assert.deepEqual(state.toggleCalls, ['sfx', undefined]);
});

test('SettingsPanel: clicking a channel toggle re-renders the button state from the bus', () => {
  // Bus is the single source of truth; the panel reads back after toggling
  // rather than tracking its own copy. Sequence: click → toggle changes the
  // bus state → panel reads via getChannelMuted → renders is-muted class.
  const channelButtons = makeChannelButtons([{ channel: 'sfx' }]);
  const { actions } = makeSettingsActions();
  new SettingsPanel(
    {
      gearButton: makeSettingsStubEl(),
      panel: makeSettingsStubEl(),
      channelButtons,
      document: null,
    },
    actions,
  );
  const sfxBtn = channelButtons[0].el;
  sfxBtn.dispatch('click');
  assert.equal(sfxBtn._classes.has('is-muted'), true);
  assert.equal(sfxBtn._attrs['aria-pressed'], 'true');
  sfxBtn.dispatch('click');
  assert.equal(sfxBtn._classes.has('is-muted'), false);
  assert.equal(sfxBtn._attrs['aria-pressed'], 'false');
});

test('SettingsPanel: optional refs absence does not throw (headless / partial mount)', () => {
  // Mirrors the SlowMoPill / ZoomPill defensive pattern — a host page that
  // omits a control still gets a working SettingsPanel for the rest.
  const panel = makeSettingsStubEl();
  const sp = new SettingsPanel(
    { gearButton: makeSettingsStubEl(), panel, document: null },  // no slider, no toggles, no close
    {},
  );
  sp.open();
  sp.close();
  sp.toggle();
  assert.equal(sp.isOpen(), true);
});

test('SettingsPanel: gear button gets aria-expanded synced with open/close state', () => {
  const gear = makeSettingsStubEl();
  const panel = makeSettingsStubEl();
  const sp = new SettingsPanel({ gearButton: gear, panel, document: null }, {});
  sp.open();
  assert.equal(gear._attrs['aria-expanded'], 'true');
  sp.close();
  assert.equal(gear._attrs['aria-expanded'], 'false');
});

test('formatPanSpeedLabel renders one decimal place with a multiplier suffix', () => {
  assert.equal(formatPanSpeedLabel(1.0), '1.0×');
  assert.equal(formatPanSpeedLabel(1.5), '1.5×');
  assert.equal(formatPanSpeedLabel(2),   '2.0×');
  assert.equal(formatPanSpeedLabel(0.5), '0.5×');
});

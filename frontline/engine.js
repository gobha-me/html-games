// Unified Frontline / Hexwire / Rift Rules Engine (globalThis.FL)
// Dynamically switches card pool, terminology, positional ranged vs. strike overwatch,
// and Subvert/Possession unit-stacking based on the active card style ('frontline' | 'hexwire' | 'rift').
(function (G) {
  const U_FL = (id, name, cost, pow, rng, hp, flanks, kw) => ({
    id, name, cost, type: 'unit', pow, rng, hp, flanks, kw: kw || {}, f: 'trench', styleOrigin: 'frontline'
  });
  const S_FL = (id, name, cost, spell) => ({
    id, name, cost, type: 'spell', spell, f: 'trench', styleOrigin: 'frontline'
  });

  const U_HW = (id, name, cost, pow, hp, flanks, kw, f) => ({
    id, name, cost, type: 'unit', pow, rng: (kw && kw.strike) || 0, hp, flanks, kw: kw || {}, f: f || 'street', styleOrigin: 'hexwire'
  });
  const S_HW = (id, name, cost, spell, f) => ({
    id, name, cost, type: 'spell', spell, f: f || 'hex', styleOrigin: 'hexwire'
  });

  const POOL_FRONTLINE = [
    U_FL('scout', 'Recon Runner', 1, 1, 0, 2, [0, 1], {}),
    U_FL('skirm', 'Trench Raider', 1, 2, 0, 1, [0, 0], { haste: 1 }),
    U_FL('picket', 'Sandbag Line', 1, 0, 0, 3, [0, 0], { guard: 1 }),
    U_FL('foot', 'Rifleman', 2, 2, 0, 3, [1, 1], {}),
    U_FL('archer', 'Mortar Team', 2, 1, 2, 2, [0, 0], {}),
    U_FL('shieldb', 'Barricade Crew', 2, 1, 0, 4, [0, 0], { guard: 1 }),
    U_FL('duel', 'Shock Trooper', 2, 3, 0, 2, [0, 0], {}),
    U_FL('adder', 'Gas Grenadier', 2, 1, 0, 1, [0, 0], { venom: 1 }),
    U_FL('banner', 'Signal Officer', 3, 1, 0, 3, [2, 2], { rally: 1 }),
    U_FL('vet', 'Line Sergeant', 3, 3, 0, 4, [1, 1], {}),
    U_FL('cross', 'Field Gun', 3, 1, 3, 4, [0, 0], {}),
    U_FL('warden', 'Bunker Guard', 3, 2, 0, 3, [0, 0], { guard: 1, shield: 1 }),
    U_FL('champ', 'Armored Car', 4, 4, 0, 5, [1, 1], {}),
    U_FL('lancer', 'Breacher Tank', 4, 4, 0, 3, [0, 0], { pierce: 1 }),
    U_FL('marks', 'Howitzer', 4, 2, 4, 4, [0, 0], {}),
    U_FL('outrider', 'Dispatch Rider', 4, 3, 0, 3, [0, 1], { haste: 1 }),
    U_FL('van', 'Land Dreadnought', 5, 5, 0, 6, [1, 1], {}),
    U_FL('ballista', 'Rail Cannon', 5, 1, 6, 5, [0, 0], {}),
    U_FL('warlord', 'Field Marshal', 5, 3, 0, 5, [1, 1], { rally: 2 }),
    S_FL('bolt', 'Artillery Strike', 2, { kind: 'bolt', dmg: 3 }),
    S_FL('volley', 'Creeping Barrage', 4, { kind: 'volley', dmg: 1 }),
    S_FL('reinf', 'Fortify', 1, { kind: 'reinforce', pow: 1, hp: 2 }),
    S_FL('insight', 'Intel Report', 2, { kind: 'insight', draw: 2 }),
    S_FL('redeploy', 'Forced March', 1, { kind: 'redeploy' }),
  ];

  const POOL_HEXWIRE = [
    U_HW('scout', 'Lookout', 1, 1, 2, [0, 1], {}, 'street'),
    U_HW('skirm', 'Ripper', 1, 2, 1, [0, 0], { haste: 1 }, 'chrome'),
    U_HW('picket', 'Bouncer', 1, 0, 3, [0, 0], { guard: 1 }, 'street'),
    U_HW('foot', 'Ganger', 2, 2, 3, [1, 1], {}, 'street'),
    U_HW('archer', 'Watch Drone', 2, 1, 2, [0, 0], { strike: 2 }, 'chrome'),
    U_HW('shieldb', 'Riot Shield', 2, 1, 4, [0, 0], { guard: 1 }, 'street'),
    U_HW('duel', 'Switchblade', 2, 3, 2, [0, 0], {}, 'street'),
    U_HW('adder', 'Curseblade', 2, 1, 1, [0, 0], { venom: 1 }, 'hex'),
    U_HW('banner', 'Fixer', 3, 1, 3, [2, 2], { rally: 1 }, 'street'),
    U_HW('vet', 'Merc', 3, 3, 4, [1, 1], {}, 'street'),
    U_HW('cross', 'Gun Drone', 3, 1, 4, [0, 0], { strike: 3 }, 'chrome'),
    U_HW('warden', 'Wardkeeper', 3, 2, 3, [0, 0], { guard: 1, shield: 1 }, 'hex'),
    U_HW('champ', 'Enforcer', 4, 4, 5, [1, 1], {}, 'street'),
    U_HW('lancer', 'Breacher', 4, 4, 3, [0, 0], { pierce: 1 }, 'chrome'),
    U_HW('marks', 'Sniper', 4, 2, 4, [0, 0], { strike: 4 }, 'chrome'),
    U_HW('outrider', 'Chromed Rider', 4, 3, 3, [0, 1], { haste: 1 }, 'chrome'),
    U_HW('van', 'Bound Golem', 5, 5, 6, [1, 1], {}, 'hex'),
    U_HW('ballista', 'Railgun', 5, 1, 5, [0, 0], { strike: 6 }, 'chrome'),
    U_HW('warlord', 'Kingpin', 5, 3, 5, [1, 1], { rally: 2 }, 'street'),
    U_HW('puppet', 'Puppeteer', 6, 1, 4, [0, 0], { subvert: 2 }, 'hex'),
    S_HW('bolt', 'Hexbolt', 2, { kind: 'bolt', dmg: 3 }, 'hex'),
    S_HW('volley', 'Grid Surge', 4, { kind: 'volley', dmg: 1 }, 'chrome'),
    S_HW('reinf', 'Combat Stims', 1, { kind: 'reinforce', pow: 1, hp: 2 }, 'chrome'),
    S_HW('insight', 'Datamine', 2, { kind: 'insight', draw: 2 }, 'chrome'),
    S_HW('redeploy', 'Blinkstep', 1, { kind: 'redeploy' }, 'hex'),
    S_HW('possess', 'Possession', 5, { kind: 'possess', cap: 2 }, 'hex'),
  ];

  // Rift mode merges Frontline dual-power M/R positional stats with Hexwire's Subvert/Possession cards
  const POOL_RIFT = [
    ...POOL_FRONTLINE.map(c => ({ ...c, kw: c.kw ? { ...c.kw, ...(c.rng ? { strike: c.rng } : {}) } : {} })),
    U_HW('puppet', 'Rift Puppeteer', 6, 1, 4, [0, 0], { subvert: 2 }, 'hex'),
    S_HW('possess', 'Rift Possession', 5, { kind: 'possess', cap: 2 }, 'hex'),
  ];

  const POOLS = {
    frontline: POOL_FRONTLINE,
    hexwire: POOL_HEXWIRE,
    rift: POOL_RIFT,
  };

  let activeStyle = 'frontline';

  function setStyle(style) {
    if (POOLS[style]) {
      activeStyle = style;
      G.FL.POOL = POOLS[style];
      G.FL.style = style;
    }
    return G.FL.POOL;
  }

  function getPool(g) {
    const st = (g && g.style) || activeStyle;
    return POOLS[st] || POOL_FRONTLINE;
  }

  const byId = (id, g) => getPool(g).find(c => c.id === id) || POOL_HEXWIRE.find(c => c.id === id) || POOL_FRONTLINE.find(c => c.id === id);

  const STARTER = ['skirm', 'picket', 'foot', 'archer', 'shieldb', 'vet', 'cross', 'warden', 'champ', 'marks', 'van', 'bolt']
    .flatMap(id => [id, id]); // 24 cards, 2x each

  const CFG = { life: 20, handCap: 8, openHand: 4, bankBig: 4, p1SkipDraw: true, p2Extra: 1, p2EnergyBonus: 0 };

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const other = w => (w === 'p' ? 'o' : 'p');
  let _uid = 1;

  function mkPlayer(ids) {
    return { life: CFG.life, deck: shuffle(ids.slice()), hand: [], income: 0, energy: 0, banked: false, fatigue: 0 };
  }
  const emptyB = () => [[null, null], [null, null], [null, null]];

  function ev(g, e) { g.events.push(e); }
  function log(g, msg) { g.log.unshift(msg); if (g.log.length > 30) g.log.length = 30; }

  function isHexStyle(g) {
    const st = (g && g.style) || activeStyle;
    return st === 'hexwire';
  }

  function backRowPower(u, g) {
    if (!u) return 0;
    const st = (g && g.style) || activeStyle;
    if (st === 'hexwire') return (u.kw && u.kw.strike) || 0;
    return u.rng || (u.kw && u.kw.strike) || 0;
  }

  function draw(g, w, n) {
    const pl = g.players[w];
    for (let i = 0; i < n; i++) {
      if (pl.deck.length) {
        if (pl.hand.length < CFG.handCap) pl.hand.push({ uid: _uid++, id: pl.deck.pop() });
        else pl.deck.pop();
      } else {
        pl.fatigue++;
        pl.life -= pl.fatigue;
        ev(g, { t: 'fatigue', w, dmg: pl.fatigue });
        log(g, (w === 'p' ? 'You take' : 'AI takes') + ' ' + pl.fatigue + ' fatigue (empty deck).');
        checkWin(g);
        if (g.over) return;
      }
    }
  }

  function checkWin(g) {
    const pd = g.players.p.life <= 0, od = g.players.o.life <= 0;
    if (pd || od) { g.over = true; g.winner = pd && od ? 'draw' : pd ? 'o' : 'p'; }
  }

  function newGame(dp, dopp, first, styleOverride) {
    const f = first || 'p';
    const st = styleOverride || activeStyle;
    const g = {
      style: st,
      players: { p: mkPlayer(dp), o: mkPlayer(dopp) },
      board: { p: emptyB(), o: emptyB() },
      tc: { p: 0, o: 0 },
      active: f,
      first: f,
      log: [],
      events: [],
      over: false,
      winner: null
    };
    draw(g, 'p', CFG.openHand);
    draw(g, 'o', CFG.openHand);
    beginTurn(g);
    return g;
  }

  function beginTurn(g) {
    const w = g.active, pl = g.players[w];
    g.tc[w]++;
    pl.energy = pl.income;
    pl.banked = false;
    for (const lane of g.board[w]) for (let r = 0; r < 2; r++) if (lane[r]) lane[r].sick = false;
    if (!(g.tc[w] === 1 && w === g.first && CFG.p1SkipDraw)) draw(g, w, 1);
    if (w !== g.first && g.tc[w] === 1) { draw(g, w, CFG.p2Extra); pl.energy += CFG.p2EnergyBonus; }
    const resName = isHexStyle(g) ? 'energy' : 'supply';
    log(g, '— ' + (w === 'p' ? 'Your' : "AI's") + ' turn ' + g.tc[w] + ' · ' + resName + ' ' + pl.energy + ' —');
  }

  // ---- board helpers ----
  function unitsOf(g, w) {
    const out = [];
    for (let l = 0; l < 3; l++) for (let r = 0; r < 2; r++) {
      const u = g.board[w][l][r];
      if (u) out.push(u);
    }
    return out;
  }

  function effPow(g, w, lane, row) {
    const u = g.board[w][lane][row];
    if (!u) return 0;
    let p = u.pow;
    const L = lane > 0 ? g.board[w][lane - 1][row] : null;
    const R = lane < 2 ? g.board[w][lane + 1][row] : null;
    if (L) p += L.flanks[1];
    if (R) p += R.flanks[0];
    return p;
  }

  function laneThreat(g, w, lane) {
    const f = g.board[w][lane][0], b = g.board[w][lane][1];
    return (f ? effPow(g, w, lane, 0) : 0) + (b ? backRowPower(b, g) : 0);
  }

  function pickTarget(g, atkSide, lane) {
    const e = other(atkSide), f = g.board[e][lane][0], b = g.board[e][lane][1];
    if (f && f.kw.guard) return { u: f, row: 0 };
    if (b && b.kw.guard) return { u: b, row: 1 };
    if (f) return { u: f, row: 0 };
    if (b) return { u: b, row: 1 };
    return null;
  }

  function damageUnit(g, side, lane, row, dmg, venom) {
    const u = g.board[side][lane][row];
    if (!u || dmg <= 0) return { blocked: false, died: false, dealt: 0 };
    if (u.shieldUp) {
      u.shieldUp = false;
      ev(g, { t: 'block', side, lane, row });
      return { blocked: true, died: false, dealt: 0 };
    }
    u.hp -= dmg;
    if (venom) u.hp = Math.min(u.hp, 0);
    if (u.hp <= 0) {
      if (u.beneath) {
        g.board[side][lane][row] = u.beneath;
        delete u.beneath;
        ev(g, { t: 'die', side, lane, row, name: u.name });
        ev(g, { t: 'expose', side, lane, row });
        log(g, '☍ ' + u.name + ' destroyed — ' + g.board[side][lane][row].name + ' exposed.');
      } else {
        g.board[side][lane][row] = null;
        ev(g, { t: 'die', side, lane, row, name: u.name });
      }
      return { blocked: false, died: true, dealt: dmg };
    }
    ev(g, { t: 'hit', side, lane, row, dmg });
    return { blocked: false, died: false, dealt: dmg };
  }

  function damageFace(g, side, dmg, src) {
    if (dmg <= 0) return;
    g.players[side].life -= dmg;
    ev(g, { t: 'face', side, dmg });
    log(g, (side === 'p' ? 'You take ' : 'AI takes ') + dmg + ' damage' + (src ? ' (' + src + ')' : '') + '.');
    checkWin(g);
  }

  // ---- actions ----
  function bank(g, w, uid) {
    const pl = g.players[w];
    if (pl.banked || g.over) return false;
    const i = pl.hand.findIndex(c => c.uid === uid);
    if (i < 0) return false;
    const c = byId(pl.hand[i].id, g);
    const gain = c.cost >= CFG.bankBig ? 2 : 1;
    pl.hand.splice(i, 1);
    pl.income += gain;
    pl.energy += gain;
    pl.banked = true;
    const verb = isHexStyle(g) ? (w === 'p' ? 'You fence ' : 'AI fences ') : (w === 'p' ? 'You requisition ' : 'AI requisitions ');
    log(g, verb + c.name + ' for +' + gain + ' income (' + pl.income + ').');
    return true;
  }

  function deploy(g, w, uid, lane, row) {
    const pl = g.players[w];
    if (g.over) return false;
    const i = pl.hand.findIndex(c => c.uid === uid);
    if (i < 0) return false;
    const c = byId(pl.hand[i].id, g);
    if (c.type !== 'unit' || pl.energy < c.cost || g.board[w][lane][row]) return false;
    pl.energy -= c.cost;
    pl.hand.splice(i, 1);
    const u = {
      uid: _uid++,
      id: c.id,
      name: c.name,
      cost: c.cost,
      f: c.f,
      pow: c.pow,
      rng: c.rng || (c.kw && c.kw.strike) || 0,
      hp: c.hp,
      maxhp: c.hp,
      flanks: c.flanks.slice(),
      kw: { ...c.kw },
      shieldUp: !!c.kw.shield,
      sick: !c.kw.haste
    };
    g.board[w][lane][row] = u;
    ev(g, { t: 'deploy', side: w, lane, row });
    const loc = isHexStyle(g)
      ? 'Block ' + (lane + 1) + ' ' + (row ? 'overwatch' : 'street')
      : 'Sector ' + 'ABC'[lane] + ' ' + (row ? 'emplacement' : 'line');
    log(g, (w === 'p' ? 'You deploy ' : 'AI deploys ') + c.name + ' → ' + loc + '.');
    if (c.kw.rally) {
      const adj = [];
      if (lane > 0 && g.board[w][lane - 1][row]) adj.push(g.board[w][lane - 1][row]);
      if (lane < 2 && g.board[w][lane + 1][row]) adj.push(g.board[w][lane + 1][row]);
      if (g.board[w][lane][1 - row]) adj.push(g.board[w][lane][1 - row]);
      adj.forEach(a => { a.pow += c.kw.rally; });
      if (adj.length) log(g, '✚ Rally: +' + c.kw.rally + ' power to ' + adj.length + ' adjacent all' + (adj.length > 1 ? 'ies' : 'y') + '.');
    }
    if (c.kw.subvert) {
      const e = other(w), cap = c.kw.subvert;
      let tRow = -1;
      if (g.board[e][lane][0] && (g.board[e][lane][0].cost || 1) <= cap && !g.board[e][lane][0].beneath) tRow = 0;
      else if (g.board[e][lane][1] && (g.board[e][lane][1].cost || 1) <= cap && !g.board[e][lane][1].beneath) tRow = 1;
      if (tRow >= 0) {
        const cv = g.board[e][lane][tRow];
        g.board[e][lane][tRow] = null;
        cv.beneath = u;
        cv.sick = true;
        g.board[w][lane][row] = cv;
        ev(g, { t: 'subvert', side: w, lane, row });
        log(g, '☍ ' + (w === 'p' ? 'Your ' : 'AI ') + u.name + ' subverts ' + cv.name + ' — it fights for ' + (w === 'p' ? 'you' : 'the AI') + ' until destroyed.');
      }
    }
    return true;
  }

  function castSpell(g, w, uid, target) {
    const pl = g.players[w];
    if (g.over) return false;
    const i = pl.hand.findIndex(c => c.uid === uid);
    if (i < 0) return false;
    const c = byId(pl.hand[i].id, g);
    if (c.type !== 'spell' || pl.energy < c.cost) return false;
    const sp = c.spell;
    const shieldWord = isHexStyle(g) ? 'Ward' : 'Plated';
    if (sp.kind === 'bolt') {
      if (!target || !g.board[target.side][target.lane][target.row]) return false;
      pl.energy -= c.cost;
      pl.hand.splice(i, 1);
      const nm = g.board[target.side][target.lane][target.row].name;
      const r = damageUnit(g, target.side, target.lane, target.row, sp.dmg);
      log(g, (w === 'p' ? 'You strike ' : 'AI strikes ') + nm + (r.blocked ? ' — ' + shieldWord + ' blocks.' : r.died ? ' — destroyed.' : ' for ' + sp.dmg + '.'));
    } else if (sp.kind === 'volley') {
      pl.energy -= c.cost;
      pl.hand.splice(i, 1);
      const e = other(w);
      let kills = 0;
      for (let l = 0; l < 3; l++) for (let r = 0; r < 2; r++) {
        if (g.board[e][l][r]) {
          if (damageUnit(g, e, l, r, sp.dmg).died) kills++;
        }
      }
      log(g, (w === 'p' ? 'You unleash ' : 'AI unleashes ') + c.name + ' — 1 to every enemy unit' + (kills ? ', ' + kills + ' destroyed' : '') + '.');
    } else if (sp.kind === 'reinforce') {
      if (!target) return false;
      const u = g.board[target.side][target.lane][target.row];
      if (!u || target.side !== w) return false;
      pl.energy -= c.cost;
      pl.hand.splice(i, 1);
      u.pow += sp.pow;
      u.hp += sp.hp;
      u.maxhp += sp.hp;
      log(g, (w === 'p' ? 'You buff ' : 'AI buffs ') + u.name + ' (+' + sp.pow + '/+' + sp.hp + ').');
    } else if (sp.kind === 'insight') {
      pl.energy -= c.cost;
      pl.hand.splice(i, 1);
      draw(g, w, sp.draw);
      log(g, (w === 'p' ? 'You draw ' : 'AI draws ') + sp.draw + ' (' + c.name + ').');
    } else if (sp.kind === 'possess') {
      if (!target) return false;
      const e = other(w), u = g.board[e][target.lane][target.row];
      if (!u || (u.cost || 1) > sp.cap || u.beneath || g.board[w][target.toLane][target.toRow]) return false;
      pl.energy -= c.cost;
      pl.hand.splice(i, 1);
      g.board[e][target.lane][target.row] = null;
      u.sick = true;
      u.viaSpell = true;
      g.board[w][target.toLane][target.toRow] = u;
      log(g, '☍ ' + (w === 'p' ? 'You possess ' : 'AI possesses ') + u.name + ' — it switches sides for good.');
    } else if (sp.kind === 'redeploy') {
      if (!target) return false;
      const u = g.board[w][target.lane][target.row];
      if (!u || g.board[w][target.toLane][target.toRow]) return false;
      pl.energy -= c.cost;
      pl.hand.splice(i, 1);
      g.board[w][target.lane][target.row] = null;
      g.board[w][target.toLane][target.toRow] = u;
      log(g, (w === 'p' ? 'You move ' : 'AI moves ') + u.name + ' → L' + (target.toLane + 1) + ' ' + (target.toRow ? 'back' : 'front') + '.');
    } else return false;
    return true;
  }

  // ---- combat (auto, lane by lane, front then back) ----
  function combat(g, w) {
    const e = other(w);
    const shieldWord = isHexStyle(g) ? 'Ward' : 'Plated';
    const pierceWord = isHexStyle(g) ? 'Pierce' : 'Overrun';
    for (let lane = 0; lane < 3 && !g.over; lane++) {
      for (let row = 0; row < 2 && !g.over; row++) {
        const u = g.board[w][lane][row];
        if (!u || u.sick) continue;
        if (row === 1) {
          const rPow = backRowPower(u, g);
          if (!rPow) continue;
          const t = pickTarget(g, w, lane);
          if (!t) { damageFace(g, e, rPow, u.name); continue; }
          const nm = t.u.name;
          const r = damageUnit(g, e, lane, t.row, rPow, u.kw.venom);
          log(g, '⚔ ' + (w === 'p' ? 'Your ' : 'AI ') + u.name + ' fires at ' + nm + (r.blocked ? ' — ' + shieldWord + ' blocks.' : r.died ? ' — destroyed.' : ' for ' + rPow + '.'));
          continue;
        }
        // front row melee
        const pow = effPow(g, w, lane, 0);
        if (pow <= 0) continue;
        const t = pickTarget(g, w, lane);
        if (!t) { damageFace(g, e, pow, u.name); continue; }
        const nm = t.u.name, tHpBefore = t.u.hp, tShield = t.u.shieldUp;
        const retPow = t.row === 0 ? effPow(g, e, lane, 0) : t.u.pow;
        const r = damageUnit(g, e, lane, t.row, pow, u.kw.venom);
        let msg = '⚔ ' + (w === 'p' ? 'Your ' : 'AI ') + u.name + ' (' + pow + ') hits ' + nm;
        if (r.blocked) msg += ' — ' + shieldWord + ' blocks';
        else if (r.died) {
          msg += ' — destroyed';
          if (u.kw.pierce && !tShield) {
            const excess = pow - tHpBefore;
            if (excess > 0) {
              msg += ', ' + excess + ' carries through';
              damageFace(g, e, excess, pierceWord);
            }
          }
        } else msg += ' for ' + pow;
        const still = g.board[e][lane][t.row];
        if (still && retPow > 0) {
          const rr = damageUnit(g, w, lane, 0, retPow, still.kw.venom);
          msg += rr.blocked ? '; retaliation blocked' : rr.died ? '; ' + u.name + ' falls to retaliation' : '; takes ' + retPow + ' back';
        }
        log(g, msg + '.');
      }
    }
  }

  function endTurn(g) {
    if (g.over) return;
    combat(g, g.active);
    if (g.over) return;
    g.active = other(g.active);
    beginTurn(g);
  }

  // ================= AI =================
  const cardValue = (c, g) => c.type === 'spell'
    ? 3 + c.cost * 0.5
    : (c.pow + c.hp) / 2 + backRowPower(c, g) * 0.9 + (c.kw.guard ? 1 : 0) + (c.kw.rally || 0);

  function aiBankChoice(g, w) {
    const pl = g.players[w];
    if (pl.banked || !pl.hand.length) return null;
    const affordable = pl.hand.some(c => byId(c.id, g).cost <= pl.energy && byId(c.id, g).type === 'unit');
    if (pl.income >= 6) return null;
    if (pl.hand.length < 2 && affordable) return null;
    if (pl.income >= 4 && pl.hand.length < 4 && affordable) return null;
    let best = null, bs = -1e9;
    for (const c of pl.hand) {
      const d = byId(c.id, g);
      const gain = d.cost >= CFG.bankBig ? 2 : 1;
      const s = gain * 2 - cardValue(d, g);
      if (s > bs) { bs = s; best = c.uid; }
    }
    return best;
  }

  function aiScoreDeploy(g, w, card, lane, row) {
    const e = other(w), b = g.board[w];
    if (b[lane][row]) return -1e9;
    const myFront = b[lane][0], myBack = b[lane][1];
    const threat = laneThreat(g, e, lane);
    const eEmpty = !g.board[e][lane][0] && !g.board[e][lane][1];
    const rPow = backRowPower(card, g);
    let s = 0;
    if (rPow > card.pow) {
      if (row === 1) s = 3 + rPow * 0.8 + (myFront ? 1.6 : -2.2) + (threat > 0 ? 0.4 : 0);
      else s = card.pow * 0.5 - 1.5;
    } else if (row === 1) {
      s = rPow > 0 ? 1 + rPow * 0.8 + (myFront ? 1.2 : -2) : -6;
    } else {
      s = 1.5 + card.pow * 0.55 + card.hp * 0.3;
      if (eEmpty) s += 1.2;
      if (threat > 0 && !myFront) s += 1.6 + threat * 0.25;
      if (card.kw.guard && myBack) s += 1.8;
      if (card.kw.guard && threat >= 3) s += 1;
      if (card.kw.haste) s += 0.8;
      if (card.kw.pierce) s += 0.5;
      const L = lane > 0 ? b[lane - 1][0] : null, R = lane < 2 ? b[lane + 1][0] : null;
      let syn = 0;
      if (L) syn += L.flanks[1] + card.flanks[0];
      if (R) syn += R.flanks[0] + card.flanks[1];
      s += syn * 0.5;
    }
    if (card.kw.subvert) {
      const e2 = other(w);
      const t0 = g.board[e2][lane][0], t1 = g.board[e2][lane][1];
      const t = (t0 && (t0.cost || 1) <= card.kw.subvert && !t0.beneath) ? t0 : (t1 && (t1.cost || 1) <= card.kw.subvert && !t1.beneath) ? t1 : null;
      if (t) s += 3 + (t.pow + t.hp) * 0.5 + backRowPower(t, g);
      else s -= 2.5;
    }
    if (card.kw.rally) {
      let adj = 0;
      if (lane > 0 && b[lane - 1][row]) adj++;
      if (lane < 2 && b[lane + 1][row]) adj++;
      if (b[lane][1 - row]) adj++;
      s += adj * card.kw.rally * 0.9;
    }
    return s;
  }

  function aiBestSpell(g, w) {
    const pl = g.players[w], e = other(w);
    let best = null, bs = 2.2;
    for (const c of pl.hand) {
      const d = byId(c.id, g);
      if (d.type !== 'spell' || d.cost > pl.energy) continue;
      const sp = d.spell;
      if (sp.kind === 'bolt') {
        for (let l = 0; l < 3; l++) for (let r = 0; r < 2; r++) {
          const u = g.board[e][l][r];
          if (!u) continue;
          const val = u.pow + backRowPower(u, g) * 1.1 + (u.kw.guard ? 1 : 0);
          const kills = !u.shieldUp && u.hp <= sp.dmg;
          const s = kills ? 3 + val * 0.7 : (u.shieldUp ? 1 : val * 0.35 - 0.5);
          if (s > bs) { bs = s; best = { uid: c.uid, target: { side: e, lane: l, row: r } }; }
        }
      } else if (sp.kind === 'volley') {
        let n = 0, k = 0;
        for (let l = 0; l < 3; l++) for (let r = 0; r < 2; r++) {
          const u = g.board[e][l][r];
          if (u) { n++; if (!u.shieldUp && u.hp <= sp.dmg) k++; }
        }
        const s = n * 0.7 + k * 2.2;
        if (s > bs) { bs = s; best = { uid: c.uid, target: null }; }
      } else if (sp.kind === 'reinforce') {
        for (let l = 0; l < 3; l++) {
          const u = g.board[w][l][0];
          if (!u) continue;
          const s = 1 + (laneThreat(g, e, l) > 0 ? 1 : 0) + (u.hp <= 2 ? 0.8 : 0);
          if (s > bs) { bs = s; best = { uid: c.uid, target: { side: w, lane: l, row: 0 } }; }
        }
      } else if (sp.kind === 'insight') {
        const s = pl.hand.length <= 2 ? 3 : pl.energy >= 5 ? 1.4 : 0.5;
        if (s > bs) { bs = s; best = { uid: c.uid, target: null }; }
      } else if (sp.kind === 'possess') {
        for (let l = 0; l < 3; l++) for (let r = 0; r < 2; r++) {
          const u = g.board[e][l][r];
          if (!u || (u.cost || 1) > sp.cap || u.beneath) continue;
          let dest = null;
          const want = backRowPower(u, g) > u.pow ? 1 : 0;
          for (let dl = 0; dl < 3; dl++) for (let dr = 0; dr < 2; dr++) {
            if (!g.board[w][dl][dr] && (!dest || dr === want)) dest = { dl, dr };
          }
          if (!dest) continue;
          const s2 = 2.4 + (u.pow + u.hp) * 0.45 + backRowPower(u, g) * 0.8;
          if (s2 > bs) { bs = s2; best = { uid: c.uid, target: { lane: l, row: r, toLane: dest.dl, toRow: dest.dr } }; }
        }
      }
    }
    return best;
  }

  function aiAct(g, w) {
    if (g.over) return false;
    const pl = g.players[w];
    const bk = aiBankChoice(g, w);
    if (bk != null) return bank(g, w, bk);
    const sp = aiBestSpell(g, w);
    if (sp) return castSpell(g, w, sp.uid, sp.target);
    let best = null, bs = 0.5;
    for (const c of pl.hand) {
      const d = byId(c.id, g);
      if (d.type !== 'unit' || d.cost > pl.energy) continue;
      for (let l = 0; l < 3; l++) for (let r = 0; r < 2; r++) {
        const s = aiScoreDeploy(g, w, d, l, r) + d.cost * 0.15;
        if (s > bs) { bs = s; best = { uid: c.uid, lane: l, row: r }; }
      }
    }
    if (best) return deploy(g, w, best.uid, best.lane, best.row);
    return false;
  }

  function aiTakeTurn(g, w) {
    let n = 0;
    while (n++ < 14 && aiAct(g, w)) {}
    endTurn(g);
  }

  G.FL = {
    style: activeStyle,
    POOL: POOL_FRONTLINE,
    POOLS,
    setStyle,
    byId,
    backRowPower,
    STARTER,
    CFG,
    newGame,
    beginTurn,
    endTurn,
    combat,
    bank,
    deploy,
    castSpell,
    aiAct,
    aiTakeTurn,
    effPow,
    laneThreat,
    pickTarget,
    unitsOf,
    other
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);

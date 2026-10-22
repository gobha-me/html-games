import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MORSE, encode, decodeLetter, decodeKeying, parseMessage, keyingFor, shipReply } from '../js/morse.js';

const ITU = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---',
  3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};
const REV = Object.fromEntries(Object.entries(ITU).map(([k, v]) => [v, k]));
const VOCAB = ['SOS', 'K', 'R', 'AR', 'WHAT LIGHT', 'SKR', 'ROCKS', 'STEER N', 'STEER S', 'STEER E', 'STEER W', 'WHO'];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function presses(specs, t0 = 0) {
  let t = t0;
  const out = [];
  for (let i = 0; i < specs.length; i++) {
    if (i > 0) t += specs[i].gap;
    out.push({ down: t, up: t + specs[i].dur });
    t += specs[i].dur;
  }
  return out;
}

function fields(result) {
  return { text: result.text, symbols: result.symbols, unit: result.unit, threshold: result.threshold };
}

function marks(durs, gap, initialUnit = 125, t0 = 0) {
  return fields(decodeKeying(presses(durs.map((dur, i) => ({ dur, gap: i ? gap : 0 })), t0), { initialUnit }));
}

function eq(got, text, symbols, unit, threshold, msg) {
  assert.deepEqual(got, { text, symbols, unit, threshold }, msg);
}

function expectEncode(text) {
  return text.toUpperCase().split(' ').map((word) => [...word].map((ch) => ITU[ch]).join(' ')).join(' / ');
}

function pairs(events) {
  return events.map((event) => [event.on, event.off]);
}

function schedule(text, wpm) {
  const u = 1200 / wpm;
  const events = [];
  let t = 0;
  for (const [w, word] of text.split(' ').entries()) {
    if (w) t += 7 * u;
    for (let i = 0; i < word.length; i++) {
      if (i) t += 3 * u;
      const code = MORSE[word[i]];
      for (let k = 0; k < code.length; k++) {
        if (k) t += u;
        const dur = code[k] === '.' ? u : 3 * u;
        events.push({ on: t, off: t + dur });
        t += dur;
      }
    }
  }
  return events;
}

function expectedReply(ship, message) {
  if (ship.smuggler) return null;
  if ((message ?? null) === null) return '?';
  if (message.type === 'WHO') return ship.callsign;
  if (message.type === 'ROCKS' || message.type === 'STEER' || message.type === 'SKR') return 'R';
  if (message.type === 'K') return 'K';
  if (message.type === 'WHAT LIGHT') return 'SKR';
  if (message.type === 'SOS') return '?';
  if (message.type === 'R' || message.type === 'AR') return null;
  throw new Error(`fixture ${message.type}`);
}

test('MORSE is the frozen international alphabet', () => {
  assert.equal(Object.isFrozen(MORSE), true);
  const snapshot = { ...MORSE };
  try { MORSE.A = '---'; } catch { /* frozen */ }
  try { delete MORSE.E; } catch { /* frozen */ }
  assert.equal(MORSE.A, snapshot.A);
  assert.equal(MORSE.E, snapshot.E);
  assert.deepEqual(Object.keys(MORSE).sort(), Object.keys(ITU).sort());
  for (const key of Object.keys(ITU)) {
    assert.equal(MORSE[key], ITU[key], key);
    assert.equal(decodeLetter(ITU[key]), key, key);
    assert.equal(encode(key), ITU[key], key);
    assert.equal(encode(key.toLowerCase()), ITU[key], key);
  }
});

test('encode spaces letters and words, folds case, and rejects the rest', () => {
  assert.equal(expectEncode('SOS'), '... --- ...');
  assert.equal(expectEncode('WHAT LIGHT'), '.-- .... .- - / .-.. .. --. .... -');
  for (const text of ['SOS', 'sos', 'WHAT LIGHT', 'what light', 'What Light', 'ab', 'a1', 'aB12 c', 'EE E', 'E EE', 'A B C', '0123456789', 'Z9 Y']) {
    assert.equal(encode(text), expectEncode(text), text);
  }
  for (const text of ['', ' ', '  ', '\t', '\n', '\r', '\f', '\v', ' \t\n ', '!', '.', ',', '?', '/', '-', '_', '@', '#', '*', "'", '"', 'SOS!', 'A.B', '12.3', 'A/B', 'WHAT-LIGHT', 'A_B', 'é', 'Ä', 'ä', 'ß', '你', 'SOS\n', 'A\tB', '...', '---', '..--..']) {
    assert.throws(() => encode(text), RangeError, JSON.stringify(text));
  }
});

test('decodeLetter maps codes, unknown strings to ?, and non-strings to TypeError', () => {
  for (const code of ['', ' ', '......', '------', '----', '..--..', '.-.-.-', '---...', '. .', '.- ', '…', 'x', '.'.repeat(30), '-'.repeat(30)]) {
    assert.equal(decodeLetter(code), '?', JSON.stringify(code));
  }
  assert.equal(decodeLetter('.'), 'E');
  assert.equal(decodeLetter('-'), 'T');
  for (const value of [undefined, null, 0, 1, NaN, Infinity, true, false, {}, [], () => {}, Symbol('x'), Object('.'), new String('.')]) {
    assert.throws(() => decodeLetter(value), TypeError);
  }
});

test('decodeKeying clamps thresholds and splits dot from dash at the edge', () => {
  eq(fields(decodeKeying([])), '', '', 125, 250, 'empty');
  eq(fields(decodeKeying([], {})), '', '', 125, 250, 'empty opts');
  eq(fields(decodeKeying([], { initialUnit: undefined })), '', '', 125, 250, 'undefined unit');
  for (const [u0, threshold] of [[10, 150], [80, 160], [150, 300], [200, 400], [500, 400]]) {
    eq(fields(decodeKeying([], { initialUnit: u0 })), '', '', u0, threshold, `empty ${u0}`);
  }
  const edges = [
    [1, 125, 'E', '.', 1, 150], [10, 125, 'E', '.', 10, 150], [249, 125, 'E', '.', 249, 400],
    [250, 125, 'T', '-', 125, 250], [251, 125, 'T', '-', 125, 250], [400, 125, 'T', '-', 125, 250],
    [149, 74, 'E', '.', 149, 298], [150, 74, 'T', '-', 74, 150], [151, 74, 'T', '-', 74, 150],
    [149, 75, 'E', '.', 149, 298], [150, 75, 'T', '-', 75, 150],
    [151, 76, 'E', '.', 151, 302], [152, 76, 'T', '-', 76, 152], [153, 76, 'T', '-', 76, 152],
    [397, 199, 'E', '.', 397, 400], [398, 199, 'T', '-', 199, 398], [399, 199, 'T', '-', 199, 398],
    [399, 200, 'E', '.', 399, 400], [400, 200, 'T', '-', 200, 400], [401, 200, 'T', '-', 200, 400],
    [399, 201, 'E', '.', 399, 400], [400, 201, 'T', '-', 201, 400], [401, 201, 'T', '-', 201, 400],
  ];
  for (const [dur, u0, text, symbols, unit, threshold] of edges) eq(marks([dur], 1, u0), text, symbols, unit, threshold, `${dur}@${u0}`);
  eq(fields(decodeKeying([{ down: 0, up: 100.5 }])), 'E', '.', 100.5, 201, 'fraction');
  eq(marks([100], 1, 125, 5000), 'E', '.', 100, 200, 'nonzero origin');
});

test('adaptation, gap edges, and the five-dot window', () => {
  const follow = [
    [100, 199, 10, 125, 'I', '..', 149.5, 299], [100, 200, 10, 125, 'A', '.-', 100, 200],
    [100, 249, 10, 125, 'A', '.-', 100, 200], [10, 148, 10, 125, 'I', '..', 79, 158],
    [10, 149, 10, 125, 'I', '..', 79.5, 159], [10, 150, 10, 125, 'A', '.-', 10, 150],
    [399, 399, 100, 250, 'I', '..', 399, 400], [399, 400, 100, 250, 'A', '.-', 399, 400],
    [399, 401, 100, 250, 'A', '.-', 399, 400],
  ];
  for (const [a, b, gap, u0, text, symbols, unit, threshold] of follow) {
    eq(marks([a, b], gap, u0), text, symbols, unit, threshold, `${a},${b}@${u0}`);
  }
  for (const [gap, text, symbols] of [[299, 'I', '..'], [300, 'EE', '. .'], [301, 'EE', '. .'], [699, 'EE', '. .'], [700, 'E E', '. / .'], [701, 'E E', '. / .'], [874, 'E E', '. / .'], [5000, 'E E', '. / .']]) {
    eq(marks([100, 100], gap, 125), text, symbols, 100, 200, `dot gap ${gap}`);
  }
  for (const [gap, text, symbols] of [[374, 'M', '--'], [375, 'TT', '- -'], [376, 'TT', '- -'], [874, 'TT', '- -'], [875, 'T T', '- / -'], [876, 'T T', '- / -'], [5000, 'T T', '- / -']]) {
    eq(marks([400, 400], gap), text, symbols, 125, 250, `dash gap ${gap}`);
  }
  eq(marks([100, 100, 100], 700, 125), 'E E E', '. / . / .', 100, 200, 'three words');
  eq(fields(decodeKeying(presses([{ dur: 100 }, { dur: 100, gap: 300 }, { dur: 100, gap: 700 }]), { initialUnit: 125 })), 'EE E', '. . / .', 100, 200, 'letter then word');
  eq(fields(decodeKeying(presses([{ dur: 100 }, { dur: 100, gap: 700 }, { dur: 100, gap: 300 }]), { initialUnit: 125 })), 'E EE', '. / . .', 100, 200, 'word then letter');
  eq(fields(decodeKeying([{ down: 0, up: 100 }, { down: 101, up: 201 }], { initialUnit: 100 })), 'I', '..', 100, 200, '1ms gap');
  const groups = [
    [[100, 120, 140, 160, 180], 10, '5', '.....', 140, 280],
    [[100, 120, 140, 160, 180, 200], 10, '?', '......', 160, 320],
    [[100, 120, 140, 160, 180, 400], 10, '?', '.....-', 140, 280],
    [[100, 120, 140, 160, 180, 400, 200], 10, '?', '.....-.', 160, 320],
    [[400, 400, 400, 400, 400], 50, '0', '-----', 125, 250],
    [[400, 400, 400, 400, 400, 400], 50, '?', '------', 125, 250],
  ];
  for (const [durs, gap, text, symbols, unit, threshold] of groups) eq(marks(durs, gap), text, symbols, unit, threshold, symbols);
});

test('decodeKeying rejects events that are not finite, ordered, and strictly separated', () => {
  const hole = [];
  hole[1] = { down: 0, up: 100 };
  const bad = [
    null, undefined, {}, 'E', 1, { length: 1, 0: { down: 0, up: 100 } }, hole, [null], [undefined], [{}],
    [{ down: 0 }], [{ up: 100 }], [{ down: '0', up: '100' }], [{ down: 0, up: NaN }], [{ down: NaN, up: 10 }],
    [{ down: 0, up: Infinity }], [{ down: -Infinity, up: 10 }], [{ down: Infinity, up: Infinity }],
    [{ down: -1, up: 10 }], [{ down: -0.1, up: 10 }], [{ down: 5, up: 5 }], [{ down: 5, up: 4 }],
    [{ down: true, up: 20 }], [[0, 100]], [{ down: 0, up: 100 }, { down: 100, up: 200 }],
    [{ down: 0, up: 100 }, { down: 99, up: 200 }], [{ down: 0, up: 100 }, { down: 50, up: 150 }],
    [{ down: 100, up: 200 }, { down: 0, up: 50 }],
    [{ down: 0, up: 100 }, { down: 200, up: 300 }, { down: 250, up: 400 }], keyingFor('E', 8),
  ];
  for (const events of bad) assert.throws(() => decodeKeying(events), RangeError);
});

test('seeded stable-unit streams hit gap buckets and stay deterministic', () => {
  const edges = [299, 300, 301, 699, 700, 701];
  for (let seed = 1; seed <= 40; seed++) {
    const rng = mulberry32(seed);
    const n = 1 + Math.floor(rng() * 6);
    const specs = [];
    const elems = [];
    const kinds = [];
    for (let i = 0; i < n; i++) {
      let gap = 0;
      if (i > 0) {
        const roll = rng();
        if (roll < 0.4) gap = edges[Math.floor(rng() * edges.length)];
        else if (roll < 0.6) gap = 1 + Math.floor(rng() * 298);
        else if (roll < 0.8) gap = 300 + Math.floor(rng() * 399);
        else gap = 700 + Math.floor(rng() * 400);
      }
      const dot = rng() < 0.6;
      specs.push({ dur: dot ? 100 : 400, gap });
      elems.push(dot ? '.' : '-');
      kinds.push(gap < 300 ? 'in' : gap < 700 ? 'letter' : 'word');
    }
    const groups = [elems[0]];
    const seps = [];
    for (let i = 1; i < n; i++) {
      if (kinds[i] === 'in') groups[groups.length - 1] += elems[i];
      else { seps.push(kinds[i]); groups.push(elems[i]); }
    }
    let symbols = groups[0];
    let text = REV[groups[0]] ?? '?';
    for (let i = 1; i < groups.length; i++) {
      symbols += `${seps[i - 1] === 'word' ? ' / ' : ' '}${groups[i]}`;
      text += `${seps[i - 1] === 'word' ? ' ' : ''}${REV[groups[i]] ?? '?'}`;
    }
    const events = presses(specs);
    const once = fields(decodeKeying(events, { initialUnit: 100 }));
    assert.deepEqual(fields(decodeKeying(events, { initialUnit: 100 })), once, `det ${seed}`);
    assert.equal(once.symbols, symbols, `${seed} ${symbols}`);
    assert.equal(once.text, text, `${seed} ${text}`);
    assert.equal(once.unit, 100, `unit ${seed}`);
    assert.equal(once.threshold, 200, `threshold ${seed}`);
  }
});

test('parseMessage keeps only the trimmed vocabulary', () => {
  for (const [input, type] of [['SOS', 'SOS'], ['  SOS  ', 'SOS'], ['K', 'K'], [' K ', 'K'], ['R', 'R'], ['AR', 'AR'], ['  AR', 'AR'], ['WHAT LIGHT', 'WHAT LIGHT'], ['WHAT  LIGHT', 'WHAT LIGHT'], ['  WHAT   LIGHT  ', 'WHAT LIGHT'], ['SKR', 'SKR'], ['  SKR  ', 'SKR'], ['ROCKS', 'ROCKS'], ['ROCKS   ', 'ROCKS'], ['WHO', 'WHO'], [' WHO ', 'WHO']]) {
    assert.equal(parseMessage(input) && parseMessage(input).type, type, input);
  }
  for (const dir of ['N', 'S', 'E', 'W']) {
    for (const input of [`STEER ${dir}`, `  STEER   ${dir}  `, `STEER  ${dir}`]) {
      const got = parseMessage(input);
      assert.equal(got && got.type, 'STEER', input);
      assert.equal(got.dir, dir, input);
    }
  }
  for (const input of ['', ' ', '   ', '\t', '\n', 'sos', 'Sos', '  sos  ', 'k', 'r', 'ar', 'Ar', 'who', 'what light', 'What Light', 'WHAT light', 'WHAT  light', 'skr', 'rocks', 'steer n', 'STEER n', 'Steer N', 'STEER north', 'STEER NE', 'STEER', 'STEERN', 'STEER N E', 'STEER NN', 'N', 'SOS!', 'SOS?', '?SOS', 'S?S', '?', '??', 'E?', 'WHAT LIGHT?', 'WHAT ? LIGHT', 'ROCKS?', 'WHO?', 'K?', 'SO S', 'A R', 'WHATLIGHT', 'WHAT LIGHTS', 'LIGHT', 'WHAT', 'MAYDAY', 'CQ', 'EEE', 'HI', '... --- ...', '.-- .... .- - / .-.. .. --. .... -', 'SOS SOS', 'RR', 'ROCK', 'ROCKSS', 'A', 'E', 'T', '0', 'M']) {
    assert.equal(parseMessage(input), null, JSON.stringify(input));
  }
  assert.deepEqual(parseMessage('  WHAT   LIGHT  '), parseMessage('WHAT LIGHT'));
});

test('keyingFor uses 1200/wpm and rejects every other rate', () => {
  const literal = {
    '8 E': [[0, 150]], '8 T': [[0, 450]], '8 A': [[0, 150], [300, 750]], '8 I': [[0, 150], [300, 450]],
    '8 N': [[0, 450], [600, 750]], '8 M': [[0, 450], [600, 1050]], '8 K': [[0, 450], [600, 750], [900, 1350]],
    '8 R': [[0, 150], [300, 750], [900, 1050]], '8 EE': [[0, 150], [600, 750]], '8 E E': [[0, 150], [1200, 1350]],
    '8 ET': [[0, 150], [600, 1050]], '8 E T': [[0, 150], [1200, 1650]],
    '8 SOS': [[0, 150], [300, 450], [600, 750], [1200, 1650], [1800, 2250], [2400, 2850], [3300, 3450], [3600, 3750], [3900, 4050]],
    '5 E': [[0, 240]], '5 T': [[0, 720]], '5 A': [[0, 240], [480, 1200]], '5 EE': [[0, 240], [960, 1200]],
    '5 E E': [[0, 240], [1920, 2160]],
  };
  for (const [key, want] of Object.entries(literal)) {
    const splitAt = key.indexOf(' ');
    const wpm = Number(key.slice(0, splitAt));
    const text = key.slice(splitAt + 1);
    assert.deepEqual(pairs(keyingFor(text, wpm)), want, key);
    assert.deepEqual(pairs(schedule(text, wpm)), want, `schedule ${key}`);
  }
  assert.deepEqual(pairs(keyingFor('E')), pairs(keyingFor('E', 8)));
  assert.deepEqual(pairs(keyingFor('E', undefined)), pairs(keyingFor('E', 8)));
  for (const text of ['WHAT LIGHT', 'STEER N', 'AR', 'ROCKS', 'SKR', 'WHO', '0', '5', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789']) {
    for (const wpm of [5, 8]) assert.deepEqual(pairs(keyingFor(text, wpm)), pairs(schedule(text, wpm)), `${text} ${wpm}`);
  }
  for (const wpm of [0, 1, 4, 6, 7, 9, 10, -8, 3, 5.5, 7.999, 8.001, NaN, Infinity, -Infinity, null, '5', '8', true, false]) {
    assert.throws(() => keyingFor('SOS', wpm), RangeError, String(wpm));
  }
});

test('seeded phrases and vocabulary round-trip at 8 wpm', () => {
  const check = (text) => {
    const flashed = keyingFor(text, 8).map(({ on, off }) => ({ down: on, up: off }));
    const decoded = decodeKeying(flashed, { initialUnit: 150 });
    assert.equal(decoded.text, text, text);
    assert.equal(decoded.symbols, encode(text), text);
    assert.equal(decoded.unit, 150, text);
    assert.equal(decoded.threshold, 300, text);
    assert.deepEqual(fields(decodeKeying(flashed, { initialUnit: 150 })), fields(decoded), text);
  };
  for (const text of [...VOCAB, 'E', 'T', '0', '5', 'EE', 'E E', 'ET', 'E T', 'M']) check(text);
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const junk = '!?.,/@#*;:_$%^&';
  for (let seed = 1; seed <= 30; seed++) {
    const rng = mulberry32(0xa11ce + seed);
    let text = '';
    for (let w = 0, words = 1 + Math.floor(rng() * 3); w < words; w++) {
      if (w) text += ' ';
      for (let i = 0, len = 1 + Math.floor(rng() * 4); i < len; i++) text += alpha[Math.floor(rng() * alpha.length)];
    }
    assert.equal(encode(text), expectEncode(text), text);
    assert.equal(encode(text.toLowerCase()), encode(text), text);
    const back = encode(text).split(' / ').map((word) => word.split(' ').map((code) => decodeLetter(code)).join('')).join(' ');
    assert.equal(back, text, text);
    check(text);
    assert.equal(parseMessage(text.toLowerCase()), null, text);
    assert.equal(parseMessage(`${text}?`), null, text);
    assert.throws(() => encode(`${text.slice(0, 1)}${junk[seed % junk.length]}${text.slice(1)}`), RangeError, text);
  }
});

test('shipReply follows the table and smugglers stay silent', () => {
  const messages = [
    null, { type: 'SOS' }, { type: 'K' }, { type: 'R' }, { type: 'AR' }, { type: 'WHAT LIGHT' },
    { type: 'SKR' }, { type: 'ROCKS' }, { type: 'STEER', dir: 'N' }, { type: 'STEER', dir: 'S' },
    { type: 'STEER', dir: 'E' }, { type: 'STEER', dir: 'W' }, { type: 'WHO' },
  ];
  for (const type of ['pilot', 'trader']) {
    for (const smuggler of [false, true]) {
      for (const endangered of [false, true]) {
        for (const callsign of ['GX', 'ab 12', '?', '']) {
          const ship = { type, smuggler, endangered, callsign };
          for (const message of messages) {
            assert.equal(shipReply(ship, message), expectedReply(ship, message), JSON.stringify({ ship, message }));
          }
        }
      }
    }
  }
  const honest = { type: 'pilot', smuggler: false, endangered: true, callsign: 'ZZ' };
  const smuggler = { ...honest, smuggler: true };
  for (const raw of [...VOCAB, '  WHAT   LIGHT  ', '  STEER   W  ', 'nope', 'sos', '', '?', 'SOS?']) {
    const message = parseMessage(raw);
    assert.equal(shipReply(honest, message), expectedReply(honest, message), raw);
    assert.equal(shipReply(smuggler, message), null, raw);
  }
  const garbage = decodeKeying(presses([0, 1, 2, 3, 4, 5].map((i) => ({ dur: 100, gap: i ? 10 : 0 }))), { initialUnit: 100 });
  assert.equal(garbage.symbols, '......');
  assert.equal(garbage.text, '?');
  assert.equal(parseMessage(garbage.text), null);
  assert.equal(shipReply(honest, null), '?');
  assert.equal(shipReply(smuggler, null), null);
});

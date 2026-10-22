import test from 'node:test';
import assert from 'node:assert/strict';
import { MORSE, encode, decodeLetter, decodeKeying, parseMessage, keyingFor, shipReply } from '../js/morse.js';

const vocabulary = ['SOS', 'K', 'R', 'AR', 'WHAT LIGHT', 'SKR', 'ROCKS',
  'STEER N', 'STEER S', 'STEER E', 'STEER W', 'WHO'];
const eventsFor = (text, wpm = 8) => keyingFor(text, wpm).map(({ on, off }) => ({ down: on, up: off }));

test('all 26 letters and ten digits match International Morse and round-trip in both speeds', () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const codes = '.- -... -.-. -.. . ..-. --. .... .. .--- -.- .-.. -- -. --- .--. --.- .-. ... - ..- ...- .-- -..- -.-- --.. ----- .---- ..--- ...-- ....- ..... -.... --... ---.. ----.'.split(' ');
  assert.equal(Object.isFrozen(MORSE), true);
  assert.equal(Object.keys(MORSE).length, 36);
  for (const [index, letter] of [...alphabet].entries()) {
    assert.equal(MORSE[letter], codes[index]);
    assert.equal(encode(letter.toLowerCase()), codes[index]);
    assert.equal(decodeLetter(codes[index]), letter);
    for (const wpm of [5, 8]) {
      assert.equal(decodeKeying(eventsFor(letter, wpm), { initialUnit: 1200 / wpm }).text, letter);
    }
  }
  assert.equal(decodeKeying(eventsFor(alphabet), { initialUnit: 150 }).text, alphabet);
  assert.equal(encode('SOS'), '... --- ...');
  assert.equal(encode('WHAT LIGHT'), '.-- .... .- - / .-.. .. --. .... -');
  assert.equal(encode('  what   light  '), encode('WHAT LIGHT'));
});

test('vocabulary round-trips with exact element, letter and word gaps at 8 and 5 WPM', () => {
  for (const text of vocabulary) for (const wpm of [5, 8]) {
    const events = eventsFor(text, wpm), unit = 1200 / wpm;
    const decoded = decodeKeying(events, { initialUnit: unit });
    assert.equal(decoded.text, text);
    assert.equal(decoded.symbols, encode(text));
    assert.equal(events[0].down, 0);
    for (const [index, event] of events.entries()) {
      assert.ok([unit, 3 * unit].includes(event.up - event.down));
      if (index) assert.ok([unit, 3 * unit, 7 * unit].includes(event.down - events[index - 1].up));
    }
  }
  assert.deepEqual(keyingFor('ET E'), [{ on: 0, off: 150 }, { on: 600, off: 1050 }, { on: 2100, off: 2250 }]);
  assert.deepEqual(keyingFor('?', 8), [
    { on: 0, off: 150 }, { on: 300, off: 450 }, { on: 600, off: 1050 },
    { on: 1200, off: 1650 }, { on: 1800, off: 1950 }, { on: 2100, off: 2250 },
  ]);
});

test('gap thresholds use the current adapted unit, with exact and ±1 ms edges', () => {
  for (const unit of [50, 100, 125, 150, 199]) {
    for (const [gap, symbols, text] of [[3 * unit - 1, '..', 'I'], [3 * unit, '. .', 'EE'],
      [3 * unit + 1, '. .', 'EE'], [7 * unit - 1, '. .', 'EE'],
      [7 * unit, '. / .', 'E E'], [7 * unit + 1, '. / .', 'E E']]) {
      const result = decodeKeying([{ down: 0, up: unit }, { down: unit + gap, up: 2 * unit + gap }]);
      assert.equal(result.symbols, symbols, `u=${unit}, gap=${gap}`);
      assert.equal(result.text, text);
    }
  }
  assert.equal(decodeKeying([{ down: 0, up: 100 }, { down: 400, up: 600 }]).symbols, '. -');
});

test('press thresholds include equality in dash, including both clamped bounds', () => {
  for (const [unit, threshold] of [[1, 150], [75, 150], [125, 250], [200, 400], [1000, 400]]) {
    for (const delta of [-1, 0, 1]) {
      assert.equal(decodeKeying([{ down: 0, up: threshold + delta }], { initialUnit: unit }).symbols,
        delta < 0 ? '.' : '-');
    }
  }
});

test('adaptation averages only the latest five dots; dashes do not change the estimate', () => {
  const durations = [100, 110, 120, 130, 140, 150];
  let time = 0;
  const events = durations.map((duration) => {
    const event = { down: time, up: time + duration }; time += duration + 1; return event;
  });
  assert.equal(decodeKeying(events).unit, 130);
  events.push({ down: time, up: time + 1000 });
  assert.equal(decodeKeying(events).unit, 130);
  assert.equal(decodeKeying(events).threshold, 260);
  assert.equal(decodeKeying([{ down: 0, up: 1 }]).threshold, 150);
  assert.equal(decodeKeying([{ down: 0, up: 399 }], { initialUnit: 300 }).threshold, 400);
  assert.deepEqual(decodeKeying([]), { text: '', symbols: '', unit: 125, threshold: 250 });
  assert.deepEqual(decodeKeying([], { initialUnit: 1000 }), { text: '', symbols: '', unit: 1000, threshold: 400 });
});

test('unknown sequences produce question marks without autocorrection', () => {
  for (const code of ['', '......', '----', '..--..', 'foo', '. -', '/', '·']) assert.equal(decodeLetter(code), '?');
  assert.equal(decodeKeying(eventsFor('?')).text, '?');
  assert.equal(decodeKeying(Array.from({ length: 6 }, (_, i) => ({ down: i * 250, up: i * 250 + 125 }))).text, '?');
  for (const code of [null, undefined, 0, {}, []]) assert.throws(() => decodeLetter(code), TypeError);
});

test('reject malformed input, unsupported punctuation/speeds and every invalid event shape', () => {
  for (const text of ['', ' ', '\n', 'A\tB', 'SOS!', '?', 'é', 5, null, undefined, {}]) {
    assert.throws(() => encode(text), RangeError);
  }
  for (const wpm of [0, -8, 7, 10, '8', null, NaN, Infinity]) assert.throws(() => keyingFor('E', wpm), RangeError);
  for (const events of [null, {}, 'SOS', [null], [{}], [{ down: 1 }], [{ up: 2 }],
    [{ down: -1, up: 1 }], [{ down: 0, up: 0 }], [{ down: 2, up: 1 }],
    [{ down: '0', up: 1 }], [{ down: 0, up: Infinity }], [{ down: NaN, up: 1 }],
    [{ down: 0, up: 2 }, { down: 1, up: 3 }], [{ down: 0, up: 2 }, { down: 2, up: 3 }],
    [{ down: 4, up: 5 }, { down: 0, up: 1 }], Array(1)]) {
    assert.throws(() => decodeKeying(events), RangeError);
  }
  for (const initialUnit of [0, -1, NaN, Infinity, '125', null]) {
    assert.throws(() => decodeKeying([], { initialUnit }), RangeError);
  }
  const events = Object.freeze([Object.freeze({ down: 0, up: 125 })]);
  assert.equal(decodeKeying(events).text, 'E');
});

test('parser recognises only the exact uppercase vocabulary and normalises spacing', () => {
  for (const text of vocabulary) {
    assert.deepEqual(parseMessage(`  ${text.replace(' ', ' \n ')}  `), text.startsWith('STEER ')
      ? { type: 'STEER', dir: text.at(-1) } : { type: text });
  }
  for (const text of ['sos', 'Who', 'STEER NE', 'STEER', '?', 'ROCKS?', 'R K', '', null, 1, {}, 'garbage']) {
    assert.equal(parseMessage(text), null);
  }
});

test('every honest reply and smuggler silence, including garbage and SOS', () => {
  const ship = { type: 'trawler', smuggler: false, endangered: true, callsign: 'T108' };
  const replies = ['?', 'K', null, null, 'SKR', 'R', 'R', 'R', 'R', 'R', 'R', 'T108'];
  for (const [index, text] of vocabulary.entries()) {
    assert.equal(shipReply(ship, parseMessage(text)), replies[index]);
    assert.equal(shipReply({ ...ship, endangered: false }, parseMessage(text)), replies[index]);
    assert.equal(shipReply({ ...ship, smuggler: true }, parseMessage(text)), null);
  }
  assert.equal(shipReply(ship, parseMessage('garbage')), '?');
  assert.equal(shipReply({ ...ship, smuggler: true }, null), null);
});

// International Morse; all times are caller-supplied milliseconds.
export const MORSE = Object.freeze({
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
  H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
  O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
  V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
});
const LETTERS = new Map(Object.entries(MORSE).map(([letter, code]) => [code, letter]));
const thresholdFor = (unit) => Math.max(150, Math.min(400, 2 * unit));

export function encode(text) {
  if (typeof text !== 'string' || !/^[a-z0-9 ]+$/i.test(text) || !text.trim()) {
    throw new RangeError('Expected nonempty letters, digits and spaces');
  }
  return text.trim().toUpperCase().split(/ +/).map((word) =>
    [...word].map((letter) => MORSE[letter]).join(' ')).join(' / ');
}

export function decodeLetter(code) {
  if (typeof code !== 'string') throw new TypeError('Expected a Morse string');
  return LETTERS.get(code) ?? '?';
}

export function decodeKeying(events, { initialUnit = 125 } = {}) {
  if (!Array.isArray(events) || !Number.isFinite(initialUnit) || initialUnit <= 0) {
    throw new RangeError('Expected events and a positive finite dot unit');
  }
  let previousUp = -1;
  for (const event of events) {
    if (!event || !Number.isFinite(event.down) || !Number.isFinite(event.up)
      || event.down < 0 || event.down >= event.up || event.down <= previousUp) {
      throw new RangeError('Keying events must be finite, positive-length, sorted and separate');
    }
    previousUp = event.up;
  }
  let unit = initialUnit, text = '', symbols = '', letter = '';
  const dots = [];
  previousUp = null;
  for (const { down, up } of events) {
    if (previousUp !== null && down - previousUp >= 3 * unit) {
      text += decodeLetter(letter);
      letter = '';
      const word = down - previousUp >= 7 * unit;
      text += word ? ' ' : '';
      symbols += word ? ' / ' : ' ';
    }
    const duration = up - down;
    const symbol = duration < thresholdFor(unit) ? '.' : '-';
    symbols += symbol; letter += symbol;
    if (symbol === '.') {
      dots.push(duration);
      if (dots.length > 5) dots.shift();
      unit = dots.reduce((sum, dot) => sum + dot, 0) / dots.length;
    }
    previousUp = up;
  }
  return { text: text + (letter ? decodeLetter(letter) : ''), symbols, unit, threshold: thresholdFor(unit) };
}

export function parseMessage(text) {
  if (typeof text !== 'string') return null;
  text = text.trim().replace(/\s+/g, ' ');
  if (/^STEER [NSEW]$/.test(text)) return { type: 'STEER', dir: text.at(-1) };
  return ['SOS', 'K', 'R', 'AR', 'WHAT LIGHT', 'SKR', 'ROCKS', 'WHO'].includes(text) ? { type: text } : null;
}

export function keyingFor(text, wpm = 8) {
  if (wpm !== 5 && wpm !== 8) throw new RangeError('Incoming speed must be 5 or 8 WPM');
  // The error reply uses standard question-mark punctuation; encode stays strict.
  const words = (text === '?' ? '..--..' : encode(text)).split(' / ');
  const unit = 1200 / wpm, flashes = [];
  let time = 0;
  for (const [wordIndex, word] of words.entries()) {
    if (wordIndex) time += 7 * unit;
    for (const [letterIndex, letter] of word.split(' ').entries()) {
      if (letterIndex) time += 3 * unit;
      for (const [symbolIndex, symbol] of [...letter].entries()) {
        if (symbolIndex) time += unit;
        const off = time + (symbol === '.' ? unit : 3 * unit);
        flashes.push({ on: time, off });
        time = off;
      }
    }
  }
  return flashes;
}

export function shipReply(ship, message) {
  if (ship.smuggler) return null;
  switch (message?.type) {
    case 'WHO': return ship.callsign;
    case 'ROCKS': case 'STEER': case 'SKR': return 'R';
    case 'K': return 'K';
    case 'R': case 'AR': return null;
    case 'WHAT LIGHT': return 'SKR';
    default: return '?';
  }
}

// Venice art drop-in. Card art is optional: if art/cards/{id}.webp is present it
// renders behind the card/cell text with a legibility scrim; if it 404s the
// layer removes itself and the text-only card (the prototype look) remains.
// Canonical ids come from engine.js POOL — see art/README.md + ART-DIRECTION.md.

// Per-card vertical focal point (object-position Y). Full-body figures carry the
// head high in frame so they crop from the top; abstract/centered pieces sit
// mid-frame. Tuned against the venice masters; unknown ids fall back to FOCUS_DEF.
const FOCUS_DEF = 40;
const ART_FOCUS = {
  adder: 42, archer: 34, ballista: 46, banner: 40, bolt: 50, champ: 46,
  cross: 46, duel: 44, foot: 34, insight: 46, lancer: 36, marks: 50,
  outrider: 46, picket: 34, possess: 44, puppet: 40, redeploy: 44, reinf: 48,
  scout: 38, shieldb: 42, skirm: 42, van: 34, vet: 46, volley: 48,
  warden: 42, warlord: 40,
};
const focus = id => `50% ${ART_FOCUS[id] ?? FOCUS_DEF}%`;

export function cardArt(id, extra) {
  const wrap = document.createElement('div');
  wrap.setAttribute('style', 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;' + (extra || ''));
  const img = document.createElement('img');
  img.src = 'art/cards/' + id + '.webp';
  img.alt = '';
  img.setAttribute('style', `width:100%;height:100%;object-fit:cover;object-position:${focus(id)};display:block`);
  img.addEventListener('error', () => wrap.remove());
  const scrim = document.createElement('div');
  scrim.setAttribute('style', 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,13,17,.06) 0%,rgba(11,13,17,.30) 42%,rgba(11,13,17,.86) 100%)');
  wrap.append(img, scrim);
  return wrap;
}

// Top art-window band for a hand card: portrait art above the text panel. If the
// webp 404s the band removes itself and the card shrinks back to text-only.
export function cardArtBand(id, height) {
  const band = document.createElement('div');
  band.setAttribute('style', `position:relative;flex:none;height:${height || 52}px;overflow:hidden;background:#0e1117`);
  const img = document.createElement('img');
  img.src = 'art/cards/' + id + '.webp';
  img.alt = '';
  img.setAttribute('style', `width:100%;height:100%;object-fit:cover;object-position:${focus(id)};display:block`);
  img.addEventListener('error', () => band.remove());
  band.append(img);
  return band;
}

// Small fixed-size card thumbnail for the roster pool. Portrait art in a dark box;
// if the webp 404s the img removes itself and the box stays a plain dark tile.
export function cardThumb(id, w, h) {
  const box = document.createElement('div');
  box.setAttribute('style', `position:relative;flex:none;width:${w || 44}px;height:${h || 56}px;overflow:hidden;background:#0e1117;border:1px solid #232a36`);
  const img = document.createElement('img');
  img.src = 'art/cards/' + id + '.webp';
  img.alt = '';
  img.setAttribute('style', `width:100%;height:100%;object-fit:cover;object-position:${focus(id)};display:block`);
  img.addEventListener('error', () => img.remove());
  box.append(img);
  return box;
}

// Full-card art for the zoom modal: the whole portrait, uncropped (object-fit
// contain). Returns null-safe img; on 404 it swaps to a dark placeholder so the
// modal's text panel still reads.
export function cardArtFull(id) {
  const img = document.createElement('img');
  img.src = 'art/cards/' + id + '.webp';
  img.alt = '';
  img.setAttribute('style', 'display:block;width:100%;max-height:62vh;object-fit:contain;border-radius:12px;background:#0e1117');
  img.addEventListener('error', () => { img.style.height = '160px'; img.removeAttribute('src'); });
  return img;
}

// Optional battlefield backdrop behind the board grid (art/env/board_field.webp).
export function boardField() {
  const img = document.createElement('img');
  img.src = 'art/env/board_field.webp';
  img.alt = '';
  img.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.34;pointer-events:none;z-index:0');
  img.addEventListener('error', () => img.remove());
  return img;
}

// Venice art drop-in supporting both Frontline (art/) and Hexwire (art-hw/) portrait libraries.
import { state } from './state.js';

export const FOCAL_FL = {
  scout: .38, skirm: .34, picket: .64, foot: .26, archer: .68,
  shieldb: .34, duel: .30, adder: .26, banner: .54, vet: .24,
  cross: .52, warden: .36, champ: .48, lancer: .46, marks: .5,
  outrider: .26, van: .5, warlord: .52, ballista: .52,
  puppet: .40, possess: .44,
};

export const FOCAL_HW = {
  adder: .42, archer: .34, ballista: .46, banner: .40, bolt: .50, champ: .46,
  cross: .46, duel: .44, foot: .34, insight: .46, lancer: .36, marks: .50,
  outrider: .46, picket: .34, possess: .44, puppet: .40, redeploy: .44, reinf: .48,
  scout: .38, shieldb: .42, skirm: .42, van: .34, vet: .46, volley: .48,
  warden: .42, warlord: .40,
};

function artFolder(id) {
  if (state.style === 'hexwire') return 'art-hw';
  if (state.style === 'rift' && (id === 'puppet' || id === 'possess')) return 'art-hw';
  return 'art';
}

export function cardImgSrc(id) {
  return artFolder(id) + '/cards/' + id + '.webp';
}

export function focalY(id) {
  const map = state.style === 'hexwire' || id === 'puppet' || id === 'possess' ? FOCAL_HW : FOCAL_FL;
  return Math.round((map[id] ?? .5) * 100) + '%';
}

export function cardArt(id, extra) {
  const hex = state.style === 'hexwire';
  const wrap = document.createElement('div');
  wrap.setAttribute('style', 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;' + (extra || ''));
  const img = document.createElement('img');
  img.src = cardImgSrc(id);
  img.alt = '';
  img.setAttribute('style', 'width:100%;height:100%;object-fit:cover;object-position:50% ' + focalY(id) + ';display:block');
  img.addEventListener('error', () => wrap.remove());
  const scrim = document.createElement('div');
  scrim.setAttribute('style', hex
    ? 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,13,17,.06) 0%,rgba(11,13,17,.30) 42%,rgba(11,13,17,.86) 100%)'
    : 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(38,34,26,.12) 0%,rgba(38,34,26,.74) 100%)');
  wrap.append(img, scrim);
  return wrap;
}

export function cardArtBand(id, height) {
  const hex = state.style === 'hexwire';
  const band = document.createElement('div');
  band.setAttribute('style', `position:relative;flex:none;height:${height || (hex ? 74 : 56)}px;overflow:hidden;background:${hex ? '#0e1117' : '#26221a'}`);
  const img = document.createElement('img');
  img.src = cardImgSrc(id);
  img.alt = '';
  img.setAttribute('style', 'width:100%;height:100%;object-fit:cover;object-position:50% ' + focalY(id) + ';display:block');
  img.addEventListener('error', () => band.remove());
  band.append(img);
  return band;
}

export function cardThumb(id, w, h) {
  const hex = state.style === 'hexwire';
  const box = document.createElement('div');
  box.setAttribute('style', `position:relative;flex:none;width:${w || 44}px;height:${h || 56}px;overflow:hidden;background:${hex ? '#0e1117' : '#26221a'};border:1px solid ${hex ? '#232a36' : '#4a422e'}`);
  const img = document.createElement('img');
  img.src = cardImgSrc(id);
  img.alt = '';
  img.setAttribute('style', 'width:100%;height:100%;object-fit:cover;object-position:50% ' + focalY(id) + ';display:block');
  img.addEventListener('error', () => img.remove());
  box.append(img);
  return box;
}

export function cardArtFull(id) {
  const img = document.createElement('img');
  img.src = cardImgSrc(id);
  img.alt = '';
  img.setAttribute('style', 'display:block;width:100%;max-height:62vh;object-fit:contain;border-radius:12px;background:#0e1117');
  img.addEventListener('error', () => { img.style.height = '160px'; img.removeAttribute('src'); });
  return img;
}

export function boardField() {
  const hex = state.style === 'hexwire';
  const wrap = document.createElement('div');
  wrap.setAttribute('style', 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0');
  const img = document.createElement('img');
  img.src = (hex ? 'art-hw' : 'art') + '/env/board_field.webp';
  img.alt = '';
  img.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;' + (hex ? 'opacity:.34' : ''));
  img.addEventListener('error', () => wrap.remove());
  const dim = document.createElement('div');
  dim.setAttribute('style', hex ? 'position:absolute;inset:0;background:rgba(11,13,17,.15)' : 'position:absolute;inset:0;background:rgba(20,17,11,.2)');
  wrap.append(img, dim);
  return wrap;
}

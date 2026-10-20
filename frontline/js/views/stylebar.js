// Persistent Style / Ruleset Switcher Bar for the unified Frontline / Hexwire / Rift engine.
import { h } from '../dom.js';
import { state } from '../state.js';
import { switchStyle } from '../match.js';

const STYLES = [
  {
    id: 'frontline',
    badge: '1918 TRENCHES',
    title: '⚔ FRONTLINE',
    desc: 'Dieselpunk · Positional M/R Artillery · 24 Cards',
    accent: '#c9a227',
    bgActive: '#3a3423',
  },
  {
    id: 'hexwire',
    badge: '2099 STREET MAGIC',
    title: '🎴 HEXWIRE',
    desc: 'Cyberpunk · Overwatch + Subvert/Possess · 26 Cards',
    accent: '#c77dff',
    bgActive: '#1c1829',
  },
  {
    id: 'rift',
    badge: 'CROSSOVER',
    title: '⚡ RIFT WAR',
    desc: 'Hybrid Rules · Positional M/R + Rift Subvert · 26 Cards',
    accent: '#53c7ff',
    bgActive: '#142029',
  },
];

export function styleBar() {
  const cur = state.style;
  const hex = cur === 'hexwire';
  const rift = cur === 'rift';
  const wrapBg = hex ? '#11141c' : rift ? '#1a1524' : '#2f2a1f';
  const wrapBorder = hex ? '#232a36' : rift ? '#362c47' : '#4a422e';

  return h('div', {
    'data-component': 'style-switcher',
    style: `display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;padding:8px;margin-bottom:18px;background:${wrapBg};border:1px solid ${wrapBorder};border-radius:${hex ? '12px' : '2px'}`,
  },
    STYLES.map(s => {
      const active = cur === s.id;
      return h('button', {
        onclick: () => { if (!active) switchStyle(s.id); },
        style: `flex:1 1 200px;text-align:left;padding:9px 12px;background:${active ? s.bgActive : 'transparent'};border:1.5px solid ${active ? s.accent : 'transparent'};border-radius:${hex ? '9px' : '0'};color:${hex ? '#ece8df' : '#e8dfc6'};cursor:pointer;transition:.15s`,
      },
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:6px' },
          h('span', { style: `font:700 14px 'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${active ? s.accent : (hex ? '#9aa3b2' : '#b3a88a')}` }, s.title),
          h('span', { style: `font:700 9px 'IBM Plex Mono',monospace;letter-spacing:.12em;padding:2px 6px;background:${active ? s.accent : 'rgba(255,255,255,.06)'};color:${active ? '#111' : (hex ? '#7c8596' : '#8a8065')}` }, s.badge),
        ),
        h('div', { style: `font:500 10.5px 'IBM Plex Mono',monospace;color:${hex ? '#7c8596' : '#8a8065'};margin-top:3px` }, s.desc),
      );
    }),
  );
}

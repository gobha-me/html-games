import { EDITION_DURATION_SEC } from './config.js';

// Display-only adapter. Fixed grouping keeps messages independent of host locale.
const number = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const signed = (value) => `${value >= 0 ? '+' : ''}${number(value)}`;

export const presentation = {
  clock(seconds) {
    const pct = Math.min(1, Math.max(0, seconds / EDITION_DURATION_SEC));
    const totalMins = Math.floor(pct * 360);
    const hour24 = 18 + Math.floor(totalMins / 60);
    if (hour24 >= 24) return '12:00 AM';
    return `${String(hour24 - 12).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')} PM`;
  },
  seriesBadge: (arc, part) => `${arc.shortCode} · ${part.badge}`,
  leadFlash: (lead) => `WIRE FLASH [${lead.beat}]${lead.seriesBadge ? ` [${lead.seriesBadge}]` : ''}: ${lead.headline}`,
  enRoute: (lead) => `EN ROUTE → ${lead.districtName}`,
  dispatched: (op) => `${op.callsign} DISPATCHED`,
  dispatchLog: (op, lead) => `DISPATCH: ${op.name} (${op.callsign}) en route to ${lead.districtName}.`,
  intercepting: (rival) => `INTERCEPTING ${rival.label}`,
  rivalAlert: (lead) => `RIVAL ALERT: Daily Herald press cruiser racing toward ${lead.districtName} ($${lead.baseValue} ${lead.beat})!`,
  phoneRing: (dilemma) => `☎️ ROTARY PHONE RINGING: ${dilemma.caller} on the night line!`,
  arcPublished: (story, readers) => `INVESTIGATIVE SERIES [${story.arcCode}]: ${story.arcTitle} Part ${story.arcPart}/3 printed (+${number(readers)} readers) — PART ${story.arcPart + 1}/3 UNLOCKED!`,
  arcFinale: (story) => `PULITZER EXPOSÉ FINALE [${story.arcCode}]: ${story.arcTitle} Part 3/3 indicts Syndicate (+4,500 readers, -12% Heat)!`,
  editionPrinted: (edition, readers, cash) => `EDITION #${edition} PRINTED: ${signed(readers)} readers, +$${cash} revenue.`,
  editionBanner: (edition, cash) => `EDITION #${edition} HIT THE STREETS! (+$${cash})`,
  circulationBanner: (circulation, readers, credibility) => `CIRCULATION: ${number(circulation)} (${signed(readers)}) · CREDIBILITY ${credibility}%`,
  assisting: (lead) => `ASSISTING AT ${lead.districtName}`,
  investigating: (lead) => `INVESTIGATING (${Math.floor(lead.progress)}%)`,
  routed: (rival) => `💥 ${rival.type === 'goon' ? 'GOON' : 'HERALD'} ROUTED (+$35)`,
  contested: (lead) => `SCOOP CONTESTED: Daily Herald beat us to ${lead.districtName}! Send Clara [3] for Speed Graphic photo proof to restore full value.`,
  stolen: (lead) => `SCOOP STOLEN: Daily Herald published the ${lead.districtName} exclusive first (-5% Credibility)!`,
  scooped: (lead) => `📰 SCOOPED: +$${lead.baseValue}`,
};

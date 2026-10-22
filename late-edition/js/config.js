import { PALETTE } from './palette.js';
// ============================================================================
// LATE EDITION // 1947 — Noir Metropolis Map, Operatives, Leads & Press Config
// ============================================================================

export const WORLD_W = 1400;
export const WORLD_H = 1000;

export const EDITION_DURATION_SEC = 210; // 6:00 PM -> midnight, about 3½ minutes.
// Stretch deadline-relative pressure windows; keep lead replenishment at 0.65/s
// so dispatch throughput per real minute still follows the original work rates.
export const EDITION_TIME_SCALE = EDITION_DURATION_SEC / 90;
export const LEAD_LIFETIME_SEC = 48 * EDITION_TIME_SCALE;
export const PASTE_UP_START_SEC = EDITION_DURATION_SEC * 5 / 6; // 11 PM: final 35 seconds.
export const ASSIST_READER_PENALTY = 500;
export const EMPTY_BANNER_TRUST_PENALTY = 6;
export const INSIDE_SLOT = Object.freeze({ id: 'inside', mul: 0.25 });
// #86 drawer balance: 6 dossiers, three publishes of shelf life. Five squeezes
// at most: post-increment exposure gives 35/55/75/95/115% burn probability.
// Even a never-burning RNG cannot earn more than $900 per weight-5 fresh file.
// The 20-seed / 20-night bot caps total funds (including ink) at $100,000;
// this is a regression budget, not an artificial gameplay cash clamp.
export const FILE_DRAWER = Object.freeze({
  capacity: 6, freshness: 3, economy20NightCashCeiling: 100000, maxWeight: 5, valuePerWeight: 75,
  cashPerWeightNight: 12, protectionPerWeight: 3,
  burnBase: 0.15, burnPerExposure: 0.2,
  payoff: 120, trustHit: 12, heatSpike: 18,
  burnDelayMin: 1, burnDelayMax: 2, callTimeout: 26,
  advancedMultiplier: 1.5, staleMultiplier: 0.75, tipValue: 260,
});
export const COLD_OPEN_DURATION_SEC = 30;
export const MIN_DESK_WIDTH = 1280;
export const MIN_DESK_HEIGHT = 720;

const UNLOCK_NIGHTS = Object.freeze({
  reporter: 1, photographer: 2, fixer: 3, fortify: 3,
  wiretap: 4, bribe: 4, phone: 4,
});

// Fail closed for malformed nights and unknown features, including prototype keys.
export function isUnlocked(feature, night) {
  return Object.hasOwn(UNLOCK_NIGHTS, feature) && Number.isInteger(night) &&
    night >= UNLOCK_NIGHTS[feature];
}

export function deskFits(width, height) {
  return Number.isFinite(width) && Number.isFinite(height) &&
    width >= MIN_DESK_WIDTH && height >= MIN_DESK_HEIGHT;
}

export const DISTRICTS = [
  {
    id: 'hq',
    name: 'THE EVENING STAR HQ',
    code: 'PRESS ROW',
    x: 590,
    y: 410,
    w: 220,
    h: 165,
    color: PALETTE.smoke,
    accent: PALETTE.sodium,
    neon: 'EVENING STAR // ROTARY PRESS',
    isHQ: true,
  },
  {
    id: 'docks',
    name: 'PIER 14 WATERFRONT',
    code: 'HARBOR WEST',
    x: 80,
    y: 95,
    w: 290,
    h: 220,
    color: PALETTE.nightInk,
    accent: PALETTE.newsprintAged,
    neon: 'ATLANTIC STEVEDORE CO.',
  },
  {
    id: 'cityhall',
    name: 'CITY HALL & COURTS',
    code: 'CIVIC PLAZA',
    x: 520,
    y: 75,
    w: 360,
    h: 185,
    color: PALETTE.nightInk,
    accent: PALETTE.stampRed,
    neon: 'MUNICIPAL COURT // HALL OF RECORDS',
  },
  {
    id: 'redlight',
    name: 'VELVET CLUB & NEON ROW',
    code: 'EAST MIDTOWN',
    x: 1020,
    y: 95,
    w: 295,
    h: 225,
    color: PALETTE.mahogany,
    accent: PALETTE.stampRed,
    neon: 'THE BLUE VELVET // JAZZ & LOUNGE',
  },
  {
    id: 'wallst',
    name: 'EXCHANGE & TRUST BANK',
    code: 'FINANCIAL DIST',
    x: 85,
    y: 675,
    w: 300,
    h: 230,
    color: PALETTE.nightInk,
    accent: PALETTE.newsprintAged,
    neon: 'CONTINENTAL RESERVE TRUST',
  },
  {
    id: 'slaughterhouse',
    name: 'TORRIO MEATPACKING',
    code: 'SOUTH YARDS',
    x: 1010,
    y: 675,
    w: 305,
    h: 230,
    color: PALETTE.mahogany,
    accent: PALETTE.stampRed,
    neon: 'UNION STOCKYARDS // COLD STORAGE',
  },
  {
    id: 'herald_hq',
    name: 'THE DAILY HERALD TOWER',
    code: 'RIVAL PRESS',
    x: 100,
    y: 425,
    w: 195,
    h: 145,
    color: PALETTE.nightInk,
    accent: PALETTE.sodium,
    neon: 'DAILY HERALD (RIVAL)',
    isRival: true,
  },
  {
    id: 'observer_hq',
    name: 'THE OBSERVER SYNDICATE',
    code: 'MOB TABLOID',
    x: 1105,
    y: 425,
    w: 195,
    h: 145,
    color: PALETTE.mahogany,
    accent: PALETTE.stampRed,
    neon: 'THE OBSERVER (SYNDICATE)',
    isRival: true,
  },
];

export const STREETLAMPS = [
  { x: 410, y: 210 },
  { x: 950, y: 210 },
  { x: 420, y: 495 },
  { x: 980, y: 495 },
  { x: 555, y: 365 },
  { x: 845, y: 365 },
  { x: 555, y: 615 },
  { x: 845, y: 615 },
  { x: 420, y: 785 },
  { x: 960, y: 785 },
  { x: 700, y: 310 },
  { x: 700, y: 680 },
];

export const OPERATIVE_ROSTER = [
  {
    id: 'rep_1',
    role: 'reporter',
    roleLabel: 'REPORTER',
    name: 'Jack Vance',
    callsign: 'BEAT-1',
    speed: 148,
    workRate: 1.0,
    sprite: 'reporter',
    color: PALETTE.sodium,
    desc: 'Uncovers leads & writes front-page copy',
  },
  {
    id: 'rep_2',
    role: 'reporter',
    roleLabel: 'REPORTER',
    name: 'Peggy Sullivan',
    callsign: 'BEAT-2',
    speed: 158,
    workRate: 1.15,
    sprite: 'reporter',
    color: PALETTE.sodium,
    desc: 'City Hall specialist — fast witness interviews',
  },
  {
    id: 'photog_1',
    role: 'photographer',
    roleLabel: 'PHOTOGRAPHER',
    name: 'Clara Reyes',
    callsign: 'FLASH-1',
    speed: 152,
    workRate: 1.1,
    sprite: 'photographer',
    color: PALETTE.newsprintAged,
    desc: 'Snaps Speed Graphic photo proof (1.8× story value & stuns goons)',
  },
  {
    id: 'fixer_1',
    role: 'fixer',
    roleLabel: 'STREET FIXER',
    name: '"Knuckles" Malone',
    callsign: 'ENFORCE-1',
    speed: 162,
    workRate: 1.0,
    sprite: 'fixer',
    color: PALETTE.newsprintAged,
    desc: 'Intercepts Herald scoopers & Observer syndicate goons',
  },
];

export const FRONT_PAGE_SLOTS = [
  {
    id: 'banner',
    label: 'SLOT 1 // BANNER HEADLINE',
    mul: 2.0,
    credBonus: 6,
    heatDelta: 8,
  },
  {
    id: 'above_fold',
    label: 'SLOT 2 // ABOVE-THE-FOLD LEAD',
    mul: 1.5,
    credBonus: 4,
    heatDelta: 5,
  },
  {
    id: 'photo_expose',
    label: 'SLOT 3 // DARKROOM PHOTO EXPOSÉ',
    mul: 1.6,
    credBonus: 7,
    heatDelta: 6,
    prefersPhoto: true,
  },
  {
    id: 'editorial',
    label: 'SLOT 4 // BELOW-THE-FOLD COLUMN',
    mul: 1.2,
    credBonus: 5,
    heatDelta: -8,
  },
];

export const STORY_CATALOG = [
  {
    beat: 'GRAFT',
    subject: 'Thomas Bell',
    color: PALETTE.stampRed,
    district: 'cityhall',
    headline: 'MAYOR’S BROTHER TIED TO PHANTOM PAVING PAYROLL',
    subdeck: 'Auditor ledgers name Thomas Bell, the mayor’s brother, on $400,000 in phantom paving vouchers.',
    baseValue: 165,
    credibility: 7,
    heat: 10,
  },
  {
    beat: 'CRIME',
    subject: 'Atlantic Stevedore Co.',
    color: PALETTE.newsprintAged,
    district: 'docks',
    headline: 'MIDNIGHT FREIGHTER UNLOADS UNMARKED CRATES AT PIER 14',
    subdeck: 'Atlantic Stevedore Co. manifests disagree with harbor patrol logs altered before the customs raid.',
    baseValue: 150,
    credibility: 6,
    heat: 9,
  },
  {
    beat: 'SCANDAL',
    subject: 'Vincent Doyle',
    color: PALETTE.stampRed,
    district: 'redlight',
    headline: 'DA’S STAR WITNESS SPOTTED IN BLUE VELVET VIP BOOTH',
    subdeck: 'A flashbulb catches grand-jury witness Vincent Doyle toasting syndicate counsel.',
    baseValue: 180,
    credibility: 8,
    heat: 12,
  },
  {
    beat: 'SYNDICATE',
    subject: 'Torrio Cold Storage',
    color: PALETTE.stampRed,
    district: 'slaughterhouse',
    headline: 'TORRIO COLD-STORAGE VAULT HIDES BOOTLEG PRINTING PLATES',
    subdeck: 'Police seize counterfeit ration stamps and union ballots from the Torrio Cold Storage vault.',
    baseValue: 210,
    credibility: 10,
    heat: 16,
  },
  {
    beat: 'GRAFT',
    subject: 'Continental Reserve Trust',
    color: PALETTE.newsprintAged,
    district: 'wallst',
    headline: 'CONTINENTAL TRUST FUNNELS WAR-SURPLUS BONDS TO SHELL CORP',
    subdeck: 'Three Continental Reserve Trust vice-presidents signed the midnight bearer transfers.',
    baseValue: 175,
    credibility: 8,
    heat: 11,
  },
  {
    beat: 'CRIME',
    subject: 'Frank Keane',
    subjectStatus: 'dead',
    color: PALETTE.newsprintAged,
    district: 'docks',
    headline: 'LONGSHOREMEN TREASURER FOUND FLOATING NEAR TUG SLIP 9',
    subdeck: 'Treasurer Frank Keane’s pension key was missing from his overcoat when police found the body.',
    baseValue: 160,
    credibility: 7,
    heat: 11,
  },
  {
    beat: 'SCANDAL',
    subject: 'Commissioner Walter Rusk',
    color: PALETTE.stampRed,
    district: 'cityhall',
    headline: 'ZONING COMMISSIONER FLIPS SUBWAY CONDEMNATION DEEDS',
    subdeck: 'Commissioner Walter Rusk’s associates bought Crosstown parcels two days before the vote.',
    baseValue: 170,
    credibility: 8,
    heat: 9,
  },
  {
    beat: 'SYNDICATE',
    subject: 'Captain Daniel Horgan',
    color: PALETTE.stampRed,
    district: 'redlight',
    headline: 'WIRE-TAP REVEALS POLICE CAPTAIN ON VELVET ROOM RETAINER',
    subdeck: 'Captain Daniel Horgan’s switchboard warned the bookmakers ten minutes before each raid.',
    baseValue: 205,
    credibility: 11,
    heat: 15,
  },
  {
    beat: 'GRAFT',
    subject: 'Fidelity Underwriters',
    color: PALETTE.newsprintAged,
    district: 'wallst',
    headline: 'INSURANCE SYNDICATE TORCHES WAREHOUSE FOR DOUBLE CLAIM',
    subdeck: 'Fidelity Underwriters buried the fire report after its adjuster took an Exchange board seat.',
    baseValue: 185,
    credibility: 8,
    heat: 12,
  },
  {
    beat: 'SYNDICATE',
    subject: 'The Observer Syndicate',
    color: PALETTE.stampRed,
    district: 'slaughterhouse',
    headline: 'OBSERVER TRUCKS CAUGHT RUNNING ARMS UNDER NEWSPRINT ROLLS',
    subdeck: 'The Observer Syndicate delivery fleet carries Torrio’s crates beneath bundles of papers.',
    baseValue: 225,
    credibility: 12,
    heat: 18,
  },
];

export const INVESTIGATIVE_ARCS = [
  {
    id: 'red_hook',
    subject: 'Atlantic Stevedore Co.',
    title: 'RED HOOK DOCKSIDE SYNDICATE',
    shortCode: 'ARC A',
    parts: [
      {
        part: 1,
        badge: 'SERIES PART I/III',
        district: 'docks',
        beat: 'CRIME',
        subject: 'Atlantic Stevedore Co.',
        color: PALETTE.newsprintAged,
        headline: 'SMUGGLED MORPHINE CRATES SEIZED AT PIER 14',
        subdeck: 'Customs men find Atlantic Stevedore Co. manifest tags forged under a dummy union local.',
        baseValue: 185,
        credibility: 8,
        heat: 10,
      },
      {
        part: 2,
        badge: 'SERIES PART II/III',
        district: 'wallst',
        beat: 'GRAFT',
        subject: 'Atlantic Stevedore Co.',
        color: PALETTE.newsprintAged,
        headline: 'WALL ST. SHELL TRUST LAUNDERS PIER 14 CONTRABAND PAYOFFS',
        subdeck: 'Atlantic Stevedore Co. checks link the dock bosses to an alderman’s escrow account.',
        baseValue: 225,
        credibility: 10,
        heat: 14,
      },
      {
        part: 3,
        badge: 'SERIES FINALE III/III',
        district: 'slaughterhouse',
        beat: 'SYNDICATE',
        subject: 'Atlantic Stevedore Co.',
        color: PALETTE.stampRed,
        headline: 'GRAND JURY INDICTS DOCK SYNDICATE CZAR IN SLAUGHTERHOUSE RAID',
        subdeck: 'Federal men seize Atlantic Stevedore Co. warehouses after the Evening Star investigation.',
        baseValue: 290,
        credibility: 14,
        heat: 18,
      },
    ],
  },
  {
    id: 'transit_graft',
    subject: 'Municipal Transit Commission',
    title: 'CITY HALL TRANSIT KICKBACKS',
    shortCode: 'ARC B',
    parts: [
      {
        part: 1,
        badge: 'SERIES PART I/III',
        district: 'cityhall',
        beat: 'GRAFT',
        subject: 'Municipal Transit Commission',
        color: PALETTE.stampRed,
        headline: 'MIDNIGHT SHREDDING PARTY CAUGHT IN MUNICIPAL TRANSIT ANNEX',
        subdeck: 'A janitor rescues Municipal Transit Commission paving bids from the basement furnace.',
        baseValue: 180,
        credibility: 8,
        heat: 9,
      },
      {
        part: 2,
        badge: 'SERIES PART II/III',
        district: 'redlight',
        beat: 'SCANDAL',
        subject: 'Municipal Transit Commission',
        color: PALETTE.stampRed,
        headline: 'TRANSIT COMMISSIONER CAUGHT AT BLUE VELVET WITH MOB PAYMASTER',
        subdeck: 'A Municipal Transit Commission satchel changes hands in booth four of the Blue Velvet.',
        baseValue: 230,
        credibility: 11,
        heat: 14,
      },
      {
        part: 3,
        badge: 'SERIES FINALE III/III',
        district: 'cityhall',
        beat: 'GRAFT',
        subject: 'Municipal Transit Commission',
        color: PALETTE.stampRed,
        headline: 'SPECIAL PROSECUTOR SUBPOENAS MAYOR’S TRANSIT SLUSH LEDGER',
        subdeck: 'The Municipal Transit Commission must account for $1.2 million in phantom streetcar funds.',
        baseValue: 285,
        credibility: 14,
        heat: 16,
      },
    ],
  },
  {
    id: 'tenement_torch',
    subject: 'Fidelity Underwriters',
    title: 'TENEMENT TORCH RING',
    shortCode: 'ARC C',
    parts: [
      {
        part: 1,
        badge: 'SERIES PART I/III',
        district: 'slaughterhouse',
        beat: 'CRIME',
        subject: 'Fidelity Underwriters',
        color: PALETTE.stampRed,
        headline: 'KEROSENE DRUMS FOUND IN TORCHED FOURTH WARD TENEMENT CELLAR',
        subdeck: 'Fire marshals trace the east-block policies to Fidelity Underwriters.',
        baseValue: 175,
        credibility: 8,
        heat: 11,
      },
      {
        part: 2,
        badge: 'SERIES PART II/III',
        district: 'wallst',
        beat: 'GRAFT',
        subject: 'Fidelity Underwriters',
        color: PALETTE.newsprintAged,
        headline: 'FIDELITY UNDERWRITERS TRIPLED POLICIES DAYS BEFORE TENEMENT BLAZE',
        subdeck: 'Fidelity Underwriters paid double indemnity to a holding company owned by Torrio’s nephew.',
        baseValue: 220,
        credibility: 10,
        heat: 13,
      },
      {
        part: 3,
        badge: 'SERIES FINALE III/III',
        district: 'cityhall',
        beat: 'SYNDICATE',
        subject: 'Fidelity Underwriters',
        color: PALETTE.stampRed,
        headline: 'ARSON RING KINGPINS ARRESTED ON COURTHOUSE STEPS AT DAWN',
        subdeck: 'A signed confession names six fire inspectors and the Fidelity Underwriters bagman.',
        baseValue: 280,
        credibility: 15,
        heat: 17,
      },
    ],
  },
];


export const EDITORIAL_DILEMMAS = [
  {
    id: 'da_hold',
    caller: 'DISTRICT ATTORNEY’S OFFICE // NIGHT LINE',
    prompt:
      '"Lou, Assistant DA Mercer here. Hold your Pier 14 Syndicate story 24 hours so our detectives can raid the slip before the mob bolts."',
    acceptLabel: '[Y] COOPERATE (+$140 · +6% TRUST · -15% HEAT)',
    rejectLabel: '[N] RUN EXPOSÉ (+2,800 READERS · +14% HEAT)',
    acceptEffect: {
      cash: 140,
      circulation: 0,
      credibility: 6,
      heat: -15,
      wire: 'ROTARY PHONE: Held Syndicate brief for DA raid (+$140 Municipal Stipend, +6% Credibility, -15% Heat).',
    },
    rejectEffect: {
      cash: 0,
      circulation: 2800,
      credibility: 4,
      heat: 14,
      wire: 'ROTARY PHONE: Defied DA hold request — street sales surge (+2,800 Readers, +14% Syndicate Heat)!',
    },
  },
  {
    id: 'advertiser_threat',
    caller: 'VANDERBILT DEPT. STORE // AD ACCOUNT',
    prompt:
      '"Our board chairman sits on the Municipal Transit Commission! Kill that City Hall graft headline or we pull our $160 full-page Sunday display ad!"',
    acceptLabel: '[Y] APPEASE SPONSOR (+$160 AD · -9% TRUST)',
    rejectLabel: '[N] DEFY SPONSOR (-$75 AD · +12% TRUST · +2,200 RDRS)',
    acceptEffect: {
      cash: 160,
      circulation: -600,
      credibility: -9,
      heat: -6,
      wire: 'ROTARY PHONE: Appeased display advertiser (+$160 Ad Contract, -9% Credibility).',
    },
    rejectEffect: {
      cash: -75,
      circulation: 2200,
      credibility: 12,
      heat: 6,
      wire: 'ROTARY PHONE: Refused advertiser censorship (+12% Public Trust, +2,200 Readers, -$75 Ad Pull)!',
    },
  },
  {
    id: 'payphone_tipster',
    caller: 'WET PAYPHONE BOOTH // PIER 9 WHISTLEBLOWER',
    prompt:
      '"Don’t trace this call! I have carbon-copy payroll vouchers from the Alderman’s safe. Slip $85 to the newsstand clerk at 4th & Pine and they’re yours."',
    acceptLabel: '[Y] BUY VOUCHERS (-$85 · +2,500 RDRS · +8% TRUST)',
    rejectLabel: '[N] HANG UP ($0 · +3% TRUST)',
    acceptEffect: {
      cash: -85,
      circulation: 2500,
      credibility: 8,
      heat: 10,
      wire: 'ROTARY PHONE: Bought whistleblower carbon ledgers (-$85, +2,500 Readers, +8% Credibility)!',
    },
    rejectEffect: {
      cash: 0,
      circulation: 0,
      credibility: 3,
      heat: -4,
      wire: 'ROTARY PHONE: Passed on unverified payphone tipster (+3% Credibility).',
    },
  },
];

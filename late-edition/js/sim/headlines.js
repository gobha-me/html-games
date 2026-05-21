// Late Edition — slot-grammar headline synthesizer (Design Doc §18 line 1359+).
// Replaces the placeholder `${flavor} ${tier} HITS WIRE` line in world-state.js
// (audit G-05). One headline per Story shown in the EditionSummary digest +
// the run-summary panel's top-headline readout.
//
// Grammar shape (§18):
//   {DISTRICT-ACTOR} {FLAVOR-VERB} {OBJECT} → "DOCKHAND TIPS MAYOR" / "BANKER ROCKS CITY HALL"
// The verb table is tagged by flavor (vice / violence / money) per §18's
// "verbs are tagged by category; each category implies a base heat cost so
// headlines feel honest". The heat cost itself stays in resources.js
// HEAT_BY_FLAVOR — the verb just picks a register that matches the cost.
//
// Determinism: the synth takes a SeededRng. Same Story + same rng state →
// same headline. The world hands the spawner's rng through `_buildEdition
// Summary` so re-rendering the debrief panel after a save round-trip
// produces the same strings.

import { getDistrict, pickFromList } from './districts.js';

// Verb tables — per flavor (Design Doc §19 HEAT_BY_FLAVOR shape:
// vice / violence / money / labor). Labor verbs fall back to vice tone
// since §19 doesn't elaborate; labor stories are rare at Tier-0.
const VERBS_BY_FLAVOR = {
  vice:     ['TIPS', 'BUYS OFF', 'BLACKMAILS', 'COVERS FOR', 'NAMES'],
  violence: ['CLUBS', 'JUMPS', 'GUNS DOWN', 'SLUGS', 'KNIFES'],
  money:    ['BRIBES', 'SHAKES DOWN', 'FLEECES', 'PAYS OFF', 'AUDITS'],
  labor:    ['WALKS OUT ON', 'STRIKES AT', 'PICKETS', 'ORGANIZES AGAINST'],
};

// Objects — district-flavored. Tier-0 uses a small shared pool; districts
// expand it with their actor pool so e.g. Hillside leans heir/mayor/judge.
const SHARED_OBJECTS = [
  'CITY HALL',
  'THE COMMISSIONER',
  'PRECINCT HOUSE',
  'THE COURTHOUSE',
  'THE WIRE',
  'THE GRAND JURY',
];

// Tier suffix — tier carries a register cue at the front for the debrief
// panel readout. Whisper stays bare; Investigation calls it out; Arc-tagged
// (remapped to investigation at Tier-0 by the spawner) marks the rare
// hand-written chains for the §18 Tier-1 grammar.
const TIER_PREFIX = {
  whisper:       '',
  investigation: 'EXCLUSIVE · ',
  arc:           'FRONT PAGE · ',
};

export function synthesizeHeadline(story, rng) {
  const district = getDistrict(story.district);
  const actorPool = district?.actorPool ?? ['CITIZEN'];
  const actor = pickFromList(actorPool, rng) ?? 'CITIZEN';
  const verbs = VERBS_BY_FLAVOR[story.flavor] ?? VERBS_BY_FLAVOR.vice;
  const verb = pickFromList(verbs, rng) ?? 'NAMES';
  // Objects mix district actors with the shared civic-target pool so
  // Hillside headlines like "MAYOR BRIBES HEIRESS" stay in-flavor.
  const objectPool = [...SHARED_OBJECTS, ...actorPool.filter((a) => a !== actor)];
  const object = pickFromList(objectPool, rng) ?? 'CITY HALL';
  const prefix = TIER_PREFIX[story.tier] ?? '';
  return `${prefix}${actor} ${verb} ${object}`;
}

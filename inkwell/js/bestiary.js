import { subRng } from './rng.js';
import { ENEMY_STATS, BOSS_STATS, KIND } from './constants.js';

const ENTRIES = {
  drip: {
    clinical: [
      'A coherent ink stain that travels under its own surface tension. Aggressive on contact but fragile — a single bite of the quill resolves it.',
      'The most common margin-creature, found wherever a careless scribe set a pot too near the edge of the desk.',
      'Slow at rest. Alarmingly direct in pursuit.',
      'Damage is low; numbers are not. They favour open rooms and corner pile-ups.',
      'A drip carries the weight of whatever pot it fell from. Younger inks splatter; older inks bite.',
    ],
    folkloric: [
      'The old scribes called them careless words made flesh. They drift where there is warmth, mistaking parchment for skin.',
      'Children of the inkwell, born when a quill is tilted in distraction.',
      'Once they were punctuation. Now they are intent.',
      'They mistake themselves for full stops, and you for the next sentence.',
      'If you step on one and it does not splatter, look up. The pot you forgot is dripping.',
    ],
    quote: [
      'from *Margin Faults*, anon: "It will absorb you, and you will be a footnote."',
      "*Brother Aldine's Errata, fol. 4r:* \"They are nothing — until they are between you and the page.\"",
    ],
  },
  smear: {
    clinical: [
      'A drip that has aged: dense, slow, hard to dispatch. Higher HP, the same low intent.',
      'Smears form when a drip is dragged across the page by a hand or a hem. The size of a smear is roughly proportional to the speed of the hand.',
      'Resistant to a single quill bite; two or three is usually adequate.',
      'Lacks the directness of fresh ink — it remembers having been moved.',
      'Found grouped with drips, often in corridors where someone wiped their hand.',
    ],
    folkloric: [
      'The corpses of ink that were not given time to set. They remember being dragged, and they do not forgive.',
      'Smears are what happens when a margin-creature dies on the way to its purpose.',
      'Look for them where the parchment is creased — they fold along the seam of a careless turn.',
      'Older readers will tell you a smear can be read, if you stand at the right angle.',
    ],
    quote: [
      '*Frontispiece marginalia, plate iv:* "Even the smear has a direction. Mind which way it points."',
    ],
  },
  scrawl: {
    clinical: [
      'A glyph half-formed into intent. Low HP, but its attack is sharper than its body suggests.',
      'Scrawls move with the speed of an unfinished thought.',
      'They are usually solitary, and they are usually wrong.',
      'Susceptible to the quill in equal measure as they are dangerous to it.',
      'A scrawl will not flank; it will charge. This is sometimes useful.',
    ],
    folkloric: [
      'Each scrawl is a word someone meant to write and lost faith in.',
      'They have the shape of letters and the temperament of accidents.',
      'Beware the scrawl with five strokes. Five strokes mean it almost meant something.',
      'They were once attempts. Attempts have edges.',
    ],
    quote: [
      '*Anonymous margin gloss:* "A scrawl knows what it is. It is angry about being seen."',
    ],
  },
  marginalia: {
    clinical: [
      'An annotation that has slipped its tether. Small, fast, low in HP, but persistent at close range.',
      'Marginalia gather where another reader was — they like the warm seat of attention.',
      'Common at deeper pages where the original author no longer corrects the gloss.',
      'Dispatched in one quill stroke, but rarely alone.',
    ],
    folkloric: [
      "The remains of someone else's notes — they have outlived their reader, and now they want yours.",
      'Marginalia are jealous of the text. They want to be the text.',
      'When a marginal becomes feral, it is usually because nobody listened to it.',
      'They carry small, sharp opinions and no compass.',
    ],
    quote: [
      "*A reader's note found bound in to a later edition:* \"I disagree.\" (Hand of unknown gentleman, c. uncertain.)",
    ],
  },
  foxing: {
    clinical: [
      'Rust-brown stains that move slowly and heal the ink near them. Low attack, high attrition value.',
      'Foxings do not pursue. They occupy.',
      'The aura range is one tile in every direction. Stand outside it; close from outside it; finish them before the next drip arrives.',
      'Heals are weak per turn but compound. A foxing in a corridor of drips is a problem that gets worse.',
    ],
    folkloric: [
      'Old ink remembers being together with other old ink. The foxing remembers most of all.',
      'Where damp has settled into the binding, the foxing follows.',
      'They are the page learning to take care of itself.',
      'A scribe who knows the foxing kills it first.',
    ],
    quote: [
      '*Marginal note in a forgotten codex:* "The rust is not the enemy. The rust is the friend of the enemy."',
    ],
  },
  erratum: {
    clinical: [
      'An errata-mark that refuses to stay corrected. Teleports adjacent to the player every four turns. Mid-attack value but unpredictable positioning.',
      'Erratta are the ghosts of mistakes — they were supposed to have been crossed out.',
      'They do not navigate; they appear.',
      'Bound or sealed, an erratum is merely an exclamation. Loose, it is geography.',
      'Found only on the deepest pages, where the corrections were never bound in.',
    ],
    folkloric: [
      'A misprinted reflection that found its way out of the appendix.',
      'Wherever the text was corrected too late, an erratum waits.',
      'It looks like a punctuation mark and behaves like a wound.',
      'The erratum carries the memory of being wrong, and resents it.',
    ],
    quote: [
      '*From the suppressed colophon of an unknown work:* "Errata: see appendix. Appendix missing."',
    ],
  },
  boss_margin_lord: {
    clinical: [
      'The first boss of the grimoire. Heavy, slow, direct. Halves the player\'s mobility by sheer presence.',
      'Stats scale by tier; at page 5 it is reasonably parable — high HP, hard hits, no special protection.',
      'Carries no glyph; opens no door. The Margin-Lord exists only to block your descent.',
    ],
    folkloric: [
      'The Margin-Lord rules the margins of the grimoire. It does not write — it edits.',
      'It is the gravity of the page. Things fall toward it; very few rise.',
      'It is said that the first scribe of this book apprenticed under the Margin-Lord, and it shows in the margins of every page.',
      'The Margin-Lord remembers each strikethrough it has ever earned.',
    ],
    quote: [
      '*From the index of a book without an index:* "Margin-Lord. See: everywhere."',
    ],
  },
  boss_frontispiece: {
    clinical: [
      'Stationary boss occupying the stair-tile of page 10. Bleeds a drip every three turns; halves bump-attack damage from the player until its title is erased.',
      'Cast Erase on the Frontispiece. The boss does not move. You will have time.',
      'After erasure the boss is mathematically ordinary; before erasure it is mathematically a wall.',
    ],
    folkloric: [
      'The Frontispiece is the face the book wears to be opened. Without its title, the book does not know who it is.',
      'It is said that to erase the title of a book is to read it in good faith.',
      'Its drip-children are not allies — they are the title\'s spilled letters trying to climb back.',
      'An old illuminator\'s caution: "The first page is a door; treat it like one."',
    ],
    quote: [
      '*Anonymous frontispiece, dated never:* "Open carefully. The book is in the title."',
    ],
  },
  boss_colophon: {
    clinical: [
      'The final boss of the grimoire. Pursues at standard speed; large HP pool; high attack. No special defenses.',
      'Killing the Colophon ends the run with the win-state — there is no page 16 in this edition.',
      'Plain math. End of the book.',
    ],
    folkloric: [
      'The Colophon is the last word a book ever says about itself.',
      'It carries the date, the place, and the printer\'s mark. It does not carry mercy.',
      'After this, there is the blank page.',
      'It is the only margin-creature that says its own name as it strikes.',
      'When a Colophon falls, the book closes; when the book closes, it does not always reopen.',
    ],
    quote: [
      '*From the colophon of an unfinished manuscript:* "Here ends the work, but not the page."',
    ],
  },
};

const QUOTE_CHANCE = 0.3;

export function knownKinds() {
  return Object.keys(ENTRIES);
}

export function displayName(kind) {
  if (ENEMY_STATS[kind]) return ENEMY_STATS[kind].name;
  if (BOSS_STATS[kind]) return BOSS_STATS[kind].name;
  return kind;
}

export function isBossKind(kind) {
  return !!BOSS_STATS[kind];
}

export function composeBestiaryEntry(seed, kind, bossRecord) {
  const data = ENTRIES[kind];
  if (!data) return '';
  const rng = subRng(seed, 'bestiary:' + kind);
  const paragraphs = [];
  paragraphs.push(rng.pick(data.clinical));
  paragraphs.push(rng.pick(data.folkloric));
  if (data.quote && data.quote.length && rng.chance(QUOTE_CHANCE)) {
    paragraphs.push(rng.pick(data.quote));
  }
  if (bossRecord) {
    paragraphs.push(`*Defeated on page ${bossRecord.depth}, turn ${bossRecord.turn}.*`);
  }
  return paragraphs.join('\n\n');
}

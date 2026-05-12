// Per-faction voice for diplomacy log lines (Phase 3 S9a).
//
// The Cogfall moat is the consistent literary-steampunk register layered
// over every player-facing surface. Diplomacy events are some of the
// loudest of those surfaces — a tech trade, a refused tribute, a sold
// secret all want to speak in the *acting* faction's voice rather than
// in a generic "X buys Y from Z" template.
//
// Anchors per AGENTS.md → "The voice is the moat":
//   - Aetheric Order : ratios, proofs, lattices, auguries
//   - Coalition of Coin : ledgers, counting-house, contracts
//   - Iron Legion : martial imperatives, edicts, the drum
//   - Verdant Pact : seasons, roots, growth, the moss
//   - Cogwright Guild : mechanism, gears, ratchets, tooled work
//
// Each `Voice` is keyed by event:
//   - weBought / weReceivedTribute / ourTributeRefused : the *acting*
//     faction speaks about itself in third person (AI events emitted
//     from diploAI.ts).
//   - sellTech / sellAether / payTribute : the *target* faction speaks
//     about its own assent to a player-initiated offer.
//   - refuseTradeTooLow / refuseTradeHostile / refuseTributeDefiant /
//     refuseTributeUnafraid : the *target* speaks about its own refusal.
//
// Defaults (the `genericVoice` block at the bottom) exist so a new
// faction added to FACTIONS without a voice entry still produces
// readable lines. Don't rely on the defaults for the five shipped
// factions — they each have a hand-authored block.

import type { FactionId } from './factions';

export interface Voice {
  /** AI bought a tech. Speaker = the buyer (this faction). */
  weBought: (sellerName: string, techName: string, gold: number) => string;
  /** AI demanded tribute and it was paid. Speaker = the demander. */
  weReceivedTribute: (payerName: string, gold: number) => string;
  /** AI demanded tribute and was refused. Speaker = the demander. */
  ourTributeRefused: (refuserName: string) => string;
  /** Player bought a tech from this faction. Speaker = this faction. */
  sellTech: (techName: string, gold: number) => string;
  /** Player bought aether from this faction. Speaker = this faction. */
  sellAether: (amount: number, gold: number) => string;
  /** Player demanded and got tribute. Speaker = this faction (the payer). */
  payTribute: (gold: number) => string;
  /** Player's trade offer refused — price too low. Speaker = this faction. */
  refuseTradeTooLow: () => string;
  /** Player's trade refused — at war / unmet. Speaker = this faction. */
  refuseTradeHostile: () => string;
  /** Player's tribute demand refused — defiance. Speaker = this faction. */
  refuseTributeDefiant: () => string;
  /** Player's tribute demand refused — not credibly threatened. */
  refuseTributeUnafraid: () => string;
}

const aetheric: Voice = {
  weBought: (seller, tech, gold) =>
    `The Aetheric Order draws ${tech} from ${seller}'s vaults — ${gold} gold to close the proof they could not derive alone.`,
  weReceivedTribute: (payer, gold) =>
    `${payer} concedes the ratio: ${gold} gold flows to the Order's coffers.`,
  ourTributeRefused: (refuser) =>
    `${refuser} miscounts the proof and refuses the Order's demand.`,
  sellTech: (tech, gold) =>
    `The Order parts with ${tech} — ${gold} gold balances the equation, for now.`,
  sellAether: (amount, gold) =>
    `The Order draws ${amount} aether from the lattice; ${gold} gold flows back along the same lines.`,
  payTribute: (gold) =>
    `The Order pays ${gold} gold under protest — a variable held constant while the calculation proceeds.`,
  refuseTradeTooLow: () =>
    `The Order's adepts shake their heads — your offer falls below ratio. They want more.`,
  refuseTradeHostile: () =>
    `The Order will not parse trade through enemy lines.`,
  refuseTributeDefiant: () =>
    `The Order weighs the equation and finds defiance sustainable. They pay nothing.`,
  refuseTributeUnafraid: () =>
    `The Order's auguries find no edge in your favour; they ignore the demand.`,
};

const coin: Voice = {
  weBought: (seller, tech, gold) =>
    `The Coalition of Coin enters ${tech} in the great ledger — ${gold} gold paid out to ${seller}, debt closed.`,
  weReceivedTribute: (payer, gold) =>
    `${payer}'s seal is set to a fresh contract: ${gold} gold remitted to the Coalition's counting-house.`,
  ourTributeRefused: (refuser) =>
    `${refuser} returns the Coalition's writ unsigned. The ledger remembers.`,
  sellTech: (tech, gold) =>
    `The Coalition sells ${tech} on standard terms — ${gold} gold, contract closed, no second draught.`,
  sellAether: (amount, gold) =>
    `The Coalition releases ${amount} aether against ${gold} gold — a clean entry, both columns balanced.`,
  payTribute: (gold) =>
    `The Coalition pays ${gold} gold under duress — and writes the line in red, for later.`,
  refuseTradeTooLow: () =>
    `The Coalition's clerks tap the column. Your number is short; raise it or take your custom elsewhere.`,
  refuseTradeHostile: () =>
    `The Coalition does not open the books to those at war with it.`,
  refuseTributeDefiant: () =>
    `The Coalition's syndics read your demand, laugh, and file it under "vexatious".`,
  refuseTributeUnafraid: () =>
    `The Coalition writes the cost of paying you, and the cost of ignoring you. The columns favour silence.`,
};

const iron: Voice = {
  weBought: (seller, tech, gold) =>
    `The Iron Legion strips ${tech} from ${seller}'s armouries — ${gold} gold, paid in full and remembered.`,
  weReceivedTribute: (payer, gold) =>
    `${payer} kneels: ${gold} gold delivered under the Legion's drums.`,
  ourTributeRefused: (refuser) =>
    `${refuser} answers the Legion's edict with steel. The drums begin again.`,
  sellTech: (tech, gold) =>
    `The Legion grants you ${tech} — ${gold} gold, an oath of arms, and a warning to use it well.`,
  sellAether: (amount, gold) =>
    `The Legion's quartermasters release ${amount} aether to your column — ${gold} gold, count it true.`,
  payTribute: (gold) =>
    `The Legion pays ${gold} gold — and marks the day in the muster-roll.`,
  refuseTradeTooLow: () =>
    `The Legion's captains spit. The price is an insult; bring iron's worth in coin or leave.`,
  refuseTradeHostile: () =>
    `The Legion does not bargain across a drawn line.`,
  refuseTributeDefiant: () =>
    `The Legion answers your demand by drawing steel. They pay in nothing but warning.`,
  refuseTributeUnafraid: () =>
    `The Legion measures your banners against theirs and finds you small. The drums do not even sound.`,
};

const verdant: Voice = {
  weBought: (seller, tech, gold) =>
    `The Verdant Pact takes ${tech} from ${seller}'s groves — ${gold} gold left in the offering-bowl.`,
  weReceivedTribute: (payer, gold) =>
    `${payer}'s tribute reaches the Pact: ${gold} gold, fed back into the moss.`,
  ourTributeRefused: (refuser) =>
    `${refuser} will not bend; the Pact's envoys return with empty hands and a longer memory.`,
  sellTech: (tech, gold) =>
    `The Pact yields ${tech} like a seed in season — ${gold} gold returns to the roots in turn.`,
  sellAether: (amount, gold) =>
    `The Pact draws ${amount} aether from the wellsprings — ${gold} gold returns through the same channels.`,
  payTribute: (gold) =>
    `The Pact pays ${gold} gold — bitter season, brief season, the forest will outlast it.`,
  refuseTradeTooLow: () =>
    `The Pact's elders bow their heads. The offer does not match the soil it was grown in. Return when it does.`,
  refuseTradeHostile: () =>
    `The Pact will not share its harvest with a tiller who burns the field.`,
  refuseTributeDefiant: () =>
    `The Pact stands in the grove and refuses. Take the gold from us if you can — but the roots are old, and they hold.`,
  refuseTributeUnafraid: () =>
    `The Pact watches your banners pass and does not stir. There is no winter in your shadow.`,
};

const cogwright: Voice = {
  weBought: (seller, tech, gold) =>
    `The Cogwright Guild fits ${tech} into the assembly — ${gold} gold to ${seller}, gear meshed, ratchet locked.`,
  weReceivedTribute: (payer, gold) =>
    `${payer}'s tribute clinks through the Guild's gate: ${gold} gold, tallied, racked, and counted twice.`,
  ourTributeRefused: (refuser) =>
    `${refuser} refuses the Guild's writ. The mainspring is wound tighter for it.`,
  sellTech: (tech, gold) =>
    `The Guild releases ${tech} from its workshops — ${gold} gold, the mechanism is yours; mind the tolerances.`,
  sellAether: (amount, gold) =>
    `The Guild draws ${amount} aether from the vials and seals them for transport. ${gold} gold completes the order.`,
  payTribute: (gold) =>
    `The Guild pays ${gold} gold — every coin tooled, every coin noted, every coin to be answered for.`,
  refuseTradeTooLow: () =>
    `The Guild's masters lay down the calipers. Your figure does not meet specification. Adjust and resubmit.`,
  refuseTradeHostile: () =>
    `The Guild does not open the workshop to those who jam its gears.`,
  refuseTributeDefiant: () =>
    `The Guild's wardens turn the demand to scrap and feed it back into the forge.`,
  refuseTributeUnafraid: () =>
    `The Guild reads your strength against the engine's load and finds it under tolerance. The demand is shelved.`,
};

const VOICE_BY_FACTION: Record<FactionId, Voice> = {
  aetheric,
  coin,
  iron,
  verdant,
  cogwright,
};

/** Functional fallback in case a future FactionId lacks a voice block.
 *  All five shipped factions have entries above — this exists so a
 *  modder or a Phase-3-Tier-5 expansion adding a sixth faction
 *  doesn't produce undefined-line log entries. */
const genericVoice: Voice = {
  weBought: (seller, tech, gold) =>
    `They acquired ${tech} from ${seller} for ${gold} gold.`,
  weReceivedTribute: (payer, gold) =>
    `${payer} paid ${gold} gold in tribute.`,
  ourTributeRefused: (refuser) => `${refuser} refused the tribute demand.`,
  sellTech: (tech, gold) => `They sold ${tech} for ${gold} gold.`,
  sellAether: (amount, gold) => `They shipped ${amount} aether for ${gold} gold.`,
  payTribute: (gold) => `They paid ${gold} gold in tribute.`,
  refuseTradeTooLow: () => `They refuse — your offer is too low.`,
  refuseTradeHostile: () => `They will not deal with you.`,
  refuseTributeDefiant: () => `They refuse to pay tribute.`,
  refuseTributeUnafraid: () => `They do not fear you enough to pay tribute.`,
};

export function getDiplomacyVoice(id: FactionId): Voice {
  return VOICE_BY_FACTION[id] ?? genericVoice;
}

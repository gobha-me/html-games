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

export type TradeAgreementBreakReason =
  | 'completed'
  | 'failed_to_deliver'
  | 'failed_to_pay'
  | 'war'
  | 'cancelled'
  | 'partner_lost';

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
  // --- S9b: persistent treaties ----------------------------------------
  /** AI-initiated alliance formed. Speaker = the proposer (this faction). */
  proposeAlliance: (partnerName: string, enemyName: string) => string;
  /** Player proposed an alliance; speaker accepts. Speaker = this faction. */
  acceptAlliance: (partnerName: string, enemyName: string) => string;
  /** Player proposed an alliance; speaker refuses. Speaker = this faction. */
  refuseAlliance: (partnerName: string, enemyName: string) => string;
  /** Alliance breaks (peace was struck with the named enemy). Speaker =
   *  the side describing the breakage (the faction that sued peace or
   *  the partner watching it happen). */
  allianceBroken: (partnerName: string, enemyName: string) => string;
  /** AI-initiated trade agreement formed. Speaker = the proposer. */
  proposeTradeAgreement: (
    partnerName: string,
    amount: number,
    gold: number,
    turns: number
  ) => string;
  /** Player proposed an agreement; speaker accepts. */
  acceptTradeAgreement: (
    partnerName: string,
    amount: number,
    gold: number,
    turns: number
  ) => string;
  /** Player proposed an agreement; speaker refuses. */
  refuseTradeAgreement: (partnerName: string) => string;
  /** A persistent trade agreement ended. Speaker = the faction noting
   *  the event from its side; reason discriminates the flavor. */
  tradeAgreementBroken: (partnerName: string, reason: TradeAgreementBreakReason) => string;
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
  proposeAlliance: (partner, enemy) =>
    `The Aetheric Order proves common ratio with ${partner} against ${enemy} — banners drawn together along the lattice.`,
  acceptAlliance: (partner, enemy) =>
    `The Order assents to ${partner}'s proof: with them, against ${enemy}, the equation holds.`,
  refuseAlliance: (partner, _enemy) =>
    `The Order reads ${partner}'s proposal and finds the ratios uncertain. They will not bind themselves.`,
  allianceBroken: (partner, enemy) =>
    `The pact with ${partner} against ${enemy} fails its proof and unravels.`,
  proposeTradeAgreement: (partner, amount, gold, turns) =>
    `The Order opens a steady current from ${partner}: ${amount} aether per turn against ${gold} gold, ${turns} cycles in all.`,
  acceptTradeAgreement: (partner, amount, gold, turns) =>
    `The Order assents to ${partner}'s contract: ${amount} aether per turn at ${gold} gold, balanced across ${turns} cycles.`,
  refuseTradeAgreement: (partner) =>
    `The Order's calculations leave no room for ${partner}'s proposal.`,
  tradeAgreementBroken: (partner, reason) => {
    switch (reason) {
      case 'completed':
        return `The Order's contract with ${partner} runs its course — the lattice was balanced, the ledger settled.`;
      case 'failed_to_deliver':
        return `The Order's aether stores fall short — the contract with ${partner} dissolves under the strain.`;
      case 'failed_to_pay':
        return `${partner}'s gold falters; the Order closes the contract.`;
      case 'war':
        return `The Order severs the line to ${partner} under banners drawn.`;
      case 'cancelled':
        return `The Order withdraws from its contract with ${partner}.`;
      case 'partner_lost':
        return `${partner} is no more; the Order's contract joins the void.`;
    }
  },
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
  proposeAlliance: (partner, enemy) =>
    `The Coalition strikes a clause with ${partner} against ${enemy} — co-signed and sealed in the great ledger.`,
  acceptAlliance: (partner, enemy) =>
    `The Coalition's syndics countersign: with ${partner}, against ${enemy}, the contract holds.`,
  refuseAlliance: (partner, _enemy) =>
    `The Coalition reviews ${partner}'s clauses, finds the risk too dear, and declines.`,
  allianceBroken: (partner, enemy) =>
    `The clause with ${partner} against ${enemy} is struck through. The ledger remembers.`,
  proposeTradeAgreement: (partner, amount, gold, turns) =>
    `The Coalition contracts ${amount} aether per turn from ${partner} at ${gold} gold per turn, ${turns} turns — terms standard.`,
  acceptTradeAgreement: (partner, amount, gold, turns) =>
    `The Coalition seals it with ${partner}: ${amount} aether, ${gold} gold, ${turns} turns. Both columns balanced.`,
  refuseTradeAgreement: (partner) =>
    `The Coalition's clerks tap the columns — ${partner}'s offer is short. No contract.`,
  tradeAgreementBroken: (partner, reason) => {
    switch (reason) {
      case 'completed':
        return `The Coalition's contract with ${partner} closes on schedule. Both ledgers reconciled.`;
      case 'failed_to_deliver':
        return `The Coalition cannot meet the aether quota — the contract with ${partner} falls void.`;
      case 'failed_to_pay':
        return `${partner}'s gold runs dry; the Coalition tears up the contract.`;
      case 'war':
        return `War nullifies the Coalition's contract with ${partner}.`;
      case 'cancelled':
        return `The Coalition voids its contract with ${partner}.`;
      case 'partner_lost':
        return `${partner} is gone; the contract passes into the dead-letter ledger.`;
    }
  },
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
  proposeAlliance: (partner, enemy) =>
    `The Iron Legion forges common steel with ${partner} against ${enemy}. The drums beat together.`,
  acceptAlliance: (partner, enemy) =>
    `The Legion takes the oath with ${partner} — the drums of ${enemy} will answer in time.`,
  refuseAlliance: (partner, _enemy) =>
    `The Legion's captains will not stoop to ${partner}'s bargain.`,
  allianceBroken: (partner, enemy) =>
    `The oath with ${partner} against ${enemy} is shattered. The drums fall silent.`,
  proposeTradeAgreement: (partner, amount, gold, turns) =>
    `The Legion will take ${amount} aether per turn from ${partner} at ${gold} gold, ${turns} cycles — bond by oath.`,
  acceptTradeAgreement: (partner, amount, gold, turns) =>
    `The Legion sets its mark with ${partner}: ${amount} aether, ${gold} gold, ${turns} turns. Strong steel, fair coin.`,
  refuseTradeAgreement: (partner) =>
    `The Legion's quartermasters spit. ${partner}'s terms are unfit for iron.`,
  tradeAgreementBroken: (partner, reason) => {
    switch (reason) {
      case 'completed':
        return `The Legion's pact with ${partner} reaches its full count. Both kept faith.`;
      case 'failed_to_deliver':
        return `The Legion cannot deliver — the bond with ${partner} breaks like brittle iron.`;
      case 'failed_to_pay':
        return `${partner}'s coin falters; the Legion withdraws its hand.`;
      case 'war':
        return `Steel cuts the Legion's bond with ${partner}. War now.`;
      case 'cancelled':
        return `The Legion strikes its own oath with ${partner} — the drum knows.`;
      case 'partner_lost':
        return `${partner} falls. The Legion's bond passes into elegy.`;
    }
  },
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
  proposeAlliance: (partner, enemy) =>
    `The Verdant Pact roots a shared cause with ${partner} against ${enemy} — let the season turn together.`,
  acceptAlliance: (partner, enemy) =>
    `The Pact accepts ${partner}'s offering: against ${enemy}, the grove stands.`,
  refuseAlliance: (partner, _enemy) =>
    `The Pact's elders bow heads. ${partner}'s alliance is not in season.`,
  allianceBroken: (partner, enemy) =>
    `The shared roots with ${partner} against ${enemy} wither and break.`,
  proposeTradeAgreement: (partner, amount, gold, turns) =>
    `The Pact tends a steady flow from ${partner} — ${amount} aether per season at ${gold} gold, ${turns} seasons in all.`,
  acceptTradeAgreement: (partner, amount, gold, turns) =>
    `The Pact says yes to ${partner}: ${amount} aether, ${gold} gold, ${turns} turns. The grove will sustain it.`,
  refuseTradeAgreement: (partner) =>
    `The Pact returns ${partner}'s offering-bowl empty. The terms are barren.`,
  tradeAgreementBroken: (partner, reason) => {
    switch (reason) {
      case 'completed':
        return `The Pact's seasons with ${partner} complete. The grove rests.`;
      case 'failed_to_deliver':
        return `The aether-springs run dry; the Pact's bond with ${partner} withers.`;
      case 'failed_to_pay':
        return `${partner}'s coin fails. The Pact lets the agreement return to the moss.`;
      case 'war':
        return `War poisons the grove. The Pact severs from ${partner}.`;
      case 'cancelled':
        return `The Pact untangles its roots from ${partner}. The season passes.`;
      case 'partner_lost':
        return `${partner} fades from the map. The Pact composts the agreement.`;
    }
  },
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
  proposeAlliance: (partner, enemy) =>
    `The Cogwright Guild meshes gears with ${partner} against ${enemy} — pinions locked, advance synchronised.`,
  acceptAlliance: (partner, enemy) =>
    `The Guild accepts ${partner}'s spec: with them, against ${enemy}, the engine drives forward.`,
  refuseAlliance: (partner, _enemy) =>
    `The Guild's masters lay down the calipers. ${partner}'s alliance does not meet specification.`,
  allianceBroken: (partner, enemy) =>
    `The pact with ${partner} against ${enemy} is dismantled. Gears disengage.`,
  proposeTradeAgreement: (partner, amount, gold, turns) =>
    `The Guild fabricates a contract: ${amount} aether per turn from ${partner} at ${gold} gold, ${turns} turns — tolerances tight.`,
  acceptTradeAgreement: (partner, amount, gold, turns) =>
    `The Guild signs off with ${partner}: ${amount} aether, ${gold} gold, ${turns} turns. All within tolerance.`,
  refuseTradeAgreement: (partner) =>
    `The Guild's masters reject the spec. ${partner}'s terms misalign.`,
  tradeAgreementBroken: (partner, reason) => {
    switch (reason) {
      case 'completed':
        return `The Guild's contract with ${partner} reaches end-of-run. Mechanism honoured.`;
      case 'failed_to_deliver':
        return `The Guild's aether vials run dry — the contract with ${partner} seizes.`;
      case 'failed_to_pay':
        return `${partner}'s coin jams the mechanism. The Guild halts the contract.`;
      case 'war':
        return `War throws the Guild's mechanism out of true with ${partner}.`;
      case 'cancelled':
        return `The Guild dismantles the contract with ${partner}.`;
      case 'partner_lost':
        return `${partner} is gone. The Guild scraps the contract for parts.`;
    }
  },
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
  proposeAlliance: (partner, enemy) =>
    `They strike an alliance with ${partner} against ${enemy}.`,
  acceptAlliance: (partner, enemy) =>
    `They accept the alliance with ${partner} against ${enemy}.`,
  refuseAlliance: (partner) => `They refuse ${partner}'s alliance.`,
  allianceBroken: (partner, enemy) =>
    `Their alliance with ${partner} against ${enemy} dissolves.`,
  proposeTradeAgreement: (partner, amount, gold, turns) =>
    `They negotiate ${amount} aether/turn from ${partner} for ${gold} gold, ${turns} turns.`,
  acceptTradeAgreement: (partner, amount, gold, turns) =>
    `They accept ${partner}'s agreement: ${amount} aether, ${gold} gold, ${turns} turns.`,
  refuseTradeAgreement: (partner) => `They refuse ${partner}'s agreement.`,
  tradeAgreementBroken: (partner, reason) => {
    switch (reason) {
      case 'completed':
        return `The agreement with ${partner} ends.`;
      case 'failed_to_deliver':
        return `They cannot deliver — the agreement with ${partner} fails.`;
      case 'failed_to_pay':
        return `${partner} cannot pay — the agreement ends.`;
      case 'war':
        return `War ends the agreement with ${partner}.`;
      case 'cancelled':
        return `They cancel the agreement with ${partner}.`;
      case 'partner_lost':
        return `${partner} is gone — the agreement ends.`;
    }
  },
};

export function getDiplomacyVoice(id: FactionId): Voice {
  return VOICE_BY_FACTION[id] ?? genericVoice;
}

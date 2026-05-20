/**
 * Oregon Trail — Opportunity Event Corpus
 *
 * 10 opportunity events covering: hunting grounds, shortcut trails,
 * abandoned caches, trading posts, ferry crossings, and guide hires.
 *
 * Each event follows the event-runner schema:
 *   { id, title, description, effects: { resources?, reputation? }, choices? }
 *
 * Choices trade time for resources or vice versa — opportunities often
 * cost time or money but yield food, supplies, or trail advantages.
 *
 * @module opportunity-events
 */

/** @type {Array<object>} Opportunity event corpus */
export const OPPORTUNITY_EVENTS = Object.freeze([
  // ─── Hunting Grounds (2 events) ─────────────────────────────────────────────

  {
    id: "opp_buffalo_herd",
    title: "Buffalo Herd on the Plains",
    description:
      "A massive buffalo herd stretches across the horizon — hundreds of animals " +
      "grazing in the tall grass. The party's ammunition is low, but a successful " +
      "hunt could stockpile weeks of food. The Pragmatist checks the ammo crate: " +
      "'We have enough for a few shots. Make them count.'",
    effects: {},
    choices: [
      {
        label: "Hunt the herd (spend 6 ammo)",
        description:
          "Send hunters into the herd. High risk of wasting ammo, but the payoff is huge.",
        effects: {
          resources: { ammo: -6, food: 30, morale: 10 }
        }
      },
      {
        label: "Cautious hunt (spend 3 ammo)",
        description:
          "Take a single careful shot. Less ammo spent, smaller haul.",
        effects: {
          resources: { ammo: -3, food: 12, morale: 5 }
        }
      },
      {
        label: "Pass — conserve ammo",
        description:
          "Ammo is too precious to waste. Move on.",
        effects: {
          resources: { morale: -3 }
        }
      }
    ]
  },

  {
    id: "opp_deer_trail",
    title: "Deer Trail Through the Timber",
    description:
      "Fresh deer tracks lead into a dense stand of cottonwoods. The Skeptic " +
      "notes the tracks are recent — within the hour. A quick hunt could yield " +
      "fresh meat tonight, but ventering off-trail risks losing the wagon path. " +
      "The Optimist: 'I can almost taste the venison!'",
    effects: {},
    choices: [
      {
        label: "Track the deer (spend 2 ammo, lose half a day)",
        description:
          "Follow the trail deep into the timber. Good chance of a clean kill.",
        effects: {
          resources: { ammo: -2, food: 15, morale: 8 }
        }
      },
      {
        label: "Set a snare and keep moving",
        description:
          "Leave a snare on the trail and continue. Check it tomorrow — may or may not catch something.",
        effects: {
          resources: { food: 5, morale: 2 }
        }
      },
      {
        label: "Stay on the main trail",
        description:
          "No time for side quests. Keep the wagons rolling.",
        effects: {
          resources: {}
        }
      }
    ]
  },

  // ─── Shortcut Trails (2 events) ─────────────────────────────────────────────

  {
    id: "opp_mountain_pass",
    title: "Unmarked Mountain Pass",
    description:
      "A narrow trail branches off the main road, climbing into a gap between " +
      "two granite peaks. A faded marker suggests it's an old trapper's route — " +
      "it could shave two days off the journey, but the terrain is rough and " +
      "untested. The Pragmatist studies the map: 'No guarantees down there.'",
    effects: {},
    choices: [
      {
        label: "Take the shortcut",
        description:
          "Risk the rough terrain to save time. Wagon takes a beating but you gain ground.",
        effects: {
          resources: { wagonCondition: -12, morale: 5 }
        }
      },
      {
        label: "Scout ahead first",
        description:
          "Send someone to check the pass. Costs half a day but reveals if it's passable.",
        effects: {
          resources: { food: -2, wagonCondition: -5, morale: 3 }
        }
      },
      {
        label: "Stick to the main trail",
        description:
          "The known route is slower but safer.",
        effects: {
          resources: { morale: -2 }
        }
      }
    ]
  },

  {
    id: "opp_river_ford_shortcut",
    title: "Shallow River Ford",
    description:
      "The river bends wide here, and a gravel bar suggests a shallow crossing " +
      "point. The main trail follows the river for miles to a proper bridge — " +
      "this ford could cut a full day off the journey. But the current looks " +
      "swift, and the far bank is steep. The Tender worries: 'What if the wagon " +
      "gets stuck halfway?'",
    effects: {},
    choices: [
      {
        label: "Ford the river",
        description:
          "Drive straight through. Fast but risky — water damage is possible.",
        effects: {
          resources: { food: -3, wagonCondition: -8, morale: 5 }
        }
      },
      {
        label: "Unload and ferry supplies across",
        description:
          "Carry everything across in trips. Safe but costs a full day and extra food.",
        effects: {
          resources: { food: -5, morale: 2 }
        }
      },
      {
        label: "Follow the river to the bridge",
        description:
          "The long way round. No risk, but you lose a day.",
        effects: {
          resources: { food: -4, morale: -3 }
        }
      }
    ]
  },

  // ─── Abandoned Caches (2 events) ────────────────────────────────────────────

  {
    id: "opp_abandoned_wagon",
    title: "Abandoned Wagon",
    description:
      "A broken-down wagon sits beside the trail, canvas rotting and one wheel " +
      "missing. Inside, you find a cache of supplies — flour, coffee, and a few " +
      "tools — left behind by a party that couldn't carry everything. The Optimist " +
      "rummages through: 'Look at this! Someone's bad luck is our good fortune.' " +
      "But the Skeptic notices drag marks leading into the brush nearby.",
    effects: {},
    choices: [
      {
        label: "Take everything",
        description:
          "Load up the supplies. Generous haul, but the original owners might return.",
        effects: {
          resources: { food: 15, money: 5, morale: 8 },
          reputation: { fellowSettlers: -5, outlaws: 3 }
        }
      },
      {
        label: "Take only what you need",
        description:
          "Leave half behind for the original owners. Modest gain, clean conscience.",
        effects: {
          resources: { food: 8, morale: 5 },
          reputation: { fellowSettlers: 5 }
        }
      },
      {
        label: "Leave it untouched",
        description:
          "Someone might still need this. Move on.",
        effects: {
          resources: { morale: 3 },
          reputation: { fellowSettlers: 3 }
        }
      }
    ]
  },

  {
    id: "opp_fort_cache",
    title: "Old Fort Supply Cache",
    description:
      "The crumbling walls of an abandoned trading fort rise from the sagebrush. " +
      "Inside the storeroom, you discover a partially buried cache — rusted tools, " +
      "a few pounds of salt, and a waterlogged but intact blanket. The Pragmatist " +
      "assesses the haul: 'Not much, but every bit counts out here.'",
    effects: {},
    choices: [
      {
        label: "Salvage everything",
        description:
          "Take all usable supplies. Takes an hour but yields useful items.",
        effects: {
          resources: { food: 6, wagonCondition: 5, morale: 3 }
        }
      },
      {
        label: "Quick search and move on",
        description:
          "Grab the obvious valuables and keep going.",
        effects: {
          resources: { money: 3, morale: 2 }
        }
      },
      {
        label: "Rest in the fort's shelter",
        description:
          "The walls block the wind. Camp here for the night — safe and warm.",
        effects: {
          resources: { food: -2, morale: 8, health: [3, 3, 3, 3] }
        }
      }
    ]
  },

  // ─── Trading Posts (2 events) ───────────────────────────────────────────────

  {
    id: "opp_frontier_trading_post",
    title: "Frontier Trading Post",
    description:
      "A rough-hewn log cabin flies a faded flag — a trading post run by a " +
      "grizzled frontiersman. His shelves hold flour, ammunition, medicine, " +
      "and wagon parts, but prices are steep: 'Supply chain's long out here, " +
      "friends. Take it or leave it.' The Tender eyes the medicine: 'We could " +
      "use those bandages...'",
    effects: {},
    choices: [
      {
        label: "Buy supplies ($20 for food + ammo)",
        description:
          "Spend heavily to restock. Expensive but restocks critical supplies.",
        effects: {
          resources: { money: -20, food: 15, ammo: 8, morale: 5 },
          reputation: { riverTraders: 3 }
        }
      },
      {
        label: "Buy medicine only ($10)",
        description:
          "Just the essentials — bandages and quinine.",
        effects: {
          resources: { money: -10, morale: 3 },
          reputation: { riverTraders: 2 }
        }
      },
      {
        label: "Trade labor for supplies",
        description:
          "Offer to repair the post's roof in exchange for goods. Costs half a day.",
        effects: {
          resources: { food: 8, ammo: 3, morale: 2 },
          reputation: { riverTraders: 5, fellowSettlers: 2 }
        }
      }
    ]
  },

  {
    id: "opp_river_trader_barge",
    title: "River Trader's Barge",
    description:
      "A flat-bottomed barge is moored at the riverbank, laden with goods from " +
      "downriver. The trader — a sharp-eyed woman named Marta — offers fresh " +
      "produce, tobacco, and news from the settlements ahead. 'I don't take IOUs,' " +
      "she says. 'Cash or trade goods only.' The Optimist perks up: 'News from " +
      "ahead? That's worth something!'",
    effects: {},
    choices: [
      {
        label: "Buy fresh produce ($12)",
        description:
          "Fresh fruits and vegetables — a morale booster and health benefit.",
        effects: {
          resources: { money: -12, food: 10, morale: 12, health: [5, 5, 5, 5] },
          reputation: { riverTraders: 4 }
        }
      },
      {
        label: "Buy trail news only ($3)",
        description:
          "Learn about conditions ahead — river levels, trail closures, weather.",
        effects: {
          resources: { money: -3, morale: 5 },
          reputation: { riverTraders: 2 }
        }
      },
      {
        label: "Trade ammo for produce",
        description:
          "Swap 5 rounds of ammo for fresh food. Marta accepts but isn't thrilled.",
        effects: {
          resources: { ammo: -5, food: 8, morale: 5 },
          reputation: { riverTraders: -2 }
        }
      }
    ]
  },

  // ─── Ferry Crossings (1 event) ──────────────────────────────────────────────

  {
    id: "opp_toll_ferry",
    title: "Toll Ferry at Wide River",
    description:
      "The river is too wide and deep to ford here. A cable ferry operated by " +
      "a riverside family offers passage — $8 per wagon. The alternative is a " +
      "treacherous ford two miles downstream that might work if the water's low " +
      "enough. The ferryman calls over: 'Current's strong today. Your call, friends.' " +
      "The Pragmatist measures the water level: 'The ford's risky but not impossible.'",
    effects: {},
    choices: [
      {
        label: "Pay the ferry ($8)",
        description:
          "Safe, quick crossing. Costs money but no risk to wagon or party.",
        effects: {
          resources: { money: -8, morale: 3 },
          reputation: { riverTraders: 2 }
        }
      },
      {
        label: "Attempt the ford",
        description:
          "Risk the downstream crossing. Free but dangerous — wagon and supplies at risk.",
        effects: {
          resources: { food: -5, wagonCondition: -15, morale: -5 }
        }
      },
      {
        label: "Negotiate a group rate",
        description:
          "Wait for another wagon to share the ferry cost. Costs time but saves money.",
        effects: {
          resources: { money: -4, food: -2, morale: 2 },
          reputation: { riverTraders: 3, fellowSettlers: 3 }
        }
      }
    ]
  },

  // ─── Guide Hires (1 event) ──────────────────────────────────────────────────

  {
    id: "opp_mountain_guide",
    title: "Mountain Guide at the Pass",
    description:
      "At the base of a steep mountain pass, a weathered guide named Elias offers " +
      "his services. He knows every switchback and water source through the next " +
      "three days of trail. '$15 and I'll get you through safe,' he says. 'Go alone, " +
      "and you might lose the trail in the fog.' The Skeptic narrows their eyes: " +
      "'How do we know he's legit?' But the Tender notices his worn boots and " +
      "genuine gear — this man has walked these mountains.",
    effects: {},
    choices: [
      {
        label: "Hire the guide ($15)",
        description:
          "Pay for expert guidance. Safe passage through the mountains.",
        effects: {
          resources: { money: -15, wagonCondition: 5, morale: 8, health: [3, 3, 3, 3] },
          reputation: { nativeTribes: 3, fellowSettlers: 2 }
        }
      },
      {
        label: "Hire for one day only ($5)",
        description:
          "Get through the hardest section, then continue alone. Partial benefit.",
        effects: {
          resources: { money: -5, wagonCondition: 2, morale: 3 }
        }
      },
      {
        label: "Decline — navigate independently",
        description:
          "Trust your own map-reading. Risky but free.",
        effects: {
          resources: { wagonCondition: -8, morale: -5 }
        }
      }
    ]
  }
]);

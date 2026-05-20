/**
 * Encounter Event Corpus — Oregon Trail
 *
 * 12 encounter events covering: Native American tribes, fellow settlers,
 * river traders, outlaws, missionaries, and scouts.
 *
 * Each event has: id, title, description, effects, and 3 meaningful choices.
 * Choices affect resources and Trail Ledger reputation across 4 factions.
 *
 * Loadable by event-runner without modification.
 */

export const ENCOUNTER_EVENTS = [
  // ─── Native American Tribes (3 events) ───────────────────────────────

  {
    id: "enc_shoshone_traders",
    title: "Shoshone Trading Party",
    description:
      "A small band of Shoshone traders has set up camp beside a freshwater spring. " +
      "Their leader gestures toward a spread of dried buffalo meat, woven blankets, and " +
      "hand-forged iron tools. They seem open to trade — but their eyes linger on your " +
      "ammunition crates.",
    effects: {},
    choices: [
      {
        label: "Trade food for blankets",
        effects: {
          resources: { food: -5, morale: 3 },
          reputation: { nativeTribes: 5, riverTraders: -2 }
        }
      },
      {
        label: "Trade ammunition for tools",
        effects: {
          resources: { ammo: -8, wagonCondition: 5 },
          reputation: { nativeTribes: 3, outlaws: -3 }
        }
      },
      {
        label: "Decline and move on",
        effects: {
          resources: {},
          reputation: { nativeTribes: -2 }
        }
      }
    ]
  },

  {
    id: "enc_lakota_scout",
    title: "Lakota Trail Scout",
    description:
      "A lone Lakota scout on horseback rides alongside your wagon for a few minutes. " +
      "Through broken English and hand signals, he warns of a washed-out ford ahead and " +
      "offers to guide you to a safer crossing — for a price.",
    effects: {},
    choices: [
      {
        label: "Hire the scout (pay 10 money)",
        effects: {
          resources: { money: -10, wagonCondition: 8, morale: 2 },
          reputation: { nativeTribes: 8, fellowSettlers: 3 }
        }
      },
      {
        label: "Ask for directions only",
        effects: {
          resources: { morale: 1 },
          reputation: { nativeTribes: 2 }
        }
      },
      {
        label: "Ignore and press forward",
        effects: {
          resources: { wagonCondition: -5 },
          reputation: { nativeTribes: -3 }
        }
      }
    ]
  },

  {
    id: "enc_pai_elder",
    title: "Paiute Elder by the Trail",
    description:
      "An elderly Paiute woman sits beside the trail, her leg wrapped in torn cloth. " +
      "A small fire burns nearby with a pot of boiling herbs. She looks up at your party " +
      "with tired but dignified eyes. Her supplies are nearly gone.",
    effects: {},
    choices: [
      {
        label: "Help treat her wound (use supplies)",
        effects: {
          resources: { food: -3, morale: 5 },
          reputation: { nativeTribes: 10, fellowSettlers: 5 }
        }
      },
      {
        label: "Leave extra food by her fire",
        effects: {
          resources: { food: -4, morale: 3 },
          reputation: { nativeTribes: 6, fellowSettlers: 2 }
        }
      },
      {
        label: "Move on — can't spare anything",
        effects: {
          resources: {},
          reputation: { nativeTribes: -4, fellowSettlers: -1 }
        }
      }
    ]
  },

  // ─── Fellow Settlers (3 events) ──────────────────────────────────────

  {
    id: "enc_settler_wagon",
    title: "Strapped Settler Family",
    description:
      "A family of five huddles beside a wagon with a cracked axle. The father approaches, " +
      "hat in hand. Their food stores are nearly empty, and their youngest child is coughing. " +
      "They're asking if you can spare anything.",
    effects: {},
    choices: [
      {
        label: "Share food and medicine",
        effects: {
          resources: { food: -8, morale: 4 },
          reputation: { fellowSettlers: 10, nativeTribes: 2 }
        }
      },
      {
        label: "Trade spare parts for their map",
        effects: {
          resources: { wagonCondition: -3, morale: 2 },
          reputation: { fellowSettlers: 4, riverTraders: 2 }
        }
      },
      {
        label: "Sympathize but keep moving",
        effects: {
          resources: {},
          reputation: { fellowSettlers: -5 }
        }
      }
    ]
  },

  {
    id: "enc_abandoned_camp",
    title: "Abandoned Campsite",
    description:
      "You come across a recently abandoned camp. Cold ashes, scattered belongings, and " +
      "a half-buried trunk suggest the occupants left in a hurry. There might be useful " +
      "supplies — but the hasty departure is unsettling.",
    effects: {},
    choices: [
      {
        label: "Search thoroughly for supplies",
        effects: {
          resources: { food: 6, ammo: 3, money: 5 },
          reputation: { fellowSettlers: -4, outlaws: 3 }
        }
      },
      {
        label: "Leave an offering and take only what's needed",
        effects: {
          resources: { food: 3 },
          reputation: { fellowSettlers: 3, nativeTribes: 2 }
        }
      },
      {
        label: "Leave quickly — something feels wrong",
        effects: {
          resources: { morale: -2 },
          reputation: {}
        }
      }
    ]
  },

  {
    id: "enc_stranded_family",
    title: "Family with a Broken Wagon",
    description:
      "A wagon lies on its side in a ditch, wheels shattered. A man and woman are trying " +
      "to salvage what they can. Their children sit quietly on a blanket nearby. They wave " +
      "you down — could you help them get back on the trail?",
    effects: {},
    choices: [
      {
        label: "Stop and help repair their wagon",
        effects: {
          resources: { wagonCondition: -3, morale: 6, food: -2 },
          reputation: { fellowSettlers: 12, nativeTribes: 3 }
        }
      },
      {
        label: "Share food and wish them well",
        effects: {
          resources: { food: -5, morale: 2 },
          reputation: { fellowSettlers: 5 }
        }
      },
      {
        label: "Pass by — every day counts",
        effects: {
          resources: {},
          reputation: { fellowSettlers: -6 }
        }
      }
    ]
  },

  // ─── River Traders (2 events) ────────────────────────────────────────

  {
    id: "enc_river_trader",
    title: "River Trader's Flatboat",
    description:
      "A flatboat manned by two river traders pulls up to the bank. They've come down " +
      "from the Missouri with goods: salt, coffee, flour, and ammunition. They're looking " +
      "to trade — and they know the trail ahead better than most.",
    effects: {},
    choices: [
      {
        label: "Buy supplies (spend 15 money)",
        effects: {
          resources: { money: -15, food: 10, ammo: 5 },
          reputation: { riverTraders: 8 }
        }
      },
      {
        label: "Sell furs and pelts you've collected",
        effects: {
          resources: { money: 12, morale: 2 },
          reputation: { riverTraders: 5, outlaws: -2 }
        }
      },
      {
        label: "Decline — don't trust the prices",
        effects: {
          resources: {},
          reputation: { riverTraders: -3 }
        }
      }
    ]
  },

  {
    id: "enc_ferry_crossing",
    title: "River Ferry Crossing",
    description:
      "A wide, fast river blocks your path. A ferryman operates a cable-drawn raft on " +
      "the far bank. His sign reads: '$5 per wagon, $1 per head of livestock.' The current " +
      "looks too strong to ford safely — but the price is steep for your party.",
    effects: {},
    choices: [
      {
        label: "Pay the ferry fee",
        effects: {
          resources: { money: -8, wagonCondition: 5, morale: 3 },
          reputation: { riverTraders: 6, fellowSettlers: 2 }
        }
      },
      {
        label: "Attempt to ford the river alone",
        effects: {
          resources: { wagonCondition: -10, food: -5, morale: -3 },
          reputation: { riverTraders: -4, outlaws: 2 }
        }
      },
      {
        label: "Wait for another party to share the cost",
        effects: {
          resources: { money: -3, morale: -1 },
          reputation: { fellowSettlers: 4, riverTraders: 2 }
        }
      }
    ]
  },

  // ─── Outlaws (2 events) ──────────────────────────────────────────────

  {
    id: "enc_outlaw_ambush",
    title: "Roadside Ambush",
    description:
      "Three rough-looking men step from behind a rock outcropping, rifles leveled. " +
      "Their leader tips his hat and smiles thinly. 'Toll road, friends. Five dollars " +
      "or we start shooting.' Your party is outnumbered but not unarmed.",
    effects: {},
    choices: [
      {
        label: "Fight back!",
        effects: {
          resources: { ammo: -10, morale: -5, wagonCondition: -3 },
          reputation: { outlaws: -10, fellowSettlers: 5, nativeTribes: 3 }
        }
      },
      {
        label: "Pay the toll",
        effects: {
          resources: { money: -5, morale: -4 },
          reputation: { outlaws: 5, fellowSettlers: -3 }
        }
      },
      {
        label: "Flee — drive the wagon hard",
        effects: {
          resources: { wagonCondition: -8, food: -3, morale: -2 },
          reputation: { outlaws: -3, fellowSettlers: -2 }
        }
      }
    ]
  },

  {
    id: "enc_deserted_ranch",
    title: "Deserted Frontier Ranch",
    description:
      "A weathered ranch house stands alone on the prairie. The door hangs open, and " +
      "there are signs of a struggle — bullet holes in the siding, a bloodstain on the " +
      "porch. But the root cellar might still hold supplies. Do you investigate?",
    effects: {},
    choices: [
      {
        label: "Investigate thoroughly",
        effects: {
          resources: { food: 8, ammo: 5, money: 3 },
          reputation: { outlaws: -5, fellowSettlers: -3 }
        }
      },
      {
        label: "Set a watch and take only essentials",
        effects: {
          resources: { food: 4, ammo: 2 },
          reputation: { fellowSettlers: 2 }
        }
      },
      {
        label: "Avoid entirely — bad omens",
        effects: {
          resources: { morale: -1 },
          reputation: {}
        }
      }
    ]
  },

  // ─── Missionaries (1 event) ──────────────────────────────────────────

  {
    id: "enc_missionary_camp",
    title: "Missionary Camp",
    description:
      "A small missionary party has set up a canvas chapel beside the trail. They offer " +
      "hot coffee, prayer, and a place to rest. Their leader speaks of God's protection " +
      "on the journey — and quietly asks if your party can spare a donation for their " +
      "work among the tribes ahead.",
    effects: {},
    choices: [
      {
        label: "Rest, pray, and donate supplies",
        effects: {
          resources: { food: -4, money: -3, morale: 8 },
          reputation: { fellowSettlers: 6, nativeTribes: 4 }
        }
      },
      {
        label: "Rest and listen, but donate nothing",
        effects: {
          resources: { morale: 4 },
          reputation: { fellowSettlers: 2 }
        }
      },
      {
        label: "Move on — no time to stop",
        effects: {
          resources: {},
          reputation: { fellowSettlers: -2 }
        }
      }
    ]
  },

  // ─── Scouts (1 event) ────────────────────────────────────────────────

  {
    id: "enc_frontier_scout",
    title: "Frontier Scout at the Crossroads",
    description:
      "A grizzled scout with a weathered map leans against a trail marker at a fork in " +
      "the road. He's been guiding parties for ten years and knows every shortcut, water " +
      "hole, and danger zone for 200 miles. He offers his services — or will sell you " +
      "a copy of his annotated map.",
    effects: {},
    choices: [
      {
        label: "Hire him as a guide (pay 12 money)",
        effects: {
          resources: { money: -12, morale: 5, wagonCondition: 6 },
          reputation: { fellowSettlers: 4, riverTraders: 2 }
        }
      },
      {
        label: "Buy his annotated map (pay 6 money)",
        effects: {
          resources: { money: -6, morale: 3 },
          reputation: { fellowSettlers: 2 }
        }
      },
      {
        label: "Decline — trust your own judgment",
        effects: {
          resources: {},
          reputation: {}
        }
      }
    ]
  }
];

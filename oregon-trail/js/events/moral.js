/**
 * Oregon Trail — Moral Choice Event Corpus
 *
 * 10 moral events that the event-runner dispatches during travel.
 * Each event follows the schema:
 *   { id, title, description, effects: { resources?, reputation? }, choices: [{ text, effects: { resources?, reputation? } }] }
 *
 * Moral choice events are distinguished by their significant impact on
 * Trail Ledger reputation across factions (nativeTribes, fellowSettlers,
 * riverTraders, outlaws) and party morale. Choices reflect genuine
 * ethical dilemmas — help/ignore, share/hoard, stay/leave.
 *
 * Balance constraints:
 *   - Reputation deltas: ±8 to ±15 per faction per choice
 *   - Morale deltas: ±10 max per choice
 *   - Resource costs are meaningful but not game-ending
 *   - No single choice is strictly optimal — tradeoffs are real
 *
 * @module moral-events
 */

const MORAL_EVENTS = [
  // ─── Stranded Travelers (2 events) ─────────────────────────────────────────

  {
    id: "stranded_family",
    title: "Stranded Family at the Crossing",
    description:
      "A family of four stands beside a broken wagon axle on the riverbank. Their supplies are dwindling and the children are thin. The father approaches, hat in hand: 'We've been stuck three days. Could you spare a wheel or some flour?' The Pragmatist: 'We barely have enough for ourselves.' The Tender: 'Look at those children.'",
    effects: {
      resources: {
        morale: -4
      }
    },
    choices: [
      {
        text: "Share generously — give them a spare wheel and 15 rations of flour",
        effects: {
          resources: {
            food: -15,
            wagonCondition: -5,
            morale: 8
          },
          reputation: {
            fellowSettlers: 12,
            riverTraders: 5
          }
        }
      },
      {
        text: "Share modestly — give them 5 rations of flour and wish them well",
        effects: {
          resources: {
            food: -5,
            morale: 2
          },
          reputation: {
            fellowSettlers: 4
          }
        }
      },
      {
        text: "Press on — you can't afford to help everyone",
        effects: {
          resources: {
            morale: -8
          },
          reputation: {
            fellowSettlers: -6,
            outlaws: 3
          }
        }
      }
    ]
  },

  {
    id: "injured_rider",
    title: "Injured Rider on the Trail",
    description:
      "A lone rider lies unconscious beside the trail, his horse spooked and gone. He has a gash on his forehead and a swollen ankle. A leather pouch at his belt clinks with coins. The Skeptic: 'Could be a trap. Could also be a man who needs help.' The Tender is already kneeling beside him.",
    effects: {
      resources: {
        morale: -3
      }
    },
    choices: [
      {
        text: "Treat his wounds and carry him with you — delay the journey by a day",
        effects: {
          resources: {
            food: -8,
            morale: 6,
            health: [-2, -1, -2, -1]
          },
          reputation: {
            fellowSettlers: 10,
            riverTraders: 8
          }
        }
      },
      {
        text: "Bandage him and leave him supplies — he can recover at his own pace",
        effects: {
          resources: {
            food: -5,
            morale: 3
          },
          reputation: {
            fellowSettlers: 5
          }
        }
      },
      {
        text: "Take the coin pouch and keep moving — survival of the fittest",
        effects: {
          resources: {
            money: 20,
            morale: -12
          },
          reputation: {
            fellowSettlers: -12,
            outlaws: 10,
            nativeTribes: -5
          }
        }
      }
    ]
  },

  // ─── Begging Families (2 events) ───────────────────────────────────────────

  {
    id: "begging_at_camp",
    title: "Families at Your Campfire",
    description:
      "Three families have gathered near your campsite, drawn by the smell of your cooking. They haven't eaten in two days. The children stare at your fire with hollow eyes. The Pragmatist: 'If we feed them tonight, they'll follow us tomorrow. And the day after.' The Tender: 'They're starving.'",
    effects: {
      resources: {
        morale: -5
      }
    },
    choices: [
      {
        text: "Open your stores — cook a full meal for everyone",
        effects: {
          resources: {
            food: -20,
            morale: 10
          },
          reputation: {
            fellowSettlers: 15,
            nativeTribes: 5
          }
        }
      },
      {
        text: "Share a modest portion — enough to ease their hunger but not deplete your stores",
        effects: {
          resources: {
            food: -8,
            morale: 4
          },
          reputation: {
            fellowSettlers: 6
          }
        }
      },
      {
        text: "Turn them away — guard your supplies and sleep with one eye open",
        effects: {
          resources: {
            morale: -10
          },
          reputation: {
            fellowSettlers: -10,
            outlaws: 5
          }
        }
      }
    ]
  },

  {
    id: "widow_with_children",
    title: "Widow Asking for Passage",
    description:
      "A widow with two young children approaches your party at dawn. Her husband died of fever two weeks back and she has no wagon. 'I can cook and mend,' she says. 'My children can fetch water. Please — let us travel with you.' The Skeptic: 'More mouths, fewer hands. We can barely feed ourselves.'",
    effects: {
      resources: {
        morale: -4
      }
    },
    choices: [
      {
        text: "Welcome them aboard — share your wagon and divide your rations",
        effects: {
          resources: {
            food: -12,
            morale: 7,
            health: [2, 1, 2, 1]
          },
          reputation: {
            fellowSettlers: 12,
            nativeTribes: 8
          }
        }
      },
      {
        text: "Give them directions to the nearest settlement and 5 rations for the road",
        effects: {
          resources: {
            food: -5,
            morale: 1
          },
          reputation: {
            fellowSettlers: 3
          }
        }
      },
      {
        text: "Refuse — your party is already stretched too thin",
        effects: {
          resources: {
            morale: -8
          },
          reputation: {
            fellowSettlers: -8,
            outlaws: 4
          }
        }
      }
    ]
  },

  // ─── Abandoned Wagons (2 events) ───────────────────────────────────────────

  {
    id: "abandoned_wagon_goods",
    title: "Abandoned Wagon Full of Goods",
    description:
      "You find a wagon pulled off the trail, covered in dust but intact. Inside: tools, a crate of ammunition, and a strongbox with $40. No sign of the owners — just boot prints heading east, away from the wagon. The Pragmatist: 'They left it. Finders keepers.' The Tender: 'Or they went for help and will come back.'",
    effects: {
      resources: {
        morale: 2
      }
    },
    choices: [
      {
        text: "Take everything — the owners clearly aren't coming back",
        effects: {
          resources: {
            ammo: 10,
            money: 40,
            wagonCondition: 5,
            morale: 3
          },
          reputation: {
            fellowSettlers: -10,
            outlaws: 12
          }
        }
      },
      {
        text: "Take only what you need — leave the strongbox and most tools",
        effects: {
          resources: {
            ammo: 5,
            money: 10,
            morale: 5
          },
          reputation: {
            fellowSettlers: 3,
            riverTraders: 4
          }
        }
      },
      {
        text: "Leave it untouched — mark it on a trail post for the owners to find",
        effects: {
          resources: {
            morale: 8
          },
          reputation: {
            fellowSettlers: 10,
            nativeTribes: 6
          }
        }
      }
    ]
  },

  {
    id: "derelict_camp",
    title: "Derelict Camp with Journal",
    description:
      "A campsite sits abandoned, fire pit cold, tents collapsed. In a tin box you find a journal detailing a party that split up — half went ahead for supplies, half stayed behind with the sick. The last entry is two weeks old. There are medical supplies and a half-barrel of salted pork. The Skeptic: 'Could be a setup.' The Tender: 'Or someone's last hope.'",
    effects: {
      resources: {
        morale: -3
      }
    },
    choices: [
      {
        text: "Take the supplies and leave a note — if they return, they'll know who helped",
        effects: {
          resources: {
            food: 12,
            morale: 4
          },
          reputation: {
            fellowSettlers: 5,
            riverTraders: 3
          }
        }
      },
      {
        text: "Take everything and move fast — don't linger at a dead camp",
        effects: {
          resources: {
            food: 18,
            ammo: 5,
            morale: -2
          },
          reputation: {
            fellowSettlers: -8,
            outlaws: 8
          }
        }
      },
      {
        text: "Leave it all — set up a signal fire in case the others return",
        effects: {
          resources: {
            food: -3,
            morale: 7
          },
          reputation: {
            fellowSettlers: 12,
            nativeTribes: 5
          }
        }
      }
    ]
  },

  // ─── Injured Animals (2 events) ────────────────────────────────────────────

  {
    id: "injured_horse",
    title: "Injured Horse on the Trail",
    description:
      "A horse lies by the roadside with a broken leg, whinnying in pain. Its brand marks it as belonging to a ranching family — likely from a wagon accident. The Tender is already crying. The Pragmatist: 'We can't fix a broken leg. But we can end its suffering or leave it.'",
    effects: {
      resources: {
        morale: -6
      }
    },
    choices: [
      {
        text: "End its suffering humanely — a quick, merciful death",
        effects: {
          resources: {
            ammo: -1,
            morale: -3,
            food: 15
          },
          reputation: {
            fellowSettlers: 3,
            nativeTribes: 5
          }
        }
      },
      {
        text: "Try to splint the leg and carry it — slow the party but save a life",
        effects: {
          resources: {
            food: -10,
            morale: 5,
            health: [-3, -2, -3, -2]
          },
          reputation: {
            fellowSettlers: 8,
            nativeTribes: 10
          }
        }
      },
      {
        text: "Leave it — you can't help and staying wastes precious time",
        effects: {
          resources: {
            morale: -10
          },
          reputation: {
            fellowSettlers: -5,
            nativeTribes: -8
          }
        }
      }
    ]
  },

  {
    id: "starving_dogs",
    title: "Starving Dogs at a Ghost Town",
    description:
      "Three emaciated dogs follow your party into the ruins of a ghost town. They're too weak to hunt and too loyal to leave. The Tender: 'They're just trying to survive.' The Pragmatist: 'Dogs eat food we need. And they attract predators.'",
    effects: {
      resources: {
        morale: -4
      }
    },
    choices: [
      {
        text: "Adopt them — share your rations and let them travel with the party",
        effects: {
          resources: {
            food: -10,
            morale: 8
          },
          reputation: {
            fellowSettlers: 6,
            nativeTribes: 8
          }
        }
      },
      {
        text: "Feed them once and move on — one meal won't break your stores",
        effects: {
          resources: {
            food: -4,
            morale: 2
          },
          reputation: {
            fellowSettlers: 3
          }
        }
      },
      {
        text: "Drive them away — every mouthful counts on this trail",
        effects: {
          resources: {
            morale: -8
          },
          reputation: {
            fellowSettlers: -6,
            nativeTribes: -5
          }
        }
      }
    ]
  },

  // ─── Competing Parties (2 events) ──────────────────────────────────────────

  {
    id: "rival_party_race",
    title: "Race to the Ferry",
    description:
      "Another party of settlers is racing toward the same river ferry — the last one for fifty miles. There's only room for one group today. Their leader shouts: 'We were here first!' Your party is faster but they're desperate. The Pragmatist: 'Speed wins. But at what cost?'",
    effects: {
      resources: {
        morale: -3
      }
    },
    choices: [
      {
        text: "Race ahead and claim the ferry — first come, first served",
        effects: {
          resources: {
            morale: 5,
            health: [-4, -3, -4, -2]
          },
          reputation: {
            fellowSettlers: -8,
            outlaws: 6
          }
        }
      },
      {
        text: "Share the ferry — negotiate to split the crossing between both parties",
        effects: {
          resources: {
            food: -6,
            morale: 6
          },
          reputation: {
            fellowSettlers: 12,
            riverTraders: 8
          }
        }
      },
      {
        text: "Let them go first — wait and cross tomorrow, avoiding conflict",
        effects: {
          resources: {
            food: -8,
            morale: -4
          },
          reputation: {
            fellowSettlers: 6,
            nativeTribes: 4
          }
        }
      }
    ]
  },

  {
    id: "traders_dispute",
    title: "River Traders' Dispute",
    description:
      "A group of river traders accuses a settler family of stealing supplies from their camp. The settlers deny it, but the traders are armed and angry. They ask your party to judge the dispute. The Skeptic: 'Pick a side and you make an enemy of the other.' The Pragmatist: 'Not picking a side makes enemies of both.'",
    effects: {
      resources: {
        morale: -5
      }
    },
    choices: [
      {
        text: "Side with the traders — their goods were stolen and justice matters",
        effects: {
          resources: {
            morale: 3
          },
          reputation: {
            riverTraders: 15,
            fellowSettlers: -10
          }
        }
      },
      {
        text: "Side with the settlers — the traders are bullying a family",
        effects: {
          resources: {
            morale: 3
          },
          reputation: {
            fellowSettlers: 12,
            riverTraders: -12
          }
        }
      },
      {
        text: "Mediate fairly — search both camps and let the evidence decide",
        effects: {
          resources: {
            food: -5,
            morale: 8
          },
          reputation: {
            riverTraders: 8,
            fellowSettlers: 8,
            nativeTribes: 5
          }
        }
      }
    ]
  }
];

export default MORAL_EVENTS;

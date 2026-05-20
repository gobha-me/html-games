/**
 * Oregon Trail — Illness Event Corpus
 *
 * 10 illness events covering cholera, dysentery, typhoid, fever, broken bone,
 * snakebite, exhaustion, measles, pneumonia, and infected wound.
 *
 * Each event follows the event-runner schema:
 *   { id, title, description, effects: { resources?, reputation? }, choices? }
 *
 * Treatment choices affect outcome (rest / medicine / push through).
 *
 * @module illness-events
 */

/** @type {Array<object>} Illness event corpus */
export const ILLNESS_EVENTS = Object.freeze([
  // ─── 1. Cholera ────────────────────────────────────────────────────────────
  {
    id: "illness_cholera",
    title: "Cholera Strikes",
    description:
      "A party member collapses with violent cramps and dehydration. " +
      "The water supply may be contaminated — cholera spreads fast on the trail. " +
      "The Tender's hands shake: 'We need to act now, or we'll lose them.'",
    effects: {
      resources: { morale: -15, health: [-20, 0, 0, 0] }
    },
    choices: [
      {
        label: "Use medicine supplies",
        description:
          "Spend $15 on quinine and rehydration salts. Quick recovery but costly.",
        effects: {
          resources: { money: -15, health: [15, 0, 0, 0], morale: 5 }
        }
      },
      {
        label: "Rest and boil all water",
        description:
          "Camp for 2 days. Costs 4 food but purifies the supply.",
        effects: {
          resources: { food: -4, health: [8, 0, 0, 0], morale: -5 }
        }
      },
      {
        label: "Push through",
        description:
          "Keep moving — the sick member worsens and morale plummets.",
        effects: {
          resources: { health: [-15, 0, 0, 0], morale: -20 }
        }
      }
    ]
  },

  // ─── 2. Dysentery ──────────────────────────────────────────────────────────
  {
    id: "illness_dysentery",
    title: "Dysentery Outbreak",
    description:
      "Rations have spoiled in the heat. Two party members suffer from " +
      "severe stomach cramps and weakness. The classic trail killer — " +
      "you've heard the stories. The Pragmatist checks the food stores: " +
      "'Half the flour is already rancid.'",
    effects: {
      resources: { morale: -10, health: [-12, -8, 0, 0] }
    },
    choices: [
      {
        label: "Seek herbal remedy",
        description:
          "Ask a nearby Native tribe for traditional medicine. " +
          "Works best with good standing among the tribes.",
        effects: {
          resources: { health: [10, 8, 0, 0], morale: 5 },
          reputation: { nativeTribes: 3 }
        }
      },
      {
        label: "Discard spoiled food and rest",
        description:
          "Throw out bad rations (-6 food) and rest for a day.",
        effects: {
          resources: { food: -6, health: [5, 5, 0, 0], morale: -5 }
        }
      },
      {
        label: "Push through",
        description:
          "Ignore it — dehydration will take its toll.",
        effects: {
          resources: { health: [-10, -10, 0, 0], morale: -15 }
        }
      }
    ]
  },

  // ─── 3. Typhoid ────────────────────────────────────────────────────────────
  {
    id: "illness_typhoid",
    title: "Typhoid Fever",
    description:
      "A party member develops a raging fever with delirium and a rash. " +
      "Typhoid — carried by contaminated water or food. The Optimist tries " +
      "to stay positive, but even they look worried. 'We need to do something.'",
    effects: {
      resources: { morale: -12, health: [-18, 0, 0, 0] }
    },
    choices: [
      {
        label: "Administer quinine",
        description:
          "Use precious medicine supplies. Costs $20 but highly effective.",
        effects: {
          resources: { money: -20, health: [14, 0, 0, 0], morale: 8 }
        }
      },
      {
        label: "Cold compresses and rest",
        description:
          "Keep the fever down with wet cloths. Rest 1 day, costs 2 food.",
        effects: {
          resources: { food: -2, health: [6, 0, 0, 0], morale: -3 }
        }
      },
      {
        label: "Push through",
        description:
          "The fever will break on its own — or it won't.",
        effects: {
          resources: { health: [-12, 0, 0, 0], morale: -18 }
        }
      }
    ]
  },

  // ─── 4. Fever ──────────────────────────────────────────────────────────────
  {
    id: "illness_fever",
    title: "Sudden Fever",
    description:
      "A child in your party develops a high fever overnight. " +
      "They're burning up and barely conscious. The Tender pleads: " +
      "'We can't leave them behind. We have to stop.'",
    effects: {
      resources: { morale: -10, health: [0, 0, -15, 0] }
    },
    choices: [
      {
        label: "Use medicine",
        description:
          "Spend $8 on fever-reducing medicine. Quick relief.",
        effects: {
          resources: { money: -8, health: [0, 0, 12, 0], morale: 5 }
        }
      },
      {
        label: "Rest for 2 days",
        description:
          "Camp and nurse the child back to health. Costs 4 food.",
        effects: {
          resources: { food: -4, health: [0, 0, 8, 0], morale: -5 }
        }
      },
      {
        label: "Push through",
        description:
          "Keep moving — the child's condition may worsen.",
        effects: {
          resources: { health: [0, 0, -10, 0], morale: -20 }
        }
      }
    ]
  },

  // ─── 5. Broken Bone ────────────────────────────────────────────────────────
  {
    id: "illness_broken_bone",
    title: "Broken Bone",
    description:
      "A wagon wheel catches on a hidden root and flips. " +
      "A party member goes down hard — their leg is clearly broken. " +
      "The bone protrudes at a sickening angle. The Pragmatist assesses: " +
      "'We need to set it, and we need to stop.'",
    effects: {
      resources: { morale: -12, health: [-25, 0, 0, 0], wagonCondition: -10 }
    },
    choices: [
      {
        label: "Set the bone and rest",
        description:
          "Properly set the bone and camp for 3 days. Costs 6 food but best recovery.",
        effects: {
          resources: { food: -6, health: [18, 0, 0, 0], morale: 5 }
        }
      },
      {
        label: "Splint and continue",
        description:
          "Rough splint from wagon wood. Partial recovery but keep moving.",
        effects: {
          resources: { health: [8, 0, 0, 0], morale: -8 }
        }
      },
      {
        label: "Ignore it",
        description:
          "Leave it untreated — permanent damage is likely.",
        effects: {
          resources: { health: [-10, 0, 0, 0], morale: -15 }
        }
      }
    ]
  },

  // ─── 6. Snakebite ──────────────────────────────────────────────────────────
  {
    id: "illness_snakebite",
    title: "Rattlesnake Bite",
    description:
      "A party member steps on a rattlesnake hidden in the tall grass. " +
      "The bite swells rapidly — venom is spreading. The Skeptic mutters: " +
      "'Should've worn boots.' The wound is already turning purple.",
    effects: {
      resources: { morale: -15, health: [-20, 0, 0, 0] }
    },
    choices: [
      {
        label: "Suck out the venom",
        description:
          "Traditional method — risky but may slow the spread.",
        effects: {
          resources: { health: [8, 0, 0, 0], morale: -5 }
        }
      },
      {
        label: "Immobilize and rest",
        description:
          "Keep the limb still and rest 2 days. Costs 4 food.",
        effects: {
          resources: { food: -4, health: [12, 0, 0, 0], morale: -3 }
        }
      },
      {
        label: "Push through",
        description:
          "Keep walking — the venom will spread faster with exertion.",
        effects: {
          resources: { health: [-15, 0, 0, 0], morale: -18 }
        }
      }
    ]
  },

  // ─── 7. Exhaustion ─────────────────────────────────────────────────────────
  {
    id: "illness_exhaustion",
    title: "Party-Wide Exhaustion",
    description:
      "Weeks of hard travel have worn everyone down. The whole party " +
      "moves slower, tempers flare, and simple tasks take twice as long. " +
      "The Optimist tries to rally spirits but even they look exhausted. " +
      "'Maybe we should take a day off,' they suggest weakly.",
    effects: {
      resources: { morale: -10, health: [-5, -5, -5, -5] }
    },
    choices: [
      {
        label: "Full rest day",
        description:
          "Stop for a complete day of rest. Costs 4 food but everyone recovers.",
        effects: {
          resources: { food: -4, health: [8, 8, 8, 8], morale: 10 }
        }
      },
      {
        label: "Half-day rest",
        description:
          "Rest until noon, then push on. Partial recovery, costs 2 food.",
        effects: {
          resources: { food: -2, health: [4, 4, 4, 4], morale: 3 }
        }
      },
      {
        label: "Push on",
        description:
          "No time to rest — the trail waits for no one.",
        effects: {
          resources: { health: [-5, -5, -5, -5], morale: -15 }
        }
      }
    ]
  },

  // ─── 8. Measles ────────────────────────────────────────────────────────────
  {
    id: "illness_measles",
    title: "Measles Outbreak",
    description:
      "Red spots appear on the youngest party member's face, followed by " +
      "a high fever and coughing. Measles — highly contagious. " +
      "If you don't quarantine, it will spread to the whole party. " +
      "The Tender looks terrified: 'We need to isolate them.'",
    effects: {
      resources: { morale: -12, health: [0, 0, -15, 0] }
    },
    choices: [
      {
        label: "Quarantine and rest",
        description:
          "Isolate the sick member and camp for 3 days. Costs 6 food but contains the spread.",
        effects: {
          resources: { food: -6, health: [0, 0, 10, 0], morale: -3 }
        }
      },
      {
        label: "Treat symptoms and continue",
        description:
          "Wet cloths for the fever, keep moving. Partial recovery.",
        effects: {
          resources: { health: [0, 0, 5, -5], morale: -8 }
        }
      },
      {
        label: "Ignore it",
        description:
          "It's just a rash — keep moving. It spreads to another member.",
        effects: {
          resources: { health: [0, -10, -10, 0], morale: -20 }
        }
      }
    ]
  },

  // ─── 9. Pneumonia ──────────────────────────────────────────────────────────
  {
    id: "illness_pneumonia",
    title: "Pneumonia Sets In",
    description:
      "Cold nights and damp clothes have taken their toll. A party member " +
      "develops a deep, rattling cough and struggles to breathe. " +
      "Pneumonia — especially dangerous in the mountains. " +
      "The Pragmatist: 'We need warmth and rest, or this gets fatal.'",
    effects: {
      resources: { morale: -12, health: [-18, 0, 0, 0] }
    },
    choices: [
      {
        label: "Build fires and rest",
        description:
          "Camp for 2 days, burn extra wood for warmth. Costs 2 ammo (for fire) and 4 food.",
        effects: {
          resources: { ammo: -2, food: -4, health: [14, 0, 0, 0], morale: 5 }
        }
      },
      {
        label: "Use medicine",
        description:
          "Spend $18 on medicine to fight the infection.",
        effects: {
          resources: { money: -18, health: [12, 0, 0, 0], morale: 3 }
        }
      },
      {
        label: "Push through",
        description:
          "Cold and exertion will only make it worse.",
        effects: {
          resources: { health: [-12, 0, 0, 0], morale: -18 }
        }
      }
    ]
  },

  // ─── 10. Infected Wound ────────────────────────────────────────────────────
  {
    id: "illness_infected_wound",
    title: "Infected Wound",
    description:
      "A small cut from a few days ago has turned angry — red, swollen, " +
      "and oozing. Infection is setting in. Without treatment, it could " +
      "turn septic. The Skeptic: 'Should've cleaned that when it happened.' " +
      "The wound is hot to the touch.",
    effects: {
      resources: { morale: -8, health: [-12, 0, 0, 0] }
    },
    choices: [
      {
        label: "Cauterize the wound",
        description:
          "Burn it clean with a hot blade. Brutal but effective. Morale takes a hit.",
        effects: {
          resources: { health: [15, 0, 0, 0], morale: -10 }
        }
      },
      {
        label: "Clean and rest",
        description:
          "Wash the wound thoroughly and rest 1 day. Costs 2 food.",
        effects: {
          resources: { food: -2, health: [8, 0, 0, 0], morale: -3 }
        }
      },
      {
        label: "Ignore it",
        description:
          "It'll heal on its own — or it won't. Sepsis is a real risk.",
        effects: {
          resources: { health: [-15, 0, 0, 0], morale: -15 }
        }
      }
    ]
  }
]);

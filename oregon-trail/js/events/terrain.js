/**
 * Oregon Trail — Terrain Hazard Event Corpus
 *
 * 10 terrain events that the event-runner dispatches during travel.
 * Each event follows the schema:
 *   { id, title, description, effects: { resources?, reputation? }, choices? }
 *
 * Balance constraints:
 *   - Health deltas: ±10 per member max
 *   - Morale deltas: ±15 max
 *   - Wagon condition deltas: ±12 max
 *   - Food deltas: ±20 max
 *   - No single event is game-ending
 *
 * @module terrain-events
 */

const TERRAIN_EVENTS = [
  // ─── River Crossings (3 events) ────────────────────────────────────────────

  {
    id: "swollen_river",
    title: "Swollen River Crossing",
    description:
      "Spring runoff has turned the river into a raging torrent. The far bank is visible but the current is fierce. Your party gathers at the water's edge, waiting for your call. The Pragmatist: 'Three options. Each has a cost.'",
    effects: {
      resources: {
        morale: -5
      }
    },
    choices: [
      {
        text: "Ford it — drive the wagons straight through the current",
        effects: {
          resources: {
            wagonCondition: -12,
            morale: 5,
            health: [-5, -3, -4, -2]
          }
        }
      },
      {
        text: "Build a raft — lash logs together and ferry supplies across",
        effects: {
          resources: {
            food: -10,
            morale: 3,
            wagonCondition: -3
          }
        }
      },
      {
        text: "Caulk the wagon — seal the gaps and float it across",
        effects: {
          resources: {
            ammo: -5,
            morale: 2,
            wagonCondition: -6
          }
        }
      }
    ]
  },

  {
    id: "wide_river_ferry",
    title: "Wide River Ferry",
    description:
      "A broad, slow-moving river blocks the trail. A ferryman on the far bank waves — he'll take you across for a price. Building your own crossing would take days. The Skeptic: 'His prices are steep. But so is the cost of delay.'",
    effects: {
      resources: {
        morale: -3
      }
    },
    choices: [
      {
        text: "Pay the ferryman — $25 for a safe crossing",
        effects: {
          resources: {
            money: -25,
            morale: 4
          }
        }
      },
      {
        text: "Build a makeshift raft — takes time but saves money",
        effects: {
          resources: {
            food: -12,
            wagonCondition: -8,
            morale: -2
          }
        }
      }
    ]
  },

  {
    id: "shallow_creek",
    title: "Deceptive Creek",
    description:
      "The creek looks shallow enough to wade, but the muddy bottom hides deep ruts. The Tender: 'The water's murky — we can't see what's below.' A quick crossing saves time, but scouting first costs a day.",
    effects: {
      resources: {
        morale: -2
      }
    },
    choices: [
      {
        text: "Ford it quickly — trust the oxen to power through",
        effects: {
          resources: {
            wagonCondition: -10,
            morale: 3,
            health: [-3, -2, -4, -2]
          }
        }
      },
      {
        text: "Scout first — find the safest crossing point",
        effects: {
          resources: {
            food: -8,
            morale: 5,
            wagonCondition: -2
          }
        }
      }
    ]
  },

  // ─── Mountain Passes (2 events) ────────────────────────────────────────────

  {
    id: "steep_mountain_pass",
    title: "Steep Mountain Pass",
    description:
      "The trail climbs sharply into the mountains, narrow and rutted with loose shale. One wrong step and a wagon could slide down the slope. The Pragmatist: 'We either push the wagons up or lighten the load. Both hurt.'",
    effects: {
      resources: {
        morale: -6
      }
    },
    choices: [
      {
        text: "Push the wagons up — all hands on the wheels",
        effects: {
          resources: {
            wagonCondition: -10,
            morale: 4,
            health: [-4, -3, -5, -3]
          }
        }
      },
      {
        text: "Lighten the load — abandon some supplies to ease the climb",
        effects: {
          resources: {
            food: -15,
            morale: -8,
            wagonCondition: -3
          }
        }
      }
    ]
  },

  {
    id: "narrow_cliff_trail",
    title: "Narrow Cliff Trail",
    description:
      "The path clings to the mountainside with a sheer drop on one side. The wagons barely fit, and loose stones skitter into the abyss. The Optimist: 'The view is breathtaking.' The Skeptic: 'So is the fall.'",
    effects: {
      resources: {
        morale: -8
      }
    },
    choices: [
      {
        text: "Take it slow — careful pace, one wagon at a time",
        effects: {
          resources: {
            food: -10,
            morale: 6,
            wagonCondition: -4
          }
        }
      },
      {
        text: "Push through fast — minimize time on the ledge",
        effects: {
          resources: {
            wagonCondition: -12,
            morale: -5,
            health: [-3, -2, -3, -2]
          }
        }
      }
    ]
  },

  // ─── Desert Stretches (2 events) ───────────────────────────────────────────

  {
    id: "scorching_desert",
    title: "Scorching Desert Crossing",
    description:
      "Miles of sun-baked earth stretch ahead with no shade and no water. The heat shimmers off the ground like a mirage. The Tender: 'We need to conserve water.' The Pragmatist: 'Speed saves water. But speed costs health.'",
    effects: {
      resources: {
        morale: -10,
        health: [-4, -3, -5, -3]
      }
    },
    choices: [
      {
        text: "Push through fast — cover ground before the heat peaks",
        effects: {
          resources: {
            health: [-8, -6, -7, -5],
            morale: -5,
            food: -5
          }
        }
      },
      {
        text: "Travel at night — rest during the day, move after dark",
        effects: {
          resources: {
            food: -12,
            morale: 3,
            health: [-2, -1, -2, -1]
          }
        }
      }
    ]
  },

  {
    id: "desert_sand_trap",
    title: "Desert Sand Trap",
    description:
      "The wagon wheels sink deep into soft sand, grinding to a halt with every rotation. The oxen strain but can't find traction. The Pragmatist: 'We're losing time and strength. We need to lighten the load or double-team the animals.'",
    effects: {
      resources: {
        morale: -7,
        wagonCondition: -5
      }
    },
    choices: [
      {
        text: "Lighten the load — dump supplies and push through",
        effects: {
          resources: {
            food: -15,
            morale: -10,
            wagonCondition: -3
          }
        }
      },
      {
        text: "Double-team the oxen — all party members push from behind",
        effects: {
          resources: {
            health: [-6, -5, -7, -4],
            morale: 2,
            wagonCondition: -8
          }
        }
      }
    ]
  },

  // ─── Mud Bogs (1 event) ────────────────────────────────────────────────────

  {
    id: "deep_mud_bog",
    title: "Deep Mud Bog",
    description:
      "Days of rain have turned a low stretch of trail into a thick, sucking bog. The wagons sink to their axles and the oxen flounder. The Tender: 'We'll have to unload and carry.' The Skeptic: 'Or we push and risk breaking an axle.'",
    effects: {
      resources: {
        morale: -6,
        wagonCondition: -4
      }
    },
    choices: [
      {
        text: "Unload and carry — haul supplies by hand around the bog",
        effects: {
          resources: {
            food: -10,
            morale: 3,
            health: [-4, -3, -5, -3]
          }
        }
      },
      {
        text: "Push through — all hands on the wheels, hope the axles hold",
        effects: {
          resources: {
            wagonCondition: -12,
            morale: -4,
            health: [-5, -4, -6, -3]
          }
        }
      }
    ]
  },

  // ─── Rockslides (1 event) ──────────────────────────────────────────────────

  {
    id: "fresh_rockslide",
    title: "Fresh Rockslide",
    description:
      "A recent rockslide has dumped tons of debris across the narrow canyon trail. The rocks are still settling — you can hear them shifting. The Pragmatist: 'We can try to clear a path, or backtrack and find another route.'",
    effects: {
      resources: {
        morale: -8
      }
    },
    choices: [
      {
        text: "Clear the debris — all hands move rocks and build a path",
        effects: {
          resources: {
            food: -8,
            wagonCondition: -10,
            morale: 4,
            health: [-3, -2, -4, -2]
          }
        }
      },
      {
        text: "Detour — backtrack and find an alternate route",
        effects: {
          resources: {
            food: -15,
            morale: -5,
            wagonCondition: -3
          }
        }
      }
    ]
  },

  // ─── Prairie Fires (1 event) ───────────────────────────────────────────────

  {
    id: "prairie_fire",
    title: "Prairie Fire",
    description:
      "A wall of flame advances across the dry grass, driven by a stiff wind. Smoke chokes the air and the heat is already palpable. The Optimist: 'We can outrun it!' The Skeptic: 'Or we dig in and pray the firebreak holds.'",
    effects: {
      resources: {
        morale: -12
      }
    },
    choices: [
      {
        text: "Race ahead — push the wagons hard to outrun the flames",
        effects: {
          resources: {
            health: [-7, -5, -8, -4],
            morale: -5,
            food: -8,
            wagonCondition: -6
          }
        }
      },
      {
        text: "Create a firebreak — clear a circle and wait it out",
        effects: {
          resources: {
            food: -10,
            wagonCondition: -8,
            morale: 5,
            health: [-3, -2, -3, -2]
          }
        }
      }
    ]
  }
];

export default TERRAIN_EVENTS;

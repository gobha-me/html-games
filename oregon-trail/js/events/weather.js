/**
 * Oregon Trail — Weather Event Corpus
 *
 * 10 weather events that the event-runner dispatches during travel.
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
 * @module weather-events
 */

const WEATHER_EVENTS = [
  {
    id: "thunderstorm",
    title: "Prairie Thunderstorm",
    description:
      "Dark clouds roll in fast over the open prairie. Lightning cracks as rain hammers the wagons, turning the trail to slick mud. The storm bogs you down for a day, but at least the rain barrels are full.",
    effects: {
      resources: {
        food: -5,
        morale: 3,
        wagonCondition: -6
      }
    }
  },

  {
    id: "drought",
    title: "Dust Bowl Drought",
    description:
      "Weeks without rain. The ground cracks, streams shrink to puddles, and dust coats everything. Rations taste gritty, and the party's spirits sink with every parched mile.",
    effects: {
      resources: {
        food: -10,
        morale: -8,
        wagonCondition: -4
      }
    }
  },

  {
    id: "frost",
    title: "Early Frost",
    description:
      "A cold snap hits sooner than anyone expected. Frost clings to the wagon wheels at dawn, and the party shivers through thin blankets. A few members wake with stiff joints and coughs.",
    effects: {
      resources: {
        morale: -6,
        health: [-5, -3, -4, -2]
      }
    }
  },

  {
    id: "heatwave",
    title: "Prairie Heat Wave",
    description:
      "The sun beats down like a hammer. Heat shimmers off the trail, and water evaporates faster than you can ration it. The party trudges in silence, lips cracked and tempers short.",
    effects: {
      resources: {
        food: -8,
        morale: -10,
        health: [-6, -5, -7, -4]
      }
    }
  },

  {
    id: "tornado",
    title: "Tornado Sighting",
    description:
      "A funnel cloud touches down on the horizon, churning dust and debris. Panic ripples through the party as the wind picks up. You have moments to decide: hunker down or flee.",
    effects: {
      resources: {
        morale: -12,
        wagonCondition: -5
      }
    },
    choices: [
      {
        text: "Hunker down — secure the wagons and ride it out",
        effects: {
          resources: {
            wagonCondition: -8,
            morale: 4
          }
        }
      },
      {
        text: "Flee — push the wagons hard away from the storm",
        effects: {
          resources: {
            wagonCondition: -3,
            morale: -5,
            food: -6
          }
        }
      }
    ]
  },

  {
    id: "hail",
    title: "Hail Storm",
    description:
      "Ice pellets the size of marbles rain from the sky, pelting the party and livestock. Canvas tears, wood splinters, and several members take bruises from the barrage.",
    effects: {
      resources: {
        wagonCondition: -10,
        morale: -8,
        health: [-4, -3, -5, -2]
      }
    }
  },

  {
    id: "fog",
    title: "Dense River Fog",
    description:
      "A thick fog rolls in off the river, reducing visibility to a few paces. The trail disappears, and every step forward is a guess. You lose half a day navigating blind.",
    effects: {
      resources: {
        morale: -5,
        food: -4
      }
    },
    choices: [
      {
        text: "Push through — keep moving despite the fog",
        effects: {
          resources: {
            wagonCondition: -6,
            morale: -4
          }
        }
      },
      {
        text: "Wait it out — camp until the fog lifts",
        effects: {
          resources: {
            food: -8,
            morale: 2
          }
        }
      }
    ]
  },

  {
    id: "wind",
    title: "Howling Plains Wind",
    description:
      "A relentless wind sweeps across the plains, whipping dust into every crevice. The wagons strain against the gusts, and progress slows to a crawl. Sleep is nearly impossible.",
    effects: {
      resources: {
        wagonCondition: -7,
        morale: -9,
        food: -3
      }
    }
  },

  {
    id: "blizzard",
    title: "Mountain Blizzard",
    description:
      "Snow comes down in thick sheets, driven by biting wind. The trail vanishes under white, and the cold seeps through every layer. Several party members show signs of frostbite.",
    effects: {
      resources: {
        health: [-8, -6, -7, -5],
        morale: -14,
        food: -12,
        wagonCondition: -8
      }
    }
  },

  {
    id: "downpour",
    title: "Steady Downpour",
    description:
      "Rain falls steadily for hours, soaking everything it touches. The trail turns to thick mud that clings to the wheels, but the water barrels overflow and the dust finally settles.",
    effects: {
      resources: {
        food: 5,
        morale: -3,
        wagonCondition: -9
      }
    }
  }
];

export default WEATHER_EVENTS;

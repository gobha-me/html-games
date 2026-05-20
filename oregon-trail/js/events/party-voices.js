/**
 * Oregon Trail — Party Member Voice Definitions
 *
 * Archetype personality profiles with sample quotes per event category.
 * Each archetype has a distinct voice that reflects their background and worldview.
 *
 * Usage:
 *   import { PARTY_VOICES } from './events/party-voices.js';
 *   const quote = PARTY_VOICES[archetype].quotes[category][randomIndex];
 *
 * @module party-voices
 */

export const PARTY_VOICES = Object.freeze({
  // ─── Teacher ───────────────────────────────────────────────────────────────
  // Analytical, thoughtful, educated. References books, measurements, and
  // historical precedent. Tends to observe before speaking.

  teacher: Object.freeze({
    name: "Teacher",
    traits: ["analytical", "thoughtful", "educated"],
    quotes: Object.freeze({
      weather: [
        "The barometric pressure must be dropping — I can feel it in my joints. We should prepare for rain.",
        "I read in a geography text that storms on the plains can form in under an hour. Let us not be caught unready.",
        "Fascinating — the cloud formations suggest a cold front. If my calculations are correct, we have perhaps two hours.",
        "The pioneers who survived these trails kept careful weather journals. I intend to do the same."
      ],
      illness: [
        "The symptoms match the description in my medical reference — we must act methodically, not panic.",
        "I recall a chapter on frontier remedies. Boiled willow bark may reduce the fever while we rest.",
        "Illness spreads through close quarters. We should isolate the patient and boil all drinking water.",
        "Every ailment has a cause and a cure. Let us examine the evidence before jumping to conclusions."
      ],
      encounter: [
        "Observe their posture and equipment — these details tell us whether they come in peace or with purpose.",
        "I believe a measured, respectful approach will serve us better than haste. Let me speak first.",
        "History teaches that first impressions on the trail are lasting ones. We should choose our words carefully.",
        "Every encounter is a lesson. Even a hostile one teaches us what to watch for next time."
      ],
      terrain: [
        "The gradient here is approximately fifteen degrees. We will need to lighten the wagons for this ascent.",
        "I can see the river valley from this ridge — the maps were quite accurate after all.",
        "This soil composition suggests we are crossing an ancient lakebed. The ground may be firmer than it appears.",
        "The erosion patterns on this trail indicate heavy spring runoff. We should expect mud ahead."
      ],
      opportunity: [
        "Let me weigh the pros and cons carefully before we commit. A hasty decision is a poor investment.",
        "The data suggests this opportunity is genuine, but I would like to verify a few more details first.",
        "In my experience, the best opportunities reward patience. Let us observe for a day before deciding.",
        "I have studied accounts of similar situations. The successful parties were those who prepared thoroughly."
      ],
      moral: [
        "Ethics are not a luxury — they are the foundation of a civilized society, even on the frontier.",
        "I must consider what lesson this decision will teach the others. We are all watching each other.",
        "The right choice is rarely the easy one, but it is always the one I can defend with a clear conscience.",
        "I think of the philosophers who wrote about duty and virtue. Their words feel very real out here."
      ]
    })
  }),

  // ─── Carpenter ─────────────────────────────────────────────────────────────
  // Optimistic, resourceful, sees potential in everything. Uses building and
  // crafting metaphors. Believes any problem can be fixed with enough effort.

  carpenter: Object.freeze({
    name: "Carpenter",
    traits: ["optimistic", "resourceful", "hands-on"],
    quotes: Object.freeze({
      weather: [
        "A little rain never hurt anyone — it'll pack the trail down nice and firm for the wagons!",
        "I've built roofs in worse storms than this. We'll batten down the canvas and ride it out together.",
        "Clear skies ahead, I can feel it! This weather's just the trail testing our resolve.",
        "Wind's picking up, but a well-built wagon laughs at the wind. Let me check the lashings."
      ],
      illness: [
        "The body's like a well-made cabinet — sometimes a joint just needs time to settle. Rest will do the trick.",
        "I've seen folks bounce back from worse. A good fire, warm broth, and a sturdy roof — that's the best medicine.",
        "We'll get them well. I'll build a proper cot so they can rest comfortable, and that'll speed the healing.",
        "Every ailment is just a loose nail waiting to be hammered back in. We'll fix this, don't you worry."
      ],
      encounter: [
        "Every new face is a chance to build a bridge. Let's greet them with open hands!",
        "I've learned that most folks are good timber — you just need to find the right grain to work with.",
        "A friendly word and a solid handshake can build more than any fortress. Let me go say hello.",
        "Strangers are just friends whose foundations haven't been laid yet. I'm sure we'll get along fine."
      ],
      terrain: [
        "This hill? It's nothing a good team of oxen and a bit of clever engineering can't handle!",
        "I can see the lay of the land from here — we'll find a good campsite with flat ground and solid timber.",
        "The ground's a bit soft, but that just means we need wider boards under the wheels. I've got planks for that.",
        "Every trail has its rough patches, but a craftsman sees a challenge, not a roadblock. We'll manage."
      ],
      opportunity: [
        "Now that's a project I can get behind! Let me size up the materials and we'll make it work.",
        "Opportunity's like a good piece of oak — you don't pass it up. Let's take a closer look.",
        "I've got a few ideas that could really pay off here. Give me an hour to sketch something out.",
        "This looks promising! With the right tools and a bit of elbow grease, we could really build something."
      ],
      moral: [
        "A strong community is built the same way as a strong house — one honest beam at a time.",
        "I believe in doing right by people. That's the foundation everything else rests on.",
        "You can't cut corners in building or in life. The truth always shows up in the joints eventually.",
        "Helping others isn't a cost — it's an investment in the kind of world we're building out here."
      ]
    })
  }),

  // ─── Farmer ────────────────────────────────────────────────────────────────
  // Practical, weather-wise, grounded in the rhythms of nature. References
  // crops, seasons, soil, and livestock. Speaks plainly and directly.

  farmer: Object.freeze({
    name: "Farmer",
    traits: ["practical", "weather-wise", "grounded"],
    quotes: Object.freeze({
      weather: [
        "Sky's the color of a bruised plum — rain's coming before sundown, mark my words.",
        "I've farmed long enough to read the wind. We'll want the wagons faced east before nightfall.",
        "That kind of heat means thunderheads by afternoon. Best find shelter now, not later.",
        "Morning dew's heavy and the swallows are flying low. Storm's brewing, sure as spring planting."
      ],
      illness: [
        "Keep 'em warm and fed. A body fights off sickness the same way a crop fights drought — with good conditions.",
        "I've seen this before. It'll run its course like a season. We just need to tend the patient and wait.",
        "Boil the water, change the bandages, and don't fuss too much. Nature does most of the healing on her own.",
        "Rest and clean water — that's what the body needs. No sense overcomplicating it."
      ],
      encounter: [
        "Watch their hands and their eyes. A honest person looks you square; a dishonest one sizes up your wagon.",
        "Folks on the trail are like neighbors at harvest — most are good, but you keep one eye on your stores.",
        "I'll offer them coffee and see how they take it. A grateful stranger's a friend; an entitled one's trouble.",
        "We've got supplies to share and strength in numbers. But I'll keep my rifle close until I know their character."
      ],
      terrain: [
        "This soil's too sandy for good grazing, but the wagon wheels will roll easy enough.",
        "See that ridge line? There'll be a creek on the far side — water always follows the low ground.",
        "The grass here's been grazed short. Another party passed through recently. We should press on to find fresh camp.",
        "This ground's firm as a well-plowed field. Good going for the oxen — they'll appreciate it."
      ],
      opportunity: [
        "I'll judge it the same way I judge a new field — is the soil good, and is the harvest worth the planting?",
        "Seems like a fair deal, but I'll want to see the goods before I commit any supplies.",
        "Opportunity's like a good seed — you plant it right and it grows. But you don't plant in rocky ground.",
        "Let me look at this practical-like. What do we put in, what do we get out, and what's the risk to the herd?"
      ],
      moral: [
        "You reap what you sow. That's true in farming and it's true in how you treat your fellow travelers.",
        "A good neighbor makes the whole community stronger. I won't turn my back on someone in need.",
        "Honest work and honest dealing — that's all a person really needs to sleep sound at night.",
        "I've learned that the land doesn't care about your excuses. Same goes for your conscience."
      ]
    })
  }),

  // ─── Banker ────────────────────────────────────────────────────────────────
  // Cautious, risk-aware, thinks in terms of costs and returns. References
  // ledgers, investments, and calculations. Values security over adventure.

  banker: Object.freeze({
    name: "Banker",
    traits: ["cautious", "risk-aware", "calculating"],
    quotes: Object.freeze({
      weather: [
        "The cost of being caught in a storm far exceeds the benefit of saving an hour. Let us make camp now.",
        "I have calculated our supply consumption against the forecast. If this weather holds, we are within margin.",
        "Prudent travelers prepare for the worst. I suggest we inventory our provisions before the rain arrives.",
        "Weather is the one variable we cannot hedge against. All we can do is minimize our exposure."
      ],
      illness: [
        "Illness is a liability we cannot afford right now. We must quarantine and protect our productive members.",
        "The medical supplies are a finite resource. We should allocate them carefully and track every dose.",
        "A sick party member reduces our travel speed by at least twenty percent. The economic impact is significant.",
        "Prevention is always cheaper than cure. We should have boiled that water at the last creek."
      ],
      encounter: [
        "Before we engage, let us assess: what do they want, what do they offer, and what is our risk?",
        "I am not opposed to negotiation, but I insist on knowing our bottom line before we begin.",
        "Strangers represent an unknown variable. I prefer to keep our distance until we can evaluate their intentions.",
        "Every interaction on this trail has a cost. Let us ensure the return justifies the expenditure."
      ],
      terrain: [
        "This route adds two days to our journey but reduces the risk of wagon damage. The math favors the longer path.",
        "The grade is too steep for a loaded wagon. The cost of a broken axle far outweighs the time we save.",
        "I have mapped three possible routes. The middle option offers the best balance of speed and safety.",
        "We are consuming provisions at an unsustainable rate on this terrain. We must find a more efficient path."
      ],
      opportunity: [
        "I need to see the terms clearly before I can advise. What is the investment, and what is the expected return?",
        "This opportunity carries significant risk. I recommend we allocate no more than ten percent of our reserves.",
        "A wise investor diversifies. Let us not commit everything to a single venture, no matter how promising.",
        "I have run the numbers twice. The opportunity is sound, but only if we limit our exposure."
      ],
      moral: [
        "Principles are a form of capital — they appreciate over time if you invest in them consistently.",
        "I believe in fair dealing because it reduces transaction costs. Trust is the most efficient currency.",
        "Every decision has a moral ledger attached to it. I intend to keep mine in the black.",
        "The safest investment is a clear conscience. It pays dividends no market can take away."
      ]
    })
  })
});

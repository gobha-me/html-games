/**
 * Oregon Trail — Desert & River Regional Flavor (Legs 9–12)
 *
 * Regional flavor data for the final section of the journey:
 *   Leg 9: Fort Hall, ID → Snake River Desert
 *   Leg 10: Snake River → Blue Mountains, Oregon
 *   Leg 11: Blue Mountains → Columbia River
 *   Leg 12: Columbia River → Willamette Valley, Oregon
 *
 * Each leg includes:
 *   - name, distance, start/end locations
 *   - 2–3 landmarks with descriptions and historical notes
 *   - flavor text keyed by time-of-day for event backgrounds
 *
 * All locations and descriptions are historically grounded in the 1848
 * Oregon Trail migration experience.
 *
 * Loadable by the event-runner for contextual event display.
 *
 * @module desert-region-data
 */

export const DESERT_REGION_DATA = Object.freeze({
  legs: [
    // ─── Leg 9: Fort Hall → Snake River Desert ───────────────────────────
    {
      id: "leg_9_fort_hall_to_snake_river_desert",
      name: "Fort Hall to the Snake River Desert",
      distance: "~120 miles",
      start: "Fort Hall, Idaho Territory",
      end: "Snake River, near Massacre Rocks",
      landmarks: [
        {
          name: "Fort Hall",
          description:
            "A modest adobe trading post on the banks of the Snake River — " +
            "the last outpost of civilization for hundreds of miles. The fort " +
            "is surrounded by a low log wall, and inside are a few rough " +
            "buildings, a corral, and the Hudson's Bay Company factor who " +
            "greets every party with the same warning: 'The desert ahead " +
            "will test you.' Supplies can be purchased here, but prices are " +
            "steep, and the shelves are often bare by midsummer.",
          historicalNote:
            "Fort Hall was established in 1834 by Nathaniel Wyeth and sold " +
            "to the Hudson's Bay Company in 1837. It sat at a critical " +
            "junction on the Oregon Trail — the point where the trail split " +
            "toward Oregon (west) and California (southwest). In 1848, it " +
            "was the last reliable resupply point before the grueling Snake " +
            "River Plain crossing. Many emigrants arrived exhausted and " +
            "understocked, hoping to replenish here. The fort's factor, " +
            "often a Scottish or French-Canadian trader, was known for " +
            "charging exorbitant prices to desperate parties."
        },
        {
          name: "American Falls",
          description:
            "A dramatic cascade on the Snake River where the water plunges " +
            "over a basalt ledge into a churning pool below. The falls are " +
            "not as tall as Niagara, but they are wild and untamed — the " +
            "river here is wide and powerful, cutting through volcanic rock " +
            "that stretches to the horizon. The spray catches the sunlight " +
            "in rainbows that seem impossibly bright against the dark stone. " +
            "The party stops to rest and refill water barrels.",
          historicalNote:
            "American Falls on the Snake River was a notable landmark for " +
            "Oregon Trail emigrants. The falls were named by fur trappers " +
            "in the 1820s and appeared on maps used by trail guides. In " +
            "1848, the falls were much more impressive than they are today — " +
            "a dam built in the 1970s flooded the original cascade. The " +
            "original falls dropped roughly 50 feet and were a welcome " +
            "sight after days of monotonous desert travel."
        },
        {
          name: "Massacre Rocks & Register Rock",
          description:
            "A narrow passage where the trail squeezes between towering " +
            "basalt formations that crowd the Snake River. The rocks are " +
            "dark, jagged, and imposing — the name comes from a skirmish " +
            "between emigrants and Shoshone warriors in 1862, but the " +
            "passage was feared long before that. Beside the trail, " +
            "Register Rock bears the carved names of hundreds who passed " +
            "this way, their knives scratching into the volcanic stone. " +
            "The party moves through quickly, eyes on the shadows.",
          historicalNote:
            "Massacre Rocks was a notorious section of the Oregon Trail " +
            "where the Snake River canyon narrowed to a tight passage " +
            "between basalt cliffs. The name dates to an 1862 attack, but " +
            "emigrants in the 1840s already regarded the area with dread. " +
            "Register Rock, located nearby, was another 'signature rock' " +
            "like Independence Rock — emigrants carved their names into " +
            "its surface as proof of passage. The rock still bears " +
            "inscriptions today, preserved as a historic site."
        }
      ],
      flavorText: {
        morning:
          "The Snake River Plain opens before the party like a vast, " +
          "sun-baked bowl. The air shimmers with heat even at dawn, " +
          "and the volcanic soil is pale and cracked. Sagebrush dots " +
          "the landscape in every direction — the only green for miles. " +
          "The trail is a ribbon of dust winding westward, and the " +
          "mountains are still a distant rumor on the horizon.",
        midday:
          "The desert is merciless. The sun beats down on the wagons, " +
          "baking the wooden wheels until the spokes groan. Dust coats " +
          "everything — lips, eyelashes, the food in the barrels. The " +
          "Snake River is visible in the distance, a thin silver thread " +
          "cutting through the basalt plain, but reaching it means " +
          "navigating treacherous lava flows and steep canyon walls. " +
          "The oxen plod forward, heads low, tongues hanging.",
        evening:
          "The party camps on a shelf of volcanic rock overlooking the " +
          "Snake River. The water below is dark and fast, churning " +
          "around black boulders. The sunset paints the canyon walls " +
          "in shades of rust and gold, and for a moment the desert " +
          "looks almost beautiful. But the beauty is hard-won, and " +
          "the party knows the worst of the desert still lies ahead.",
        campfire:
          "The wagon master writes: 'Fort Hall is behind us, and the " +
          "desert stretches before us like a punishment. The Snake River " +
          "Plain is the hardest country I have ever crossed — no water, " +
          "no grass, nothing but rock and dust and heat. The oxen are " +
          "suffering. We lost a wheel today to the lava beds. But we " +
          "press on. Oregon is still ahead, and we will reach it or ' +
          'die trying.'",
      }
    },

    // ─── Leg 10: Snake River → Blue Mountains ────────────────────────────
    {
      id: "leg_10_snake_river_to_blue_mountains",
      name: "Snake River to the Blue Mountains",
      distance: "~90 miles",
      start: "Snake River, near Massacre Rocks",
      end: "Blue Mountains, Oregon Territory",
      landmarks: [
        {
          name: "Burnt River",
          description:
            "A narrow, alkaline stream winding through a canyon of " +
            "weathered basalt. The water has a faint sulfurous smell, " +
            "and the banks are stained white with mineral deposits. " +
            "Despite the name, the river was not burnt by fire — " +
            "early trappers called it 'Brulé' (burnt) because the " +
            "surrounding hills were bare and dark, as if scorched. " +
            "The party fills their barrels cautiously, knowing that " +
            "water is water, whatever it tastes like.",
          historicalNote:
            "The Burnt River was named by French-Canadian fur trappers " +
            "who called it 'Rivière Brûlée' — 'burnt river' — because " +
            "the surrounding hills appeared scorched and barren. The " +
            "river flows through a deep canyon and was a critical water " +
            "source for emigrants crossing the Snake River Plain. In " +
            "1848, the trail followed the Burnt River for several miles, " +
            "and the canyon provided a rare stretch of shade and " +
            "relative comfort in an otherwise brutal landscape."
        },
        {
          name: "Powder River",
          description:
            "A clear, cold stream cutting through a valley of tall grass " +
            "and scattered pines — the first real green the party has " +
            "seen in weeks. The Powder River runs fast and deep, fed by " +
            "snowmelt from the Blue Mountains ahead. The banks are lush " +
            "with willow and cottonwood, and the oxen graze greedily on " +
            "the fresh grass. For the first time in days, the party feels " +
            "something like relief.",
          historicalNote:
            "The Powder River marked a significant transition on the " +
            "Oregon Trail — the point where the high desert gave way to " +
            "the forested slopes of eastern Oregon. Emigrants who had " +
            "endured weeks of dust and heat found the Powder River valley " +
            "almost paradisiacal. The river was named for the fine, " +
            "powdery soil along its banks, not for gunpowder. In 1848, " +
            "the valley was still largely untouched by settlement, and " +
            "the grass grew waist-high in places."
        },
        {
          name: "Blue Mountains",
          description:
            "A wall of dark, forested peaks rising from the eastern " +
            "Oregon plateau — the Blue Mountains are the last major " +
            "obstacle before the Columbia River. The trail climbs " +
            "steadily through stands of ponderosa pine and Douglas fir, " +
            "the air growing cooler and damper with each mile. The " +
            "mountains are called 'blue' because of the hazy, blue-tinted " +
            "atmosphere created by the volatile oils in the pine needles. " +
            "The trail is rough, rocky, and steep, and the wagons must " +
            "be carefully guided around boulders and through ravines.",
          historicalNote:
            "The Blue Mountains were among the most difficult terrain " +
            "on the Oregon Trail. The trail climbed roughly 4,000 feet " +
            "in elevation, winding through dense forests and over rocky " +
            "ridges. In 1848, there were no roads — only wagon tracks " +
            "cut by previous parties. The ascent took several days, and " +
            "emigrants often had to double-team their wagons, using extra " +
            "oxen to pull them up the steepest grades. The descent on " +
            "the western side was equally treacherous, with narrow " +
            "switchbacks and loose gravel."
        }
      ],
      flavorText: {
        morning:
          "The desert is finally behind them. The land rises gradually " +
          "into rolling hills dotted with sage and juniper, and the air " +
          "carries a faint scent of pine from the mountains ahead. The " +
          "party moves with renewed energy — the Blue Mountains are " +
          "visible now, dark and forested against the pale sky. The " +
          "trail is still rough, but the ground is firmer, and the " +
          "water is better.",
        midday:
          "The climb into the Blue Mountains is grueling. The trail " +
          "winds through dense stands of pine, the canopy blocking " +
          "much of the sun but trapping the heat below. The air is " +
          "thick with the smell of resin and damp earth. The wagons " +
          "creak and groan on the steep grades, and the men strain " +
          "against the wheels, pushing from behind. But the forest " +
          "is alive — birds call from the branches, and the sound of " +
          "a hidden stream echoes through the trees.",
        evening:
          "Camp is set in a meadow high in the Blue Mountains. The " +
          "air is cool and crisp, and the stars are impossibly bright " +
          "above the tree line. The party gathers around the fire, " +
          "exhausted but in good spirits. For the first time in weeks, " +
          "there is plenty of firewood, and the flames roar. Someone " +
          "sings a low, wordless tune — a song from home, half-remembered.",
        campfire:
          "The wagon master writes: 'We are in the Blue Mountains now, " +
          "and the change is like stepping into another world. After " +
          "weeks of desert, the forest feels like a cathedral. The " +
          "pines are tall and straight, and the air smells of resin " +
          "and rain. The trail is rough — we broke an axle today and " +
          "had to spend hours repairing it by firelight — but the " +
          "water is good, the grass is green, and the mountains are " +
          "behind us soon. Oregon is close. I can feel it.'",
      }
    },

    // ─── Leg 11: Blue Mountains → Columbia River ─────────────────────────
    {
      id: "leg_11_blue_mountains_to_columbia_river",
      name: "Blue Mountains to the Columbia River",
      distance: "~80 miles",
      start: "Blue Mountains, Oregon Territory",
      end: "Columbia River, near The Dalles",
      landmarks: [
        {
          name: "Grande Ronde Valley",
          description:
            "A broad, fertile valley cradled between the Blue Mountains " +
            "and the Cascades — the Grande Ronde is a patchwork of " +
            "meadow, stream, and scattered oak groves. The soil is rich " +
            "and dark, and the grass grows thick and green. Emigrant " +
            "parties often linger here for days, resting their animals " +
            "and repairing wagons before the final push. The valley is " +
            "quiet and peaceful, a stark contrast to the desert that " +
            "came before.",
          historicalNote:
            "The Grande Ronde Valley was a critical rest stop on the " +
            "Oregon Trail. Located in northeastern Oregon, the valley " +
            "provided abundant grass, water, and timber for exhausted " +
            "emerging parties. In 1848, the valley was still largely " +
            "uninhabited by settlers, though Native American tribes — " +
            "primarily the Nez Perce and Cayuse — had used the area " +
            "for generations. Many emigrants considered the Grande Ronde " +
            "the most beautiful place they had seen on the entire journey."
        },
        {
          name: "John Day River Crossing",
          description:
            "A wide, swift river cutting through a canyon of layered " +
            "sandstone and basalt. The John Day is one of the last " +
            "major river crossings before the Columbia, and it is " +
            "notoriously difficult — the current is strong, the banks " +
            "are steep, and the water level varies wildly with the " +
            "season. The party must decide whether to ford the river, " +
            "build a raft, or pay a ferry operator if one can be found. " +
            "The canyon walls echo with the sound of rushing water.",
          historicalNote:
            "The John Day River was named after John Day, a hunter " +
            "with the Astor Expedition of 1811–1812. The river was a " +
            "significant obstacle on the Oregon Trail, and many parties " +
            "lost wagons, livestock, and supplies attempting to cross " +
            "it. In 1848, there were no established ferries on this " +
            "stretch, so emigrants had to ford the river themselves or " +
            "construct makeshift rafts. The river's name was sometimes " +
            "confused with the nearby John Day Fossil Beds, but the " +
            "connection is purely historical."
        },
        {
          name: "Columbia River Gorge",
          description:
            "The Columbia River appears suddenly — a vast, powerful " +
            "waterway cutting through a dramatic gorge of sheer basalt " +
            "cliffs. The river is wide and deep, moving with the force " +
            "of a continent's worth of snowmelt. Waterfalls cascade " +
            "down the gorge walls, and the air is thick with mist and " +
            "the sound of rushing water. The party stands at the edge " +
            "of the gorge and stares, awestruck. This is the gateway " +
            "to the Willamette Valley — and the final leg of the journey.",
          historicalNote:
            "The Columbia River Gorge was the great natural gateway to " +
            "the Oregon Country. Carved by the Columbia River over " +
            "millions of years, the gorge is 80 miles long and up to " +
            "4,000 feet deep. In 1848, emigrants faced a critical " +
            "decision here: float down the Columbia on rafts (dangerous " +
            "but fast) or take the Barlow Road around Mount Hood " +
            "(safer but expensive and slow). Many parties chose the " +
            "river route, and some lost everything to the rapids. The " +
            "gorge was also home to Native American villages of the " +
            "Chinook and Wasco peoples, who had lived along the river " +
            "for thousands of years."
        }
      ],
      flavorText: {
        morning:
          "The descent from the Blue Mountains reveals a landscape " +
          "transformed. The Grande Ronde Valley spreads below like a " +
          "green carpet, dotted with wildflowers and threaded with " +
          "streams. The air is warm and sweet, carrying the scent of " +
          "grass and wild rose. The party moves slowly, savoring the " +
          "beauty after weeks of hardship. The Columbia River is " +
          "ahead now — close enough to feel.",
        midday:
          "The John Day River crossing is a trial of nerve and skill. " +
          "The water is cold and fast, and the wagon wheels sink deep " +
          "into the muddy riverbed. The men shout over the roar of " +
          "the current, guiding the oxen through the channel. On the " +
          "far bank, the canyon walls rise steep, their layered rock " +
          "telling the story of ancient floods and volcanic eruptions. " +
          "The party is soaked and exhausted, but everyone made it across.",
        evening:
          "The Columbia River Gorge opens before the party like a " +
          "cathedral of stone and water. The sun sets behind the " +
          "Cascade Range, painting the gorge walls in shades of " +
          "amber and violet. Waterfalls gleam white against the dark " +
          "rock, and the river below moves with a deep, ancient power. " +
          "The party camps on a ledge overlooking the water. Tonight, " +
          "they sleep to the sound of the Columbia — the river that " +
          "will carry them home.",
        campfire:
          "The wagon master writes: 'We have reached the Columbia. " +
          "After months on the trail, after the desert and the mountains " +
          "and the rivers that tried to swallow us, we are here. The " +
          "gorge is the most magnificent thing I have ever seen — " +
          "cliffs of black rock, waterfalls like silver threads, and " +
          "the river itself, wide and brown and unstoppable. Tomorrow " +
          "we begin the final leg. The Willamette Valley is close. " +
          "I can hardly believe we will see it.'",
      }
    },

    // ─── Leg 12: Columbia River → Willamette Valley ──────────────────────
    {
      id: "leg_12_columbia_river_to_willamette_valley",
      name: "Columbia River to the Willamette Valley",
      distance: "~150 miles",
      start: "Columbia River, near The Dalles",
      end: "Willamette Valley, Oregon Territory",
      landmarks: [
        {
          name: "The Dalles",
          description:
            "A rough settlement at the edge of the Columbia River — " +
            "the last major waypoint before the Willamette Valley. " +
            "The Dalles is a cluster of log cabins, a trading post, " +
            "and a mission church, perched on a basalt shelf above " +
            "the river. Emigrants gather here to decide their route: " +
            "float the Columbia's rapids on rafts, or pay the toll " +
            "for the Barlow Road around Mount Hood. The air is thick " +
            "with debate, anxiety, and the smell of river mud.",
          historicalNote:
            "The Dalles was a critical decision point on the Oregon " +
            "Trail. Located at the eastern edge of the Columbia River " +
            "Gorge, it was the last place emigrants could choose between " +
            "the river route and the Barlow Road. The Barlow Road, " +
            "completed in 1846, charged a $5 toll per wagon but avoided " +
            "the deadly Columbia River rapids. Many parties chose the " +
            "river route to save money, and some lost everything when " +
            "their rafts capsized in the Cascades Rapids. The Dalles " +
            "was also home to a Methodist mission established in 1838."
        },
        {
          name: "Mount Hood",
          description:
            "A massive, snow-capped volcano rising above the Columbia " +
            "River Gorge — Mount Hood dominates the western horizon, " +
            "its peak gleaming white against the blue sky. The Barlow " +
            "Road winds around its southern flank, a rough track through " +
            "dense forest and over steep ridges. The mountain is both " +
            "beautiful and intimidating, a reminder that the journey " +
            "is not over yet. The party can see the mountain for days " +
            "as they approach, its presence growing larger with each mile.",
          historicalNote:
            "Mount Hood, named after British Admiral Samuel Hood, was " +
            "first seen by European explorers in 1792. The Barlow Road, " +
            "built by Samuel Barlow in 1846, was the last overland route " +
            "on the Oregon Trail, winding around the southern side of " +
            "Mount Hood to reach the Willamette Valley. The road was " +
            "notoriously difficult — steep, muddy, and expensive — but " +
            "it was safer than the Columbia River rapids. In 1848, " +
            "the Barlow Road was still relatively new, and many emigrants " +
            "complained about its condition and the toll."
        },
        {
          name: "Willamette Valley",
          description:
            "The valley opens before the party like a promise fulfilled — " +
            "a vast, fertile expanse of green meadow, oak savanna, and " +
            "winding streams. The soil is dark and rich, the grass is " +
            "knee-high, and the air smells of wildflowers and damp earth. " +
            "In the distance, the Willamette River meanders north toward " +
            "the Columbia, and beyond it, the scattered cabins of the " +
            "first settlers dot the landscape. The party stops. The " +
            "wagons halt. For a long moment, no one speaks. They have " +
            "arrived.",
          historicalNote:
            "The Willamette Valley was the ultimate destination for most " +
            "Oregon Trail emigrants. Stretching roughly 150 miles from " +
            "north to south, the valley was one of the most fertile " +
            "regions in North America, with rich alluvial soil, abundant " +
            "rainfall, and a mild climate. In 1848, the valley was " +
            "already home to several thousand American settlers, as well " +
            "as Native American tribes — primarily the Kalapuya peoples — " +
            "who had lived there for millennia. The Donation Land Claim " +
            "Act of 1850 would soon bring a flood of new settlers, but " +
            "in 1848, the valley was still largely open land, waiting " +
            "to be claimed."
        }
      ],
      flavorText: {
        morning:
          "The morning is cool and misty, the Columbia River shrouded " +
          "in fog. The party rises early, eager to begin the final " +
          "leg. Mount Hood is visible in the distance, its snow-capped " +
          "peak catching the first light of dawn. The trail ahead is " +
          "rough — the Barlow Road is little more than a wagon track " +
          "through the forest — but the destination is real now. The " +
          "Willamette Valley is close. The party moves with purpose.",
        midday:
          "The Barlow Road is a test of endurance. The trail climbs " +
          "and descends through dense forest, the wagon wheels sinking " +
          "into mud and the oxen straining against their yokes. The " +
          "air is thick with the smell of pine and damp earth, and " +
          "the forest canopy blocks most of the sun. But the party " +
          "presses on, driven by the knowledge that the valley is " +
          "just beyond the next ridge. Every mile is a mile closer " +
          "to home.",
        evening:
          "The Willamette Valley reveals itself in the golden light " +
          "of late afternoon — a vast, green expanse stretching to " +
          "the horizon, dotted with oak trees and threaded with " +
          "streams. The party stands at the edge of the valley and " +
          "looks out over the land they have traveled two thousand " +
          "miles to reach. Some weep. Some laugh. Some simply stand " +
          "in silence, taking it in. The journey is over. The work " +
          "of building a new life is about to begin.",
        campfire:
          "The wagon master writes: 'We have reached the Willamette " +
          "Valley. After six months on the trail, after the plains and " +
          "the mountains and the desert and the rivers, we are here. " +
          "The valley is more beautiful than I imagined — green and " +
          "fertile and full of promise. We will claim our land, build " +
          "our cabin, and plant our crops. The journey has been long " +
          "and hard, and we have lost things along the way — a wagon, " +
          "an ox, a friend. But we are here. We made it. Oregon is " +
          "our home now.'",
      }
    },
  ],

  regionName: "Snake River & Willamette Valley",
  regionDescription:
    "The final stretch of the Oregon Trail — from the harsh Snake River " +
    "Desert through the forested Blue Mountains, down the Columbia River " +
    "Gorge, and into the fertile Willamette Valley. This section tests " +
    "the party's endurance one last time before the journey's end, " +
    "offering both the most brutal terrain and the most breathtaking " +
    "landscapes of the entire trail.",
});

/**
 * Oregon Trail — Mountains Regional Flavor (Legs 5–8)
 *
 * Regional flavor data for the mountain section of the journey:
 *   Leg 5: Fort Laramie, WY → Independence Rock
 *   Leg 6: Independence Rock → South Pass (Continental Divide)
 *   Leg 7: South Pass → Fort Bridger
 *   Leg 8: Fort Bridger → Fort Hall, Idaho
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
 * @module mountains-region-data
 */

export const MOUNTAINS_REGION_DATA = Object.freeze({
  legs: [
    // ─── Leg 5: Fort Laramie → Independence Rock ─────────────────────────
    {
      id: "leg_5_fort_laramie_to_independence_rock",
      name: "Fort Laramie to Independence Rock",
      distance: "~120 miles",
      start: "Fort Laramie, Wyoming Territory",
      end: "Independence Rock, Wyoming",
      landmarks: [
        {
          name: "North Platte River Crossings",
          description:
            "The trail follows the North Platte River west from Fort " +
            "Laramie, crossing and recrossing its braided channels. " +
            "The water runs clearer here than in Nebraska, fed by " +
            "snowmelt from the Laramie Range. The riverbanks are " +
            "lined with sagebrush and scattered cottonwoods, and the " +
            "valley narrows as the land begins to rise.",
          historicalNote:
            "The North Platte served as the trail's highway through " +
            "southern Wyoming. In 1848, emigrants crossed the river " +
            "dozens of times along this stretch, sometimes fording " +
            "shallow channels and sometimes hiring ferry operators at " +
            "established crossings. The river's cold, clear water was " +
            "a welcome improvement over the silty Platte of Nebraska."
        },
        {
          name: "Register Cliff",
          description:
            "A low sandstone wall beside the trail, its surface covered " +
            "in names, dates, and messages carved by emigrants who " +
            "passed before. The party stops to add their own marks — " +
            "a ritual as old as the trail itself. The soft stone yields " +
            "easily to a knife blade, and the cliff face is a palimpsest " +
            "of ambition and anxiety.",
          historicalNote:
            "Register Cliff was one of several 'signature rocks' along " +
            "the Oregon Trail where emigrants carved their names. Located " +
            "about 15 miles west of Fort Laramie, its sandstone face " +
            "bears hundreds of inscriptions from the 1840s–1860s. " +
            "Many of these carvings are still visible today. The practice " +
            "served both as proof of passage and as a psychological " +
            "anchor — a way of saying 'I was here' in a landscape that " +
            "otherwise offered no permanence."
        },
        {
          name: "Independence Rock",
          description:
            "A massive granite dome rising from the high desert — the " +
            "most famous landmark in Wyoming. Emigrants called it the " +
            "'Register of the Desert' because its surface is covered " +
            "with carved names, painted messages, and axle-grease " +
            "signatures. The tradition held that reaching Independence " +
            "Rock by July 4th meant the party was on schedule to cross " +
            "the mountains before winter. The rock is scarred, graffitied, " +
            "and magnificent.",
          historicalNote:
            "Independence Rock was the great psychological milestone of " +
            "the Oregon Trail. Standing 136 feet tall and nearly 1,900 " +
            "feet long, it dominated the Sweetwater River valley. The " +
            "'July 4th deadline' was real — parties that arrived after " +
            "early July risked being caught by snow in the mountains. " +
            "An estimated 50,000 emigrants passed this rock, and many " +
            "left their mark. Some carved names; others painted them with " +
            "a mixture of axle grease and lampblack. The rock remains " +
            "one of the most significant historic sites on the trail."
        }
      ],
      flavorText: {
        morning:
          "The Laramie Range rises blue and distant to the west. The " +
          "air is thin and cold — the party can see their breath in " +
          "the dawn light. The trail climbs steadily out of the North " +
          "Platte valley, and the vegetation shifts from cottonwood to " +
          "sagebrush. The land feels older here, harder.",
        midday:
          "The high desert stretches in every direction — a vast expanse " +
          "of sage, dust, and sky. The sun is fierce at this altitude, " +
          "and the glare off the pale soil forces everyone to squint. " +
          "Water is found at the river crossings, but between them the " +
          "wagons bake. The men's lips crack and bleed.",
        evening:
          "Independence Rock appears in the late afternoon light — a " +
          "great gray whale breaching from the desert floor. The party " +
          "falls silent as they approach. One by one, they touch the " +
          "rock, run their fingers over the carved names of those who " +
          "came before. Camp is set at its base. Tonight, they sleep " +
          "in the shadow of history.",
        campfire:
          "The wagon master writes: 'Reached Independence Rock. We are " +
          "on schedule — thank God for that. The rock is covered in " +
          "names, some fresh, some weathered to ghosts. I added ours " +
          "to the south face. The mountains are ahead now, real and " +
          "imposing. The desert has been hard but fair. We press on.'"
      }
    },

    // ─── Leg 6: Independence Rock → South Pass ───────────────────────────
    {
      id: "leg_6_independence_rock_to_south_pass",
      name: "Independence Rock to South Pass",
      distance: "~90 miles",
      start: "Independence Rock, Wyoming",
      end: "South Pass, Wyoming (Continental Divide)",
      landmarks: [
        {
          name: "Sweetwater River",
          description:
            "A cold, clear river winding through the high desert — the " +
            "trail's companion for days. The Sweetwater runs east, " +
            "toward the Missouri, and the party follows its valley " +
            "westward toward the Continental Divide. The river is " +
            "shallow enough to ford in most places, and its banks " +
            "offer the only reliable water for miles. The sound of " +
            "running water is a constant comfort.",
          historicalNote:
            "The Sweetwater River was the trail's guide through the " +
            "most desolate stretch of the journey. Emigrants followed " +
            "it for roughly 80 miles, crossing it nine times as the " +
            "trail wound back and forth across its meandering course. " +
            "The river's name was ironic — the water was cold and " +
            "clean, but the alkali flats along its banks left a bitter " +
            "taste. Still, it was drinkable, and that made it precious."
        },
        {
          name: "Devil's Gate",
          description:
            "A narrow gorge where the Sweetwater River cuts through " +
            "a ridge of ancient rock — the walls rise sheer on both " +
            "sides, and the river thunders through a channel barely " +
            "twenty feet wide. The trail climbs above the gorge on " +
            "a rocky ledge, and looking down into the churning water " +
            "makes even the bravest wagon master uneasy. It is a place " +
            "of raw, indifferent power.",
          historicalNote:
            "Devil's Gate was one of the most dramatic geological " +
            "features on the Oregon Trail. The gorge was carved by " +
            "the Sweetwater River over millions of years, cutting " +
            "through Precambrian granite and gneiss. Emigrants in 1848 " +
            "described it with a mixture of awe and terror. Some refused " +
            "to look down; others stood transfixed. It marked the " +
            "approach to South Pass and the Continental Divide — the " +
            "highest point on the entire journey."
        },
        {
          name: "South Pass",
          description:
            "The Continental Divide — but not a dramatic mountain pass. " +
            "Instead, it is a broad, gentle saddle in the high plains, " +
            "barely noticeable until the wagon master announces that " +
            "the water now flows west. The elevation is over 7,500 feet. " +
            "The air is thin, the wind is constant, and the view stretches " +
            "to the snow-capped Wind River Range in the distance. " +
            "The party has crossed the backbone of the continent.",
          historicalNote:
            "South Pass was the key to the Oregon Trail — a broad, " +
            "gradual pass through the Rocky Mountains that allowed " +
            "wagons to cross the Continental Divide without climbing " +
            "steep grades. Discovered by Robert Stuart in 1812 and " +
            "popularized by the fur trade, it was the only practical " +
            "wagon route through the Rockies. In 1848, thousands of " +
            "emigrants crossed it, most barely realizing they had " +
            "reached the divide until they noticed the change in " +
            "water flow. It remains one of the most important " +
            "geographic features in American westward expansion."
        }
      ],
      flavorText: {
        morning:
          "Frost coats the sagebrush at dawn — the first real cold " +
          "the party has felt since leaving Missouri. The Sweetwater " +
          "valley stretches west, narrowing between low hills. The " +
          "Wind River Range glows pink in the early light, snow-capped " +
          "and impossibly distant. The party wraps in blankets and " +
          "drives on.",
        midday:
          "The land rises steadily, and the air grows thinner. Devil's " +
          "Gate appears ahead — a dark slit in the rock, the river " +
          "roaring through it like a trapped beast. The trail climbs " +
          "above the gorge, and the wind here is fierce enough to " +
          "push a man sideways. The party crosses in silence, eyes " +
          "forward, hands tight on the reins.",
        evening:
          "South Pass is not a peak but a plateau — a wide, windswept " +
          "expanse of sage and rock at the top of the continent. The " +
          "sun sets behind the Wind River Range, painting the snow in " +
          "gold and crimson. The party camps on the divide itself, " +
          "the water from their canteen flowing west if spilled. " +
          "It feels like standing on the roof of the world.",
        campfire:
          "The wagon master's hand shakes slightly as he writes — " +
          "whether from cold or emotion, he cannot say: 'We crossed " +
          "the divide today. South Pass — the backbone of the continent, " +
          "and we walked right over it like it was nothing. The water " +
          "runs west now. We are on the far side of the mountains, " +
          "and the hardest part is still ahead. But we are alive, " +
          "and we are moving. That is enough.'"
      }
    },

    // ─── Leg 7: South Pass → Fort Bridger ────────────────────────────────
    {
      id: "leg_7_south_pass_to_fort_bridger",
      name: "South Pass to Fort Bridger",
      distance: "~110 miles",
      start: "South Pass, Wyoming",
      end: "Fort Bridger, Wyoming Territory",
      landmarks: [
        {
          name: "Green River Crossing",
          description:
            "A wide, swift river cutting through red sandstone canyons — " +
            "the Green River flows south from the Wind River Range, " +
            "and the trail must cross it at a designated ford. The " +
            "water is cold and deep, and the current can sweep a wagon " +
            "off its wheels. A ferry operates here during peak season, " +
            "but the fee is steep, and some parties choose to risk " +
            "the ford instead.",
          historicalNote:
            "The Green River crossing was one of the most dangerous " +
            "river fords on the Oregon Trail. In 1848, Jim Bridger " +
            "and Louis Vasquez had established a ferry service near " +
            "their trading post, charging $3–$8 per wagon — a significant " +
            "expense for emigrants. Those who attempted to ford the " +
            "river risked losing wagons, supplies, and sometimes lives. " +
            "The river's name was given by fur trappers for its clear, " +
            "greenish hue, caused by suspended glacial silt."
        },
        {
          name: "Big Sandy River",
          description:
            "A shallow, sandy-bottomed stream that seems harmless until " +
            "the wagons sink to their axles in the soft riverbed. " +
            "The party must unload wagons, carry supplies across by " +
            "hand, and then coax the empty wagons through the muck. " +
            "It is exhausting, frustrating work — the kind that tests " +
            "patience and tempers.",
          historicalNote:
            "The Big Sandy River was notorious among emigrants for its " +
            "deceptively soft riverbed. Despite its modest size, the " +
            "sandy bottom could bog down heavily loaded wagons, forcing " +
            "parties to spend hours or even a full day extracting them. " +
            "Many diarists complained bitterly about the Big Sandy, " +
            "calling it the most aggravating obstacle on the trail — " +
            "not because it was dangerous, but because it was tedious."
        },
        {
          name: "Fort Bridger",
          description:
            "A rough-hewn trading post built of log and adobe, perched " +
            "on a rise above the Black's Fork of the Green River. " +
            "The fort is part trading post, part waystation, part " +
            "tavern — a place where mountain men, Native Americans, " +
            "Mormon pioneers, and Oregon emigrants converge. The air " +
            "smells of woodsmoke, cured meat, and unwashed bodies. " +
            "Jim Bridger himself may be behind the counter, spinning " +
            "tall tales for anyone who'll listen.",
          historicalNote:
            "Fort Bridger was founded in 1843 by mountain man Jim " +
            "Bridger and Louis Vasquez as a trading post for emigrants " +
            "and fur trappers. By 1848, it was a well-established stop " +
            "on the Oregon Trail, offering supplies, blacksmith services, " +
            "and — most importantly — information about the road ahead. " +
            "Bridger was a legendary figure: a trapper, guide, and " +
            "storyteller who claimed to have seen geysers before " +
            "Yellowstone was known to the world. The fort would later " +
            "be sold to the Mormon Church and then to the U.S. Army, " +
            "but in 1848 it was still a frontier outpost run by " +
            "mountain men."
        }
      ],
      flavorText: {
        morning:
          "The descent from South Pass is gradual but steady. The " +
          "land drops away, and the air grows slightly warmer. Sagebrush " +
          "gives way to greener vegetation — the Green River valley " +
          "is visible in the distance, a ribbon of life in the high " +
          "desert. The party moves with renewed energy; Fort Bridger " +
          "is within reach.",
        midday:
          "The Green River crossing demands attention. The ferry is " +
          "busy — three parties ahead, each arguing about the fee. " +
          "The water below is green and cold, churning over rocks " +
          "that could split a wagon bed. The party debates: pay the " +
          "ferryman or risk the ford? The wagon master decides. " +
          "Everyone holds their breath as the first wagon enters " +
          "the water.",
        evening:
          "Fort Bridger's ragged buildings come into view as the sun " +
          "drops behind the Uinta Mountains. The fort is not much to " +
          "look at — a collection of logs and hides — but it represents " +
          "safety, supplies, and human company. The party makes camp " +
          "on a rise overlooking the Black's Fork. Tonight, they will " +
          "trade, eat something other than salt pork, and sleep without " +
          "one eye open for wolves.",
        campfire:
          "The wagon master writes: 'Fort Bridger at last. A rough " +
          "place, but it has what we need — flour, coffee, and news. " +
          "Bridger himself was at the counter, telling a story about " +
          "a grizzly bear the size of a house. Half the men believed " +
          "him. We traded for fresh nails and had our wagon tires " +
          "reset. Tomorrow we push on toward Fort Hall. The road " +
          "gets harder from here, but we are seasoned now. The plains " +
          "broke us in; the mountains tested us; we are still rolling.'"
      }
    },

    // ─── Leg 8: Fort Bridger → Fort Hall ─────────────────────────────────
    {
      id: "leg_8_fort_bridger_to_fort_hall",
      name: "Fort Bridger to Fort Hall",
      distance: "~210 miles",
      start: "Fort Bridger, Wyoming Territory",
      end: "Fort Hall, Idaho Territory",
      landmarks: [
        {
          name: "Bear River Valley",
          description:
            "The trail follows the Bear River north through a broad " +
            "valley flanked by rolling hills and scattered pine forests. " +
            "The river is wide and meandering, its banks lined with " +
            "willows and cottonwoods. The land is greener here than " +
            "anything seen since Kansas, and the party grazes their " +
            "animals freely. But the valley is also home to mosquitoes " +
            "in numbers that defy belief — clouds of them that drive " +
            "men and animals to distraction.",
          historicalNote:
            "The Bear River valley was a mixed blessing for emigrants. " +
            "Its lush grass and reliable water were welcome after the " +
            "high desert, but the mosquitoes were legendary. Diarists " +
            "described them as 'thick as smoke' and 'the worst plague " +
            "on the trail.' The river itself flows north, then curves " +
            "back south into the Great Salt Lake — a geographic oddity " +
            "that confused many travelers. The valley was also home " +
            "to Shoshone and Bannock bands, who generally traded " +
            "peacefully with emigrant parties."
        },
        {
          name: "Soda Springs",
          description:
            "A bizarre geological wonder — natural springs bubbling " +
            "with carbonated water that tastes of minerals and sulfur. " +
            "The ground around the springs is encrusted with white " +
            "mineral deposits, and steam rises from fissures in the " +
            "earth. Emigrants drink the water, make faces, and then " +
            "drink more, convinced it has medicinal properties. " +
            "One spring has been captured in a stone basin — a " +
            "natural soda fountain in the middle of nowhere.",
          historicalNote:
            "Soda Springs was one of the most unusual stops on the " +
            "Oregon Trail. The carbonated mineral springs were caused " +
            "by volcanic activity beneath the Earth's surface — the " +
            "same geothermal forces that would later create Yellowstone. " +
            "In 1848, emigrants had no scientific explanation for the " +
            "springs, and many attributed them to divine intervention " +
            "or supernatural forces. The stone basin was built by " +
            "Mormon pioneers in 1858, but the springs themselves had " +
            "been a landmark for decades. Many emigrants filled their " +
            "canteens with the fizzy water, believing it could cure " +
            "ailments from dysentery to fatigue."
        },
        {
          name: "Fort Hall",
          description:
            "A Hudson's Bay Company trading post built of adobe and " +
            "timber, standing alone in the high desert of southern " +
            "Idaho. The fort is more substantial than Fort Bridger — " +
            "thick walls, a courtyard, and a small garrison of traders " +
            "in the Company's green uniforms. It marks a critical " +
            "junction: here the Oregon Trail splits from the California " +
            "Trail, and parties must decide their final destination. " +
            "The decision is debated around every campfire.",
          historicalNote:
            "Fort Hall was built by Nathaniel Jarvis Wyeth in 1834 and " +
            "sold to the Hudson's Bay Company in 1837. It became the " +
            "most important landmark in the second half of the Oregon " +
            "Trail — the last major supply point before the long push " +
            "to the Willamette Valley. In 1848, it was operated by " +
            "the HBC under Chief Trader John Reid. The fort sat at " +
            "the critical junction where the Oregon Trail and California " +
            "Trail diverged, and many parties split here — some heading " +
            "northwest to Oregon, others southwest to California. " +
            "The decision was often agonizing, as it determined not " +
            "just a destination but a new life."
        }
      ],
      flavorText: {
        morning:
          "The Bear River valley opens before the party — green, wide, " +
          "and deceptively peaceful. The air is warm and humid, thick " +
          "with the smell of wet grass and standing water. Mosquitoes " +
          "rise from the riverbanks in clouds, and the party slaps " +
          "and curses before the first mile is done. But the grass " +
          "is lush, and the cattle graze with contented lowing. " +
          "It feels almost like home — if home were infested with " +
          "biting insects.",
        midday:
          "Soda Springs appears without warning — a field of white " +
          "mineral crust, bubbling pools, and steam vents hissing " +
          "from the ground. The party gathers around the largest " +
          "spring, dipping canteens and tasting the fizzy water. " +
          "Some gag; others drink deeply, convinced it will cure " +
          "their dysentery. The ground feels warm beneath their " +
          "boots, as if the earth itself is alive.",
        evening:
          "Fort Hall rises from the desert like a mirage — solid, " +
          "real, and surrounded by the vast emptiness of southern " +
          "Idaho. The adobe walls glow amber in the setting sun. " +
          "The party makes camp within sight of the fort, knowing " +
          "that tomorrow brings the great decision: Oregon or " +
          "California. The wagon master calls a council. Tonight, " +
          "they will argue, pray, and decide the course of their " +
          "lives.",
        campfire:
          "The wagon master opens the logbook for what may be the " +
          "last entry before the great fork: 'Fort Hall. We have " +
          "come over two thousand miles — across plains, deserts, " +
          "rivers, and mountains. We have buried friends, lost " +
          "wagons, and found strength we did not know we had. " +
          "Tomorrow we choose: Oregon's green valleys or California's " +
          "golden promise. I do not yet know which way we will turn. " +
          "But I know this — whatever road we take, we take it " +
          "together. And that is the only thing that has kept us " +
          "alive this far.'"
      }
    }
  ]
});

/**
 * Oregon Trail — Plains Regional Flavor (Legs 1–4)
 *
 * Regional flavor data for the first four legs of the journey:
 *   Leg 1: Independence, MO → Kansas Prairie
 *   Leg 2: Kansas Prairie → Fort Kearney, NE
 *   Leg 3: Fort Kearney → Nebraska Plains (Chimney Rock area)
 *   Leg 4: Nebraska Plains → Fort Laramie, WY
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
 * @module plains-region-data
 */

export const PLAINS_REGION_DATA = Object.freeze({
  legs: [
    // ─── Leg 1: Independence, MO → Kansas Prairie ────────────────────────
    {
      id: "leg_1_independence_to_kansas",
      name: "Independence to Kansas Prairie",
      distance: "~100 miles",
      start: "Independence, Missouri",
      end: "Kansas Prairie",
      landmarks: [
        {
          name: "Kaw River (Kansas River) Crossing",
          description:
            "The first major water obstacle after leaving Independence. " +
            "The Kaw River runs wide and muddy, its banks slick with clay. " +
            "Wagons must be carefully guided down the steep approach, " +
            "and the crossing often takes half a day.",
          historicalNote:
            "The Kaw River — named for the Kansa (Kaw) people who lived " +
            "along its banks for centuries — was the first significant " +
            "geographic marker on the trail. Emigrants in 1848 crossed " +
            "near present-day Topeka, where the river was roughly 200 yards " +
            "wide in spring."
        },
        {
          name: "Blue Mills Trading Post",
          description:
            "A rough-hewn cluster of buildings where the trail passes " +
            "near the Missouri River bluffs. Traders sell flour, coffee, " +
            "and salt at inflated prices. The smell of woodsmoke and " +
            "wet leather hangs over the compound.",
          historicalNote:
            "Blue Mills was one of several frontier trading posts that " +
            "sprang up along the early trail. These posts charged premium " +
            "prices for supplies, knowing emigrants had no alternatives " +
            "once they pushed west. Many travelers regretted not buying " +
            "enough in Independence."
        },
        {
          name: "The Tallgrass Prairie",
          description:
            "Beyond the river crossings, the land opens into an ocean of " +
            "grass — bluestem and switchgrass towering over wagon wheels. " +
            "The wind never stops. The horizon stretches impossibly far, " +
            "and the sheer scale of the prairie humbles even the most " +
            "confident wagon master.",
          historicalNote:
            "The tallgrass prairie of eastern Kansas was one of the most " +
            "striking landscapes on the entire trail. In 1848, it extended " +
            "for hundreds of miles, unbroken by fence or farm. Emigrant " +
            "diaries frequently describe the grass as 'waist-high' or " +
            "'higher than a horse's back,' and many noted the psychological " +
            "impact of seeing land so vast it seemed to have no end."
        }
      ],
      flavorText: {
        morning:
          "Dawn breaks over the Missouri River valley. The air is thick " +
          "with humidity and the smell of wet earth. Somewhere in the " +
          "distance, a rooster crows — the last familiar sound before " +
          "the wilderness takes over.",
        midday:
          "The sun beats down on the open prairie. Grasshoppers explode " +
          "from the wagon wheels in clouds. The trail is little more than " +
          "a rutted track through grass that brushes the wagon beds. " +
          "Water is still plentiful, but the party knows it won't last.",
        evening:
          "Camp is pitched on a rise overlooking a creek. The sky turns " +
          "amber, then violet, then a deep indigo pricked with more stars " +
          "than anyone has seen back east. The fire crackles. Someone " +
          "plays a harmonica. For tonight, the trail feels almost peaceful.",
        campfire:
          "The wagon master opens the logbook: 'Day on the trail. " +
          "Ground firm, water adequate. Spirits high — we are adventurers " +
          "now, not farmers. God willing, the prairie stays kind.'"
      }
    },

    // ─── Leg 2: Kansas Prairie → Fort Kearney, NE ────────────────────────
    {
      id: "leg_2_kansas_to_fort_kearney",
      name: "Kansas Prairie to Fort Kearney",
      distance: "~200 miles",
      start: "Kansas Prairie",
      end: "Fort Kearney, Nebraska Territory",
      landmarks: [
        {
          name: "Big Blue River Crossing",
          description:
            "A swift, deep river cutting through limestone bluffs. " +
            "The crossing is treacherous in spring — the current can " +
            "sweep a wagon off its wheels. Emigrants spend hours " +
            "searching for a shallow ford, and many lose supplies to " +
            "the churning water.",
          historicalNote:
            "The Big Blue River crossing was one of the most feared " +
            "water obstacles on the early trail. In 1848, before ferries " +
            "were established, emigrants forded it at a natural shallow " +
            "point near present-day Manhattan, Kansas. Several wagons " +
            "were lost here in the spring floods, and the river claimed " +
            "both supplies and, in at least one recorded case, a life."
        },
        {
          name: "Little Blue River Valley",
          description:
            "After the Big Blue, the Little Blue offers a gentler crossing " +
            "but a longer stretch of trail alongside its banks. Cottonwood " +
            "trees line the water, providing the first real shade in days. " +
            "The party stops to wash clothes and repair wagon tongues.",
          historicalNote:
            "The Little Blue River valley was a welcome respite on the " +
            "trail. Its cottonwood groves provided timber for wagon repairs " +
            "and firewood for cooking. Emigrant journals frequently mention " +
            "stopping here for a full day of rest — one of the last reliable " +
            "water sources before the drier stretches ahead."
        },
        {
          name: "Fort Kearney",
          description:
            "A military outpost rising from the flat Nebraska plains — " +
            "log buildings, a flagpole, and a handful of soldiers in " +
            "blue uniforms. The fort offers a chance to mail letters home, " +
            "trade for fresh provisions, and hear news from parties ahead. " +
            "It feels like civilization, but it's the last for hundreds of miles.",
          historicalNote:
            "Fort Kearney (named for General Stephen W. Kearny, though " +
            "misspelled by the War Department) was established in 1848 " +
            "specifically to protect emigrants on the Oregon Trail. Located " +
            "near present-day Kearney, Nebraska, it sat at the confluence " +
            "of the trail and the Platte River. It served as a vital " +
            "resupply point and the last place to send letters east before " +
            "the long crossing of the high plains."
        }
      ],
      flavorText: {
        morning:
          "Fog clings to the river bottoms at dawn. The party wakes to " +
          "the sound of running water and the lowing of cattle. The trail " +
          "ahead is flat and straight — the Platte River valley stretches " +
          "west like an arrow drawn across the earth.",
        midday:
          "The sun is merciless on the open plains. There is no shade, " +
          "no shelter, nothing but grass and sky. The wagons kick up " +
          "alkali dust that coats the throat and stings the eyes. Water " +
          "from the last creek tasted of minerals, but it's all there is.",
        evening:
          "The wind dies down at sunset, and the prairie goes quiet. " +
          "Buffalo tracks cross the trail — fresh ones. The party debates " +
          "whether to hunt tomorrow or push on. The fort is still days " +
          "away, and every mile feels longer than the last.",
        campfire:
          "The wagon master writes: 'Reached the Platte valley. The fort " +
          "is our next milestone. Rations holding, but the dust is wearing " +
          "on everyone. Saw buffalo sign today — the men are restless to " +
          "hunt. We need the meat, but we can't afford the delay.'"
      }
    },

    // ─── Leg 3: Fort Kearney → Nebraska Plains (Chimney Rock) ────────────
    {
      id: "leg_3_fort_kearney_to_chimney_rock",
      name: "Fort Kearney to Chimney Rock",
      distance: "~150 miles",
      start: "Fort Kearney, Nebraska Territory",
      end: "Chimney Rock, Nebraska",
      landmarks: [
        {
          name: "The Platte River Road",
          description:
            "The trail follows the south fork of the Platte River for " +
            "days — a wide, shallow, sandy-bottomed river that braids " +
            "into countless channels. The water is silty and foul-tasting, " +
            "but it's reliable. The river valley is flat, treeless, and " +
            "endlessly windy.",
          historicalNote:
            "The Platte River road was the backbone of the Oregon Trail " +
            "through Nebraska. Emigrants followed the south fork for over " +
            "200 miles because it guaranteed water — however unpalatable. " +
            "The river's silt content was so high that one diarist wrote, " +
            "'Too thick to drink, too thin to plow.' The alkaline soil " +
            "along its banks left a white crust on wagon wheels and boots."
        },
        {
          name: "Chimney Rock",
          description:
            "A towering spire of clay and sandstone rising nearly 300 feet " +
            "above the valley floor — the first dramatic landmark on the " +
            "entire journey. Every emigrant party stops to stare. It " +
            "signals that the flat plains are ending and the mountains " +
            "are coming. Many carve their names into the soft rock below.",
          historicalNote:
            "Chimney Rock was the most famous landmark on the Oregon Trail. " +
            "Visible for 25 miles across the flat Nebraska plains, it served " +
            "as a psychological milestone — proof that the journey was real " +
            "and progress was being made. Hundreds of emigrants carved their " +
            "names and dates into the soft sandstone at its base. It remains " +
            "one of the most iconic symbols of westward migration."
        },
        {
          name: "Ash Hollow",
          description:
            "A deep, wooded ravine cutting into the plains — a sudden " +
            "oasis of cottonwoods, spring water, and green grass. " +
            "Emigrants camp here for a full day to rest, wash clothes, " +
            "and recover from the monotony of the Platte valley. " +
            "The contrast with the surrounding plains is staggering.",
          historicalNote:
            "Ash Hollow was one of the most beloved campsites on the trail. " +
            "Its spring-fed stream and dense cottonwood groves offered " +
            "shade, clean water, and timber — luxuries that were rare on " +
            "the Nebraska plains. It was also a site of conflict: in 1855, " +
            "the U.S. Army fought the Lakota here, but in 1848 it was " +
            "still a peaceful and welcome stop for emigrants."
        }
      ],
      flavorText: {
        morning:
          "The Platte River shimmers in the dawn light — a braided ribbon " +
          "of sand and muddy water. The wind has already picked up, " +
          "carrying the fine alkali dust that settles on everything. " +
          "The party packs in silence; everyone is tired of the flat land.",
        midday:
          "A shape appears on the horizon — impossibly tall, impossibly " +
          "thin. Chimney Rock. The Optimist points and shouts. Even the " +
          "Skeptic admits it's something to see. The wagons pick up pace. " +
          "For the first time in days, the party has a destination they " +
          "can actually see.",
        evening:
          "Camp is set in the lee of a sandstone bluff. The wind howls " +
          "across the open plain, but here in the hollow it's almost calm. " +
          "The fire burns cottonwood — it smokes badly, but it's warm. " +
          "Chimney Rock is a dark silhouette against the last light.",
        campfire:
          "The wagon master records: 'Chimney Rock at last. Every man in " +
          "the party stood and stared. It is as remarkable as the stories " +
          "promised. We are one day from Ash Hollow, where we will rest. " +
          "The mountains are still far, but the land is beginning to change.'"
      }
    },

    // ─── Leg 4: Nebraska Plains → Fort Laramie, WY ───────────────────────
    {
      id: "leg_4_nebraska_to_fort_laramie",
      name: "Nebraska Plains to Fort Laramie",
      distance: "~175 miles",
      start: "Chimney Rock, Nebraska",
      end: "Fort Laramie, Wyoming Territory",
      landmarks: [
        {
          name: "Courthouse Rock and Jail Rock",
          description:
            "Twin formations of eroded sandstone rising from the plains — " +
            "one broad and flat-topped like a courthouse, the other " +
            "narrower and taller like a jail tower. They appear suddenly " +
            "on the horizon, and the party debates which is which. " +
            "The trail passes close enough to touch the rock.",
          historicalNote:
            "Courthouse Rock and Jail Rock were among the most recognizable " +
            "landmarks on the Nebraska section of the trail. Formed by " +
            "millions of years of erosion, these Brule clay formations " +
            "stood as natural signposts for emigrants. Many diarists " +
            "described them in detail, and some camped at their base. " +
            "They signaled that Fort Laramie was approaching."
        },
        {
          name: "Scotts Bluff",
          description:
            "A massive bluff rising 800 feet above the North Platte River — " +
            "the most imposing geological feature since leaving Missouri. " +
            "The trail skirts its southern base, and the sheer rock face " +
            "looms over the wagons like a fortress wall. The party feels " +
            "small beneath it.",
          historicalNote:
            "Scotts Bluff was named for Hiram Scott, a Rocky Mountain Fur " +
            "Company trapper who reportedly died at its base in the 1820s. " +
            "By 1848, it was a well-known landmark and a critical navigation " +
            "point on the trail. The bluff's height and position made it " +
            "visible for dozens of miles, and emigrants used it to confirm " +
            "their route along the North Platte River."
        },
        {
          name: "Fort Laramie",
          description:
            "A substantial trading post and military outpost at the " +
            "confluence of the Laramie and North Platte rivers. Adobe " +
            "walls, a bustling courtyard, and the smell of coffee and " +
            "cured meat. Traders, soldiers, Native Americans, and " +
            "emigrants mingle in the compound. It's the last major " +
            "civilization before the mountains.",
          historicalNote:
            "Fort Laramie was the most important stop on the Oregon Trail " +
            "before the Rocky Mountains. Originally built as a fur trading " +
            "post in 1834 (Fort William), it was purchased by the U.S. " +
            "Army in 1849. In 1848, it was still a private trading post " +
            "operated by the American Fur Company. Emigrants could buy " +
            "supplies, repair wagons, and get information about the " +
            "mountain passes ahead. It was also a social hub — parties " +
            "merged, split, and exchanged news here."
        }
      ],
      flavorText: {
        morning:
          "The North Platte River valley opens wide, and the bluffs " +
          "rise on either side like canyon walls. The air is cooler here, " +
          "crisper. The party can smell pine on the wind — the first " +
          "hint of the mountains. The wagons roll over hard-packed earth, " +
          "and the dust is less alkaline than before.",
        midday:
          "Scotts Bluff dominates the sky. The trail narrows as it passes " +
          "between the bluff and the river, and the wagons must move in " +
          "single file. The rock face is streaked with mineral deposits — " +
          "white, red, and ochre bands that look painted. The party " +
          "travels in awe and silence.",
        evening:
          "Fort Laramie's adobe walls glow orange in the setting sun. " +
          "The sound of voices, horses, and hammering carries across the " +
          "river. The party makes camp on a rise overlooking the fort. " +
          "Tomorrow, they'll trade, resupply, and prepare for the mountains. " +
          "Tonight, they rest in the shadow of civilization.",
        campfire:
          "The wagon master closes the logbook with a satisfied hand: " +
          "'Fort Laramie in sight. We have crossed the great plains — " +
          "the flat, endless, wind-scoured plains — and lived to tell " +
          "of it. The mountains await. They will be harder, but we are " +
          "harder too. God keep us all.'"
      }
    }
  ]
});

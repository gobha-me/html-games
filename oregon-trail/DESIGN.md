# Oregon Trail — Design Document

## The Unique Feature: "The Trail Ledger" — Reputation Economy

Every major decision in this game affects both material resources **and** a hidden
**Trail Reputation** score tracked across four factions: **Native Tribes**, **Fellow
Settlers**, **River Traders**, and **Outlaws**. Reputation determines how NPCs respond
to your party: generous, principled parties receive aid during crises; ruthless or
selfish parties get robbed, shunned, or extorted. The player sees their standing as
a simple "Ledger" panel (four faction bars with qualitative labels: *Trusted*,
*Neutral*, *Suspect*, *Hostile*). The classic Oregon Trail has no faction or
reputation system — this creates meaningful branching consequences without adding
complexity to the core decision loop. It also gives content writers a lever: the
same event can resolve differently depending on your standing, multiplying replay
value without multiplying event count.

## Setting

- **Era:** 1848, the peak year of Oregon Trail migration.
- **Route:** Independence, Missouri → Willamette Valley, Oregon (~2,000 miles).
- **Landmarks (12 legs):** Fort Kearney, Chimney Rock, Fort Laramie,
  Independence Rock, South Pass, Soda Springs, Fort Hall, Snake River,
  Blue Mountains, The Dalles, Columbia River Gorge, Willamette Valley.
- **Framing:** The player reads the game as the **wagon master's log** —
  a practical, day-by-day journal. Event text is written in the voices of
  four party archetypes (below). The tone is earthy, procedural-historical,
  and grounded in the material reality of the trail. This deliberately avoids
  the moody/gothic/literary lane that `inkwell/` occupies.

## Core Loop

Each **day** the player makes three decisions:

1. **Pace** — *Steady* (normal consumption, normal distance), *Fast* (+50% distance,
   +50% food, +illness risk), or *Rest* (no distance, -50% food, +health recovery).
2. **Rationing** — *Full* (normal morale, normal food), *Meager* (-morale, -50% food),
   or *Bare* (--morale, --food, health risk).
3. **Action** — *Hunt* (spend ammo, gain food), *Trade* (spend money, gain supplies),
   *Repair* (spend money, restore wagon), *Explore* (risk/reward, may find shortcuts
   or trigger events), or *Nothing* (advance the day).

After decisions are made, the game:
- Applies resource decay (food consumption, wagon wear).
- Rolls for a random event (weighted by region and reputation).
- Displays the event with party-member commentary.
- Advances the day counter and distance traveled.

## Resource Model

| Resource | Unit | Starting | Daily Decay | Notes |
|----------|------|----------|-------------|-------|
| **Food** | lbs | 800 | 2–5 lbs/day (pace + rationing) | Hunt can replenish 30–200 lbs |
| **Money** | $ | $200 | 0 | Used at trading posts, ferries, repairs |
| **Ammo** | rounds | 50 | 0 | Spent on hunting (5–15 rounds per hunt) |
| **Health** | HP per member | 100 each | 0 (illness reduces) | 0 HP = member incapacitated; all dead = game over |
| **Morale** | 0–100 (party-wide) | 60 | −2/day baseline; modified by pace/rationing/events | < 20 → desertion risk; > 80 → bonus event outcomes |
| **Wagon Condition** | 0–100 | 80 | −1/day baseline; terrain/events modify | 0 = stranded; must repair or game over |

**Trail Ledger (Reputation):** Four hidden scores, each −100 to +100, starting at 0.
- **Native Tribes:** Affected by encounter choices (respectful trade vs. aggression).
- **Fellow Settlers:** Affected by moral choices (helping strangers, sharing supplies).
- **River Traders:** Affected by trade fairness and deal-breaking behavior.
- **Outlaws:** Affected by ruthless decisions (high Outlaw rep deters attacks but
  alienates Settlers and Tribes).

Reputation is displayed qualitatively: *Trusted* (+50 to +100), *Friendly* (+10 to +49),
*Neutral* (−9 to +9), *Suspect* (−49 to −10), *Hostile* (−100 to −50).

## Event Taxonomy

### 1. Weather
Storms, droughts, heat waves, early frost, blizzards. Weather events affect travel
speed, food spoilage, and illness risk. They are faction-neutral but can be mitigated
by high Morale (better preparation) or low Wagon Condition (more damage).
> *Example:* "A sudden prairie thunderstorm bogs the trail for 2 days. Lose 1 day's
> rations to water damage. The Optimist notes: 'At least the rain filled our barrels.'"

### 2. Illness
Cholera, dysentery, fever, snakebite, broken bones. Illness events reduce individual
HP and party Morale. Resting can recover HP but costs time (food). High Native Tribes
rep may unlock herbal remedies.
> *Example:* "A child in your party develops a fever. Rest costs 2 days but saves
> their life; push on and risk losing them. The Tender pleads: 'We can't leave her.'"

### 3. Encounter
Other wagon trains, Native tribal bands, river traders, mountain scouts, army patrols.
Encounter events are the primary driver of reputation change. Outcomes vary based on
current faction standing.
> *Example:* "A Pawnee band offers to guide you through a river crossing — at the cost
> of 20 lbs of flour. The Skeptic warns: 'Could be a trap.' The Pragmatist calculates:
> 'Ferry costs $15. Flour costs us $3. We save $12.'"

### 4. Terrain Hazard
River crossings, mountain passes, desert stretches, rockslides, mud bogs. Terrain
events test Wagon Condition and resource reserves. High Outlaw rep may reveal
dangerous shortcuts; high Settler rep may reveal safer alternate routes.
> *Example:* "The Platte River is swollen. Ford it (risk wagon damage, −15 condition)
> or pay a ferryman $15. The Pragmatist: 'We can afford the ferry. We can't afford
> a broken axle here.'"

### 5. Opportunity
Hunting bonanzas, shortcut discoveries, abandoned supply caches, gold rush detours.
Opportunity events offer resource gains at some cost or risk.
> *Example:* "You spot a herd of buffalo. Spend 10 rounds of ammo for an estimated
> 200 lbs of meat? The Optimist: 'It's a sign! The trail provides!' The Pragmatist:
> '10 rounds for 200 lbs — that's 20 lbs per round. Efficient.'"

### 6. Moral Choice
Help stranded travelers, share supplies with the desperate, abandon the weak,
mediate disputes between party members. Moral choices are the strongest drivers of
reputation change and have immediate morale consequences.
> *Example:* "A broken-down family begs for food. Give them 50 lbs (lose supplies,
> gain +15 Settler rep, +10 Morale) or refuse (keep supplies, −10 Settler rep,
> −15 Morale). The Tender: 'They have children.' The Skeptic: 'We barely have enough
> for ourselves.'"

## Character Voices

### The Pragmatist
The party's de facto leader. Speaks in numbers, probabilities, and trade-offs.
Terse, unsentimental, but not cruel — just focused on survival math.
> *"We've got 400 lbs of food. At this pace, we'll starve before Fort Laramie.
> Cut rations or pick up the pace."*

### The Optimist
Sees beauty and opportunity everywhere. Notices sunsets, wildlife, the promise
of Oregon. Raises morale but sometimes underestimates risk.
> *"The prairie at dawn — you can see why they call it the garden of the world.
> We'll make it. I can feel it."*

### The Skeptic
Wary of strangers, deals, and easy answers. Questions every encounter and
points out hidden costs. Lowers morale but prevents bad decisions.
> *"That trader's prices are too good. What's he not telling us? And why is
> he so eager to send us down that 'shortcut'?"*

### The Tender
Cares for the sick, the weak, and the emotional health of the party. Speaks
with empathy and moral urgency. The party's conscience.
> *"Little Sarah's fever broke. Thank the Lord. But we need to rest another day —
> she's still weak, and the trail will only get harder."*

## End Conditions

- **Win:** Reach Willamette Valley with at least 1 party member alive and
  Wagon Condition > 0. Display journey stats: days taken, miles traveled,
  events survived, final reputation standings.
- **Lose:** All party members dead, or Wagon destroyed in impassable terrain
  with no means of repair. Display a somber summary of how far the party got.
- **Partial (Bittersweet):** Reach Oregon with heavy losses (2+ members dead
  or Wagon Condition ≤ 10). Display a mixed ending — you made it, but at
  what cost? Show the Trail Ledger to illustrate how reputation shaped the journey.

## Out of Scope for v0.1

- Multiplayer, leaderboards, or online features.
- Animated map or visual wagon movement on a map.
- Sound effects or music (audio hooks are a v0.2 stretch goal).
- Multiple routes or branching campaign arcs (one route: the classic trail).
- Complex economy (buying/selling specific goods at varying prices).
- Party member customization (4 fixed archetypes for v0.1).
- Save-game encryption or cloud saves (localStorage only).

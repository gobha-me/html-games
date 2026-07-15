# FRONTLINE — Venice Asset Generation Brief
This file defines every image and audio asset
the game needs, with specs, naming, and ready-to-use prompts.

---

## 1. GLOBAL STYLE BIBLE (prepend to EVERY image prompt)

STYLE PREFIX (use verbatim):
> "Dieselpunk WWI retro-future, hand-pulled lithograph propaganda poster style,
> heavy ink grain, limited palette: khaki parchment (#EFE6CF), gunmetal brown-black
> (#26221A), brass gold (#C9A227), oxide red (#A4402C), olive drab (#6B7A3F).
> Strong diagonal composition, dramatic low-angle lighting, worn paper texture.
> No photorealism, no modern military hardware, no lens effects."

NEGATIVE PROMPT (use verbatim on all images):
> "text, lettering, watermark, signature, logo, modern camo, digital gradients,
> photograph, 3D render, anime, bright saturated colors"

Consistency: generate each batch with a fixed seed family; produce a contact
sheet per batch and cull outliers before accepting.

---

## 2. IMAGE ASSETS

### 2a. Card art — 24 pieces
- Size: 1024×1280 (4:5 portrait). PNG masters.
- Naming: `art/cards/{card_id}.png` (ids below are canonical — do not rename).
- Framing: single subject, chest-up or full-vehicle, subject fills ~70% of frame,
  background suggests trenchline/smoke, readable at 100×125 px thumbnail.

UNITS
| card_id  | name            | prompt subject (append to STYLE PREFIX) |
|----------|-----------------|------------------------------------------|
| scout    | Recon Runner    | lean courier soldier sprinting low through trench smoke, satchel and periscope, motion-blurred legs |
| skirm    | Trench Raider   | soldier with trench club and gas mask vaulting over sandbags at night, muzzle flashes behind |
| picket   | Sandbag Line    | fortified sandbag emplacement with barbed wire, lone helmet peeking over, stoic and immovable |
| foot     | Rifleman        | standard infantryman with long bolt rifle at port arms, resolute stare, trench behind |
| archer   | Mortar Team     | two-man crew dropping shell into stubby mortar tube, arc of smoke overhead |
| shieldb  | Barricade Crew  | engineers raising a riveted steel barricade panel, sparks from a welding torch |
| duel     | Shock Trooper   | armored stormtrooper with twin pistols mid-charge, coat flaring, brass chest plate |
| adder    | Gas Grenadier   | gaunt soldier in full gas mask lobbing a hissing green-venting canister |
| banner   | Signal Officer  | officer holding signal flags aloft on a parapet, troops rallying below, brass bugle at hip |
| vet      | Line Sergeant   | grizzled sergeant with bandaged arm pointing forward, three service stripes |
| cross    | Field Gun       | wheeled artillery piece with crew ramming a shell home, recoil smoke |
| warden   | Bunker Guard    | hulking sentry in plated armor blocking a concrete bunker doorway, riot shield |
| champ    | Armored Car     | brass-riveted armored car crushing barbed wire, headlamps cutting fog |
| lancer   | Breacher Tank   | rhomboid tank breaking through a trench wall, earth cascading |
| marks    | Howitzer        | massive howitzer at full elevation, crew dwarfed beneath the barrel |
| outrider | Dispatch Rider  | motorcycle courier leaping a shell crater, dispatch tube on back |
| van      | Land Dreadnought| colossal multi-turret land battleship on treads, smokestacks belching |
| ballista | Rail Cannon     | enormous railway gun on armored train car, barrel spanning the frame |
| warlord  | Field Marshal   | imperious marshal with brass baton overlooking the front from a command car, map table |

ORDERS (spells — more abstract, event-focused)
| card_id  | name             | prompt subject |
|----------|------------------|----------------|
| bolt     | Artillery Strike | single shell impact geyser of earth and smoke, silhouetted debris |
| volley   | Creeping Barrage | line of sequential explosions marching across no-man's-land |
| reinf    | Fortify          | fresh sandbags and steel plate being stacked around a gun position |
| insight  | Intel Report     | hands spreading an annotated trench map under a hanging lamp, cigarette smoke |
| redeploy | Forced March     | column of soldiers double-timing through a communication trench at dawn |

### 2b. Environment & UI — 6 pieces
- Naming: `art/env/{slug}.png`
| slug          | size      | prompt subject |
|---------------|-----------|----------------|
| board_field   | 1920×1080 | top-down aerial view of a three-sector trench battlefield, no-man's-land strip center, subtle grid, muted — must sit BEHIND UI at 20% visibility |
| home_hero     | 1920×800  | wide panorama of the frontline at dusk, dreadnought silhouette, signal flares |
| crate_common  | 800×800   | wooden ammo crate with brass latches, stenciled (blank) side panel |
| crate_graded  | 800×800   | reinforced steel-banded crate with brass seal and red wax stamp |
| ladder_banner | 1600×400  | row of regimental flags along a trench parapet at dawn |
| defeat_smoke  | 1200×800  | broken helmet on a bayonet grave marker in drifting smoke |

### 2c. Rank insignia — 8 pieces
- Size: 512×512, transparent background PNG. Naming: `art/rank/{tier}.png`
- Tiers: conscript, private, corporal, sergeant, lieutenant, captain, major, field_marshal
- Prompt pattern: "military rank insignia badge, brass and enamel on worn khaki
  wool, {tier-specific device}, centered, flat emblem design" — devices escalate:
  bare disc → one chevron → two chevrons → three chevrons → single bar →
  twin bars → brass oak leaf → crossed batons in laurel wreath.

### 2d. Commander portraits — 12 pieces
- Size: 512×512. Naming: `art/commanders/{index}_{surname}.png` (kray, brandt,
  falke, vane, voss, falk, dorn, roth, steel, grey, holt, lange)
- Prompt pattern: "bust portrait of a {descriptor} officer, high-collar greatcoat,
  brass insignia, stern expression, oval vignette frame" — vary age/gender/build
  per name; keep the palette identical.

---

## 3. AUDIO ASSETS

Masters: 48 kHz / 24-bit WAV. SFX mono, music/ambience stereo.
Loudness: UI −16 LUFS-I, combat SFX −12 LUFS-I, music −14 LUFS-I. True peak ≤ −1 dBTP.
Naming: `audio/sfx/{slug}.wav`, `audio/music/{slug}.wav`

SFX (≤1.5 s unless noted)
| slug            | prompt |
|-----------------|--------|
| deploy_thud     | heavy boots and equipment landing in mud, single impact, close mic |
| deploy_vehicle  | diesel engine cough-start plus metal treads settling, 2 s |
| melee_clash     | bayonet steel clash with grunt, dry trench acoustic |
| bombard_fire    | mortar tube thunk followed by receding whistle, 2 s |
| bombard_hit     | muffled earth explosion with soil rain, mid-distance |
| shell_block     | ricochet spang off thick steel plate, metallic ring decay |
| unit_death      | body crumple with gear clatter, somber, no gore |
| gas_hiss        | pressurized canister venting with faint crackle |
| requisition     | brass cash-register clunk plus rubber stamp slam |
| card_select     | single paper snap with felt table damp |
| end_turn        | brass officer whistle, one short blast |
| coin_flip       | heavy coin ring, spin, and slap onto leather |
| victory_sting   | 3 s triumphant brass fanfare, four horns, resolves upward |
| defeat_sting    | 3 s lone bugle dirge, distant artillery rumble under |
| rank_up         | 2 s snare roll into single brass hit |

AMBIENCE / MUSIC
| slug            | prompt |
|-----------------|--------|
| amb_frontline   | 60 s seamless loop: trench wind, distant intermittent artillery, canvas flap, sparse crows |
| amb_hq          | 60 s seamless loop: field HQ interior, typewriter, muffled voices, oil lamp hiss |
| theme_main      | 90 s march: low brass ostinato, snare, melancholy trumpet lead, loopable |

---

## 4. ACCEPTANCE CHECKLIST (per batch)
- [ ] Palette check: sampled dominant colors within the 5-color bible
- [ ] Thumbnail check: card art readable at 100×125
- [ ] No text/lettering artifacts anywhere
- [ ] Seed + prompt logged per accepted asset (reproducibility for graded variants)
- [ ] Audio: loudness + true-peak measured, loops verified seamless

# HEXWIRE — Art Direction v1
Asset generation guide for the venice.ai CLI pipeline (image / video / audio).
Game: 1v1 lane CCG. 3 city blocks × street/overwatch rows. Machine + magic. Unthemed prototype is live; this file defines the look the art replaces it with.

## 1. World in one paragraph
Magic didn't return — it **leaked out of the network**. Ritual code, haunted firmware, dealers fencing cursed hardware. Human gangs only (no fantasy races): chromed muscle, backalley witches, and the street between them. Ground level, rain, neon, concrete. Nothing corporate-clean: every surface is patched, stickered, re-soldered, chalked with sigils.

## 2. Global style block (prepend to every image prompt)
```
gritty neon-noir concept art, painterly with hard edges, ground-level cyberpunk street,
arcane circuitry — glowing sigils fused with cables and PCBs, wet asphalt reflections,
strong rim light, deep blacks, cinematic contrast, muted base with saturated neon accents,
no text, no watermark, no logo
```
Negative: `text, watermark, logo, anime, clean futurism, corporate sci-fi, elves, orcs, fantasy armor, daylight`

## 3. Palette (must match UI)
| Token | Hex | Use |
|---|---|---|
| Void | #0b0d11 | backgrounds, deepest black |
| Panel | #131720 | surfaces, card frames |
| Signal orange | #ff8a3d | primary action, income/fence, highlights |
| Player teal | #2fd6b8 | friendly units, your life |
| Threat red | #ff4d69 | enemy units, damage |
| Chrome cyan | #53c7ff | CHROME faction |
| Hex violet | #c77dff | HEX faction, possession FX |
| Street amber | #ffb02e | STREET faction |

## 4. Factions
- **CHROME** (cyan): drones, wired reflexes, railguns. Machined surfaces, lens eyes, cable bundles, servo joints. Light = cold cyan LEDs. Keywords: Wired, Pierce, Strike.
- **HEX** (violet): leaked-code witchcraft. Chalk sigils that glow like OLEDs, candle + monitor light, possession threads (thin violet filaments). Keywords: Curse, Ward, Subvert, Possession.
- **STREET** (amber): bodies, guards, crowd muscle. Sodium-vapor amber, jackets, improvised armor, bats and riot shields. Keywords: Guard, Rally.

## 5. Card art specs
- Aspect **4:3**, subject centered, waist-up or full figure, single character/object, readable at 104px wide.
- Background: blurred street depth in faction color; subject rim-lit.
- One accent glow per card in the faction color. No text in art.

### 5.1 Unit prompts (append to global block; faction color as stated)
| id | Card | Prompt seed |
|---|---|---|
| scout | Lookout | teenage spotter on a fire escape with cracked AR monocular, amber streetlight |
| skirm | Ripper | lean runner mid-sprint, sparking wrist blades, cyan motion-blur trails |
| picket | Bouncer | heavyset doorman, arms crossed, amber neon doorway behind |
| foot | Ganger | street soldier with pipe club and taped jacket, amber |
| archer | Watch Drone | hovering quadcopter with single red-lens eye and gun pod, cyan |
| shieldb | Riot Shield | crouched figure behind scavenged polycarbonate shield, amber |
| duel | Switchblade | knife duelist in a rain poncho, twin blades low, amber |
| adder | Curseblade | gaunt figure, dagger dripping violet code-glyphs, violet |
| banner | Fixer | sharp-dressed broker with holo-ledger cuff, two phones, amber |
| vet | Merc | scarred mercenary, mismatched armor plates, cigarette, amber |
| cross | Gun Drone | tracked ground drone with mounted SMG, cables, cyan |
| warden | Wardkeeper | robed keeper projecting a violet sigil-shield from a car battery rig |
| champ | Enforcer | huge enforcer with hydraulic knuckles, amber |
| lancer | Breacher | armored charger with a door-ram exoskeleton arm, cyan |
| marks | Sniper | prone rooftop shooter, scope glint, cyan |
| outrider | Chromed Rider | motorcyclist with chrome spine, arriving mid-skid, cyan |
| van | Bound Golem | concrete-and-rebar golem animated by violet sigils in the cracks |
| ballista | Railgun | shoulder-mounted rail cannon crackling with coils, cyan |
| warlord | Kingpin | seated crime lord, gold-amber light, hand raised in command |
| puppet | Puppeteer | hooded figure with violet filament threads from fingertips to a slumped marionette silhouette |

### 5.2 Spell prompts (more abstract, hands/FX close-ups)
| id | Card | Prompt seed |
|---|---|---|
| bolt | Hexbolt | violet lightning arc from a chalked sigil, close-up |
| volley | Grid Surge | citywide power surge, breakers arcing cyan down a whole street |
| reinf | Combat Stims | autoinjector against a forearm, cyan vitals holo |
| insight | Datamine | hands in a holographic card spread of leaked data, cyan |
| redeploy | Blinkstep | figure dissolving into violet static mid-stride |
| possess | Possession | violet threads descending into a silhouette's eyes, close-up |

## 6. Environment / large assets
- **Board background** (16:9, dark, low-detail so cards read): rain-slick intersection seen top-down-ish, three lanes of asphalt separated by neon curb strips, mid seam glowing faint orange.
- **Lobby background** (16:9, loopable video candidate): alley bar exterior, rain, flickering signs cycling teal/violet/amber.
- **Ladder/lobby icons**: faction sigils — chrome cog-eye, hex pentacle-circuit, street brass-knuckle tag; 1:1, emblem on void.
- **Init chip** (replaces coin): 1:1, a scuffed credchip — teal face etched YOU-glyph, red face etched rival-glyph, edge-lit.

## 7. Animation direction (in-engine, CSS/JS)
Priority order:
1. **Combat**: attacker lunge toward target (translate 8-12px + snap back), hit flash on victim, floating damage numbers, death = glitch-dissolve.
2. **Possession/Subvert**: violet thread draws from Puppeteer cell to target, card slides across the seam, lands stacked. This is the signature move — spend the budget here.
3. **Fence**: card flies to income counter, counter ticks up with orange pulse.
4. **Init chip**: real two-faced 3D flip, decelerating, lands showing the winner (done in v0.4).
5. Lane threat meters pulse when a lane is unanswered; face damage shakes the life badge.

## 8. Audio direction (venice audio gen)
- Ambient loop: rain + distant traffic + neon hum, 60-90s seamless.
- UI: soft relay-click (select), heavier click (deploy), cash-tick (fence).
- Combat: dull impact (melee), suppressed crack (strike), violet shimmer-drone (possession), glitch-burst (death).
- Stingers: 3-5s win (rising teal synth) / loss (detuned drop).

## 9. Video (venice video gen)
- Lobby bg loop (5-8s, seamless): rain on neon signage.
- Win/loss end-cards (3s): faction sigil igniting / dissolving.

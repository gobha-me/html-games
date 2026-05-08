/**
 * Sokoban Level Definitions — "The Archive"
 *
 * Encoding:
 *   # = wall
 *   . = target/goal
 *   $ = box
 *   @ = player
 *   * = box on target
 *   + = player on target
 *     = empty floor
 *
 * Each level: { name, map: string[], par: number }
 * par = approximate optimal move count (each level was BFS-verified solvable;
 *       see /tmp/sokoban_design.py for the verifier).
 */

const LEVELS = [
  // ── TUTORIAL (Levels 1-5) ── one new concept per level
  {
    // Lesson: pushing — walk into a box, it moves one square in the same direction.
    name: "First Push",
    map: [
      "########",
      "#      #",
      "#@$  . #",
      "#      #",
      "########",
    ],
    par: 5,
  },
  {
    // Lesson: change direction — boxes can be pushed along multiple axes.
    name: "Two Steps",
    map: [
      "########",
      "# @    #",
      "# $    #",
      "#      #",
      "#  .   #",
      "#      #",
      "########",
    ],
    par: 8,
  },
  {
    // Lesson: two boxes, two targets — each box claims one pedestal.
    name: "Two Texts",
    map: [
      "########",
      "#      #",
      "# .    #",
      "#  $   #",
      "#  $@  #",
      "#  .   #",
      "#      #",
      "########",
    ],
    par: 8,
  },
  {
    // Lesson: ordering — push the right box first or you'll block yourself in.
    name: "The Antechamber",
    map: [
      "########",
      "#   .  #",
      "#  $   #",
      "#@ $.  #",
      "#      #",
      "########",
    ],
    par: 9,
  },
  {
    // Lesson: detour — sometimes you must walk the long way around to push.
    name: "Around the Pillar",
    map: [
      "########",
      "#  .   #",
      "# ##   #",
      "# @$   #",
      "#    # #",
      "#      #",
      "########",
    ],
    par: 12,
  },

  // ── EASY (Levels 6-10) ──
  {
    // One box inside a nested chamber — simple but the chamber walls force routing.
    name: "Inner Chamber",
    map: [
      "##########",
      "#        #",
      "# ###### #",
      "# # .  # #",
      "# # $  # #",
      "# # $@ # #",
      "# # .  # #",
      "# ###### #",
      "#        #",
      "##########",
    ],
    par: 12,
  },
  {
    // Cross-shaped room — four boxes radiate to four targets.
    name: "Crossroads",
    map: [
      "###########",
      "#####.#####",
      "#####$#####",
      "#         #",
      "#.$  @  $.#",
      "#         #",
      "#####$#####",
      "#####.#####",
      "###########",
    ],
    par: 16,
  },
  {
    // Two stacked boxes that drop onto stacked targets.
    name: "Stacked Storage",
    map: [
      "########",
      "#      #",
      "# $@   #",
      "# $    #",
      "#  .   #",
      "#  .   #",
      "#      #",
      "########",
    ],
    par: 14,
  },
  {
    // Symmetric chamber, four boxes, four targets — practice routing.
    name: "The Reading Room",
    map: [
      "#########",
      "#       #",
      "# .   . #",
      "#   $   #",
      "# $ @ $ #",
      "#   .   #",
      "#       #",
      "#########",
    ],
    par: 14,
  },
  {
    // Two pillars in the middle — boxes navigate around obstacles.
    name: "Twin Pillars",
    map: [
      "##########",
      "#        #",
      "# .  ##  #",
      "#  $ ## $#",
      "#@   ##  #",
      "# $  ## .#",
      "#  .     #",
      "##########",
    ],
    par: 18,
  },

  // ── MEDIUM (Levels 11-15) ──
  {
    // Three boxes in a line, three targets in a line — choose which goes where.
    name: "The Stacks",
    map: [
      "##########",
      "#        #",
      "# . . .  #",
      "#        #",
      "# $ $ $@ #",
      "#        #",
      "##########",
    ],
    par: 14,
  },
  {
    // Courtyard split by a central wall — four boxes, four diagonal targets.
    name: "The Courtyard",
    map: [
      "############",
      "#          #",
      "#  . ## .  #",
      "#          #",
      "# $  ##  $ #",
      "#    ##    #",
      "# $  ##  $ #",
      "#          #",
      "#  . ## .  #",
      "#     @    #",
      "############",
    ],
    par: 26,
  },
  {
    // Library floor — twin walls force boxes around them.
    name: "Library Floor",
    map: [
      "############",
      "#          #",
      "# .  ..  . #",
      "#          #",
      "# $$ ## $$ #",
      "#    ##    #",
      "#     @    #",
      "############",
    ],
    par: 26,
  },
  {
    // Vault chamber — four boxes converge on top and bottom pedestals.
    name: "The Vault",
    map: [
      "##########",
      "#   ..   #",
      "#        #",
      "#  $  $  #",
      "#   $$   #",
      "#   @    #",
      "#        #",
      "#   ..   #",
      "##########",
    ],
    par: 26,
  },
  {
    // Concentric chambers — push boxes from inside ring to outer corners.
    name: "Concentric",
    map: [
      "##########",
      "#  .  .  #",
      "#        #",
      "# $    $ #",
      "#   ##   #",
      "#  @##   #",
      "# $    $ #",
      "#        #",
      "#  .  .  #",
      "##########",
    ],
    par: 28,
  },

  // ── HARD (Levels 16-20) ──
  {
    // Quartet plus a fifth box wedged in the middle.
    name: "Quartet",
    map: [
      "##########",
      "#  .  .  #",
      "#        #",
      "# $ $$ $ #",
      "#   @    #",
      "#        #",
      "#  .  .  #",
      "##########",
    ],
    par: 30,
  },
  {
    // Shelves — boxes pushed up through narrow gaps in a shelf wall.
    name: "Shelves",
    map: [
      "###########",
      "#         #",
      "# . . . . #",
      "#         #",
      "## # # # ##",
      "#         #",
      "# $ $ $ $ #",
      "#@        #",
      "###########",
    ],
    par: 36,
  },
  {
    // Four boxes, four corners — funnel walls force a specific path to each.
    name: "Four Corners",
    map: [
      "##########",
      "#.######.#",
      "#        #",
      "#  $  $  #",
      "#   @    #",
      "#  $  $  #",
      "#        #",
      "#.######.#",
      "##########",
    ],
    par: 36,
  },
  {
    // Master catalog — twin walls plus jagged lower obstruction.
    name: "Master Catalog",
    map: [
      "############",
      "#  .    .  #",
      "#          #",
      "# $$ ## $$ #",
      "#    ##    #",
      "## #    # ##",
      "#    @     #",
      "#          #",
      "#  .    .  #",
      "############",
    ],
    par: 36,
  },
  {
    // The Final Archive — four columns funneled through three shelf gaps.
    name: "The Final Archive",
    map: [
      "###########",
      "#         #",
      "# . . . . #",
      "#         #",
      "## # # # ##",
      "#         #",
      "# $ $ $ $ #",
      "#         #",
      "#    @    #",
      "###########",
    ],
    par: 40,
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LEVELS;
}

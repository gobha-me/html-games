// Word lists for the typing game
export const wordLists = {
    programming: {
        name: "💻 Programming",
        description: "Keywords, functions, and tech terms",
        words: {
            easy: [
                "var", "let", "const", "if", "else", "for", "while", "do",
                "new", "try", "catch", "throw", "class", "enum", "type",
                "null", "true", "false", "void", "this", "super", "import",
                "from", "export", "default", "return", "break", "switch",
                "case", "async", "await", "yield", "typeof", "delete"
            ],
            medium: [
                "function", "promise", "resolve", "reject", "callback",
                "variable", "constant", "iterator", "generator", "closure",
                "prototype", "constructor", "interface", "abstract",
                "override", "private", "public", "static", "module",
                "package", "object", "string", "number", "boolean",
                "array", "symbol", "bigint", "regexp", "global",
                "buffer", "stream", "socket", "router", "server",
                "client", "render", "mount", "state", "props",
                "effect", "memo", "ref", "hook", "context",
                "reduce", "filter", "map", "slice", "splice",
                "concat", "assign", "freeze", "seal", "keys"
            ],
            hard: [
                "asynchronous", "synchronous", "instantiation",
                "encapsulation", "polymorphism", "inheritance",
                "serialization", "deserialization", "authentication",
                "authorization", "cryptocurrency", "microservice",
                "infrastructure", "implementation", "configuration",
                "documentation", "transpilation", "concatenation",
                "interpolation", "deconstruction", "transformation",
                "optimization", "refactoring", "abstraction",
                "virtualization", "containerization", "orchestration",
                "parallelization", "synchronization", "communication"
            ]
        }
    },
    english: {
        name: "📝 Common Words",
        description: "Frequently used English words",
        words: {
            easy: [
                "the", "and", "for", "are", "but", "not", "you", "all",
                "can", "had", "her", "was", "one", "our", "out", "day",
                "get", "has", "him", "his", "how", "its", "may", "new",
                "now", "old", "see", "two", "way", "who", "did", "got",
                "let", "say", "she", "too", "use", "run", "big", "cat"
            ],
            medium: [
                "about", "after", "again", "below", "could", "every",
                "first", "found", "great", "house", "large", "learn",
                "never", "other", "place", "plant", "point", "right",
                "small", "sound", "spell", "still", "study", "their",
                "there", "these", "think", "three", "water", "where",
                "which", "world", "would", "write", "answer", "before",
                "between", "children", "country", "example", "family",
                "father", "follow", "friend", "garden", "happen",
                "letter", "little", "mother", "number", "people",
                "person", "problem", "question", "school", "second",
                "sentence", "should", "simple", "system", "together"
            ],
            hard: [
                "beautiful", "challenge", "different", "important",
                "knowledge", "necessary", "opportunity", "particular",
                "recognize", "significant", "technology", "understand",
                "wonderful", "yesterday", "absolutely", "apparently",
                "atmosphere", "brilliant", "celebrate", "character",
                "circumstance", "communicate", "completely", "concentrate",
                "confident", "consequence", "considerable", "contemporary",
                "contribute", "conversation", "cooperation", "curiosity",
                "demonstrate", "determine", "development", "discovery",
                "distinguish", "education", "environment", "essentially",
                "establish", "everything", "excellent", "experience",
                "experiment", "extraordinary", "familiar", "fascinating"
            ]
        }
    },
    scifi: {
        name: "🚀 Sci-Fi & Fantasy",
        description: "Names and terms from sci-fi worlds",
        words: {
            easy: [
                "star", "warp", "beam", "ship", "moon", "mars", "void",
                "nebula", "nova", "droid", "borg", "elf", "orc", "mage",
                "quest", "realm", "spell", "sword", "shield", "armor",
                "dragon", "planet", "galaxy", "rocket", "laser", "alien",
                "robot", "cyborg", "clone", "hive", "core", "flux",
                "rift", "gate", "zone", "base", "crew", "fleet"
            ],
            medium: [
                "android", "asteroid", "captain", "cosmos", "crystal",
                "empire", "engine", "falcon", "galactic", "gravity",
                "horizon", "hyperion", "jupiter", "kingdom", "legend",
                "meteor", "mission", "nexus", "omega", "phoenix",
                "plasma", "portal", "quantum", "ranger", "sector",
                "sentinel", "shadow", "stellar", "titan", "vortex",
                "warrior", "wizard", "zephyr", "citadel", "corvette",
                "destroyer", "dungeon", "enclave", "fortress", "garrison",
                "guardian", "harbinger", "infinity", "legion", "matrix",
                "nebulous", "obsidian", "paradox", "quasar", "relic"
            ],
            hard: [
                "admiral", "architect", "battalion", "celestial",
                "chronicle", "commander", "constellation", "covenant",
                "dimension", "dominion", "elemental", "enchantment",
                "expedition", "federation", "generation", "guardians",
                "hyperspace", "illuminate", "interstellar", "invasion",
                "judgment", "kingdoms", "leviathan", "labyrinth",
                "machination", "monolith", "navigator", "obliterate",
                "prophecy", "quadrant", "resistance", "sanctuary",
                "sovereign", "supernova", "teleport", "terraform",
                "universe", "vanguard", "warcraft", "xenomorph",
                "yggdrasil", "ziggurat", "apocalypse", "battleground",
                "cataclysm", "domination", "endurance", "forbidden"
            ]
        }
    }
};

// Get words for a given list and difficulty
export function getWords(listName, difficulty) {
    const list = wordLists[listName];
    if (!list) return wordLists.english.words.easy;
    return list.words[difficulty] || list.words.easy;
}

// Get all words from a list (for boss mode)
export function getAllWords(listName) {
    const list = wordLists[listName];
    if (!list) return [];
    return [
        ...list.words.easy,
        ...list.words.medium,
        ...list.words.hard
    ];
}

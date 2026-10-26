"use strict";

/* ============================================================
   THE WORDS, by how readily they call up a picture
   ============================================================

   Five tiers, from words that cannot be read without seeing something to
   words that leave nothing to see. The method of loci works by turning each
   word into an image and setting it somewhere along a route you know; how
   hard that is depends almost entirely on the word. A dragon places itself.
   A "notion" has to be turned into something first — a pun, a symbol, a scene
   — and that conversion is the skill the lower tiers train.

   Sorted by hand into categories, not taken from rated norms: imagery ratings
   exist for these words (Paivio, Yuille & Madigan 1968; the Glasgow norms,
   Scott et al. 2019), but not shipped here, and the tiers are coarse enough
   that the category does the work — fantastical or striking, everyday and
   concrete, concrete but hard to picture, abstract, and purely abstract.
   Every word is one lower-case English word, letters only, and appears in one
   tier only (test/run.js holds both).

   Plain script, no dependencies: a <script> tag in the page, `require` in the
   tests. */

var LOCI_WORDS = {
  tiers: [
    null,
    {
      level: 1, name: "Very abstract", what: "Pure concepts with nothing to see",
      words: ["notion", "essence", "entity", "validity", "abstraction", "ambiguity", "analogy", "aptitude",
        "attribute", "axiom", "basis", "clarity", "coherence", "consensus", "consistency", "deficiency",
        "destiny", "dignity", "duty", "efficiency", "equality", "equity", "ethics", "excess", "existence",
        "fallacy", "fate", "feasibility", "freedom", "gist", "hindsight", "honesty", "ideal", "identity",
        "illusion", "impetus", "inference", "inertia", "infinity", "integrity", "intellect", "irony",
        "justice", "liberty", "logic", "loyalty", "malice", "manner", "merit", "morale", "necessity",
        "nuance", "paradox", "patience", "philosophy", "piety", "premise", "pretext", "propensity",
        "prudence", "rationale", "reality", "relevance", "reluctance", "sanity", "scarcity", "sincerity",
        "sovereignty", "spite", "synergy", "tact", "tenet", "tolerance", "trait", "truth", "utility",
        "vanity", "virtue", "wisdom", "zeal", "candor", "conscience", "context", "contingency", "credence",
        "deference", "diligence", "discretion", "doctrine", "dogma", "eminence", "empathy", "envy",
        "esteem", "excellence", "faith", "fidelity", "frivolity", "futility", "gratitude", "guilt",
        "heresy", "humility", "hypocrisy", "jealousy", "legitimacy", "leniency", "meaning", "mercy",
        "modesty", "nostalgia", "novelty", "obscurity", "plausibility", "pride", "regret", "remorse",
        "respect", "scruple", "shame", "solace", "subtlety", "temperance", "triviality", "valor", "whim"]
    },
    {
      level: 2, name: "Abstract", what: "Ideas and processes",
      words: ["method", "theory", "concept", "process", "function", "policy", "strategy", "principle",
        "factor", "aspect", "framework", "criterion", "approach", "procedure", "analysis", "reason",
        "purpose", "effect", "result", "outcome", "influence", "quality", "quantity", "value", "degree",
        "extent", "range", "level", "standard", "status", "role", "situation", "condition",
        "circumstance", "issue", "problem", "solution", "option", "choice", "decision", "opinion",
        "attitude", "belief", "idea", "knowledge", "skill", "ability", "capacity", "tendency", "pattern",
        "trend", "change", "growth", "decline", "increase", "reduction", "balance", "stability",
        "variation", "difference", "similarity", "relation", "connection", "contrast", "comparison",
        "category", "definition", "description", "explanation", "interpretation", "assumption",
        "hypothesis", "evidence", "argument", "conclusion", "implication", "consequence", "requirement",
        "obligation", "permission", "responsibility", "authority", "priority", "objective", "intention",
        "expectation", "preference", "motive", "incentive", "benefit", "advantage", "risk", "chance",
        "probability", "possibility", "agreement", "attempt", "behavior", "concern", "effort", "event",
        "experience", "failure", "habit", "history", "interest", "memory", "opportunity", "progress",
        "quest", "routine", "success", "suggestion", "tradition", "transition", "version"]
    },
    {
      level: 3, name: "Technical", what: "Real things that are hard to picture",
      words: ["molecule", "fraction", "document", "atom", "enzyme", "protein", "gene", "virus",
        "bacterium", "vitamin", "mineral", "compound", "element", "particle", "electron", "neutron",
        "isotope", "catalyst", "polymer", "pixel", "file", "invoice", "receipt", "contract", "permit",
        "license", "certificate", "ledger", "budget", "account", "payment", "deposit", "mortgage",
        "statute", "regulation", "clause", "paragraph", "appendix", "diagram", "formula", "equation",
        "decimal", "percentage", "ratio", "variable", "matrix", "vector", "algorithm", "database",
        "network", "server", "software", "protocol", "password", "schedule", "agenda", "deadline",
        "survey", "sample", "statistic", "average", "interval", "segment", "sector", "district",
        "territory", "component", "module", "mechanism", "apparatus", "substance", "fiber", "sediment",
        "residue", "membrane", "tissue", "nerve", "hormone", "antibody", "chromosome", "frequency",
        "voltage", "current", "resistor", "transistor", "capacitor", "circuit", "signal", "bandwidth",
        "spectrum", "wavelength", "coefficient", "integer", "quotient", "denominator", "exponent",
        "logarithm", "theorem", "axis", "parameter", "tariff", "subsidy", "dividend", "inventory",
        "audit", "memo", "transcript", "manuscript", "bulletin", "index", "glossary", "syllabus",
        "questionnaire", "warranty", "voucher", "quota", "dosage", "metabolism", "nutrient", "solvent"]
    },
    {
      level: 4, name: "Concrete", what: "Everyday objects, animals and food",
      words: ["apple", "hammer", "chair", "table", "bottle", "bucket", "ladder", "pillow", "blanket",
        "spoon", "fork", "knife", "plate", "cup", "kettle", "candle", "mirror", "window", "door",
        "carpet", "basket", "wallet", "pencil", "scissors", "button", "zipper", "glove", "sock", "boot",
        "hat", "scarf", "umbrella", "bicycle", "wagon", "bus", "truck", "tractor", "bridge", "fence",
        "barn", "garden", "flower", "tree", "leaf", "rock", "sand", "river", "lake", "beach", "mountain",
        "cloud", "bread", "cheese", "egg", "banana", "carrot", "potato", "onion", "lemon", "cherry",
        "grape", "honey", "soup", "cookie", "cake", "sandwich", "pizza", "teapot", "oven", "sink",
        "bathtub", "towel", "soap", "toothbrush", "comb", "brush", "clock", "lamp", "sofa", "desk",
        "shelf", "drawer", "box", "rope", "chain", "nail", "screw", "shovel", "rake", "hose", "brick",
        "stone", "feather", "seashell", "horse", "cow", "pig", "sheep", "goat", "duck", "rabbit",
        "mouse", "frog", "dog", "cat", "chicken", "saucepan", "teacup", "envelope", "stamp", "key",
        "lock", "coin", "ring", "necklace", "belt", "jacket", "shirt", "dress", "sweater", "slipper",
        "suitcase", "ball", "bench", "puddle", "snowman", "tomato", "orange", "pear", "peach"]
    },
    {
      level: 5, name: "Vivid", what: "Fantastical or striking: they picture themselves",
      words: ["dragon", "gnome", "knight", "fire", "wizard", "volcano", "castle", "pirate", "vampire",
        "unicorn", "giant", "witch", "skeleton", "tornado", "lightning", "mermaid", "ogre", "troll",
        "phoenix", "sword", "crown", "throne", "cannon", "shark", "tiger", "lion", "eagle", "snake",
        "spider", "octopus", "gorilla", "elephant", "rhino", "crocodile", "wolf", "bear", "ghost",
        "zombie", "mummy", "robot", "rocket", "astronaut", "cowboy", "ninja", "samurai", "viking",
        "gladiator", "clown", "juggler", "acrobat", "dinosaur", "mammoth", "waterfall", "avalanche",
        "earthquake", "explosion", "firework", "rainbow", "iceberg", "glacier", "cactus", "pyramid",
        "lighthouse", "windmill", "skyscraper", "submarine", "helicopter", "locomotive", "chariot",
        "cauldron", "treasure", "diamond", "ruby", "skull", "coffin", "lantern", "torch", "anchor",
        "harpoon", "trumpet", "drum", "banjo", "accordion", "balloon", "kite", "parachute", "trampoline",
        "carousel", "igloo", "lollipop", "pineapple", "watermelon", "pumpkin", "mushroom", "beehive",
        "butterfly", "peacock", "flamingo", "penguin", "kangaroo", "giraffe", "zebra", "camel", "walrus",
        "lobster", "jellyfish", "seahorse", "scorpion", "bat", "owl", "raven", "goblin", "dwarf",
        "centaur", "griffin", "yeti", "sphinx", "minotaur", "werewolf", "cyclops", "kraken", "hydra"]
    }
  ]
};

if (typeof module !== "undefined") module.exports = LOCI_WORDS;

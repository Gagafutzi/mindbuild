"use strict";

/* ============================================================
   DIE WÖRTER, for the German mode
   ============================================================

   The same five tiers as words.js — from words that cannot be read without
   seeing something to words that leave nothing to see — with German words
   chosen for German, not translated one by one: a tier is about how readily
   a word pictures itself, and that does not survive translation word for word.

   Stored in lower case, letters a–z and ä ö ü only (no ß: typed as "ss" by
   half the keyboards it meets, it would be a slip on every word that has it).
   The page shows them capitalised, as German writes nouns. Every word is in
   one tier only (test/run.js holds both).

   Plain script, no dependencies: a <script> tag in the page, `require` in the
   tests. */

var LOCI_WORDS_DE = {
  tiers: [
    null,
    {
      level: 1, name: "Very abstract", what: "Pure concepts with nothing to see",
      words: ["begriff", "wesen", "gültigkeit", "abstraktion", "mehrdeutigkeit", "analogie", "eignung",
        "eigenschaft", "axiom", "grundlage", "klarheit", "kohärenz", "konsens", "beständigkeit", "mangel",
        "schicksal", "würde", "pflicht", "effizienz", "gleichheit", "gerechtigkeit", "ethik", "übermut",
        "dasein", "trugschluss", "machbarkeit", "freiheit", "rückschau", "ehrlichkeit", "ideal", "identität",
        "illusion", "antrieb", "trägheit", "unendlichkeit", "integrität", "intellekt", "ironie", "logik",
        "treue", "bosheit", "verdienst", "moral", "notwendigkeit", "nuance", "paradox", "geduld",
        "philosophie", "frömmigkeit", "prämisse", "vorwand", "neigung", "umsicht", "begründung",
        "wirklichkeit", "relevanz", "widerwille", "vernunft", "knappheit", "aufrichtigkeit", "souveränität",
        "trotz", "synergie", "takt", "grundsatz", "toleranz", "wahrheit", "eitelkeit", "tugend", "weisheit",
        "eifer", "offenheit", "gewissen", "kontext", "zufall", "glaube", "achtung", "sorgfalt", "diskretion",
        "doktrin", "dogma", "empathie", "neid", "ewigkeit", "gnade", "güte", "hoffnung", "demut", "harmonie",
        "ehre", "scham", "schuld", "zweifel", "vertrauen", "wille", "zukunft", "vergangenheit", "gegenwart",
        "einheit", "vielfalt", "möglichkeit", "ursache", "bedeutung", "absicht", "neugier", "gleichmut",
        "eigenart", "anmut", "stolz", "reue", "sehnsucht", "zuversicht", "besonnenheit", "ehrfurcht",
        "nachsicht", "redlichkeit", "willkür", "beliebigkeit", "zugehörigkeit", "gewissheit", "irrtum",
        "autorität", "legitimität", "objektivität", "subjektivität", "rationalität", "kausalität"]
    },
    {
      level: 2, name: "Abstract", what: "Ideas and processes",
      words: ["methode", "theorie", "konzept", "prozess", "funktion", "politik", "strategie", "prinzip",
        "faktor", "aspekt", "rahmen", "kriterium", "ansatz", "verfahren", "analyse", "zweck", "wirkung",
        "ergebnis", "folge", "einfluss", "qualität", "menge", "wert", "grad", "ebene", "phase", "stufe",
        "trend", "entwicklung", "wachstum", "rückgang", "wandel", "reform", "planung", "ziel", "aufgabe",
        "problem", "lösung", "frage", "antwort", "idee", "meinung", "urteil", "entscheidung", "auswahl",
        "vergleich", "unterschied", "ähnlichkeit", "beziehung", "struktur", "system", "modell", "muster",
        "regel", "gesetz", "norm", "standard", "kontrolle", "leistung", "bewertung", "prüfung", "messung",
        "schätzung", "umfang", "anteil", "verhältnis", "tendenz", "risiko", "chance", "vorteil", "nachteil",
        "kosten", "gewinn", "verlust", "bedarf", "angebot", "nachfrage", "wettbewerb", "erziehung", "bildung",
        "forschung", "wissen", "erfahrung", "gedächtnis", "wahrnehmung", "aufmerksamkeit", "motivation",
        "gewohnheit", "verhalten", "reaktion", "anpassung", "kommunikation", "sprache", "grammatik", "kultur",
        "tradition", "gesellschaft", "wirtschaft", "verwaltung", "organisation", "beratung", "verhandlung",
        "vereinbarung", "kompromiss", "konflikt", "krise", "fortschritt", "ablauf", "reihenfolge", "kategorie",
        "klasse", "version", "variante", "kombination", "definition", "hypothese", "beweis", "argument",
        "interpretation", "perspektive", "priorität", "kapazität", "potenzial", "dynamik", "stabilität"]
    },
    {
      level: 3, name: "Technical", what: "Real things that are hard to picture",
      words: ["molekül", "bruchzahl", "dokument", "atom", "enzym", "protein", "gen", "virus", "bakterium",
        "vitamin", "element", "teilchen", "elektron", "neutron", "isotop", "katalysator", "polymer", "pixel",
        "datei", "rechnung", "quittung", "vertrag", "genehmigung", "formular", "protokoll", "tabelle",
        "diagramm", "statistik", "algorithmus", "software", "datenbank", "server", "netzwerk", "signal",
        "frequenz", "spannung", "widerstand", "kondensator", "transistor", "sensor", "hormon", "antikörper",
        "zelle", "gewebe", "chromosom", "plasma", "ion", "säure", "lauge", "mikrochip", "prozessor",
        "speicher", "platine", "schaltkreis", "sicherung", "relais", "ventil", "dichtung", "getriebe",
        "hypothek", "kredit", "zins", "steuer", "gebühr", "aktie", "anleihe", "bilanz", "budget", "konto",
        "patent", "lizenz", "satzung", "paragraf", "klausel", "verordnung", "mandat", "akte", "register",
        "verzeichnis", "katalog", "inventar", "bestand", "quote", "prozent", "mittelwert", "median",
        "varianz", "vektor", "matrix", "integral", "gleichung", "formel", "variable", "konstante",
        "parameter", "koordinate", "achse", "radius", "volumen", "dichte", "masse", "energie", "impuls",
        "magnetfeld", "strahlung", "wellenlänge", "photon", "quark", "neuron", "synapse", "rezeptor",
        "membran", "ribosom", "mitochondrium", "sediment", "legierung", "oxid", "nitrat", "sulfat",
        "kohlenstoff", "stickstoff", "sauerstoff", "wasserstoff", "silizium", "emulsion"]
    },
    {
      level: 4, name: "Concrete", what: "Everyday objects, animals and food",
      words: ["apfel", "hammer", "stuhl", "tisch", "flasche", "eimer", "leiter", "kissen", "decke", "löffel",
        "gabel", "messer", "teller", "tasse", "kessel", "kerze", "spiegel", "fenster", "tür", "teppich",
        "korb", "geldbeutel", "bleistift", "schere", "knopf", "schlüssel", "lampe", "uhr", "brille", "schuh",
        "socke", "mütze", "jacke", "hemd", "hose", "gürtel", "handschuh", "regenschirm", "koffer", "rucksack",
        "zahnbürste", "seife", "handtuch", "bürste", "kamm", "besen", "schaufel", "blumentopf", "vase",
        "buch", "zeitung", "brief", "stempel", "kleber", "lineal", "radiergummi", "heft", "tafel", "kreide",
        "ball", "puppe", "würfel", "brot", "käse", "butter", "milch", "wurst", "banane", "birne", "kirsche",
        "erdbeere", "tomate", "gurke", "karotte", "kartoffel", "zwiebel", "knoblauch", "kuchen", "keks",
        "honig", "nudel", "reis", "suppe", "hund", "katze", "maus", "pferd", "kuh", "schwein", "schaf",
        "ziege", "huhn", "ente", "gans", "hase", "igel", "eichhörnchen", "fuchs", "frosch", "schnecke",
        "biene", "ameise", "fisch", "taube", "spatz", "fahrrad", "auto", "bus", "zug", "boot", "brücke",
        "haus", "garten", "baum", "blume", "stein", "zaun", "briefkasten", "kühlschrank", "herd", "ofen",
        "waschmaschine", "sofa", "bett", "schrank", "regal", "kommode", "tasche", "kanne", "pfanne", "topf"]
    },
    {
      level: 5, name: "Vivid", what: "Fantastical or striking: they picture themselves",
      words: ["drache", "zwerg", "ritter", "feuer", "zauberer", "vulkan", "burg", "pirat", "vampir", "einhorn",
        "riese", "hexe", "skelett", "tornado", "blitz", "meerjungfrau", "oger", "troll", "phönix", "schwert",
        "krone", "thron", "kanone", "hai", "tiger", "löwe", "krokodil", "elefant", "gorilla", "schlange",
        "adler", "wal", "oktopus", "spinne", "skorpion", "fledermaus", "eule", "rabe", "kobold", "yeti",
        "sphinx", "minotaurus", "werwolf", "zyklop", "krake", "hydra", "greif", "zentaur", "mumie", "zombie",
        "gespenst", "dämon", "engel", "teufel", "roboter", "rakete", "astronaut", "ninja", "samurai",
        "wikinger", "gladiator", "cowboy", "clown", "jongleur", "feuerwerk", "regenbogen", "gletscher",
        "wasserfall", "lawine", "tsunami", "meteor", "komet", "diamant", "schatz", "goldbarren", "rubin",
        "smaragd", "zauberstab", "pyramide", "leuchtturm", "galeone", "dampflok", "luftschiff", "achterbahn",
        "riesenrad", "karussell", "trampolin", "kaktus", "pilz", "kürbis", "wassermelone", "flamingo",
        "pfau", "pinguin", "känguru", "giraffe", "zebra", "kamel", "walross", "hummer", "qualle",
        "seepferdchen", "schmetterling", "papagei", "tukan", "bison", "mammut", "dinosaurier", "nashorn",
        "nilpferd", "panther", "wolf", "bär", "kristall", "hellebarde", "streitaxt", "katapult", "ufo"]
    }
  ]
};

if (typeof module !== "undefined") module.exports = LOCI_WORDS_DE;

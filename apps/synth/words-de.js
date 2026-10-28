"use strict";

/* ============================================================
   GERMAN, for the Language setting
   ============================================================

   Words and phrase banks for German mode. Nouns are capitalised, as German
   writes them, so a word's first symbol is a square where it should be;
   everything else is lower case. No ß anywhere: it has no capital the stats
   could file it under ('ß'.toUpperCase() is "SS"), so a word that needs it is
   left out rather than misspelt. Every letter is a–z or ä ö ü.

   The page buckets `words` by length itself; `phrase` is read by the German
   sentence templates in index.html, which carry the grammar — articles and
   adjective endings by gender and case — so the banks only say what each
   noun is.

   Plain script, no dependencies: a <script> tag in the page, `require` in the
   tests. */

var SYNTH_DE = {
  words: (
    "Aal Abt Arm Ast Axt Bad Bär Bau Bus Dom Eis Elf Fee Gas Hai Hof Hut Kai Kuh Kür Lob Mai Mus Mut Ohr " +
    "Öse Rad Reh Ruf Sog Tag Tal Tee Ton Tor Tür Uhr Ulk Weg Zeh Zoo Zug alt arm gut neu nun oft rot wir " +
    "ihr sie und mit aus bei von zum zur der die das ein wie wer was hin her gar weg dir mir uns " +
    "Haus Baum Hund Maus Buch Bild Berg Wald Feld Brot Hand Kopf Zahn Mond Gold Glas Tier Bett Dach Wand " +
    "Herz Ofen Ball Rose Igel Hase Hahn Kuss Rock Hose Kamm Napf Topf Korb Turm Burg Löwe Möwe Käse Düne " +
    "Rübe Tüte Höhe Säge Mühe Ruhe Kühe Öfen Ähre Nähe Lärm Föhn Name Nase Auge Mund Haar Bein Fass Gast " +
    "Hemd Hirn Hirt Kalb Kind Kino Knie Kran Lamm Land Lied Luft Mast Meer Mehl Moos Netz Nest Obst Park " +
    "Pilz Post Rand Riff Ring Saal Sand Satz Saft Salz Seil Senf Sieb Sofa Stab Teig Teil Torf Vase Wein " +
    "Welt Wind Wolf Wort Wurm Zaun Zelt Ziel Zoll Zopf Bach Dose Ente Eule Gans Hecke Kerze Lampe Taxi " +
    "blau gelb rosa lila kalt warm hell laut leer voll weit fern klug wild zahm faul gern hier dort oben " +
    "rund satt müde früh kühl böse grün dünn kühn spät oder aber denn auch noch sehr fast bald nie " +
    "Apfel Stuhl Tisch Insel Bühne Hügel Bäume Täler Bänke Mähne Fähre Wärme Härte Blume Sonne Wolke Stern " +
    "Stoff Schaf Milch Brief Vogel Fisch Fluss Stein Regen Schnee Freund Junge Traum Löffel Gabel Teller " +
    "Tasse Spiegel Decke Kissen Leiter Eimer Besen Hammer Nagel Faden Nadel Knopf Kugel Würfel Puppe Drache " +
    "Tiger Zebra Kamel Pferd Biene Ameise Frosch Wiese Quelle Küste Strand Hütte Brücke Mauer Glocke Höhle " +
    "Feder Welle Stimme Licht Fenster Schiff Boot Wasser Feuer Zweig Blatt Wurzel Sturm Nebel Donner Blitz " +
    "Mütze Jacke Socke Schuh Brille Koffer Stadt Dorf Markt Kirche Schule Garten Kreis Linie Punkt " +
    "Zange Mörser Bügel Käfer Hüfte Rücken Gürtel Bürste Kürbis Möhre Zwiebel Gurke Birne Kirsche Pflaume " +
    "Beere Nudel Suppe Butter Honig Kuchen Sahne Zucker Pfeffer " +
    "schön grau bunt still sanft schwer leicht jung mutig ruhig tief lang kurz klar scharf fremd breit glatt " +
    "rau blass golden weich hart neben unter über hinter heute jetzt immer schon wieder einmal " +
    "Garten Fenster Himmel Sommer Winter Herbst Morgen Abend Mittag Woche Monat Wasser " +
    "Flamme Asche Rauch Funke Schale Becher Krug Kanne Teller Pfanne Gabeln Messer Schere Lineal Tafel " +
    "Kreide Papier Blumen Vögel Wälder Felder Lieder Bücher Häuser Hühner Hölzer Mäuse Füchse " +
    "Hütten Brücken Glocken Mauern Türme Burgen Löwen Möwen Bären Tüten Rüben Dünen Fähren Kühlung " +
    "Mädchen Märchen Schlüssel Flügel Kübel Krümel Stühle Tische Knöpfe Töpfe " +
    "Körbe Zöpfe Röcke Wölfe Würmer Dörfer Wörter Länder Bänder Kälber Lämmer Nester Kerzen Lampen " +
    "Wolken Sterne Wellen Steine Wiesen Quellen Küsten Federn Stimmen Lichter Schiffe Boote Zweige Blätter " +
    "Stürme Spinne Schnecke Taube Adler Rabe Elster Krähe Fuchs Dachs Otter Biber Hirsch Wildschwein " +
    "Gämse Murmeltier Löwenzahn Tulpe Lilie Nelke Veilchen Efeu Moose Farne Tanne Fichte Kiefer Buche " +
    "Eiche Linde Birke Weide Pappel Ahorn Kastanie Nussbaum " +
    "wunder dunkle stille sanfte fröhlich traurig hungrig durstig wichtig richtig einfach schnell " +
    "langsam plötzlich zusammen drinnen gestern morgens abends niemals manchmal überall " +
    "Abenteuer Gewitter Schatten Brunnen Pinsel Leuchte Schachtel Schublade Teppich Vorhang Treppe Keller " +
    "Dachboden Schornstein Kamin Laterne Spielzeug Drachen Zauberer Riesen Zwerge Ritter Prinzessin König " +
    "Königin Schloss Krone Schwert Schild Pfeil Bogen Kutsche Kompass Fernrohr Leuchtturm Segelboot Anker " +
    "Muschel Krabbe Hummer Qualle Delfin Walfisch Seehund Pinguin Eisbär Gletscher Wüste Oase Palme " +
    "Kaktus Vulkan Insekt Schmetterling Libelle Heuschrecke Marienkäfer Glühwürmchen Regenbogen Sternbild " +
    "Mondlicht Sonnenschein Frühling Frühstück Mittagessen Abendbrot Gemüse Kartoffel Tomate Paprika " +
    "Erdbeere Himbeere Blaubeere Zitrone Orange Banane Ananas Melone Pfirsich Aprikose Brötchen Brezel " +
    "Käsekuchen Schokolade Bonbon Gummibär Limonade Kakao Kaffee Teekanne Gläser Flaschen Krüge Schüssel " +
    "Gürtel Strümpfe Schürze Mäntel Kleider Hüte Stiefel Handschuh Regenschirm Rucksack Geldbörse " +
    "Fahrrad Roller Schlitten Wagen Zugführer Bahnhof Flughafen Hafen Fähre Brücke Tunnel Kreuzung Ampel " +
    "Bäckerei Metzgerei Apotheke Bücherei Rathaus Museum Theater Kirchturm Marktplatz Spielplatz " +
    "Sandkasten Schaukel Rutsche Wippe Murmel Kreisel Drachenflug Seifenblase Luftballon Geschenk " +
    "Überraschung Übung Ärger Ärmel Ätzung Öffnung Ölfarbe Ökologie Übermut Überfluss Übergang " +
    "fröhliche freundlich glücklich gemütlich herrlich wunderbar grässlich höflich mächtig prächtig " +
    "zärtlich ängstlich gefährlich nächtlich täglich jährlich ehrlich deutlich natürlich plötzliche " +
    "Ausflug Gewicht Gesicht Hamster Holzweg Fischer Gärtner Kellner Schüler Schäfer Förster Händler " +
    "Wächter Zeichen Schrift Sprache Gedicht Kapitel Zeitung Plakat Telefon Kamera Kalender Uhrwerk Pendel " +
    "Spirale Magnet Schalter Kabel Stecker Drucker Dusche Handtuch Seife Matratze Schrank Sessel Hocker " +
    "Regal Werkzeug Schraube Bohrer Feile Hobel Rasen Beet Samen Knospe Blüte Dornen Stachel Wiesel " +
    "Marder Hermelin Luchs Specht Amsel Drossel Meise Lerche Schwalbe Storch Reiher Kranich Schwan Gänse " +
    "Forelle Karpfen Hecht Lachs Barsch Krebs Seestern Korallen Hering Sardine Kapitän Matrose " +
    "Gemälde Skizze Rahmen Leinwand Palette Fährmann Bergsee Gipfel Hängebrücke Felsen " +
    "Klippen Schlucht Lichtung Dickicht Lagerfeuer Zeltplatz Kochtopf Löffelchen Messing Kupfer Silber " +
    "Diamant Rubinen Saphir Smaragd Perlen Bernstein Kristall Spiegelei Rührei Pfannkuchen Waffel Kekse " +
    "Pudding Joghurt Quark Müsli Haferbrei Kräuter Gewürze Petersilie Schnittlauch Dill Minze Salbei " +
    "Thymian Lavendel Kamille Brennnessel Klee Moospolster Reisig Brennholz Holzscheit Funken Glut " +
    "flüstern leuchten wandern schwimmen klettern springen tauchen lachen weinen singen tanzen spielen " +
    "schreiben zeichnen rechnen lesen kochen backen pflanzen ernten träumen staunen"
  ).split(' ').filter((w, i, all) => all.indexOf(w) === i),

  /* For the phrases: advanced vocabulary only, as the English banks are.
     Nouns carry their gender (m, f, n), so the templates in index.html can
     choose the article and the adjective ending, and a weak masculine its
     form after den and dem ("den Kometen"); abstract nouns too, since
     some follow an article. Adjectives are stems that take the regular
     endings — none that change their stem (dunkel, hoch, edel). Verbs are
     intransitive and aligned: er schimmert, sie schimmern, er schimmerte. */
  /* Word mode: advanced vocabulary only. These, and every word of the phrase
     banks below, are what it draws from; nouns capitalised. */
  advanced: ("Abenddämmerung Ahnung Allegorie Anachronismus Antithese Aphorismus Archetyp Augenblick " +
    "Bewandtnis Dämmerung Dichotomie Eloquenz Empfindsamkeit Entfremdung Epiphanie Erkenntnis Fernweh " +
    "Firmament Geborgenheit Gefilde Geistesgegenwart Gemächlichkeit Gleichgewicht Habseligkeiten Heiterkeit " +
    "Herrlichkeit Inbrunst Irrlicht Kaleidoskop Kleinod Konstellation Kreuzgang Labsal Leidenschaft Leitmotiv " +
    "Liebreiz Luftspiegelung Mannigfaltigkeit Metamorphose Morgenröte Mysterium Nimbus Obhut Odyssee Orakel " +
    "Palimpsest Pantheon Paradigma Pilgerfahrt Polyphonie Quintessenz Refugium Reliquie Rhapsodie Sanftmut " +
    "Schattenriss Schimmer Sinnbild Sonnenwende Stelldichein Sternschnuppe Stillleben Talisman Tausendsassa " +
    "Tragödie Trugbild Unbeständigkeit Unergründlichkeit Vermächtnis Verwandlung Vorahnung Waldeinsamkeit " +
    "Wanderlust Wehmut Weltschmerz Widerhall Wohlklang Zauberei Zeitgeist Zwielicht Zuneigung Labyrinthe " +
    "Mirakel Elegie Hymne Ouvertüre Kantate Fuge Arabeske Ornament Filigran Gobelin Intarsie Lapislazuli " +
    "Alabaster Porphyr Obsidian Bernsteinzimmer Sternenzelt Polarlicht Nordlicht Sonnenfinsternis " +
    "abgründig beschaulich bezaubernd eigensinnig erlesen feinsinnig filigran geistreich gewissenhaft grandios " +
    "hintersinnig idyllisch kapriziös launenhaft leidenschaftlich lieblich melancholisch mysteriös nebulös " +
    "schwärmerisch sonderbar tiefgründig überschwänglich unbändig unvergleichlich verschmitzt vortrefflich " +
    "weitläufig wunderlich zauberhaft Hybris Mythos Ethos Pathos Gral Hort Aura Fanal Kanon Kodex Ikone " +
    "Idyll Muse Opus Zenit Nadir Äther Psalm Requiem Chimäre Nymphe Elysium Gloriole Emblem Elixier Amulett " +
    "Monolith Tableau Kuppel Apsis Krypta Gruft Ruine Bastion Zinne Ballade Sonate Toccata Chiffre Rebus " +
    "Enigma").split(' '),

  phrase: {
    noun: [["Kathedrale","f"],["Labyrinth","n"],["Archipel","m"],["Observatorium","n"],["Zitadelle","f"],
      ["Leuchtturm","m"],["Gletscher","m"],["Kloster","n"],["Aquädukt","n"],["Kronleuchter","m"],
      ["Wandteppich","m"],["Handschrift","f"],["Kompass","m"],["Fernrohr","n"],["Pendel","n"],["Laterne","f"],
      ["Meridian","m"],["Horizont","m"],["Lawine","f"],["Kartograf","m","Kartografen"],["Alchemist","m","Alchemisten"],["Philosoph","m","Philosophen"],
      ["Astronom","m","Astronomen"],["Wanderer","m"],["Falke","m","Falken"],["Reiher","m"],["Weinberg","m"],["Kolonnade","f"],
      ["Amphitheater","n"],["Heiligtum","n"],["Katakombe","f"],["Minarett","n"],["Vorgebirge","n"],["Fjord","m"],
      ["Savanne","f"],["Tundra","f"],["Komet","m","Kometen"],["Monsun","m"],["Sturmflut","f"],["Strudel","m"],
      ["Wasserfall","m"],["Steinbruch","m"],["Werkstatt","f"],["Bibliothek","f"],["Chronik","f"],["Sonett","n"],
      ["Sinfonie","f"],["Fresko","n"],["Mosaik","n"],["Skulptur","f"],["Obelisk","m","Obelisken"],["Mausoleum","n"],
      ["Pavillon","m"],["Gondel","f"],["Karavelle","f"],["Fregatte","f"],["Zeppelin","m"],["Lokomotive","f"],
      ["Viadukt","m"],["Sextant","m","Sextanten"],["Astrolabium","n"],["Manuskript","n"],["Sternwarte","f"],["Nebelbank","f"]],
    plural: ("Kathedralen Labyrinthe Gletscher Kometen Falken Laternen Leuchttürme Gondeln Fregatten Lawinen " +
      "Wanderer Philosophen Astronomen Bibliotheken Chroniken Sinfonien Skulpturen Fresken Obelisken Pendel " +
      "Horizonte Meridiane Wasserfälle Klöster Heiligtümer Kolonnaden Zitadellen Katakomben Manuskripte " +
      "Sternwarten Karavellen Aquädukte Kronleuchter Handschriften").split(' '),
    adj: ("verwittert leuchtend schimmernd schwermütig prächtig vergänglich ehrwürdig karg gelassen stürmisch " +
      "düster durchscheinend verschwenderisch verlassen kristallen gebieterisch rätselhaft unergründlich " +
      "nächtlich himmlisch unterirdisch vergoldet versunken uralt entlegen rastlos glühend zerbrechlich erhaben " +
      "verwunschen verborgen geheimnisvoll flüchtig majestätisch kunstvoll verschlungen vergessen einsam " +
      "zeitlos makellos gespenstisch").split(' '),
    verb: ("schimmert hallt schwindet gedeiht zerfällt flimmert erwacht verweilt zögert erklingt schwankt " +
      "verebbt entschwindet verblasst glüht kreist schweigt wacht thront ruht verharrt erstrahlt verstummt " +
      "erzittert").split(' '),
    verbPl: ("schimmern hallen schwinden gedeihen zerfallen flimmern erwachen verweilen zögern erklingen " +
      "schwanken verebben entschwinden verblassen glühen kreisen schweigen wachen thronen ruhen verharren " +
      "erstrahlen verstummen erzittern").split(' '),
    past: ("schimmerte hallte schwand gedieh zerfiel flimmerte erwachte verweilte zögerte erklang schwankte " +
      "verebbte entschwand verblasste glühte kreiste schwieg wachte thronte ruhte verharrte erstrahlte " +
      "verstummte erzitterte").split(' '),
    adv: ("beharrlich unmerklich lautlos feierlich zögernd gelassen unablässig behutsam wehmütig unaufhaltsam " +
      "bedächtig anmutig unbeirrt insgeheim allmählich rastlos").split(' '),
    /* Prepositions taking the dative here. */
    prep: "über unter hinter vor neben".split(' '),
    /* Imperatives, and the "wir" form, both transitive. */
    imp: "Ergründe Entziffere Durchquere Bewahre Kartiere Erkunde Rekonstruiere Betrachte Erforsche Verzeichne Behüte".split(' '),
    weVerb: "ergründen entziffern durchqueren bewahren kartieren erkunden rekonstruieren betrachten erforschen verzeichnen".split(' '),
    abstract: [["Gelassenheit","f"],["Beharrlichkeit","f"],["Schwermut","f"],["Einsamkeit","f"],["Sehnsucht","f"],
      ["Vergänglichkeit","f"],["Mehrdeutigkeit","f"],["Beredsamkeit","f"],["Weisheit","f"],["Klarheit","f"],
      ["Vorsehung","f"],["Erhabenheit","f"],["Tapferkeit","f"],["Aufrichtigkeit","f"],["Kühnheit","f"],
      ["Dankbarkeit","f"],["Besonnenheit","f"],["Ehrfurcht","f"],["Zuversicht","f"],["Melancholie","f"],
      ["Demut","f"],["Anmut","f"],["Gleichmut","m"],["Scharfsinn","m"],["Wagemut","m"],["Weitblick","m"],
      ["Schicksal","n"],["Vertrauen","n"],["Gedächtnis","n"],["Gewissen","n"],["Staunen","n"]]
  }
};

if (typeof module !== "undefined") module.exports = SYNTH_DE;

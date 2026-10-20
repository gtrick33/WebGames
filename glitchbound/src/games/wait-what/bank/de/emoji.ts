import type { EmojiQ } from '../emoji';

/**
 * Emoji-Rätsel auf Deutsch: [Emojis, Antworten, Fakt]; die richtige Antwort steht vorn (gemischt wird
 * beim Anzeigen). Nur hinten anhängen: die Nummer eines Rätsels ist seine Position.
 */

/** Filme und Bücher (mit ihren deutschen Titeln). */
export const EMOJI_TITLES: EmojiQ[] = [
  ['🦁👑', 'Der König der Löwen|Madagascar|Das Dschungelbuch|Zoomania', '„Der König der Löwen“ kam 1994 ins Kino und ist bis heute eine der meistverkauften Videokassetten überhaupt.'],
  ['🧊🚢💔', 'Titanic|Die Eiskönigin|Moby Dick|Life of Pi', '„Titanic“ (1997) gewann 11 Oscars und stellte damit den Rekord ein.'],
  ['👽📞🏠', 'E.T. – Der Außerirdische|Alien|Unheimliche Begegnung der dritten Art|Lilo & Stitch', '„E.T. nach Hause telefonieren.“ Der Film kam 1982 heraus.'],
  ['🦖🏝️🧬', 'Jurassic Park|King Kong|Godzilla|In einem Land vor unserer Zeit', '„Jurassic Park“ (1993). Die meisten seiner „jurassischen“ Dinosaurier lebten in Wahrheit in der Kreidezeit.'],
  ['🐠🔍', 'Findet Nemo|Arielle, die Meerjungfrau|Große Haie – Kleine Fische|Aquaman', '„Findet Nemo“ (2003). Clownfische schlüpfen alle als Männchen; der größte kann zum Weibchen werden.'],
  ['🕰️🔙🚗', 'Zurück in die Zukunft|Und täglich grüßt das Murmeltier|Cars|Interstellar', '„Zurück in die Zukunft“ (1985): 88 Meilen pro Stunde und 1,21 Gigawatt.'],
  ['🧙‍♂️💍🌋', 'Der Herr der Ringe|Harry Potter|Die Chroniken von Narnia|Game of Thrones', 'Tolkiens Buch erschien 1954/55, die Filme folgten ab 2001.'],
  ['🏠🎈👴', 'Oben|Kevin – Allein zu Haus|Toy Story|Coco', '„Oben“ (2009). Um ein echtes Haus anzuheben, bräuchte man Millionen Partyballons.'],
  ['🦈🏖️😱', 'Der weiße Hai|Baywatch|Vaiana|Free Willy', '„Der weiße Hai“ (1975). Der mechanische Hai ging so oft kaputt, dass er in der ersten Hälfte kaum vorkommt.'],
  ['🍫🏭🎫', 'Charlie und die Schokoladenfabrik|Matilda|Sophiechen und der Riese|James und der Riesenpfirsich', 'Roald Dahls Buch erschien 1964. Versteckt wurden nur fünf Goldene Tickets.'],
  ['🧛🏰🦇', 'Dracula|Batman|Frankenstein|Die Addams Family', 'Bram Stokers „Dracula“ erschien 1897.'],
  ['🌪️👠🦁', 'Der Zauberer von Oz|Twister|Cinderella|Der König der Löwen', 'In L. Frank Baums Buch von 1900 sind Dorothys Schuhe silbern. Erst der Film machte sie rubinrot.'],
  ['🍎👸☠️', 'Schneewittchen|Dornröschen|Aschenputtel|Rapunzel', '„Schneewittchen und die sieben Zwerge“ (1937) war der erste abendfüllende Zeichentrickfilm auf Zelluloid. Die Vorlage stammt von den Brüdern Grimm.'],
  ['🤠🧸🚀', 'Toy Story|Cars|Paddington|Die Monster AG', '„Toy Story“ (1995) war der erste komplett am Computer animierte Spielfilm.'],
  ['👹🚪😱', 'Die Monster AG|Shrek|Coco|Alles steht Kopf', '„Die Monster AG“ (2001). Sulley hat über zwei Millionen einzeln animierte Haare.'],
  ['🐢⏳👧', 'Momo|Die unendliche Geschichte|Jim Knopf|Das Sams', 'Michael Endes „Momo“ (1973): Die grauen Herren stehlen den Menschen die Zeit, und die Schildkröte Kassiopeia kennt den Weg.'],
  ['📖🐉♾️', 'Die unendliche Geschichte|Momo|Der Herr der Ringe|Drachenzähmen leicht gemacht', 'Michael Ende, 1979. Mit dem Glücksdrachen Fuchur wurde der Film von 1984 die bis dahin teuerste deutsche Produktion.'],
  ['👦🚂🏝️', 'Jim Knopf und Lukas der Lokomotivführer|Thomas, die kleine Lokomotive|Robinson Crusoe|Die Schatzinsel', 'Michael Endes Buch von 1960. Die Augsburger Puppenkiste machte „eine Insel mit zwei Bergen“ unsterblich.'],
  ['👦👦😈🐔', 'Max und Moritz|Hänsel und Gretel|Der Struwwelpeter|Emil und die Detektive', 'Wilhelm Buschs Bildergeschichte von 1865. Ihr erster Streich: Die beiden Lausbuben bringen die Hühner der Witwe Bolte um.'],
  ['👍✂️🧒', 'Der Struwwelpeter|Max und Moritz|Edward mit den Scherenhänden|Pinocchio', 'Heinrich Hoffmann schrieb ihn 1844 als Weihnachtsgeschenk für seinen Sohn. Dem Daumenlutscher schneidet der Schneider die Daumen ab.'],
  ['🕵️‍♂️👦💰🚂', 'Emil und die Detektive|Die drei ???|TKKG|Sherlock Holmes', 'Erich Kästner, 1929: Emil wird im Zug nach Berlin bestohlen, und eine Bande Kinder jagt den Dieb durch die Stadt.'],
  ['👧👧🏕️🔄', 'Das doppelte Lottchen|Heidi|Die wilden Hühner|Pippi Langstrumpf', 'Erich Kästner, 1949: Zwei Mädchen entdecken im Ferienlager, dass sie Zwillinge sind, und tauschen die Rollen. Hollywood machte daraus „Ein Zwilling kommt selten allein“.'],
  ['⚓🌊🎖️', 'Das Boot|Der Untergang|Titanic|U-571', 'Wolfgang Petersens „Das Boot“ (1981) bekam sechs Oscar-Nominierungen – jahrzehntelang Rekord für einen deutschen Film.'],
  ['👋🧱🥒', 'Good Bye, Lenin!|Das Leben der Anderen|Sonnenallee|Lola rennt', 'Wolfgang Beckers Film von 2003: Ein Sohn spielt seiner Mutter nach der Wende weiter die DDR vor – samt Spreewaldgurken im alten Glas.'],
  ['🏃‍♀️🔴💰⏱️', 'Lola rennt|Der Schuh des Manitu|Das Leben der Anderen|Victoria', 'Tom Tykwers Film von 1998: Lola hat 20 Minuten, um 100.000 Mark aufzutreiben – und drei Anläufe.'],
  ['🤠🪶👞', 'Der Schuh des Manitu|Winnetou|Der Schatz im Silbersee|Lucky Luke', 'Michael „Bully“ Herbigs Western-Parodie von 2001 lockte über 11 Millionen Menschen ins Kino – lange Rekord für einen deutschen Film.'],
];

/** Redensarten und Sprichwörter. */
export const EMOJI_SAYINGS: EmojiQ[] = [
  ['🐦✋🕊️🏠', 'Lieber den Spatz in der Hand als die Taube auf dem Dach|Der frühe Vogel fängt den Wurm|Die Katze lässt das Mausen nicht|Wer nicht wagt, der nicht gewinnt', 'Lieber etwas Kleines sicher haben als etwas Großes nur in Aussicht.'],
  ['🐦🌅🪱', 'Der frühe Vogel fängt den Wurm|Ein blindes Huhn findet auch mal ein Korn|Wer zuerst kommt, mahlt zuerst|Eile mit Weile', 'Wer früh dran ist, hat einen Vorteil. Spötter ergänzen: Aber erst die zweite Maus kriegt den Käse.'],
  ['🍅👀', 'Tomaten auf den Augen haben|Rot sehen|Grün hinter den Ohren sein|Sich die Augen ausweinen', 'Wer Tomaten auf den Augen hat, übersieht etwas ganz Offensichtliches.'],
  ['🐷🍀', 'Schwein haben|Den inneren Schweinehund überwinden|Perlen vor die Säue werfen|Unter aller Sau', 'Glück haben. Vermutlich, weil bei mittelalterlichen Wettkämpfen der Letzte als Trostpreis ein Schwein bekam.'],
  ['🐻💃🎉', 'Da steppt der Bär|Jemandem einen Bären aufbinden|Einen Bärenhunger haben|Das Fell des Bären verteilen, bevor er erlegt ist', 'Da ist richtig was los. Gemeint ist ein Fest, auf dem sogar der Tanzbär mitmacht.'],
  ['🐶🍳🤪', 'Da wird der Hund in der Pfanne verrückt|Da liegt der Hund begraben|Auf den Hund kommen|Schlafende Hunde wecken', 'Ein Ausruf, wenn etwas völlig unglaublich ist – noch absurder als ein Hund in der Bratpfanne.'],
  ['🐘🏬🍽️', 'Wie ein Elefant im Porzellanladen|Ein Gedächtnis wie ein Elefant|Den Elefanten im Raum übersehen|Mit Kanonen auf Spatzen schießen', 'Plump und taktlos. Im Englischen wäre es ein Stier: „a bull in a china shop“.'],
  ['🦟➡️🐘', 'Aus einer Mücke einen Elefanten machen|Wie ein Elefant im Porzellanladen|Viel Lärm um nichts|Den Teufel an die Wand malen', 'Eine Kleinigkeit maßlos aufbauschen.'],
  ['🚉❓🤷', 'Ich verstehe nur Bahnhof|Das kommt mir spanisch vor|Ich glaub, ich steh im Wald|Das ist Jacke wie Hose', 'Man versteht kein Wort. Angeblich wollten Soldaten im Ersten Weltkrieg nur noch eins hören: Bahnhof – also Heimaturlaub.'],
  ['🧥🟰👖', 'Das ist Jacke wie Hose|Ich verstehe nur Bahnhof|Die Hosen anhaben|Jemandem die Jacke vollhauen', 'Egal, das ist beides gleich. Früher wurden Jacke und Hose oft aus demselben Stoff geschneidert.'],
  ['🎁🐴👄', 'Einem geschenkten Gaul schaut man nicht ins Maul|Ich glaub, mich tritt ein Pferd|Das Pferd von hinten aufzäumen|Aufs falsche Pferd setzen', 'Ein Geschenk kritisiert man nicht. Am Gebiss erkennt man das Alter eines Pferdes.'],
  ['✋🔥', 'Für jemanden die Hand ins Feuer legen|Mit dem Feuer spielen|Öl ins Feuer gießen|Die Kastanien aus dem Feuer holen', 'Voll für jemanden bürgen. Die Redensart erinnert an mittelalterliche Feuerproben.'],
  ['🌲🌲🙈', 'Den Wald vor lauter Bäumen nicht sehen|Auf dem Holzweg sein|Ich glaub, ich steh im Wald|Wie man in den Wald hineinruft, so schallt es heraus', 'Vor lauter Einzelheiten das Offensichtliche übersehen.'],
];

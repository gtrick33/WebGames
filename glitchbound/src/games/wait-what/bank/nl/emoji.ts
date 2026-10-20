import type { EmojiQ } from '../emoji';

/**
 * Emojipuzzels in het Nederlands: [emoji, antwoorden, weetje]; het goede antwoord staat eerst (ze
 * worden geschud bij het tonen). Alleen achteraan toevoegen: de id van een puzzel is zijn plek.
 */

/** Films en boeken (met de titels die ze in Nederland en Vlaanderen hebben). */
export const EMOJI_TITLES: EmojiQ[] = [
  ['🦁👑', 'De Leeuwenkoning|Madagascar|Jungle Boek|Zootopia', 'De Leeuwenkoning kwam uit in 1994 en is nog altijd een van de best verkochte videofilms ooit.'],
  ['🧊🚢💔', 'Titanic|Frozen|Moby Dick|Life of Pi', 'Titanic (1997) won 11 Oscars en evenaarde daarmee het record.'],
  ['👽📞🏠', 'E.T.|Alien|Close Encounters of the Third Kind|Lilo & Stitch', '“E.T. phone home.” De film kwam uit in 1982.'],
  ['🦖🏝️🧬', 'Jurassic Park|King Kong|Godzilla|Ice Age', 'Jurassic Park (1993). De meeste “jura”-dinosaurussen in de film leefden eigenlijk in het krijt.'],
  ['🕰️🔙🚗', 'Back to the Future|Groundhog Day|Cars|Interstellar', 'Back to the Future (1985): 88 mijl per uur en 1,21 gigawatt.'],
  ['🧙‍♂️💍🌋', 'In de ban van de ring|Harry Potter|De kronieken van Narnia|Game of Thrones', 'Tolkiens boek verscheen in 1954–55 en heet in het Nederlands al sinds 1956 In de ban van de ring.'],
  ['🍫🏭🎫', 'Sjakie en de chocoladefabriek|Matilda|De GVR|De heksen', 'Het boek van Roald Dahl verscheen in 1964. Er werden maar vijf gouden wikkels verstopt.'],
  ['🐠🔍', 'Finding Nemo|De kleine zeemeermin|Shark Tale|Aquaman', 'Finding Nemo (2003). Clownvissen worden allemaal als mannetje geboren; de grootste kan een vrouwtje worden.'],
  ['🐀👨‍🍳', 'Ratatouille|Kung Fu Panda|Stuart Little|Chicken Run', 'Ratatouille (2007). Het team van Pixar volgde kooklessen om de keuken goed te krijgen.'],
  ['🦈🏖️😱', 'Jaws|Baywatch|Vaiana|Free Willy', 'Jaws (1975). De mechanische haai ging zo vaak kapot dat hij in de eerste helft amper te zien is.'],
  ['🍎👸☠️', 'Sneeuwwitje|Doornroosje|Assepoester|Rapunzel', 'Sneeuwwitje en de zeven dwergen (1937) was de eerste lange tekenfilm op celluloid.'],
  ['🤠🧸🚀', 'Toy Story|Cars|Paddington|Monsters en Co.', 'Toy Story (1995) was de eerste speelfilm die helemaal met de computer was geanimeerd.'],
  ['🌪️👠🦁', 'De tovenaar van Oz|Twister|Assepoester|De Leeuwenkoning', 'In het boek van L. Frank Baum uit 1900 zijn de schoentjes van Dorothy zilver. De film maakte ze robijnrood.'],
  ['👻🚫', 'Ghostbusters|Casper|Beetlejuice|Scooby-Doo', 'Ghostbusters (1984). Who you gonna call?'],
  ['👹🚪😱', 'Monsters en Co.|Shrek|Coco|Binnenstebuiten', 'Monsters en Co. (2001). Sulley heeft meer dan twee miljoen haren die allemaal apart bewegen.'],
  ['❄️👸⛄', 'Frozen|Sneeuwwitje|Assepoester|Brave', 'Frozen (2013) is losjes gebaseerd op De sneeuwkoningin van Hans Christian Andersen.'],
  ['🐼🥋', 'Kung Fu Panda|The Karate Kid|Mulan|Big Hero 6', 'Kung Fu Panda (2008). Echte reuzenpanda’s zijn tot 14 uur per dag aan het eten.'],
  ['🐰❌', 'Nijntje|Pieter Konijn|Bugs Bunny|Waterschapsheuvel', 'Dick Bruna tekende Nijntje voor het eerst in 1955. Haar mond is een kruisje, en in het Engels heet ze Miffy.'],
  ['👧📔🏠🤫', 'Het Achterhuis|Kruimeltje|Pietje Bell|Ciske de Rat', 'Het dagboek van Anne Frank verscheen in 1947 als Het Achterhuis en is in meer dan 70 talen vertaald.'],
  ['🧑‍🦰🐕🚀🌕', 'Kuifje: Mannen op de maan|Suske en Wiske|Lucky Luke|Asterix', 'In het album uit 1954 loopt Kuifje op de maan, vijftien jaar vóór Neil Armstrong.'],
  ['🔵🍄🏘️', 'De Smurfen|Asterix|Suske en Wiske|Lucky Luke', 'De Belg Peyo bedacht ze in 1958. In het Frans heten ze les Schtroumpfs.'],
  ['👦🪜🦒', 'Dikkertje Dap|Jip en Janneke|Pluk van de Petteflet|Abeltje', 'Het versje van Annie M.G. Schmidt: Dikkertje Dap klimt op de trap om met de giraf te praten.'],
  ['👦🛗🚀', 'Abeltje|Pluk van de Petteflet|Dikkertje Dap|Jip en Janneke', 'In het boek van Annie M.G. Schmidt (1953) schiet een lift door het dak van een warenhuis en vliegt de wereld rond.'],
  ['🐀👦🏫', 'Ciske de Rat|Kruimeltje|Pietje Bell|Kees de jongen', 'Het boek van Piet Bakker (1941) werd twee keer verfilmd, in 1955 en in 1984.'],
  ['🪖🧡🎖️', 'Soldaat van Oranje|Zwartboek|De Aanslag|Oorlogswinter', 'De film van Paul Verhoeven uit 1977 met Rutger Hauer is gebaseerd op het boek van Erik Hazelhoff Roelfzema.'],
  ['☕🌴✍️', 'Max Havelaar|Het Achterhuis|De Avonden|Turks fruit', 'Multatuli schreef het in 1860. De volledige titel: Max Havelaar, of de koffij-veilingen der Nederlandsche Handel-Maatschappy.'],
  ['🥚🟡🚗❓', 'Het gouden ei|De Tweeling|Karakter|De ontdekking van de hemel', 'Tim Krabbé schreef het boek in 1984. George Sluizer verfilmde het in 1988 als Spoorloos.'],
];

/** Spreekwoorden en gezegden. */
export const EMOJI_SAYINGS: EmojiQ[] = [
  ['🐱🌳👀', 'De kat uit de boom kijken|Een kat in de zak kopen|Als een kat om de hete brij draaien|Hoge bomen vangen veel wind', 'Eerst rustig afwachten hoe iets loopt, voordat je zelf iets doet.'],
  ['🐒👕', 'Daar komt de aap uit de mouw|Als een olifant in een porseleinkast|Twee vliegen in één klap|Met de deur in huis vallen', 'Nu blijkt wat er echt achter zat. Volgens een oud verhaal verstopten rondreizende artiesten een aapje in hun mouw.'],
  ['🧀🍞🚫', 'Zich de kaas niet van het brood laten eten|Boter bij de vis|Een appeltje voor de dorst|Oost west, thuis best', 'Niet over je heen laten lopen. Heel Nederlands: zelfs onze spreekwoorden gaan over kaas.'],
  ['🎣🥅', 'Achter het net vissen|Boter bij de vis|Als een vis op het droge|Twee vliegen in één klap', 'Net te laat zijn en iets mislopen: de vis zit al in het net van een ander.'],
  ['🐘🏺💥', 'Als een olifant in een porseleinkast|Met de deur in huis vallen|Hoge bomen vangen veel wind|Een kat in de zak kopen', 'Heel onhandig of tactloos te werk gaan. In het Engels is het een stier in een porseleinwinkel.'],
  ['🚪🏠💥', 'Met de deur in huis vallen|Als een olifant in een porseleinkast|Oost west, thuis best|De kat uit de boom kijken', 'Meteen zeggen waar het om gaat, zonder inleiding.'],
  ['🪰🪰👋', 'Twee vliegen in één klap|Een appeltje voor de dorst|Wie A zegt, moet ook B zeggen|Achter het net vissen', 'Twee dingen tegelijk voor elkaar krijgen. In het Engels zijn het twee vogels met één steen.'],
  ['🍎🥤', 'Een appeltje voor de dorst|De appel valt niet ver van de boom|Boter bij de vis|Twee vliegen in één klap', 'Een spaarpotje voor later, voor als het tegenzit.'],
  ['🐱👜', 'Een kat in de zak kopen|De kat uit de boom kijken|Als een vis op het droge|Uilen naar Athene dragen', 'Iets kopen dat flink tegenvalt. Op markten werd vroeger wel eens een kat in een zak verkocht als haas.'],
  ['🦉➡️🏛️', 'Uilen naar Athene dragen|Hoge bomen vangen veel wind|Als een olifant in een porseleinkast|Wie A zegt, moet ook B zeggen', 'Iets overbodigs doen: in Athene zaten al uilen genoeg, en de uil stond er zelfs op de munten.'],
  ['🐴🎁🦷', 'Een gegeven paard niet in de bek kijken|Over het paard getild zijn|Het paard achter de wagen spannen|De kat uit de boom kijken', 'Op een cadeau moet je niet afgeven. Aan de tanden zie je hoe oud een paard is.'],
  ['🧈🐟', 'Boter bij de vis|Achter het net vissen|Als een vis op het droge|Zich de kaas niet van het brood laten eten', 'Meteen contant betalen, zonder uitstel of afbetaling.'],
];

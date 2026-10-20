import type { ForeignWord, Word } from '../lexicon';

/**
 * Echte deutsche Wörter, die erfunden klingen (alt, regional, entlehnt oder einfach schräg).
 * [Wort, Bedeutung, Gruppe]: Wörter einer Gruppe bedeuten fast dasselbe und werden nie als falsche
 * Antwort füreinander angeboten. Jede Bedeutung beginnt mit einem Wort, das klein geschrieben
 * werden darf (kein Substantiv), weil das Spiel sie mitten im Satz kleinschreibt.
 * Nur hinten anhängen: die Nummer eines Wortes ist seine Position.
 */
export const ODD_WORDS: Word[] = [
  ['Kladderadatsch', 'Ein lautes Durcheinander oder ein handfester Skandal', 'chaos'],
  ['Tohuwabohu', 'Ein völliges Durcheinander', 'chaos'],
  ['Firlefanz', 'Unnützer Kram oder albernes Zeug', 'nonsense'],
  ['Mumpitz', 'Ausgemachter Unsinn', 'nonsense'],
  ['Kokolores', 'Blanker Unsinn und Theater um nichts', 'nonsense'],
  ['blümerant', 'Flau und schwindlig zumute'],
  ['Fisimatenten', 'Unnötige Umstände und faule Ausreden', 'fuss'],
  ['Brimborium', 'Überflüssiges Drumherum, viel Getue', 'fuss'],
  ['Bohei', 'Großes Aufheben um eine Sache', 'fuss'],
  ['Remmidemmi', 'Lauter Trubel, ausgelassenes Treiben', 'party'],
  ['Halligalli', 'Ausgelassenes, lautes Feiern', 'party'],
  ['Bredouille', 'Eine missliche Lage, aus der man schwer herauskommt'],
  ['Kabuff', 'Ein kleiner, dunkler Abstellraum'],
  ['Kemenate', 'Ein beheizbares Zimmer in einer Burg, oft für die Frauen'],
  ['Schabracke', 'Eine verzierte Decke unter dem Pferdesattel'],
  ['Mischpoke', 'Die liebe Verwandtschaft, eher abfällig gemeint'],
  ['Lulatsch', 'Ein langer, schlaksiger Kerl'],
  ['bauchpinseln', 'Jemandem kräftig schmeicheln'],
  ['verklickern', 'Jemandem etwas klarmachen'],
  ['kujonieren', 'Jemanden schikanieren und herumkommandieren'],
  ['schwadronieren', 'Wortreich und großspurig daherreden'],
  ['schnabulieren', 'Etwas mit großem Genuss futtern'],
  ['Dreikäsehoch', 'Ein kleines Kind (scherzhaft)', 'kid'],
  ['Steppke', 'Ein kleiner Junge (berlinerisch)', 'kid'],
  ['Fatzke', 'Ein eitler, eingebildeter Mensch', 'show-off'],
  ['Schaumschläger', 'Ein Angeber, hinter dem nichts steckt', 'show-off'],
  ['Hagestolz', 'Ein alter, eingefleischter Junggeselle'],
  ['Schlafittchen', 'Der Kragen, an dem man jemanden packt'],
  ['Kinkerlitzchen', 'Alberne Kleinigkeiten, nicht der Rede wert'],
  ['Pustekuchen', 'Ein Ausruf: Denkste, daraus wird nichts!'],
  ['Potztausend', 'Ein altmodischer Ausruf des Staunens'],
  ['holterdiepolter', 'Überstürzt und mit lautem Gepolter'],
  ['Kabbelei', 'Ein harmloser kleiner Streit'],
  ['Plörre', 'Ein dünnes, fades Getränk, vor allem schlechter Kaffee', 'coffee'],
  ['Muckefuck', 'Ein Ersatzkaffee aus Malz oder Zichorie', 'coffee'],
  ['Nassauer', 'Jemand, der auf Kosten anderer lebt'],
  ['Schwerenöter', 'Ein charmanter Frauenheld'],
  ['Luftikus', 'Ein leichtsinniger, oberflächlicher Mensch', 'flighty'],
  ['Hallodri', 'Ein leichtlebiger, unzuverlässiger Mann', 'flighty'],
  ['Duckmäuser', 'Jemand, der sich aus Angst nie zu widersprechen traut', 'coward'],
  ['Hasenfuß', 'Ein ängstlicher Feigling', 'coward'],
  ['Knöllchen', 'Ein Strafzettel, etwa fürs Falschparken'],
  ['Wolpertinger', 'Ein bayerisches Fabeltier mit Hasenkörper, Flügeln und Geweih', 'creature'],
  ['Elwetritsche', 'Ein pfälzisches Fabelwesen, halb Huhn, halb Kobold', 'creature'],
  ['Pfennigfuchser', 'Ein Geizhals, der jeden Cent zweimal umdreht'],
  ['Pappenheimer', 'Die Leute, deren Macken man nur zu gut kennt'],
  ['Tranfunzel', 'Ein lahmer Mensch, eigentlich eine trübe Lampe'],
  ['Zwiebelfisch', 'Ein Buchstabe, der aus Versehen in falscher Schrift steht'],
  ['Schusterjunge', 'Die erste Zeile eines Absatzes, allein unten auf der Seite'],
  ['Schwippschwager', 'Der Bruder des Schwagers oder der Schwägerin'],
  ['Fidibus', 'Ein Papierstreifen oder Span zum Anzünden der Pfeife'],
  ['Stövchen', 'Ein Gestell mit Teelicht, das die Teekanne warm hält'],
  ['Liebstöckel', 'Ein Küchenkraut, das nach Maggi riecht'],
  ['Feudel', 'Ein Wischlappen für den Boden (norddeutsch)'],
  ['Hackenporsche', 'Ein Einkaufsroller auf Rädern (scherzhaft)'],
  ['tüdelig', 'Ein bisschen verwirrt und vergesslich (norddeutsch)'],
  ['ratzfatz', 'Blitzschnell, im Handumdrehen'],
  ['Eierschecke', 'Ein sächsischer Blechkuchen mit Quark- und Eiercreme'],
  ['Labskaus', 'Ein Seemannsessen aus Pökelfleisch, Kartoffeln, Roter Bete'],
  ['Kaventsmann', 'Ein Riesending, etwa eine haushohe Welle'],
  ['Pfeffersack', 'Ein reicher Kaufmann, dem nur das Geld wichtig ist'],
  ['Zipperlein', 'Ein harmloses Wehwehchen, früher: die Gicht'],
  ['Glupschaugen', 'Große, hervorquellende Augen'],
  ['wuppen', 'Eine schwierige Sache stemmen und schaffen'],
  ['Schmiss', 'Eine Fechtnarbe im Gesicht – oder einfach Schwung'],
  ['Pantoffelheld', 'Ein Mann, der zu Hause nichts zu melden hat'],
  ['Krakeeler', 'Jemand, der lautstark herumzetert'],
  ['Schlendrian', 'Ein nachlässiger, bequemer Trott'],
];

/**
 * Die Wörter der Welt aus bank/lexicon.ts, in derselben Reihenfolge, mit Sprache und Bedeutung auf
 * Deutsch. Die acht deutschen Wörter der englischen Liste (Kummerspeck, Backpfeifengesicht …) sind
 * hier gegen Wörter anderer Sprachen getauscht. Das vierte Feld ersetzt bei Bedarf den Standardsatz
 * „Im Deutschen braucht man dafür einen ganzen Satz“, wo das nicht stimmt oder es Schöneres zu sagen gibt.
 */
const WORLD: readonly (readonly [word: string, language: string, meaning: string, note?: string])[] = [
  ['Kuchisabishii', 'Japanisch', 'Aus Langeweile essen, weil der Mund „einsam“ ist', 'Was dabei herauskommt, heißt bei uns Kummerspeck.'],
  ['Gluggaveður', 'Isländisch', 'Schönes Wetter, das nur durchs Fenster gut aussieht', 'Wörtlich „Fensterwetter“: draußen ist es eisig.'],
  ['Tsundoku', 'Japanisch', 'Immer neue Bücher kaufen und sie ungelesen stapeln'],
  ['Mamihlapinatapai', 'Yagan', 'Ein Blick zweier Menschen, die beide auf den ersten Schritt warten'],
  ['Pochemuchka', 'Russisch', 'Jemand, der viel zu viele Fragen stellt'],
  ['Gigil', 'Filipino', 'Der Drang, etwas unerträglich Niedliches zu knuddeln'],
  ['Age-otori', 'Japanisch', 'Nach dem Friseur schlechter aussehen als vorher'],
  ['Empalagar', 'Spanisch', 'So süß sein, dass einem davon übel wird'],
  ['Kalsarikännit', 'Finnisch', 'Allein zu Hause in Unterwäsche trinken'],
  ['Uitwaaien', 'Niederländisch', 'Bei Wind spazieren gehen, um den Kopf frei zu bekommen'],
  ['Lagom', 'Schwedisch', 'Nicht zu viel, nicht zu wenig: genau richtig'],
  ['Shemomedjamo', 'Georgisch', 'Satt sein und trotzdem weiteressen, weil es so gut schmeckt'],
  ['L’esprit de l’escalier', 'Französisch', 'Die perfekte Antwort, die einem erst auf der Treppe einfällt', 'Das Deutsche hat daraus den Treppenwitz gemacht, der heute meist eine Ironie des Schicksals meint.'],
  ['Sobremesa', 'Spanisch', 'Nach dem Essen noch lange plaudernd am Tisch sitzen'],
  ['Culaccino', 'Italienisch', 'Der Ring, den ein kaltes Glas auf dem Tisch hinterlässt'],
  ['Pålegg', 'Norwegisch', 'Alles, was man auf eine Scheibe Brot legen kann', 'Hier hält das Deutsche ausnahmsweise mit: Brotbelag.'],
  ['Iktsuarpok', 'Inuktitut', 'Immer wieder rausgehen, um zu schauen, ob jemand kommt'],
  ['Komorebi', 'Japanisch', 'Das Sonnenlicht, das durch das Laub der Bäume fällt'],
  ['Kveln', 'Jiddisch', 'Vor Stolz auf jemand anderen fast platzen, etwa aufs eigene Kind', 'Es kommt vom deutschen „quellen“: Man quillt über vor Stolz.'],
  ['Gattara', 'Italienisch', 'Eine Frau, die ihr Leben dem Füttern streunender Katzen widmet'],
  ['Hygge', 'Dänisch', 'Ein warmes, gemütliches Gefühl von Zufriedenheit', 'Am nächsten kommt ihm bei uns die Gemütlichkeit.'],
  ['Dépaysement', 'Französisch', 'Das Gefühl, fremd zu sein, wenn man weit weg von zu Hause ist'],
  ['Hiraeth', 'Walisisch', 'Das Heimweh nach einem Zuhause, in das man nicht zurückkann'],
  ['Gökotta', 'Schwedisch', 'Früh aufstehen, um draußen den ersten Vögeln zu lauschen'],
  ['Desenrascanço', 'Portugiesisch', 'Eine Notlösung in letzter Sekunde aus dem Hut zaubern'],
  ['Tartle', 'Schottisch', 'Beim Vorstellen stocken, weil einem der Name entfallen ist'],
  ['Jayus', 'Indonesisch', 'Ein Witz, so schlecht erzählt, dass man trotzdem lacht'],
  ['Zeg', 'Georgisch', 'Übermorgen', 'Hier ist das Deutsche fein raus: Das Englische hat dafür kein eigenes Wort.'],
  ['Fika', 'Schwedisch', 'Eine Kaffeepause mit Kuchen und guter Gesellschaft', 'Am nächsten kommt bei uns „Kaffee und Kuchen“.'],
  ['Ya’aburnee', 'Arabisch', 'Hoffen, vor einem geliebten Menschen zu sterben („du begräbst mich“)'],
  ['Cafuné', 'Brasilianisch-Portugiesisch', 'Jemandem zärtlich mit den Fingern durchs Haar fahren'],
  ['Boketto', 'Japanisch', 'Leer in die Ferne starren und an gar nichts denken'],
  ['Utepils', 'Norwegisch', 'Das erste Bier, das man im Frühling draußen trinkt'],
  ['Kyoikumama', 'Japanisch', 'Eine Mutter, die ihre Kinder in der Schule gnadenlos antreibt'],
];

export const WORLD_WORDS: ForeignWord[] = WORLD.map(([word, language, meaning]) => [word, language, meaning] as const);

/** Der Schlusssatz zu einem Wort der Welt. */
export const worldNote = (word: string): string => WORLD.find((w) => w[0] === word)?.[3] ?? 'Im Deutschen braucht man dafür einen ganzen Satz.';

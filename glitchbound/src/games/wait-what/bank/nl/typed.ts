import type { Typed } from '../typed';

/**
 * “Typ het” in het Nederlands: geen keuzes, je typt het antwoord. [vraag, goede antwoorden, weetje].
 * Antwoorden staan gescheiden door “|”, het eerste wordt getoond; hoofdletters, accenten, leestekens,
 * een lidwoord vooraan en kleine typfouten tellen niet mee. Alleen achteraan toevoegen: de id van een
 * vraag is zijn plek.
 */
export const TYPED: Typed[] = [
  ['Wat is het langste bot in het menselijk lichaam?', 'Dijbeen|Dijbeenbot|Femur', 'Het loopt van je heup tot je knie en is ongeveer een kwart van je lengte.'],
  ['Welke planeet heeft de kortste dag en draait in minder dan 10 uur om zijn as?', 'Jupiter', 'De grootste planeet draait het snelst: een dag duurt er ongeveer 9 uur en 56 minuten.'],
  ['In welk land ligt het grootste deel van het Amazoneregenwoud?', 'Brazilië|Brazilie', 'Zo’n 60% ligt in Brazilië. De rest is verdeeld over acht andere landen en gebieden.'],
  ['Welk gas vormt het grootste deel van de lucht die we inademen?', 'Stikstof|Stikstofgas|N2', 'Ongeveer 78% van de lucht is stikstof. Zuurstof is maar zo’n 21%.'],
  ['Hoe heet het @-teken in Nederland in de volksmond?', 'Apenstaartje|Apenstaart|Apestaartje', 'Een apenstaartje. Tsjechen zien er een opgerold haringrolletje in (zavináč) en Italianen een slakje (chiocciola).'],
  ['Wat is de hoofdstad van Canada?', 'Ottawa', 'Koningin Victoria koos de stad in 1857, onder meer omdat die tussen het Engelstalige en het Franstalige deel van Canada lag.'],
  ['Wat is het scheikundige symbool van goud?', 'Au', 'Van het Latijnse aurum. Het symbool van zilver, Ag, komt van argentum.'],
  ['Hoe heet het sterrenstelsel waarin wij wonen?', 'Melkweg|De Melkweg|Melkwegstelsel', 'Er staan tussen de 100 en 400 miljard sterren in, en onze zon is er maar één van.'],
  ['Hoe heet een woord dat achterstevoren hetzelfde is, zoals “lepel”?', 'Palindroom|Een palindroom', 'Het kan ook met hele zinnen: “Mooie zeden in Ede zei oom.”'],
  ['Wat is het hoogste dier ter wereld?', 'Giraf|Giraffe|Een giraf', 'Mannetjes worden zo’n 5,5 meter, en hun tong is ongeveer een halve meter lang.'],
  ['Welke Nederlandse stad heeft meer bruggen dan Venetië?', 'Amsterdam', 'Amsterdam telt er ruim 1.500, meer dan drie keer zoveel als Venetië.'],
  ['Hoe heet de dijk van 32 kilometer die sinds 1932 de Zuiderzee afsluit?', 'Afsluitdijk|De Afsluitdijk', 'De Afsluitdijk. Daarna heette het water erachter niet meer Zuiderzee, maar IJsselmeer.'],
  ['Wat werd Pluto in 2006?', 'Dwergplaneet|Een dwergplaneet|Dwerg', 'Sterrenkundigen maakten er een dwergplaneet van, omdat Pluto zijn baan niet heeft schoongeveegd van andere objecten.'],
  ['Wat is het grootste orgaan van het menselijk lichaam?', 'Huid|De huid', 'Uitgespreid zou de huid van een volwassene ongeveer 2 vierkante meter bedekken.'],
  ['Wat is de ster die het dichtst bij de aarde staat?', 'Zon|De zon', 'Ja, de zon. De volgende, Proxima Centauri, staat meer dan vier lichtjaar verderop.'],
  ['Welk schaakstuk mag alleen maar schuin bewegen?', 'Loper|De loper|Lopers', 'De loper. Daardoor staat elke loper de hele partij op velden van één kleur.'],
  ['Wat is de enige vogel die achteruit kan vliegen?', 'Kolibrie|Kolibries|Een kolibrie', 'Kolibries slaan hun vleugels in de vorm van een acht, dus ze kunnen stilhangen en zelfs achteruitvliegen.'],
  ['Welk metaal geleidt elektriciteit het best?', 'Zilver', 'Voor kabels gebruiken we toch koper, omdat zilver veel duurder is.'],
  ['Welke Delftse lakenhandelaar zag in de jaren 1670 als eerste bacteriën door zijn zelfgemaakte microscoop?', 'Van Leeuwenhoek|Antoni van Leeuwenhoek|Leeuwenhoek', 'Antoni van Leeuwenhoek noemde de krioelende beestjes “diertgens”. Later vond hij ze ook in de aanslag op zijn eigen tanden.'],
  ['Hoe heet de Friese schaatstocht van zo’n 200 kilometer langs elf steden?', 'Elfstedentocht|De Elfstedentocht|Elfsteden', 'De laatste werd in 1997 verreden. Het ijs moet overal minstens 15 centimeter dik zijn.'],
  ['Welke groente werd in Ierland voor Halloween uitgehold, nog vóór de pompoen?', 'Raap|Rapen|Knol|Koolraap|Knolraap', 'Rapen. Ierse landverhuizers in Amerika stapten over op pompoenen, die groter en makkelijker uit te hollen waren.'],
  ['Hoe heet het oude Keltische feest waaruit Halloween is gegroeid?', 'Samhain', 'Samhain, uitgesproken als “sauwin”, markeerde het einde van de oogst en het begin van de winter.'],
  ['Wat is de meest gebruikte letter in het Nederlands?', 'E|De E|De letter E', 'De E, met afstand. Daarom is hij in het Scrabble maar één punt waard.'],
  ['Welk land schonk het Vrijheidsbeeld aan de Verenigde Staten?', 'Frankrijk', 'Frankrijk, in 1886. Het beeld ging in 350 stukken over de Atlantische Oceaan.'],
  ['Welke kleur heeft de zwarte doos van een vliegtuig?', 'Oranje|Fel oranje', 'Felloranje, zodat hij tussen de brokstukken te vinden is.'],
  ['Welke Italiaanse stad is gebouwd op meer dan 100 eilandjes?', 'Venetië|Venetie|Venezia', 'Zo’n 118 eilandjes, met elkaar verbonden door ruim 400 bruggen.'],
  ['Welk land heeft de vorm van een laars?', 'Italië|Italie', 'De laars lijkt zelfs tegen een bal te trappen: het eiland Sicilië.'],
  ['Wat is de hardste natuurlijke stof op aarde?', 'Diamant|Diamanten', 'Diamant. Dat is gewoon koolstof, hetzelfde element als het grafiet in je potlood.'],
  ['In welke stad staat het Atomium?', 'Brussel|Bruxelles', 'Het werd gebouwd voor de Wereldtentoonstelling van 1958: een ijzerkristal, 165 miljard keer vergroot.'],
  ['Welke oceaan is het grootst?', 'Grote Oceaan|Stille Oceaan|Pacifische Oceaan|Pacific', 'De Grote Oceaan beslaat ongeveer een derde van de aarde, meer dan al het land bij elkaar.'],
];

import type { EmojiQ } from '../emoji';

/**
 * Ghicitori cu emoji în română: [emoji, răspunsuri, fapt]; răspunsul corect e primul (se amestecă la
 * afișare). Se adaugă doar la final: id-ul ghicitorii e poziția ei.
 */

/** Filme și cărți (cu titlurile sub care sunt cunoscute în România). */
export const EMOJI_TITLES: EmojiQ[] = [
  ['🦁👑', 'Regele Leu|Madagascar|Cartea junglei|Zootropolis', '„Regele Leu” a apărut în 1994 și e și azi una dintre cele mai vândute casete video din istorie.'],
  ['🧊🚢💔', 'Titanic|Regatul de gheață|Moby Dick|Viața lui Pi', '„Titanic” (1997) a luat 11 premii Oscar, egalând recordul.'],
  ['👽📞🏠', 'E.T. Extraterestrul|Alien|Întâlnire de gradul trei|Lilo și Stitch', '„E.T. sună acasă.” Filmul e din 1982.'],
  ['🦖🏝️🧬', 'Jurassic Park|King Kong|Godzilla|Epoca de gheață', '„Jurassic Park” (1993). Cei mai mulți dintre dinozaurii lui „jurasici” au trăit de fapt în Cretacic.'],
  ['🐠🔍', 'În căutarea lui Nemo|Mica sirenă|Aquaman|Povești cu peștișori', '„În căutarea lui Nemo” (2003). Peștii-clovn se nasc toți masculi, iar cel mai mare din grup poate deveni femelă.'],
  ['🕰️🔙🚗', 'Înapoi în viitor|Ziua cârtiței|Mașini|Interstellar', '„Înapoi în viitor” (1985): 88 de mile pe oră și 1,21 gigawați.'],
  ['🧙‍♂️💍🌋', 'Stăpânul inelelor|Harry Potter|Cronicile din Narnia|Urzeala tronurilor', 'Cartea lui Tolkien a apărut în 1954–1955; filmele au urmat din 2001.'],
  ['❄️👸⛄', 'Regatul de gheață|Albă-ca-Zăpada|Cenușăreasa|Frumoasa din pădurea adormită', '„Regatul de gheață” (2013) e inspirat, de departe, din „Crăiasa Zăpezii” a lui Hans Christian Andersen.'],
  ['🏠🎈👴', 'Up: O aventură în înălțimi|Singur acasă|Povestea jucăriilor|Coco', '„Up” (2009). Ca să ridici o casă adevărată ți-ar trebui milioane de baloane.'],
  ['🐀👨‍🍳', 'Ratatouille|Kung Fu Panda|Stuart Little|Shrek', '„Ratatouille” (2007). Echipa Pixar a luat lecții de gătit ca să redea bucătăria cum trebuie.'],
  ['🦈🏖️😱', 'Fălci|Baywatch|Vaiana|Free Willy', '„Fălci” (1975). Rechinul mecanic se strica atât de des încât abia apare în prima jumătate a filmului.'],
  ['🍫🏭🎫', 'Charlie și fabrica de ciocolată|Matilda|Marele Uriaș Prietenos|James și piersica uriașă', 'Cartea lui Roald Dahl a apărut în 1964. Au fost ascunse doar cinci bilete de aur.'],
  ['🧛🏰🦇', 'Dracula|Batman|Frankenstein|Familia Addams', '„Dracula” lui Bram Stoker a apărut în 1897. Stoker n-a pus niciodată piciorul în Transilvania.'],
  ['🌪️👠🦁', 'Vrăjitorul din Oz|Twister|Cenușăreasa|Regele Leu', 'În cartea lui L. Frank Baum din 1900, pantofii lui Dorothy sunt de argint. Filmul i-a făcut roșii ca rubinul.'],
  ['🕷️🧑', 'Omul-Păianjen|Ant-Man|Pânza lui Charlotte|Arahnofobia', 'Omul-Păianjen a apărut prima oară într-o bandă desenată în 1962.'],
  ['🍎👸☠️', 'Albă-ca-Zăpada|Frumoasa din pădurea adormită|Cenușăreasa|Rapunzel', '„Albă-ca-Zăpada și cei șapte pitici” (1937) a fost primul lungmetraj de animație desenat pe celuloid.'],
  ['🤠🧸🚀', 'Povestea jucăriilor|Mașini|Paddington|Monștri S.A.', '„Povestea jucăriilor” (1995) a fost primul lungmetraj animat în întregime pe calculator.'],
  ['💀🎸🌼', 'Coco|Encanto|Suflet|Monștri S.A.', '„Coco” (2017) se petrece de Ziua Morților din Mexic, când crăițele (flori portocalii) le arată spiritelor drumul spre casă.'],
  ['👦🌹🪐', 'Micul Prinț|Peter Pan|Aladdin|Pinocchio', 'Antoine de Saint-Exupéry a publicat-o în 1943, iar desenele din carte sunt chiar ale lui.'],
  ['🪵🧒👃', 'Pinocchio|Micul Prinț|Hansel și Gretel|Peter Pan', 'Carlo Collodi a scris-o în 1883. În original, Pinocchio strivește Greierele Vorbitor cu un ciocan chiar la început.'],
  ['🐐3️⃣🐺', 'Capra cu trei iezi|Scufița Roșie|Cei trei purceluși|Ursul păcălit de vulpe', 'Povestea lui Ion Creangă (1875). Lupul e chiar cumătrul caprei, iar varianta fraților Grimm are șapte iezi.'],
  ['🐓👛🪙', 'Punguța cu doi bani|Capra cu trei iezi|Ursul păcălit de vulpe|Fata babei și fata moșneagului', 'Ca să-și ia punguța înapoi, cocoșul lui Creangă bea o fântână, stinge un cuptor și înghite o cireadă întreagă.'],
  ['🦊🐻🐟', 'Ursul păcălit de vulpe|Punguța cu doi bani|Capra cu trei iezi|Fram, ursul polar', 'Vulpea îl convinge pe urs să pescuiască iarna cu coada băgată în copcă. De-asta, zice povestea, are ursul coada scurtă.'],
  ['👦🍒🌳', 'Amintiri din copilărie|Moromeții|Ion|Enigma Otiliei', 'Nică se urcă în cireșul mătușii Mărioara și e prins chiar în copac.'],
  ['🐑🗣️🔪', 'Miorița|Meșterul Manole|Capra cu trei iezi|Toma Alimoș', 'Mioara năzdrăvană îl previne pe ciobanul moldovean că ceilalți doi vor să-l omoare. El răspunde cu un testament în versuri.'],
  ['🧱👰⛪', 'Meșterul Manole|Miorița|Luceafărul|Toma Alimoș', 'Ca zidurile să nu se mai surpe, Manole o zidește de vie pe soția lui, Ana, în mănăstirea de la Curtea de Argeș.'],
  ['🌟❤️👸', 'Luceafărul|Floare albastră|Scrisoarea III|Mica sirenă', 'Poemul lui Eminescu (1883) are 98 de strofe: steaua Hyperion se îndrăgostește de o fată de împărat și cere să devină muritor. Nu i se dă voie.'],
  ['⏳👨‍🌾🌾', 'Moromeții|Ion|Baltagul|Amintiri din copilărie', 'Romanul lui Marin Preda (1955) începe cu ideea că timpul avea răbdare cu oamenii. Până la final, nu mai are.'],
  ['4️⃣🗓️3️⃣🗓️2️⃣', '4 luni, 3 săptămâni și 2 zile|Moartea domnului Lăzărescu|12:08 la est de București|Poziția copilului', 'Filmul lui Cristian Mungiu a câștigat Palme d’Or la Cannes în 2007, primul pentru România.'],
  ['⛵⬆️🌊', 'Toate pânzele sus!|Titanic|Moby Dick|Pirații din Caraibe', 'Romanul lui Radu Tudoran (1954) despre corabia „Speranța”, plecată spre Țara de Foc. Serialul TV a apărut în 1977.'],
];

/** Proverbe și expresii românești. */
export const EMOJI_SAYINGS: EmojiQ[] = [
  ['✂️🍃🐕', 'A tăia frunză la câini|Câinele care latră nu mușcă|A face din țânțar armăsar|Graba strică treaba', 'A pierde vremea fără să faci nimic util. Câinii, evident, n-au nevoie de frunze.'],
  ['🔍🪢🌾', 'A căuta nod în papură|A tăia frunză la câini|Cuiul lui Pepelea|Frica păzește bostănăria', 'A căuta cu tot dinadinsul cusururi unde nu sunt: papura n-are noduri.'],
  ['🦟➡️🐎', 'A face din țânțar armăsar|A tăia frunză la câini|Ulciorul nu merge de multe ori la apă|A căuta nod în papură', 'A exagera peste măsură. Rima ajută: țânțar, armăsar.'],
  ['🏠📌🧔', 'Cuiul lui Pepelea|Vorbești de lup și lupul la ușă|Frica păzește bostănăria|Când o face plopul pere', 'Pepelea și-a vândut casa, dar a păstrat un cui din perete, ca să aibă mereu motiv să intre. Un pretext perfect.'],
  ['🌳🍐', 'Când o face plopul pere|Cuiul lui Pepelea|Nu da vrabia din mână pe cioara de pe gard|A căuta nod în papură', 'Adică niciodată. Proverbul continuă: „și răchita micșunele”.'],
  ['✋🐦🆚🐦‍⬛', 'Nu da vrabia din mână pe cioara de pe gard|Când o face plopul pere|A face din țânțar armăsar|Vorbești de lup și lupul la ușă', 'Mai bine ceva mic și sigur decât ceva mare și nesigur. Englezii țin în mână tot o pasăre, dar în tufiș pun două.'],
  ['🗣️🐺🚪', 'Vorbești de lup și lupul la ușă|Cuiul lui Pepelea|Câinele care latră nu mușcă|Frica păzește bostănăria', 'Se spune când apare tocmai omul despre care vorbeai.'],
  ['🏺💧💥', 'Ulciorul nu merge de multe ori la apă|Graba strică treaba|Cine se scoală de dimineață departe ajunge|A face din țânțar armăsar', 'Dacă repeți la nesfârșit un lucru riscant, până la urmă o pățești.'],
  ['⏰🌅🛣️', 'Cine se scoală de dimineață departe ajunge|Graba strică treaba|Ulciorul nu merge de multe ori la apă|A se face luntre și punte', 'Cine se apucă devreme de treabă face mai mult. Englezii zic că pasărea matinală prinde viermele.'],
  ['😨💂🍉', 'Frica păzește bostănăria|Câinele care latră nu mușcă|Vorbești de lup și lupul la ușă|Graba strică treaba', 'Teama de pedeapsă îi ține pe oameni cuminți. Bostănăria e grădina cu pepeni și dovleci.'],
  ['🚣🌉', 'A se face luntre și punte|Cine se scoală de dimineață departe ajunge|Ulciorul nu merge de multe ori la apă|Când o face plopul pere', 'A face tot ce-ți stă în putință ca să ajuți pe cineva: te faci și barcă, și pod.'],
  ['🐕🗣️🚫🦷', 'Câinele care latră nu mușcă|A tăia frunză la câini|Frica păzește bostănăria|Vorbești de lup și lupul la ușă', 'Cine face mult zgomot și amenință rar trece la fapte.'],
];

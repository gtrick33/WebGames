import type { Typed } from '../typed';

/**
 * „Scrie-l” în română: fără variante, scrii răspunsul. [întrebare, răspunsuri acceptate, fapt].
 * Răspunsurile sunt despărțite cu „|”, primul e cel afișat; comparația ignoră majusculele, diacriticele,
 * punctuația și micile greșeli de scriere. Se adaugă doar la final: id-ul întrebării e poziția ei.
 */
export const TYPED: Typed[] = [
  ['Care e cel mai lung os din corpul omului?', 'Femurul|Femur|Osul coapsei', 'Merge de la șold până la genunchi și măsoară cam un sfert din înălțimea ta.'],
  ['Ce planetă are cea mai scurtă zi, cu o rotație în mai puțin de 10 ore?', 'Jupiter', 'Cea mai mare planetă se învârte cel mai repede: o zi acolo durează cam 9 ore și 56 de minute.'],
  ['În ce țară se află cea mai mare parte a pădurii amazoniene?', 'Brazilia', 'Cam 60% din ea e în Brazilia. Restul se împarte între alte opt țări și teritorii.'],
  ['Ce gaz formează cea mai mare parte a aerului pe care îl respirăm?', 'Azot|Azotul', 'Cam 78% din aer e azot. Oxigenul e doar în jur de 21%.'],
  ['Care e capitala Canadei?', 'Ottawa', 'Regina Victoria a ales-o în 1857, în parte pentru că era la granița dintre Canada anglofonă și cea francofonă.'],
  ['Care e simbolul chimic al aurului?', 'Au', 'Din latinescul aurum, din care vine și cuvântul „aur”. La fel, simbolul argintului, Ag, vine din argentum, de unde și „argint”.'],
  ['Cum se numește galaxia în care trăim?', 'Calea Lactee|Calea Laptelui|Calea Robilor|Drumul Robilor', 'Are între 100 și 400 de miliarde de stele. În folclorul românesc i se spune și „Calea Robilor”.'],
  ['Cum se numește un cuvânt care se citește la fel și de la coadă la cap, ca „cojoc”?', 'Palindrom|Palindromul', 'Merge și cu propoziții întregi: „Ene purta patru pene.”'],
  ['În ce țară se află vechiul oraș Petra?', 'Iordania', 'Clădirile lui au fost sculptate direct în stânci de gresie roz, acum peste 2.000 de ani.'],
  ['Care e cel mai înalt animal din lume?', 'Girafa|Girafă|Girafe', 'Masculii ajung la vreo 5,5 m, iar limba lor are cam o jumătate de metru.'],
  ['Ce țară a inventat hârtia?', 'China', 'Lui Cai Lun i se atribuie perfecționarea hârtiei în China, pe la anul 105.'],
  ['Cum se numește în română piesa de șah care se mută numai pe diagonală?', 'Nebunul|Nebun|Nebunii', 'Nebunul. În engleză e „episcop” (bishop), în bulgară e „ofițer”, iar noi i-am zis nebun.'],
  ['Care e cel mai mare organ al corpului omenesc?', 'Pielea|Piele', 'Întinsă, pielea unui adult ar acoperi cam 2 metri pătrați.'],
  ['Care e cea mai apropiată stea de Pământ?', 'Soarele|Soare', 'Da, Soarele. Următoarea, Proxima Centauri, e la peste patru ani-lumină.'],
  ['Care e singura pasăre care poate zbura cu spatele?', 'Colibri|Colibriul|Pasărea colibri', 'Colibriul bate din aripi descriind un opt, așa că poate sta pe loc în aer și chiar merge înapoi.'],
  ['Care metal conduce cel mai bine electricitatea?', 'Argintul|Argint', 'Pentru cabluri se folosește cuprul, pentru că argintul e mult mai scump.'],
  ['Înainte de dovleac, ce legumă scobeau irlandezii de Halloween?', 'Napul|Nap|Napi|Gulia|Gulie', 'Napi și gulii. Irlandezii emigrați în America au trecut la dovleci, mai mari și mai ușor de scobit.'],
  ['Ce țară are forma unei cizme?', 'Italia', 'Cizma pare chiar că șutează într-o minge: insula Sicilia.'],
  ['Ce oraș italian e construit pe peste 100 de insulițe?', 'Veneția|Venetia', 'Cam 118 insule, legate prin peste 400 de poduri.'],
  ['Care e cel mai înalt vârf din România?', 'Moldoveanu|Vârful Moldoveanu', 'Moldoveanu, 2.544 m, în Munții Făgăraș. Multă vreme s-a crezut că cel mai înalt e vecinul lui, Negoiu.'],
  ['Cum numim în română semnul @?', 'Coadă de maimuță|Coada de maimuță|A rond|Arond', 'Coadă de maimuță. Cehii îi zic „zavináč” (hering rulat), iar italienii „chiocciola” (melc).'],
  ['În ce zi se dăruiește mărțișorul?', '1 martie|Întâi martie|Unu martie|1', 'Pe 1 martie. Din 2017, mărțișorul e în patrimoniul UNESCO, ca tradiție comună a României, Bulgariei, Republicii Moldova și Macedoniei de Nord.'],
  ['La ce instrument cânta Gheorghe Zamfir?', 'Nai|Naiul', 'La nai. Melodia lui „Ciobanul singuratic” se aude în filmul „Kill Bill” al lui Quentin Tarantino.'],
  ['În ce sport a luat Nadia Comăneci primul 10 din istoria olimpică?', 'Gimnastică|Gimnastica', 'Gimnastică, la Montreal, în 1976. Tabela de scor a afișat „1.00”, pentru că nu fusese făcută să arate un 10.'],
  ['Ce a brevetat Petrache Poenaru la Paris, în 1827?', 'Stiloul|Stilou|Tocul rezervor|Condeiul fără sfârșit', 'Un condei cu rezervor de cerneală, făcut dintr-o pană de lebădă: strămoșul stiloului.'],
  ['Cum se numesc rulourile de carne tocată învelite în foi de varză?', 'Sarmale|Sarmalele|Sarma', 'Sarmale. Numele vine din turcescul „sarmak”, adică „a înfășura”.'],
  ['Ce animal are capul pe vechea stemă a Moldovei?', 'Bourul|Bour|Zimbrul|Zimbru', 'Bourul, cu o stea între coarne. Ultimul bour, un taur sălbatic uriaș, a murit în 1627, într-o pădure din Polonia.'],
  ['Cum se numește peștera din Munții Apuseni cu un ghețar subteran uriaș?', 'Scărișoara|Pestera Scarisoara|Peștera Scărișoara', 'Scărișoara. Gheața din ea s-a strâns timp de milenii, iar straturile cele mai vechi au peste 10.000 de ani.'],
  ['Cine a scris „Amintiri din copilărie”?', 'Ion Creangă|Creangă|Creanga', 'Ion Creangă. Înainte să devină scriitor a fost diacon, dar a fost scos din cler, printre altele pentru că a tras cu pușca în ciorile de pe biserică.'],
  ['În ce oraș s-a născut Vlad Țepeș?', 'Sighișoara|Sighisoara', 'La Sighișoara, pe la 1431. Casa în care se crede că s-a născut găzduiește azi un restaurant.'],
];

import type { EmojiQ } from '../emoji';

/**
 * Zagadki emoji po polsku: [emoji, odpowiedzi, ciekawostka]; dobra odpowiedź jest pierwsza (przy
 * wyświetlaniu się je tasuje). Dopisuj tylko na końcu: identyfikator zagadki to jej pozycja.
 */

/** Filmy i książki (pod tytułami, pod którymi znamy je w Polsce). */
export const EMOJI_TITLES: EmojiQ[] = [
  ['🦁👑', 'Król Lew|Madagaskar|Księga dżungli|Zwierzogród', '„Król Lew” wszedł do kin w 1994 roku i wciąż należy do najlepiej sprzedających się filmów do oglądania w domu.'],
  ['🧊🚢💔', 'Titanic|Kraina lodu|Moby Dick|Życie Pi', '„Titanic” (1997) zdobył 11 Oscarów i wyrównał rekord.'],
  ['👽📞🏠', 'E.T.|Obcy – 8. pasażer Nostromo|Bliskie spotkania trzeciego stopnia|Lilo i Stitch', '„E.T. dzwonić do domu”. Film wszedł do kin w 1982 roku.'],
  ['🦖🏝️🧬', 'Park Jurajski|King Kong|Godzilla|Pradawny ląd', '„Park Jurajski” (1993). Większość jego „jurajskich” dinozaurów żyła tak naprawdę w kredzie.'],
  ['🐠🔍', 'Gdzie jest Nemo?|Mała Syrenka|Rekinek|Aquaman', '„Gdzie jest Nemo?” (2003). Błazenki rodzą się jako samce, a największy w grupie może zmienić się w samicę.'],
  ['🕰️🔙🚗', 'Powrót do przyszłości|Dzień świstaka|Auta|Interstellar', '„Powrót do przyszłości” (1985): 88 mil na godzinę i 1,21 gigawata.'],
  ['🧙‍♂️💍🌋', 'Władca Pierścieni|Harry Potter|Opowieści z Narnii|Gra o tron', 'Książka Tolkiena ukazała się w latach 1954–1955, a filmy – od 2001 roku.'],
  ['❄️👸⛄', 'Kraina lodu|Królewna Śnieżka|Kopciuszek|Merida Waleczna', '„Kraina lodu” (2013) luźno nawiązuje do „Królowej Śniegu” Andersena.'],
  ['🏠🎈👴', 'Odlot|Kevin sam w domu|Toy Story|Coco', '„Odlot” (2009). Żeby unieść prawdziwy dom, trzeba by milionów balonów.'],
  ['🐀👨‍🍳', 'Ratatuj|Kung Fu Panda|Stuart Malutki|Uciekające kurczaki', '„Ratatuj” (2007). Ekipa Pixara chodziła na kursy gotowania, żeby kuchnia wyglądała jak trzeba.'],
  ['🦈🏖️😱', 'Szczęki|Słoneczny patrol|Vaiana|Uwolnić orkę', '„Szczęki” (1975). Mechaniczny rekin psuł się tak często, że w pierwszej połowie filmu prawie go nie widać.'],
  ['🤖❤️🌱', 'WALL·E|Wielka szóstka|Stalowy gigant|Ja, robot', 'W pierwszych 40 minutach „WALL·E” (2008) prawie nie ma dialogów.'],
  ['🍫🏭🎫', 'Charlie i fabryka czekolady|Matylda|Wielkomilud|Jakubek i brzoskwinia olbrzymka', 'Książka Roalda Dahla ukazała się w 1964 roku. Złotych biletów ukryto tylko pięć.'],
  ['🎃🎄💀', 'Miasteczko Halloween|Coco|Gnijąca panna młoda|Hokus pokus', '„Miasteczko Halloween” (1993) kręcono techniką poklatkową przez trzy lata.'],
  ['👻🚫', 'Pogromcy duchów|Kacper|Sok z żuka|Scooby-Doo', '„Pogromcy duchów” (1984). Do kogo zadzwonisz?'],
  ['🌪️👠🦁', 'Czarnoksiężnik z Krainy Oz|Twister|Kopciuszek|Król Lew', 'W książce L. Franka Bauma z 1900 roku trzewiki Dorotki są srebrne. Film zrobił je rubinowymi.'],
  ['🧜‍♀️🦀🎶', 'Mała Syrenka|Vaiana|Gdzie jest Dory?|Plusk', '„Mała Syrenka” (1989) powstała na podstawie dużo smutniejszej baśni Andersena z 1837 roku.'],
  ['🍎👸☠️', 'Królewna Śnieżka|Śpiąca Królewna|Kopciuszek|Roszpunka', '„Królewna Śnieżka i siedmiu krasnoludków” (1937) była pierwszym pełnometrażowym filmem animowanym na celuloidzie.'],
  ['🐺⚔️🧪', 'Wiedźmin|Krzyżacy|Czerwony Kapturek|Kubuś Puchatek', 'Andrzej Sapkowski wymyślił Geralta z Rivii w opowiadaniu z 1986 roku. Gry i serial zrobiły z niego światową gwiazdę.'],
  ['🐻🌾🎬', 'Miś|Sami swoi|Rejs|Seksmisja', 'Komedia Stanisława Barei z 1981 roku. Tytułowy miś to gigantyczna słomiana kukła, a powiedzonka z filmu na stałe weszły do języka.'],
  ['❄️👨👨➡️👩👩👩', 'Seksmisja|Kingsajz|Miś|Rejs', 'Komedia Juliusza Machulskiego z 1984 roku: dwaj mężczyźni budzą się z hibernacji w świecie, w którym zostały same kobiety.'],
  ['⚔️✝️🐎🏰', 'Krzyżacy|Potop|Pan Tadeusz|Quo vadis', 'Powieść Henryka Sienkiewicza kończy się bitwą pod Grunwaldem. Ekranizację z 1960 roku obejrzało w kinach ponad 30 milionów widzów.'],
  ['🍄🧺📜', 'Pan Tadeusz|Lalka|Chłopi|Krzyżacy', 'Epopeja Adama Mickiewicza z 1834 roku. Słynne grzybobranie wypełnia sporą część jej trzeciej księgi.'],
  ['🦁🏛️✝️', 'Quo vadis|Gladiator|Król Lew|Krzyżacy', 'Powieść Sienkiewicza o Rzymie Nerona przyniosła mu światową sławę, a w 1905 roku – Nagrodę Nobla.'],
  ['🍂❄️🌸☀️👨‍🌾', 'Chłopi|Pan Tadeusz|Nad Niemnem|Przedwiośnie', 'Powieść Władysława Reymonta ma cztery tomy, od jesieni do lata. W 1924 roku dostał za nią Nobla.'],
  ['🎎🏪💔', 'Lalka|Chłopi|Przedwiośnie|Ferdydurke', 'Powieść Bolesława Prusa z 1890 roku. Prawdziwa lalka pojawia się w niej tylko w procesie o kradzież zabawki.'],
];

/** Przysłowia i powiedzenia. */
export const EMOJI_SAYINGS: EmojiQ[] = [
  ['🍎🌳⬇️', 'Niedaleko pada jabłko od jabłoni|Obiecywać gruszki na wierzbie|Jabłko niezgody|Nie widzieć lasu spoza drzew', 'Dzieci są podobne do rodziców. Bułgarzy mówią to samo o gruszce.'],
  ['🐺😋🐑✅', 'Wilk syty i owca cała|Wilk w owczej skórze|O wilku mowa|Nie wywołuj wilka z lasu', 'Wszyscy są zadowoleni: kompromis, na którym nikt nie traci.'],
  ['🐦✊🕊️🏠', 'Lepszy wróbel w garści niż gołąb na dachu|Jedna jaskółka wiosny nie czyni|Wolny jak ptak|Ranny ptaszek', 'Lepiej mieć coś pewnego, niż gonić za czymś lepszym, ale niepewnym.'],
  ['👩‍🍳👩‍🍳👩‍🍳🍲❌', 'Gdzie kucharek sześć, tam nie ma co jeść|Głodnemu chleb na myśli|Apetyt rośnie w miarę jedzenia|Nie mów hop, póki nie przeskoczysz', 'Kiedy za dużo osób się wtrąca, nic z tego nie wychodzi. Bułgarzy mówią to samo o babciach i niemowlęciu.'],
  ['🙅🗣️🦘', 'Nie mów hop, póki nie przeskoczysz|Mowa jest srebrem, a milczenie złotem|Gdzie kucharek sześć, tam nie ma co jeść|Kto pyta, nie błądzi', 'Nie ciesz się z sukcesu, dopóki naprawdę go nie osiągniesz.'],
  ['🗣️🥈🤐🥇', 'Mowa jest srebrem, a milczenie złotem|Nie mów hop, póki nie przeskoczysz|Złota rączka|Kto pyta, nie błądzi', 'Czasem lepiej nic nie mówić. To przysłowie zna wiele języków.'],
  ['🥚🧑‍🏫🐔', 'Jajko mądrzejsze od kury|Co było pierwsze: jajko czy kura|Kura domowa|Kura znosząca złote jaja', 'Mówi się, gdy młodszy i mniej doświadczony próbuje pouczać starszego. Bułgarzy mają identyczne powiedzenie.'],
  ['🌅⏰🙏🎁', 'Kto rano wstaje, temu Pan Bóg daje|Jak sobie pościelesz, tak się wyśpisz|Ranny ptaszek|Co nagle, to po diable', 'Wczesne wstawanie się opłaca. Anglicy mówią o rannym ptaszku, który łapie robaka.'],
  ['🥄⚫🛢️🍯', 'Łyżka dziegciu w beczce miodu|Mieć muchy w nosie|Lać miód na serce|Słodkie nieróbstwo', 'Jedna drobna przykrość potrafi zepsuć całą przyjemność. Dziegieć to smolista ciecz z kory brzozy.'],
  ['🎁🐴🦷🚫', 'Darowanemu koniowi w zęby się nie zagląda|Koń, jaki jest, każdy widzi|Wsiąść na wysokiego konia|Zdrowy jak koń', 'Prezentów się nie krytykuje. Po zębach poznaje się wiek konia.'],
  ['🦪⚪🐷', 'Rzucać perły przed wieprze|Kupować kota w worku|Wyjść jak Zabłocki na mydle|Świnka skarbonka', 'Pokazywać coś cennego komuś, kto nie potrafi tego docenić. Powiedzenie pochodzi z Ewangelii.'],
  ['💰🐈👜', 'Kupować kota w worku|Rzucać perły przed wieprze|Wyjść jak Zabłocki na mydle|Ciekawość to pierwszy stopień do piekła', 'Kupić coś, czego się nie obejrzało. Dawni oszuści podobno sprzedawali w workach koty zamiast prosiąt.'],
  ['🧼💧💸', 'Wyjść jak Zabłocki na mydle|Kupować kota w worku|Prać brudy|Mydlić oczy', 'Stracić na interesie, który miał przynieść zysk. Szlachcic Zabłocki podobno spławiał mydło rzeką, aż całe się rozpuściło.'],
  ['🐟👑🤢', 'Ryba psuje się od głowy|Milczeć jak ryba|Czuć się jak ryba w wodzie|Zdrów jak ryba', 'Kłopoty w każdej organizacji zaczynają się od tych, którzy nią kierują.'],
];

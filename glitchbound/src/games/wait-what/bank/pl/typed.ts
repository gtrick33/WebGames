import type { Typed } from '../typed';

/**
 * „Wpisz to” po polsku: bez podpowiedzi, wpisujesz odpowiedź. [pytanie, przyjmowane odpowiedzi, ciekawostka].
 * Odpowiedzi są rozdzielone „|”, pierwsza jest pokazywana; porównanie pomija wielkość liter, ogonki
 * (poza „ł”, dlatego krótkie słowa z „ł” mają też wersję z „l”), interpunkcję i drobne literówki.
 * Dopisuj tylko na końcu: identyfikator pytania to jego pozycja.
 */
export const TYPED: Typed[] = [
  ['Która planeta ma najkrótszą dobę – obraca się w niecałe 10 godzin?', 'Jowisz', 'Największa planeta kręci się najszybciej: doba trwa tam około 9 godzin i 56 minut.'],
  ['Jak nazywa się słowo, które czytane wspak brzmi tak samo, jak „kajak”?', 'Palindrom|Palindromy', 'Bywają też całe zdania-palindromy, na przykład „Kobyła ma mały bok”.'],
  ['W jakim kraju leży starożytne miasto Petra, wykute w różowej skale?', 'Jordania|Jordanii', 'Jego budowle wykuto w piaskowcu ponad 2 000 lat temu. Zagrało w „Indianie Jonesie i ostatniej krucjacie”.'],
  ['Jaki symbol chemiczny ma złoto?', 'Au', 'Od łacińskiego aurum. Symbol srebra, Ag, pochodzi od argentum – i od tego samego słowa nazwę wzięła Argentyna.'],
  ['Jak nazywał się astronom, który „wstrzymał Słońce, ruszył Ziemię”?', 'Kopernik|Mikołaj Kopernik', 'Mikołaj Kopernik. Według legendy pierwszy wydrukowany egzemplarz swojego dzieła dostał na łożu śmierci w 1543 roku.'],
  ['Jaki pierwiastek Maria Skłodowska-Curie nazwała na cześć swojej ojczyzny?', 'Polon', 'Odkryła go w 1898 roku razem z Piotrem Curie, gdy Polski nie było na mapie. Nazwa miała przypomnieć światu o jej kraju.'],
  ['Pluton w 2006 roku przestał być planetą. Jaką planetą został? Wpisz brakujące słowo.', 'Karłowatą|Karłowata|Planetą karłowatą|Planeta karłowata', 'Astronomowie uznali go za planetę karłowatą, bo nie oczyścił swojej orbity z innych obiektów.'],
  ['Jaki jest największy narząd ludzkiego ciała?', 'Skóra|Skora', 'Skóra. Rozłożona na płasko u dorosłego zajęłaby około 2 m².'],
  ['Która gwiazda jest najbliżej Ziemi?', 'Słońce|Slonce', 'Tak, Słońce. Następna, Proxima Centauri, jest ponad cztery lata świetlne dalej.'],
  ['Która figura szachowa porusza się wyłącznie po skosie?', 'Goniec|Gońce|Laufer', 'Goniec. Dlatego każdy z nich spędza całą partię na polach jednego koloru.'],
  ['Który ptak jako jedyny potrafi latać do tyłu?', 'Koliber|Kolibry', 'Koliber macha skrzydłami po ósemce, więc potrafi zawisnąć w miejscu, a nawet się cofać.'],
  ['Który metal najlepiej przewodzi prąd?', 'Srebro', 'Srebro. Na przewody idzie jednak miedź, bo srebro jest dużo droższe.'],
  ['Jakie warzywo Irlandczycy drążyli na Halloween, zanim pojawiły się dynie?', 'Rzepa|Rzepę|Rzepy|Brukiew|Brukwie', 'Rzepę i brukiew. Irlandzcy emigranci w Ameryce przerzucili się na dynie, większe i łatwiejsze do wydrążenia.'],
  ['Jakiego koloru jest „czarna skrzynka” w samolocie?', 'Pomarańczowa|Pomarańczowego|Pomarańczowy|Pomarańczowej', 'Jaskrawopomarańczowa, żeby łatwo ją było znaleźć we wraku.'],
  ['Które włoskie miasto zbudowano na ponad 100 wysepkach?', 'Wenecja|Wenecję|Wenecji', 'Wenecja leży na około 118 wyspach połączonych ponad 400 mostami.'],
  ['Jaka litera jest najczęstsza w polskich tekstach?', 'A', 'A – mniej więcej co jedenasta litera. W angielskim wygrywa E, dlatego w angielskim Scrabble jest warte tylko punkt.'],
  ['Który ocean jest największy?', 'Spokojny|Ocean Spokojny|Pacyfik', 'Ocean Spokojny zajmuje mniej więcej jedną trzecią planety – więcej niż wszystkie lądy razem.'],
  ['Jak nazywa się najwyższa góra w Polsce?', 'Rysy', 'Rysy. Ich najwyższy wierzchołek (2 503 m) leży jednak po słowackiej stronie granicy – polski ma 2 499 m.'],
  ['Który kraj podarował Stanom Zjednoczonym Statuę Wolności?', 'Francja|Francji', 'Francja, w 1886 roku. Statua przypłynęła przez Atlantyk w 350 kawałkach.'],
  ['Jak nazywał się pierwszy Polak w kosmosie?', 'Hermaszewski|Mirosław Hermaszewski', 'Mirosław Hermaszewski poleciał w 1978 roku. Drugi Polak, Sławosz Uznański-Wiśniewski, dopiero 47 lat później, w 2025.'],
  ['W jakim mieście pod Krakowem jest kopalnia soli z kaplicą wykutą w soli?', 'Wieliczka|Wieliczce|Wieliczki', 'W Wieliczce. Kaplicę św. Kingi, z żyrandolami z kryształów soli, wykuli sami górnicy. Kopalnia trafiła na pierwszą listę UNESCO w 1978 roku.'],
  ['Kto jest w herbie Warszawy?', 'Syrenka|Syrena', 'Syrenka z mieczem i tarczą. Według legendy jej siostra została w Kopenhadze.'],
  ['Jak nazywał się smok, który według legendy mieszkał w jamie pod Wawelem?', 'Smok Wawelski|Wawelski', 'Szewczyk podrzucił mu owcę wypchaną siarką. Smok pił wodę z Wisły tak długo, aż pękł.'],
  ['Które zwierzę jest najszybsze na świecie, jeśli liczyć lot nurkowy?', 'Sokół wędrowny|Sokół|Sokol', 'Sokół wędrowny. Pikując na zdobycz, przekracza 300 km/h.'],
  ['Jak nazywa się galaktyka, w której żyjemy?', 'Droga Mleczna|Drogą Mleczną', 'Ma od 100 do 400 miliardów gwiazd. A „galaktyka” pochodzi od greckiego gala, czyli mleko.'],
  ['Który kraj ma kształt buta?', 'Włochy|Wlochy', 'Włochy. But wygląda nawet, jakby kopał piłkę: Sycylię.'],
  ['Jak nazywa się najtwardsza naturalna substancja na Ziemi?', 'Diament|Diamenty', 'Diament. To czysty węgiel, ten sam pierwiastek co grafit w ołówku.'],
  ['Którego kompozytora serce przemycono po śmierci w słoju do Warszawy?', 'Chopin|Chopina|Fryderyk Chopin', 'Fryderyka Chopina. Siostra Ludwika przewiozła je w słoju z alkoholem. Spoczywa w filarze kościoła Świętego Krzyża.'],
  ['Jak po polsku nazywa się znak @?', 'Małpa|Malpa|Małpka|Malpka', 'Małpa. Włosi mówią na niego „ślimak”, Holendrzy „małpi ogon”, a Duńczycy „słoniowa trąba”.'],
  ['Jak nazywa się krakowski wypiek w kształcie pierścienia, który gotuje się przed pieczeniem?', 'Obwarzanek|Obwarzanki', 'Obwarzanek, jak jego kuzyn bajgiel, kąpie się we wrzątku, zanim trafi do pieca. Od 2010 roku jest chroniony w całej Unii.'],
  ['Jak nazywało się celtyckie święto, z którego wyrosło Halloween?', 'Samhain', 'Samhain, wymawiane mniej więcej „sałin”, oznaczało koniec żniw i początek zimy.'],
];

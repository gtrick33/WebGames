import type { Typed } from '../typed';

/**
 * “Yaz bakalım” Türkçe: şık yok, cevabı yazarsın. [soru, kabul edilen cevaplar, bilgi]. Cevaplar “|” ile
 * ayrılır, ilki gösterilir; karşılaştırma büyük-küçük harfe, şapkalara, noktalamaya ve ufak yazım
 * hatalarına bakmaz. Karşılaştırma ı’yı i’ye çevirmediği için ı geçen cevapların i’li hâli de listede.
 * Yalnızca sona ekle: bir sorunun kimliği sırasıdır.
 */
export const TYPED: Typed[] = [
  ['İnsan vücudundaki en uzun kemik hangisi?', 'Uyluk kemiği|Uyluk|Femur', 'Kalçadan dize uzanır ve boyunuzun yaklaşık dörtte birini oluşturur.'],
  ['Hangi gezegenin günü en kısa, kendi çevresinde 10 saatten kısa sürede döner?', 'Jüpiter', 'En büyük gezegen en hızlı dönendir: orada bir gün yaklaşık 9 saat 56 dakika sürer.'],
  ['Amazon yağmur ormanlarının çoğu hangi ülkede?', 'Brezilya', 'Yaklaşık %60’ı Brezilya’da. Geri kalanı sekiz ülke ve bölgeye yayılmış.'],
  ['Soluduğumuz havanın çoğunu hangi gaz oluşturur?', 'Azot|Nitrojen', 'Havanın yaklaşık %78’i azot. Oksijen yalnızca %21 kadar.'],
  ['Kanada’nın başkenti neresi?', 'Ottava|Ottawa', 'Kraliçe Victoria onu 1857’de seçti; kısmen İngilizce ve Fransızca konuşulan bölgelerin tam arasında olduğu için.'],
  ['Altının kimyasal sembolü nedir?', 'Au', 'Latince aurum’dan. Gümüşün sembolü Ag de argentum’dan gelir.'],
  ['İçinde yaşadığımız galaksinin adı ne?', 'Samanyolu|Saman yolu|Samanyolu Galaksisi', '100 ile 400 milyar arasında yıldız barındırır; Güneş bunlardan yalnızca biri. Adı, gökte dökülmüş bir saman izine benzetilmesinden gelir.'],
  ['“Kabak” gibi tersten okununca da aynı kalan kelimelere ne denir?', 'Palindrom|Palindrome', 'Koca cümleler de olabilir: “Ey Edip, Adana’da pide ye.”'],
  ['Antik Petra kenti hangi ülkede?', 'Ürdün', 'Binaları 2.000 yılı aşkın süre önce pembe kumtaşı kayalıklara doğrudan oyuldu.'],
  ['Dünyanın en uzun boylu hayvanı hangisi?', 'Zürafa|Zürafalar', 'Erkekleri 5,5 metreye kadar ulaşabilir, dilleri de yarım metre kadardır.'],
  ['Kâğıdı hangi ülke icat etti?', 'Çin', 'Kâğıt yapımını 105 yılı civarında Çin’de geliştiren kişi olarak Cai Lun anılır.'],
  ['Satrançta hep çapraz giden taşa Türkçede ne denir?', 'Fil|Filler', 'Fil. Bu yüzden her fil bütün oyun boyunca aynı renk karelerde kalır. Adı, taşın Farsçadaki atası “pil”den, yani filden geliyor.'],
  ['İnsan vücudunun en büyük organı hangisi?', 'Deri|Cilt|Ten', 'Yetişkin bir insanın derisi serilse yaklaşık 2 metrekare yer kaplar.'],
  ['Dünya’ya en yakın yıldız hangisi?', 'Güneş', 'Evet, Güneş. Ondan sonraki en yakın yıldız Proxima Centauri, dört ışık yılından uzakta.'],
  ['Elektriği en iyi ileten metal hangisi?', 'Gümüş', 'Kablolarda bakır kullanılır, çünkü gümüş çok daha pahalı.'],
  ['Türkiye’nin en yüksek dağı hangisi?', 'Ağrı Dağı|Ağrı|Agri Dagi|Agri|Ararat', '5.137 m. Nuh’un gemisinin üzerine oturduğu anlatılan dağ; zirvesindeki buzul yaz kış erimez.'],
  ['Kaynağından denize kadar hiç Türkiye’den çıkmadan akan en uzun nehir hangisi?', 'Kızılırmak|Kizilirmak|Kızıl Irmak|Kizil Irmak', 'Kızılırmak. Adını kızıla çalan alüvyonlu suyundan alır ve Karadeniz’e dökülür.'],
  ['Hem Avrupa’da hem Asya’da toprağı olan, 1.500 yılı aşkın süre imparatorluk başkenti olmuş şehir hangisi?', 'İstanbul|Istanbul|Konstantinopolis', '330’da Konstantin’in başkenti oldu, 1923’e kadar da Osmanlı’nınkiydi. Ankara 13 Ekim 1923’te başkent oldu.'],
  ['@ işaretine Türkçede çoğu zaman ne denir?', 'Et|At|Kuyruklu a', 'Et. İtalyanlar ona salyangoz, Hollandalılar maymun kuyruğu, Danlar fil hortumu der.'],
  ['Kapısı kilitli ama etrafında duvar olmayan Nasreddin Hoca türbesi hangi ilçede?', 'Akşehir|Konya', 'Akşehir’de. Türbenin kapısında koca bir kilit asılı, ama dört yanı açık: tam Hoca’ya yakışır bir şaka.'],
  ['Rubik küpü hangi ülkede icat edildi?', 'Macaristan', 'Mimarlık öğretmeni Ernő Rubik 1974’te Budapeşte’de yaptı.'],
  ['Dünyanın ilk kadın savaş pilotlarından, ilk Türk kadın askerî pilotu kimdir?', 'Sabiha Gökçen|Sabiha|Gökçen', 'Sabiha Gökçen. 1937’de savaş uçağıyla uçtu; İstanbul’un Anadolu yakasındaki havalimanı onun adını taşıyor.'],
  ['Yavru kanguruya İngilizcede ne denir?', 'Joey|Covi', 'Joey. Yeni doğmuş bir kanguru bir jelibon büyüklüğündedir.'],
  ['Hangi İtalyan şehri 100’den fazla küçük adanın üzerine kurulu?', 'Venedik|Venezia|Venice', 'Yaklaşık 118 ada, 400’den fazla köprüyle birbirine bağlı.'],
  ['Hangi ülkenin haritası bir çizmeye benzer?', 'İtalya|Italya|Italy', 'Çizme bir topa tekme atıyor gibi bile görünür: Sicilya adasına.'],
  ['Geri geri uçabilen tek kuş hangisi?', 'Sinekkuşu|Sinek kuşu|Kolibri', 'Sinekkuşu kanatlarını sekiz çizer gibi çırpar; bu yüzden havada asılı durabilir, hatta geri geri uçabilir.'],
  ['Truva atı efsanesinin geçtiği antik kentin kalıntıları bugün hangi ilde?', 'Çanakkale', 'Çanakkale’de. 2004 yapımı Truva filminde kullanılan tahta at da şehrin sahilinde duruyor.'],
  ['Mimar Sinan’ın “ustalık eserim” dediği cami hangisi?', 'Selimiye|Selimiye Camii', 'Edirne’deki Selimiye. Sinan’a göre Şehzade çıraklığı, Süleymaniye kalfalığıydı; Selimiye’yi seksenini aşmışken bitirdi.'],
  ['Gölge oyununda Karagöz’ün sürekli atıştığı bilgiç arkadaşının adı ne?', 'Hacivat|Hacivad', 'Hacivat. Karagöz ile Hacivat gölge oyunu UNESCO’nun somut olmayan kültürel miras listesinde.'],
  ['Balkabağından önce İrlanda’da Cadılar Bayramı için hangi sebze oyulurdu?', 'Şalgam|Şalgam lahanası|İsveç şalgamı', 'Şalgam (ve onun iri kuzeni İsveç şalgamı). Amerika’ya göçen İrlandalılar daha iri ve kolay oyulan balkabağına geçti.'],
];

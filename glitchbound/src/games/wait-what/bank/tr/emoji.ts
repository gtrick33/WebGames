import type { EmojiQ } from '../emoji';

/**
 * Türkçe emoji bulmacaları: [emojiler, cevaplar, bilgi]; doğru cevap ilk sırada (gösterilirken karıştırılır).
 * Yalnızca sona ekle: bir bulmacanın kimliği sırasıdır.
 */

/** Filmler ve kitaplar (Türkiye’de bilinen adlarıyla). */
export const EMOJI_TITLES: EmojiQ[] = [
  ['🦁👑', 'Aslan Kral|Madagaskar|Orman Çocuğu|Zootropolis', '“Aslan Kral” 1994’te çıktı ve hâlâ tüm zamanların en çok satan ev videolarından biri.'],
  ['🧊🚢💔', 'Titanik|Karlar Ülkesi|Moby Dick|Pi’nin Yaşamı', '“Titanik” (1997) 11 Oscar kazanarak rekora ortak oldu.'],
  ['👽📞🏠', 'E.T.|Yaratık|Üçüncü Türden Yakınlaşmalar|Lilo ve Stiç', 'Meşhur repliğin aslı “E.T. phone home”, yani “E.T. evi arıyor”. Film 1982 yapımı.'],
  ['🦖🏝️🧬', 'Jurassic Park|King Kong|Godzilla|Buz Devri', '“Jurassic Park” (1993). Filmdeki “Jura dönemi” dinozorlarının çoğu aslında Kretase’de yaşadı.'],
  ['🐠🔍', 'Kayıp Balık Nemo|Küçük Deniz Kızı|Akvaman|Köpekbalığı Hikâyesi', '“Kayıp Balık Nemo” (2003). Palyaço balıklarının hepsi erkek doğar; içlerinden en irisi dişiye dönüşebilir.'],
  ['🕰️🔙🚗', 'Geleceğe Dönüş|Bugün Aslında Dündü|Arabalar|Yıldızlararası', '“Geleceğe Dönüş” (1985): saatte 88 mil ve 1,21 gigavat.'],
  ['🧙‍♂️💍🌋', 'Yüzüklerin Efendisi|Harry Potter|Narnia Günlükleri|Taht Oyunları', 'Tolkien’in kitabı 1954–55’te çıktı; filmler 2001’den itibaren geldi.'],
  ['❄️👸⛄', 'Karlar Ülkesi|Pamuk Prenses|Külkedisi|Cesur', '“Karlar Ülkesi” (2013), Andersen’in “Karlar Kraliçesi” masalından serbestçe uyarlandı.'],
  ['🏠🎈👴', 'Yukarı Bak|Evde Tek Başına|Oyuncak Hikâyesi|Koko', '“Yukarı Bak” (2009). Gerçek bir evi havalandırmak için milyonlarca parti balonu gerekirdi.'],
  ['🐀👨‍🍳', 'Ratatuy|Kung Fu Panda|Stuart Little|Tavuk Firarda', '“Ratatuy” (2007). Pixar ekibi mutfağı doğru çizebilmek için yemek kursuna gitti.'],
  ['🦈🏖️😱', 'Jaws|Baywatch|Moana|Özgür Willy', '“Jaws” (1975). Mekanik köpekbalığı o kadar sık bozuldu ki filmin ilk yarısında neredeyse hiç görünmüyor.'],
  ['🍫🏭🎫', 'Charlie’nin Çikolata Fabrikası|Matilda|Koca Sevimli Dev|Dev Şeftali', 'Roald Dahl’ın kitabı 1964’te çıktı. Çikolataların içine yalnızca beş altın bilet saklanmıştı.'],
  ['🧛🏰🦇', 'Drakula|Batman|Frankenstein|Addams Ailesi', 'Bram Stoker’ın “Drakula”sı 1897’de yayımlandı.'],
  ['🌪️👠🦁', 'Oz Büyücüsü|Twister|Külkedisi|Aslan Kral', 'L. Frank Baum’un 1900 tarihli kitabında Dorothy’nin pabuçları gümüştü. Film onları yakut kırmızısı yaptı.'],
  ['🕷️🧑', 'Örümcek Adam|Karınca Adam|Charlotte’un Ağı|Araknofobi', 'Örümcek Adam bir çizgi romanda ilk kez 1962’de göründü.'],
  ['🍎👸☠️', 'Pamuk Prenses|Uyuyan Güzel|Külkedisi|Rapunzel', '“Pamuk Prenses ve Yedi Cüceler” (1937), selüloit üzerine elle çizilmiş ilk uzun metrajlı animasyon filmdi.'],
  ['🤠🧸🚀', 'Oyuncak Hikâyesi|Arabalar|Ayı Paddington|Sevimli Canavarlar', '“Oyuncak Hikâyesi” (1995), tamamen bilgisayarla canlandırılmış ilk uzun metrajlı film.'],
  ['👹🚪😱', 'Sevimli Canavarlar|Shrek|Koko|Ters Yüz', '“Sevimli Canavarlar” (2001). Sulley’nin tek tek canlandırılmış iki milyondan fazla tüyü var.'],
  ['💀🎸🌼', 'Koko|Encanto|Soul|Sevimli Canavarlar', '“Koko” (2017), kadife çiçeklerinin ruhlara evin yolunu gösterdiği Meksika’daki Ölüler Günü’nde geçer.'],
  ['🏫😜📚', 'Hababam Sınıfı|Tosun Paşa|Süt Kardeşler|Şaban Oğlu Şaban', 'Rıfat Ilgaz’ın kitabından uyarlanan 1975 yapımı film, Türk sinemasının en sevilen komedilerinden.'],
  ['🏔️🔫🌾', 'İnce Memed|Kuyucaklı Yusuf|Çalıkuşu|Saatleri Ayarlama Enstitüsü', 'Yaşar Kemal’in 1955 tarihli romanı, Çukurova’da dağa çıkan bir eşkıyayı anlatır ve 40’tan fazla dile çevrildi.'],
  ['🐦👩‍🏫🌿', 'Çalıkuşu|Kiralık Konak|Sinekli Bakkal|Aşk-ı Memnu', 'Reşat Nuri Güntekin’in 1922 tarihli romanında Feride öğretmen olur ve Anadolu’yu dolaşır.'],
  ['⏰🔧🏛️', 'Saatleri Ayarlama Enstitüsü|Huzur|Tutunamayanlar|Kürk Mantolu Madonna', 'Ahmet Hamdi Tanpınar’ın bürokrasiyle alay eden romanı; 1961’de kitap olarak çıktı.'],
  ['🧥👩🖼️', 'Kürk Mantolu Madonna|Kuyucaklı Yusuf|İçimizdeki Şeytan|Huzur', 'Sabahattin Ali’nin 1943 tarihli romanı; yetmiş yıl sonra yeniden keşfedilip çok satanların zirvesine çıktı.'],
  ['👽🚀🧔', 'G.O.R.A.|Vizontele|Hababam Sınıfı|Eşkıya', 'Cem Yılmaz’ın 2004 tarihli bilimkurgu komedisinde halı satıcısı Arif uzaylılarca kaçırılır.'],
  ['📺🏔️📡', 'Vizontele|G.O.R.A.|Eşkıya|Babam ve Oğlum', 'Yılmaz Erdoğan ile Ömer Faruk Sorak’ın 2001 filmi, Hakkari’de bir kasabaya televizyonun gelişini anlatır.'],
];

/** Atasözleri ve deyimler. */
export const EMOJI_SAYINGS: EmojiQ[] = [
  ['💧💧🏞️', 'Damlaya damlaya göl olur|Sakla samanı, gelir zamanı|Kervan yolda düzülür|Üzüm üzüme baka baka kararır', 'Küçük birikimler zamanla büyük bir şeye dönüşür.'],
  ['🍇👀🍇', 'Üzüm üzüme baka baka kararır|Damlaya damlaya göl olur|Balık baştan kokar|Bir elin nesi var, iki elin sesi var', 'Birlikte vakit geçiren insanlar birbirinden huy kapar, birbirine benzer.'],
  ['🐻🍽️🚫💃', 'Aç ayı oynamaz|Atı alan Üsküdar’ı geçti|Kervan yolda düzülür|Balık baştan kokar', 'Karnını doyurmadığın, hakkını vermediğin kimseden iş bekleme. Eskiden sokaklarda oynatılan ayılardan kalma bir söz.'],
  ['✋👏', 'Bir elin nesi var, iki elin sesi var|Aç ayı oynamaz|Damlaya damlaya göl olur|Ayağını yorganına göre uzat', 'Tek elle alkış tutulmaz: birlikte iş görmek tek başına uğraşmaktan iyidir.'],
  ['🦶🛏️📏', 'Ayağını yorganına göre uzat|Sakla samanı, gelir zamanı|Gülü seven dikenine katlanır|Aç ayı oynamaz', 'Harcamanı gelirine göre ayarla.'],
  ['🐟👑👃', 'Balık baştan kokar|Üzüm üzüme baka baka kararır|Sütten ağzı yanan yoğurdu üfleyerek yer|Ateş olmayan yerden duman çıkmaz', 'Bir kurumdaki bozulma tepeden başlar.'],
  ['🥛🔥👄🥣💨', 'Sütten ağzı yanan yoğurdu üfleyerek yer|Balık baştan kokar|Ateş olmayan yerden duman çıkmaz|Damlaya damlaya göl olur', 'Bir kez kötü bir deneyim yaşayan, benzer durumlarda gereğinden fazla temkinli davranır.'],
  ['🔥🚫💨', 'Ateş olmayan yerden duman çıkmaz|Sütten ağzı yanan yoğurdu üfleyerek yer|Atı alan Üsküdar’ı geçti|Kervan yolda düzülür', 'Bir söylenti varsa ardında mutlaka bir gerçek payı vardır.'],
  ['🐎🏃‍♂️🌉', 'Atı alan Üsküdar’ı geçti|Kervan yolda düzülür|Aç ayı oynamaz|Gülü seven dikenine katlanır', 'İş işten geçti: atı çalan çoktan Boğaz’ın öbür yakasına varmış.'],
  ['🐪🐪🛣️', 'Kervan yolda düzülür|Atı alan Üsküdar’ı geçti|Damlaya damlaya göl olur|Sakla samanı, gelir zamanı', 'Her şeyin hazır olmasını bekleme; eksikler işe başlayınca yolda tamamlanır.'],
  ['🌹❤️🌵', 'Gülü seven dikenine katlanır|Ayağını yorganına göre uzat|Üzüm üzüme baka baka kararır|Bir elin nesi var, iki elin sesi var', 'Güzel bir şeyi isteyen, onun zahmetine de katlanmalı.'],
  ['🌾📦⏳', 'Sakla samanı, gelir zamanı|Damlaya damlaya göl olur|Ayağını yorganına göre uzat|Kervan yolda düzülür', 'Bugün değersiz görünen bir şey, günü gelince işe yarar.'],
];

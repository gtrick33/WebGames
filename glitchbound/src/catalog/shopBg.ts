import { PRODUCTS, type Product } from './shop';

/**
 * The built-in items' names and descriptions in Bulgarian, for the shop and the confirmation email of a buyer reading the
 * site in Bulgarian. Sigilfall's own names stay in English, as the game does. An item an admin made, or whose English an
 * admin changed, shows as they wrote it (tests/shop-bulgarian.test.ts checks every built-in item has its line here).
 */
const MOUNT = 'За всеки герой в акаунта ти. Само външен вид: язди се със същото темпо като всяко друго ездитно животно.';
const LOOK = 'Носи се от всеки клас, върху всяка екипировка, от Гардероба (Wardrobe). Само външен вид: показателите ти идват от това, което екипираш.';
const ON_BOARDS = 'в профила ти и в класациите.';
const ACROSS = 'В целия ти профил и зад името ти в класациите.';
const ICON = 'на мястото на снимката ти: в профила, в горната лента и в класациите.';

export const ITEMS_BG: Record<string, { name: string; blurb: string }> = {
  'ad-free': { name: 'Без реклами', blurb: 'Без рекламни банери в акаунта ти, на всяко устройство, на което влезеш, а допълнителният ти опит в дневно предизвикателство не изисква реклама. Едно плащане, без абонамент.' },
  'border-neon-halo': { name: 'Рамка „Неонов ореол“', blurb: `Пръстен от циан, виолетова и розова светлина, който бавно се върти около снимката ти, ${ON_BOARDS}` },
  'border-solar-flare': { name: 'Рамка „Слънчево изригване“', blurb: `Пламтящ златно-оранжев пръстен с трептяща корона около снимката ти, ${ON_BOARDS}` },
  'border-glitch': { name: 'Рамка „Глич“', blurb: `Пръстен, който се разцепва на циан и розово и от време на време подскача встрани, около снимката ти, ${ON_BOARDS}` },
  'border-frost': { name: 'Рамка „Скреж“', blurb: `Пръстен от лед с кристални отломки и носещи се искрици, около снимката ти, ${ON_BOARDS}` },
  'border-orbit': { name: 'Рамка „Орбита“', blurb: `Тънък двоен пръстен с две малки луни, които обикалят снимката ти, ${ON_BOARDS}` },
  'border-crown': { name: 'Рамка „Корона“', blurb: `Златен пръстен със скъпоценни камъни и малка корона отгоре, около снимката ти, ${ON_BOARDS}` },
  'banner-sunset-grid': { name: 'Банер „Залезна мрежа“', blurb: `Слънце на ивици потъва зад светеща мрежа, която се търкаля към теб. ${ACROSS}` },
  'banner-aurora': { name: 'Банер „Северно сияние“', blurb: `Северно сияние се вълнува над тъмни планини под звездно небе. ${ACROSS}` },
  'banner-nebula': { name: 'Банер „Мъглявина“', blurb: `Носещи се виолетови облаци, блещукащи звезди, планета с пръстени и по някоя падаща звезда. ${ACROSS}` },
  'banner-neon-city': { name: 'Банер „Неонов град“', blurb: `Нощни силуети на сгради със светнали прозорци и светлини, които се плъзгат отдолу. ${ACROSS}` },
  'banner-deep-sea': { name: 'Банер „Дълбоко море“', blurb: `Лъчи светлина в дълбока вода, издигащи се мехурчета и полюшващи се водорасли. ${ACROSS}` },
  'banner-ember-field': { name: 'Банер „Поле от жарава“', blurb: `Искри се издигат от светещата земя в нощта. ${ACROSS}` },
  'banner-gloam': { name: 'Банер „Здрач“', blurb: `Розова и виолетова светлина се вълнува над тъмни хълмове по здрач. ${ACROSS}` },
  'border-gloam': { name: 'Рамка „Здрач“', blurb: `Корона от здрачно виолетово, която трепти около снимката ти, ${ON_BOARDS}` },
  'icon-fox': { name: 'Икона „Лисица“', blurb: `Хитра лисица ${ICON}` },
  'icon-owl': { name: 'Икона „Бухал“', blurb: `Нощен бухал, който от време на време премигва, ${ICON}` },
  'icon-skull': { name: 'Икона „Череп“', blurb: `Череп с меко светещи очи ${ICON}` },
  'icon-rocket': { name: 'Икона „Ракета“', blurb: `Ракета с трептящ пламък ${ICON}` },
  'icon-crown': { name: 'Икона „Корона“', blurb: `Корона със скъпоценни камъни, която улавя светлината, ${ICON}` },
  'icon-bolt': { name: 'Икона „Мълния“', blurb: `Пращяща мълния ${ICON}` },
  'sigilfall-crownforged-wyrm': { name: 'Crownforged Wyrm', blurb: `Дракон от Sigilfall в черни доспехи със златни ръбове, под корона от рога, с крила, прорязани от разтопена светлина, и пламтяща опашка. ${MOUNT}` },
  'sigilfall-galecrest-drake': { name: 'Galecrest Drake', blurb: `Буреносен син дракон от Sigilfall с гребен от рога, кристални шипове по гърба и мълнии в крилете. ${MOUNT}` },
  'sigilfall-runetusk-boar': { name: 'Runetusk War-Boar', blurb: `Боен глиган от Sigilfall в доспехи с шипове и рогат шлем, с бивни, опасани със светещи руни. ${MOUNT}` },
  'sigilfall-cinderhorn-hart': { name: 'Cinderhorn Hart', blurb: `Въгленосив елен от Sigilfall, чиито рога са жив пламък, с руни от жарава по хълбоците. ${MOUNT}` },
  'sigilfall-moonglass-hart': { name: 'Moonglass Hart', blurb: `Бял елен от Sigilfall с рога от светещ кристал, доспехи с ръбове от светлина и бледи руни, и звездна светлина около копитата. ${MOUNT}` },
  'sigilfall-gloamwing-drake': { name: 'Gloamwing Drake', blurb: `Дракон от Sigilfall в цвета на последната светлина, в здрачновиолетови доспехи под корона от рога, с крила, прорязани от бледовиолетов огън. ${MOUNT}` },
  'sigilfall-crownforged-helm': { name: 'Crownforged Helm', blurb: `Шлем от Sigilfall от черна стомана под златна корона, с драконови рога и пламтящо забрало. ${LOOK}` },
  'sigilfall-crownforged-plate': { name: 'Crownforged Plate', blurb: `Броня от Sigilfall от черни плочи, съшити с разтопено злато, с наплечници като драконови криле и пурпурно наметало. ${LOOK}` },
  'sigilfall-celestine-crown': { name: 'Celestine Crown', blurb: `Сребърна диадема от Sigilfall с лунен сърп под въртящ се кръг от звезди. ${LOOK}` },
  'sigilfall-celestine-mantle': { name: 'Celestine Mantle', blurb: `Бяло-сребърна роба от Sigilfall с наплечници като полумесеци и наметало от нощ, пълна със звезди. ${LOOK}` },
  'sigilfall-gloamquill-cowl': { name: 'Gloamquill Cowl', blurb: `Тъмна качулка от Sigilfall с маска с клюн, гребен от пера и две светещи очи. ${LOOK}` },
  'sigilfall-gloamquill-mantle': { name: 'Gloamquill Mantle', blurb: `Кожена екипировка от Sigilfall под мантия от черни пера, с дълго наметало от пера отзад. ${LOOK}` },
  'sigilfall-duskborn-helm': { name: 'Duskborn Helm', blurb: `Шлем от Sigilfall от черна стомана под корона от здрач, с рога и забрало, което гори във виолетово. ${LOOK}` },
  'sigilfall-duskborn-plate': { name: 'Duskborn Plate', blurb: `Броня от Sigilfall от черни плочи, съшити с виолетова светлина, с наплечници като драконови криле и наметало в цвета на здрача. ${LOOK}` },
  'sigilfall-gloamknight': {
    name: 'Пакет Gloamknight',
    blurb: 'Осмият клас в Sigilfall, Gloamknight, за акаунта ти, заедно с шлема и бронята Duskborn, Gloamwing Drake, рамката и банера „Здрач“ и още две места за герои.',
  },
  'look-names': { name: 'Ефекти за името', blurb: 'Малко цвят и блясък за прякора ти.' },
};

/** An item's name and description for a Bulgarian reader: the line above while the item still reads as the code wrote it. */
export function itemBg(p: Pick<Product, 'id' | 'name' | 'blurb'>): { name: string; blurb: string } {
  const bg = ITEMS_BG[p.id];
  const code = PRODUCTS.find((x) => x.id === p.id);
  if (!bg || !code) return { name: p.name, blurb: p.blurb };
  return { name: p.name === code.name ? bg.name : p.name, blurb: p.blurb === code.blurb ? bg.blurb : p.blurb };
}

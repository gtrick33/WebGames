/**
 * Gut Check facts: well-known, rounded figures (populations about 2024, typical adult weights, top
 * speeds, heights to the tip). Two items are only ever compared when they differ by at least 25%
 * (or 10 years), so rounding can never flip an answer. Original list, written for this game.
 */

export interface Category {
  id: string;
  /** The topic, as a question. */
  question: string;
  /** Buttons: the bigger answer first. */
  more: string;
  less: string;
  /** How a value reads, smallest unit first: a value reads in the biggest unit it has at least one of. */
  units: Unit[];
  /** The same in US units, when they differ (mph, lb, ft…). */
  usUnits?: Unit[];
  /** Small print for the topic, e.g. when its figures are from. */
  note?: string;
  /** Years compare by distance, not by ratio. */
  years?: boolean;
  /** Items: `wide` marks one whose real number varies a lot (breeds, kinds), so it needs a wider gap. */
  items: [name: string, emoji: string, value: number, wide?: boolean][];
}

/** One way to say an amount: `per` is how many of the topic's base unit (kg, km/h, m…) make one. */
export interface Unit {
  per: number;
  say: (amount: string) => string;
  /** Round to this many significant digits (converted US amounts, billions) instead of whole numbers. */
  sig?: number;
}

const n = (v: number): string => v.toLocaleString('en-US', v < 1 ? { maximumSignificantDigits: 2 } : { maximumFractionDigits: v < 10 ? 1 : 0 });
const unit = (per: number, label: string, sig?: number): Unit => ({ per, say: (s) => `${s} ${label}`, ...(sig ? { sig } : {}) });
/** A US unit: converted amounts are rounded to 3 significant digits ("about 3,310 lb"). */
const us = (per: number, label: string): Unit => unit(per, label, 3);

const unitsFor = (cat: Category, usUnits = false): Unit[] => (usUnits && cat.usUnits ? cat.usUnits : cat.units);

/** The unit a value reads in on its own. */
export function unitOf(cat: Category, v: number, usUnits = false): Unit {
  const list = unitsFor(cat, usUnits);
  let u = list[0]!;
  for (const x of list) if (v >= x.per) u = x;
  return u;
}

/**
 * The unit the right card reads in: the left card's, so both numbers of a comparison share one unit
 * ("800 g vs 2,000 g", never "800 g vs 2 kg"), unless that reads badly (0.0001 metric tons). The left
 * card's unit comes from its own value only, so it never gives the hidden one away.
 */
export function pairUnit(cat: Category, left: number, right: number, usUnits = false): Unit {
  const u = unitOf(cat, left, usUnits);
  const x = right / u.per;
  return x >= 0.1 && x < 100_000 ? u : unitOf(cat, right, usUnits);
}

/** A value in a given unit, e.g. "about 1.5 metric tons" (years: "in 1969"). */
export function formatIn(cat: Category, u: Unit, v: number): string {
  if (cat.years) return `in ${Math.round(v)}`;
  const x = v / u.per;
  return `about ${u.say(u.sig ? x.toLocaleString('en-US', { maximumSignificantDigits: u.sig }) : n(x))}`;
}

/** A value in its own unit. */
export const formatValue = (cat: Category, v: number, usUnits = false): string => formatIn(cat, unitOf(cat, v, usUnits), v);

export const CATEGORIES: Category[] = [
  {
    id: 'people',
    question: 'Which has more people?',
    more: 'More',
    less: 'Fewer',
    units: [unit(1, 'people'), unit(1e6, 'million people'), unit(1e9, 'billion people', 3)],
    note: 'Populations as of 2024.',
    items: [
      ['India', '🇮🇳', 1_440e6],
      ['China', '🇨🇳', 1_410e6],
      ['United States', '🇺🇸', 340e6],
      ['Indonesia', '🇮🇩', 280e6],
      ['Pakistan', '🇵🇰', 245e6],
      ['Nigeria', '🇳🇬', 230e6],
      ['Brazil', '🇧🇷', 212e6],
      ['Bangladesh', '🇧🇩', 173e6],
      ['Russia', '🇷🇺', 144e6],
      ['Mexico', '🇲🇽', 130e6],
      ['Japan', '🇯🇵', 124e6],
      ['Philippines', '🇵🇭', 115e6],
      ['Egypt', '🇪🇬', 114e6],
      ['Vietnam', '🇻🇳', 100e6],
      ['Turkey', '🇹🇷', 86e6],
      ['Germany', '🇩🇪', 84e6],
      ['Thailand', '🇹🇭', 72e6],
      ['United Kingdom', '🇬🇧', 69e6],
      ['France', '🇫🇷', 68e6],
      ['Italy', '🇮🇹', 59e6],
      ['South Korea', '🇰🇷', 52e6],
      ['Spain', '🇪🇸', 48e6],
      ['Argentina', '🇦🇷', 46e6],
      ['Canada', '🇨🇦', 41e6],
      ['Poland', '🇵🇱', 37e6],
      ['Australia', '🇦🇺', 27e6],
      ['Romania', '🇷🇴', 19e6],
      ['Netherlands', '🇳🇱', 18e6],
      ['Sweden', '🇸🇪', 10.5e6],
      ['Greece', '🇬🇷', 10.4e6],
      ['Switzerland', '🇨🇭', 9e6],
      ['Bulgaria', '🇧🇬', 6.4e6],
      ['Norway', '🇳🇴', 5.5e6],
      ['Ireland', '🇮🇪', 5.3e6],
      ['New Zealand', '🇳🇿', 5.2e6],
      ['Iceland', '🇮🇸', 0.39e6],
    ],
  },
  {
    id: 'area',
    question: 'Which country is bigger?',
    more: 'Bigger',
    less: 'Smaller',
    units: [unit(1, 'km²'), unit(1e6, 'million km²')],
    usUnits: [us(2.58999, 'sq mi'), us(2.58999e6, 'million sq mi')],
    items: [
      ['Russia', '🇷🇺', 17.1e6],
      ['Canada', '🇨🇦', 10e6],
      ['China', '🇨🇳', 9.6e6],
      ['Brazil', '🇧🇷', 8.5e6],
      ['Australia', '🇦🇺', 7.7e6],
      ['India', '🇮🇳', 3.3e6],
      ['Argentina', '🇦🇷', 2.8e6],
      ['Algeria', '🇩🇿', 2.4e6],
      ['Mexico', '🇲🇽', 1.96e6],
      ['Egypt', '🇪🇬', 1e6],
      ['Turkey', '🇹🇷', 784_000],
      ['France', '🇫🇷', 550_000],
      ['Spain', '🇪🇸', 506_000],
      ['Japan', '🇯🇵', 378_000],
      ['Germany', '🇩🇪', 357_000],
      ['Italy', '🇮🇹', 301_000],
      ['United Kingdom', '🇬🇧', 243_000],
      ['Greece', '🇬🇷', 132_000],
      ['Bulgaria', '🇧🇬', 111_000],
      ['Portugal', '🇵🇹', 92_000],
      ['Ireland', '🇮🇪', 70_000],
      ['Switzerland', '🇨🇭', 41_000],
      ['Belgium', '🇧🇪', 30_700],
      ['Luxembourg', '🇱🇺', 2_600],
      ['Malta', '🇲🇹', 316],
      ['Monaco', '🇲🇨', 2],
    ],
  },
  {
    id: 'weight',
    question: 'Which is heavier?',
    more: 'Heavier',
    less: 'Lighter',
    units: [unit(0.001, 'g'), unit(1, 'kg'), unit(1000, 'metric tons')],
    usUnits: [us(0.0283495, 'oz'), us(0.453592, 'lb'), us(907.185, 'tons')],
    items: [
      ['Blue whale', '🐋', 150_000],
      ['African elephant', '🐘', 6_000],
      ['Hippo', '🦛', 1_500],
      ['Giraffe', '🦒', 1_200, true],
      ['Great white shark', '🦈', 1_100],
      ['Cow', '🐄', 700],
      ['Horse', '🐎', 500],
      ['Polar bear', '🐻‍❄️', 450],
      ['Lion', '🦁', 190],
      ['Gorilla', '🦍', 160],
      ['Ostrich', '🐦', 120],
      ['Giant panda', '🐼', 100],
      ['Red kangaroo', '🦘', 85],
      ['Emperor penguin', '🐧', 30],
      ['Koala', '🐨', 9],
      ['House cat', '🐈', 4.5],
      ['Chicken', '🐔', 2.5, true],
      ['Rabbit', '🐇', 2, true],
      ['Hedgehog', '🦔', 0.8],
      ['Hamster', '🐹', 0.12],
      ['Mouse', '🐁', 0.02],
      ['Honeybee', '🐝', 0.0001],
    ],
  },
  {
    id: 'speed',
    question: 'Which is faster?',
    more: 'Faster',
    less: 'Slower',
    units: [unit(0.001, 'meters an hour'), unit(1, 'km/h')],
    usUnits: [us(0.0003048, 'feet an hour'), us(1.609344, 'mph')],
    items: [
      ['Concorde, cruising', '✈️', 2_180],
      ['Passenger jet, cruising', '🛫', 900],
      ['Peregrine falcon, diving', '🦅', 320],
      ['Bullet train', '🚄', 300],
      ['Cheetah', '🐆', 110],
      ['Lion', '🦁', 80],
      ['Racehorse', '🏇', 70],
      ['Fastest sprinter ever', '🏃', 45],
      ['House cat', '🐈', 48],
      ['African elephant', '🐘', 40],
      ['Grizzly bear', '🐻', 55],
      ['Cyclist, on a flat road', '🚴', 25],
      ['Chicken', '🐔', 14],
      ['Walking person', '🚶', 5],
      ['Giant tortoise', '🐢', 0.3],
      ['Sloth', '🦥', 0.25],
      ['Garden snail', '🐌', 0.003],
    ],
  },
  {
    id: 'height',
    question: 'Which is taller?',
    more: 'Taller',
    less: 'Shorter',
    units: [unit(1, 'm tall')],
    usUnits: [us(0.3048, 'ft tall')],
    items: [
      ['Burj Khalifa', '🏙️', 828],
      ['Tokyo Skytree', '🗼', 634],
      ['CN Tower', '🗼', 553],
      ['Taipei 101', '🏢', 508],
      ['Empire State Building', '🏢', 443],
      ['Eiffel Tower', '🗼', 330],
      ['Golden Gate Bridge towers', '🌉', 227],
      ['Gateway Arch', '🌈', 192],
      ['Washington Monument', '🏛️', 169],
      ['Great Pyramid of Giza', '🔺', 139],
      ['Big Ben’s clock tower', '🕰️', 96],
      ['Statue of Liberty, with its base', '🗽', 93],
      ['Taj Mahal', '🕌', 73],
      ['Leaning Tower of Pisa', '🏛️', 56],
      ['Colosseum', '🏟️', 48],
      ['Giraffe', '🦒', 5.5, true],
      ['Double-decker bus', '🚌', 4.4],
      ['Basketball hoop', '🏀', 3.05],
    ],
  },
  {
    id: 'mountain',
    question: 'Which mountain is higher?',
    more: 'Higher',
    less: 'Lower',
    units: [unit(1, 'm high')],
    usUnits: [us(0.3048, 'ft high')],
    items: [
      ['Mount Everest', '🏔️', 8_849],
      ['Aconcagua', '⛰️', 6_961],
      ['Denali', '⛰️', 6_190],
      ['Kilimanjaro', '🌋', 5_895],
      ['Mount Elbrus', '🏔️', 5_642],
      ['Mont Blanc', '🏔️', 4_806],
      ['Mount Fuji', '🗻', 3_776],
      ['Musala, Bulgaria', '⛰️', 2_925],
      ['Mount Olympus, Greece', '⛰️', 2_918],
      ['Ben Nevis', '⛰️', 1_345],
      ['Vesuvius', '🌋', 1_281],
      ['Table Mountain', '⛰️', 1_085],
    ],
  },
  {
    id: 'river',
    question: 'Which river is longer?',
    more: 'Longer',
    less: 'Shorter',
    units: [unit(1, 'km long')],
    usUnits: [us(1.609344, 'miles long')],
    items: [
      ['The Nile', '🌊', 6_650],
      ['The Congo', '🌊', 4_700],
      ['The Mekong', '🌊', 4_350],
      ['The Mississippi', '🌊', 3_730],
      ['The Volga', '🌊', 3_530],
      ['The Danube', '🌊', 2_850],
      ['The Ganges', '🌊', 2_525],
      ['The Rhine', '🌊', 1_230],
      ['The Seine', '🌊', 777],
      ['The Thames', '🌊', 346],
    ],
  },
  {
    id: 'kcal',
    question: 'Which has more calories?',
    more: 'More',
    less: 'Fewer',
    units: [unit(1, 'kcal per 100 g')],
    items: [
      ['Olive oil', '🫒', 884],
      ['Butter', '🧈', 717],
      ['Peanut butter', '🥜', 588],
      ['Almonds', '🌰', 579],
      ['Dark chocolate', '🍫', 560],
      ['Cheddar cheese', '🧀', 403],
      ['Sugar', '🍬', 387],
      ['Honey', '🍯', 304],
      ['Pizza', '🍕', 266],
      ['White bread', '🍞', 265],
      ['Farmed salmon', '🐟', 208],
      ['Chicken breast, cooked', '🍗', 165],
      ['Avocado', '🥑', 160],
      ['Boiled egg', '🥚', 155],
      ['Cooked rice', '🍚', 130],
      ['Banana', '🍌', 89],
      ['Boiled potato', '🥔', 87],
      ['Apple', '🍎', 52],
      ['Cola', '🥤', 42],
      ['Broccoli', '🥦', 34],
      ['Cucumber', '🥒', 15],
    ],
  },
  {
    id: 'year',
    question: 'Which came later?',
    more: 'Later',
    less: 'Earlier',
    years: true,
    units: [unit(1, '')],
    items: [
      ['Gutenberg’s printing press', '📜', 1440],
      ['First steam locomotive', '🚂', 1804],
      ['First photograph', '📷', 1826],
      ['The telephone patent', '☎️', 1876],
      ['The opening of the Eiffel Tower', '🗼', 1889],
      ['First modern Olympic Games', '🏅', 1896],
      ['First powered airplane flight', '🛩️', 1903],
      ['The sinking of the Titanic', '🚢', 1912],
      ['The discovery of penicillin', '💊', 1928],
      ['First FIFA World Cup', '⚽', 1930],
      ['The DNA double helix', '🧬', 1953],
      ['First human in space', '🧑‍🚀', 1961],
      ['First Moon landing', '🌕', 1969],
      ['First email is sent', '📧', 1971],
      ['The fall of the Berlin Wall', '🧱', 1989],
      ['First text message', '💬', 1992],
      ['The first euro coins', '💶', 2002],
    ],
  },
];

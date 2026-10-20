/**
 * Quizbelief în română (se încarcă doar când jocul rulează în română, vezi pack.ts). Listele traduse
 * păstrează ordinea din engleză, așa că quizul zilei și provocările aleg aceleași întrebări în toate
 * limbile; numerele, anii și melodiile vin din listele englezești.
 */
import { EN, type Pack } from '../../pack';
import { ANIMALS } from './animals';
import { BULGARIA } from './bulgaria';
import { EMOJI_SAYINGS, EMOJI_TITLES } from './emoji';
import { FOOD } from './food';
import { GEO } from './geo';
import { GROWTH } from './growth';
import { HISTORY } from './history';
import { ODD_WORDS, worldWords } from './lexicon';
import { MONEY } from './money';
import { MYTHS } from './myths';
import { NUMBER_TEXT } from './numbers';
import { POP } from './pop';
import { SCIENCE } from './science';
import { SPACE } from './space';
import { SPORTS } from './sports';
import { TECH } from './tech';
import { EVENT_TEXT } from './timeline';
import { TUNE_TEXT } from './tunes';
import { TYPED } from './typed';
import { de, UI_RO } from './ui';
import { WORDS } from './words';

export const RO: Pack = {
  lang: 'ro',
  locale: 'ro-RO',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Adevărat', 'Fals'],
    ['Mit', 'Adevăr'],
    ['Da', 'Nu'],
  ],
  odd: ODD_WORDS,
  world: worldWords(EN.world),
  events: EN.events.map((e, i) => [e[0], EVENT_TEXT[i]!, e[2], e[3]] as const),
  numbers: EN.numbers.map((n, i) => ({ ...n, q: NUMBER_TEXT[i]!.q, fact: NUMBER_TEXT[i]!.fact, unit: n.unit === undefined ? undefined : NUMBER_TEXT[i]!.unit })),
  typed: TYPED,
  emojiTitles: EMOJI_TITLES,
  emojiSayings: EMOJI_SAYINGS,
  tunes: EN.tunes.map((t, i) => ({ ...t, name: TUNE_TEXT[i]!.name, fact: TUNE_TEXT[i]!.fact })),
  // Articolele nehotărâte, cu și fără diacritice (răspunsurile se compară fără ele).
  articles: /^\s*(un|o|niște|niste)\s+/,
  text: {
    realWordFact: (word, meaning) => `„${word}” chiar există: ${meaning}.`,
    whatMeans: (word) => `Ce înseamnă „${word}”?`,
    whichMeans: (meaning) => `Care cuvânt înseamnă „${meaning}”?`,
    worldQuestion: (language, word) => `Ce înseamnă „${word}” în ${language}?`,
    worldFact: (word, language, meaning) => `${word} (${language}): ${meaning}. În română n-avem un singur cuvânt pentru asta.`,
    bc: (year) => `${year} î.Hr.`,
    around: (year) => `circa ${year}`,
    closer: (what) => `Ce s-a întâmplat mai aproape în timp de „${what}”?`,
    whichFirst: 'Ce a fost mai întâi?',
    oneYearApart: 'Doar un an diferență!',
    yearsApart: (gap, rough) => `${rough ? 'Cam ' : ''}${gap} ${de(Number(gap.replace(/\D/g, '')))}ani diferență.`,
    inWhatYear: (what) => `În ce an? ${what}.`,
    whichFilm: 'Ce film sau ce carte e asta?',
    whichSaying: 'Ce zicală e asta?',
    whichTune: 'Ascultă. Ce melodie e asta?',
    morseQuestion: 'Ascultă (sau citește punctele și liniile). Ce scrie în codul Morse?',
    morseFact: 'SOS a fost ales ca semnal de primejdie în 1905, pentru că se transmite și se recunoaște foarte ușor.',
    putInOrder: 'Pune-le în ordine: atinge mai întâi ce e mai vechi.',
  },
  ui: UI_RO,
};

export const PACK = RO;

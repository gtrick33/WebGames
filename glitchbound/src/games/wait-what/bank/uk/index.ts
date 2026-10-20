/**
 * Quizbelief in Ukrainian (loaded only when the game plays in Ukrainian, see pack.ts). The translated
 * lists keep the English order, so a daily quiz or challenge picks the same questions in every
 * language; numbers, years and tunes come from the English lists.
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
import { count, plural, UI_UK } from './ui';
import { WORDS } from './words';

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const UK: Pack = {
  lang: 'uk',
  locale: 'uk-UA',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Правда', 'Неправда'],
    ['Міф', 'Факт'],
    ['Так', 'Ні'],
  ],
  odd: ODD_WORDS,
  world: worldWords(EN.world),
  events: EN.events.map((e, i) => [e[0], EVENT_TEXT[i]!, e[2], e[3]] as const),
  numbers: EN.numbers.map((n, i) => ({ ...n, q: NUMBER_TEXT[i]!.q, fact: NUMBER_TEXT[i]!.fact, unit: n.unit === undefined ? undefined : NUMBER_TEXT[i]!.unit })),
  typed: TYPED,
  emojiTitles: EMOJI_TITLES,
  emojiSayings: EMOJI_SAYINGS,
  tunes: EN.tunes.map((t, i) => ({ ...t, name: TUNE_TEXT[i]!.name, fact: TUNE_TEXT[i]!.fact })),
  articles: null,
  text: {
    realWordFact: (word, meaning) => `«${word}» — справжнє слово: ${meaning}.`,
    whatMeans: (word) => `Що означає слово «${word}»?`,
    whichMeans: (meaning) => `Яке справжнє слово означає «${meaning}»?`,
    worldQuestion: (language, word) => `Що ${language} означає «${word}»?`,
    worldFact: (word, language, meaning) => `«${word}» ${language} означає ${meaning}. Українською на це потрібне ціле речення.`,
    bc: (year) => `${year} р. до н. е.`,
    around: (year) => `близько ${year}`,
    closer: (what) => `Що сталося ближче в часі до цієї події: ${capital(what)}?`,
    whichFirst: 'Що було раніше?',
    oneYearApart: 'Різниця лише в один рік!',
    yearsApart: (gap, rough) => `Між ними ${rough ? 'приблизно ' : ''}${gap} ${plural(count(gap), 'рік', 'роки', 'років')}.`,
    inWhatYear: (what) => `У якому році? ${what}.`,
    whichFilm: 'Що це за фільм або книжка?',
    whichSaying: 'Що це за прислів’я?',
    whichTune: 'Послухай. Що це за мелодія?',
    morseQuestion: 'Послухай (або прочитай крапки й тире). Яке слово передано азбукою Морзе?',
    morseFact: 'SOS обрали сигналом лиха 1905 року, бо його дуже легко передати й розпізнати.',
    putInOrder: 'Розстав по порядку: спершу торкнися найдавнішого.',
  },
  ui: UI_UK,
};

export const PACK = UK;

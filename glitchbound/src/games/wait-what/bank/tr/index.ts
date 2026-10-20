/**
 * Quizbelief in Turkish (loaded only when the game plays in Turkish, see pack.ts). The translated lists
 * keep the English order, so a daily quiz or challenge picks the same questions in both languages;
 * numbers, years and tunes come from the English lists.
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
import { UI } from './ui';
import { WORDS } from './words';

export const TR: Pack = {
  lang: 'tr',
  locale: 'tr-TR',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Doğru', 'Yanlış'],
    ['Efsane', 'Gerçek'],
    ['Evet', 'Hayır'],
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
    realWordFact: (word, meaning) => `“${word}” gerçek bir kelime: ${meaning}.`,
    whatMeans: (word) => `“${word}” ne demek?`,
    whichMeans: (meaning) => `Hangi gerçek kelime “${meaning}” anlamına gelir?`,
    worldQuestion: (language, word) => `${language} “${word}” ne demek?`,
    worldFact: (word, language, meaning) => `${word} (${language}): ${meaning}. Koca bir anlamı tek kelimeye sığdırmışlar.`,
    bc: (year) => `MÖ ${year}`,
    around: (year) => `yaklaşık ${year}`,
    // Events are written as noun phrases that already start with a capital (see timeline.ts).
    closer: (what) => `Hangisi zaman olarak şu olaya daha yakın: ${what}?`,
    whichFirst: 'Hangisi daha önce oldu?',
    oneYearApart: 'Aralarında yalnızca bir yıl var!',
    yearsApart: (gap, rough) => `Aralarında ${rough ? 'yaklaşık ' : ''}${gap} yıl var.`,
    inWhatYear: (what) => `Hangi yılda? ${what}.`,
    whichFilm: 'Hangi film ya da kitap bu?',
    whichSaying: 'Hangi atasözü ya da deyim bu?',
    whichTune: 'Dinle. Bu hangi ezgi?',
    morseQuestion: 'Dinle (ya da noktalarla çizgileri oku). Bu mors kodu ne yazıyor?',
    morseFact: 'SOS, 1905’te gönderilmesi ve tanınması çok kolay olduğu için imdat sinyali seçildi.',
    putInOrder: 'Bunları sıraya koy: önce en eskisine dokun.',
  },
  ui: UI,
};

export const PACK = TR;

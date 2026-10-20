/**
 * Quizbelief in Bulgarian (loaded only when the game plays in Bulgarian, see pack.ts). The translated
 * lists keep the English order, so a daily quiz or challenge picks the same questions in both
 * languages; numbers, years and tunes come from the English lists.
 */
import { EN, type Pack } from '../../pack';
import { ANIMALS } from './animals';
import { BULGARIA } from './bulgaria';
import { EMOJI_SAYINGS, EMOJI_TITLES } from './emoji';
import { FOOD } from './food';
import { GEO } from './geo';
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
import { WORDS } from './words';

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const BG: Pack = {
  lang: 'bg',
  locale: 'bg-BG',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
  ],
  fixedOrder: [
    ['Вярно', 'Невярно'],
    ['Мит', 'Факт'],
    ['Да', 'Не'],
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
    realWordFact: (word, meaning) => `„${word}“ е истинска дума: ${meaning}.`,
    whatMeans: (word) => `Какво означава думата „${word}“?`,
    whichMeans: (meaning) => `Коя истинска дума означава „${meaning}“?`,
    worldQuestion: (language, word) => `Какво означава на ${language} „${word}“?`,
    worldFact: (word, language, meaning) => `${word} (${language}): ${meaning}. На български за това трябва цяло изречение.`,
    bc: (year) => `${year} г. пр.н.е.`,
    around: (year) => `около ${year}`,
    closer: (what) => `Кое се е случило по-близо във времето до това: ${capital(what)}?`,
    whichFirst: 'Кое е първо?',
    oneYearApart: 'Само една година разлика!',
    yearsApart: (gap, rough) => `${rough ? 'Около ' : ''}${gap} години разлика.`,
    inWhatYear: (what) => `В коя година? ${what}.`,
    whichFilm: 'Кой филм или книга е това?',
    whichSaying: 'Коя поговорка е това?',
    whichTune: 'Слушай. Коя мелодия е това?',
    morseQuestion: 'Слушай (или прочети точките и тиретата). Какво пише на морзова азбука?',
    morseFact: 'SOS е избран за сигнал за бедствие през 1905 г., защото се предава и разпознава много лесно.',
    putInOrder: 'Подреди ги: докосни най-старото първо.',
  },
};

/**
 * A language's content for Wait, What?: the question lists plus the sentences the deck builds around
 * them. English is built in; other languages load on demand (bank/bg), so English players never
 * download them.
 *
 * Lists that are translations (the hand-written bank, timeline events, lever numbers, tunes and the
 * words of the world) keep the English order and length, so the daily quiz and a friends' challenge
 * pick the same questions in every language. Word play that can't be translated (real words that
 * sound made up, typed answers, emoji puzzles) has its own list per language.
 */
import type { ContentLang } from '../../platform/contentLang';
import { ANIMALS } from './bank/animals';
import { EMOJI_SAYINGS, EMOJI_TITLES, type EmojiQ } from './bank/emoji';
import { FOOD } from './bank/food';
import { GEO } from './bank/geo';
import { HISTORY } from './bank/history';
import { ODD_WORDS, WORLD_WORDS, type ForeignWord, type Word } from './bank/lexicon';
import { MONEY } from './bank/money';
import { MYTHS } from './bank/myths';
import { NUMBERS, type NumberQ } from './bank/numbers';
import { POP } from './bank/pop';
import { SCIENCE } from './bank/science';
import { SPACE } from './bank/space';
import { SPORTS } from './bank/sports';
import { TECH } from './bank/tech';
import { EVENTS, type Event } from './bank/timeline';
import { TUNES, type Tune } from './bank/tunes';
import { TYPED, type Typed } from './bank/typed';
import type { Raw } from './bank/types';
import { WORDS } from './bank/words';

export const LAUNCH = '2026-10-18';

export type HandCat = 'history' | 'animals' | 'science' | 'food' | 'geo' | 'space' | 'tech' | 'pop' | 'sports' | 'words' | 'money' | 'myths';

/** The sentences the deck wraps around generated questions. */
export interface PackText {
  realWordFact: (word: string, meaning: string) => string;
  whatMeans: (word: string) => string;
  whichMeans: (meaning: string) => string;
  worldQuestion: (language: string, word: string) => string;
  worldFact: (word: string, language: string, meaning: string) => string;
  bc: (year: number) => string;
  around: (year: string) => string;
  /** Gets the event as written (each language decides how to fit it into the sentence). */
  closer: (what: string) => string;
  whichFirst: string;
  oneYearApart: string;
  yearsApart: (gap: string, rough: boolean) => string;
  inWhatYear: (what: string) => string;
  whichFilm: string;
  whichSaying: string;
  whichTune: string;
  morseQuestion: string;
  morseFact: string;
  putInOrder: string;
}

export interface Pack {
  lang: ContentLang;
  /** For numbers on the lever ("1,912" / "1 912"). */
  locale: string;
  /** Hand-written questions, in release batches (see deck.ts). */
  batches: { since: string; items: Record<HandCat, Raw[]> }[];
  /** Answer sets shown in this order instead of shuffled ("True / False"). */
  fixedOrder: string[][];
  odd: readonly Word[];
  world: readonly ForeignWord[];
  events: readonly Event[];
  numbers: readonly NumberQ[];
  typed: readonly Typed[];
  emojiTitles: readonly EmojiQ[];
  emojiSayings: readonly EmojiQ[];
  tunes: readonly Tune[];
  /** Words dropped from the start of a typed answer before comparing ("the Moon" = "Moon"). */
  articles: RegExp | null;
  text: PackText;
}

export const EN: Pack = {
  lang: 'en',
  locale: 'en-US',
  batches: [
    {
      since: LAUNCH,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
  ],
  fixedOrder: [
    ['True', 'False'],
    ['Myth', 'Fact'],
    ['Yes', 'No'],
  ],
  odd: ODD_WORDS,
  world: WORLD_WORDS,
  events: EVENTS,
  numbers: NUMBERS,
  typed: TYPED,
  emojiTitles: EMOJI_TITLES,
  emojiSayings: EMOJI_SAYINGS,
  tunes: TUNES,
  articles: /^\s*(the|a|an)\s+/,
  text: {
    realWordFact: (word, meaning) => `“${word}” is a real word: ${meaning}.`,
    whatMeans: (word) => `What does “${word}” mean?`,
    whichMeans: (meaning) => `Which real word means “${meaning}”?`,
    worldQuestion: (language, word) => `In ${language}, what does “${word}” mean?`,
    worldFact: (word, language, meaning) => `${word} (${language}): ${meaning}. English needs a whole sentence for it.`,
    bc: (year) => `${year} BC`,
    around: (year) => `around ${year}`,
    closer: (what) => `Which happened closer in time to this: ${what.charAt(0).toLowerCase()}${what.slice(1)}?`,
    whichFirst: 'Which came first?',
    oneYearApart: 'Just one year apart!',
    yearsApart: (gap, rough) => `${rough ? 'Roughly ' : ''}${gap} years apart.`,
    inWhatYear: (what) => `In what year? ${what}.`,
    whichFilm: 'Which film or book is this?',
    whichSaying: 'Which saying is this?',
    whichTune: 'Listen. Which tune is this?',
    morseQuestion: 'Listen (or read the dots and dashes). What does this Morse code spell?',
    morseFact: 'SOS was picked as a distress signal in 1905 because it is so easy to send and recognize.',
    putInOrder: 'Put these in order: tap the oldest first.',
  },
};

/** The content for a language (English is built in; the rest load on demand). */
export async function loadPack(lang: ContentLang): Promise<Pack> {
  if (lang === 'bg') return (await import('./bank/bg')).BG;
  return EN;
}

/**
 * Quizbelief in Dutch (loaded only when the game plays in Dutch, see pack.ts). The translated
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
import { UI } from './ui';
import { WORDS } from './words';

/** Mid-sentence, only a leading article is lowercased (“de val van de Muur”), never a name (“Edisons gloeilamp”). */
const midSentence = (s: string): string => (/^(De|Het|Een) /.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export const NL: Pack = {
  lang: 'nl',
  locale: 'nl-NL',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Waar', 'Niet waar'],
    ['Mythe', 'Feit'],
    ['Ja', 'Nee'],
  ],
  odd: ODD_WORDS,
  world: worldWords(EN.world),
  events: EN.events.map((e, i) => [e[0], EVENT_TEXT[i]!, e[2], e[3]] as const),
  numbers: EN.numbers.map((n, i) => ({ ...n, q: NUMBER_TEXT[i]!.q, fact: NUMBER_TEXT[i]!.fact, unit: n.unit === undefined ? undefined : NUMBER_TEXT[i]!.unit })),
  typed: TYPED,
  emojiTitles: EMOJI_TITLES,
  emojiSayings: EMOJI_SAYINGS,
  tunes: EN.tunes.map((t, i) => ({ ...t, name: TUNE_TEXT[i]!.name, fact: TUNE_TEXT[i]!.fact })),
  articles: /^\s*(de|het|een|[’']?t)\s+/,
  text: {
    realWordFact: (word, meaning) => `“${word}” is echt een woord: ${meaning}.`,
    whatMeans: (word) => `Wat betekent “${word}”?`,
    whichMeans: (meaning) => `Welk bestaand woord betekent “${meaning}”?`,
    worldQuestion: (language, word) => `Wat betekent “${word}” in het ${language}?`,
    worldFact: (word, language, meaning) => `${word} (${language}): ${meaning}. Dat allemaal in één woord.`,
    bc: (year) => `${year} v.Chr.`,
    around: (year) => `rond ${year}`,
    closer: (what) => `Wat lag in de tijd dichter bij dit: ${midSentence(what)}?`,
    whichFirst: 'Wat kwam eerst?',
    oneYearApart: 'Maar één jaar verschil!',
    yearsApart: (gap, rough) => `${rough ? 'Ongeveer ' : ''}${gap} jaar verschil.`,
    inWhatYear: (what) => `In welk jaar? ${what}.`,
    whichFilm: 'Welke film of welk boek is dit?',
    whichSaying: 'Welk spreekwoord of gezegde is dit?',
    whichTune: 'Luister. Welke melodie is dit?',
    morseQuestion: 'Luister (of lees de punten en strepen). Wat staat hier in morse?',
    morseFact: 'SOS werd in 1905 gekozen als noodsignaal, omdat het zo makkelijk te seinen en te herkennen is.',
    putInOrder: 'Zet ze op volgorde: tik eerst op het oudste.',
  },
  ui: UI,
};

export const PACK = NL;

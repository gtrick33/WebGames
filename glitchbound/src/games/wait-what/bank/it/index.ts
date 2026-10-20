/**
 * Quizbelief in italiano (si carica solo quando il gioco è in italiano, vedi pack.ts). Le liste tradotte
 * seguono l’ordine inglese, così il quiz del giorno e le sfide scelgono le stesse domande in ogni
 * lingua; numeri, anni e melodie vengono dalle liste inglesi.
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
import { UI_IT } from './ui';
import { WORDS } from './words';

/** Gli eventi sono scritti come nomi («La caduta di…»): dentro una frase l’articolo va in minuscolo. */
const lowerArticle = (s: string): string => (/^(Il|Lo|La|I|Gli|Le|Un|Uno|Una) |^(L|Un)’/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export const IT: Pack = {
  lang: 'it',
  locale: 'it-IT',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Vero', 'Falso'],
    ['Mito', 'Realtà'],
    ['Sì', 'No'],
  ],
  odd: ODD_WORDS,
  world: worldWords(EN.world),
  events: EN.events.map((e, i) => [e[0], EVENT_TEXT[i]!, e[2], e[3]] as const),
  numbers: EN.numbers.map((n, i) => ({ ...n, q: NUMBER_TEXT[i]!.q, fact: NUMBER_TEXT[i]!.fact, unit: n.unit === undefined ? undefined : NUMBER_TEXT[i]!.unit })),
  typed: TYPED,
  emojiTitles: EMOJI_TITLES,
  emojiSayings: EMOJI_SAYINGS,
  tunes: EN.tunes.map((t, i) => ({ ...t, name: TUNE_TEXT[i]!.name, fact: TUNE_TEXT[i]!.fact })),
  // Funziona anche dopo che la risposta scritta ha perso l’apostrofo («l’Everest» diventa «l everest»).
  articles: /^\s*(?:(?:il|lo|la|l|i|gli|le|uno|una|un)\s+|(?:l|un)['’]\s*)/i,
  text: {
    realWordFact: (word, meaning) => `«${word}» è una parola vera: ${meaning}.`,
    whatMeans: (word) => `Che cosa significa «${word}»?`,
    whichMeans: (meaning) => `Quale parola vera significa «${meaning}»?`,
    worldQuestion: (language, word) => `In ${language}, che cosa significa «${word}»?`,
    worldFact: (word, language, meaning) => `${word} (${language}): ${meaning}. Tutto questo, in una parola sola.`,
    bc: (year) => `${year} a.C.`,
    around: (year) => `intorno al ${year}`,
    closer: (what) => `Quale evento è più vicino nel tempo a questo: ${lowerArticle(what)}?`,
    whichFirst: 'Che cosa è venuto prima?',
    oneYearApart: 'Solo un anno di distanza!',
    yearsApart: (gap, rough) => `${rough ? 'Circa ' : ''}${gap} anni di distanza.`,
    inWhatYear: (what) => `In che anno? ${what}.`,
    whichFilm: 'Quale film o libro è questo?',
    whichSaying: 'Quale modo di dire è questo?',
    whichTune: 'Ascolta. Che melodia è?',
    morseQuestion: 'Ascolta (o leggi punti e linee). Che cosa dice questo codice Morse?',
    morseFact: 'L’SOS fu scelto come segnale di soccorso nel 1905 perché è facilissimo da trasmettere e da riconoscere.',
    putInOrder: 'Mettili in ordine: tocca prima il più antico.',
  },
  ui: UI_IT,
};

export const PACK = IT;

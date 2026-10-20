/**
 * Quizbelief in Spanish (loaded only when the game plays in Spanish, see pack.ts). The translated
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

/** Only a leading article is lowercased mid-sentence (“la caída del Muro”), never a name (“Yuri Gagarin…”). */
const midSentence = (what: string): string => (/^(El|La|Los|Las|Un|Una)\s/.test(what) ? what.charAt(0).toLowerCase() + what.slice(1) : what);

export const ES: Pack = {
  lang: 'es',
  locale: 'es-ES',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Verdadero', 'Falso'],
    ['Mito', 'Realidad'],
    ['Sí', 'No'],
  ],
  odd: ODD_WORDS,
  world: worldWords(EN.world),
  events: EN.events.map((e, i) => [e[0], EVENT_TEXT[i]!, e[2], e[3]] as const),
  numbers: EN.numbers.map((n, i) => ({ ...n, q: NUMBER_TEXT[i]!.q, fact: NUMBER_TEXT[i]!.fact, unit: n.unit === undefined ? undefined : NUMBER_TEXT[i]!.unit })),
  typed: TYPED,
  emojiTitles: EMOJI_TITLES,
  emojiSayings: EMOJI_SAYINGS,
  tunes: EN.tunes.map((t, i) => ({ ...t, name: TUNE_TEXT[i]!.name, fact: TUNE_TEXT[i]!.fact })),
  articles: /^\s*(el|la|los|las|un|una)\s+/,
  text: {
    realWordFact: (word, meaning) => `«${word}» es una palabra real: ${meaning}.`,
    whatMeans: (word) => `¿Qué significa «${word}»?`,
    whichMeans: (meaning) => `¿Qué palabra real significa «${meaning}»?`,
    worldQuestion: (language, word) => `En ${language}, ¿qué significa «${word}»?`,
    worldFact: (word, language, meaning) => `${word} (${language}): ${meaning}. Una sola palabra que vale por una frase entera.`,
    bc: (year) => `${year} a. C.`,
    around: (year) => `hacia el ${year}`,
    closer: (what) => `¿Qué ocurrió más cerca en el tiempo de esto: ${midSentence(what)}?`,
    whichFirst: '¿Qué ocurrió antes?',
    oneYearApart: '¡Solo un año de diferencia!',
    yearsApart: (gap, rough) => `${rough ? 'Unos ' : ''}${gap} años de diferencia.`,
    inWhatYear: (what) => `¿En qué año? ${what}.`,
    whichFilm: '¿Qué película o libro es?',
    whichSaying: '¿Qué refrán o expresión es?',
    whichTune: 'Escucha. ¿Qué melodía es?',
    morseQuestion: 'Escucha (o lee los puntos y las rayas). ¿Qué dice este código morse?',
    morseFact: 'El SOS se eligió como señal de socorro en 1905 porque es muy fácil de enviar y de reconocer.',
    putInOrder: 'Ordénalos: toca primero el más antiguo.',
  },
  ui: UI,
};

export const PACK = ES;

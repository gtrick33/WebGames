/**
 * Quizbelief auf Deutsch (wird nur geladen, wenn das Spiel auf Deutsch läuft, siehe pack.ts). Die
 * übersetzten Listen behalten die englische Reihenfolge, damit Tagesquiz und Herausforderungen in
 * allen Sprachen dieselben Fragen ziehen; Zahlen, Jahre und Melodien kommen aus den englischen Listen.
 */
import { EN, type Pack } from '../../pack';
import { ANIMALS } from './animals';
import { BULGARIA } from './bulgaria';
import { EMOJI_SAYINGS, EMOJI_TITLES } from './emoji';
import { FOOD } from './food';
import { GEO } from './geo';
import { GROWTH } from './growth';
import { HISTORY } from './history';
import { ODD_WORDS, WORLD_WORDS, worldNote } from './lexicon';
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

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Das Spiel schreibt Wörter am Satzanfang groß; hier bekommen „blümerant“ & Co. ihre echte Schreibung zurück. */
const asListed = (word: string): string => ODD_WORDS.find(([w]) => capital(w) === word)?.[0] ?? word;

/** Ein Artikel am Anfang eines Ereignisses wird mitten im Satz kleingeschrieben („…: die Erfindung des Telefons?“). */
const midSentence = (what: string): string => what.replace(/^(Der|Die|Das|Den|Dem|Des|Ein|Eine|Einer|Eines) /, (a) => a.toLowerCase());

export const DE: Pack = {
  lang: 'de',
  locale: 'de-DE',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Wahr', 'Falsch'],
    ['Mythos', 'Fakt'],
    ['Ja', 'Nein'],
  ],
  odd: ODD_WORDS,
  world: WORLD_WORDS,
  events: EN.events.map((e, i) => [e[0], EVENT_TEXT[i]!, e[2], e[3]] as const),
  numbers: EN.numbers.map((n, i) => ({ ...n, q: NUMBER_TEXT[i]!.q, fact: NUMBER_TEXT[i]!.fact, unit: n.unit === undefined ? undefined : NUMBER_TEXT[i]!.unit })),
  typed: TYPED,
  emojiTitles: EMOJI_TITLES,
  emojiSayings: EMOJI_SAYINGS,
  tunes: EN.tunes.map((t, i) => ({ ...t, name: TUNE_TEXT[i]!.name, fact: TUNE_TEXT[i]!.fact })),
  articles: /^\s*(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\s+/,
  text: {
    realWordFact: (word, meaning) => `„${asListed(word)}“ ist ein echtes Wort: ${meaning}.`,
    whatMeans: (word) => `Was bedeutet „${word}“?`,
    whichMeans: (meaning) => `Welches echte Wort bedeutet „${meaning}“?`,
    worldQuestion: (language, word) => `Was bedeutet „${word}“ auf ${language}?`,
    worldFact: (word, language, meaning) => `${word} (${language}): ${meaning}. ${worldNote(word)}`,
    bc: (year) => `${year} v. Chr.`,
    around: (year) => `um ${year}`,
    closer: (what) => `Was liegt zeitlich näher an diesem Ereignis: ${midSentence(what)}?`,
    whichFirst: 'Was war zuerst?',
    oneYearApart: 'Nur ein Jahr Abstand!',
    yearsApart: (gap, rough) => `${rough ? 'Rund ' : ''}${gap} Jahre liegen dazwischen.`,
    inWhatYear: (what) => `In welchem Jahr? ${what}.`,
    whichFilm: 'Welcher Film, welches Buch ist das?',
    whichSaying: 'Welche Redensart ist das?',
    whichTune: 'Hör genau hin. Welche Melodie ist das?',
    morseQuestion: 'Hör zu (oder lies die Punkte und Striche). Was steht da im Morsecode?',
    morseFact: 'SOS wurde 1905 zuerst in Deutschland als Notsignal eingeführt, weil es so leicht zu senden und zu erkennen ist.',
    putInOrder: 'Bring sie in die richtige Reihenfolge: Tipp das Älteste zuerst an.',
  },
  ui: UI,
};

export const PACK = DE;

// TEMP: typed answers and emoji puzzles still fall back to English (EN spread below) until pl/typed.ts and pl/emoji.ts exist.
import { EN, type Pack } from '../../pack';
import { ANIMALS } from './animals';
import { BULGARIA } from './bulgaria';
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
import { plural, UI_PL } from './ui';
import { WORDS } from './words';

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const PL: Pack = {
  ...EN,
  lang: 'pl',
  locale: 'pl-PL',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Prawda', 'Fałsz'],
    ['Mit', 'Fakt'],
    ['Tak', 'Nie'],
  ],
  odd: ODD_WORDS,
  world: worldWords(EN.world),
  events: EN.events.map((e, i) => [e[0], EVENT_TEXT[i]!, e[2], e[3]] as const),
  numbers: EN.numbers.map((n, i) => ({ ...n, q: NUMBER_TEXT[i]!.q, fact: NUMBER_TEXT[i]!.fact, unit: n.unit === undefined ? undefined : NUMBER_TEXT[i]!.unit })),
  tunes: EN.tunes.map((t, i) => ({ ...t, name: TUNE_TEXT[i]!.name, fact: TUNE_TEXT[i]!.fact })),
  articles: null,
  text: {
    realWordFact: (word, meaning) => `„${word}” to prawdziwe słowo: ${meaning}.`,
    whatMeans: (word) => `Co znaczy słowo „${word}”?`,
    whichMeans: (meaning) => `Które prawdziwe słowo znaczy „${meaning}”?`,
    worldQuestion: (language, word) => `Co znaczy ${language} słowo „${word}”?`,
    // Gruzińskie „Zeg” (pojutrze) akurat ma polski odpowiednik w jednym słowie.
    worldFact: (word, language, meaning) => `${capital(language)} „${word}” to ${meaning}. ${meaning === 'pojutrze' ? 'To akurat mamy i my!' : 'Po polsku trzeba na to całego zdania.'}`,
    bc: (year) => `${year} p.n.e.`,
    around: (year) => `około ${year}`,
    closer: (what) => `Co jest bliżej w czasie tego wydarzenia: ${capital(what)}?`,
    whichFirst: 'Co było pierwsze?',
    oneYearApart: 'Dzieli je tylko rok!',
    yearsApart: (gap, rough) => {
      const n = Number(gap.replace(/\D/g, ''));
      return `${rough ? 'Około ' : ''}${gap} ${plural(n, 'rok', 'lata', 'lat')} różnicy.`;
    },
    inWhatYear: (what) => `W którym roku? ${what}.`,
    whichFilm: 'Jaki to film albo książka?',
    whichSaying: 'Jakie to powiedzenie?',
    whichTune: 'Posłuchaj. Jaka to melodia?',
    morseQuestion: 'Posłuchaj (albo odczytaj kropki i kreski). Jakie słowo zapisano alfabetem Morse’a?',
    morseFact: 'SOS wybrano na sygnał alarmowy w 1905 roku, bo bardzo łatwo go nadać i rozpoznać.',
    putInOrder: 'Ułóż po kolei: stuknij najpierw najstarsze.',
  },
  ui: UI_PL,
};

export const PACK = PL;

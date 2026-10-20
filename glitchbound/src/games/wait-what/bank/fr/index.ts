/**
 * Quizbelief en français (chargé seulement quand le jeu se joue en français, voir pack.ts). Les listes
 * traduites gardent l’ordre anglais, pour qu’un quiz du jour ou un défi choisisse les mêmes questions
 * dans toutes les langues ; les nombres, les années et les airs viennent des listes anglaises.
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
import { UI_FR } from './ui';
import { WORDS } from './words';

/** Met la première lettre en minuscule quand l’événement commence par un article (« la chute de… »), jamais par un nom propre. */
const inSentence = (what: string): string => (/^(?:(?:Le|La|Les|Un|Une|Des|Du)\s|L’)/.test(what) ? what.charAt(0).toLowerCase() + what.slice(1) : what);

export const FR: Pack = {
  lang: 'fr',
  locale: 'fr-FR',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Vrai', 'Faux'],
    ['Mythe', 'Réalité'],
    ['Oui', 'Non'],
  ],
  odd: ODD_WORDS,
  world: worldWords(EN.world),
  events: EN.events.map((e, i) => [e[0], EVENT_TEXT[i]!, e[2], e[3]] as const),
  numbers: EN.numbers.map((n, i) => ({ ...n, q: NUMBER_TEXT[i]!.q, fact: NUMBER_TEXT[i]!.fact, unit: n.unit === undefined ? undefined : NUMBER_TEXT[i]!.unit })),
  typed: TYPED,
  emojiTitles: EMOJI_TITLES,
  emojiSayings: EMOJI_SAYINGS,
  tunes: EN.tunes.map((t, i) => ({ ...t, name: TUNE_TEXT[i]!.name, fact: TUNE_TEXT[i]!.fact })),
  articles: /^\s*(?:(?:le|la|les|un|une|des)\s+|l(?:[’']\s*|\s+))/i,
  text: {
    realWordFact: (word, meaning) => `« ${word} » est un vrai mot : ${meaning}.`,
    whatMeans: (word) => `Que veut dire « ${word} » ?`,
    whichMeans: (meaning) => `Quel vrai mot veut dire « ${meaning} » ?`,
    worldQuestion: (language, word) => `En ${language}, que veut dire « ${word} » ?`,
    worldFact: (word, language, meaning) => `${word} (${language}) : ${meaning}. Le français n’a pas de mot pour ça.`,
    bc: (year) => `${year} av. J.-C.`,
    around: (year) => `vers ${year}`,
    closer: (what) => `Qu’est-ce qui s’est passé le plus près dans le temps de cet événement : ${inSentence(what)} ?`,
    whichFirst: 'Qu’est-ce qui est arrivé en premier ?',
    oneYearApart: 'Une seule année d’écart !',
    yearsApart: (gap, rough) => `${rough ? 'Environ ' : ''}${gap} ans d’écart.`,
    inWhatYear: (what) => `En quelle année ? ${what}.`,
    whichFilm: 'Quel film ou quel livre se cache ici ?',
    whichSaying: 'Quelle expression se cache ici ?',
    whichTune: 'Écoute. Quel est cet air ?',
    morseQuestion: 'Écoute (ou lis les points et les traits). Que dit ce message en morse ?',
    morseFact: 'SOS a été choisi comme signal de détresse en 1905, parce qu’il est très facile à envoyer et à reconnaître.',
    putInOrder: 'Remets-les dans l’ordre : touche d’abord le plus ancien.',
  },
  ui: UI_FR,
};

export const PACK = FR;

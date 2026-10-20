/**
 * Quizbelief em português de Portugal (só carrega quando o jogo é jogado em português, ver pack.ts).
 * As listas traduzidas seguem a ordem inglesa, para o quiz diário e os desafios escolherem as mesmas
 * perguntas em todas as línguas; números, anos e melodias vêm das listas inglesas.
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
import { UI_PT } from './ui';
import { WORDS } from './words';

/** “de” + acontecimento, com o artigo contraído (“do assassinato…”, “da queda…”). */
const de = (what: string): string => {
  const m = /^(O|A|Os|As|Um|Uma) (.*)$/.exec(what);
  if (!m) return `de ${what}`;
  const joined: Record<string, string> = { O: 'do', A: 'da', Os: 'dos', As: 'das', Um: 'de um', Uma: 'de uma' };
  return `${joined[m[1]!]} ${m[2]}`;
};

export const PT: Pack = {
  lang: 'pt',
  locale: 'pt-PT',
  batches: [
    {
      since: EN.batches[0]!.since,
      items: { history: HISTORY, animals: ANIMALS, science: SCIENCE, food: FOOD, geo: GEO, space: SPACE, tech: TECH, pop: POP, sports: SPORTS, words: WORDS, money: MONEY, myths: MYTHS },
    },
    { since: EN.batches[1]!.since, items: BULGARIA },
    { since: EN.batches[2]!.since, items: GROWTH },
  ],
  fixedOrder: [
    ['Verdadeiro', 'Falso'],
    ['Mito', 'Facto'],
    ['Sim', 'Não'],
  ],
  odd: ODD_WORDS,
  world: worldWords(EN.world),
  events: EN.events.map((e, i) => [e[0], EVENT_TEXT[i]!, e[2], e[3]] as const),
  numbers: EN.numbers.map((n, i) => ({ ...n, q: NUMBER_TEXT[i]!.q, fact: NUMBER_TEXT[i]!.fact, unit: n.unit === undefined ? undefined : NUMBER_TEXT[i]!.unit })),
  typed: TYPED,
  emojiTitles: EMOJI_TITLES,
  emojiSayings: EMOJI_SAYINGS,
  tunes: EN.tunes.map((t, i) => ({ ...t, name: TUNE_TEXT[i]!.name, fact: TUNE_TEXT[i]!.fact })),
  articles: /^\s*(o|a|os|as|um|uma)\s+/,
  text: {
    realWordFact: (word, meaning) => `“${word}” é uma palavra a sério: ${meaning}.`,
    whatMeans: (word) => `O que quer dizer “${word}”?`,
    whichMeans: (meaning) => `Que palavra verdadeira quer dizer “${meaning}”?`,
    worldQuestion: (language, word) => `Em ${language}, o que quer dizer “${word}”?`,
    worldFact: (word, language, meaning) => `${word} (${language}): ${meaning}. Uma só palavra para uma ideia inteira.`,
    bc: (year) => `${year} a.C.`,
    around: (year) => `por volta de ${year}`,
    closer: (what) => `O que aconteceu mais perto, no tempo, ${de(what)}?`,
    whichFirst: 'O que veio primeiro?',
    oneYearApart: 'Só um ano de diferença!',
    yearsApart: (gap, rough) => `${rough ? 'Cerca de ' : ''}${gap} anos de diferença.`,
    inWhatYear: (what) => `Em que ano? ${what}.`,
    whichFilm: 'Que filme ou livro é este?',
    whichSaying: 'Que ditado é este?',
    whichTune: 'Ouve. Que música é esta?',
    morseQuestion: 'Ouve (ou lê os pontos e os traços). O que diz este código Morse?',
    morseFact: 'O SOS foi escolhido como sinal de socorro em 1905 por ser tão fácil de enviar e de reconhecer.',
    putInOrder: 'Põe por ordem: toca primeiro no mais antigo.',
  },
  ui: UI_PT,
};

export const PACK = PT;

/**
 * Fussbox's words in English and Bulgarian: the rule explained after the exam, and the game's own
 * text. The cards themselves have no words.
 */
import type { ContentLang } from '../../platform/contentLang';
import type { Attr, Rule } from './logic';

interface Lang {
  values: Record<Attr, [string, string, string]>;
  not: (s: string) => string;
  and: string;
  or: string;
  xor: (a: string, b: string) => string;
  atLeast: (n: number) => string;
  odd: string;
}

const LANG: Record<ContentLang, Lang> = {
  en: {
    values: {
      count: ['one symbol', 'two symbols', 'three symbols'],
      shape: ['circles', 'triangles', 'squares'],
      colour: ['pink', 'blue', 'yellow'],
      fill: ['solid', 'striped', 'hollow'],
    },
    not: (s) => `not ${s}`,
    and: 'and',
    or: 'or',
    xor: (a, b) => `${a} or ${b}, but not both`,
    atLeast: (n) => `at least ${n} corners in total`,
    odd: 'an odd number of corners in total',
  },
  bg: {
    values: {
      count: ['един символ', 'два символа', 'три символа'],
      shape: ['кръгове', 'триъгълници', 'квадрати'],
      colour: ['розово', 'синьо', 'жълто'],
      fill: ['плътно', 'на райета', 'празно (само контур)'],
    },
    not: (s) => `не ${s}`,
    and: 'и',
    or: 'или',
    xor: (a, b) => `${a} или ${b}, но не и двете`,
    atLeast: (n) => `поне ${n} ъгъла общо`,
    odd: 'нечетен брой ъгли общо',
  },
};

/** The rule in plain words, e.g. "pink and not striped". */
export function describe(rule: Rule, lang: ContentLang): string {
  const L = LANG[lang];
  const go = (x: Rule, top: boolean): string => {
    switch (x.t) {
      case 'is':
        return L.values[x.a][x.v]!;
      case 'not':
        return L.not(go(x.r, false));
      case 'and':
      case 'or': {
        const s = `${go(x.l, false)} ${x.t === 'and' ? L.and : L.or} ${go(x.r, false)}`;
        return top ? s : `(${s})`;
      }
      case 'xor':
        return L.xor(go(x.l, false), go(x.r, false));
      case 'corners':
        return x.op === 'odd' ? L.odd : L.atLeast(x.n);
    }
  };
  return go(rule, true);
}

/** Names of the attribute values (for screen readers and the pickers). */
export const valueName = (a: Attr, v: number, lang: ContentLang): string => LANG[lang].values[a][v]!;

export interface Ui {
  tag: string;
  daily: (n: number) => string;
  level: (n: number) => string;
  levels: [string, string, string, string];
  sameForEveryone: string;
  oneTry: string;
  playDaily: string;
  continueDaily: string;
  dailyDone: (correct: number, tests: number) => string;
  practice: string;
  practiceBlurb: string;
  play: string;
  totals: (rounds: number, best: number) => string;
  likes: string;
  hates: string;
  example: string;
  build: string;
  count: string;
  shape: string;
  colour: string;
  fill: string;
  feed: string;
  random: string;
  tests: (n: number) => string;
  tired: string;
  ready: string;
  examTitle: string;
  examHint: string;
  yes: string;
  no: string;
  submit: string;
  markAll: (left: number) => string;
  ruleWas: string;
  outOf: (n: number) => string;
  newBest: string;
  share: string;
  copied: string;
  again: string;
  menu: string;
  scoreboard: string;
  paused: string;
  ding: string;
  bzzt: string;
  thinking: string;
  hello: string;
  challengeRound: (n: number) => string;
  nextDaily: string;
  howTo: string;
  soundOn: string;
  soundOff: string;
}

const UI_EN: Ui = {
  tag: 'Every day it has a secret rule. Feed it cards, crack its taste.',
  daily: (n) => `Daily #${n}`,
  level: (n) => `Fussiness ${'★'.repeat(n)}${'☆'.repeat(4 - n)}`,
  levels: ['Easy', 'Medium', 'Hard', 'Fiendish'],
  sameForEveryone: 'Same rule for everyone · one try',
  oneTry: 'one try',
  playDaily: 'Play today’s Fussbox',
  continueDaily: 'Carry on',
  dailyDone: (correct, tests) => `Today: ${correct}/8 · ${tests} tests`,
  practice: 'Practice',
  practiceBlurb: 'A new secret rule every time',
  play: 'Play',
  totals: (rounds, best) => `${rounds} ${rounds === 1 ? 'round' : 'rounds'} played · best ${best}`,
  likes: 'Likes',
  hates: 'Hates',
  example: 'example',
  build: 'Build a card',
  count: 'How many',
  shape: 'Shape',
  colour: 'Colour',
  fill: 'Fill',
  feed: 'Feed it',
  random: 'Random card',
  tests: (n) => `${n} ${n === 1 ? 'test' : 'tests'}`,
  tired: 'That’s enough cards for today.',
  ready: 'I’ve cracked it: take the exam',
  examTitle: 'The exam',
  examHint: 'Does it like each card? Tap ✓ or ✗.',
  yes: 'Likes it',
  no: 'Hates it',
  submit: 'Hand it in',
  markAll: (left) => `${left} still to mark`,
  ruleWas: 'The rule was:',
  outOf: (n) => `${n} of 8 right`,
  newBest: 'New best!',
  share: 'Share',
  copied: 'Copied!',
  again: 'New rule',
  menu: 'Menu',
  scoreboard: 'See the scoreboard',
  paused: 'Paused · tap to carry on',
  ding: 'Ding! It likes it.',
  bzzt: 'Bzzt! It hates it.',
  thinking: 'Feed me a card…',
  hello: 'Hm. Show me what you’ve got.',
  challengeRound: (n) => `⚔️ Challenge · round ${n}`,
  nextDaily: 'Next Fussbox in',
  howTo: 'How to play',
  soundOn: 'Turn sound on',
  soundOff: 'Turn sound off',
};

const UI_BG: Ui = {
  tag: 'Всеки ден има тайно правило. Храни го с карти и разгадай вкуса му.',
  daily: (n) => `Дневен #${n}`,
  level: (n) => `Капризност ${'★'.repeat(n)}${'☆'.repeat(4 - n)}`,
  levels: ['Лесно', 'Средно', 'Трудно', 'Зверско'],
  sameForEveryone: 'Едно правило за всички · един опит',
  oneTry: 'един опит',
  playDaily: 'Играй днешния Fussbox',
  continueDaily: 'Продължи',
  dailyDone: (correct, tests) => `Днес: ${correct}/8 · ${tests} теста`,
  practice: 'Тренировка',
  practiceBlurb: 'Ново тайно правило всеки път',
  play: 'Играй',
  totals: (rounds, best) => `${rounds} ${rounds === 1 ? 'изигран рунд' : 'изиграни рунда'} · рекорд ${best}`,
  likes: 'Харесва',
  hates: 'Мрази',
  example: 'пример',
  build: 'Направи карта',
  count: 'Колко',
  shape: 'Форма',
  colour: 'Цвят',
  fill: 'Запълване',
  feed: 'Дай му я',
  random: 'Случайна карта',
  tests: (n) => `${n} ${n === 1 ? 'тест' : 'теста'}`,
  tired: 'Стига толкова карти за днес.',
  ready: 'Разгадах го: към изпита',
  examTitle: 'Изпитът',
  examHint: 'Харесва ли всяка карта? Докосни ✓ или ✗.',
  yes: 'Харесва я',
  no: 'Мрази я',
  submit: 'Предай',
  markAll: (left) => `Остават ${left}`,
  ruleWas: 'Правилото беше:',
  outOf: (n) => `${n} от 8 верни`,
  newBest: 'Нов рекорд!',
  share: 'Сподели',
  copied: 'Копирано!',
  again: 'Ново правило',
  menu: 'Меню',
  scoreboard: 'Виж класирането',
  paused: 'Пауза · докосни, за да продължиш',
  ding: 'Дзън! Харесва я.',
  bzzt: 'Бзззт! Мрази я.',
  thinking: 'Дай ми карта…',
  hello: 'Хм. Покажи какво имаш.',
  challengeRound: (n) => `⚔️ Предизвикателство · рунд ${n}`,
  nextDaily: 'Следващ Fussbox след',
  howTo: 'Как се играе',
  soundOn: 'Включи звука',
  soundOff: 'Изключи звука',
};

export const UI: Record<ContentLang, Ui> = { en: UI_EN, bg: UI_BG };

/** Whatsit's own text in English and Bulgarian (the things and questions are in the bank). */
import type { BasicLang } from '../../platform/contentLang';

export interface Ui {
  tag: string;
  daily: (n: number) => string;
  todaysTheme: string;
  sameForEveryone: string;
  playDaily: string;
  carryOn: string;
  dailyDone: (solved: boolean, questions: number) => string;
  practice: string;
  practiceBlurb: string;
  anyTheme: string;
  totals: (rounds: number, solved: number, best: number) => string;
  questions: (n: number) => string;
  theme: string;
  hello: string;
  yep: string;
  nope: string;
  yes: string;
  no: string;
  askHint: string;
  ready: string;
  readyTitle: string;
  readyBody: string;
  readyGo: string;
  keepAsking: string;
  lineupTitle: string;
  lineupHint: string;
  yourClues: string;
  noClues: string;
  left: (n: number) => string;
  crossOut: string;
  bringBack: string;
  pickThis: string;
  close: string;
  solved: string;
  missed: string;
  itWas: string;
  youPicked: (name: string) => string;
  fitsClues: string;
  outOf: (questions: number) => string;
  newBest: string;
  share: string;
  copied: string;
  again: string;
  menu: string;
  scoreboard: string;
  nextDaily: string;
  challengeRound: (n: number) => string;
  paused: string;
  resume: string;
  howTo: string;
  soundOn: string;
  soundOff: string;
  mainMenu: string;
  unfinished: string;
}

const UI_EN: Ui = {
  tag: 'A secret thing. Yes/no questions. One pick.',
  daily: (n) => `Daily #${n}`,
  todaysTheme: 'Today’s theme',
  sameForEveryone: 'Same Whatsit for everyone · one try',
  playDaily: 'Play today’s Whatsit',
  carryOn: 'Carry on',
  dailyDone: (solved, q) => (solved ? `Today: solved in ${q} ${q === 1 ? 'question' : 'questions'}` : 'Today: missed it'),
  practice: 'Practice',
  practiceBlurb: 'Pick a theme',
  anyTheme: 'Any theme',
  totals: (rounds, solved, best) => `${solved} of ${rounds} solved · best ${best}`,
  questions: (n) => `${n} ${n === 1 ? 'question' : 'questions'}`,
  theme: 'Theme',
  hello: 'I’m thinking of something… Ask away!',
  yep: 'Yep!',
  nope: 'Nope!',
  yes: 'Yes',
  no: 'No',
  askHint: 'Each question after the first three costs a few points.',
  ready: 'I know it: show the line-up',
  readyTitle: 'Ready for the line-up?',
  readyBody: 'You’ll see 12 things from the theme and get one pick. No more questions after this!',
  readyGo: 'Show me',
  keepAsking: 'Keep asking',
  lineupTitle: 'The line-up',
  lineupHint: 'Tap a card to read it, cross it out, or pick it.',
  yourClues: 'Your answers',
  noClues: 'No questions asked: a lucky guess, then!',
  left: (n) => `${n} left`,
  crossOut: 'Cross it out',
  bringBack: 'Bring it back',
  pickThis: 'This is my Whatsit!',
  close: 'Close',
  solved: 'Got it!',
  missed: 'Not this time',
  itWas: 'It was',
  youPicked: (name) => `You picked ${name}.`,
  fitsClues: 'fits your answers',
  outOf: (q) => `${q} ${q === 1 ? 'question' : 'questions'}`,
  newBest: 'New best!',
  share: 'Share',
  copied: 'Copied!',
  again: 'Another one',
  menu: 'Menu',
  scoreboard: 'See the scoreboard',
  nextDaily: 'Next Whatsit in',
  challengeRound: (n) => `⚔️ Challenge · round ${n}`,
  paused: 'Paused',
  resume: 'Resume',
  howTo: 'How to play',
  soundOn: 'Turn sound on',
  soundOff: 'Turn sound off',
  mainMenu: 'Main menu',
  unfinished: 'Unfinished round',
};

const UI_BG: Ui = {
  tag: 'Тайно нещо. Въпроси с да или не. Един избор.',
  daily: (n) => `Дневен #${n}`,
  todaysTheme: 'Днешната тема',
  sameForEveryone: 'Една и съща загадка за всички · един опит',
  playDaily: 'Играй днешния Whatsit',
  carryOn: 'Продължи',
  dailyDone: (solved, q) => (solved ? `Днес: познато с ${q} ${q === 1 ? 'въпрос' : 'въпроса'}` : 'Днес: не позна'),
  practice: 'Тренировка',
  practiceBlurb: 'Избери тема',
  anyTheme: 'Всяка тема',
  totals: (rounds, solved, best) => `${solved} от ${rounds} познати · рекорд ${best}`,
  questions: (n) => `${n} ${n === 1 ? 'въпрос' : 'въпроса'}`,
  theme: 'Тема',
  hello: 'Намислих нещо… Питай!',
  yep: 'Да!',
  nope: 'Не!',
  yes: 'Да',
  no: 'Не',
  askHint: 'Всеки въпрос след първите три струва няколко точки.',
  ready: 'Знам го: покажи редицата',
  readyTitle: 'Готов ли си за редицата?',
  readyBody: 'Ще видиш 12 неща от темата и имаш един избор. След това няма повече въпроси!',
  readyGo: 'Покажи ми',
  keepAsking: 'Още въпроси',
  lineupTitle: 'Редицата',
  lineupHint: 'Докосни карта, за да я прочетеш, задраскаш или избереш.',
  yourClues: 'Твоите отговори',
  noClues: 'Без въпроси: значи на късмет!',
  left: (n) => `Остават ${n}`,
  crossOut: 'Задраскай',
  bringBack: 'Върни я',
  pickThis: 'Това е моят Whatsit!',
  close: 'Затвори',
  solved: 'Позна!',
  missed: 'Не този път',
  itWas: 'Беше',
  youPicked: (name) => `Ти избра: ${name}.`,
  fitsClues: 'пасва на отговорите',
  outOf: (q) => `${q} ${q === 1 ? 'въпрос' : 'въпроса'}`,
  newBest: 'Нов рекорд!',
  share: 'Сподели',
  copied: 'Копирано!',
  again: 'Още една',
  menu: 'Меню',
  scoreboard: 'Виж класирането',
  nextDaily: 'Следващ Whatsit след',
  challengeRound: (n) => `⚔️ Предизвикателство · рунд ${n}`,
  paused: 'Пауза',
  resume: 'Продължи',
  howTo: 'Как се играе',
  soundOn: 'Включи звука',
  soundOff: 'Изключи звука',
  mainMenu: 'Главно меню',
  unfinished: 'Недовършен рунд',
};

export const UI: Record<BasicLang, Ui> = { en: UI_EN, bg: UI_BG };

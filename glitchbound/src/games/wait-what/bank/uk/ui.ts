import type { Ui } from '../../ui';

/** Українська форма слова після числа: 1 рік, 2 роки, 5 років (а також 21 рік, 12 років). */
export const plural = (n: number, one: string, few: string, many: string): string => {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
};

/** Число з уже відформатованого рядка („1 250“ → 1250), щоб узгодити з ним слово. */
export const count = (s: string): number => Number(s.replace(/\D/g, ''));

const points = (s: string): string => `${s} ${plural(count(s), 'очко', 'очки', 'очок')}`;

/** Текст гри на екрані українською. */
export const UI_UK: Ui = {
  tag: 'Факти, що звучать як вигадка, але є правдою.',
  dailyQuiz: (n) => `Вікторина дня №${n}`,
  dailyShort: (n) => `Вікторина дня №${n}`,
  pointsRight: (pts, right, of) => `${points(pts)} · ${right}/${of} правильно`,
  inProgress: (done, of) => `Розпочато · ${done}/${of}`,
  sameForEveryone: '10 питань · сьогодні однакові для всіх',
  seeResults: 'Переглянути сьогоднішні результати',
  results: 'Переглянути результати',
  continue: 'Продовжити',
  playToday: 'Зіграти сьогоднішню вікторину',
  endless: 'Нескінченна гра',
  endlessBlurb: 'Три помилки — і ти вибуваєш · без повторів',
  startEndless: 'Почати нескінченну гру',
  answeredRight: (right, answered, best) => `Правильно: ${right} з ${answered} · найкраща серія: ${best} · `,
  seenOf: (seen, total) => `${seen} з ${total}+ питань уже бачено`,
  help: 'Обери відповідь, смикни важіль, щоб угадати число, напиши відповідь сам, розстав події по порядку, розгадай емодзі або впізнай мелодію. Правильна відповідь дає 100 очок і ще до 50 за швидкість; майже правильна теж приносить очки. Клавіші: 1–4 або A–D, щоб відповісти, стрілки для важеля, Enter — наступне питання.',
  round: (n) => `⚔️ Раунд ${n}`,
  livesLeft: (n) => `Залишилося ${n} ${plural(n, 'життя', 'життя', 'життів')}`,
  questionOf: (i, n) => `Питання ${i} з ${n}`,
  secondsLeft: (s) => `${s} с`,
  emojiPuzzle: 'Емодзі-загадка',
  correct: (n) => `Правильно! +${n}`,
  close: (n) => `Майже! +${n}`,
  timeUp: 'Час вийшов!',
  nope: 'Мимо!',
  offBy: (what) => ` Похибка: ${what}`,
  answer: 'Відповідь:',
  factPrefix: 'Чекай, що? ',
  nextQuestion: 'Наступне питання',
  endRun: 'Завершити гру',
  paused: 'Пауза',
  pausedHint: 'Торкнися, щоб продовжити. Годинник зупинено.',
  verdictEndless: ['Жива енциклопедія', 'Серйозно вражає', 'Зовсім непогано', 'Факти дали відсіч'],
  verdictDaily: ['Геній. Аж підозріло.', 'Мозок на повну потужність', 'Гідно', 'Чекай, що?', 'Сьогодні перемогли факти'],
  shareLine: (right, of, pts) => `${right}/${of} правильно · ${points(pts)}`,
  challengeRound: (n) => `Виклик · раунд ${n}`,
  endlessRun: 'Нескінченна гра',
  points: ' оч.',
  rightBefore: (n, strikes) => `${n} ${plural(n, 'правильна відповідь', 'правильні відповіді', 'правильних відповідей')} до ${strikes} помилок`,
  rightOutOf: (n, of) => `${n} з ${of} правильно`,
  seeScoreboard: 'Переглянути таблицю лідерів',
  playAgain: 'Зіграти ще раз',
  shareResult: 'Поділитися результатом',
  copied: 'Скопійовано!',
  menu: 'Меню',
  hideAnswers: 'Сховати відповіді',
  showAnswers: 'Показати всі відповіді',
  noAnswer: 'Без відповіді',
  youSaid: (what) => `Твоя відповідь: ${what}`,
  years: (n) => `${n} ${plural(n, 'рік', 'роки', 'років')}`,
  playing: 'Грає…',
  playAgainSound: 'Послухати ще раз',
  playSound: 'Послухати',
  less: 'Менше',
  more: 'Більше',
  yourGuess: 'Твоє припущення',
  lockIn: '🔒 Зафіксувати',
  typeHere: 'Напиши відповідь…',
  yourAnswer: 'Твоя відповідь',
  spelling: 'Писати бездоганно не обов’язково.',
  you: (n) => `ти: ${n}`,
  tapMore: (n) => `Торкнися ще ${n}`,
  cats: {
    history: 'Дивна історія',
    animals: 'Тварини',
    science: 'Наука й тіло',
    food: 'Їжа й напої',
    geo: 'Географія',
    space: 'Космос',
    tech: 'Винаходи',
    pop: 'Поп-культура',
    sports: 'Спорт та ігри',
    words: 'Слова',
    money: 'Гроші',
    myths: 'Міф чи факт?',
    odd: 'Справжнє слово?!',
    world: 'Слова світу',
    time: 'Хронологія',
    guess: 'Смикни важіль',
    type: 'Напиши сам',
    emoji: 'Емодзі-загадка',
    tune: 'Вгадай мелодію',
    morse: 'Азбука Морзе',
  },
};

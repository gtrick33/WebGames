/** Wait, What?'s own on-screen text in each language it plays in (questions live in the packs). */
import type { ContentLang } from '../../platform/contentLang';
import type { CatId } from './deck';

export interface Ui {
  tag: string;
  dailyQuiz: (n: number) => string;
  dailyShort: (n: number) => string;
  pointsRight: (points: string, right: number, of: number) => string;
  inProgress: (done: number, of: number) => string;
  sameForEveryone: string;
  seeResults: string;
  results: string;
  continue: string;
  playToday: string;
  endless: string;
  endlessBlurb: string;
  startEndless: string;
  answeredRight: (right: string, answered: string, best: number) => string;
  seenOf: (seen: string, total: string) => string;
  help: string;
  round: (n: number) => string;
  livesLeft: (n: number) => string;
  questionOf: (i: number, n: number) => string;
  secondsLeft: (s: number) => string;
  emojiPuzzle: string;
  correct: (n: number) => string;
  close: (n: number) => string;
  timeUp: string;
  nope: string;
  offBy: (what: string) => string;
  answer: string;
  factPrefix: string;
  nextQuestion: string;
  endRun: string;
  paused: string;
  pausedHint: string;
  verdictEndless: [string, string, string, string];
  verdictDaily: [string, string, string, string, string];
  shareLine: (right: number, of: number, points: string) => string;
  challengeRound: (n: number) => string;
  endlessRun: string;
  points: string;
  rightBefore: (n: number, strikes: number) => string;
  rightOutOf: (n: number, of: number) => string;
  seeScoreboard: string;
  playAgain: string;
  shareResult: string;
  copied: string;
  menu: string;
  hideAnswers: string;
  showAnswers: string;
  noAnswer: string;
  youSaid: (what: string) => string;
  years: (n: number) => string;
  playing: string;
  playAgainSound: string;
  playSound: string;
  less: string;
  more: string;
  yourGuess: string;
  lockIn: string;
  typeHere: string;
  yourAnswer: string;
  spelling: string;
  you: (n: number) => string;
  tapMore: (n: number) => string;
  cats: Record<CatId, string>;
}

const EN: Ui = {
  tag: 'Trivia that sounds made up but isn’t.',
  dailyQuiz: (n) => `Daily quiz #${n}`,
  dailyShort: (n) => `Daily #${n}`,
  pointsRight: (points, right, of) => `${points} points · ${right}/${of} right`,
  inProgress: (done, of) => `In progress · ${done}/${of}`,
  sameForEveryone: '10 questions · same for everyone today',
  seeResults: 'See today’s results',
  results: 'See results',
  continue: 'Continue',
  playToday: 'Play today’s quiz',
  endless: 'Endless',
  endlessBlurb: 'Three strikes and you’re out · no repeats',
  startEndless: 'Start an endless run',
  answeredRight: (right, answered, best) => `${right} of ${answered} answered right · best run ${best} · `,
  seenOf: (seen, total) => `${seen} of ${total}+ questions seen`,
  help: 'Pick an answer, pull the lever to guess a number, type it, put things in order, decode emoji or name a tune. Right answers score 100, plus up to 50 for speed; near misses still score. Keys: 1–4 or A–D to answer, arrows for the lever, Enter for the next question.',
  round: (n) => `⚔️ Round ${n}`,
  livesLeft: (n) => `${n} lives left`,
  questionOf: (i, n) => `Question ${i} of ${n}`,
  secondsLeft: (s) => `${s}s`,
  emojiPuzzle: 'Emoji puzzle',
  correct: (n) => `Correct! +${n}`,
  close: (n) => `So close! +${n}`,
  timeUp: 'Time’s up!',
  nope: 'Nope!',
  offBy: (what) => ` Off by ${what}`,
  answer: 'Answer:',
  factPrefix: 'Wait, what? ',
  nextQuestion: 'Next question',
  endRun: 'End run',
  paused: 'Paused',
  pausedHint: 'Tap to carry on. The clock is stopped.',
  verdictEndless: ['Walking encyclopedia', 'Seriously impressive', 'Not bad at all', 'The facts fought back'],
  verdictDaily: ['Genius. Suspiciously so.', 'Big brain energy', 'Respectable', 'Wait, what?', 'The facts won today'],
  shareLine: (right, of, points) => `${right}/${of} right · ${points} points`,
  challengeRound: (n) => `Challenge · round ${n}`,
  endlessRun: 'Endless run',
  points: ' points',
  rightBefore: (n, strikes) => `${n} right before ${strikes} strikes`,
  rightOutOf: (n, of) => `${n} right out of ${of}`,
  seeScoreboard: 'See the scoreboard',
  playAgain: 'Play again',
  shareResult: 'Share result',
  copied: 'Copied!',
  menu: 'Menu',
  hideAnswers: 'Hide the answers',
  showAnswers: 'Show all the answers',
  noAnswer: 'No answer',
  youSaid: (what) => `You said ${what}`,
  years: (n) => `${n} year${n === 1 ? '' : 's'}`,
  playing: 'Playing…',
  playAgainSound: 'Play it again',
  playSound: 'Play the sound',
  less: 'Less',
  more: 'More',
  yourGuess: 'Your guess',
  lockIn: '🔒 Lock it in',
  typeHere: 'Type your answer…',
  yourAnswer: 'Your answer',
  spelling: 'Spelling doesn’t have to be perfect.',
  you: (n) => `you: ${n}`,
  tapMore: (n) => `Tap ${n} more`,
  cats: {
    history: 'Weird history',
    animals: 'Animals',
    science: 'Science & body',
    food: 'Food & drink',
    geo: 'Geography',
    space: 'Space',
    tech: 'Inventions',
    pop: 'Pop culture',
    sports: 'Sports & games',
    words: 'Words',
    money: 'Money',
    myths: 'Myth or fact?',
    odd: 'Real word?!',
    world: 'Words of the world',
    time: 'Timeline',
    guess: 'Pull the lever',
    type: 'Type it',
    emoji: 'Emoji puzzle',
    tune: 'Name that tune',
    morse: 'Morse code',
  },
};

const BG: Ui = {
  tag: 'Факти, които звучат измислени, но не са.',
  dailyQuiz: (n) => `Дневен куиз #${n}`,
  dailyShort: (n) => `Дневен #${n}`,
  pointsRight: (points, right, of) => `${points} точки · ${right}/${of} верни`,
  inProgress: (done, of) => `Започнат · ${done}/${of}`,
  sameForEveryone: '10 въпроса · еднакви за всички днес',
  seeResults: 'Виж днешните резултати',
  results: 'Виж резултатите',
  continue: 'Продължи',
  playToday: 'Играй днешния куиз',
  endless: 'Безкраен',
  endlessBlurb: 'Три грешки и си вън · без повторения',
  startEndless: 'Започни безкрайна игра',
  answeredRight: (right, answered, best) => `${right} от ${answered} верни отговора · най-добра серия ${best} · `,
  seenOf: (seen, total) => `видени ${seen} от ${total}+ въпроса`,
  help: 'Избери отговор, дръпни лоста, за да познаеш число, напиши го, подреди нещата, разгадай емоджитата или познай мелодията. Верният отговор носи 100 точки и до 50 за бързина; почти верните също носят. Клавиши: 1–4 или A–D за отговор, стрелки за лоста, Enter за следващ въпрос.',
  round: (n) => `⚔️ Рунд ${n}`,
  livesLeft: (n) => `Остават ${n} живота`,
  questionOf: (i, n) => `Въпрос ${i} от ${n}`,
  secondsLeft: (s) => `${s} с`,
  emojiPuzzle: 'Емоджи пъзел',
  correct: (n) => `Вярно! +${n}`,
  close: (n) => `Почти! +${n}`,
  timeUp: 'Времето изтече!',
  nope: 'Не!',
  offBy: (what) => ` Разлика ${what}`,
  answer: 'Отговор:',
  factPrefix: 'Чакай, какво? ',
  nextQuestion: 'Следващ въпрос',
  endRun: 'Край на играта',
  paused: 'Пауза',
  pausedHint: 'Докосни, за да продължиш. Часовникът е спрян.',
  verdictEndless: ['Ходеща енциклопедия', 'Сериозно впечатляващо', 'Никак не е зле', 'Фактите отвърнаха на удара'],
  verdictDaily: ['Гений. Подозрително гениален.', 'Голям мозък', 'Прилично', 'Чакай, какво?', 'Днес фактите победиха'],
  shareLine: (right, of, points) => `${right}/${of} верни · ${points} точки`,
  challengeRound: (n) => `Предизвикателство · рунд ${n}`,
  endlessRun: 'Безкрайна игра',
  points: ' точки',
  rightBefore: (n, strikes) => `${n} верни преди ${strikes} грешки`,
  rightOutOf: (n, of) => `${n} верни от ${of}`,
  seeScoreboard: 'Виж класирането',
  playAgain: 'Играй пак',
  shareResult: 'Сподели резултата',
  copied: 'Копирано!',
  menu: 'Меню',
  hideAnswers: 'Скрий отговорите',
  showAnswers: 'Покажи всички отговори',
  noAnswer: 'Без отговор',
  youSaid: (what) => `Ти каза ${what}`,
  years: (n) => `${n} ${n === 1 ? 'година' : 'години'}`,
  playing: 'Свири…',
  playAgainSound: 'Пусни пак',
  playSound: 'Пусни звука',
  less: 'По-малко',
  more: 'Повече',
  yourGuess: 'Твоят отговор',
  lockIn: '🔒 Заключи',
  typeHere: 'Напиши отговора…',
  yourAnswer: 'Твоят отговор',
  spelling: 'Правописът не е нужно да е перфектен.',
  you: (n) => `ти: ${n}`,
  tapMore: (n) => `Още ${n}`,
  cats: {
    history: 'Странна история',
    animals: 'Животни',
    science: 'Наука и тяло',
    food: 'Храна и напитки',
    geo: 'География',
    space: 'Космос',
    tech: 'Изобретения',
    pop: 'Поп култура',
    sports: 'Спорт и игри',
    words: 'Думи',
    money: 'Пари',
    myths: 'Мит или факт?',
    odd: 'Истинска дума?!',
    world: 'Думи от света',
    time: 'Хронология',
    guess: 'Дръпни лоста',
    type: 'Напиши го',
    emoji: 'Емоджи пъзел',
    tune: 'Познай мелодията',
    morse: 'Морзова азбука',
  },
};

export const UI: Record<ContentLang, Ui> = { en: EN, bg: BG };

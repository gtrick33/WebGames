/**
 * Backgammon's own words, in the two languages the game carries (GameEntry.contentLangs): English,
 * and Bulgarian with the board's usual names (табла, пулове, марс).
 */
import type { BasicLang } from '../../platform/contentLang';
import type { Level } from './ai';

export interface Words {
  title: string;
  tagline: string;
  level: Record<Level, string>;
  levelHint: Record<Level, string>;
  you: string;
  them: string;
  computer: string;
  roll: string;
  rollFirst: string;
  opening: (a: number, b: number, youStart: boolean) => string;
  undo: string;
  done: string;
  noMoves: string;
  yourTurn: string;
  theirTurn: (name: string) => string;
  /** On an upright phone: the board is laid out for landscape. */
  turnSideways: string;
  pips: string;
  off: string;
  bar: string;
  to: (n: number) => string;
  win: Record<1 | 2 | 3, string>;
  youWonGame: (kind: string, n: number) => string;
  theyWonGame: (name: string, kind: string, n: number) => string;
  nextGame: string;
  matchWon: string;
  matchLost: string;
  playAgain: string;
  menu: string;
  daily: string;
  dailySub: (n: number) => string;
  dailyDone: string;
  dailyScore: string;
  match: string;
  matchSub: string;
  length: string;
  resume: string;
  start: string;
  friends: string;
  friendsSub: string;
  howTo: string;
  rules: string[];
  share: string;
  copied: string;
  newBest: string;
  best: string;
  wins: string;
  paused: string;
  resumeBtn: string;
  quit: string;
  sound: string;
  music: string;
  room: (code: string) => string;
  invite: string;
  inviteText: (code: string) => string;
  shareLink: string;
  sitHere: string;
  empty: string;
  addBot: string;
  removeBot: string;
  startMatch: string;
  needTwo: string;
  waitingHost: string;
  away: string;
  watching: string;
  readyFor: (a: number, b: number) => string;
  roomClosed: string;
  back: string;
  connecting: string;
  joinCode: string;
  join: string;
  openRoom: string;
  opening2: string;
  noRoom: string;
  rematch: string;
  host: string;
}

const en: Words = {
  title: 'Backgammon',
  tagline: 'Two dice, fifteen checkers, one race home.',
  level: { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' },
  levelHint: {
    easy: 'Learning the ropes',
    medium: 'Counts pips, makes points',
    hard: 'Judges every position',
    expert: 'Plays it out before it moves',
  },
  you: 'You',
  them: 'Them',
  computer: 'Computer',
  roll: 'Roll',
  rollFirst: 'Roll to see who starts',
  opening: (a, b, youStart) => `You ${a} · them ${b}: ${youStart ? 'you start' : 'they start'}`,
  undo: 'Undo',
  done: 'Done',
  noMoves: 'No legal move with that roll',
  yourTurn: 'Your turn',
  turnSideways: 'Turn your phone sideways for a bigger board',
  theirTurn: (name) => `${name} is playing…`,
  pips: 'pips',
  off: 'Off',
  bar: 'Bar',
  to: (n) => `to ${n}`,
  win: { 1: 'Single', 2: 'Gammon', 3: 'Backgammon' },
  youWonGame: (kind, n) => `You win: ${kind}, ${n} point${n === 1 ? '' : 's'}`,
  theyWonGame: (name, kind, n) => `${name} wins: ${kind}, ${n} point${n === 1 ? '' : 's'}`,
  nextGame: 'Next game',
  matchWon: 'You won the match!',
  matchLost: 'They won the match',
  playAgain: 'Play again',
  menu: 'Menu',
  daily: 'Today’s game',
  dailySub: (n) => `Backgammon #${n} · the same dice for everyone`,
  dailyDone: 'Today’s game is done',
  dailyScore: 'Your score today',
  match: 'Play a match',
  matchSub: 'Against the computer',
  length: 'Match to',
  resume: 'Continue your match',
  start: 'Play',
  friends: 'Play a friend',
  friendsSub: 'A live board: each on their own phone',
  howTo: 'How to play',
  rules: [
    'You move your light checkers from the top right, round the board, home to the bottom right; your opponent goes the other way. The first to bear all fifteen off wins.',
    'Roll two dice and move by each number; a double plays four times. Use both numbers when you can (when only one fits, the larger one).',
    'Land on an empty point, your own, or a single opposing checker (a blot): that one is hit and goes to the bar. Two or more opposing checkers close a point.',
    'A hit checker comes back in through the opponent’s home board before anything else moves.',
    'Once all fifteen are home, bear off: exact numbers, or a higher number from your highest point.',
    'A win is 1 point; a gammon 2 (they bore none off); a backgammon 3 (and they still have a checker on the bar or in your home board).',
  ],
  share: 'Share',
  copied: 'Copied!',
  newBest: 'New best!',
  best: 'Best',
  wins: 'Matches won',
  paused: 'Paused',
  resumeBtn: 'Continue',
  quit: 'Quit to menu',
  sound: 'Sound effects',
  music: 'Music',
  room: (code) => `Board ${code}`,
  invite: 'Send this to a friend',
  inviteText: (code) => `Fancy a game of backgammon? Board ${code}`,
  shareLink: 'Share the link',
  sitHere: 'Sit here',
  empty: 'Empty place',
  addBot: 'Play the computer',
  removeBot: 'Remove',
  startMatch: 'Start the match',
  needTwo: 'Waiting for a friend (or seat the computer)',
  waitingHost: 'Waiting for the host to start…',
  away: 'away',
  watching: 'You are watching this board.',
  readyFor: (a, b) => `${a} of ${b} ready`,
  roomClosed: 'This board has closed.',
  back: 'Back',
  connecting: 'Connecting…',
  joinCode: 'Board code',
  join: 'Join',
  openRoom: 'Open a board',
  opening2: 'Opening…',
  noRoom: 'No board with that code.',
  rematch: 'New match',
  host: 'host',
};

const bg: Words = {
  title: 'Табла',
  tagline: 'Два зара, петнайсет пула, едно надбягване до дома.',
  level: { easy: 'Лесно', medium: 'Средно', hard: 'Трудно', expert: 'Експерт' },
  levelHint: {
    easy: 'За начинаещи',
    medium: 'Брои точки и прави врати',
    hard: 'Преценява всяка позиция',
    expert: 'Изиграва ходовете наум, преди да играе',
  },
  you: 'Ти',
  them: 'Те',
  computer: 'Компютър',
  roll: 'Хвърли',
  rollFirst: 'Хвърли, за да видим кой започва',
  opening: (a, b, youStart) => `Ти ${a} · те ${b}: ${youStart ? 'ти започваш' : 'те започват'}`,
  undo: 'Върни',
  done: 'Готово',
  noMoves: 'Няма възможен ход с тези зарове',
  yourTurn: 'Твой ред',
  turnSideways: 'Завърти телефона хоризонтално за по-голяма дъска',
  theirTurn: (name) => `${name} играе…`,
  pips: 'точки',
  off: 'Изнесени',
  bar: 'Бар',
  to: (n) => `до ${n}`,
  win: { 1: 'Обикновена', 2: 'Марс', 3: 'Двоен марс' },
  youWonGame: (kind, n) => `Печелиш: ${kind}, ${n} ${n === 1 ? 'точка' : 'точки'}`,
  theyWonGame: (name, kind, n) => `${name} печели: ${kind}, ${n} ${n === 1 ? 'точка' : 'точки'}`,
  nextGame: 'Следваща игра',
  matchWon: 'Спечели мача!',
  matchLost: 'Те спечелиха мача',
  playAgain: 'Нов мач',
  menu: 'Меню',
  daily: 'Играта за деня',
  dailySub: (n) => `Табла #${n} · еднакви зарове за всички`,
  dailyDone: 'Играта за деня е изиграна',
  dailyScore: 'Резултатът ти днес',
  match: 'Мач',
  matchSub: 'Срещу компютъра',
  length: 'Мач до',
  resume: 'Продължи мача',
  start: 'Играй',
  friends: 'Игра с приятел',
  friendsSub: 'Табла на живо: всеки от своя телефон',
  howTo: 'Правила',
  rules: [
    'Местиш светлите пулове от горния десен ъгъл, около таблата, до дома си долу вдясно; противникът върви обратно. Печели първият, изнесъл всичките петнайсет.',
    'Хвърляш два зара и местиш с всяко число; чифт се играе четири пъти. Играеш и двете числа, когато можеш (ако може само едното, по-голямото).',
    'Може да застанеш на празно поле, на свое или на единичен пул на противника: той е ударен и отива на бара. Два или повече пула на противника затварят полето.',
    'Ударен пул влиза обратно през дома на противника, преди да се мести нещо друго.',
    'Щом и петнайсетте са у дома, изнасяш: с точно число или с по-голямо от най-високото поле, на което имаш пул.',
    'Победата е 1 точка; марс 2 (противникът не е изнесъл нито един); двоен марс 3 (и още има пул на бара или в твоя дом).',
  ],
  share: 'Сподели',
  copied: 'Копирано!',
  newBest: 'Нов рекорд!',
  best: 'Рекорд',
  wins: 'Спечелени мачове',
  paused: 'Пауза',
  resumeBtn: 'Продължи',
  quit: 'Към менюто',
  sound: 'Звукови ефекти',
  music: 'Музика',
  room: (code) => `Табла ${code}`,
  invite: 'Прати това на приятел',
  inviteText: (code) => `Една табла? Код ${code}`,
  shareLink: 'Сподели линка',
  sitHere: 'Седни тук',
  empty: 'Свободно място',
  addBot: 'Играй срещу компютъра',
  removeBot: 'Махни',
  startMatch: 'Започни мача',
  needTwo: 'Чакаме приятел (или сложи компютъра)',
  waitingHost: 'Чакаме домакина да започне…',
  away: 'излезе',
  watching: 'Гледаш тази табла.',
  readyFor: (a, b) => `${a} от ${b} готови`,
  roomClosed: 'Таблата е затворена.',
  back: 'Назад',
  connecting: 'Свързване…',
  joinCode: 'Код на таблата',
  join: 'Влез',
  openRoom: 'Отвори табла',
  opening2: 'Отваряне…',
  noRoom: 'Няма табла с този код.',
  rematch: 'Нов мач',
  host: 'домакин',
};

export const WORDS: Record<BasicLang, Words> = { en, bg };

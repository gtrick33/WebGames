/**
 * Belot's own words, in the two languages the game carries (GameEntry.contentLangs): English, and
 * Bulgarian with the terms players use at the table.
 */
import type { BasicLang } from '../../platform/contentLang';
import type { DeclKind, Outcome } from './logic';
import type { Level } from './ai';

export interface Words {
  title: string;
  tagline: string;
  suits: [string, string, string, string];
  noTrumps: string;
  allTrumps: string;
  /** The contract badge on a narrow table. */
  noTrumpsShort: string;
  allTrumpsShort: string;
  /** Card ranks 7 to ace, and a card's name for screen readers. */
  ranks: [string, string, string, string, string, string, string, string];
  cardName: (rank: string, suit: number) => string;
  pass: string;
  contra: string;
  recontra: string;
  decl: Record<DeclKind, string>;
  belote: string;
  valat: string;
  level: Record<Level, string>;
  levelHint: Record<Level, string>;
  us: string;
  them: string;
  you: string;
  partner: string;
  right: string;
  left: string;
  to151: string;
  hanging: (n: number) => string;
  dealer: string;
  yourBid: string;
  yourTurn: string;
  waitingFor: (name: string) => string;
  declare: string;
  declareHint: string;
  lastTrick: string;
  tricks: string;
  cards: string;
  lastTen: string;
  declarations: string;
  total: string;
  outcome: Record<Outcome, string>;
  /** The sheet's outcome line; `tie`: nobody is ahead (a contra tie hangs everything). */
  outcomeLine: (o: Outcome, bidders: string, n: number, tie: boolean) => string;
  /** What each outcome means, under the stamp when it is tapped. */
  outcomeHelp: Record<Outcome, string>;
  gamePoints: string;
  hangTaken: (n: number) => string;
  nextDeal: string;
  thrown: string;
  /** Four passes in today's deals or a challenge: the deal is one of the four, scored 0. */
  thrownSet: string;
  matchWon: string;
  matchLost: string;
  playAgain: string;
  menu: string;
  daily: string;
  dailySub: (n: number) => string;
  dailyDeal: (i: number) => string;
  dailyDone: string;
  dailyScore: string;
  match: string;
  matchSub: string;
  resume: string;
  friends: string;
  friendsSub: string;
  howTo: string;
  rules: string[];
  pickLevel: string;
  start: string;
  share: string;
  copied: string;
  newBest: string;
  best: string;
  paused: string;
  pause: string;
  tapToContinue: string;
  resumeBtn: string;
  quit: string;
  sound: string;
  music: string;
  // live room
  room: (code: string) => string;
  invite: string;
  inviteText: (code: string) => string;
  /** The invite once every place is taken: whoever comes now watches. */
  inviteWatch: string;
  inviteWatchText: (code: string) => string;
  shareLink: string;
  sitHere: string;
  empty: string;
  addBot: string;
  bot: (l: string) => string;
  removeBot: string;
  startMatch: string;
  needFour: string;
  waitingHost: string;
  away: string;
  watching: string;
  next: string;
  readyFor: (a: number, b: number) => string;
  roomClosed: string;
  back: string;
  connecting: string;
  joinCode: string;
  join: string;
  openRoom: string;
  opening: string;
  noRoom: string;
  rematch: string;
  wins: string;
  host: string;
  scoreboard: string;
  /** "151 to 98", for screen readers. */
  scoreLine: (a: number, b: number) => string;
  /** A watcher's end of match: who won. */
  teamWon: (names: string) => string;
  /** The room's answers, by code (room.ts ActError) and the reasons a room goes away. */
  errors: Record<'join' | 'taken' | 'call' | 'card' | 'unknown' | 'full' | 'removed' | 'closed', string>;
  timeLeft: string;
  takePlace: string;
  standUp: string;
  matchOver: string;
  dailyCounts: string;
  bestMatch: string;
  bestMatchHint: string;
  settings: string;
  fourColor: string;
}

const en: Words = {
  title: 'Belot',
  tagline: 'Four players, two teams, first to 151.',
  suits: ['Clubs', 'Diamonds', 'Hearts', 'Spades'],
  noTrumps: 'No trumps',
  allTrumps: 'All trumps',
  noTrumpsShort: 'NT',
  allTrumpsShort: 'AT',
  ranks: ['Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'],
  cardName: (rank, suit) => `${rank} of ${['clubs', 'diamonds', 'hearts', 'spades'][suit]}`,
  pass: 'Pass',
  contra: 'Contra',
  recontra: 'Recontra',
  decl: { tierce: 'Tierce', quarte: 'Quarte', quint: 'Quint', carre: 'Carré' },
  belote: 'Belote',
  valat: 'Valat',
  level: { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' },
  levelHint: {
    easy: 'Learning the ropes',
    medium: 'Plays sensibly, does not count cards',
    hard: 'Counts every card',
    expert: 'Thinks every card through',
  },
  us: 'Us',
  them: 'Them',
  you: 'You',
  partner: 'Partner',
  right: 'Right',
  left: 'Left',
  to151: 'to 151',
  hanging: (n) => `${n} hanging`,
  dealer: 'Dealer',
  yourBid: 'Your call',
  yourTurn: 'Your turn',
  waitingFor: (name) => `${name} is thinking…`,
  declare: 'Declare',
  declareHint: 'Announced with your first card',
  lastTrick: 'Last trick',
  tricks: 'Tricks',
  cards: 'Cards',
  lastTen: 'Last trick',
  declarations: 'Declarations',
  total: 'Total',
  outcome: { outside: 'Made it', inside: 'Inside', hanging: 'Hanging', doubled: 'Contra', thrown: 'Thrown in' },
  outcomeLine: (o, bidders, n, tie) =>
    o === 'outside'
      ? `${bidders} made the contract: each team keeps its points.`
      : o === 'inside'
        ? `${bidders} went inside: the other team takes everything.`
        : o === 'hanging' || tie
          ? `A tie: ${n} points hang until the next deal.`
          : `Contra: the team ahead takes everything, multiplied.`,
  outcomeHelp: {
    outside: 'The bidders scored more than the other team, so each team keeps its own points.',
    inside: 'The bidders did not score more than the other team, so the other team takes all the points.',
    hanging: 'Both teams scored the same. The other team keeps its points; the bidders’ wait for whoever wins the next deal.',
    doubled: 'After a contra the team with more points takes everything, times 2 (times 4 after recontra). A tie hangs it all.',
    thrown: 'Everyone passed, so the cards were dealt again.',
  },
  gamePoints: 'Game points',
  hangTaken: (n) => `+${n} hanging points from before`,
  nextDeal: 'Next deal',
  thrown: 'Everyone passed. New deal.',
  thrownSet: 'Everyone passed: this deal counts as played, 0 points.',
  matchWon: 'You won the match!',
  matchLost: 'They won the match',
  playAgain: 'Play again',
  menu: 'Menu',
  daily: 'Today’s deals',
  dailySub: (n) => `Belot #${n} · the same four deals for everyone`,
  dailyDeal: (i) => `Deal ${i} of 4`,
  dailyDone: 'Today’s deals are done',
  dailyScore: 'Your points over the four deals',
  match: 'Play a match',
  matchSub: 'To 151 against the computer',
  resume: 'Continue your match',
  friends: 'Play with friends',
  friendsSub: 'A live table: each on their own phone',
  howTo: 'How to play',
  rules: [
    'Two teams: you and your partner sit opposite. Play goes counter-clockwise. First team to 151 wins.',
    'Five cards each, then bid: Clubs, Diamonds, Hearts, Spades, No trumps, All trumps (each bid higher). Contra doubles, recontra doubles again. Three passes end the bidding.',
    'Then three more cards each. Follow suit. With trumps: beat a trump lead if you can; out of a suit, trump an opponent’s trick and over-trump if you can (not needed when your partner holds it). All trumps: always beat the best card if you can.',
    'Trumps: J 20, 9 14, A 11, 10 10, K 4, Q 3. Other suits: A 11, 10 10, K 4, Q 3, J 2. Last trick +10. All eight tricks (valat) +90.',
    'With your first card declare runs and fours: tierce 20, quarte 50, quint 100, four jacks 200, nines 150, aces, tens, kings or queens 100. K and Q of trumps: belote 20.',
    'The bidding team must score more than the other or go inside: then the other team takes everything. A tie hangs: those points go to the next deal’s winner.',
    'Four passes throw the cards in: the next player deals again. In Today’s deals a thrown-in deal still counts as one of the four, with 0 points.',
    'After a contra the team with more points takes all the points of the deal, doubled; after a recontra, times four. A tie hangs them all.',
    'A card serves only one declaration: a run and a carré that share a card count as whichever is worth more.',
    'No match is won on a valat: if a deal of all eight tricks takes a team past 151, the match goes on.',
  ],
  pickLevel: 'Choose the table',
  start: 'Deal',
  share: 'Share',
  copied: 'Copied!',
  newBest: 'New best!',
  best: 'Best',
  paused: 'Paused',
  pause: 'Pause',
  tapToContinue: 'Tap to continue',
  resumeBtn: 'Continue',
  quit: 'Quit to menu',
  sound: 'Sound effects',
  music: 'Music',
  room: (code) => `Table ${code}`,
  invite: 'Send this to your friends',
  inviteText: (code) => `Come play Belot with me! Table ${code}`,
  inviteWatch: 'Send this to friends who want to watch',
  inviteWatchText: (code) => `Come watch our Belot game! Table ${code}`,
  shareLink: 'Share the link',
  sitHere: 'Sit here',
  empty: 'Empty place',
  addBot: 'Computer player',
  bot: (l) => `Computer · ${l}`,
  removeBot: 'Remove',
  startMatch: 'Start the match',
  needFour: 'Empty places get a computer player',
  waitingHost: 'Waiting for the host to start…',
  away: 'away',
  watching: 'You are watching. A place frees up between matches.',
  next: 'Next deal',
  readyFor: (a, b) => `${a} of ${b} ready`,
  roomClosed: 'This table has closed.',
  back: 'Back',
  connecting: 'Connecting…',
  joinCode: 'Table code',
  join: 'Join',
  openRoom: 'Open a table',
  opening: 'Opening…',
  noRoom: 'No table with that code.',
  rematch: 'New match',
  wins: 'Matches won',
  host: 'host',
  scoreboard: 'See the scoreboard',
  scoreLine: (a, b) => `${a} to ${b}`,
  teamWon: (names) => `${names} won the match`,
  errors: {
    join: 'Join the table first.',
    taken: 'That place is taken.',
    call: 'You can’t call that now.',
    card: 'You can’t play that card now.',
    unknown: 'That didn’t work. Try again.',
    full: 'This table is full.',
    removed: 'You were removed from the table.',
    closed: 'This table has closed.',
  },
  timeLeft: 'Time left',
  takePlace: 'Take this place',
  standUp: 'Stand up',
  matchOver: 'Places can change now: sit, stand or swap with a computer player before the next match.',
  dailyCounts: 'You already played this day’s deals: your result counts here.',
  bestMatch: 'Best match',
  bestMatchHint: 'A won match scores its table (Easy 100, Medium 200, Hard 300, Expert 400) plus the winning margin.',
  settings: 'Settings',
  fourColor: 'Four-color deck',
};

const bg: Words = {
  title: 'Белот',
  tagline: 'Четирима играчи, два отбора, до 151.',
  suits: ['Спатия', 'Каро', 'Купа', 'Пика'],
  noTrumps: 'Без коз',
  allTrumps: 'Всичко коз',
  noTrumpsShort: 'БК',
  allTrumpsShort: 'ВК',
  ranks: ['Седмица', 'Осмица', 'Деветка', 'Десетка', 'Вале', 'Дама', 'Поп', 'Асо'],
  cardName: (rank, suit) => `${rank} ${['спатия', 'каро', 'купа', 'пика'][suit]}`,
  pass: 'Пас',
  contra: 'Контра',
  recontra: 'Реконтра',
  decl: { tierce: 'Терца', quarte: 'Кварта', quint: 'Квинта', carre: 'Каре' },
  belote: 'Белот',
  valat: 'Валат',
  level: { easy: 'Лесно', medium: 'Средно', hard: 'Трудно', expert: 'Експерт' },
  levelHint: {
    easy: 'За начинаещи',
    medium: 'Играе разумно, без да брои картите',
    hard: 'Брои всяка карта',
    expert: 'Обмисля всяка карта',
  },
  us: 'Ние',
  them: 'Вие',
  you: 'Ти',
  partner: 'Партньор',
  right: 'Дясно',
  left: 'Ляво',
  to151: 'до 151',
  hanging: (n) => `${n} висящи`,
  dealer: 'Раздава',
  yourBid: 'Твоят ред да обявиш',
  yourTurn: 'Твой ред',
  waitingFor: (name) => `${name} мисли…`,
  declare: 'Обяви',
  declareHint: 'Обявява се с първата карта',
  lastTrick: 'Последна ръка',
  tricks: 'Ръце',
  cards: 'Карти',
  lastTen: 'Последна ръка',
  declarations: 'Анонси',
  total: 'Общо',
  outcome: { outside: 'Изкарана', inside: 'Вътре', hanging: 'Висяща', doubled: 'Контра', thrown: 'Пасове' },
  outcomeLine: (o, bidders, n, tie) =>
    o === 'outside'
      ? `${bidders} изкараха играта: всеки отбор взима своите точки.`
      : o === 'inside'
        ? `${bidders} са вътре: другият отбор взима всичко.`
        : o === 'hanging' || tie
          ? `Равенство: ${n} точки висят до следващата игра.`
          : `Контра: отборът с повече точки взима всичко, умножено.`,
  outcomeHelp: {
    outside: 'Обявилите имат повече точки от другия отбор, затова всеки отбор взима своите.',
    inside: 'Обявилите нямат повече точки от другия отбор, затова другият отбор взима всичко.',
    hanging: 'Двата отбора имат равни точки. Другият отбор взима своите, а точките на обявилите отиват при победителя в следващата игра.',
    doubled: 'След контра отборът с повече точки взима всичко, по 2 (по 4 след реконтра). При равенство всичко виси.',
    thrown: 'Всички казаха пас, затова картите се раздават отново.',
  },
  gamePoints: 'Точки',
  hangTaken: (n) => `+${n} висящи точки от преди`,
  nextDeal: 'Следваща игра',
  thrown: 'Всички казаха пас. Ново раздаване.',
  thrownSet: 'Всички казаха пас: играта се брои за изиграна, с 0 точки.',
  matchWon: 'Спечелихте партията!',
  matchLost: 'Те спечелиха партията',
  playAgain: 'Нова партия',
  menu: 'Меню',
  daily: 'Игрите за деня',
  dailySub: (n) => `Белот #${n} · едни и същи четири раздавания за всички`,
  dailyDeal: (i) => `Игра ${i} от 4`,
  dailyDone: 'Игрите за деня са изиграни',
  dailyScore: 'Твоите точки от четирите игри',
  match: 'Партия',
  matchSub: 'До 151 срещу компютъра',
  resume: 'Продължи партията',
  friends: 'Игра с приятели',
  friendsSub: 'Маса на живо: всеки от своя телефон',
  howTo: 'Правила',
  rules: [
    'Два отбора: ти и партньорът ти седите един срещу друг. Играе се обратно на часовниковата стрелка. Печели първият отбор до 151.',
    'По пет карти, после обявяване: спатия, каро, купа, пика, без коз, всичко коз (всяко обявяване по-високо). Контра удвоява, реконтра удвоява пак. Три паса след обявяване го приключват.',
    'После още по три карти. Отговаря се на боя. При коз: козът се качва, ако може; ако нямаш от боята, цакаш, когато ръката е на противник, и надцакваш, ако можеш (не е нужно, ако ръката е на партньора). При всичко коз винаги се качва, ако може.',
    'Коз: вале 20, деветка 14, асо 11, десетка 10, поп 4, дама 3. Другите бои: асо 11, десетка 10, поп 4, дама 3, вале 2. Последна ръка +10. Всичките осем ръце (валат) +90.',
    'С първата си карта обявяваш поредни и карета: терца 20, кварта 50, квинта 100, каре валета 200, деветки 150, аса, десетки, попове или дами 100. Поп и дама коз: белот 20.',
    'Обявилият отбор трябва да има повече точки, иначе е вътре и другият отбор взима всичко. При равенство играта е висяща: точките отиват при победителя в следващата игра.',
    'При четири паса картите се хвърлят и следващият раздава отново. В игрите за деня такова раздаване се брои за едно от четирите, с 0 точки.',
    'След контра отборът с повече точки взима всички точки от играта, удвоени; след реконтра – по четири. При равенство всичко виси.',
    'Една карта участва само в един анонс: поредни и каре с обща карта се броят като по-ценното от двете.',
    'Партия не се печели с валат: ако игра с всичките осем ръце изкара отбор над 151, партията продължава.',
  ],
  pickLevel: 'Избери масата',
  start: 'Раздай',
  share: 'Сподели',
  copied: 'Копирано!',
  newBest: 'Нов рекорд!',
  best: 'Рекорд',
  paused: 'Пауза',
  pause: 'Пауза',
  tapToContinue: 'Докосни, за да продължиш',
  resumeBtn: 'Продължи',
  quit: 'Към менюто',
  sound: 'Звукови ефекти',
  music: 'Музика',
  room: (code) => `Маса ${code}`,
  invite: 'Прати това на приятелите си',
  inviteText: (code) => `Ела да играем белот! Маса ${code}`,
  inviteWatch: 'Прати това на приятели, които искат да гледат',
  inviteWatchText: (code) => `Ела да гледаш как играем белот! Маса ${code}`,
  shareLink: 'Сподели линка',
  sitHere: 'Седни тук',
  empty: 'Свободно място',
  addBot: 'Компютър',
  bot: (l) => `Компютър · ${l}`,
  removeBot: 'Махни',
  startMatch: 'Започни партията',
  needFour: 'На празните места сяда компютър',
  waitingHost: 'Чакаме домакина да започне…',
  away: 'излезе',
  watching: 'Гледаш. Място се освобождава между партиите.',
  next: 'Следваща игра',
  readyFor: (a, b) => `${a} от ${b} готови`,
  roomClosed: 'Масата е затворена.',
  back: 'Назад',
  connecting: 'Свързване…',
  joinCode: 'Код на масата',
  join: 'Влез',
  openRoom: 'Отвори маса',
  opening: 'Отваряне…',
  noRoom: 'Няма маса с този код.',
  rematch: 'Нова партия',
  wins: 'Спечелени партии',
  host: 'домакин',
  scoreboard: 'Към класирането',
  scoreLine: (a, b) => `${a} на ${b}`,
  teamWon: (names) => `${names} спечелиха партията`,
  errors: {
    join: 'Първо влез на масата.',
    taken: 'Мястото е заето.',
    call: 'Сега не можеш да обявиш това.',
    card: 'Сега не можеш да играеш тази карта.',
    unknown: 'Не стана. Опитай пак.',
    full: 'Масата е пълна.',
    removed: 'Махнаха те от масата.',
    closed: 'Масата е затворена.',
  },
  timeLeft: 'Оставащо време',
  takePlace: 'Заеми мястото',
  standUp: 'Стани',
  matchOver: 'Сега местата могат да се сменят: седни, стани или смени компютъра преди следващата партия.',
  dailyCounts: 'Вече изигра раздаванията за този ден: резултатът ти се брои тук.',
  bestMatch: 'Най-добра партия',
  bestMatchHint: 'Спечелена партия носи точките на масата (Лесно 100, Средно 200, Трудно 300, Експерт 400) плюс разликата.',
  settings: 'Настройки',
  fourColor: 'Карти в четири цвята',
};

export const WORDS: Record<BasicLang, Words> = { en, bg };

/** A contract's name: a suit, no trumps, all trumps. */
export const contractName = (w: Words, c: number): string => (c < 4 ? w.suits[c]! : c === 4 ? w.noTrumps : w.allTrumps);

/** Crass Act's on-screen text in each language it plays in (the cards come from the room's deck). */
import type { BasicLang } from '../../platform/contentLang';

export interface Ui {
  adultsTitle: string;
  adultsBody: string;
  adultYes: string;
  takeMeBack: string;
  tag: string;
  yourName: string;
  namePlaceholder: string;
  invited: string;
  roomCode: string;
  code: string;
  joinRoom: string;
  or: string;
  openRoom: string;
  pickName: string;
  noRoom: (c: string) => string;
  roomFull: (c: string, max: number) => string;
  cannotOpen: string;
  howToPlay: string;
  rules: (min: number, max: number) => string;
  inviteText: (code: string) => string;
  back: string;
  reconnecting: string;
  joining: (code: string) => string;
  cancel: string;
  partyRoom: (code: string) => string;
  openInParty: string;
  connectionLost: string;
  host: string;
  judge: string;
  remove: (name: string) => string;
  inviteFriends: string;
  players: (online: number, max: number) => string;
  needPlayers: (min: number) => string;
  rulesTitle: string;
  pointsToWin: string;
  timeToPlay: string;
  whoDecides: string;
  judgeTakesTurns: string;
  everyoneVotes: string;
  cards: string;
  start: string;
  waitingHost: string;
  leaveRoom: string;
  round: (n: number) => string;
  tieBreaker: string;
  firstTo: (n: number) => string;
  leave: string;
  tieBreakerNote: string;
  joinedMid: string;
  youJudge: (waiting: string) => string;
  nobody: string;
  cardPlayed: (waiting: string) => string;
  everyoneElse: string;
  playPrompt: (vote: boolean, judge: string, two: boolean) => string;
  theJudge: string;
  playThese: string;
  playThis: string;
  swapHand: string;
  oncePerGame: string;
  voteCast: string;
  voteFunniest: string;
  pickWinner: string;
  choosing: (judge: string) => string;
  yours: string;
  voteThis: string;
  thisWins: string;
  roundWinner: (names: string, tie: boolean) => string;
  tiedLead: string;
  votes: (n: number) => string;
  nextRound: string;
  yourPoints: (n: number) => string;
  wins: (name: string) => string;
  gameOver: string;
  menace: string;
  shame: string;
  greatestHits: string;
  playAgain: string;
  waitingAnother: string;
}

const EN: Ui = {
  adultsTitle: 'This one is for adults.',
  adultsBody: 'Crass Act is a card game full of crude, dark and offensive jokes. Play it with friends who won’t report you to HR.',
  adultYes: 'I’m 18 or older',
  takeMeBack: 'Take me back',
  tag: 'Bad taste, played well.',
  yourName: 'Your name',
  namePlaceholder: 'Something your mum wouldn’t call you',
  invited: 'You’re invited to room',
  roomCode: 'Room code',
  code: 'CODE',
  joinRoom: 'Join room',
  or: 'or',
  openRoom: 'Open a new room',
  pickName: 'Pick a name first.',
  noRoom: (c) => `There is no room ${c}. Check the code, or open a new room.`,
  roomFull: (c, max) => `Room ${c} is full (${max} players).`,
  cannotOpen: 'Could not open a room.',
  howToPlay: 'How to play',
  rules: (min, max) =>
    `${min} to ${max} players, each on their own phone or computer. Every round one player is the judge and reads out a prompt card. Everyone else plays the funniest (or most horrible) answer card from their hand. The judge picks a winner, who gets a point. First to the target wins (when players reach it together, they play on until one is ahead). In vote mode there is no judge: everyone plays and votes.`,
  inviteText: (code) => `Join my Crass Act room 😈\nRoom code: ${code}\nFill-in-the-blank cards for adults (18+)`,
  back: 'Back',
  reconnecting: 'Reconnecting…',
  joining: (code) => `Joining room ${code}…`,
  cancel: 'Cancel',
  partyRoom: (code) => `Room ${code} is a Party Mode room.`,
  openInParty: 'Open it in Party Mode',
  connectionLost: 'Connection lost. Reconnecting…',
  host: 'Host',
  judge: 'Judge',
  remove: (name) => `Remove ${name}`,
  inviteFriends: 'Invite friends',
  players: (online, max) => `Players (${online}/${max})`,
  needPlayers: (min) => `You need at least ${min} players. Send the link!`,
  rulesTitle: 'Rules',
  pointsToWin: 'Points to win',
  timeToPlay: 'Time to play',
  whoDecides: 'Who decides',
  judgeTakesTurns: 'A judge (takes turns)',
  everyoneVotes: 'Everyone votes',
  cards: 'Cards',
  start: 'Start the game',
  waitingHost: 'Waiting for the host to start…',
  leaveRoom: 'Leave room',
  round: (n) => `Round ${n}`,
  tieBreaker: 'Tie-breaker',
  firstTo: (n) => `First to ${n}`,
  leave: 'Leave',
  tieBreakerNote: '⚡ Tie-breaker round! The game goes on until one player is ahead.',
  joinedMid: 'You joined mid-round. You’re in from the next one!',
  youJudge: (waiting) => `You’re the judge ⚖️ Sit back while everyone plays. Waiting on ${waiting}.`,
  nobody: 'nobody',
  cardPlayed: (waiting) => `Card played. Waiting on ${waiting}…`,
  everyoneElse: 'everyone else',
  playPrompt: (vote, judge, two) => `${vote ? 'Play' : `${judge} is judging. Play`} ${two ? 'two cards, in order' : 'your funniest card'}.`,
  theJudge: 'The judge',
  playThese: 'Play these cards',
  playThis: 'Play this card',
  swapHand: 'Swap my hand',
  oncePerGame: 'Once per game',
  voteCast: 'Vote cast. Waiting for the others…',
  voteFunniest: 'Vote for the funniest one (not your own!).',
  pickWinner: 'Pick the winner. No pressure.',
  choosing: (judge) => `${judge} is choosing…`,
  yours: 'yours',
  voteThis: 'Vote for this',
  thisWins: 'This one wins',
  roundWinner: (names, tie) => `🏆 ${names} ${tie ? 'tie' : 'wins'} the round!`,
  tiedLead: '⚡ Tied for the lead! A tie-breaker round decides it.',
  votes: (n) => ` · ${n} vote${n === 1 ? '' : 's'}`,
  nextRound: 'Next round',
  yourPoints: (n) => `You: ${n} point${n === 1 ? '' : 's'}`,
  wins: (name) => `${name} wins!`,
  gameOver: 'Game over',
  menace: 'You absolute menace.',
  shame: 'Shame on all of you.',
  greatestHits: 'Greatest hits',
  playAgain: 'Play again (new cards)',
  waitingAnother: 'Waiting for the host to start another game…',
};

const BG: Ui = {
  adultsTitle: 'Тази игра е за възрастни.',
  adultsBody: 'Crass Act е игра с карти, пълна с груби, черни и обидни шеги. Играй я с приятели, които няма да те наклеветят пред шефа.',
  adultYes: 'Навърших 18',
  takeMeBack: 'Върни ме обратно',
  tag: 'Лош вкус, изигран добре.',
  yourName: 'Името ти',
  namePlaceholder: 'Нещо, което майка ти не би казала',
  invited: 'Поканен си в стая',
  roomCode: 'Код на стаята',
  code: 'КОД',
  joinRoom: 'Влез',
  or: 'или',
  openRoom: 'Отвори нова стая',
  pickName: 'Първо си избери име.',
  noRoom: (c) => `Няма стая ${c}. Провери кода или отвори нова стая.`,
  roomFull: (c, max) => `Стая ${c} е пълна (${max} играчи).`,
  cannotOpen: 'Не успяхме да отворим стая.',
  howToPlay: 'Как се играе',
  rules: (min, max) =>
    `От ${min} до ${max} играчи, всеки на своя телефон или компютър. Всеки рунд един играч е съдия и чете карта с въпрос. Всички останали играят най-смешния (или най-ужасния) отговор от ръката си. Съдията избира победителя, който печели точка. Печели първият, стигнал целта (ако няколко я стигнат заедно, играят, докато някой не поведе). В режим „гласуване“ няма съдия: всички играят и гласуват.`,
  inviteText: (code) => `Ела в стаята ми в Crass Act 😈\nКод: ${code}\nКарти с празни места за възрастни (18+)`,
  back: 'Назад',
  reconnecting: 'Свързваме се отново…',
  joining: (code) => `Влизаме в стая ${code}…`,
  cancel: 'Отказ',
  partyRoom: (code) => `Стая ${code} е от Парти режима.`,
  openInParty: 'Отвори я в Парти режима',
  connectionLost: 'Връзката прекъсна. Свързваме се отново…',
  host: 'Домакин',
  judge: 'Съдия',
  remove: (name) => `Махни ${name}`,
  inviteFriends: 'Покани приятели',
  players: (online, max) => `Играчи (${online}/${max})`,
  needPlayers: (min) => `Трябват поне ${min} играчи. Прати линка!`,
  rulesTitle: 'Правила',
  pointsToWin: 'Точки за победа',
  timeToPlay: 'Време за ход',
  whoDecides: 'Кой решава',
  judgeTakesTurns: 'Съдия (на смени)',
  everyoneVotes: 'Всички гласуват',
  cards: 'Карти',
  start: 'Започни играта',
  waitingHost: 'Чакаме домакина да започне…',
  leaveRoom: 'Напусни стаята',
  round: (n) => `Рунд ${n}`,
  tieBreaker: 'Решаващ рунд',
  firstTo: (n) => `До ${n} точки`,
  leave: 'Изход',
  tieBreakerNote: '⚡ Решаващ рунд! Играта продължава, докато някой не поведе.',
  joinedMid: 'Влезе по средата на рунда. Играеш от следващия!',
  youJudge: (waiting) => `Ти си съдията ⚖️ Отпусни се, докато другите играят. Чакаме ${waiting}.`,
  nobody: 'никого',
  cardPlayed: (waiting) => `Картата е изиграна. Чакаме ${waiting}…`,
  everyoneElse: 'останалите',
  playPrompt: (vote, judge, two) => `${vote ? 'Изиграй' : `${judge} е съдия. Изиграй`} ${two ? 'две карти, по ред' : 'най-смешната си карта'}.`,
  theJudge: 'Съдията',
  playThese: 'Изиграй тези карти',
  playThis: 'Изиграй тази карта',
  swapHand: 'Смени си картите',
  oncePerGame: 'Веднъж на игра',
  voteCast: 'Гласът е подаден. Чакаме другите…',
  voteFunniest: 'Гласувай за най-смешната (не за своята!).',
  pickWinner: 'Избери победителя. Без напрежение.',
  choosing: (judge) => `${judge} избира…`,
  yours: 'твоя',
  voteThis: 'Гласувай за тази',
  thisWins: 'Тази печели',
  roundWinner: (names, tie) => `🏆 ${names} ${tie ? 'делят' : 'печели'} рунда!`,
  tiedLead: '⚡ Равенство на върха! Решаващ рунд ще определи победителя.',
  votes: (n) => ` · ${n} ${n === 1 ? 'глас' : 'гласа'}`,
  nextRound: 'Следващ рунд',
  yourPoints: (n) => `Ти: ${n} ${n === 1 ? 'точка' : 'точки'}`,
  wins: (name) => `${name} печели!`,
  gameOver: 'Край на играта',
  menace: 'Ти си пълно бедствие. Браво.',
  shame: 'Срам за всички ви.',
  greatestHits: 'Най-доброто от играта',
  playAgain: 'Играй пак (нови карти)',
  waitingAnother: 'Чакаме домакина да започне нова игра…',
};

export const UI: Record<BasicLang, Ui> = { en: EN, bg: BG };

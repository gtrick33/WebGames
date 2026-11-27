/**
 * The Trophy Shelf: every game has a board of four enamel pins, and the arcade a board of its own. A pin is
 * earned on the server from the rounds it recorded (server/pins.ts), and kept for good. A guest sees every
 * board too, and what they have already done on this device, as the reason to sign in and claim it.
 */

export type PinTier = 'bronze' | 'silver' | 'gold' | 'rift';

export const TIER_POINTS: Record<PinTier, number> = { bronze: 5, silver: 10, gold: 25, rift: 50 };

export type PinNeed =
  | { rounds: number }
  | { score: number }
  | { stat: string; min: number }
  | { totalRounds: number }
  | { gamesPlayed: number }
  | { streak: number }
  | { level: number }
  | { friends: number }
  | { podium: true }
  | { crown: true };

export interface PinDef {
  id: string;
  /** A game's slug, or ARCADE for the board of the arcade as a whole. */
  board: string;
  name: string;
  hint: string;
  tier: PinTier;
  need: PinNeed;
}

export const ARCADE = 'arcade';

type Row = [name: string, hint: string, need: PinNeed];

/** A game's four pins, from a first round to the one very few will hold. */
const board = (slug: string, bronze: Row, silver: Row, gold: Row, rift: Row): PinDef[] =>
  ([['bronze', bronze], ['silver', silver], ['gold', gold], ['rift', rift]] as const).map(([tier, [name, hint, need]]) => ({ id: `${slug}:${tier}`, board: slug, name, hint, tier, need }));

export const GAME_PINS: PinDef[] = [
  ...board('sigilfall',
    ['The Bell Tolls', 'Finish a session in Sigilfall', { rounds: 1 }],
    ['Road-Worn', 'Reach level 15 with a hero', { stat: 'level', min: 15 }],
    ['Veteran of the Vale', 'Reach level 30 with a hero', { stat: 'level', min: 30 }],
    ['Rift Closer', 'Reach level 60 with a hero', { stat: 'level', min: 60 }]),
  ...board('wait-what',
    ['Wait, What?', 'Finish a Quizbelief round', { rounds: 1 }],
    ['Know-It-Some', 'Get 7 answers right in a round', { stat: 'correct', min: 7 }],
    ['On a Tear', 'Answer 6 in a row', { stat: 'streak', min: 6 }],
    ['Unbelievable', 'Answer 15 in a row', { stat: 'streak', min: 15 }]),
  ...board('launch-control',
    ['Green Light', 'Finish a race', { rounds: 1 }],
    ['Perfect Shift', 'Land 3 perfect shifts in a race', { stat: 'perfect', min: 3 }],
    ['Ten Grand', 'Score 10,000 in a race', { score: 10000 }],
    ['Strip Legend', 'Score 16,000 in a race', { score: 16000 }]),
  ...board('letter-pinch',
    ['First Word', 'Finish a Letter Pinch', { rounds: 1 }],
    ['Closing In', 'Solve one with 2 guesses left', { stat: 'spare', min: 2 }],
    ['Two-Liner', 'Solve one in 2 guesses', { stat: 'spare', min: 4 }],
    ['Mind Reader', 'Solve one on the first guess', { stat: 'spare', min: 5 }]),
  ...board('color-recall',
    ['First Swatch', 'Finish a Color Recall', { rounds: 1 }],
    ['Good Eye', 'Score 3,600 in a round', { score: 3600 }],
    ['Chromatic Mind', 'Score 4,200 in a round', { score: 4200 }],
    ['Human Eyedropper', 'Mix 3 perfect colors in a round', { stat: 'perfects', min: 3 }]),
  ...board('crater-crew',
    ['First Crater', 'Finish a battle', { rounds: 1 }],
    ['Heavy Hitter', 'Deal 200 damage in a battle', { stat: 'damage', min: 200 }],
    ['Triple Threat', 'Knock out 3 in a battle', { stat: 'kills', min: 3 }],
    ['Scorched Earth', 'Deal 400 damage in a battle', { stat: 'damage', min: 400 }]),
  ...board('belot',
    ['At the Table', 'Finish a game of Belot', { rounds: 1 }],
    ['Club Regular', 'Finish 10 games of Belot', { rounds: 10 }],
    ['Clear Winners', 'Win by 80 points or more', { stat: 'margin', min: 80 }],
    ['Head of the Table', 'Finish 50 games of Belot', { rounds: 50 }]),
  ...board('backgammon',
    ['First Roll', 'Finish a game of Backgammon', { rounds: 1 }],
    ['Back for More', 'Finish 10 games', { rounds: 10 }],
    ['Doubled Up', 'Win a gammon', { stat: 'points', min: 2 }],
    ['The Rare One', 'Win a backgammon', { stat: 'points', min: 3 }]),
  ...board('fussbox',
    ['Fed the Box', 'Finish a Fussbox', { rounds: 1 }],
    ['Cracked It', 'Get 7 of the exam right', { stat: 'correct', min: 7 }],
    ['Box Whisperer', 'Get all 8 of the exam right', { stat: 'correct', min: 8 }],
    ['Perfect Taste', 'Score 980 in a round', { score: 980 }]),
  ...board('crosswire',
    ['First Arrow', 'Finish a Crosswire', { rounds: 1 }],
    ['Cross Reference', 'Score 1,000', { score: 1000 }],
    ['Clean Copy', 'Solve one without a single mistake', { stat: 'clean', min: 1 }],
    ['Grid Master', 'Score 1,200', { score: 1200 }]),
  ...board('to-scale',
    ['Eyeballing It', 'Finish a To Scale', { rounds: 1 }],
    ['Spot On', 'Land 2 spot-on guesses in a round', { stat: 'bullseyes', min: 2 }],
    ['Measuring Tape', 'Score 3,500 in a round', { score: 3500 }],
    ['Human Ruler', 'Score 4,400 in a round', { score: 4400 }]),
  ...board('gut-check',
    ['Hunch', 'Finish a Gut Check', { rounds: 1 }],
    ['Good Instincts', 'Get a streak of 10', { score: 10 }],
    ['Trust Your Gut', 'Get a streak of 15', { score: 15 }],
    ['The Oracle', 'Get a streak of 25', { score: 25 }]),
  ...board('color-lab',
    ['First Pour', 'Finish a Color Lab round', { rounds: 1 }],
    ['Steady Hand', 'Clear 8 puzzles in a round', { stat: 'levels', min: 8 }],
    ['Under Par', 'Beat par on 4 puzzles in a round', { stat: 'underPar', min: 4 }],
    ['Master Chemist', 'Earn 20 stars in a round', { stat: 'stars', min: 20 }]),
  ...board('memory-grid',
    ['Flash of Light', 'Finish a Memory Grid', { rounds: 1 }],
    ['Sharp Recall', 'Repeat a pattern of 8', { stat: 'longest', min: 8 }],
    ['Steel Trap', 'Repeat a pattern of 10', { stat: 'longest', min: 10 }],
    ['Photographic', 'Repeat a pattern of 13', { stat: 'longest', min: 13 }]),
  ...board('spot-the-glitch',
    ['Something’s Off', 'Finish a Spot the Glitch', { rounds: 1 }],
    ['Sharp Eyes', 'Find 20 glitches in a round', { stat: 'found', min: 20 }],
    ['Daily Inspector', 'Score 2,500 on a daily', { stat: 'daily', min: 2500 }],
    ['Clean Sweep', 'Clear 5 pictures without a wrong tap', { stat: 'clean', min: 5 }]),
  ...board('wheres-the-ball',
    ['Tennis, Anyone?', 'Finish a Where’s the Ball?', { rounds: 1 }],
    ['Ball Spotter', 'Find 8 balls in a round', { stat: 'found', min: 8 }],
    ['Eagle Eye', 'Score 4,000 in a round', { score: 4000 }],
    ['Nothing Hides', 'Find 20 balls in a round', { stat: 'found', min: 20 }]),
  ...board('wing-it',
    ['Fledgling', 'Finish a flight', { rounds: 1 }],
    ['Gap Threader', 'Pass 20 pillars in a flight', { stat: 'pillars', min: 20 }],
    ['Feather Hoarder', 'Grab 5 golden feathers in a flight', { stat: 'feathers', min: 5 }],
    ['Top of the Flock', 'Pass 60 pillars in a flight', { stat: 'pillars', min: 60 }]),
  ...board('mini-racer',
    ['Toy Driver', 'Finish a race', { rounds: 1 }],
    ['Sideways', 'Score 3,500 drift in a race', { stat: 'drift', min: 3500 }],
    ['Clean Sheet', 'Drive 3 clean laps in a race', { stat: 'cleanLaps', min: 3 }],
    ['Tiny Champion', 'Score 3,200 in a race', { score: 3200 }]),
  ...board('neon-rush',
    ['Off the Line', 'Finish a run', { rounds: 1 }],
    ['Close Shave', 'Chain 12 near misses in a run', { stat: 'nearMisses', min: 12 }],
    ['Long Haul', 'Drive 2,600 meters in a run', { stat: 'meters', min: 2600 }],
    ['Neon Ghost', 'Score 8,000 in a run', { score: 8000 }]),
  ...board('prism-pals',
    ['Pal Up', 'Clear a level', { rounds: 1 }],
    ['Gem Pocket', 'Collect 6 gems in a level', { stat: 'gems', min: 6 }],
    ['Halfway Prism', 'Clear 12 different levels', { stat: 'levels', min: 12 }],
    ['Whole Spectrum', 'Clear all 24 levels', { stat: 'levels', min: 24 }]),
];

const arcade = (id: string, name: string, hint: string, tier: PinTier, need: PinNeed): PinDef => ({ id: `${ARCADE}:${id}`, board: ARCADE, name, hint, tier, need });

export const ARCADE_PINS: PinDef[] = [
  arcade('sampler', 'Sampler', 'Play 3 different games', 'bronze', { gamesPlayed: 3 }),
  arcade('traveled', 'Well Traveled', 'Play 10 different games', 'silver', { gamesPlayed: 10 }),
  arcade('everything', 'Tried Everything', 'Play 18 different games', 'gold', { gamesPlayed: 18 }),
  arcade('warm', 'Warming Up', 'Finish 25 rounds', 'bronze', { totalRounds: 25 }),
  arcade('regular', 'Regular Customer', 'Finish 200 rounds', 'silver', { totalRounds: 200 }),
  arcade('rat', 'Arcade Rat', 'Finish 1,000 rounds', 'gold', { totalRounds: 1000 }),
  arcade('roll', 'On a Roll', 'Clear the Daily Challenge 3 days in a row', 'bronze', { streak: 3 }),
  arcade('week', 'Week Warrior', 'Clear the Daily Challenge 7 days in a row', 'silver', { streak: 7 }),
  arcade('month', 'Monthly Ritual', 'Clear the Daily Challenge 30 days in a row', 'gold', { streak: 30 }),
  arcade('hundred', 'A Hundred Mornings', 'Clear the Daily Challenge 100 days in a row', 'rift', { streak: 100 }),
  arcade('buddy', 'Better Together', 'Add a friend', 'bronze', { friends: 1 }),
  arcade('gang', 'The Whole Gang', 'Have 5 friends', 'silver', { friends: 5 }),
  arcade('level10', 'Double Digits', 'Reach level 10', 'silver', { level: 10 }),
  arcade('podium', 'On the Podium', 'Hold a top-3 score in any game', 'gold', { podium: true }),
  arcade('crown', 'Crowned', 'Hold the #1 score in any game', 'rift', { crown: true }),
];

export const ALL_PINS: PinDef[] = [...ARCADE_PINS, ...GAME_PINS];
export const PIN_BY_ID: ReadonlyMap<string, PinDef> = new Map(ALL_PINS.map((p) => [p.id, p]));

/** The games with a board, in shelf order. */
export const PIN_BOARDS: string[] = [...new Set(GAME_PINS.map((p) => p.board))];

export const pinsOf = (boardId: string): PinDef[] => ALL_PINS.filter((p) => p.board === boardId);

export interface GameFacts {
  rounds: number;
  score: number;
  /** The highest each stat has reached in any one round. */
  stats: Record<string, number>;
}

/** All a pin can ask about one player. */
export interface PinFacts {
  games: Record<string, GameFacts>;
  totalRounds: number;
  gamesPlayed: number;
  /** The longest run of cleared Daily Challenges. */
  streak: number;
  level: number;
  friends: number;
  podium: boolean;
  crown: boolean;
}

function met(p: PinDef, f: PinFacts): boolean {
  const n = p.need;
  const g = f.games[p.board];
  if ('rounds' in n) return (g?.rounds ?? 0) >= n.rounds;
  if ('score' in n) return (g?.score ?? 0) >= n.score;
  if ('stat' in n) return (g?.stats[n.stat] ?? 0) >= n.min;
  if ('totalRounds' in n) return f.totalRounds >= n.totalRounds;
  if ('gamesPlayed' in n) return f.gamesPlayed >= n.gamesPlayed;
  if ('streak' in n) return f.streak >= n.streak;
  if ('level' in n) return f.level >= n.level;
  if ('friends' in n) return f.friends >= n.friends;
  if ('podium' in n) return f.podium;
  return f.crown;
}

/** The pins these facts earn. */
export const earnedPins = (f: PinFacts): PinDef[] => ALL_PINS.filter((p) => met(p, f));

export const pinPoints = (ids: Iterable<string>): number => {
  let sum = 0;
  for (const id of ids) {
    const p = PIN_BY_ID.get(id);
    if (p) sum += TIER_POINTS[p.tier];
  }
  return sum;
};

/** The title a collection earns, shown on the shelf and to friends. */
export const SHELF_RANKS = [
  { points: 0, title: 'Visitor' },
  { points: 25, title: 'Collector' },
  { points: 100, title: 'Curator' },
  { points: 300, title: 'Archivist' },
  { points: 700, title: 'Keeper of the Cabinet' },
] as const;

export function shelfRank(points: number): { title: string; next: { points: number; title: string } | null } {
  let at = 0;
  SHELF_RANKS.forEach((r, i) => {
    if (points >= r.points) at = i;
  });
  return { title: SHELF_RANKS[at]!.title, next: SHELF_RANKS[at + 1] ?? null };
}

/** Rarity needs a crowd: below this many collectors "held by 50%" would mean one player. */
export const RARITY_MIN_PLAYERS = 20;

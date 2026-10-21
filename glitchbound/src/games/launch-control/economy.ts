/**
 * The money side: the ladder of rivals, the opponent in each head-to-head race, purses and
 * materials, wager odds, the King's Gauntlet, sponsor income while away, the daily crate and the
 * daily loaner. Pure, so the tests can check that the numbers add up.
 */
import { CARS, getCar, type CarDef } from './cars';
import { ENVS } from './cosmetics';
import { freshCondition, MATERIALS, MAX_LEVEL, type Condition, type Levels, type Material, type Mats } from './parts';
import { forecastEt, MAX_TIME, simulate, specOf, type CarSpec, type Driver } from './sim';
import { clamp, rng } from './util';

export const DIVISIONS = ['Street', 'Club', 'Pro', 'Elite', 'Legend'] as const;
export const PER_DIVISION = 8;
export const LADDER_SIZE = DIVISIONS.length * PER_DIVISION;
/** Every race is head to head: you and one opponent. */
export const RACE_SIZE = 2;

export interface Opponent {
  rank: number;
  name: string;
  car: string;
  levels: Levels;
  skill: number;
  division: number;
  boss: boolean;
  purse: number;
  blurb: string;
}

const NAMES = [
  ['Dizzy Dee', 'Grandpa Joe', 'Pixel Pete', 'Mo Mustard', 'Sunny Sal', 'Taco Tina', 'Lil Wrench', 'Street Queen Kaya'],
  ['Turbo Tom', 'Nadia Nitro', 'Big Bruno', 'Sly Sakura', 'Whiplash Will', 'Mama Torque', 'Ricky Redline', 'Club King Oz'],
  ['Hollis Hooks', 'Blaze Bianchi', 'Grip Gretchen', 'Smokey Sam', 'Velvet Vance', 'Ironside Ines', 'Deacon Drift', 'Pro Champ Maddox'],
  ['Zero Zed', 'Lady Lightning', 'Count Carbon', 'Wild Wren', 'Boost Baron', 'Sister Slick', 'Captain Clutch', 'Elite Champ Nova'],
  ['The Professor', 'Hushed Hana', 'Cannonball Cruz', 'Glass Jaw Gus', 'Nine Lives Nia', 'Doctor Dyno', 'The Ghost', 'The King'],
];
const BLURBS = [
  ['Learned to drive last Tuesday.', 'Has been racing since before you were born.', 'Shifts by feel. Mostly the wrong feel.', 'Brought a sandwich.', 'Never stops smiling.', 'Runs a food truck on weekdays.', 'Fixes everything with one wrench.', 'Rules the street division with a tiny hatch.'],
  ['Turbo in everything. Even the lawnmower.', 'Says the car has nitrous. It does not.', 'The car is small. He is not.', 'Quiet, polite, brutal off the line.', 'Famous for launching too hard.', 'Taught half this division to drive.', 'Shifts at the redline, every time.', 'Owns the club. Owns the strip. Bets the car on it.'],
  ['Catches every launch.', 'Italian, loud, fast.', 'Tyres are her whole personality.', 'Burns rubber before every run. Loses tyres.', 'Smooth as a velvet glove.', 'Her rally hatch has no business being this quick.', 'Drifted in from the circuit scene.', 'Three-time pro champion.'],
  ['Reaction time close to zero.', 'Strikes once, never twice.', 'Carbon fibre everything.', 'Unpredictable launch, unbeatable top end.', 'Boost pressure to the moon.', 'Every shift is perfect.', 'Dumps the clutch like it owes him money.', 'Elite champion. Spotless record.'],
  ['Calculates the ideal launch in his head.', 'Says nothing. Wins everything.', 'Flat out, every time, no fear.', 'One tap from the perfect run. Or from a blow-up.', 'Crashed nine times. Still here.', 'Built the car. Built the engine. Built the engine builder.', 'Nobody has seen the car up close.', 'The last name on the ladder.'],
];
/** Each division's cars; its boss (the last) drives a car from the next tier up, and the first win over a boss wins it (pink slips). */
const DIV_CARS: string[][] = [
  ['bumble', 'pico-pop', 'cabbie', 'rustler', 'dune-bug', 'longroof', 'pico-pop', 'vossberg-gti'],
  ['griffon', 'kestrel', 'astro', 'vossberg-gti', 'breadbox', 'interceptor', 'kestrel', 'tsubasa'],
  ['night-patrol', 'sakura', 'bayou-boss', 'stallion', 'tsubasa', 'sakura', 'tsubasa', 'monarch'],
  ['falkon', 'monarch', 'vortex', 'redline', 'ironhide', 'vortex', 'redline', 'elektra'],
  ['elektra', 'hellion', 'elektra', 'hellion', 'stallone-812', 'hellion', 'stallone-812', 'toro'],
];

/** Base tuning of each division's boss (its car is from the next tier). */
const BOSS_LEVEL = [0.4, 1.0, 1.8, 3.2, 4.4];

export function purseAt(rank: number, boss: boolean): number {
  return Math.round((100 * Math.pow(1.25, rank - 1) * (boss ? 2 : 1)) / 10) * 10;
}

function build(): Opponent[] {
  const out: Opponent[] = [];
  const r = rng(0x1c0ffee);
  for (let d = 0; d < DIVISIONS.length; d++) {
    for (let i = 0; i < PER_DIVISION; i++) {
      const rank = d * PER_DIVISION + i + 1;
      const boss = i === PER_DIVISION - 1;
      // The first two rungs drive stock cars, so a fresh starter can beat them; tuning ramps from there.
      // A boss's car is a tier up, so it carries far less tuning (BOSS_LEVEL keeps it just quicker than you).
      const lo = boss ? BOSS_LEVEL[d]! : d * 1.4 + i * 0.25 - (d === 0 ? 0.6 : 0);
      const lvl = (): number => clamp(Math.round(lo + r() * 1.2), 0, MAX_LEVEL);
      out.push({
        rank,
        name: NAMES[d]![i]!,
        car: DIV_CARS[d]![i]!,
        levels: { engine: lvl(), transmission: lvl(), suspension: lvl(), tyres: lvl(), aero: lvl(), looks: lvl() },
        skill: clamp(0.2 + d * 0.15 + i * 0.02 + (boss ? 0.08 : 0), 0, 0.97),
        division: d,
        boss,
        purse: purseAt(rank, boss),
        blurb: BLURBS[d]![i]!,
      });
    }
  }
  return out;
}

export const LADDER: readonly Opponent[] = build();

/** Pink slips: each boss's car, won outright the first time you beat that boss. */
export const PINK_SLIP: Readonly<Record<string, Opponent>> = Object.fromEntries(LADDER.filter((o) => o.boss).map((o) => [o.car, o]));
/** A pink slip for a car you already own is sold on: a fifth of its price. */
export const pinkSlipCash = (def: CarDef): number => Math.round((def.price * 0.2) / 10) * 10;

/**
 * The car a rival brings against yours: their own, unless it is the car you are driving (a race
 * against your twin is no race), then the one from their division's garage nearest it in price (so
 * in pace). A boss always brings their own: it is the pink slip.
 */
export function rivalCarId(o: Opponent, mine?: string): string {
  if (o.car !== mine || o.boss) return o.car;
  const pool = DIV_CARS[o.division]!.slice(0, PER_DIVISION - 1).filter((id) => id !== mine);
  const price = getCar(o.car).price;
  let best = o.car;
  let gap = Infinity;
  for (const id of pool) {
    const g = Math.abs(getCar(id).price - price);
    if (g < gap) {
      gap = g;
      best = id;
    }
  }
  return best;
}

export const opponentSpec = (o: Opponent, mine?: string): CarSpec => specOf(getCar(rivalCarId(o, mine)), o.levels, freshCondition(), false);

/** Difficulty sticker for a rival next to your car's forecast. */
export function difficultyOf(gap: number): { label: string; tone: string } {
  if (gap > 0.6) return { label: 'Easy', tone: 'lime' };
  if (gap > 0.15) return { label: 'Fair', tone: 'cyan' };
  if (gap > -0.2) return { label: 'Hard', tone: 'yellow' };
  if (gap > -0.7) return { label: 'Very hard', tone: 'orange' };
  return { label: 'Extreme', tone: 'coral' };
}

// ---- bots: the other cars on the strip
export interface Bot {
  name: string;
  car: CarDef;
  levels: Levels;
  /** Parts condition: a tired car is how a faster model is slowed to your pace. */
  cond: Condition;
  skill: number;
  /** The named ladder rival, when this bot is one. */
  rival?: Opponent;
}

const BOT_NAMES = ['Blitz Bea', 'Kofi Kickdown', 'Nova Nine', 'Old Man Ron', 'Jinx Jules', 'Marisol Mach', 'Patch', 'Sprocket Sam', 'Luna Launch', 'Hank the Tank', 'Zippy Zoe', 'Boris Boost', 'Ines Inferno', 'Dash Dalton', 'Quiet Quinn', 'Rev Ramona', 'Chip Chen', 'Vee Vortex', 'Mika Misfire', 'Dusty Dale'];

/** A ladder rival as a bot (fresh car, its own tuning and skill). */
export const rivalBot = (o: Opponent, mine?: string): Bot => ({ name: o.name, car: getCar(rivalCarId(o, mine)), levels: o.levels, cond: freshCondition(), skill: o.skill, rival: o });

/** The average part level of a car. */
export const avgLevel = (l: Levels): number => (l.engine + l.transmission + l.suspension + l.tyres + l.aero + l.looks) / 6;

/** A driver's typical ET: the mean of three seeded runs (one run can hide a lucky or botched launch). */
export const typicalEt = (spec: CarSpec, skill: number): number => (forecastEt(spec, skill, 3) + forecastEt(spec, skill, 11) + forecastEt(spec, skill, 19)) / 3;

/**
 * Bots with cars like yours: a tier within one of your car's, part levels around your average,
 * and a forecast within about a second of yours (re-rolled a few times when it is not).
 */
export function botsFor(me: CarSpec, count: number, seed: number, rival?: Opponent): Bot[] {
  // Bots are built so that a perfectly driven run of theirs lands just behind a perfect run of
  // yours; their driver's skill (0.35..0.8) then only makes them slower. You win with clean shifts;
  // miss a couple and they catch you.
  // The first rungs of the ladder are gentler, so a new player wins a race or two while learning.
  const ease = rival ? Math.max(0, 0.6 - (rival.rank - 1) * 0.12) : 0.12;
  const r = rng(seed);
  return fieldFor(me, count, seed, forecastEt(me, 1, 3) + 0.08 + ease, () => clamp(0.35 + r() * 0.45 - ease * 0.4, 0, 1), rival);
}

/** Bots in cars like yours whose perfect run lands near `target` seconds, each with a skill from `skill()`. */
function fieldFor(me: CarSpec, count: number, seed: number, target: number, skill: () => number, rival?: Opponent): Bot[] {
  const r = rng(seed ^ 0x51ed27);
  const myTier = me.def.tier;
  const myLevel = avgLevel(me.levels);
  const names = [...BOT_NAMES].sort(() => r() - 0.5);
  const bots: Bot[] = [];
  if (rival) bots.push(rivalBot(rival, me.def.id));
  const levelsAt = (base: number, jitter: number): Levels => {
    const lv = (): number => clamp(Math.round(base + (r() * 2 - 1) * jitter), 0, MAX_LEVEL);
    return { engine: lv(), transmission: lv(), suspension: lv(), tyres: lv(), aero: lv(), looks: lv() };
  };
  const tired = (wear: number): Condition => ({ engine: 100 - wear, transmission: 100 - wear, suspension: 100 - wear, tyres: 100 - wear, aero: 100 - wear, looks: 100 });
  const best = (c: CarDef, levels: Levels, cond = freshCondition()): number => forecastEt(specOf(c, levels, cond, false), 1, 3);
  const flat = levelsAt(myLevel, 0);
  // Cars near yours in pace at your level of tuning: the seven closest, picked from at random.
  // never your own car (a race against your twin is no race), never the last car on the roster
  const pool = CARS.filter((c) => Math.abs(c.tier - myTier) <= 1 && c.id !== 'rail' && c.id !== me.def.id)
    .map((c) => ({ c, et: best(c, flat) }))
    .sort((a, b) => Math.abs(a.et - target) - Math.abs(b.et - target))
    .slice(0, 7);
  while (bots.length < count) {
    let pick: Bot | null = null;
    let bestGap = Infinity;
    for (let tries = 0; tries < 8; tries++) {
      const cand = pool[Math.floor(r() * pool.length)]!;
      // A quicker car gets less tuning, a slower one more, so the field stays close.
      let base = myLevel + clamp((cand.et - target) * 2, -4, 4);
      let levels = levelsAt(base, 1.2);
      let et = best(cand.c, levels);
      for (let k = 0; k < 3 && Math.abs(et - target) > 0.2; k++) {
        base += et < target ? -1 : 1;
        levels = levelsAt(base, 1.2);
        et = best(cand.c, levels);
      }
      // Still too quick with stock parts: the car is tired instead.
      let cond = freshCondition();
      for (let wear = 20; wear <= 95 && et < target - 0.2; wear += 25) {
        cond = tired(wear);
        et = best(cand.c, levels, cond);
      }
      // Too quick even tired: only as a last resort.
      const gap = Math.abs(et - target) + (et < target - 0.3 ? 5 : 0);
      if (gap < bestGap) {
        bestGap = gap;
        pick = { name: names[0] ?? `Racer ${bots.length}`, car: cand.c, levels, cond, skill: 0 };
      }
      if (gap < 0.2) break;
    }
    names.shift();
    bots.push({ ...pick!, skill: skill() });
  }
  return bots.slice(0, count);
}

// ---- the King's Gauntlet: back-to-back races against opponents that get quicker every round
/** Beat the Street division (its final) and the gauntlet opens. */
export const GAUNTLET_UNLOCK = PER_DIVISION;

/**
 * The opponent for a gauntlet round (1, 2, ...): a car like yours whose perfect run starts a little
 * behind your perfect run and gains about 0.08 s a round, so by round 6 or 7 they are as quick as you
 * at your best, and after that quicker. Their driving improves too.
 */
export function gauntletRival(me: CarSpec, round: number, seed: number): Bot {
  const gap = 0.42 - (round - 1) * 0.08;
  const skill = clamp(0.5 + round * 0.045, 0, 0.98);
  return fieldFor(me, 1, seed ^ (round * 7919), forecastEt(me, 1, 3) + gap, () => skill)[0]!;
}

/** What a gauntlet win pays: a purse that grows every round, and materials every third win. */
export function gauntletPrize(round: number, rank: number, seed: number): { cash: number; mats: Mats } {
  const cash = Math.round((purseAt(Math.max(1, Math.min(rank, LADDER_SIZE)), false) * (0.6 + 0.15 * round)) / 10) * 10;
  const o = LADDER[clamp(rank - 1, 0, LADDER_SIZE - 1)]!;
  return { cash, mats: round % 3 === 0 ? materialsFor(o, false, seed) : {} };
}

export const botSpec = (b: Bot): CarSpec => specOf(b.car, b.levels, b.cond, false);

/** A win's materials: more in higher divisions, double the first time. */
export function materialsFor(o: Opponent, firstWin: boolean, seed: number): Mats {
  const r = rng(seed);
  const d = o.division;
  const m: Mats = { parts: 3 + d * 8 + Math.floor(r() * (3 + d * 2)) };
  if (r() < 0.5 + d * 0.1) m.rubber = 1 + Math.floor(r() * (d + 2));
  if (firstWin) for (const k of MATERIALS) if (m[k]) m[k] = m[k]! * 2;
  if (o.boss) for (const k of MATERIALS) if (m[k]) m[k] = m[k]! + 2;
  return m;
}

export const addMats = (a: Record<Material, number>, b: Mats, sign = 1): Record<Material, number> => {
  const out = { ...a };
  for (const k of MATERIALS) out[k] = Math.max(0, out[k] + sign * (b[k] ?? 0));
  return out;
};
export const hasMats = (have: Record<Material, number>, need: Mats): boolean => MATERIALS.every((k) => have[k] >= (need[k] ?? 0));
export const emptyMats = (): Record<Material, number> => ({ parts: 0, rubber: 0 });

// ---- wagers and purses
/** Where the player's forecast assumes they drive: a decent, not perfect, driver. */
export const PLAYER_SKILL = 0.75;
/** A policy driver's typical reaction time at a skill (sim.ts plans it the same way). */
export const typicalReaction = (skill: number): number => 0.17 + (1 - skill) * 0.4 + 0.025 + 0.075 * (1 - skill);

export interface Forecast {
  myEt: number;
  /** Each bot's forecast ET, in bot order. */
  etList: number[];
  /** Chance the player finishes first, 0..1. */
  pWin: number;
  /** Payout multiplier on a win (stake × mult comes back). */
  mult: number;
}

/** Odds of finishing first: the race is run a dozen times with you as a good driver and the field as it is. */
export function forecast(me: CarSpec, bots: Bot[]): Forecast {
  const myEt = forecastEt(me, PLAYER_SKILL, 7);
  const specs = [{ ...me, risky: [] }, ...bots.map(botSpec)];
  const etSum = bots.map(() => 0);
  const RUNS = 12;
  let wins = 0;
  for (let k = 0; k < RUNS; k++) {
    const seed = 1000 + k * 7919;
    const drivers: Driver[] = [{ kind: 'policy', skill: PLAYER_SKILL, seed }, ...bots.map((b, i) => ({ kind: 'policy' as const, skill: b.skill, seed: seed ^ (i + 1) * 104729 }))];
    const r = simulate(specs, drivers, seed);
    if (r.winner === 0) wins++;
    r.racers.slice(1).forEach((x, i) => (etSum[i]! += x.et ?? MAX_TIME));
  }
  const pWin = clamp((wins + 0.5) / (RUNS + 1), 0.03, 0.97);
  const mult = clamp(Math.round((0.92 / pWin) * 10) / 10, 1.1, 12);
  return { myEt, etList: etSum.map((x) => x / RUNS), pWin, mult };
}

/** Stake buttons: nothing, a tenth, a quarter, half, everything. */
export const STAKE_SHARES = [0, 0.1, 0.25, 0.5, 1] as const;

/** Share of the purse by finishing position: the winner takes it, the runner-up a consolation. */
export const PURSE_SHARE = [1, 0.3] as const;

/** Cash after a race: the purse by position (fans add to it), the wager (first place only), the first-win bonus. */
export function settle(input: { position: number; purse: number; fansMul: number; stake: number; mult: number; firstWin: boolean }): { purse: number; wager: number; bonus: number } {
  const share = PURSE_SHARE[clamp(input.position - 1, 0, PURSE_SHARE.length - 1)]!;
  const won = input.position === 1;
  const purse = Math.round(input.purse * share * (won ? input.fansMul : 1));
  const wager = won ? Math.round(input.stake * (input.mult - 1)) : -input.stake;
  const bonus = won && input.firstWin ? input.purse * 2 : 0;
  return { purse, wager, bonus };
}

// ---- sponsor income while away and the daily crate
export const IDLE_CAP_H = 8;
export const idleRate = (rank: number, sponsorMul = 1): number => Math.round(20 * Math.pow(1.18, clamp(rank, 0, LADDER_SIZE)) * sponsorMul);
export function idleIncome(rank: number, awayMs: number, sponsorMul = 1): number {
  const h = clamp(awayMs / 3600_000, 0, IDLE_CAP_H);
  return Math.floor(idleRate(rank, sponsorMul) * h);
}

/** One free crate a day: cash and a handful of materials that grow with your rank. */
export function crateFor(rank: number, seed: number): { cash: number; mats: Mats } {
  const r = rng(seed);
  const d = Math.floor(clamp(rank, 0, LADDER_SIZE - 1) / PER_DIVISION);
  const mats: Mats = { parts: 3 + d * 6 + Math.floor(r() * (3 + d * 2)), rubber: 1 + Math.floor(r() * 3) };
  return { cash: Math.round(purseAt(rank + 1, false) * 1.5), mats };
}

// ---- the daily and challenge loaners
export interface Loaner {
  car: CarDef;
  levels: Levels;
  bots: Bot[];
  env: string;
}

/** The same loaner and the same opponent for everyone with the same seed: a fair showdown. */
export function loanerFor(seed: number): Loaner {
  const r = rng(seed);
  // nitrous is for cars you own: the showdown stays one button, tapped
  const pool = CARS.filter((c) => c.tier <= 5 && c.trait !== 'nitro');
  const car = pool[Math.floor(r() * pool.length)]!;
  const base = Math.floor(r() * 5);
  const lvl = (): number => clamp(Math.round(base + r() * 3), 0, MAX_LEVEL);
  const levels: Levels = { engine: lvl(), transmission: lvl(), suspension: lvl(), tyres: lvl(), aero: lvl(), looks: lvl() };
  const me = specOf(car, levels, freshCondition(), false);
  const bots = botsFor(me, RACE_SIZE - 1, seed ^ 0x9e3779b9);
  return { car, levels, bots, env: ENVS[Math.floor(r() * ENVS.length)]!.id };
}

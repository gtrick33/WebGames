/**
 * The money side: the ladder of opponents, purses and materials, wager odds, sponsor income while
 * away, and the daily loaner. Pure, so the tests can check that the numbers add up.
 */
import { CARS, getCar, type CarDef } from './cars';
import { ENVS } from './cosmetics';
import { freshCondition, MATERIALS, type Levels, type Material, type Mats } from './parts';
import { forecastEt, specOf, type CarSpec } from './sim';
import { clamp, rng } from './util';

export const DIVISIONS = ['Street', 'Club', 'Pro', 'Elite', 'Legend'] as const;
export const PER_DIVISION = 8;
export const LADDER_SIZE = DIVISIONS.length * PER_DIVISION;

export interface Opponent {
  rank: number;
  name: string;
  car: string;
  levels: Levels;
  skill: number;
  division: number;
  /** Division champion: double purse. */
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
  ['Turbo in everything. Even the lawnmower.', 'Says the car has nitrous. It does not.', 'The car is small. He is not.', 'Quiet, polite, brutal off the line.', 'Famous for launching too hard.', 'Taught half this division to drive.', 'Shifts at the redline, every time.', 'Owns the club. Owns the strip. For now.'],
  ['Catches every launch.', 'Italian, loud, fast.', 'Tyres are her whole personality.', 'Burns rubber before every run. Loses tyres.', 'Smooth as a velvet glove.', 'Her wagon has no business being this quick.', 'Drifted in from the circuit scene.', 'Three-time pro champion.'],
  ['Reaction time close to zero.', 'Strikes once, never twice.', 'Carbon fibre everything.', 'Unpredictable launch, unbeatable top end.', 'Boost pressure to the moon.', 'Every shift is perfect.', 'Dumps the clutch like it owes him money.', 'Elite champion. Spotless record.'],
  ['Calculates the ideal launch in his head.', 'Says nothing. Wins everything.', 'Flat out, every time, no fear.', 'One tap from the perfect run. Or from a blow-up.', 'Crashed nine times. Still here.', 'Built the car. Built the engine. Built the engine builder.', 'Nobody has seen the car up close.', 'The last name on the ladder.'],
];
/** Cars by division, cycling. */
const DIV_CARS: string[][] = [
  ['bumble', 'bumble', 'pico-pop', 'rustler', 'dune-bug', 'longroof', 'kestrel', 'pico-pop'],
  ['vossberg-gti', 'lazzaro', 'bayou-boss', 'sakura', 'stallion', 'brickhouse', 'kurogane-gt', 'tsubasa'],
  ['rotary-rebel', 'gullwing', 'sakura', 'comet-ss', 'panther', 'brickhouse', 'ironhide', 'comet-ss'],
  ['falkon', 'ragazzo', 'monarch', 'widowmaker', 'vortex', 'wraith', 'hellion', 'falkon'],
  ['elektra', 'stallone-812', 'toro', 'valkyr', 'veyr', 'hellion', 'nitro-funny', 'rail'],
];

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
      const lo = d * 1.6 + i * 0.25;
      const lvl = (): number => clamp(Math.round(lo + r() * 1.2), 0, 8);
      out.push({
        rank,
        name: NAMES[d]![i]!,
        car: DIV_CARS[d]![i]!,
        levels: { engine: lvl(), transmission: lvl(), suspension: lvl(), tyres: lvl(), aero: lvl(), looks: lvl() },
        skill: clamp(0.2 + d * 0.17 + i * 0.02 + (boss ? 0.08 : 0), 0, 1),
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

export const opponentSpec = (o: Opponent): CarSpec => specOf(getCar(o.car), o.levels, freshCondition(), false);

/** A win's materials: more in higher divisions, double the first time. */
export function materialsFor(o: Opponent, firstWin: boolean, seed: number): Mats {
  const r = rng(seed);
  const d = o.division;
  const m: Mats = { scrap: 2 + d * 2 + Math.floor(r() * 3) };
  if (d >= 1) m.alloy = 1 + d + Math.floor(r() * 2);
  if (d >= 2) m.carbon = d - 1 + Math.floor(r() * 2);
  if (d >= 3) m.chips = d - 2 + Math.floor(r() * 2);
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
export const emptyMats = (): Record<Material, number> => ({ scrap: 0, alloy: 0, carbon: 0, chips: 0, rubber: 0 });

// ---- wagers
/** Where the player's forecast assumes they drive: a decent, not perfect, driver. */
export const PLAYER_SKILL = 0.75;

export interface Forecast {
  myEt: number;
  oppEt: number;
  /** Chance the player wins, 0..1. */
  pWin: number;
  /** Payout multiplier on a win (stake × mult comes back). */
  mult: number;
}

/** A policy driver's typical reaction time at a skill (sim.ts plans it the same way). */
export const typicalReaction = (skill: number): number => 0.1 + (1 - skill) * 0.4 + 0.025 + 0.075 * (1 - skill);

export function forecast(me: CarSpec, opp: CarSpec, oppSkill: number): Forecast {
  const myEt = forecastEt(me, PLAYER_SKILL, 7);
  const oppEt = forecastEt(opp, oppSkill, 7);
  // Who crosses first: ET plus reaction. Luck on the tree blurs the difference by ~0.3 s.
  const gap = myEt + typicalReaction(PLAYER_SKILL) - (oppEt + typicalReaction(oppSkill));
  const pWin = clamp(1 / (1 + Math.exp(gap / 0.3)), 0.03, 0.97);
  const mult = clamp(Math.round((0.92 / pWin) * 10) / 10, 1.1, 8);
  return { myEt, oppEt, pWin, mult };
}

/** Stake buttons: nothing, a tenth, a quarter, half, everything. */
export const STAKE_SHARES = [0, 0.1, 0.25, 0.5, 1] as const;

/** Cash after a race: the purse (fans add to it; a loser gets show money) and the wager. */
export function settle(input: { won: boolean; purse: number; fansMul: number; stake: number; mult: number; firstWin: boolean }): { purse: number; wager: number; bonus: number } {
  const purse = input.won ? Math.round(input.purse * input.fansMul) : Math.round(input.purse * 0.1);
  const wager = input.won ? Math.round(input.stake * (input.mult - 1)) : -input.stake;
  const bonus = input.won && input.firstWin ? input.purse * 2 : 0;
  return { purse, wager, bonus };
}

// ---- sponsor income while away
export const IDLE_CAP_H = 8;
/** Cash per hour from your sponsor at a ladder rank (opponents beaten). */
export const idleRate = (rank: number): number => Math.round(20 * Math.pow(1.18, clamp(rank, 0, LADDER_SIZE)));
export function idleIncome(rank: number, awayMs: number): number {
  const h = clamp(awayMs / 3600_000, 0, IDLE_CAP_H);
  return Math.floor(idleRate(rank) * h);
}

// ---- the daily and challenge loaners
export interface Loaner {
  car: CarDef;
  levels: Levels;
  opponent: { name: string; car: CarDef; levels: Levels; skill: number };
  env: string;
}

/** The same loaner and opponent for everyone with the same seed: a fair showdown. */
export function loanerFor(seed: number): Loaner {
  const r = rng(seed);
  const pool = CARS.filter((c) => c.tier <= 5);
  const car = pool[Math.floor(r() * pool.length)]!;
  const lvl = (base: number): number => clamp(Math.round(base + r() * 3), 0, 8);
  const base = Math.floor(r() * 5);
  const levels: Levels = { engine: lvl(base), transmission: lvl(base), suspension: lvl(base), tyres: lvl(base), aero: lvl(base), looks: lvl(base) };
  const near = CARS.filter((c) => Math.abs(c.tier - car.tier) <= 1 && c.id !== car.id);
  const oc = near[Math.floor(r() * near.length)]!;
  const olevels: Levels = { engine: lvl(base), transmission: lvl(base), suspension: lvl(base), tyres: lvl(base), aero: lvl(base), looks: lvl(base) };
  const names = ['Daily Dan', 'Showdown Sue', 'Mystery Mo', 'The Challenger', 'Rival Rae', 'Ghost Gil', 'Quick Quinn'];
  return { car, levels, opponent: { name: names[Math.floor(r() * names.length)]!, car: oc, levels: olevels, skill: 0.55 + r() * 0.35 }, env: ENVS[Math.floor(r() * ENVS.length)]!.id };
}

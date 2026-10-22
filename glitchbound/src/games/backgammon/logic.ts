/**
 * Backgammon: the rules, pure (no React, no DOM, no Math.random). The same code runs the board on
 * screen, the computer players and the live room server.
 *
 * Points 1-24 in one shared numbering. Player 0 (the bottom player, light checkers) moves 24 → 1 and
 * bears off below 1; player 1 (dark) moves 1 → 24 and bears off above 24. `pts[i]` is positive for
 * player 0's checkers on point i and negative for player 1's. A step's `from` is the bar when it is
 * 25 (player 0) or 0 (player 1); its `to` is off the board when it is 0 (player 0) or 25 (player 1).
 */

export type Side = 0 | 1;

export interface Pos {
  /** Index 1-24 used: + player 0's checkers, − player 1's. */
  pts: number[];
  bar: [number, number];
  off: [number, number];
}

export interface Step {
  from: number;
  to: number;
  die: number;
  /** The step hit an opposing blot. */
  hit?: boolean;
}

export const CHECKERS = 15;
export const BAR: [number, number] = [25, 0];
export const OFF: [number, number] = [0, 25];

export function startPos(): Pos {
  const pts = Array<number>(25).fill(0);
  pts[24] = 2;
  pts[13] = 5;
  pts[8] = 3;
  pts[6] = 5;
  pts[1] = -2;
  pts[12] = -5;
  pts[17] = -3;
  pts[19] = -5;
  return { pts, bar: [0, 0], off: [0, 0] };
}

export const copyPos = (p: Pos): Pos => ({ pts: [...p.pts], bar: [p.bar[0], p.bar[1]], off: [p.off[0], p.off[1]] });
export const posKey = (p: Pos): string => `${p.pts.join(',')}|${p.bar.join(',')}|${p.off.join(',')}`;

/** Player `s`'s checkers on point i. */
export const mine = (p: Pos, s: Side, i: number): number => (i < 1 || i > 24 ? 0 : s === 0 ? Math.max(0, p.pts[i]!) : Math.max(0, -p.pts[i]!));
export const theirs = (p: Pos, s: Side, i: number): number => mine(p, (1 - s) as Side, i);
const dir = (s: Side): number => (s === 0 ? -1 : 1);
/** Where a checker of `s` lands moving `d` from `from` (off-board values mean bearing off). */
export const target = (s: Side, from: number, d: number): number => from + dir(s) * d;
const isOff = (s: Side, to: number): boolean => (s === 0 ? to <= 0 : to >= 25);
const homeRange = (s: Side): [number, number] => (s === 0 ? [1, 6] : [19, 24]);

/** Everything home (and nothing on the bar): bearing off is allowed. */
export function allHome(p: Pos, s: Side): boolean {
  if (p.bar[s] > 0) return false;
  for (let i = 1; i <= 24; i++) {
    if (mine(p, s, i) && (i < homeRange(s)[0] || i > homeRange(s)[1])) return false;
  }
  return true;
}

/** Pips still to travel (the race count). */
export function pips(p: Pos, s: Side): number {
  let n = p.bar[s] * 25;
  for (let i = 1; i <= 24; i++) n += mine(p, s, i) * (s === 0 ? i : 25 - i);
  return n;
}

/** The single steps `s` could make with one die (bar first; bearing off by the rules). */
export function stepsFor(p: Pos, s: Side, d: number): Step[] {
  const out: Step[] = [];
  const land = (to: number): boolean => to >= 1 && to <= 24 && theirs(p, s, to) <= 1;
  if (p.bar[s] > 0) {
    const to = target(s, BAR[s], d);
    if (land(to)) out.push({ from: BAR[s], to, die: d, hit: theirs(p, s, to) === 1 });
    return out;
  }
  const home = allHome(p, s);
  for (let f = 1; f <= 24; f++) {
    if (!mine(p, s, f)) continue;
    const to = target(s, f, d);
    if (!isOff(s, to)) {
      if (land(to)) out.push({ from: f, to, die: d, hit: theirs(p, s, to) === 1 });
      continue;
    }
    if (!home) continue;
    const exact = s === 0 ? to === 0 : to === 25;
    // a higher number bears off from the highest point held, only
    let higherHeld = false;
    if (!exact) for (let g = s === 0 ? f + 1 : f - 1; s === 0 ? g <= 6 : g >= 19; g += s === 0 ? 1 : -1) if (mine(p, s, g)) higherHeld = true;
    if (exact || !higherHeld) out.push({ from: f, to: OFF[s], die: d });
  }
  return out;
}

export function applyStep(p: Pos, s: Side, st: Step): Pos {
  const n = copyPos(p);
  const sign = s === 0 ? 1 : -1;
  if (st.from === BAR[s]) n.bar[s]--;
  else n.pts[st.from]! -= sign;
  if (st.to === OFF[s]) n.off[s]++;
  else {
    if (theirs(n, s, st.to) === 1) {
      n.pts[st.to] = 0;
      n.bar[(1 - s) as Side]++;
    }
    n.pts[st.to]! += sign;
  }
  return n;
}

/** The dice a roll gives: two numbers, or four of a double. */
export const diceOf = (a: number, b: number): number[] => (a === b ? [a, a, a, a] : [a, b]);

const uniq = (dice: readonly number[]): number[] => [...new Set(dice)];
const without = (dice: readonly number[], d: number): number[] => {
  const i = dice.indexOf(d);
  return i < 0 ? [...dice] : [...dice.slice(0, i), ...dice.slice(i + 1)];
};

/** The most dice that can be used from here (the rules demand the most). */
export function maxDice(p: Pos, s: Side, dice: readonly number[], memo = new Map<string, number>()): number {
  if (!dice.length) return 0;
  const key = `${posKey(p)}#${[...dice].sort().join('')}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let best = 0;
  for (const d of uniq(dice)) {
    for (const st of stepsFor(p, s, d)) {
      best = Math.max(best, 1 + maxDice(applyStep(p, s, st), s, without(dice, d), memo));
      if (best === dice.length) break;
    }
    if (best === dice.length) break;
  }
  memo.set(key, best);
  return best;
}

/**
 * The single steps that may be made now with the dice left: each must keep the most dice usable, and
 * with two different numbers of which only one can be played, the larger one must be.
 */
export function legalSteps(p: Pos, s: Side, dice: readonly number[]): Step[] {
  const memo = new Map<string, number>();
  const most = maxDice(p, s, dice, memo);
  if (most === 0) return [];
  const out: Step[] = [];
  for (const d of uniq(dice)) for (const st of stepsFor(p, s, d)) if (1 + maxDice(applyStep(p, s, st), s, without(dice, d), memo) === most) out.push(st);
  if (most === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(dice[0]!, dice[1]!);
    if (out.some((st) => st.die === big)) return out.filter((st) => st.die === big);
  }
  return out;
}

/**
 * Every whole play of a roll (sequences of steps), one per resulting position: as many dice as can
 * be used, and the larger die when only one of two different numbers can be.
 */
export function allPlays(p: Pos, s: Side, dice: readonly number[]): { steps: Step[]; pos: Pos }[] {
  const out = new Map<string, { steps: Step[]; pos: Pos }>();
  const seen = new Set<string>();
  let best = 0;
  const walk = (q: Pos, left: readonly number[], steps: Step[]): void => {
    // the same position with the same dice left is reached by many orders: walk it once
    const k = `${posKey(q)}#${[...left].sort().join('')}`;
    if (seen.has(k)) return;
    seen.add(k);
    let moved = false;
    for (const d of uniq(left))
      for (const st of stepsFor(q, s, d)) {
        moved = true;
        walk(applyStep(q, s, st), without(left, d), [...steps, st]);
      }
    if (moved) return;
    if (steps.length > best) {
      best = steps.length;
      out.clear();
    }
    if (steps.length === best && !out.has(posKey(q))) out.set(posKey(q), { steps, pos: q });
  };
  walk(p, dice, []);
  // only one of two different numbers can be played: the larger one, when it can (rebuilt from that die,
  // since a play with the smaller one may have stood in for the same position)
  if (best === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(dice[0]!, dice[1]!);
    const withBig = stepsFor(p, s, big);
    if (withBig.length) {
      const plays = new Map<string, { steps: Step[]; pos: Pos }>();
      for (const st of withBig) {
        const q = applyStep(p, s, st);
        if (!plays.has(posKey(q))) plays.set(posKey(q), { steps: [st], pos: q });
      }
      return [...plays.values()];
    }
  }
  return [...out.values()];
}

// ---------------------------------------------------------------- dice

/** mulberry32: a tiny deterministic RNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roll number `n` of a game seeded `seed`: two dice, the same for everyone with that seed. */
export function rollAt(seed: number, n: number): [number, number] {
  const r = rng((Math.imul(seed ^ 0x51ed270b, 0x2c1b3c6d) + Math.imul(n + 1, 0x9e3779b9)) >>> 0);
  return [1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6)];
}

// ---------------------------------------------------------------- a game

export type Phase = 'opening' | 'roll' | 'move' | 'over';

export interface Game {
  seed: number;
  pos: Pos;
  /** The position when the turn's roll came (Undo goes back to it). */
  turnStart: Pos;
  turn: Side;
  phase: Phase;
  /** The roll on show (the opening's two single dice, then each turn's pair). */
  roll: [number, number] | null;
  /** Dice still to play this turn. */
  left: number[];
  /** Steps made this turn. */
  steps: Step[];
  /** Rolls used so far (for seeded dice). */
  rolls: number;
  winner: Side | null;
  /** Points the game is worth: 1, 2 (gammon) or 3 (backgammon). */
  points: 0 | 1 | 2 | 3;
  /** The last finished turn (for the other screen to replay it). */
  lastTurn: { side: Side; roll: [number, number]; steps: Step[] } | null;
}

export function newGame(seed: number): Game {
  return { seed, pos: startPos(), turnStart: startPos(), turn: 0, phase: 'opening', roll: null, left: [], steps: [], rolls: 0, winner: null, points: 0, lastTurn: null };
}

/**
 * Rolls: the opening (one die each until they differ; the higher side plays both numbers), or the
 * side to move's two dice. A roll that cannot be played at all passes the turn at once.
 */
export function roll(g: Game): Game {
  if (g.phase === 'opening') {
    let n = g.rolls;
    let [a, b] = rollAt(g.seed, n++);
    while (a === b) [a, b] = rollAt(g.seed, n++);
    const turn: Side = a > b ? 0 : 1;
    return startTurn({ ...g, rolls: n, turn }, [a, b]);
  }
  if (g.phase !== 'roll') return g;
  const r = rollAt(g.seed, g.rolls);
  return startTurn({ ...g, rolls: g.rolls + 1 }, r);
}

function startTurn(g: Game, r: [number, number]): Game {
  const left = diceOf(r[0], r[1]);
  const n: Game = { ...g, roll: r, left, steps: [], turnStart: g.pos, phase: 'move' };
  return n;
}

/** The steps the side to move may make now. */
export const nextSteps = (g: Game): Step[] => (g.phase === 'move' ? legalSteps(g.pos, g.turn, g.left) : []);

/** Where one checker can go now, and the steps there: one die, or on with the next (both numbers, a double's four). */
export interface Route {
  to: number;
  steps: Step[];
}

/**
 * Every place the checker on `from` can reach with the dice left, each by its fewest steps: a single
 * number, or two (or a double's three and four) one after the other through points it may land on.
 * Of two equal ways, the one that does not hit on the way (only where it ends).
 */
export function routesFrom(g: Game, from: number): Route[] {
  const out = new Map<number, Route>();
  const hitsOnTheWay = (steps: Step[]): boolean => steps.slice(0, -1).some((st) => st.hit);
  const walk = (cur: Game, at: number, path: Step[]): void => {
    for (const st of nextSteps(cur)) {
      if (st.from !== at) continue;
      const steps = [...path, st];
      const prev = out.get(st.to);
      if (!prev || steps.length < prev.steps.length || (steps.length === prev.steps.length && hitsOnTheWay(prev.steps) && !hitsOnTheWay(steps))) out.set(st.to, { to: st.to, steps });
      if (st.to !== OFF[cur.turn]) walk(step(cur, st), st.to, steps);
    }
  };
  walk(g, from, []);
  return [...out.values()];
}

const sameStep = (a: Step, b: Step): boolean => a.from === b.from && a.to === b.to && a.die === b.die;

/** Makes one step (refused when not legal now). Bearing off the fifteenth ends the game. */
export function step(g: Game, st: Step): Game {
  const legal = nextSteps(g).find((x) => sameStep(x, st));
  if (!legal) return g;
  const pos = applyStep(g.pos, g.turn, legal);
  const n: Game = { ...g, pos, left: without(g.left, legal.die), steps: [...g.steps, legal] };
  if (pos.off[g.turn] === CHECKERS) return finishGame(n);
  return n;
}

/** Takes back this turn's steps (back to the roll). */
export function undo(g: Game): Game {
  if (g.phase !== 'move' || !g.steps.length) return g;
  return { ...g, pos: g.turnStart, left: diceOf(g.roll![0], g.roll![1]), steps: [] };
}

/** Whether the side to move is done (no legal step left): its turn can end. */
export const turnDone = (g: Game): boolean => g.phase === 'move' && nextSteps(g).length === 0;

/** Ends the turn (only when no legal step is left). */
export function endTurn(g: Game): Game {
  if (!turnDone(g)) return g;
  return { ...g, phase: 'roll', turn: (1 - g.turn) as Side, left: [], lastTurn: { side: g.turn, roll: g.roll!, steps: g.steps }, steps: [], turnStart: g.pos };
}

function finishGame(g: Game): Game {
  const w = g.turn;
  const l = (1 - w) as Side;
  let points: 1 | 2 | 3 = 1;
  if (g.pos.off[l] === 0) {
    points = 2;
    const [lo, hi] = homeRange(w);
    let inHome = g.pos.bar[l] > 0;
    for (let i = lo; i <= hi; i++) if (mine(g.pos, l, i)) inHome = true;
    if (inHome) points = 3;
  }
  return { ...g, phase: 'over', winner: w, points, left: [], lastTurn: { side: w, roll: g.roll!, steps: g.steps } };
}

/** A whole play at once (the computer's): each step in turn, then the turn ends. */
export function playAll(g: Game, steps: readonly Step[]): Game {
  let n = g;
  for (const st of steps) n = step(n, st);
  return n.phase === 'over' ? n : endTurn(n);
}

// ---------------------------------------------------------------- a match

export const TARGETS = [3, 5, 7] as const;

export interface Match {
  seed: number;
  target: number;
  score: [number, number];
  /** Games played so far (each has its own dice). */
  games: number;
  game: Game;
  results: { winner: Side; points: number }[];
  winner: Side | null;
}

export const gameSeed = (seed: number, n: number): number => (Math.imul(seed ^ 0x2545f491, 0x9e3779b1) + n * 0x6c8e9cf5) >>> 0;

export function newMatch(seed: number, target: number): Match {
  return { seed, target, score: [0, 0], games: 1, game: newGame(gameSeed(seed, 0)), results: [], winner: null };
}

/** Books a finished game; the match ends at the target. */
export function bookGame(m: Match): Match {
  const g = m.game;
  if (g.phase !== 'over' || g.winner === null) return m;
  const score: [number, number] = [m.score[0], m.score[1]];
  score[g.winner] += g.points;
  return { ...m, score, results: [...m.results, { winner: g.winner, points: g.points }], winner: score[g.winner] >= m.target ? g.winner : null };
}

export const nextGame = (m: Match): Match => ({ ...m, games: m.games + 1, game: newGame(gameSeed(m.seed, m.games)) });

/**
 * Backgammon's computer players. They choose among the whole plays of their roll (allPlays), seeing
 * only the board, like anyone at the table. Pure and seeded.
 *
 * - easy: half the time any legal play, otherwise the medium choice
 * - medium: a quick count (race, made points, blots)
 * - hard: a full position judgement (eval below)
 * - expert: one roll ahead: the best few plays by the judgement, each tried against all 21 replies
 *   the opponent could roll and the opponent's best answer to each; the best average wins
 */
import { allPlays, mine, pips, theirs, type Pos, type Side, type Step } from './logic';

export type Level = 'easy' | 'medium' | 'hard' | 'expert';
export const LEVELS: Level[] = ['easy', 'medium', 'hard', 'expert'];

/** The 21 distinct rolls and how many of the 36 each stands for. */
export const ROLLS: { dice: number[]; w: number }[] = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push({ dice: a === b ? [a, a, a, a] : [a, b], w: a === b ? 1 : 2 });

/** A point seen from `s`'s side: 1 = deepest in its home board, 24 = the far end. */
const rel = (s: Side, i: number): number => (s === 0 ? i : 25 - i);
const abs = (s: Side, r: number): number => (s === 0 ? r : 25 - r);

/** Any of `s`'s checkers still behind any of the opponent's (the game is not a pure race). */
export function contact(p: Pos): boolean {
  if (p.bar[0] || p.bar[1]) return true;
  // the furthest-back checkers of each side
  let back0 = 0;
  for (let i = 24; i >= 1; i--) if (mine(p, 0, i)) {
    back0 = i;
    break;
  }
  let back1 = 25;
  for (let i = 1; i <= 24; i++) if (mine(p, 1, i)) {
    back1 = i;
    break;
  }
  return back0 > back1;
}

/** How many of the 36 rolls let the opponent hit each of `s`'s blots (index: point). */
export function shotsOn(p: Pos, s: Side): Map<number, number> {
  const o = (1 - s) as Side;
  const blots: number[] = [];
  for (let i = 1; i <= 24; i++) if (mine(p, s, i) === 1) blots.push(i);
  const hits = new Map<number, number>();
  if (!blots.length) return hits;
  const blocked = (i: number): boolean => i >= 1 && i <= 24 && mine(p, s, i) >= 2;
  // the opponent's checkers, as starting points (the bar counts as its own entry point)
  const sources: number[] = [];
  if (p.bar[o]) sources.push(o === 0 ? 25 : 0);
  else for (let i = 1; i <= 24; i++) if (mine(p, o, i)) sources.push(i);
  const step = o === 0 ? -1 : 1;
  for (const r of ROLLS) {
    const hitHere = new Set<number>();
    for (const f of sources) {
      for (const b of blots) {
        const dist = (b - f) * step;
        if (dist <= 0) continue;
        const [a, c] = r.dice;
        if (r.dice.length === 4) {
          for (let k = 1; k <= 4; k++) {
            if (a! * k !== dist) continue;
            let open = true;
            for (let j = 1; j < k; j++) if (blocked(f + step * a! * j)) open = false;
            if (open) hitHere.add(b);
          }
        } else {
          if (a === dist || c === dist) hitHere.add(b);
          else if (a! + c! === dist && (!blocked(f + step * a!) || !blocked(f + step * c!))) hitHere.add(b);
        }
      }
    }
    for (const b of hitHere) hits.set(b, (hits.get(b) ?? 0) + r.w);
  }
  return hits;
}

/** Home-board points `s` holds (2+ checkers): how hard it is to come in from the bar. */
const closedHome = (p: Pos, s: Side): number => {
  let n = 0;
  for (let r = 1; r <= 6; r++) if (mine(p, s, abs(s, r)) >= 2) n++;
  return n;
};

/** The longest run of made points (a prime). */
const primeOf = (p: Pos, s: Side): number => {
  let best = 0;
  let run = 0;
  for (let r = 1; r <= 24; r++) {
    if (mine(p, s, abs(s, r)) >= 2) best = Math.max(best, ++run);
    else run = 0;
  }
  return best;
};

/** What each made point is worth by where it is (seen from its owner's side). */
const POINT_W = [0, 4, 5, 6, 8, 11, 9, 7, 4, 2, 2, 2, 2, 1, 1, 1, 1, 1, 4, 4, 6, 5, 3, 2, 2];

/** `s`'s half of the judgement (the full judgement is this minus the opponent's). */
function side(p: Pos, s: Side, risky: boolean): number {
  let v = 0;
  for (let r = 1; r <= 24; r++) {
    const n = mine(p, s, abs(s, r));
    if (n >= 2) v += POINT_W[r]!;
    if (n > 3) v -= (n - 3) * (r <= 6 ? 0.8 : 1.4);
  }
  const prime = primeOf(p, s);
  if (prime >= 3) v += (prime - 2) * 4;
  v += p.off[s] * 1.6;
  if (risky) {
    const shots = shotsOn(p, s);
    for (const [b, n] of shots) v -= (n / 36) * (rel(s, b) <= 6 ? 0.55 : 0.4) * (25 - rel(s, b) + 6);
  }
  v -= p.bar[s] * (5 + closedHome(p, (1 - s) as Side) * 3);
  return v;
}

/**
 * How good the position is for `s` (higher is better), with `mover` about to roll: only the other
 * side's blots can be hit before they are covered, so only those count as at risk.
 */
export function judge(p: Pos, s: Side, mover: Side = (1 - s) as Side): number {
  const o = (1 - s) as Side;
  if (p.off[s] === 15) return 1000;
  if (p.off[o] === 15) return -1000;
  const race = pips(p, o) - pips(p, s);
  if (!contact(p)) {
    // a pure race: pips, checkers already off, and no wasted gaps in the home board
    let gaps = 0;
    for (let r = 1; r <= 6; r++) if (!mine(p, s, abs(s, r)) && mine(p, s, abs(s, r + 1))) gaps++;
    return race * 1.2 + (p.off[s] - p.off[o]) * 2.5 - gaps * 0.8;
  }
  return race * 0.33 + side(p, s, mover !== s) - side(p, o, mover !== o);
}

/** The quick count of the medium player. */
function quick(p: Pos, s: Side): number {
  const o = (1 - s) as Side;
  let v = (pips(p, o) - pips(p, s)) * 0.4 + (p.off[s] - p.off[o]) * 2 + (p.bar[o] - p.bar[s]) * 6;
  for (let i = 1; i <= 24; i++) {
    if (mine(p, s, i) >= 2) v += 3;
    if (mine(p, s, i) === 1 && contact(p)) v -= 3;
    if (theirs(p, s, i) >= 2) v -= 2;
  }
  return v;
}

/** The play a computer player at `level` makes with `dice` (its steps; empty when nothing can move). */
export function choosePlay(p: Pos, s: Side, dice: readonly number[], level: Level, r: () => number): Step[] {
  const plays = allPlays(p, s, dice);
  if (plays.length <= 1) return plays[0]?.steps ?? [];
  if (level === 'easy' && r() < 0.5) return plays[Math.floor(r() * plays.length)]!.steps;
  if (level === 'easy' || level === 'medium') return best(plays, (q) => quick(q, s) + (level === 'medium' ? r() * 0.5 : r() * 3)).steps;
  if (level === 'hard') return best(plays, (q) => judge(q, s)).steps;
  return expertPlay(plays, p, s, r);
}

/** How many candidate plays the expert rolls out, how many times, and how many turns deep. */
export const EXPERT = { candidates: 6, rollouts: 32, depth: 6 };

/** The hard player's choice for one roll (used inside the expert's rollouts). */
function hardPick(p: Pos, s: Side, dice: readonly number[]): Pos {
  const plays = allPlays(p, s, dice);
  if (!plays.length) return p;
  return best(plays, (q) => judge(q, s)).pos;
}

/**
 * The expert: the best few plays by the judgement, each played out a few turns ahead with the hard
 * player on both sides, many times over the same dice for every candidate (so luck cancels out), the
 * result judged where the rollout stops. The best average wins.
 */
function expertPlay(plays: { steps: Step[]; pos: Pos }[], p: Pos, s: Side, r: () => number): Step[] {
  void p;
  const o = (1 - s) as Side;
  const top = [...plays].sort((x, y) => judge(y.pos, s) - judge(x.pos, s)).slice(0, EXPERT.candidates);
  if (top.length === 1) return top[0]!.steps;
  // the dice for every rollout, shared by all candidates
  const dice: number[][][] = [];
  for (let k = 0; k < EXPERT.rollouts; k++) {
    const seq: number[][] = [];
    for (let d = 0; d < EXPERT.depth; d++) {
      const a = 1 + Math.floor(r() * 6);
      const b = 1 + Math.floor(r() * 6);
      seq.push(a === b ? [a, a, a, a] : [a, b]);
    }
    dice.push(seq);
  }
  let pick = top[0]!;
  let pickV = -Infinity;
  for (const cand of top) {
    let total = 0;
    for (const seq of dice) {
      let q = cand.pos;
      let mover: Side = o;
      let value: number | null = null;
      for (const roll of seq) {
        q = hardPick(q, mover, roll);
        if (q.off[mover] === 15) {
          value = mover === s ? 1000 : -1000;
          break;
        }
        mover = (1 - mover) as Side;
      }
      total += value ?? judge(q, s, mover);
    }
    if (total > pickV) {
      pick = cand;
      pickV = total;
    }
  }
  return pick.steps;
}

function best<T extends { pos: Pos }>(list: readonly T[], score: (p: Pos) => number): T {
  let top = list[0]!;
  let topV = -Infinity;
  for (const x of list) {
    const v = score(x.pos);
    if (v > topV) {
      top = x;
      topV = v;
    }
  }
  return top;
}

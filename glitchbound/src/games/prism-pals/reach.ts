/**
 * The level checker (tests only, never in the game's bundle): where a critter of one color can get to,
 * found by a breadth-first search over the cells it can stand in, moving between them with the real
 * simulation (sim.ts): every walk, running jump, short hop and steered jump from each cell it reached.
 * Gates count as openable (all open), moving platforms as a bridge along their whole track (you can wait
 * for them), crates as where they start or pushed to either end of their floor.
 */
import type { ColorId } from './critters';
import { Cell, cellAt, type Level, type Platform } from './level';
import { CH, CW, IN_JUMP, IN_LEFT, IN_RIGHT, newWorld, stepWorld, type Critter, type World } from './sim';

export interface Reach {
  /** Cells (y * w + x) the critter stood in. */
  stands: Set<number>;
  /** Gems it picked up on a path it survived. */
  gems: Set<number>;
}

/** The level as the checker sees it: each moving platform replaced by still ones all along its track. */
function stillPlatforms(lv: Level): Level {
  const platforms: Platform[] = [];
  for (const p of lv.platforms)
    for (let at = p.lo; at <= p.hi; at++)
      platforms.push(p.axis === 'h' ? { x: at, y: p.y, w: p.w, axis: 'h', lo: at, hi: at + 1e-4 } : { x: p.x, y: at, w: p.w, axis: 'v', lo: at - 1e-4, hi: at });
  return { ...lv, platforms };
}

/** Where a crate ends up pushed all the way left or right along its floor (dropping into the first hole). */
export function crateEnds(lv: Level, start: { x: number; y: number }): { x: number; y: number }[] {
  const free = (x: number, y: number): boolean => {
    const k = cellAt(lv, x, y);
    return k !== Cell.Ground && k !== Cell.Gate && k !== Cell.LeverGate && k !== Cell.LeverGateOpen && y < lv.h;
  };
  const ends: { x: number; y: number }[] = [];
  for (const d of [-1, 1]) {
    let { x, y } = start;
    for (let n = 0; n < 60 && free(x + d, y); n++) {
      x += d;
      while (y < lv.h && free(x, y + 1)) y++;
      if (y >= lv.h) break;
      if (free(x, y + 1) || y !== start.y) break;
    }
    if (y < lv.h && (x !== start.x || y !== start.y)) ends.push({ x, y });
  }
  return ends;
}

/** The moves tried from each cell: runs of held buttons, [buttons, steps]. */
const STRATS: [number, number][][] = [];
for (const d of [IN_LEFT, IN_RIGHT]) {
  const back = d === IN_LEFT ? IN_RIGHT : IN_LEFT;
  for (const walk of [0, 8, 18, 30]) {
    const w: [number, number][] = walk ? [[d, walk]] : [];
    STRATS.push([...w, [0, 30]]);
    STRATS.push([...w, [d | IN_JUMP, 40], [d, 60]]);
    STRATS.push([...w, [d | IN_JUMP, 7], [d, 90]]);
    STRATS.push([...w, [d | IN_JUMP, 10], [IN_JUMP, 30], [0, 60]]);
    // a spring (or a ledge) under way: let go, then steer either way
    for (const wait of [10, 20]) for (const to of [d, back]) STRATS.push([...w, [0, wait], [to, 80]]);
  }
  for (const late of [6, 12]) STRATS.push([[IN_JUMP, late], [d | IN_JUMP, 40 - late], [d, 60]]);
}
STRATS.push([[IN_JUMP, 40], [0, 60]]);

function world(lv: Level, color: ColorId, crates: { x: number; y: number }[]): World {
  const w = newWorld(lv);
  w.open = true;
  for (const c of w.cr) if (c.color !== color) c.dead = true;
  w.crates = crates.map((c) => ({ x: c.x, y: c.y, vy: 0, dx: 0, dy: 0, gone: false, ext: false }));
  return w;
}

const cellOf = (lv: Level, c: Critter): number => Math.floor(c.y + CH - 0.05) * lv.w + Math.floor(c.x + CW / 2);

export function reach(level: Level, color: ColorId, crates: { x: number; y: number }[] = level.crates): Reach {
  const lv = stillPlatforms(level);
  const local = lv.spawns.map((_, i) => i === color);
  const stands = new Set<number>();
  const gems = new Set<number>();
  const queue: Critter[] = [];
  const visit = (c: Critter): void => {
    const k = cellOf(lv, c);
    if (stands.has(k)) return;
    stands.add(k);
    queue.push({ ...c, vx: 0, vy: 0, held: 0, buffer: 0, coyote: 0 });
  };
  // the spawn: let it settle onto the ground
  {
    const w = world(lv, color, crates);
    for (let n = 0; n < 90 && !w.cr[color]!.ground; n++) stepWorld(w, [], local, true);
    if (w.cr[color]!.dead || !w.cr[color]!.ground) return { stands, gems };
    visit(w.cr[color]!);
  }
  while (queue.length) {
    const from = queue.shift()!;
    for (const plan of STRATS) {
      const w = world(lv, color, crates);
      w.cr[color] = { ...from };
      const seen: Critter[] = [];
      let left = false;
      let n = 0;
      run: for (const [bits, steps] of plan)
        for (let k = 0; k < steps; k++, n++) {
          stepWorld(w, lv.spawns.map((_, i) => (i === color ? bits : 0)), local, true);
          const c = w.cr[color]!;
          if (c.dead) break run;
          if (!c.ground) left = true;
          else {
            seen.push({ ...c });
            // landed again after leaving the ground: this path is over
            if (left) break run;
          }
        }
      const end = w.cr[color]!;
      if (end.dead || !end.ground) continue;
      for (let g = 0; g < w.gems.length; g++) if (w.gems[g]) gems.add(g);
      for (const c of seen) visit(c);
    }
  }
  return { stands, gems };
}

/** Every crate setup the checker tries: as they start, and each crate pushed to either end of its floor. */
export function crateSetups(lv: Level): { x: number; y: number }[][] {
  const out = [lv.crates];
  lv.crates.forEach((c, j) => {
    for (const e of crateEnds(lv, c)) out.push(lv.crates.map((o, k) => (k === j ? e : o)));
  });
  return out;
}

/** Union of what a color reaches over every crate setup. */
export function reachAll(lv: Level, color: ColorId): Reach {
  const all: Reach = { stands: new Set(), gems: new Set() };
  for (const setup of crateSetups(lv)) {
    const r = reach(lv, color, setup);
    r.stands.forEach((k) => all.stands.add(k));
    r.gems.forEach((g) => all.gems.add(g));
  }
  return all;
}

/** What the level checker finds wrong with a level (empty: every critter can reach the exit and its gems). */
export function levelProblems(lv: Level): string[] {
  const out: string[] = [];
  const cell = (k: number): Cell => lv.cells[k] as Cell;
  const reaches = lv.spawns.map((_, i) => reachAll(lv, i as ColorId));
  reaches.forEach((r, i) => {
    if (![...r.stands].some((k) => cell(k) === Cell.Exit)) out.push(`critter ${i} can't reach the exit`);
    lv.gems.forEach((g, j) => {
      if (g.color === i && !r.gems.has(j)) out.push(`critter ${i} can't reach gem ${j} at ${g.x},${g.y}`);
    });
    if (lv.gated[i] && ![...r.stands].some((k) => cell(k) === Cell.Plate && lv.tint[k] === i)) out.push(`critter ${i} can't reach a plate`);
  });
  if (lv.gems.some((g) => g.color >= lv.n)) out.push('a gem for a critter the level doesn’t have');
  if (lv.exits.length < lv.n) out.push('fewer exit cells than critters');
  const leverGates = lv.cells.some((k) => k === Cell.LeverGate || k === Cell.LeverGateOpen);
  if (leverGates && !lv.levers.some((l) => reaches.some((r) => [...r.stands].some((k) => Math.abs((k % lv.w) - l.x) <= 1 && Math.floor(k / lv.w) === l.y)))) out.push('nobody reaches a lever');
  return out;
}

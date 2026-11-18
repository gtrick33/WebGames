/**
 * The world map's shape: the lands on a grid, each where the roads say it lies from its neighbours. A land whose road
 * leaves by the west of the one before it stands to the left of it, one to the north above it, and so on, as near as
 * the grid allows: the start at 0,0, columns growing east and rows growing south.
 *
 * The lands used to be drawn where they lie, and their roads as straight lines between them: a web that crossed
 * itself, with lines running off to lands the story no longer visits (the owner: "it used to be like a binary tree,
 * now its just going everywhere ... the paths to every map are confusing"). Then a tree, the story straight up the
 * middle, which kept every road tidy but put a land the hero reaches by the west road above the last one, or to the
 * right of it ("too linear and confusing ... if the next zone is to the west, then the node should be left to the
 * current one"). Now: a grid, tidy as the tree was, laid out the way the roads run.
 *
 * Nothing here knows the lands themselves: it is given their ids, the roads between them, each one's level and which
 * way each road runs, so it lays out whatever world it is handed (a land brought back into the story takes its place
 * by itself). It is worked out once for a world (the map panel keeps it), by a short deterministic search: each land
 * placed in turn beside the land its road comes from, then moved, swapped or shifted with what hangs from it while
 * that makes the whole read better.
 */

export interface WorldPlan<Id extends string> {
  /** Every land on the map: in the order the roads reach them from the start, then the lands no road reaches. */
  ids: Id[];
  /** Column (east positive) and row (south positive): the start at 0,0. */
  cell: Map<Id, [number, number]>;
  /**
   * The roads drawn as lines: the one the story first comes into each land by, and every other that runs clear (it
   * crosses no road and no land, it is short, and it runs the way its road does).
   */
  roads: [Id, Id][];
  /** Every other road between two lands of the map (shown for the land that is picked). */
  ties: [Id, Id][];
  /** Lands with no road to the rest (a dungeon whose land is out of the story): they stand apart, beside the start. */
  apart: Id[];
  cols: [number, number];
  rows: [number, number];
}

export interface WorldShape<Id extends string> {
  /** Which way `b` lies from `a` (x east, y south, any length), if the roads say; `b` to `a` is taken as the opposite. */
  heading?: (a: Id, b: Id) => readonly [number, number] | undefined;
  /** A cell's width and height as drawn (a direction is judged as it looks: a step east and one north is north-east). */
  cell?: readonly [number, number];
}

interface Edge<Id> {
  a: Id;
  b: Id;
  /** The road the story first comes into `b` by. */
  tree: boolean;
  /** Which way `b` lies from `a` (a unit long). */
  dir?: [number, number];
}

/** How much each fault costs. A road the story comes in by counts most; a road off to the side, less. */
const COST = {
  /**
   * A road drawn off the way it runs (turnBy): nothing within an eighth of a turn, a little up to a quarter (a land to
   * the west drawn to the north-west is still to the left), a lot past that.
   */
  turn: 1,
  turnTie: 0.5,
  /** Each cell a road is drawn longer than the one step. */
  far: 4,
  farTie: 1.2,
  /**
   * Two roads crossing: the story's two, one of them, neither. (Another road is drawn as an arc, and only for the
   * land picked, so it hardly matters what it crosses; one that is drawn as a line has to run clear: see `roads`.)
   */
  cross: [50, 1, 0],
  /** A road drawn through a land it does not go to. */
  through: 60,
  throughTie: 0.5,
  /** Each column and row the map is wide and tall. */
  box: 0.6,
};

/** What a road drawn `a` radians off the way it runs costs (times COST.turn). */
function turnBy(a: number): number {
  const e = Math.PI / 8;
  if (a <= e) return 0;
  if (a <= 2 * e) return 3 * ((a - e) / e) ** 2;
  return 3 + 30 * ((a - 2 * e) / e) ** 2;
}

/**
 * Lays the lands out. `links` are the roads (either way round, each pair once or twice); a land's `level` decides,
 * of two roads into it as near the start, which one the story takes (the later); `shape.heading` which way each runs.
 */
export function planWorld<Id extends string>(ids: readonly Id[], links: readonly (readonly [Id, Id])[], level: (id: Id) => number, root: Id, shape: WorldShape<Id> = {}): WorldPlan<Id> {
  const on = new Set(ids);
  const next = new Map<Id, Id[]>(ids.map((id) => [id, []]));
  const pairs: [Id, Id][] = [];
  const seen = new Set<string>();
  for (const [a, b] of links) {
    if (a === b || !on.has(a) || !on.has(b) || seen.has(`${a}|${b}`) || seen.has(`${b}|${a}`)) continue;
    seen.add(`${a}|${b}`);
    pairs.push([a, b]);
    next.get(a)!.push(b);
    next.get(b)!.push(a);
  }

  // the story's way into each land: from the land nearest the start that a road joins it to (of two as near, the
  // later one in the story)
  const depth = new Map<Id, number>([[root, 0]]);
  const parent = new Map<Id, Id>();
  const order: Id[] = [root];
  let layer: Id[] = [root];
  while (layer.length) {
    const found: Id[] = [];
    for (const a of [...layer].sort((x, y) => level(y) - level(x))) {
      for (const b of next.get(a)!) {
        if (depth.has(b)) continue;
        depth.set(b, depth.get(a)! + 1);
        parent.set(b, a);
        found.push(b);
      }
    }
    // (placed in the story's order, a layer at a time)
    found.sort((x, y) => level(x) - level(y) || ids.indexOf(x) - ids.indexOf(y));
    order.push(...found);
    layer = found;
  }

  const [CW, CH] = shape.cell ?? [1, 1];
  const N = order.length;
  const index = new Map(order.map((id, i) => [id, i]));
  const kids: number[][] = order.map(() => []);
  for (const [c, p] of parent) kids[index.get(p)!]!.push(index.get(c)!);
  type Road = Edge<Id> & { i: number; j: number };
  const edges: Road[] = [];
  for (const [x, y] of pairs) {
    if (!depth.has(x) || !depth.has(y)) continue;
    const [a, b] = parent.get(x) === y ? [y, x] : [x, y];
    const tree = parent.get(b) === a;
    const h = shape.heading?.(a, b);
    const len = h ? Math.hypot(h[0], h[1]) : 0;
    edges.push({ a, b, tree, i: index.get(a)!, j: index.get(b)!, ...(h && len > 1e-6 ? { dir: [h[0] / len, h[1] / len] as [number, number] } : {}) });
  }
  const touching: number[][] = order.map(() => []);
  edges.forEach((e, k) => {
    touching[e.i]!.push(k);
    touching[e.j]!.push(k);
  });

  // where each land stands (NaN: not yet); which land stands in each cell
  const px = new Float64Array(N).fill(NaN);
  const py = new Float64Array(N).fill(NaN);
  const grid = new Map<string, number>();
  const put = (n: number, x: number, y: number): void => {
    px[n] = x;
    py[n] = y;
    grid.set(`${x},${y}`, n);
  };
  const lift = (n: number): void => {
    if (grid.get(`${px[n]},${py[n]}`) === n) grid.delete(`${px[n]},${py[n]}`);
  };
  const placed = (n: number): boolean => !Number.isNaN(px[n]!);

  /** How many cells longer than one step a road is drawn. */
  const farOf = (e: Road): number => Math.max(Math.abs(px[e.j]! - px[e.i]!), Math.abs(py[e.j]! - py[e.i]!)) - 1;
  /** How far off the way it runs a road is drawn (radians; none when the roads don't say which way it runs). */
  const turnOf = (e: Road): number => {
    if (!e.dir) return 0;
    const vx = (px[e.j]! - px[e.i]!) * CW;
    const vy = (py[e.j]! - py[e.i]!) * CH;
    return Math.acos(Math.max(-1, Math.min(1, (vx * e.dir[0] + vy * e.dir[1]) / (Math.hypot(vx, vy) || 1))));
  };
  const edgeCost = (e: Road): number => {
    const far = farOf(e);
    const turn = turnBy(turnOf(e));
    // (another road counts for little, and only so much: one that loops round the world the long way can't be drawn
    // the way it runs, and mustn't pull the lands about trying)
    return e.tree ? far * COST.far + turn * COST.turn : Math.min(far, 2) * COST.farTie + Math.min(turn, 6) * COST.turnTie;
  };
  const side = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  /** Two roads cross (or run along one line over each other); two from one land don't. */
  const crosses = (e: Road, f: Road): boolean => {
    if (e.i === f.i || e.i === f.j || e.j === f.i || e.j === f.j) return false;
    const [ax, ay, bx, by] = [px[e.i]!, py[e.i]!, px[e.j]!, py[e.j]!];
    const [cx, cy, dx, dy] = [px[f.i]!, py[f.i]!, px[f.j]!, py[f.j]!];
    const d1 = side(ax, ay, bx, by, cx, cy);
    const d2 = side(ax, ay, bx, by, dx, dy);
    const d3 = side(cx, cy, dx, dy, ax, ay);
    const d4 = side(cx, cy, dx, dy, bx, by);
    let hit = d1 * d2 < 0 && d3 * d4 < 0;
    // (two roads along one line, over each other)
    if (!hit && d1 === 0 && d2 === 0) {
      const t = (x: number, y: number): number => (Math.abs(bx - ax) >= Math.abs(by - ay) ? (x - ax) / (bx - ax) : (y - ay) / (by - ay));
      const [t0, t1] = [t(cx, cy), t(dx, dy)];
      hit = Math.max(t0, t1) > 0 && Math.min(t0, t1) < 1;
    }
    return hit;
  };
  const crossCost = (e: Road, f: Road): number => (crosses(e, f) ? COST.cross[Number(!e.tree) + Number(!f.tree)]! : 0);
  /** A road drawn over a land it doesn't go to (nearer it than a third of a cell, as drawn). */
  const near = 0.33 * Math.min(CW, CH);
  const over = (e: Road, n: number): boolean => {
    if (n === e.i || n === e.j) return false;
    const ax = px[e.i]! * CW;
    const ay = py[e.i]! * CH;
    const vx = px[e.j]! * CW - ax;
    const vy = py[e.j]! * CH - ay;
    const wx = px[n]! * CW - ax;
    const wy = py[n]! * CH - ay;
    const t = (wx * vx + wy * vy) / (vx * vx + vy * vy || 1);
    return t > 0 && t < 1 && Math.hypot(wx - t * vx, wy - t * vy) < near;
  };
  const throughCost = (e: Road, n: number): number => (over(e, n) ? (e.tree ? COST.through : COST.throughTie) : 0);
  const boxCost = (): number => {
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let n = 0; n < N; n++) {
      if (!placed(n)) continue;
      x0 = Math.min(x0, px[n]!);
      x1 = Math.max(x1, px[n]!);
      y0 = Math.min(y0, py[n]!);
      y1 = Math.max(y1, py[n]!);
    }
    return (x1 - x0 + y1 - y0) * COST.box;
  };
  /** Every cost a land of `set` has a part in (only lands already placed count). */
  const costOf = (set: ReadonlySet<number>): number => {
    let c = 0;
    const mine = new Set<number>();
    for (const n of set) for (const k of touching[n]!) mine.add(k);
    for (const k of mine) {
      const e = edges[k]!;
      if (!placed(e.i) || !placed(e.j)) continue;
      c += edgeCost(e);
      for (let k2 = 0; k2 < edges.length; k2++) {
        const f = edges[k2]!;
        if (k2 === k || (mine.has(k2) && k2 < k) || !placed(f.i) || !placed(f.j)) continue;
        c += crossCost(e, f);
      }
      for (let n = 0; n < N; n++) if (placed(n)) c += throughCost(e, n);
    }
    for (const n of set) {
      if (!placed(n)) continue;
      for (let k = 0; k < edges.length; k++) {
        const e = edges[k]!;
        if (!mine.has(k) && placed(e.i) && placed(e.j)) c += throughCost(e, n);
      }
    }
    return c + boxCost();
  };
  /** The cells round one, nearest first (then round from the east), out to `r`. */
  const ring = (x: number, y: number, r: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx || dy) out.push([x + dx, y + dy]);
    return out.sort((p, q) => Math.max(Math.abs(p[0] - x), Math.abs(p[1] - y)) - Math.max(Math.abs(q[0] - x), Math.abs(q[1] - y)) || Math.atan2(p[1] - y, p[0] - x) - Math.atan2(q[1] - y, q[0] - x));
  };

  // 1. each land in turn, beside the land its road comes from, where it costs least
  put(0, 0, 0);
  for (let n = 1; n < N; n++) {
    const p = index.get(parent.get(order[n]!)!)!;
    let best: [number, number] | null = null;
    let bc = Infinity;
    for (const [x, y] of ring(px[p]!, py[p]!, 3)) {
      if (grid.has(`${x},${y}`)) continue;
      put(n, x, y);
      const c = costOf(new Set([n]));
      lift(n);
      px[n] = NaN;
      py[n] = NaN;
      if (c < bc - 1e-9) {
        bc = c;
        best = [x, y];
      }
    }
    put(n, best![0], best![1]);
  }

  const below = (n: number): number[] => [n, ...kids[n]!.flatMap(below)];
  const subtree = order.map((_, n) => below(n));
  /** Moves lands (each to its cell), as one. */
  const shift = (set: readonly number[], to: readonly (readonly [number, number])[]): void => {
    set.forEach(lift);
    set.forEach((m, i) => put(m, to[i]![0], to[i]![1]));
  };
  /** A move near a land: to a cell round it (or swapped with the land there), or with all that hangs from it. */
  const moveNear = (n: number, dx: number, dy: number, whole: boolean): { set: number[]; to: [number, number][] } | null => {
    if (whole) {
      const set = subtree[n]!;
      const mine = new Set(set);
      const to = set.map((m) => [px[m]! + dx, py[m]! + dy] as [number, number]);
      return to.every(([x, y]) => !grid.has(`${x},${y}`) || mine.has(grid.get(`${x},${y}`)!)) ? { set, to } : null;
    }
    const [x, y] = [px[n]! + dx, py[n]! + dy];
    const m = grid.get(`${x},${y}`);
    return m === undefined ? { set: [n], to: [[x, y]] } : { set: [n, m], to: [[x, y], [px[n]!, py[n]!]] };
  };

  // 2. a shake-up, so a land that went where it first fitted isn't stuck there: random moves, the worse ones taken
  // less and less (annealing; the same numbers every time, so the same world is laid out the same way)
  let seed = 0x2f6b9e1d;
  const rand = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const STEPS = 60 * N;
  for (let step = 0, heat = 6; step < STEPS; step++, heat *= Math.pow(0.05 / 6, 1 / STEPS)) {
    const n = Math.floor(rand() * N);
    const whole = n > 0 && kids[n]!.length > 0 && rand() < 0.3;
    const dx = Math.floor(rand() * 5) - 2;
    const dy = Math.floor(rand() * 5) - 2;
    if (!dx && !dy) continue;
    const mv = moveNear(n, dx, dy, whole);
    if (!mv) continue;
    const s = new Set(mv.set);
    const was = mv.set.map((m) => [px[m]!, py[m]!] as [number, number]);
    const before = costOf(s);
    shift(mv.set, mv.to);
    const worse = costOf(s) - before;
    if (worse > 0 && rand() >= Math.exp(-worse / heat)) shift(mv.set, was);
  }

  // 3. then, while it helps: a land moved to a cell near it, two lands swapped, or a land shifted with all that
  // hangs from it
  for (let pass = 0; pass < 40; pass++) {
    let better = false;
    for (let n = 0; n < N; n++) {
      let best: { gain: number; apply: () => void } | null = null;
      const tryMove = (mv: { set: number[]; to: [number, number][] } | null): void => {
        if (!mv) return;
        const s = new Set(mv.set);
        const was = mv.set.map((m) => [px[m]!, py[m]!] as [number, number]);
        const before = costOf(s);
        shift(mv.set, mv.to);
        const gain = before - costOf(s);
        shift(mv.set, was);
        if (gain > 1e-6 && (!best || gain > best.gain + 1e-9)) best = { gain, apply: () => shift(mv.set, mv.to) };
      };
      for (const [dx, dy] of ring(0, 0, 2)) {
        tryMove(moveNear(n, dx, dy, false));
        if (n > 0 && kids[n]!.length) tryMove(moveNear(n, dx, dy, true));
      }
      if (best) {
        (best as { apply: () => void }).apply();
        better = true;
      }
    }
    if (!better) break;
  }

  const cell = new Map<Id, [number, number]>(order.map((id, n) => [id, [px[n]! - px[0]!, py[n]! - py[0]!]]));
  // the lands no road reaches: apart, beside the start
  const apart = ids.filter((id) => !cell.has(id));
  const taken = new Set([...cell.values()].map(([x, y]) => `${x},${y}`));
  for (const id of apart) {
    const at = [[1, 0] as [number, number], [-1, 0] as [number, number], ...ring(0, 0, 6)].find(([x, y]) => !taken.has(`${x},${y}`))!;
    cell.set(id, at);
    taken.add(`${at[0]},${at[1]}`);
  }

  // the roads drawn: the story's way into each land, and the others that run clear
  const roads: [Id, Id][] = edges.filter((e) => e.tree).map((e) => [e.a, e.b]);
  const ties: [Id, Id][] = [];
  const drawn = edges.filter((e) => e.tree);
  const rest = edges.filter((e) => !e.tree).sort((e, f) => Math.hypot(px[e.j]! - px[e.i]!, py[e.j]! - py[e.i]!) - Math.hypot(px[f.j]! - px[f.i]!, py[f.j]! - py[f.i]!));
  for (const e of rest) {
    // (short, within an eighth of a turn of the way it runs, over no land and across no road drawn)
    const clear = farOf(e) <= 1 && turnOf(e) <= Math.PI / 4 + 1e-9 && order.every((_, n) => !over(e, n)) && drawn.every((f) => !crosses(e, f));
    if (clear) {
      roads.push([e.a, e.b]);
      drawn.push(e);
    } else ties.push([e.a, e.b]);
  }
  const xs = [...cell.values()].map(([x]) => x);
  const ys = [...cell.values()].map(([, y]) => y);
  return { ids: [...order, ...apart], cell, roads, ties, apart, cols: [Math.min(...xs), Math.max(...xs)], rows: [Math.min(...ys), Math.max(...ys)] };
}

/** Which side of its mark a land's name is written: east, west, south or north of it. */
export type NameSide = 'e' | 'w' | 's' | 'n';

/**
 * Where each land's name goes: beside its mark, on whichever side runs over the fewest marks, roads and names
 * already written (to the east where that is clear). `size` is a name's width and height in drawn units (null: no
 * name); `unit` a cell's size; `gap` how far from the middle of a mark a name starts.
 */
export function placeNames<Id extends string>(plan: WorldPlan<Id>, unit: readonly [number, number], size: (id: Id) => readonly [number, number] | null, gap: number, mark: number): Map<Id, { side: NameSide; box: [number, number, number, number] }> {
  const [CW, CH] = unit;
  const at = (id: Id): [number, number] => {
    const [c, r] = plan.cell.get(id) ?? [0, 0];
    return [c * CW, r * CH];
  };
  const segs = plan.roads.map(([a, b]) => [...at(a), ...at(b)] as [number, number, number, number]);
  const out = new Map<Id, { side: NameSide; box: [number, number, number, number] }>();
  const boxes: [number, number, number, number][] = [];
  const overlap = (p: number[], q: number[]): number => Math.max(0, Math.min(p[2]!, q[2]!) - Math.max(p[0]!, q[0]!)) * Math.max(0, Math.min(p[3]!, q[3]!) - Math.max(p[1]!, q[1]!));
  /** Whether a road runs through a box (a few points along it fall inside, or it crosses it). */
  const runs = (s: number[], b: number[]): boolean => {
    for (let t = 0; t <= 1; t += 0.05) {
      const x = s[0]! + (s[2]! - s[0]!) * t;
      const y = s[1]! + (s[3]! - s[1]!) * t;
      if (x > b[0]! && x < b[2]! && y > b[1]! && y < b[3]!) return true;
    }
    return false;
  };
  for (const id of plan.ids) {
    const sz = size(id);
    if (!sz) continue;
    const [w, h] = sz;
    const [x, y] = at(id);
    const spots: { side: NameSide; box: [number, number, number, number]; pref: number }[] = [
      { side: 'e', box: [x + gap, y - h / 2, x + gap + w, y + h / 2], pref: 0 },
      { side: 's', box: [x - w / 2, y + gap, x + w / 2, y + gap + h], pref: 0.6 },
      { side: 'w', box: [x - gap - w, y - h / 2, x - gap, y + h / 2], pref: 1 },
      { side: 'n', box: [x - w / 2, y - gap - h, x + w / 2, y - gap], pref: 1.4 },
    ];
    let best = spots[0]!;
    let bc = Infinity;
    for (const sp of spots) {
      let c = sp.pref;
      for (const other of plan.ids) {
        if (other === id || !plan.cell.has(other)) continue;
        const [ox, oy] = at(other);
        if (overlap(sp.box, [ox - mark, oy - mark, ox + mark, oy + mark]) > 0) c += 40;
      }
      for (const s of segs) if (runs(s, sp.box)) c += 6;
      for (const b of boxes) c += overlap(sp.box, b) > 0 ? 25 + overlap(sp.box, b) * 0.2 : 0;
      if (c < bc) {
        bc = c;
        best = sp;
      }
    }
    boxes.push(best.box);
    out.set(id, { side: best.side, box: best.box });
  }
  return out;
}

/** A name on one line or two, broken at the space nearest its middle once it is longer than `max` letters. */
export function nameLines(name: string, max = 13): string[] {
  if (name.length <= max) return [name];
  let best = -1;
  for (let i = name.indexOf(' '); i >= 0; i = name.indexOf(' ', i + 1)) if (best < 0 || Math.abs(i - name.length / 2) < Math.abs(best - name.length / 2)) best = i;
  return best < 0 ? [name] : [name.slice(0, best), name.slice(best + 1)];
}

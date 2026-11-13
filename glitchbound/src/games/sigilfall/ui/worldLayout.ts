/**
 * The world map's shape: a tree that grows up from the village where the story starts. Each land sits one row above
 * the land its road comes from, the story's own road runs straight up the middle, and what branches off it (a
 * dungeon, a side valley, the Crown City) stands to one side on the same row as the next land of the road.
 *
 * The lands used to be drawn where they lie, and their roads as straight lines between them: a web that crossed
 * itself, with lines running off to lands the story no longer visits (the owner: "it used to be like a binary tree,
 * now its just going everywhere ... the paths to every map are confusing"). Where a land lies says little to a
 * player; which land comes after which is what the map is for.
 *
 * Nothing here knows the lands themselves: it is given their ids, the roads between them and each one's level, so
 * it lays out whatever world it is handed (a land brought back into the story takes its place by itself).
 */

export interface WorldPlan<Id extends string> {
  /** Every land on the map: the tree first, row by row, then the lands no road reaches. */
  ids: Id[];
  /** Column (0 is the trunk, negative to the left) and row (0 is the start, rising with the story). */
  cell: Map<Id, [number, number]>;
  /** The tree's branches: the land a road comes from, then the land it leads to. */
  roads: [Id, Id][];
  /** Every other road between two lands of the map (shown for the land that is picked). */
  ties: [Id, Id][];
  /** Lands with no road to the rest (a dungeon whose land is out of the story): they stand apart, on the first row. */
  apart: Id[];
  cols: [number, number];
  rows: number;
}

/**
 * Lays the lands out. `links` are the roads (either way round, each pair once or twice); a land's `level` puts the
 * story's road first where two roads lead on.
 */
export function planWorld<Id extends string>(ids: readonly Id[], links: readonly (readonly [Id, Id])[], level: (id: Id) => number, root: Id): WorldPlan<Id> {
  const on = new Set(ids);
  const next = new Map<Id, Id[]>(ids.map((id) => [id, []]));
  const pairs = new Set<string>();
  for (const [a, b] of links) {
    if (a === b || !on.has(a) || !on.has(b) || pairs.has(`${a}|${b}`) || pairs.has(`${b}|${a}`)) continue;
    pairs.add(`${a}|${b}`);
    next.get(a)!.push(b);
    next.get(b)!.push(a);
  }

  // the tree: each land hangs from the land nearest the start that a road joins it to (of two as near, the later
  // one in the story: the road the story takes)
  const depth = new Map<Id, number>([[root, 0]]);
  const parent = new Map<Id, Id>();
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
    layer = found;
  }
  const kids = new Map<Id, Id[]>(ids.map((id) => [id, []]));
  for (const [c, p] of parent) kids.get(p)!.push(c);
  const tall = new Map<Id, number>();
  const tallOf = (n: Id): number => {
    let t = tall.get(n);
    if (t === undefined) {
      t = 1 + Math.max(0, ...kids.get(n)!.map(tallOf));
      tall.set(n, t);
    }
    return t;
  };
  /** The road on from a land: the child with the most of the world behind it (of two leaves, the story's first). */
  const heir = (n: Id): Id | undefined => [...kids.get(n)!].sort((a, b) => tallOf(b) - tallOf(a) || level(a) - level(b) || ids.indexOf(a) - ids.indexOf(b))[0];
  const tied = (a: Id, b: Id): boolean => next.get(a)!.includes(b);

  const cell = new Map<Id, [number, number]>();
  const taken = new Set<string>();
  /** The uprights between a row and the next, by column: whose branch each is. */
  const upright = new Map<string, Id>();
  const order: Id[] = [];
  /** A land and the road on from it, straight up one column. */
  const chain = (n: Id, col: number, row: number): void => {
    for (let at: Id | undefined = n, r = row, from: Id | undefined; at; from = at, at = heir(at), r++) {
      cell.set(at, [col, r]);
      taken.add(`${col},${r}`);
      order.push(at);
      if (from) upright.set(`${col},${r - 1}`, from);
    }
  };
  const fits = (n: Id, from: Id, col: number, row: number): boolean => {
    for (let r = row; r < row + tallOf(n); r++) if (taken.has(`${col},${r}`)) return false;
    // its branch runs along under its row from its parent's column: across nobody else's upright
    const c0 = cell.get(from)![0];
    for (let x = Math.min(c0, col); x <= Math.max(c0, col); x++) {
      const whose = upright.get(`${x},${row - 1}`);
      if (whose !== undefined && whose !== from) return false;
      // (nor across a land that has roads on of its own, standing between them)
      if (x !== c0 && x !== col) {
        const there = [...cell].find(([, [cx, cy]]) => cx === x && cy === row - 1)?.[0];
        if (there !== undefined && kids.get(there)!.length) return false;
      }
    }
    return true;
  };
  chain(root, 0, 0);
  for (let i = 0; i < order.length; i++) {
    const n = order[i]!;
    const [col, row] = cell.get(n)!;
    const on2 = heir(n);
    // what branches off: the lands with a road to the next land of the trunk nearest it, then by the story's order
    const sides = kids
      .get(n)!
      .filter((k) => k !== on2)
      .sort((a, b) => Number(!!on2 && tied(b, on2)) - Number(!!on2 && tied(a, on2)) || level(a) - level(b) || ids.indexOf(a) - ids.indexOf(b));
    for (const s of sides) {
      for (let d = 1; d < 40; d++) {
        // (first to the side with fewer lands on this row so far, so the tree keeps its balance)
        const right = [...cell.values()].filter(([cx, cy]) => cy === row + 1 && cx > col).length;
        const left = [...cell.values()].filter(([cx, cy]) => cy === row + 1 && cx < col).length;
        const first = right <= left ? 1 : -1;
        const at = [col + first * d, col - first * d].find((x) => fits(s, n, x, row + 1));
        if (at === undefined) continue;
        chain(s, at, row + 1);
        upright.set(`${at},${row}`, n);
        break;
      }
    }
  }

  // the lands no road reaches: apart, beside the start (under the branches that run out from it)
  const apart = ids.filter((id) => !cell.has(id));
  apart.forEach((id) => {
    let col = 0;
    for (let d = 1; d < 60; d++) {
      const at = [d, -d].find((x) => !taken.has(`${x},0`));
      if (at !== undefined) {
        col = at;
        break;
      }
    }
    cell.set(id, [col, 0]);
    taken.add(`${col},0`);
  });

  const roads: [Id, Id][] = order.filter((n) => parent.has(n)).map((n) => [parent.get(n)!, n]);
  const ties: [Id, Id][] = [];
  for (const key of pairs) {
    const [a, b] = key.split('|') as [Id, Id];
    if (parent.get(a) !== b && parent.get(b) !== a) ties.push([a, b]);
  }
  const cols = [...cell.values()].map(([c]) => c);
  return { ids: [...order, ...apart], cell, roads, ties, apart, cols: [Math.min(...cols), Math.max(...cols)], rows: Math.max(...[...cell.values()].map(([, r]) => r)) + 1 };
}

/** A name on one line or two, broken at the space nearest its middle once it is longer than `max` letters. */
export function nameLines(name: string, max = 13): string[] {
  if (name.length <= max) return [name];
  let best = -1;
  for (let i = name.indexOf(' '); i >= 0; i = name.indexOf(' ', i + 1)) if (best < 0 || Math.abs(i - name.length / 2) < Math.abs(best - name.length / 2)) best = i;
  return best < 0 ? [name] : [name.slice(0, best), name.slice(best + 1)];
}

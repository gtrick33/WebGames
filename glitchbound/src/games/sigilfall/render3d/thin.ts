import type { MeshData } from './pack';

/**
 * A figure with only as much shape as the screen can show.
 *
 * The figures are modeled to be looked at up close (the hall of heroes, a portrait): six to ten thousand triangles
 * each. In the world one stands sixty to ninety pixels tall, so most of its triangles are smaller than a pixel, and
 * every one of them is still carried through its bones and set up to be drawn, twice (the figure, and its ink). A
 * crowd of them (the Vigil's host, a Rift's pack, a town) was most of what the graphics card did.
 *
 * `thinMesh` lays a grid over the model, `cell` to a side, and draws every corner that falls in the same cell at one
 * place: one of the corners that were there. A triangle with two corners in one cell has no area left and is dropped.
 * What is left is the same figure to within a cell: nothing moves further than that. With the cell kept under a pixel
 * of the screen, it is the same picture.
 *
 * What is kept as it was:
 *  - every color and every facet: corners brought to one place keep their own color and their own normal (a face
 *    still catches the light as a face), so nothing is smoothed and no color runs;
 *  - what glows (a normal too short to light: meshKit.ts) glows;
 *  - the surface stays closed: every corner at one place goes to one place together, with one set of bones and one
 *    direction for the ink to stand out in, so no gap opens in the figure or in its outline, at rest or moving;
 *  - what is long and thin (a spear's shaft, a bowstring, a whisker): a triangle thinner than a cell but longer than
 *    one would be dropped, and the spear with it. Its corners are left exactly where they are.
 */

/** A triangle thinner than a cell is kept whole if it is longer than this many cells: it is a part, not a speck. */
const LONG = 1.5;
/** Not worth a second model unless at least this share of the triangles goes. */
const WORTH = 0.8;

/**
 * The model with nothing finer than `cell` (in its own units) left in it, or the model itself if that takes too few
 * triangles away to be worth it.
 */
export function thinMesh(m: MeshData, cell: number): MeshData {
  if (!(cell > 0) || m.i < 3) return m;
  const { pos, nor, sn, col, skin, idx } = m;
  const n = m.n;
  // 1. corners at one place are one place (a faceted model has a corner of its own for every face that meets there)
  const span = [m.max[0]! - m.min[0]!, m.max[1]! - m.min[1]!, m.max[2]! - m.min[2]!];
  const placeOf = new Int32Array(n);
  const first: number[] = [];
  const seen = new Map<number, number>();
  // (told apart to one part in 130,000 of the model's size: finer than its file keeps them)
  const FINE = 131071;
  const fx = FINE / (span[0]! || 1);
  const fy = FINE / (span[1]! || 1);
  const fz = FINE / (span[2]! || 1);
  for (let v = 0; v < n; v++) {
    const key = (Math.round((pos[v * 3 + 2]! - m.min[2]!) * fz) * 131072 + Math.round((pos[v * 3 + 1]! - m.min[1]!) * fy)) * 131072 + Math.round((pos[v * 3]! - m.min[0]!) * fx);
    let p = seen.get(key);
    if (p === undefined) {
      p = first.length;
      first.push(v);
      seen.set(key, p);
    }
    placeOf[v] = p;
  }
  const P = first.length;
  // 2. the cell each place falls in
  const nx = Math.floor(span[0]! / cell) + 2;
  const ny = Math.floor(span[1]! / cell) + 2;
  const nz = Math.floor(span[2]! / cell) + 2;
  // (a grid so fine it couldn't take anything away, or too fine to number)
  if (nx * ny * nz > 2 ** 40) return m;
  const cellOf = new Float64Array(P);
  for (let p = 0; p < P; p++) {
    const v = first[p]!;
    const cx = Math.floor((pos[v * 3]! - m.min[0]!) / cell);
    const cy = Math.floor((pos[v * 3 + 1]! - m.min[1]!) / cell);
    const cz = Math.floor((pos[v * 3 + 2]! - m.min[2]!) / cell);
    cellOf[p] = (cz * ny + cy) * nx + cx;
  }
  // 3. what is long and thin stays where it is
  const kept = new Uint8Array(P);
  const far2 = (LONG * cell) ** 2;
  const d2 = (a: number, b: number): number => {
    const dx = pos[a * 3]! - pos[b * 3]!;
    const dy = pos[a * 3 + 1]! - pos[b * 3 + 1]!;
    const dz = pos[a * 3 + 2]! - pos[b * 3 + 2]!;
    return dx * dx + dy * dy + dz * dz;
  };
  for (let t = 0; t < m.i; t += 3) {
    const a = placeOf[idx[t]!]!;
    const b = placeOf[idx[t + 1]!]!;
    const c = placeOf[idx[t + 2]!]!;
    // (already without area: nothing to keep)
    if (a === b || b === c || a === c) continue;
    const ca = cellOf[a]!;
    const cb = cellOf[b]!;
    const cc = cellOf[c]!;
    if (ca !== cb && cb !== cc && ca !== cc) continue;
    if (Math.max(d2(first[a]!, first[b]!), d2(first[b]!, first[c]!), d2(first[a]!, first[c]!)) > far2) kept[a] = kept[b] = kept[c] = 1;
  }
  // 4. every other place goes to one place per cell: whichever of them is nearest the middle of those there
  const groupOfCell = new Map<number, number>();
  const groupOf = new Int32Array(P);
  const sum: number[] = [];
  const count: number[] = [];
  let G = 0;
  for (let p = 0; p < P; p++) {
    if (kept[p]) {
      groupOf[p] = G++;
      sum.push(0, 0, 0);
      count.push(0);
      continue;
    }
    let g = groupOfCell.get(cellOf[p]!);
    if (g === undefined) {
      g = G++;
      groupOfCell.set(cellOf[p]!, g);
      sum.push(0, 0, 0);
      count.push(0);
    }
    groupOf[p] = g;
    const v = first[p]!;
    sum[g * 3] = sum[g * 3]! + pos[v * 3]!;
    sum[g * 3 + 1] = sum[g * 3 + 1]! + pos[v * 3 + 1]!;
    sum[g * 3 + 2] = sum[g * 3 + 2]! + pos[v * 3 + 2]!;
    count[g] = count[g]! + 1;
  }
  const at = new Int32Array(G).fill(-1);
  const near = new Float64Array(G).fill(Infinity);
  for (let p = 0; p < P; p++) {
    const g = groupOf[p]!;
    const v = first[p]!;
    if (kept[p]) {
      at[g] = v;
      continue;
    }
    const k = count[g]!;
    const dx = pos[v * 3]! - sum[g * 3]! / k;
    const dy = pos[v * 3 + 1]! - sum[g * 3 + 1]! / k;
    const dz = pos[v * 3 + 2]! - sum[g * 3 + 2]! / k;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < near[g]!) {
      near[g] = d;
      at[g] = v;
    }
  }
  // 5. the triangles that still have area, and the corners they need: one for each color and normal at a place
  const out: number[] = [];
  const from: number[] = [];
  const whose: number[] = [];
  const corners: number[][] = Array.from({ length: G }, () => []);
  const cornerOf = (v: number): number => {
    const g = groupOf[placeOf[v]!]!;
    const list = corners[g]!;
    for (const o of list) {
      const w = from[o]!;
      if (col[w * 3] === col[v * 3] && col[w * 3 + 1] === col[v * 3 + 1] && col[w * 3 + 2] === col[v * 3 + 2] && nor[w * 3] === nor[v * 3] && nor[w * 3 + 1] === nor[v * 3 + 1] && nor[w * 3 + 2] === nor[v * 3 + 2]) return o;
    }
    const o = from.length;
    from.push(v);
    whose.push(g);
    list.push(o);
    return o;
  };
  for (let t = 0; t < m.i; t += 3) {
    const a = idx[t]!;
    const b = idx[t + 1]!;
    const c = idx[t + 2]!;
    const ga = groupOf[placeOf[a]!]!;
    const gb = groupOf[placeOf[b]!]!;
    const gc = groupOf[placeOf[c]!]!;
    if (ga === gb || gb === gc || ga === gc) continue;
    out.push(cornerOf(a), cornerOf(b), cornerOf(c));
  }
  if (out.length > m.i * WORTH || out.length < 3) return m;
  const N = from.length;
  const thin: MeshData = {
    n: N,
    i: out.length,
    min: m.min,
    max: m.max,
    pos: new Float32Array(N * 3),
    nor: new Int8Array(N * 3),
    sn: new Int8Array(N * 3),
    col: new Uint8Array(N * 3),
    skin: skin ? new Uint8Array(N * 3) : undefined,
    idx: new Uint16Array(out),
    rig: m.rig,
  };
  for (let o = 0; o < N; o++) {
    // (its own color and facet; the place, the bones and the ink's direction of whoever stands for its cell)
    const own = from[o]!;
    const rep = at[whose[o]!]!;
    for (let k = 0; k < 3; k++) {
      thin.pos[o * 3 + k] = pos[rep * 3 + k]!;
      thin.sn[o * 3 + k] = sn[rep * 3 + k]!;
      thin.nor[o * 3 + k] = nor[own * 3 + k]!;
      thin.col[o * 3 + k] = col[own * 3 + k]!;
      if (skin) thin.skin![o * 3 + k] = skin[rep * 3 + k]!;
    }
  }
  return thin;
}

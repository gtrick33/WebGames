/**
 * Faces that fight: two faces of a built model lying in the same plane, looking the same way, one over the other.
 * The picture can't tell which is in front, and gives a little of each, changing as the camera moves: a patch of
 * the model flickers (the owner: "some of the gates' textures, the ones top, keep jittering").
 */
export interface Fight {
  plane: string;
  at: [number, number, number];
  area: number;
}

type P2 = [number, number];
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const cross = (a: P2, b: P2): number => a[0] * b[1] - a[1] * b[0];

/** What is left of a polygon on the inner side of the line from `a` to `b`. */
function clip(poly: P2[], a: P2, b: P2): P2[] {
  const out: P2[] = [];
  const side = (p: P2): number => cross(sub(b, a), sub(p, a));
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}
const areaOf = (poly: P2[]): number => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) a += cross(poly[i]!, poly[(i + 1) % poly.length]!);
  return Math.abs(a) / 2;
};

/** Every pair of faces of a model that fight over more than `least` square tiles. Axis-aligned faces only (a builder's boxes and plates). */
export function fights(m: { pos: number[]; nor: number[]; idx: number[]; col: number[] }, least = 0.004): Fight[] {
  const tris: { axis: number; sign: number; d: number; p: P2[]; c: number[]; mid: [number, number, number] }[] = [];
  for (let t = 0; t < m.idx.length; t += 3) {
    const v = [m.idx[t]!, m.idx[t + 1]!, m.idx[t + 2]!];
    const P = v.map((i) => [m.pos[i * 3]!, m.pos[i * 3 + 1]!, m.pos[i * 3 + 2]!]);
    // (the face's own normal: what gives its own light has none stored)
    const e1 = [P[1]![0]! - P[0]![0]!, P[1]![1]! - P[0]![1]!, P[1]![2]! - P[0]![2]!];
    const e2 = [P[2]![0]! - P[0]![0]!, P[2]![1]! - P[0]![1]!, P[2]![2]! - P[0]![2]!];
    const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    const l = Math.hypot(n[0]!, n[1]!, n[2]!);
    if (l < 1e-9) continue;
    const axis = [0, 1, 2].find((a) => Math.abs(Math.abs(n[a]!) / l - 1) < 1e-4);
    if (axis === undefined) continue;
    const others = [0, 1, 2].filter((a) => a !== axis);
    let p = P.map((q) => [q[others[0]!]!, q[others[1]!]!] as P2);
    if (cross(sub(p[1]!, p[0]!), sub(p[2]!, p[0]!)) < 0) p = [p[0]!, p[2]!, p[1]!];
    tris.push({ axis, sign: Math.sign(n[axis]!), d: P[0]![axis]!, p, c: [m.col[v[0]! * 3]!, m.col[v[0]! * 3 + 1]!, m.col[v[0]! * 3 + 2]!], mid: [(P[0]![0]! + P[1]![0]! + P[2]![0]!) / 3, (P[0]![1]! + P[1]![1]! + P[2]![1]!) / 3, (P[0]![2]! + P[1]![2]! + P[2]![2]!) / 3] });
  }
  const out: Fight[] = [];
  for (let i = 0; i < tris.length; i++) {
    for (let j = i + 1; j < tris.length; j++) {
      const a = tris[i]!;
      const b = tris[j]!;
      if (a.axis !== b.axis || a.sign !== b.sign || Math.abs(a.d - b.d) > 1e-4) continue;
      // (two faces of one color over each other show nothing: only a difference flickers)
      if (Math.abs(a.c[0]! - b.c[0]!) + Math.abs(a.c[1]! - b.c[1]!) + Math.abs(a.c[2]! - b.c[2]!) < 0.02) continue;
      let poly: P2[] = a.p;
      for (let k = 0; k < 3 && poly.length; k++) poly = clip(poly, b.p[k]!, b.p[(k + 1) % 3]!);
      const area = poly.length >= 3 ? areaOf(poly) : 0;
      if (area > least) out.push({ plane: `${'xyz'[a.axis]}=${a.d.toFixed(3)} ${a.sign > 0 ? '+' : '-'}`, at: a.mid.map((x) => +x.toFixed(2)) as [number, number, number], area: +area.toFixed(3) });
    }
  }
  return out;
}

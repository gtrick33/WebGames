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

/**
 * Faces of different placed models (or of one model placed twice) lying in one plane over each other, in a land as the
 * game builds it: every instance of every still model in `group`, in the world. Only faces the camera can see (not
 * those looking down or north), and only where `keep` says. Bucketed by plane, so a whole dungeon is quick.
 */
export function placedFights(group: { traverse: (fn: (o: unknown) => void) => void }, keep: (x: number, z: number) => boolean, least = 0.002): Fight[] {
  interface Tri { axis: number; sign: number; d: number; p: P2[]; c: number[]; who: string; mid: [number, number, number] }
  const tris: Tri[] = [];
  const m = new Float32Array(16);
  group.traverse((o) => {
    const mesh = o as { isInstancedMesh?: boolean; count: number; uuid: string; instanceMatrix: { array: ArrayLike<number> }; geometry: { getAttribute: (n: string) => { getX: (i: number) => number; getY: (i: number) => number; getZ: (i: number) => number } | undefined; getIndex: () => { count: number; getX: (i: number) => number } | null } };
    if (!mesh.isInstancedMesh || !mesh.count) return;
    const pos = mesh.geometry.getAttribute('position')!;
    const col = mesh.geometry.getAttribute('aCol');
    const tint = mesh.geometry.getAttribute('iTint');
    const idx = mesh.geometry.getIndex()!;
    for (let k = 0; k < mesh.count; k++) {
      for (let j = 0; j < 16; j++) m[j] = mesh.instanceMatrix.array[k * 16 + j]!;
      const at = (i: number): [number, number, number] => {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        return [m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!];
      };
      const tr = tint ? [tint.getX(k), tint.getY(k), tint.getZ(k)] : [1, 1, 1];
      for (let t = 0; t < idx.count; t += 3) {
        const P = [at(idx.getX(t)), at(idx.getX(t + 1)), at(idx.getX(t + 2))];
        const mid: [number, number, number] = [(P[0]![0] + P[1]![0] + P[2]![0]) / 3, (P[0]![1] + P[1]![1] + P[2]![1]) / 3, (P[0]![2] + P[1]![2] + P[2]![2]) / 3];
        if (!keep(mid[0], mid[2])) continue;
        const e1 = [P[1]![0] - P[0]![0], P[1]![1] - P[0]![1], P[1]![2] - P[0]![2]];
        const e2 = [P[2]![0] - P[0]![0], P[2]![1] - P[0]![1], P[2]![2] - P[0]![2]];
        const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
        const l = Math.hypot(n[0]!, n[1]!, n[2]!);
        if (l < 1e-9) continue;
        const axis = [0, 1, 2].find((a) => Math.abs(Math.abs(n[a]!) / l - 1) < 1e-3);
        // (what looks down, or away north, the camera never sees)
        if (axis === undefined || (axis !== 0 && n[axis]! < 0)) continue;
        const others = [0, 1, 2].filter((a) => a !== axis);
        let p = P.map((q) => [q[others[0]!]!, q[others[1]!]!] as P2);
        if (cross(sub(p[1]!, p[0]!), sub(p[2]!, p[0]!)) < 0) p = [p[0]!, p[2]!, p[1]!];
        const i0 = idx.getX(t);
        const c = col ? [col.getX(i0) * tr[0]!, col.getY(i0) * tr[1]!, col.getZ(i0) * tr[2]!] : tr;
        tris.push({ axis, sign: Math.sign(n[axis]!), d: P[0]![axis]!, p, c, who: `${mesh.uuid}#${k}`, mid });
      }
    }
  });
  const planes = new Map<string, Tri[]>();
  for (const t of tris) {
    const key = `${t.axis}${t.sign}${Math.round(t.d * 1e4)}`;
    const list = planes.get(key) ?? [];
    list.push(t);
    planes.set(key, list);
  }
  const out: Fight[] = [];
  for (const list of planes.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.who === b.who) continue;
        if (Math.abs(a.c[0]! - b.c[0]!) + Math.abs(a.c[1]! - b.c[1]!) + Math.abs(a.c[2]! - b.c[2]!) < 0.03) continue;
        let poly: P2[] = a.p;
        for (let k = 0; k < 3 && poly.length; k++) poly = clip(poly, b.p[k]!, b.p[(k + 1) % 3]!);
        const area = poly.length >= 3 ? areaOf(poly) : 0;
        if (area > least) out.push({ plane: `${'xyz'[a.axis]}=${a.d.toFixed(3)} ${a.sign > 0 ? '+' : '-'}`, at: a.mid.map((x) => +x.toFixed(2)) as [number, number, number], area: +area.toFixed(3) });
      }
    }
  }
  return out;
}

import { hash2 } from '../core/math';
import type { MeshData } from './pack';
import { Bits, withBits } from './repaint';

/**
 * An animal made to look like one. The animals of the art set come as a shape in one flat color: a grey wolf-shape, a
 * pink pig-shape, a black raptor-shape, with no eyes, no nose, no markings, and half the game's beasts were that same
 * wolf in another tint (the boar, the lion, the panther). Beside heroes painted part by part they were the plainest
 * things on the screen (the owner: "they feel just low poly and ugly compared to everything else").
 *
 * So each is painted when its model comes in, by where on the animal a point is (which bone moves it, how high on the
 * body, how far along the head): a coat with a paler belly and a darker back, socks, a muzzle and a nose, ear and
 * tail tips, stripes or spots or seams of fire; and what an animal has that a shape hasn't is built onto it and hung
 * from its own bones so it moves with it: eyes, tusks, a bristled ridge down the back, a mane, a tuft to the tail,
 * curled horns, fangs. One description for each kind of beast (kits.ts `beast`).
 */
export interface Beast {
  coat: string;
  /** Belly, chest and the insides of the legs. */
  under?: string;
  /** Along the top of the back. */
  back?: string;
  /** The lower legs and feet. */
  legs?: string;
  /** The front of the face, and the tip of the nose. */
  muzzle?: string;
  nose?: string;
  ears?: string;
  /** The last third of the tail. */
  tail?: string;
  /** Markings over the body: `lit` ones give their own light (fire in a hound's hide, rot glowing in a wolf's). */
  pattern?: { kind: 'stripes' | 'spots' | 'seams'; color: string; lit?: boolean; scale?: number; amount?: number };
  eyes?: { color: string; size?: number; dark?: boolean };
  /** Tusks from the lower jaw, by how big (1: a boar's). */
  tusks?: number;
  /** Bristles or spines down the neck and back. */
  ridge?: { color: string; size?: number; lit?: boolean };
  /** A mane round the neck. */
  mane?: { color: string; size?: number };
  /** A tuft at the end of the tail. */
  tuft?: string;
  /** Horns: a ram's curl, or short spikes. */
  horns?: { kind: 'ram' | 'spikes'; color: string; size?: number };
  fangs?: boolean;
  /** The head and the front of the neck in a color of their own (a griffon's eagle head on a lion's body). */
  head?: string;
  /** A hooked beak over the muzzle. */
  beak?: string;
  /** Feathered wings from the shoulders, half spread: `tip` the color of the long feathers' ends. */
  wings?: { color: string; tip?: string; size?: number };
  /**
   * For a model whose head carries antlers: what share of the head's height is skull (the rest, above, is antler), and
   * the antlers' color. The eyes and the muzzle are then found on the skull, not up among the tines.
   */
  antlers?: { skull: number; color: string };
}

type V3 = [number, number, number];
const hex = (h: string): V3 => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: readonly number[], b: readonly number[], t: number): V3 => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1e-6)));
  return t * t * (3 - 2 * t);
};
const shade = (c: readonly number[], k: number): V3 => [c[0]! * k, c[1]! * k, c[2]! * k];

/** What part of an animal a bone moves. */
type Part = 'head' | 'neck' | 'ear' | 'tail' | 'foot' | 'leg' | 'body';
function partOf(name: string): Part {
  if (/^head$/i.test(name)) return 'head';
  if (/^neck/i.test(name)) return 'neck';
  if (/^ear/i.test(name)) return 'ear';
  if (/^tail/i.test(name)) return 'tail';
  if (/lower|lowleg|foot/i.test(name)) return 'foot';
  if (/leg|shoulder\.[lr]$/i.test(name)) return 'leg';
  return 'body';
}

interface Box {
  min: V3;
  max: V3;
}
const grow = (b: Box, x: number, y: number, z: number): void => {
  b.min[0] = Math.min(b.min[0], x);
  b.min[1] = Math.min(b.min[1], y);
  b.min[2] = Math.min(b.min[2], z);
  b.max[0] = Math.max(b.max[0], x);
  b.max[1] = Math.max(b.max[1], y);
  b.max[2] = Math.max(b.max[2], z);
};
const emptyBox = (): Box => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });

/**
 * A tapering length of horn, tusk, bristle or fur from `p0` to `p1`, five-sided: `r0` thick at its root, `r1` at its
 * end. Every face is turned to look outward, whichever way the length runs (a face turned inward isn't drawn, and all
 * that shows of the piece is the ink line behind it: a black horn).
 */
function prism(b: Bits, p0: readonly number[], p1: readonly number[], r0: number, r1: number, c0: readonly number[], c1: readonly number[], lit = false): void {
  const d = [p1[0]! - p0[0]!, p1[1]! - p0[1]!, p1[2]! - p0[2]!];
  const l = Math.hypot(d[0]!, d[1]!, d[2]!) || 1;
  const up = Math.abs(d[1]! / l) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = [d[1]! * up[2]! - d[2]! * up[1]!, d[2]! * up[0]! - d[0]! * up[2]!, d[0]! * up[1]! - d[1]! * up[0]!];
  const ul = Math.hypot(u[0]!, u[1]!, u[2]!) || 1;
  for (let i = 0; i < 3; i++) u[i] = u[i]! / ul;
  const v = [(d[1]! * u[2]! - d[2]! * u[1]!) / l, (d[2]! * u[0]! - d[0]! * u[2]!) / l, (d[0]! * u[1]! - d[1]! * u[0]!) / l];
  const SIDES = 5;
  const ring = (p: readonly number[], r: number): number[][] =>
    Array.from({ length: SIDES }, (_, k) => {
      const a = (k / SIDES) * Math.PI * 2;
      return [0, 1, 2].map((i) => p[i]! + (u[i]! * Math.cos(a) + v[i]! * Math.sin(a)) * r);
    });
  const mid = [(p0[0]! + p1[0]!) / 2, (p0[1]! + p1[1]!) / 2, (p0[2]! + p1[2]!) / 2];
  const face = (a: readonly number[], bb: readonly number[], c: readonly number[], ca: readonly number[], cb: readonly number[], cc: readonly number[], la: boolean, lb: boolean, lc: boolean): void => {
    const nx = (bb[1]! - a[1]!) * (c[2]! - a[2]!) - (bb[2]! - a[2]!) * (c[1]! - a[1]!);
    const ny = (bb[2]! - a[2]!) * (c[0]! - a[0]!) - (bb[0]! - a[0]!) * (c[2]! - a[2]!);
    const nz = (bb[0]! - a[0]!) * (c[1]! - a[1]!) - (bb[1]! - a[1]!) * (c[0]! - a[0]!);
    const ox = (a[0]! + bb[0]! + c[0]!) / 3 - mid[0]!;
    const oy = (a[1]! + bb[1]! + c[1]!) / 3 - mid[1]!;
    const oz = (a[2]! + bb[2]! + c[2]!) / 3 - mid[2]!;
    // (out from the length's own axis: what is left of `o` once its share along the axis is taken off)
    const along = (ox * d[0]! + oy * d[1]! + oz * d[2]!) / (l * l);
    const out = nx * (ox - d[0]! * along) + ny * (oy - d[1]! * along) + nz * (oz - d[2]! * along);
    if (out >= 0) b.tri(a, bb, c, ca, cb, cc, [la, lb, lc]);
    else b.tri(a, c, bb, ca, cc, cb, [la, lc, lb]);
  };
  const a = ring(p0, r0);
  const z = ring(p1, r1);
  for (let k = 0; k < SIDES; k++) {
    const n = (k + 1) % SIDES;
    // (all of a piece that gives light gives it: a corner that doesn't would leave the ink line behind half a face)
    face(a[k]!, z[n]!, a[n]!, c0, c1, c0, lit, lit, lit);
    if (r1 > 0) face(a[k]!, z[k]!, z[n]!, c0, c1, c1, lit, lit, lit);
  }
}

/** A small faceted stone: an eye, a nose. */
function gem(b: Bits, c: readonly number[], rx: number, ry: number, rz: number, color: readonly number[], lit: boolean): void {
  const p = (x: number, y: number, z: number): number[] => [c[0]! + x * rx, c[1]! + y * ry, c[2]! + z * rz];
  const top = p(0, 1, 0);
  const bot = p(0, -1, 0);
  const ring = [p(1, 0, 0), p(0, 0, 1), p(-1, 0, 0), p(0, 0, -1)];
  const on: [boolean, boolean, boolean] = [lit, lit, lit];
  const face = (a: readonly number[], bb: readonly number[], d: readonly number[]): void => {
    const nx = (bb[1]! - a[1]!) * (d[2]! - a[2]!) - (bb[2]! - a[2]!) * (d[1]! - a[1]!);
    const ny = (bb[2]! - a[2]!) * (d[0]! - a[0]!) - (bb[0]! - a[0]!) * (d[2]! - a[2]!);
    const nz = (bb[0]! - a[0]!) * (d[1]! - a[1]!) - (bb[1]! - a[1]!) * (d[0]! - a[0]!);
    const out = nx * ((a[0]! + bb[0]! + d[0]!) / 3 - c[0]!) + ny * ((a[1]! + bb[1]! + d[1]!) / 3 - c[1]!) + nz * ((a[2]! + bb[2]! + d[2]!) / 3 - c[2]!);
    if (out >= 0) b.tri(a, bb, d, color, color, color, on);
    else b.tri(a, d, bb, color, color, color, on);
  };
  for (let k = 0; k < 4; k++) {
    const a = ring[k]!;
    const n = ring[(k + 1) % 4]!;
    face(a, top, n);
    face(n, bot, a);
  }
}

/**
 * The model painted and dressed as `spec` says. `joints`: its bones' names, in the order its vertices name them.
 * Lengths are taken from the animal itself (its height, its head), so the same description fits a model of any scale.
 */
export function beastOf(m: MeshData, joints: readonly string[], spec: Beast): MeshData {
  if (!m.skin) return m;
  const parts = joints.map(partOf);
  const tails = joints.map((j) => Number(/^tail(\d+)/i.exec(j)?.[1] ?? 0));
  const lastTail = Math.max(1, ...tails);
  const ears = joints.map((j) => Number(/^ear(\d+)/i.exec(j)?.[1] ?? 0));
  const used = new Uint8Array(m.n);
  for (let t = 0; t < m.i; t++) used[m.idx[t]!] = 1;
  // the animal's own measures: its whole height, its trunk, its head
  const all = emptyBox();
  const trunk = emptyBox();
  const head = emptyBox();
  for (let v = 0; v < m.n; v++) {
    if (!used[v]) continue;
    const x = m.pos[v * 3]!;
    const y = m.pos[v * 3 + 1]!;
    const z = m.pos[v * 3 + 2]!;
    grow(all, x, y, z);
    const part = parts[m.skin[v * 3]!] ?? 'body';
    if (part === 'body' || part === 'neck') grow(trunk, x, y, z);
    if (part === 'head' && m.skin[v * 3 + 2]! > 150) grow(head, x, y, z);
  }
  const H = all.max[1] - all.min[1] || 1;
  const coat = hex(spec.coat);
  const coat0 = (): V3 => coat;
  if (!Number.isFinite(trunk.min[1])) Object.assign(trunk, all);
  if (!Number.isFinite(head.min[1])) Object.assign(head, { min: [all.min[0], all.max[1] - H * 0.3, all.max[2] - H * 0.3], max: [...all.max] });
  // (antlers are head too: the skull is the lower share of it, and is measured again without them)
  const antlerFrom = spec.antlers ? head.min[1] + (head.max[1] - head.min[1]) * spec.antlers.skull : Infinity;
  if (spec.antlers) {
    const skull = emptyBox();
    for (let v = 0; v < m.n; v++) {
      if (!used[v] || (parts[m.skin[v * 3]!] ?? 'body') !== 'head') continue;
      if (m.pos[v * 3 + 1]! < antlerFrom) grow(skull, m.pos[v * 3]!, m.pos[v * 3 + 1]!, m.pos[v * 3 + 2]!);
    }
    if (Number.isFinite(skull.min[1])) Object.assign(head, skull);
  }
  const antler = spec.antlers ? hex(spec.antlers.color) : coat0();
  const hh = head.max[1] - head.min[1] || 1;
  const hl = head.max[2] - head.min[2] || 1;
  const hw = head.max[0] - head.min[0] || 1;
  const under = spec.under ? hex(spec.under) : shade(mix(coat, [255, 250, 240], 0.32), 1);
  const back = spec.back ? hex(spec.back) : shade(coat, 0.72);
  const legs = spec.legs ? hex(spec.legs) : shade(coat, 0.62);
  const muzzle = spec.muzzle ? hex(spec.muzzle) : under;
  const nose = spec.nose === 'none' ? muzzle : hex(spec.nose ?? '#1a1416');
  const earTip = spec.ears ? hex(spec.ears) : shade(coat, 0.6);
  const tailTip = spec.tail ? hex(spec.tail) : shade(coat, 0.7);
  const mark = spec.pattern ? hex(spec.pattern.color) : coat;
  const col = new Uint8Array(m.col);
  const nor = new Int8Array(m.nor);
  const lit = new Uint8Array(m.n);
  const scale = (spec.pattern?.scale ?? 1) / H;
  for (let v = 0; v < m.n; v++) {
    const x = m.pos[v * 3]!;
    const y = m.pos[v * 3 + 1]!;
    const z = m.pos[v * 3 + 2]!;
    const j = m.skin[v * 3]!;
    const part = parts[j] ?? 'body';
    const ny = m.sn[v * 3 + 1]! / 127;
    // (how high on the trunk: 0 at the belly line, 1 along the spine)
    const up = (y - trunk.min[1]) / (trunk.max[1] - trunk.min[1] || 1);
    const tall = (y - all.min[1]) / H;
    let c: V3 = coat;
    let glow = 0;
    if (part === 'body' || part === 'neck' || part === 'leg') {
      const belly = Math.min(1, smooth(0.5, 0.18, up) + Math.max(0, -ny) * 0.55);
      c = mix(c, under, belly * 0.9);
      c = mix(c, back, smooth(0.72, 0.98, up) * Math.max(0, ny) * 0.9);
      if (spec.pattern && up > 0.3) {
        const p = spec.pattern;
        let w: number;
        if (p.kind === 'stripes') w = smooth(0.45, 0.8, Math.sin(z * scale * 16 + Math.abs(x) * scale * 7 + Math.sin(y * scale * 9) * 0.8)) * smooth(0.3, 0.55, up);
        else if (p.kind === 'spots') {
          const f = scale * 9;
          const cx = Math.floor(z * f);
          const cy = Math.floor((y + Math.abs(x)) * f);
          const here = hash2(cx, cy, 17);
          const dz = z * f - cx - 0.5;
          const dy = (y + Math.abs(x)) * f - cy - 0.5;
          w = here > 0.45 ? smooth(0.42, 0.22, Math.hypot(dz, dy)) : 0;
        } else {
          // seams: thin lines where two fields of noise meet
          const n = Math.sin(z * scale * 11 + Math.sin(y * scale * 13) * 1.7) + Math.sin(y * scale * 15 + Math.abs(x) * scale * 12 + 1.3);
          w = smooth(0.34, 0.06, Math.abs(n));
        }
        w *= p.amount ?? 1;
        c = mix(c, mark, w);
        if (p.lit) glow = w;
      }
    }
    if (part === 'leg' || part === 'foot') c = mix(c, legs, smooth(0.34, 0.08, tall));
    if (part === 'head' && y >= antlerFrom) {
      // an antler: pale at its tines, darker at its root
      c = mix(shade(antler, 0.62), antler, smooth(antlerFrom, all.max[1], y));
    } else if (part === 'head') {
      const fwd = (z - head.min[2]) / hl;
      const low = 1 - (y - head.min[1]) / hh;
      c = mix(c, muzzle, smooth(0.5, 0.82, fwd) * smooth(0.25, 0.6, low));
      c = mix(c, back, smooth(0.75, 1, 1 - low) * smooth(0.6, 0.2, fwd) * 0.6);
      c = mix(c, nose, smooth(0.9, 0.97, fwd) * smooth(0.75, 0.35, low));
    }
    if (spec.head && (part === 'head' || part === 'ear')) c = mix(c, hex(spec.head), part === 'ear' ? 0.8 : 0.92);
    if (spec.head && part === 'neck') c = mix(c, hex(spec.head), smooth(head.min[2] - hl * 1.1, head.min[2], z) * 0.9);
    if (part === 'ear') c = mix(c, earTip, ears[j]! >= 3 ? 0.9 : 0.3);
    if (part === 'tail') c = mix(c, tailTip, smooth(0.55, 0.9, tails[j]! / lastTail));
    // (a little of every hair its own shade)
    const k = 0.93 + hash2(Math.round(x / H * 40), Math.round((y + z) / H * 40), 9) * 0.14;
    col[v * 3] = Math.min(255, c[0] * k);
    col[v * 3 + 1] = Math.min(255, c[1] * k);
    col[v * 3 + 2] = Math.min(255, c[2] * k);
    if (glow > 0.3) lit[v] = 1;
  }
  // What gives its own light does so a whole face at a time: the ink line round a figure is left off where it glows,
  // corner by corner, and a face with one corner alight had its ink dragged off to nowhere (a black shape under the
  // animal). So a corner on any face that isn't alight all round is put out.
  // (and putting one out can leave a neighbor face half alight in its turn: so again, until nothing changes)
  for (let again = true; again; ) {
    again = false;
    for (let t = 0; t < m.i; t += 3) {
      const a = m.idx[t]!;
      const bb = m.idx[t + 1]!;
      const c = m.idx[t + 2]!;
      const n = lit[a]! + lit[bb]! + lit[c]!;
      if (n === 0 || n === 3) continue;
      lit[a] = lit[bb] = lit[c] = 0;
      again = true;
    }
  }
  for (let v = 0; v < m.n; v++) if (lit[v]) nor[v * 3] = nor[v * 3 + 1] = nor[v * 3 + 2] = 0;
  let out: MeshData = { ...m, col, nor };

  // ---- what is built onto it, each piece hung from the bone that moves the skin it stands on
  const built = new Map<number, Bits>();
  const on = (joint: number): Bits => {
    let b = built.get(joint);
    if (!b) built.set(joint, (b = new Bits()));
    return b;
  };
  const headJ = parts.indexOf('head');
  /** The vertex of a part that is furthest along `score`, among those `ok` lets through. */
  const find = (want: (part: Part, j: number) => boolean, ok: (x: number, y: number, z: number) => boolean, score: (x: number, y: number, z: number) => number): { p: V3; j: number } | null => {
    let best = -Infinity;
    let hit: { p: V3; j: number } | null = null;
    for (let v = 0; v < m.n; v++) {
      if (!used[v]) continue;
      const j = m.skin![v * 3]!;
      if (!want(parts[j] ?? 'body', j)) continue;
      const x = m.pos[v * 3]!;
      const y = m.pos[v * 3 + 1]!;
      const z = m.pos[v * 3 + 2]!;
      if (!ok(x, y, z)) continue;
      const s = score(x, y, z);
      if (s > best) {
        best = s;
        hit = { p: [x, y, z], j };
      }
    }
    return hit;
  };
  const inHead = (part: Part): boolean => part === 'head';
  const skullOnly = (y: number): boolean => y < antlerFrom;
  const hx = (head.min[0] + head.max[0]) / 2;
  const fwdOf = (z: number): number => (z - head.min[2]) / hl;
  const highOf = (y: number): number => (y - head.min[1]) / hh;

  if (spec.eyes && headJ >= 0) {
    const ec = hex(spec.eyes.color);
    const k = spec.eyes.size ?? 1;
    for (const s of [-1, 1]) {
      // on the side of the skull, a little above its middle and behind the muzzle
      const at = find(inHead, (_x, y, z) => skullOnly(y) && highOf(y) > 0.5 && highOf(y) < 0.82 && fwdOf(z) > 0.38 && fwdOf(z) < 0.66, (x) => s * (x - hx));
      if (!at) continue;
      const c: V3 = [at.p[0] + s * hw * 0.01, at.p[1], at.p[2]];
      // a dark rim, the eye itself alight in it, a pale point of light
      gem(on(at.j), c, hw * 0.11 * k, hh * 0.125 * k, hl * 0.11 * k, [14, 10, 12], false);
      gem(on(at.j), [c[0] + s * hw * 0.045 * k, c[1], c[2] + hl * 0.016], hw * 0.085 * k, hh * 0.092 * k, hl * 0.08 * k, ec, !spec.eyes.dark);
      gem(on(at.j), [c[0] + s * hw * 0.11 * k, c[1] + hh * 0.04 * k, c[2] + hl * 0.045 * k], hw * 0.028 * k, hh * 0.03 * k, hl * 0.028 * k, [255, 255, 255], true);
    }
  }
  if (headJ >= 0 && spec.nose !== 'none') {
    const tip = find(inHead, (_x, y) => highOf(y) > 0.2 && highOf(y) < 0.75, (_x, _y, z) => z);
    if (tip) gem(on(tip.j), [hx, tip.p[1] + hh * 0.03, tip.p[2] - hl * 0.01], hw * 0.1, hh * 0.07, hl * 0.05, nose, false);
  }
  if (spec.tusks && headJ >= 0) {
    const ivory: V3 = [240, 228, 196];
    const k = spec.tusks;
    for (const s of [-1, 1]) {
      const at = find(inHead, (_x, y, z) => highOf(y) < 0.42 && fwdOf(z) > 0.62 && fwdOf(z) < 0.86, (x) => s * (x - hx));
      if (!at) continue;
      // out of the jaw, sweeping out and up to a point
      const p0: V3 = [at.p[0] - s * hw * 0.04, at.p[1], at.p[2]];
      const p1: V3 = [p0[0] + s * hw * 0.2 * k, p0[1] + hh * 0.16 * k, p0[2] + hl * 0.12 * k];
      const p2: V3 = [p1[0] + s * hw * 0.1 * k, p1[1] + hh * 0.3 * k, p1[2] + hl * 0.02 * k];
      prism(on(at.j), p0, p1, hw * 0.1 * k, hw * 0.075 * k, shade(ivory, 0.8), ivory);
      prism(on(at.j), p1, p2, hw * 0.075 * k, 0, ivory, [255, 250, 236]);
    }
  }
  if (spec.fangs && headJ >= 0) {
    const ivory: V3 = [244, 238, 220];
    for (const s of [-1, 1]) {
      const at = find(inHead, (x, y, z) => highOf(y) < 0.4 && fwdOf(z) > 0.74 && s * (x - hx) > hw * 0.08, (_x, _y, z) => z);
      if (at) prism(on(at.j), [at.p[0], at.p[1] + hh * 0.04, at.p[2] - hl * 0.03], [at.p[0], at.p[1] - hh * 0.2, at.p[2] - hl * 0.02], hw * 0.035, 0, ivory, ivory);
    }
  }
  if (spec.horns && headJ >= 0) {
    const hc = hex(spec.horns.color);
    const k = spec.horns.size ?? 1;
    for (const s of [-1, 1]) {
      const at = find(inHead, (x, _y, z) => s * (x - hx) > hw * 0.12 && fwdOf(z) < 0.5, (_x, y) => y);
      if (!at) continue;
      if (spec.horns.kind === 'spikes') {
        prism(on(at.j), at.p, [at.p[0] + s * hw * 0.12 * k, at.p[1] + hh * 0.5 * k, at.p[2] - hl * 0.12 * k], hw * 0.07 * k, 0, shade(hc, 0.7), hc);
        continue;
      }
      // a ram's curl: back from the crown, down round the ear and forward again, thinning as it goes
      let p: V3 = [at.p[0], at.p[1] - hh * 0.03, at.p[2]];
      const R = hh * 0.26 * k;
      const mid: V3 = [p[0] + s * hw * 0.16 * k, p[1] - R * 0.55, p[2] - R * 0.5];
      const N = 8;
      for (let i = 1; i <= N; i++) {
        const a = (i / N) * Math.PI * 1.55 + Math.PI * 0.42;
        const q: V3 = [mid[0] + s * hw * 0.1 * k * (i / N), mid[1] + Math.sin(a) * R, mid[2] + Math.cos(a) * R];
        const r0 = hw * 0.2 * k * (1 - (i - 1) / (N + 2));
        const r1 = i === N ? 0 : hw * 0.2 * k * (1 - i / (N + 2));
        prism(on(at.j), p, q, r0, r1, shade(hc, 0.7 + (i % 2) * 0.16), shade(hc, 0.86 + (i % 2) * 0.14));
        p = q;
      }
    }
  }
  if (spec.beak && headJ >= 0) {
    const bc = hex(spec.beak);
    const tip = find(inHead, (_x, y) => highOf(y) > 0.2 && highOf(y) < 0.8, (_x, _y, z) => z);
    if (tip) {
      // over the muzzle and hooked down at its end
      const root: V3 = [hx, tip.p[1] + hh * 0.12, tip.p[2] - hl * 0.3];
      const mid: V3 = [hx, tip.p[1] + hh * 0.04, tip.p[2] + hl * 0.12];
      const end: V3 = [hx, tip.p[1] - hh * 0.26, tip.p[2] + hl * 0.2];
      prism(on(tip.j), root, mid, hw * 0.3, hw * 0.2, bc, shade(bc, 1.1));
      prism(on(tip.j), mid, end, hw * 0.2, 0, shade(bc, 1.1), shade(bc, 0.7));
    }
  }
  const spine = (part: Part): boolean => part === 'body' || part === 'neck';
  const cxTrunk = (trunk.min[0] + trunk.max[0]) / 2;
  const tw = trunk.max[0] - trunk.min[0] || 1;
  if (spec.ridge) {
    const rc = hex(spec.ridge.color);
    const k = spec.ridge.size ?? 1;
    const z0 = trunk.min[2] + (trunk.max[2] - trunk.min[2]) * 0.12;
    const z1 = trunk.max[2] - (trunk.max[2] - trunk.min[2]) * 0.02;
    const N = 26;
    for (let i = 0; i < N; i++) {
      const zc = z0 + ((i + 0.5) / N) * (z1 - z0);
      const band = (z1 - z0) / N;
      const at = find(spine, (x, _y, z) => Math.abs(z - zc) < band * 1.1 && Math.abs(x - cxTrunk) < tw * 0.14, (_x, y) => y);
      if (!at) continue;
      // a close row of short tufts, each leaning back, tallest over the shoulders (where a boar's bristles stand)
      const tallest = 0.45 + 0.55 * Math.sin((i / (N - 1)) * Math.PI) + (i > N * 0.6 ? 0.2 : 0);
      const h = H * 0.05 * k * tallest * (0.8 + hash2(i, 3, 7) * 0.4);
      const lean = -H * 0.035 * k;
      const side = (hash2(i, 3, 5) - 0.5) * tw * 0.09;
      const tone = 0.8 + hash2(i, 5, 9) * 0.5;
      prism(on(at.j), [at.p[0] + side, at.p[1] - h * 0.3, at.p[2]], [at.p[0] + side * 1.4, at.p[1] + h, at.p[2] + lean], tw * 0.085 * k, 0, shade(rc, 0.8 * tone), shade(rc, tone), !!spec.ridge.lit);
    }
  }
  if (spec.mane) {
    const mc = hex(spec.mane.color);
    const k = spec.mane.size ?? 1;
    // tufts standing off the neck all round it, swept back, longest under the jaw and over the shoulders
    let n = 0;
    for (let v = 0; v < m.n; v++) {
      if (!used[v]) continue;
      const j = m.skin[v * 3]!;
      const part = parts[j] ?? 'body';
      const z = m.pos[v * 3 + 2]!;
      const nearNeck = part === 'neck' || (part === 'head' && fwdOf(z) < 0.3) || (part === 'body' && z > head.min[2] - hl * 0.9 && z < head.min[2]);
      if (!nearNeck || hash2(v, 7, 21) > 0.62) continue;
      const x = m.pos[v * 3]!;
      const y = m.pos[v * 3 + 1]!;
      const nx = m.sn[v * 3]! / 127;
      const nyy = m.sn[v * 3 + 1]! / 127;
      const len = hh * (0.26 + hash2(v, 3, 23) * 0.2) * k;
      const tone = 0.8 + hash2(v, 5, 25) * 0.45;
      prism(on(j), [x - nx * len * 0.2, y - nyy * len * 0.2, z], [x + nx * len * 0.55, y + nyy * len * 0.55 - len * 0.3, z - len * 0.9], hh * 0.085 * k, 0, shade(mc, tone * 0.82), shade(mc, tone));
      if (++n > 340) break;
    }
  }
  if (spec.wings) {
    const wc = hex(spec.wings.color);
    const wt = hex(spec.wings.tip ?? spec.wings.color);
    const k = spec.wings.size ?? 1;
    const tl = trunk.max[2] - trunk.min[2] || 1;
    const zs = trunk.max[2] - tl * 0.3;
    for (const s of [-1, 1]) {
      // from the top of the shoulder: an arm of the wing out and up, and the long feathers fanned back from it
      const at = find(spine, (x, _y, z) => Math.abs(z - zs) < tl * 0.12 && s * (x - cxTrunk) > tw * 0.12, (_x, y) => y);
      if (!at) continue;
      const root: V3 = [at.p[0], at.p[1] - H * 0.02, at.p[2]];
      const wrist: V3 = [root[0] + s * H * 0.3 * k, root[1] + H * 0.34 * k, root[2] - H * 0.05 * k];
      prism(on(at.j), root, wrist, H * 0.07 * k, H * 0.045 * k, shade(wc, 0.8), wc);
      const N = 8;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        // (along the arm: the inner feathers short and close to the back, the outer long and swept away behind)
        const from: V3 = [root[0] + (wrist[0] - root[0]) * (0.25 + t * 0.75), root[1] + (wrist[1] - root[1]) * (0.25 + t * 0.75), root[2] + (wrist[2] - root[2]) * (0.25 + t * 0.75)];
        const len = H * (0.34 + t * 0.34) * k;
        const to: V3 = [from[0] + s * len * (0.15 + t * 0.5), from[1] - len * (0.25 - t * 0.45), from[2] - len * (0.85 - t * 0.25)];
        prism(on(at.j), from, to, H * 0.06 * k, 0, i % 2 ? wc : shade(wc, 0.86), wt);
      }
    }
  }
  if (spec.tuft) {
    const tc = hex(spec.tuft);
    const end = find((part, j) => part === 'tail' && tails[j] === lastTail, () => true, (_x, _y, z) => -z);
    if (end) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        prism(on(end.j), end.p, [end.p[0] + Math.cos(a) * H * 0.035, end.p[1] + Math.sin(a) * H * 0.035, end.p[2] - H * 0.1], H * 0.035, 0, shade(tc, 0.8), tc);
      }
    }
  }
  for (const [joint, bits] of built) if (bits.pos.length) out = withBits(out, bits, joint);
  return out;
}

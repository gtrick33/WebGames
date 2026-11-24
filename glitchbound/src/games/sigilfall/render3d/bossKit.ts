import { cornerOf, Part } from './meshKit';
import { mergeMeshes, type MeshData, type Pack, type RigData } from './pack';
import { Bits, boxOf, withBits } from './repaint';
import { RigAnim, type Bend } from './toon';

/**
 * Bosses of their own (NINE_PLAN.md, piece 2). A boss's file (`k/boss_<id>.pack`, scripts/sigilfall-3d-assets.mjs
 * BOSS_KITS) is parts of several of the packs' figures on one skeleton, with things tied to its bones. Here is the rest
 * of what makes it its own, in the browser as it loads: what is built onto it (`BossForm.build`), how it carries itself
 * (`bend`), and which of its skeleton's moves it makes for each thing the rules have it do (`moves`, and the moments
 * of its fight: shown for the first time, a phase changing, dazed, its fall).
 *
 * A boss is related to its soldiers by color and by what it is made of, and is nobody's model scaled up. What it is
 * built of here is the same low-poly stuff as the rest of the game: flat faces, colors in the vertices, light of its
 * own only where there is magic.
 */

type Box = { min: [number, number, number]; max: [number, number, number] };
const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const shade = (c: readonly number[], k: number): number[] => [Math.min(255, c[0]! * k), Math.min(255, c[1]! * k), Math.min(255, c[2]! * k)];

/**
 * Cloth laid over part of the figure: every face that hangs from `joint` and lies wholly where `inside` says, raised
 * `puff` off the skin, in one color.
 */
function draped(m: MeshData, joint: number, inside: (x: number, y: number, z: number) => boolean, puff: number, color: readonly number[]): MeshData {
  const out = new Part();
  const c: [number, number, number] = [color[0]! / 255, color[1]! / 255, color[2]! / 255];
  for (let t = 0; t < m.i; t += 3) {
    const tri = [m.idx[t]!, m.idx[t + 1]!, m.idx[t + 2]!];
    if (!tri.every((v) => m.skin?.[v * 3] === joint && m.skin[v * 3 + 2]! >= 128 && inside(m.pos[v * 3]!, m.pos[v * 3 + 1]!, m.pos[v * 3 + 2]!))) continue;
    const ids = tri.map((v) => out.corner(cornerOf(m, v), c, puff));
    out.idx.push(ids[0]!, ids[1]!, ids[2]!);
  }
  return out.data(m.rig);
}

/**
 * A four-sided post from `p0` to `p1`, `r0` thick at its foot and `r1` at its end, every face turned outward whichever
 * way it runs (repaint.ts `prism` is made for horns that sweep sideways, and stood upright it shows its inside).
 */
function post(b: Bits, p0: readonly number[], p1: readonly number[], r0: number, r1: number, c0: readonly number[], c1: readonly number[], lit = false): void {
  const d = [p1[0]! - p0[0]!, p1[1]! - p0[1]!, p1[2]! - p0[2]!];
  const l = Math.hypot(d[0]!, d[1]!, d[2]!) || 1;
  const up = Math.abs(d[1]! / l) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = [d[1]! * up[2]! - d[2]! * up[1]!, d[2]! * up[0]! - d[0]! * up[2]!, d[0]! * up[1]! - d[1]! * up[0]!];
  const ul = Math.hypot(u[0]!, u[1]!, u[2]!) || 1;
  for (let i = 0; i < 3; i++) u[i] = u[i]! / ul;
  const v = [(d[1]! * u[2]! - d[2]! * u[1]!) / l, (d[2]! * u[0]! - d[0]! * u[2]!) / l, (d[0]! * u[1]! - d[1]! * u[0]!) / l];
  const ring = (p: readonly number[], r: number): number[][] =>
    [0, 1, 2, 3].map((k) => {
      const a = ((k + 0.5) / 4) * Math.PI * 2;
      return [0, 1, 2].map((i) => p[i]! + (u[i]! * Math.cos(a) + v[i]! * Math.sin(a)) * r);
    });
  const a = ring(p0, r0);
  const z = ring(p1, r1);
  const mid = [(p0[0]! + p1[0]!) / 2, (p0[1]! + p1[1]!) / 2, (p0[2]! + p1[2]!) / 2];
  const face = (q0: number[], q1: number[], q2: number[], k0: readonly number[], k1: readonly number[], k2: readonly number[], l0: boolean, l1: boolean, l2: boolean): void => {
    // (outward: away from the post's own middle)
    const nx = (q1[1]! - q0[1]!) * (q2[2]! - q0[2]!) - (q1[2]! - q0[2]!) * (q2[1]! - q0[1]!);
    const ny = (q1[2]! - q0[2]!) * (q2[0]! - q0[0]!) - (q1[0]! - q0[0]!) * (q2[2]! - q0[2]!);
    const nz = (q1[0]! - q0[0]!) * (q2[1]! - q0[1]!) - (q1[1]! - q0[1]!) * (q2[0]! - q0[0]!);
    const out = nx * (q0[0]! - mid[0]!) + ny * (q0[1]! - mid[1]!) + nz * (q0[2]! - mid[2]!);
    if (out >= 0) b.tri(q0, q1, q2, k0, k1, k2, [l0, l1, l2]);
    else b.tri(q0, q2, q1, k0, k2, k1, [l0, l2, l1]);
  };
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    face(a[k]!, a[n]!, z[n]!, c0, c0, c1, false, false, lit);
    face(a[k]!, z[n]!, z[k]!, c0, c1, c1, false, lit, lit);
  }
  // its end, closed
  if (r1 > 0.003) {
    face(z[0]!, z[1]!, z[2]!, c1, c1, c1, lit, lit, lit);
    face(z[0]!, z[2]!, z[3]!, c1, c1, c1, lit, lit, lit);
  }
}

/** A candle stub with its flame: wax to a wick, and a tongue of light over it. */
function candle(b: Bits, at: readonly number[], tall: number, thick: number, wax: readonly number[], flame: readonly number[]): void {
  const top = [at[0]!, at[1]! + tall, at[2]!];
  post(b, at, top, thick, thick * 0.86, shade(wax, 0.82), wax);
  const mid = [top[0]!, top[1]! + tall * 0.5, top[2]!];
  post(b, top, mid, thick * 0.62, thick * 0.92, flame, flame, true);
  post(b, mid, [top[0]! + thick * 0.2, top[1]! + tall * 1.3, top[2]!], thick * 0.92, 0.002, flame, [255, 255, 255], true);
}

/* ------------------------------------------------------------------ the Coffin Matron */

const GRAVE_LIGHT = hex('#9cff9c');
const VEIL = hex('#1c1822');
const WAX = hex('#e9e2cc');

/**
 * The Coffin Matron: over her white hair a mourner's black veil, falling to her shoulders, and on her crown three
 * grave candles burning the crypt's green. (Her eyes are alight by her paint: render3d/kits.ts.)
 */
function matron(m: MeshData, joints: readonly string[]): MeshData {
  const head = joints.indexOf('head');
  const box = head >= 0 ? (boxOf(m, head) as Box | null) : null;
  if (!box) return m;
  const cx = (box.min[0] + box.max[0]) / 2;
  const cz = (box.min[2] + box.max[2]) / 2;
  const hh = box.max[1] - box.min[1];
  const wide = box.max[0] - box.min[0];
  const deep = box.max[2] - box.min[2];
  // the veil: the crown and back of her head, down to the nape (her face and the hair that frames it are left)
  const veil = draped(m, head, (_x, y, z) => (y > box.min[1] + hh * 0.8 && z < cz + deep * 0.16) || (z < cz - deep * 0.2 && y > box.min[1] + hh * 0.18), hh * 0.035, VEIL);
  const bits = new Bits();
  // its fall behind her, from the nape to between the shoulders
  {
    const y0 = box.min[1] + hh * 0.3;
    const y1 = box.min[1] - hh * 0.42;
    const z0 = box.min[2] - deep * 0.02;
    const z1 = box.min[2] - deep * 0.16;
    const w0 = wide * 0.46;
    const w1 = wide * 0.62;
    const a = [cx - w0, y0, z0];
    const b = [cx + w0, y0, z0];
    const c = [cx + w1, y1, z1];
    const d = [cx - w1, y1, z1];
    const mid0 = [cx, y0, z0 - deep * 0.06];
    const mid1 = [cx, y1 - hh * 0.08, z1 - deep * 0.05];
    // (two panes meeting in a fold down the middle, seen from behind and from before)
    bits.quad(b, mid0, mid1, c, shade(VEIL, 0.8), VEIL);
    bits.quad(mid0, a, d, mid1, shade(VEIL, 0.8), VEIL);
    bits.quad(mid0, b, c, mid1, shade(VEIL, 0.7), shade(VEIL, 0.9));
    bits.quad(a, mid0, mid1, d, shade(VEIL, 0.7), shade(VEIL, 0.9));
  }
  // three grave candles on her crown, the middle one tallest
  const top = box.max[1] + hh * 0.02;
  candle(bits, [cx, top - hh * 0.04, cz - deep * 0.1], hh * 0.24, wide * 0.085, WAX, GRAVE_LIGHT);
  candle(bits, [cx - wide * 0.26, top - hh * 0.14, cz - deep * 0.08], hh * 0.16, wide * 0.08, WAX, GRAVE_LIGHT);
  candle(bits, [cx + wide * 0.26, top - hh * 0.14, cz - deep * 0.08], hh * 0.18, wide * 0.08, WAX, GRAVE_LIGHT);
  return withBits(mergeMeshes([m, veil]), bits, head);
}

/**
 * How she carries herself: stooped under the coffin on her back, her head up to see past her veil, her bony hands
 * held before her like a pair of claws while she stands or walks, and a slow breath. Laid over every clip she uses.
 */
const matronBend: Bend = (joint, clip, phase) => {
  const breath = Math.sin(phase * Math.PI * 2);
  const easy = clip === null || clip === 'idle' || clip === 'walk' || clip === 'run';
  switch (joint) {
    case 'spine':
      return [0.07 + (clip === 'idle' ? breath * 0.018 : 0), 0, 0];
    case 'chest':
      return [0.1 + (clip === 'idle' ? breath * 0.026 : 0), 0, clip === 'idle' ? breath * 0.012 : 0];
    case 'head':
      return [-0.12, 0, 0];
    case 'upperarm.l':
    case 'upperarm.r':
      return easy ? [-0.5, 0, joint === 'upperarm.l' ? 0.16 : -0.16] : null;
    case 'lowerarm.l':
    case 'lowerarm.r':
      return easy ? [-0.75, 0, 0] : null;
    default:
      return null;
  }
};

/* ------------------------------------------------------------------ the forms */

/** A move a boss makes: one of its skeleton's clips, and how fast it runs (1: as the clip was made). */
export interface BossMove {
  clip: string;
  rate?: number;
}

export interface BossForm {
  /** What is built onto its model as it loads, after its paint. */
  build?: (m: MeshData, joints: readonly string[]) => MeshData;
  /**
   * The clips of its skeleton that it uses: its own copy of the skeleton holds these alone, with its carriage laid over
   * them. Every clip named below must be here, with `idle`, `walk`, `run`, `hit` and `die`.
   */
  clips: readonly string[];
  /** How it carries itself (render3d/toon.ts Bend). */
  bend?: Bend;
  /** The move it makes for each of its attack patterns (data/bosses.ts ids): the wind-up is the clip's lift, held while the pattern gathers, and its strike the clip's blow. */
  moves: Readonly<Record<string, BossMove>>;
  /** Shown for the first time: what it does as it comes, then what it does once it is there. */
  enter: { clip: string; then: string };
  /** A phase changing (the rules give it 1.4 s, untouchable). */
  shift: BossMove;
  /** Dazed: found out, or struck down for a moment. Held while it lasts. */
  dazed: string;
  /**
   * Its death. `clip` plays through the 1.8 s the rules give its dying; then it lies as `end` has it, `kept` seconds
   * more, and `sink` says how far the floor takes it in that time (in its own heights: 0 stays where it fell).
   */
  fall: { clip: string; end: string; kept: number; sink: number };
}

const FORMS: Record<string, BossForm> = {
  // The Coffin Matron. She calls the coffins up with both arms raised (and is gone into one); her wisps are cast from
  // her candles with a flung hand; the coffin she shuts on the hero she draws closed with both hands. First seen, she
  // climbs up out of the crypt's floor as its dead do, and shrieks. Found in her coffin she sits where she fell. A
  // phase changing, she shrieks the dead awake. Dying, she falls back onto her own coffin, and the floor takes her.
  matron: {
    build: matron,
    clips: ['idle', 'walk', 'run', 'hit', 'die', 'dead', 'cast', 'channel', 'summon', 'rise', 'taunt', 'sitfloor'],
    bend: matronBend,
    moves: {
      'crypt:coffins': { clip: 'summon' },
      'spell:seekers': { clip: 'cast' },
      'spell:cage': { clip: 'channel' },
      summon: { clip: 'summon' },
    },
    enter: { clip: 'rise', then: 'taunt' },
    shift: { clip: 'taunt', rate: 1.2 },
    dazed: 'sitfloor',
    fall: { clip: 'die', end: 'dead', kept: 2.6, sink: 1.1 },
  },
};

/** Candles set on a crown or a helm: `n` of them across it, the middle one tallest, burning `flame`. */
function crowned(m: MeshData, joints: readonly string[], n: number, flame: readonly number[]): MeshData {
  const head = joints.indexOf('head');
  const box = head >= 0 ? (boxOf(m, head) as Box | null) : null;
  if (!box) return m;
  const cx = (box.min[0] + box.max[0]) / 2;
  const cz = (box.min[2] + box.max[2]) / 2;
  const hh = box.max[1] - box.min[1];
  const wide = box.max[0] - box.min[0];
  const bits = new Bits();
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0;
    candle(bits, [cx + u * wide * 0.56, box.max[1] - hh * (0.03 + Math.abs(u) * 0.22), cz - wide * 0.04], hh * (0.24 - Math.abs(u) * 0.12), wide * 0.085, WAX, flame);
  }
  return withBits(m, bits, head);
}

const CANDLE_GOLD = hex('#ffd88a');

// Warden Ossric. A soldier's moves, slow and heavy: he comes on behind his shield, brings the halberd down two-handed
// for his slams, thrusts for the spears, and raises it to call his candles alight. He gets up off the crypt's floor as
// its dead do. Struck dumb against a wall, he stands behind his shield. He dies as bones do, and lies where he fell.
FORMS.ossric = {
  build: (m, joints) => crowned(m, joints, 2, CANDLE_GOLD),
  clips: ['idle', 'walk', 'run', 'hit', 'die', 'dead', 'chop2', 'stab', 'bash', 'block', 'rise', 'taunt'],
  bend: (joint, clip, phase) => (joint === 'chest' && clip === 'idle' ? [Math.sin(phase * Math.PI * 2) * 0.02, 0, 0] : joint === 'head' ? [0.1, 0, 0] : null),
  moves: {
    charge: { clip: 'bash' },
    slam: { clip: 'chop2', rate: 0.9 },
    slamRings: { clip: 'chop2', rate: 0.8 },
    spearFan: { clip: 'stab' },
    'crypt:candles': { clip: 'taunt' },
    summon: { clip: 'taunt' },
  },
  enter: { clip: 'rise', then: 'taunt' },
  shift: { clip: 'taunt', rate: 1.2 },
  dazed: 'block',
  fall: { clip: 'die', end: 'dead', kept: 2.8, sink: 0 },
};

// Morgrave. A scholar's moves: everything is read out of the book or flung from the staff. He drifts (the rules float
// him), stooped over his page. He dies as a man does, and the rift he opened takes him down.
FORMS.morgrave = {
  clips: ['idle', 'walk', 'run', 'hit', 'die', 'dead', 'cast', 'channel', 'summon', 'dodge', 'spawn', 'cheer'],
  bend: (joint, clip, phase) => (joint === 'spine' ? [0.1, 0, 0] : joint === 'chest' ? [0.12 + (clip === 'idle' ? Math.sin(phase * Math.PI * 2) * 0.02 : 0), 0, 0] : joint === 'head' ? [0.08, 0, 0] : null),
  moves: {
    soulVolley: { clip: 'cast' },
    graveGrasp: { clip: 'channel' },
    summon: { clip: 'summon' },
    'crypt:soul-split': { clip: 'summon', rate: 0.8 },
    riftSpiral: { clip: 'channel' },
    riftBeams: { clip: 'cast', rate: 0.8 },
    teleport: { clip: 'dodge' },
    riftNova: { clip: 'summon' },
    collapse: { clip: 'channel', rate: 0.8 },
  },
  enter: { clip: 'spawn', then: 'channel' },
  shift: { clip: 'summon', rate: 1.1 },
  dazed: 'hit',
  fall: { clip: 'die', end: 'dead', kept: 2.6, sink: 0.9 },
};

// Grimtusk, the great boar (built as the boar mounts are: render3d/kits.ts). A beast has few moves and makes each
// count: its head goes down for every charge, gore and stomp; struck from its rush or roused to its second wind it
// rears as a beast does when hurt; and it dies on its side where it stood, a carcass the size of a cart that stays.
FORMS.grimtusk = {
  clips: ['idle', 'walk', 'run', 'chop', 'hit', 'die'],
  moves: {
    charge: { clip: 'chop' },
    tripleCharge: { clip: 'chop', rate: 1.3 },
    stomp: { clip: 'chop', rate: 0.8 },
    gore: { clip: 'chop', rate: 1.4 },
    roar: { clip: 'hit', rate: 0.6 },
    summon: { clip: 'hit', rate: 0.6 },
  },
  enter: { clip: 'hit', then: 'idle' },
  shift: { clip: 'hit', rate: 0.5 },
  dazed: 'hit',
  fall: { clip: 'die', end: 'die', kept: 3, sink: 0 },
};

/* ------------------------------------------------------------------ Gallows Keep (Act I) */

const GOLD = hex('#d9a93a');
const RIFT_GLASS = hex('#ff9af0');

/**
 * A crown a bandit made for himself: a band of stolen gold with five uneven points, and in its brow the shard of
 * rift-glass he took for a jewel (what he drops first is that shard: data/bosses.ts `glitch-shard`).
 */
function banditCrown(m: MeshData, joints: readonly string[]): MeshData {
  const head = joints.indexOf('head');
  const box = head >= 0 ? (boxOf(m, head) as Box | null) : null;
  if (!box) return m;
  const cx = (box.min[0] + box.max[0]) / 2;
  const cz = (box.min[2] + box.max[2]) / 2;
  const wide = box.max[0] - box.min[0];
  const r = wide * 0.4;
  const y = box.max[1] - (box.max[1] - box.min[1]) * 0.12;
  const bits = new Bits();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const a2 = ((i + 1) / n) * Math.PI * 2 + Math.PI / 2;
    const p = [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    const q = [cx + Math.cos(a2) * r, y, cz + Math.sin(a2) * r];
    // the band, point to point, and a point standing on each joint of it (no two the same height)
    post(bits, p, q, wide * 0.07, wide * 0.07, shade(GOLD, 0.7), GOLD);
    post(bits, p, [p[0]!, y + wide * (0.26 + (i % 2) * 0.1), p[2]!], wide * 0.075, 0.004, GOLD, shade(GOLD, 1.25));
  }
  // the shard, set in the brow (the figure faces +z)
  const brow = [cx, y + wide * 0.02, cz + r * 1.02];
  post(bits, brow, [cx, y + wide * 0.5, cz + r * 1.02], wide * 0.1, 0.004, RIFT_GLASS, [255, 255, 255], true);
  return withBits(m, bits, head);
}

// The Hangman. Everything he does he does with the axe, slowly and all the way through: the wide cut is a full turn of
// his body, the chop comes down two-handed along its line, and the boards of the gallows floor drop when he brings his
// fist down on them. The noose and the thrown axes go out with one flung arm. He does not come in: he is standing on
// his gallows when the hero arrives, and brings the axe down once to say so. He dies as a big man does, forward, and
// stays where he fell: the gallows' last body.
FORMS.hangman = {
  clips: ['idle', 'walk', 'run', 'hit', 'die', 'dead', 'chop', 'chop2', 'spin', 'punch', 'smash', 'cast'],
  bend: (joint, clip, phase) => (joint === 'head' ? [0.16, 0, 0] : joint === 'chest' && clip === 'idle' ? [0.05 + Math.sin(phase * Math.PI * 2) * 0.025, 0, 0] : joint === 'spine' ? [0.04, 0, 0] : null),
  moves: {
    cleave: { clip: 'spin', rate: 0.9 },
    chop: { clip: 'chop2', rate: 0.85 },
    hook: { clip: 'cast' },
    'gallows:hook-drop': { clip: 'cast', rate: 0.9 },
    'gallows:trapdoors': { clip: 'smash', rate: 0.8 },
    volley: { clip: 'cast', rate: 1.2 },
    roar: { clip: 'punch', rate: 0.7 },
  },
  enter: { clip: 'smash', then: 'idle' },
  shift: { clip: 'punch', rate: 0.6 },
  dazed: 'hit',
  fall: { clip: 'die', end: 'dead', kept: 3, sink: 0 },
};

// Harlan Blackglove. A knife-fighter who was never a soldier: quick, low, nothing wasted. Two cuts with the knives, a
// flick of the wrist for the thrown ones, a thrust for each dash down a lane, a sidestep into his smoke. He whistles
// his cutthroats in with a wave of the black glove and jeers as the cages go up. He walks in showing both knives. He
// dies as a man does, and lies where he fell, the crown still on him.
FORMS.harlan = {
  build: banditCrown,
  clips: ['idle', 'walk', 'run', 'hit', 'die', 'dead', 'slice', 'stab', 'throw', 'dodge', 'wave', 'taunt', 'spawn', 'cheer'],
  bend: (joint, clip, phase) => (joint === 'spine' ? [0.08, 0, 0] : joint === 'chest' && clip === 'idle' ? [0.04, Math.sin(phase * Math.PI * 2) * 0.05, 0] : joint === 'head' ? [-0.06, 0, 0.05] : null),
  moves: {
    cleave: { clip: 'slice', rate: 1.2 },
    volley: { clip: 'throw', rate: 1.1 },
    tripleCharge: { clip: 'stab', rate: 1.3 },
    vanish: { clip: 'dodge' },
    summon: { clip: 'wave' },
    'gallows:hostages': { clip: 'cheer', rate: 0.8 },
  },
  enter: { clip: 'spawn', then: 'taunt' },
  shift: { clip: 'taunt', rate: 1.2 },
  dazed: 'hit',
  fall: { clip: 'die', end: 'dead', kept: 2.8, sink: 0 },
};

export const bossForm = (id: string | undefined): BossForm | undefined => (id ? FORMS[id] : undefined);
export const BOSS_FORMS: Readonly<Record<string, BossForm>> = FORMS;

const rigs = new Map<string, RigAnim>();
/**
 * A boss's own copy of its skeleton: the clips it uses and no others, with its carriage laid over each. Made once (a
 * shared skeleton's whole table is some megabytes; a boss's dozen clips are a fraction of it).
 */
export function bossRig(id: string, form: BossForm, pack: Pack, rigName: string): RigAnim | null {
  const key = `${id}@${rigName}`;
  let a = rigs.get(key);
  if (!a) {
    const rig = pack.rigs[rigName];
    if (!rig) return null;
    const clips: RigData['clips'] = {};
    for (const c of form.clips) if (rig.clips[c]) clips[c] = rig.clips[c];
    a = new RigAnim({ ...rig, clips }, pack.bin, [], form.bend);
    rigs.set(key, a);
  }
  return a;
}

import * as THREE from 'three';
import { sigilSetOf } from '../../../catalog/sigilItems';
import type { ClassId, Rarity } from '../data/types';
import type { HeroLook, Piece } from '../render/art/hero';
import { Build, mul, type C } from './build';
import type { Wardrobe } from './dress';
import { hexRgb } from './kits';
import { above, below, blade, glowing, mix, Part, rgb, rod, shell, tied, within, type Corner, type Inside } from './meshKit';
import { mergeMeshes, type MeshData } from './pack';
import { headOf, hairIsMetal } from './heads';
import { blondHair, darkHair, hslRgb, painted, paintJoints, rgbHsl, shaved } from './paint';

/**
 * What a hero's gear looks like. Everything goes by rarity, so a glance says what someone is wearing:
 *
 *   common     plain cuts, dull dye, no trim
 *   uncommon   a better cut, its dye clean, a bronze hem
 *   rare       a fine cut, bright dye, silver trim, small pauldrons
 *   epic       a royal cut, gold trim, big pauldrons, a cape, a gem
 *   legendary  gold itself, crests and spikes, a cape with a gold hem, a burning gem
 *
 * Above all of it, the Sigil-wardens' armor at the end of the story: seven sets that are like nothing else, each with
 * pieces of its own built here.
 */

type Rgb = [number, number, number];

const tup = (c: C): Rgb => [c[0]!, c[1]!, c[2]!];
const hex = (s: string): Rgb => hexRgb(s) as Rgb;

/** The color that says what rarity something is, on gems and on the plainest of trims. */
const RARITY_GEM: Record<Rarity, string> = { common: '#9a9a9a', uncommon: '#58c858', rare: '#4aa8ff', epic: '#b870ff', legendary: '#ff9a2a' };

/** What metal is, at each rarity. */
const METAL: Record<Rarity, Rgb> = {
  common: [0.33, 0.34, 0.37],
  uncommon: [0.43, 0.45, 0.5],
  rare: [0.5, 0.54, 0.61],
  epic: [0.56, 0.6, 0.7],
  legendary: [0.98, 0.78, 0.3],
};
const SILVERED: Rgb = [0.82, 0.82, 0.8];
const BRONZE = rgb('#a8763a');
const SILVER = rgb('#dfe6f0');
const GOLD = rgb('#ffcf5a');
const LEATHER = rgb('#5a4030');

/** The trim on an item of each rarity (none on the plainest). */
const TRIM: Record<Rarity, C | null> = { common: null, uncommon: BRONZE, rare: SILVER, epic: GOLD, legendary: GOLD };

/** A dye as it comes out at each rarity: the dullest is a poor man's dye, the best deep and bright. */
function dye(tint: string, r: Rarity): Rgb {
  const [cr, cg, cb] = hex(tint);
  const [h, s, l] = rgbHsl(cr, cg, cb);
  switch (r) {
    case 'common':
      return hslRgb(h, s * 0.5, Math.min(0.5, l * 0.82));
    case 'uncommon':
      return hslRgb(h, s * 0.85, l * 0.95);
    case 'rare':
      return hslRgb(h, Math.min(1, s * 1.2 + 0.05), Math.min(0.62, l * 1.05));
    case 'epic':
      return hslRgb(h, Math.min(1, s * 1.35 + 0.08), Math.min(0.56, l * 0.98));
    case 'legendary':
      return hslRgb(h, Math.min(1, s * 1.5 + 0.12), Math.min(0.56, l));
  }
}

/* ------------------------------------------------------------------ the ladder */

/** The model set a chest piece is made from, by its cut and rarity, and the sleeves that go with it. */
const CHEST_LADDER: Record<Piece['style'] & string, Record<Rarity, string>> = {
  plate: { common: 'Skeleton_Rogue', uncommon: 'Knight', rare: 'Knight', epic: 'Paladin', legendary: 'Paladin' },
  tunic: { common: 'Rogue', uncommon: 'Rogue', rare: 'RogueHooded', epic: 'Vampire', legendary: 'Vampire' },
  robe: { common: 'Skeleton_Mage', uncommon: 'Mage', rare: 'Cleric', epic: 'Necromancer', legendary: 'Necromancer' },
};
const SLEEVES: Record<string, string> = { Skeleton_Rogue: 'Knight', Skeleton_Mage: 'Mage' };

const LEG_LADDER: Record<string, Record<Rarity, string>> = {
  greaves: { common: 'Knight', uncommon: 'Knight', rare: 'Knight', epic: 'Paladin', legendary: 'Paladin' },
  trousers: { common: 'Rogue', uncommon: 'Ranger', rare: 'Ranger', epic: 'Vampire', legendary: 'Vampire' },
  robe: { common: 'Mage', uncommon: 'Mage', rare: 'Mage', epic: 'Necromancer', legendary: 'Necromancer' },
};

interface Cover {
  parts: string[];
  /** Hair stays out from under it: a plain head goes beneath. */
  bald?: boolean;
  /** It has a face of its own. */
  own?: boolean;
}

const HEAD_LADDER: Record<string, Record<Rarity, Cover>> = {
  helm: {
    common: { parts: ['Knight_Helmet'], bald: true },
    uncommon: { parts: ['Knight_Helmet', 'Knight_HelmetVisor'], bald: true },
    rare: { parts: ['Skeleton_Warrior_Helmet'], bald: true },
    epic: { parts: ['Paladin_Helmet'], own: true },
    legendary: { parts: ['Paladin_Helmet'], own: true },
  },
  hood: {
    common: { parts: ['Skeleton_Rogue_Hood'], bald: true },
    uncommon: { parts: ['RogueHooded_Head'], own: true },
    rare: { parts: ['RogueHooded_Head', 'RogueHooded_Mask'], own: true },
    epic: { parts: ['Cleric_Head'], own: true },
    legendary: { parts: ['Cleric_Head'], own: true },
  },
  cap: {
    common: { parts: ['Farmer_A_Hat'], bald: true },
    uncommon: { parts: ['Helper_A_Hat'], bald: true },
    rare: { parts: ['Ninja_Headband'] },
    // (a bear's head is a trophy, for gear of renown)
    epic: { parts: ['Barbarian_BearHat'], bald: true },
    legendary: { parts: ['Barbarian_BearHat'], bald: true },
  },
  crown: {
    common: { parts: ['Ninja_Headband'] },
    uncommon: { parts: ['Ninja_Headband'] },
    rare: { parts: ['Necromancer_Crown'] },
    epic: { parts: ['Necromancer_Crown'] },
    legendary: { parts: ['Necromancer_Crown'] },
  },
  wizard: {
    common: { parts: ['Skeleton_Mage_Hat'], bald: true },
    uncommon: { parts: ['Witch_Hat'], bald: true },
    rare: { parts: ['Mage_Hat'], bald: true },
    epic: { parts: ['Mage_Hat'], bald: true },
    legendary: { parts: ['Mage_Hat'], bald: true },
  },
};

/** Every face a hero or a townsperson may wear (render3d/heads.ts picks among them), loaded with the rest. */
const BEARDS = ['Hiker_Head', 'Farmer_A_Head', 'Engineer_Head', 'Barbarian_Head', 'Witch_Head', 'Helper_A_Head'];
const HAND_JOINTS = ['hand.l', 'hand.r', 'wrist.l', 'wrist.r', 'handslot.l', 'handslot.r'];
const FOOT_JOINTS = ['foot.l', 'foot.r', 'toes.l', 'toes.r'];

/** The head under a helmet or a hat, or the hero's own hair and face. */
function plainHead(w: Wardrobe, look: HeroLook, cover: Cover | null, skin: Rgb, hair: Rgb): MeshData | null {
  const face = headOf(look, !!cover?.bald);
  const m = w.hero.meshes[face];
  if (!m) return null;
  // (a hero who chose no beard has none; one from before the choice keeps the face they've always had)
  const done = painted(face === 'Ranger_Head' && look.beard === null ? shaved(m) : m, { skin, cloth: hair, metal: hairIsMetal(look) ? hair : undefined });
  return face === 'Helper_A_Head' ? blondHair(done, hair) : face === 'Mage_Head' ? darkHair(done, hair) : done;
}

/** A pad on a shoulder: `k` how big, with a rim. */
function pauldron(w: Wardrobe, side: 1 | -1, k: number, c: C, rim: C): MeshData {
  const b = new Build();
  const x = side * (0.37 + 0.03 * k);
  const y = 1.15;
  b.post(x, 0, 0.2 * k, 0.19 * k, y - 0.1 * k, y, 9, mul(c, 0.72), c);
  b.post(x, 0, 0.19 * k, 0.07 * k, y, y + 0.14 * k, 9, c, mix(c, [1, 1, 1], 0.14));
  b.post(x, 0, 0.215 * k, 0.215 * k, y - 0.13 * k, y - 0.09 * k, 9, rim, mul(rim, 0.86));
  return tied(b, w.medium.joints.indexOf('chest'), 1, [0, 0, 0], 'medium');
}

/** A stone set in something, facing the front. */
const gemAt = (j: number, x: number, y: number, z: number, r: number, c: C): MeshData => rod([x, y, z - 0.03], [x, y, z + 0.05], r, r * 0.35, 6, mul(c, 0.75), mix(c, [1, 1, 1], 0.45), j, 'medium');

/** How far forward the figure's front is at a height. */
function frontAt(m: MeshData, y: number): number {
  let z = 0;
  for (let v = 0; v < m.n; v++) if (Math.abs(m.pos[v * 3 + 1]! - y) < 0.08 && Math.abs(m.pos[v * 3]!) < 0.12) z = Math.max(z, m.pos[v * 3 + 2]!);
  return z;
}

type Hem = 'plain' | 'jag' | 'wave' | 'leaf';

/** A cape, from the shoulders down: its top stays with the back, the rest moves on joints of its own. */
function capeOf(w: Wardrobe, color: C, trim: C | null, hem: Hem = 'plain', long = 1): MeshData {
  const out = new Part();
  const chest = w.medium.joints.indexOf('chest');
  const c1 = w.medium.joints.indexOf('cape1');
  const c2 = w.medium.joints.indexOf('cape2');
  const cols = 8;
  const bottom = 0.72 - 0.56 * long;
  const rows: { y: number; w: number; z: number; j0: number; j1: number; k: number }[] = [
    { y: 1.24, w: 0.27, z: -0.2, j0: chest, j1: chest, k: 255 },
    { y: 0.98, w: 0.36, z: -0.3, j0: c1, j1: chest, k: 170 },
    { y: 0.72, w: 0.42, z: -0.35, j0: c1, j1: c1, k: 255 },
    { y: (0.72 + bottom) / 2, w: 0.47, z: -0.39, j0: c2, j1: c1, k: 170 },
    { y: bottom, w: 0.52, z: -0.42, j0: c2, j1: c2, k: 255 },
  ];
  const n = rows.length - 1;
  const point = (r: number, col: number): number[] => {
    const row = rows[r]!;
    const u = col / cols - 0.5;
    let y = row.y;
    if (r === n) {
      if (hem === 'jag') y += col % 2 ? 0.2 * long : -0.02;
      else if (hem === 'wave') y += Math.sin(u * 19) * 0.07;
      else if (hem === 'leaf') y += col % 2 ? 0.13 : -0.06;
    }
    return [u * 2 * row.w, y, row.z - Math.cos(u * Math.PI) * 0.03];
  };
  const put = (p: number[], r: number, flip: number, c: C): number => {
    const row = rows[r]!;
    const v: Corner = [p[0]!, p[1]!, p[2]!, 0, 0.25 * flip, -flip, 0, 0.25 * flip, -flip, row.j0, row.j1, row.k];
    return out.corner(v, c);
  };
  const quad = (a: number[], ra: number, b: number[], rb: number, ca: C, cb: C, a2: number[], b2: number[]): void => {
    for (const flip of [1, -1]) {
      const i0 = put(a, ra, flip, ca);
      const i1 = put(a2, ra, flip, ca);
      const i2 = put(b2, rb, flip, cb);
      const i3 = put(b, rb, flip, cb);
      if (flip > 0) out.idx.push(i0, i1, i2, i0, i2, i3);
      else out.idx.push(i0, i2, i1, i0, i3, i2);
    }
  };
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < cols; col++) {
      const shade = 1 - (r / n) * 0.22;
      const shadeNext = 1 - ((r + 1) / n) * 0.22;
      const top = mul(color, shade);
      const low = mul(color, shadeNext);
      quad(point(r, col), r, point(r + 1, col), r + 1, top, low, point(r, col + 1), point(r + 1, col + 1));
    }
  }
  if (trim) {
    // a border along the hem, and down both edges
    const up = 0.07;
    for (let col = 0; col < cols; col++) {
      const a = point(n, col);
      const b = point(n, col + 1);
      const a2 = [a[0]!, a[1]! + up, a[2]! - 0.012];
      const b2 = [b[0]!, b[1]! + up, b[2]! - 0.012];
      const lowA = [a[0]!, a[1]!, a[2]! - 0.012];
      const lowB = [b[0]!, b[1]!, b[2]! - 0.012];
      quad(a2, n, lowA, n, trim, trim, b2, lowB);
    }
    for (const col of [0, cols]) {
      for (let r = 0; r < n; r++) {
        const a = point(r, col);
        const b = point(r + 1, col);
        const inward = col === 0 ? 0.04 : -0.04;
        quad([a[0]!, a[1]!, a[2]! - 0.012], r, [b[0]!, b[1]!, b[2]! - 0.012], r + 1, trim, trim, [a[0]! + inward, a[1]!, a[2]! - 0.012], [b[0]! + inward, b[1]!, b[2]! - 0.012]);
      }
    }
  }
  return out.data('medium');
}

/** The trim on a chest piece: its hem, down its front and across at the belt. */
function trimsOf(body: MeshData, r: Rarity, trim: C, belt: C): MeshData[] {
  const low = body.min[1];
  const parts: MeshData[] = [];
  const band = r === 'uncommon' ? 0.05 : r === 'rare' ? 0.07 : 0.1;
  parts.push(shell(body, [above(low), below(low + band)], 0.012, trim));
  parts.push(shell(body, [above(0.6), below(0.68)], 0.014, belt));
  if (r !== 'uncommon') {
    const front: Inside = (_x, _y, z) => z;
    parts.push(shell(body, [within(r === 'rare' ? 0.03 : 0.05), front, above(low + band), below(1.08)], 0.012, trim));
  }
  if (r === 'epic' || r === 'legendary') parts.push(shell(body, [above(low + band + 0.05), below(low + band + 0.09)], 0.012, trim));
  return parts;
}

function ladderHead(w: Wardrobe, look: HeroLook, skin: Rgb, hair: Rgb): MeshData[] {
  const parts: MeshData[] = [];
  const p = look.head;
  if (!p) {
    const m = plainHead(w, look, null, skin, hair);
    if (m) parts.push(m);
    return parts;
  }
  const cover = (HEAD_LADDER[p.style] ?? HEAD_LADDER.cap!)[p.r];
  if (!cover.own) {
    const m = plainHead(w, look, cover, skin, hair);
    if (m) parts.push(m);
  }
  const tint = dye(p.tint, p.r);
  const isMetal = p.style === 'helm' || p.style === 'crown';
  const metal = p.r === 'legendary' && p.style === 'helm' ? SILVERED : METAL[p.r];
  for (const id of cover.parts) {
    const m = w.hero.meshes[id];
    if (!m) continue;
    if (id === 'Barbarian_BearHat') parts.push(painted(m, { cloth: tint, metal: tup(mul(tint, 0.8)), skin: tup(mul(tint, 1.3)) }));
    else if (cover.own && id === cover.parts[0] && !isMetal) parts.push(painted(m, { skin, cloth: tint, metal: tup(TRIM[p.r] ?? metal) }));
    else if (isMetal) parts.push(painted(m, { skin, metal, cloth: p.r === 'legendary' ? hex('#a8262e') : tup(mix(metal, hex(RARITY_GEM[p.r]), 0.6)), plated: true }));
    else parts.push(painted(m, { cloth: tint, metal: tup(TRIM[p.r] ?? tint) }));
  }
  const head = w.medium.joints.indexOf('head');
  const J = 'medium';
  if (p.r === 'epic' || p.r === 'legendary') {
    const gem = rgb(RARITY_GEM[p.r]);
    // a stone on the brow
    parts.push(gemAt(head, 0, p.style === 'helm' ? 2.06 : 1.98, p.style === 'helm' ? 0.56 : 0.5, 0.075, gem));
  }
  if (p.r === 'legendary') {
    // a crest, front to back over the top
    const top = p.style === 'helm' ? 2.28 : p.style === 'hood' ? 2.12 : 2.14;
    const crest = rgb('#d8342e');
    const tip = rgb('#ffcf5a');
    for (const [z, t] of [[0.2, 0.34], [-0.06, 0.42], [-0.32, 0.36]] as const) parts.push(blade(z, top, t, 0.36, 0.05, crest, tip, head, J));
  }
  return parts;
}

function ladderChest(w: Wardrobe, look: HeroLook, skin: Rgb): { parts: MeshData[]; kind: string } {
  const parts: MeshData[] = [];
  const p = look.chest;
  const kind = (CHEST_LADDER[p.style] ?? CHEST_LADDER.tunic!)[p.r];
  const r = p.r;
  const isPlate = p.style === 'plate';
  // (the best plate is polished silver under its gold: all-gold is for a warden)
  const metalMix = isPlate ? (r === 'legendary' ? SILVERED : tup(mix(METAL[r], hex(p.tint), 0.28))) : METAL[r];
  // (on plate the dye is its straps and its cloth, in the rarity's own color from rare up)
  const cloth = isPlate ? (r === 'common' ? tup(LEATHER) : r === 'uncommon' ? hex('#4a5a3a') : tup(mix(hex(RARITY_GEM[r]), [0.1, 0.08, 0.14], 0.42))) : dye(p.tint, r);
  const body = w.hero.meshes[`${kind}_Body`] ?? w.hero.meshes.Rogue_Body!;
  const metal = isPlate || r !== 'common' ? metalMix : undefined;
  const plated = isPlate && kind === 'Paladin';
  parts.push(painted(body, { skin, cloth, metal, plated }));
  const sleeve = SLEEVES[kind] ?? kind;
  const hands = look.hands;
  const handJ = new Set(HAND_JOINTS.map((n) => w.medium.joints.indexOf(n)).filter((j) => j >= 0));
  for (const side of ['ArmLeft', 'ArmRight']) {
    const m = w.hero.meshes[`${sleeve}_${side}`];
    if (!m) continue;
    let dressed = painted(m, { skin, cloth, metal, plated });
    if (hands) dressed = paintJoints(dressed, handJ, hands.style === 'gauntlets' ? METAL[hands.r] : dye(hands.tint, hands.r));
    parts.push(dressed);
  }
  const trim = TRIM[r];
  if (trim) parts.push(...trimsOf(body, r, trim, r === 'uncommon' ? mul(LEATHER, 0.8) : mul(trim, 0.86)));
  const chest = w.medium.joints.indexOf('chest');
  // pauldrons: small at rare, big at epic, huge and spiked at legendary (a robe's are a mantle of the same)
  if (r === 'rare' || r === 'epic' || r === 'legendary') {
    const pad = r === 'legendary' ? METAL.legendary : isPlate ? metalMix : tup(mix(cloth, [0, 0, 0], 0.12));
    const k = r === 'rare' ? 0.92 : r === 'epic' ? 1.14 : 1.34;
    for (const side of [1, -1] as const) {
      parts.push(pauldron(w, side, k, pad, trim!));
      if (r === 'legendary') {
        const x = side * 0.42;
        parts.push(rod([x, 1.3, 0.03], [x + side * 0.2, 1.62, 0.02], 0.08, 0, 6, GOLD, mix(GOLD, [1, 1, 1], 0.5), chest, 'medium'));
        parts.push(rod([x + side * 0.1, 1.24, -0.05], [x + side * 0.34, 1.44, -0.06], 0.065, 0, 6, GOLD, mix(GOLD, [1, 1, 1], 0.5), chest, 'medium'));
      }
    }
  }
  if (r === 'epic' || r === 'legendary') {
    const gem = rgb(RARITY_GEM[r]);
    parts.push(gemAt(chest, 0, 0.98, frontAt(body, 0.98) + 0.015, r === 'legendary' ? 0.095 : 0.075, gem));
  }
  if (look.cape) parts.push(capeOf(w, hex(look.cape), r === 'legendary' ? GOLD : r === 'epic' ? mix(GOLD, hex(look.cape), 0.25) : null));
  return { parts, kind };
}

function ladderLegs(w: Wardrobe, look: HeroLook, skin: Rgb): MeshData[] {
  const parts: MeshData[] = [];
  const robed = look.chest.style === 'robe';
  const p = look.legs;
  const kind = (robed ? LEG_LADDER.robe! : LEG_LADDER[p.style] ?? LEG_LADDER.trousers!)[p.r];
  const metal = p.style === 'greaves' ? METAL[p.r] : undefined;
  const footJ = new Set(FOOT_JOINTS.map((n) => w.medium.joints.indexOf(n)).filter((j) => j >= 0));
  const feetMetal = look.feet.style === 'sabatons';
  for (const side of ['LegLeft', 'LegRight']) {
    const m = w.hero.meshes[`${kind}_${side}`];
    if (!m) continue;
    const cloth = robed ? dye(look.chest.tint, look.chest.r) : dye(p.tint, p.r);
    let dressed = painted(m, { skin, cloth, metal, plated: kind === 'Paladin' });
    if (!robed || look.feet.r !== 'common') dressed = paintJoints(dressed, footJ, feetMetal ? METAL[look.feet.r] : dye(look.feet.tint, look.feet.r));
    parts.push(dressed);
  }
  return parts;
}

/* ------------------------------------------------------------------ the Sigil-wardens */

interface Ctx {
  w: Wardrobe;
  skin: Rgb;
  hair: Rgb;
  look: HeroLook;
  head: number;
  chest: number;
  hips: number;
}
const M = 'medium';

/** A curved horn, from its root out through the points given (each its own width). */
function horn(ctx: Ctx, points: readonly (readonly number[])[], widths: readonly number[], c0: C, c1: C, joint = ctx.head): MeshData[] {
  const out: MeshData[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = i / (points.length - 1);
    const b = (i + 1) / (points.length - 1);
    out.push(rod(points[i]!, points[i + 1]!, widths[i]!, widths[i + 1]!, 6, mix(c0, c1, a), mix(c0, c1, b), joint, M));
  }
  return out;
}

const mirror = (p: readonly number[]): number[] => [-p[0]!, p[1]!, p[2]!];

/** The same thing on both sides. */
function both(make: (side: 1 | -1) => MeshData | MeshData[]): MeshData[] {
  return [1, -1].flatMap((s) => make(s as 1 | -1));
}

/** A flat fan of blades on one side of a helm: a wing. */
function wing(ctx: Ctx, side: 1 | -1, root: readonly number[], c0: C, c1: C, scale = 1): MeshData[] {
  const out: MeshData[] = [];
  for (let i = 0; i < 5; i++) {
    const up = 0.62 - i * 0.26;
    const len = (0.92 - i * 0.1) * scale;
    const end = [root[0]! + side * Math.cos(up) * len * 0.55, root[1]! + Math.sin(up) * len + 0.16 * scale, root[2]! - 0.34 * scale - i * 0.09 * scale];
    out.push(rod(root, end, 0.09 * scale, 0, 5, c0, c1, ctx.head, M));
  }
  return out;
}

/** A front-and-back cloth hanging from the belt. */
function tabard(ctx: Ctx, color: C, trim: C): MeshData {
  const out = new Part();
  const y0 = 0.68;
  const y1 = 0.2;
  const hw = 0.17;
  const panel = (z: number, flip: number): void => {
    const n: Corner = [0, 0, 0, 0, 0, flip, 0, 0, flip, ctx.hips, ctx.hips, 255];
    const at = (x: number, y: number, c: C): number => {
      const v = n.slice();
      v[0] = x;
      v[1] = y;
      v[2] = z;
      return out.corner(v, c);
    };
    const a = at(-hw, y0, color);
    const b = at(hw, y0, color);
    const c = at(hw, y1 + 0.07, mul(color, 0.8));
    const d = at(0, y1, mul(color, 0.8));
    const e = at(-hw, y1 + 0.07, mul(color, 0.8));
    if (flip > 0) out.idx.push(a, e, d, a, d, b, b, d, c);
    else out.idx.push(a, d, e, a, b, d, b, c, d);
    // its edge
    const f = at(-hw - 0.025, y0, trim);
    const g = at(-hw, y0, trim);
    const h = at(-hw, y1 + 0.07, trim);
    const i = at(-hw - 0.025, y1 + 0.05, trim);
    const j = at(hw + 0.025, y0, trim);
    const k = at(hw, y0, trim);
    const l = at(hw, y1 + 0.07, trim);
    const m = at(hw + 0.025, y1 + 0.05, trim);
    if (flip > 0) out.idx.push(f, i, h, f, h, g, k, l, m, k, m, j);
    else out.idx.push(f, h, i, f, g, h, k, m, l, k, j, m);
  };
  panel(0.27, 1);
  panel(0.268, -1);
  panel(-0.27, -1);
  panel(-0.268, 1);
  return out.data(M);
}

/** The armor's own body: its chest, sleeves and legs in the set's metal and cloth. */
function setBody(ctx: Ctx, kind: string, legs: string, paint: { cloth: Rgb; metal?: Rgb; plated?: boolean; white?: Rgb }): MeshData[] {
  const { w, skin } = ctx;
  const parts: MeshData[] = [];
  for (const id of [`${kind}_Body`, `${kind}_ArmLeft`, `${kind}_ArmRight`, `${legs}_LegLeft`, `${legs}_LegRight`]) {
    const m = w.hero.meshes[id];
    if (m) parts.push(painted(m, { skin, ...paint }));
  }
  return parts;
}

const SETS: Record<ClassId, { head(c: Ctx): MeshData[]; chest(c: Ctx): MeshData[] }> = {
  // Stone: dark plate and old blood, horned like the mountain it was carried under
  warrior: {
    head(c) {
      const steel = rgb('#4a505e');
      const parts: MeshData[] = [];
      const helm = c.w.hero.meshes.Paladin_Helmet!;
      parts.push(painted(helm, { skin: c.skin, metal: tup(steel), cloth: hex('#8e1f28'), plated: true, white: tup(mul(steel, 1.2)) }));
      const root = [0.56, 1.98, -0.02];
      const bone = rgb('#3a3036');
      const tip = rgb('#e8dcc0');
      const curve = [root, [0.98, 2.16, 0.02], [1.2, 2.5, -0.02], [1.2, 2.96, -0.14]];
      parts.push(...horn(c, curve, [0.17, 0.13, 0.085, 0], bone, tip));
      parts.push(...horn(c, curve.map(mirror), [0.17, 0.13, 0.085, 0], bone, tip));
      // the slit in the visor burns
      const slit = new Build();
      const fire = rgb('#ff5a3a');
      slit.box(-0.3, 0.68, 0.3, 0.76, 1.64, 1.71, fire, fire, fire);
      parts.push(tied(slit, c.head, 1, [0, 0, 0], M));
      parts.push(blade(0.2, 2.26, 0.34, 0.4, 0.05, rgb('#8e1f28'), rgb('#d8342e'), c.head, M), blade(-0.14, 2.28, 0.42, 0.4, 0.05, rgb('#8e1f28'), rgb('#d8342e'), c.head, M));
      return parts;
    },
    chest(c) {
      const steel = rgb('#4a505e');
      const blood = rgb('#8e1f28');
      const gold = rgb('#d8a838');
      const parts = setBody(c, 'Paladin', 'Paladin', { metal: tup(steel), cloth: tup(blood), plated: true });
      const body = c.w.hero.meshes.Paladin_Body!;
      const front: Inside = (_x, _y, z) => z;
      parts.push(shell(body, [within(0.17), front, above(0.44), below(1.08)], 0.012, blood));
      parts.push(shell(body, [within(0.195), (x) => Math.abs(x) - 0.17, front, above(0.44), below(1.08)], 0.016, gold));
      parts.push(shell(body, [above(0.6), below(0.68)], 0.018, gold));
      parts.push(tabard(c, blood, gold));
      parts.push(gemAt(c.chest, 0, 0.98, frontAt(body, 0.98) + 0.02, 0.1, rgb('#ff5a3a')));
      parts.push(
        ...both((s) => [
          pauldron(c.w, s, 1.45, steel, gold),
          rod([s * 0.5, 1.34, 0.08], [s * 0.72, 1.86, 0.1], 0.1, 0, 6, steel, rgb('#c8ccd8'), c.chest, M),
          rod([s * 0.68, 1.26, -0.04], [s * 1.08, 1.56, -0.04], 0.09, 0, 6, steel, rgb('#c8ccd8'), c.chest, M),
          rod([s * 0.4, 1.34, -0.14], [s * 0.5, 1.74, -0.26], 0.09, 0, 6, steel, rgb('#c8ccd8'), c.chest, M),
        ]),
      );
      parts.push(capeOf(c.w, rgb('#8e1f28'), gold, 'plain', 1.05));
      return parts;
    },
  },
  // Frost: a winter robe under a crown and mantle of ice
  mage: {
    head(c) {
      const ice = rgb('#bfe8ff');
      const white = rgb('#f2fbff');
      const deep = rgb('#2a3a7a');
      const parts: MeshData[] = [];
      const hood = c.w.hero.meshes.Skeleton_Rogue_Hood!;
      const face = plainHead(c.w, c.look, { parts: [], bald: true }, c.skin, c.hair);
      if (face) parts.push(face);
      parts.push(painted(hood, { cloth: tup(deep), metal: tup(ice) }));
      // a ring of shards round the crown, tallest at the front
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.PI / 2;
        const tall = 0.42 + 0.46 * Math.max(0, Math.sin(a)) + (i % 2 ? 0 : 0.12);
        const x = Math.cos(a) * 0.44;
        const z = Math.sin(a) * 0.44;
        parts.push(rod([x, 2.04, z], [x * 1.42, 2.1 + tall, z * 1.42], 0.11, 0, 5, ice, white, c.head, M));
      }
      parts.push(gemAt(c.head, 0, 1.98, 0.58, 0.085, rgb('#d8f0ff')));
      return parts;
    },
    chest(c) {
      const robe = rgb('#31418a');
      const ice = rgb('#bfe8ff');
      const white = rgb('#f2fbff');
      const silver = rgb('#d8e4f0');
      const parts = setBody(c, 'Necromancer', 'Mage', { cloth: tup(robe), metal: tup(silver) });
      const body = c.w.hero.meshes.Necromancer_Body!;
      const low = body.min[1];
      const front: Inside = (_x, _y, z) => z;
      parts.push(shell(body, [above(low), below(low + 0.1)], 0.014, ice));
      parts.push(shell(body, [within(0.05), front, above(low + 0.1), below(1.08)], 0.014, ice));
      parts.push(shell(body, [above(0.62), below(0.7)], 0.016, silver));
      parts.push(gemAt(c.chest, 0, 0.98, frontAt(body, 0.98) + 0.02, 0.095, rgb('#d8f0ff')));
      // a mantle of crystals on the shoulders, and a high collar of them behind the head
      parts.push(
        ...both((s) => [
          pauldron(c.w, s, 1.18, mul(robe, 1.25), ice),
          rod([s * 0.44, 1.24, 0.06], [s * 0.66, 1.84, 0.1], 0.12, 0, 5, ice, white, c.chest, M),
          rod([s * 0.56, 1.22, -0.06], [s * 0.96, 1.56, -0.08], 0.1, 0, 5, ice, white, c.chest, M),
          rod([s * 0.36, 1.26, -0.08], [s * 0.42, 1.72, -0.18], 0.09, 0, 5, ice, white, c.chest, M),
        ]),
      );
      for (const [x, t] of [[0, 0.95], [0.22, 0.78], [-0.22, 0.78], [0.42, 0.56], [-0.42, 0.56]] as const) parts.push(rod([x, 1.2, -0.3], [x * 1.3, 1.2 + t, -0.5], 0.1, 0, 5, ice, white, c.chest, M));
      // icicles at the hem
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = Math.cos(a) * 0.4;
        const z = Math.sin(a) * 0.34;
        parts.push(rod([x, low + 0.06, z], [x * 1.06, low - 0.16, z * 1.06], 0.05, 0, 4, ice, white, c.hips, M));
      }
      parts.push(capeOf(c.w, rgb('#7fa8e8'), white, 'jag', 1.05));
      return parts;
    },
  },
  // Tides: a sea-green coat, a mantle of scales, shell at the shoulder
  ranger: {
    head(c) {
      const deep = rgb('#1f4a5a');
      const foam = rgb('#7ad8c8');
      const parts: MeshData[] = [];
      parts.push(painted(c.w.hero.meshes.RogueHooded_Head!, { skin: c.skin, cloth: tup(mul(deep, 1.2)), metal: tup(foam) }));
      const mask = c.w.hero.meshes.RogueHooded_Mask;
      if (mask) parts.push(painted(mask, { cloth: tup(mul(deep, 0.7)) }));
      for (const [z, t] of [[0.34, 0.26], [0.08, 0.36], [-0.2, 0.42], [-0.46, 0.34]] as const) parts.push(blade(z, 2.1, t, 0.32, 0.045, foam, rgb('#d8fff4'), c.head, M));
      // fins off the sides of the hood, like a fish's
      parts.push(
        ...both((s) => [
          rod([s * 0.46, 1.8, -0.08], [s * 0.98, 2.18, -0.34], 0.12, 0, 4, deep, foam, c.head, M),
          rod([s * 0.46, 1.64, -0.1], [s * 0.94, 1.8, -0.42], 0.1, 0, 4, deep, foam, c.head, M),
        ]),
      );
      parts.push(gemAt(c.head, 0, 1.94, 0.56, 0.08, rgb('#b8fff0')));
      return parts;
    },
    chest(c) {
      const coat = rgb('#27596a');
      const deep = rgb('#16323e');
      const foam = rgb('#7ad8c8');
      const brass = rgb('#d8b060');
      const coral = rgb('#ff8a6a');
      const parts = setBody(c, 'RogueHooded', 'Rogue', { cloth: tup(coat), metal: tup(brass) });
      const body = c.w.hero.meshes.RogueHooded_Body!;
      const low = body.min[1];
      // a mantle of scales
      parts.push(shell(body, [above(0.92)], 0.016, (x, y) => (((Math.floor(y * 13) + Math.floor((x + 1) * 9)) % 2) ? foam : mul(coat, 1.3))));
      parts.push(shell(body, [above(low), below(low + 0.1)], 0.014, foam));
      parts.push(shell(body, [above(0.6), below(0.68)], 0.018, brass));
      parts.push(gemAt(c.chest, 0, 0.64, frontAt(body, 0.64) + 0.02, 0.09, rgb('#b8fff0')));
      // shell pauldrons: ribs fanned over a dome, coral growing from them
      parts.push(
        ...both((s) => {
          const out: MeshData[] = [pauldron(c.w, s, 1.28, deep, brass)];
          const cx = s * 0.41;
          for (let i = 0; i < 5; i++) {
            const a = -0.9 + i * 0.45;
            out.push(rod([cx, 1.34, 0], [cx + s * Math.cos(a) * 0.3, 1.16, Math.sin(a) * 0.3], 0.045, 0.03, 4, foam, mul(foam, 0.85), c.chest, M));
          }
          out.push(rod([cx + s * 0.1, 1.3, 0.04], [cx + s * 0.26, 1.72, 0.06], 0.08, 0.02, 5, coral, mix(coral, [1, 1, 1], 0.3), c.chest, M));
          out.push(rod([cx + s * 0.18, 1.5, 0.05], [cx + s * 0.44, 1.64, 0.04], 0.05, 0, 5, coral, mix(coral, [1, 1, 1], 0.3), c.chest, M));
          out.push(rod([cx - s * 0.04, 1.3, -0.08], [cx + s * 0.02, 1.58, -0.2], 0.07, 0, 5, coral, mix(coral, [1, 1, 1], 0.3), c.chest, M));
          return out;
        }),
      );
      parts.push(capeOf(c.w, rgb('#2a7a84'), foam, 'wave', 1.02));
      return parts;
    },
  },
  // the Sun: white and gold, and a halo you can see from across a field
  priest: {
    head(c) {
      const gold = rgb('#ffd24a');
      const pale = rgb('#fff2c0');
      const parts: MeshData[] = [];
      const face = plainHead(c.w, c.look, null, c.skin, c.hair);
      if (face) parts.push(face);
      // a circlet
      const band = new Build();
      band.post(0, 0.02, 0.56, 0.56, 1.96, 2.04, 12, gold, pale);
      parts.push(tied(band, c.head, 1, [0, 0, 0], M));
      parts.push(gemAt(c.head, 0, 2.0, 0.58, 0.08, rgb('#ffffff')));
      // the halo: a ring, and rays
      const halo = new Part();
      const cy = 1.86;
      const z = -0.62;
      const n = 20;
      const at = (a: number, r: number): number[] => [Math.cos(a) * r, cy + Math.sin(a) * r, z];
      const face2 = (pts: number[][], cols: C[]): void => {
        for (const flip of [1, -1]) {
          const ids = pts.map((p, i) => halo.corner([p[0]!, p[1]!, p[2]!, 0, 0, flip, 0, 0, flip, c.head, c.head, 255], cols[i]!));
          for (let i = 1; i + 1 < ids.length; i++) {
            if (flip > 0) halo.idx.push(ids[0]!, ids[i + 1]!, ids[i]!);
            else halo.idx.push(ids[0]!, ids[i]!, ids[i + 1]!);
          }
        }
      };
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        face2([at(a0, 0.84), at(a1, 0.84), at(a1, 1.02), at(a0, 1.02)], [gold, gold, pale, pale]);
        const long = i % 2 ? 1.28 : 1.5;
        face2([at(a0 + 0.04, 1.02), at(a1 - 0.04, 1.02), at(mid, long)], [pale, pale, mix(gold, pale, 0.3)]);
      }
      parts.push(halo.data(M));
      return parts;
    },
    chest(c) {
      const white = rgb('#f6f0dc');
      const gold = rgb('#ffd24a');
      const pale = rgb('#fff2c0');
      const parts = setBody(c, 'Cleric', 'Mage', { cloth: tup(white), metal: tup(gold) });
      const body = c.w.hero.meshes.Cleric_Body!;
      const low = body.min[1];
      // a stole down the front and the back, and a hem of gold
      parts.push(shell(body, [within(0.1), above(low), below(1.2)], 0.014, gold));
      parts.push(shell(body, [above(low), below(low + 0.12)], 0.014, gold));
      parts.push(shell(body, [above(low + 0.16), below(low + 0.2)], 0.014, gold));
      parts.push(gemAt(c.chest, 0, 0.98, frontAt(body, 0.98) + 0.03, 0.12, rgb('#ffffff')));
      // winged shoulders
      parts.push(
        ...both((s) => {
          const out: MeshData[] = [pauldron(c.w, s, 1.2, gold, pale)];
          for (let i = 0; i < 4; i++) {
            const a = 1.25 - i * 0.3;
            const len = 0.74 - i * 0.08;
            out.push(rod([s * 0.42, 1.26, -0.04], [s * (0.42 + Math.cos(a) * len), 1.26 + Math.sin(a) * len, -0.16], 0.08, 0, 5, gold, pale, c.chest, M));
          }
          return out;
        }),
      );
      parts.push(capeOf(c.w, rgb('#f2ead2'), gold, 'plain', 1.05));
      return parts;
    },
  },
  // Embers: all gold, a sun on each shoulder, a cape like a banked fire
  paladin: {
    head(c) {
      const gold = rgb('#e0b040');
      const white = rgb('#fff6dc');
      const parts: MeshData[] = [];
      parts.push(painted(c.w.hero.meshes.Paladin_Helmet!, { skin: c.skin, metal: tup(gold), cloth: hex('#c8501e'), plated: true }));
      parts.push(...both((s) => wing(c, s, [s * 0.58, 1.92, 0], gold, white, 1.2)));
      const slit = new Build();
      const fire = rgb('#ffd24a');
      slit.box(-0.3, 0.68, 0.3, 0.76, 1.64, 1.71, fire, fire, fire);
      parts.push(tied(slit, c.head, 1, [0, 0, 0], M));
      parts.push(blade(0.18, 2.28, 0.36, 0.4, 0.05, rgb('#c8501e'), rgb('#ffb040'), c.head, M), blade(-0.14, 2.3, 0.46, 0.42, 0.05, rgb('#c8501e'), rgb('#ffb040'), c.head, M));
      return parts;
    },
    chest(c) {
      const gold = rgb('#e0b040');
      const bright = rgb('#ffe08a');
      const ember = rgb('#c8501e');
      const red = rgb('#a82a1e');
      const parts = setBody(c, 'Paladin', 'Paladin', { metal: tup(gold), cloth: tup(red), plated: true });
      const body = c.w.hero.meshes.Paladin_Body!;
      parts.push(tabard(c, red, bright));
      // the breastplate is enamel the color of a banked fire, in a frame of gold
      parts.push(shell(body, [above(0.68), below(1.14)], 0.012, (_x, y) => mix(red, ember, (y - 0.68) / 0.46)));
      parts.push(shell(body, [above(0.68), below(0.73)], 0.018, bright));
      parts.push(shell(body, [above(1.1), below(1.15)], 0.018, bright));
      parts.push(shell(body, [above(0.6), below(0.68)], 0.018, bright));
      // a sun on the breast
      const f = frontAt(body, 0.98);
      parts.push(gemAt(c.chest, 0, 0.98, f + 0.02, 0.12, rgb('#ff8a2a')));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        parts.push(rod([Math.cos(a) * 0.09, 0.98 + Math.sin(a) * 0.09, f + 0.03], [Math.cos(a) * 0.23, 0.98 + Math.sin(a) * 0.23, f], 0.03, 0, 4, bright, ember, c.chest, M));
      }
      // and one on each shoulder
      parts.push(
        ...both((s) => {
          const out: MeshData[] = [pauldron(c.w, s, 1.42, gold, ember)];
          const cx = s * 0.42;
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2;
            const len = i % 2 ? 0.42 : 0.56;
            out.push(rod([cx + Math.cos(a) * 0.24, 1.16, Math.sin(a) * 0.24], [cx + Math.cos(a) * len, 1.2, Math.sin(a) * len], 0.07, 0, 4, bright, ember, c.chest, M));
          }
          return out;
        }),
      );
      parts.push(capeOf(c.w, ember, rgb('#ffb040'), 'wave', 1.05));
      return parts;
    },
  },
  // the Veil: a dark robe, a horned cowl with nothing in it but two green eyes
  warlock: {
    head(c) {
      const dark = rgb('#1f1a2a');
      const violet = rgb('#6a2a9a');
      const green = rgb('#8bff6a');
      const parts: MeshData[] = [];
      const face = c.w.hero.meshes.Knight_Head;
      if (face) parts.push(painted(face, { skin: hex('#120e18'), cloth: hex('#120e18'), metal: hex('#120e18') }));
      parts.push(painted(c.w.hero.meshes.Skeleton_Rogue_Hood!, { cloth: tup(mul(dark, 1.4)), metal: tup(violet) }));
      const ram = [[0.46, 2.0, -0.1], [0.88, 2.24, -0.2], [1.06, 2.02, -0.42], [0.86, 1.72, -0.52], [0.66, 1.8, -0.44]];
      const bone = rgb('#3a2a4a');
      const tip = rgb('#d8d0b8');
      parts.push(...horn(c, ram, [0.17, 0.14, 0.11, 0.07, 0], bone, tip));
      parts.push(...horn(c, ram.map(mirror), [0.17, 0.14, 0.11, 0.07, 0], bone, tip));
      const eyes = new Build();
      for (const s of [1, -1]) eyes.box(s * 0.19 - 0.075, 0.5, s * 0.19 + 0.075, 0.62, 1.62, 1.72, green, green, green);
      parts.push(tied(eyes, c.head, 1, [0, 0, 0], M));
      return parts;
    },
    chest(c) {
      const robe = rgb('#2a1f3a');
      const violet = rgb('#6a2a9a');
      const green = rgb('#8bff6a');
      const bone = rgb('#d8d0b8');
      const parts = setBody(c, 'Necromancer', 'Mage', { cloth: tup(robe), metal: tup(mul(violet, 1.1)) });
      const body = c.w.hero.meshes.Necromancer_Body!;
      const low = body.min[1];
      const front: Inside = (_x, _y, z) => z;
      parts.push(shell(body, [above(low), below(low + 0.09)], 0.014, violet));
      // runes down the front, burning
      parts.push(shell(body, [within(0.035), front, above(low + 0.12), below(1.06), (_x, y) => Math.sin(y * 42)], 0.014, green));
      parts.push(shell(body, [above(0.62), below(0.68)], 0.016, mul(violet, 0.8)));
      parts.push(gemAt(c.chest, 0, 0.98, frontAt(body, 0.98) + 0.02, 0.1, green));
      parts.push(
        ...both((s) => [
          pauldron(c.w, s, 1.3, mul(robe, 1.3), violet),
          rod([s * 0.46, 1.3, 0.04], [s * 0.7, 1.86, 0.02], 0.11, 0, 5, bone, mix(bone, [1, 1, 1], 0.4), c.chest, M),
          rod([s * 0.6, 1.24, -0.06], [s * 1, 1.56, -0.12], 0.09, 0, 5, bone, mix(bone, [1, 1, 1], 0.4), c.chest, M),
          rod([s * 0.36, 1.3, -0.1], [s * 0.42, 1.72, -0.28], 0.09, 0, 5, bone, mix(bone, [1, 1, 1], 0.4), c.chest, M),
        ]),
      );
      // a collar of black spikes behind the head
      for (const [x, t] of [[0, 0.82], [0.24, 0.72], [-0.24, 0.72], [0.46, 0.5], [-0.46, 0.5]] as const) parts.push(rod([x, 1.2, -0.3], [x * 1.35, 1.2 + t, -0.5], 0.09, 0, 4, robe, violet, c.chest, M));
      parts.push(capeOf(c.w, rgb('#3a2252'), violet, 'jag', 1.08));
      return parts;
    },
  },
  // Thorns: living bark, antlers in leaf, a cape of leaves
  druid: {
    head(c) {
      const wood = rgb('#8a6a3a');
      const leaf = rgb('#7ac84a');
      const light = rgb('#c8ff9a');
      const parts: MeshData[] = [];
      parts.push(painted(c.w.hero.meshes.Druid_Head!, { skin: c.skin, cloth: tup(mix(mul(wood, 0.72), leaf, 0.3)), white: tup(mix(wood, [1, 1, 1], 0.45)), metal: tup(wood) }));
      // a wider rack on top of the antlers it has, tipped with light
      parts.push(
        ...both((s) => [
          rod([s * 0.5, 2.34, -0.02], [s * 1.22, 2.92, -0.06], 0.07, 0, 5, wood, light, c.head, M),
          rod([s * 0.68, 2.5, -0.02], [s * 0.62, 3.14, 0.04], 0.06, 0, 5, wood, light, c.head, M),
          rod([s * 0.9, 2.66, -0.04], [s * 1.0, 3.2, -0.04], 0.05, 0, 5, wood, light, c.head, M),
          rod([s * 0.4, 2.1, 0.1], [s * 0.76, 2.3, 0.3], 0.1, 0, 4, leaf, light, c.head, M),
          rod([s * 0.34, 2.14, 0.2], [s * 0.48, 2.5, 0.42], 0.09, 0, 4, leaf, light, c.head, M),
        ]),
      );
      parts.push(gemAt(c.head, 0, 2.0, 0.6, 0.08, light));
      return parts;
    },
    chest(c) {
      const bark = rgb('#5a4a24');
      const moss = rgb('#4a8a3a');
      const leaf = rgb('#7ac84a');
      const light = rgb('#c8ff9a');
      const thorn = rgb('#3a2a18');
      const parts = setBody(c, 'Druid', 'Druid', { cloth: tup(mix(bark, moss, 0.28)), metal: tup(bark) });
      const body = c.w.hero.meshes.Druid_Body!;
      const low = body.min[1];
      // bark in plates, moss at the hem, a vine for a belt
      parts.push(shell(body, [above(0.72), below(1.1)], 0.016, (x, y, z) => mul(bark, Math.floor(y * 9 + x * 3 + z * 2) % 2 ? 1.18 : 0.86)));
      parts.push(shell(body, [above(low), below(low + 0.12)], 0.014, moss));
      parts.push(shell(body, [above(0.62), below(0.7)], 0.018, leaf));
      parts.push(gemAt(c.chest, 0, 0.66, frontAt(body, 0.66) + 0.02, 0.09, rgb('#ffd0e8')));
      // bark on the shoulders, thorns through it, leaves spilling off
      parts.push(
        ...both((s) => {
          const out: MeshData[] = [pauldron(c.w, s, 1.34, bark, moss)];
          const cx = s * 0.42;
          out.push(rod([cx, 1.3, 0.02], [cx + s * 0.18, 1.8, 0.04], 0.09, 0, 5, thorn, mix(thorn, light, 0.4), c.chest, M));
          out.push(rod([cx + s * 0.16, 1.24, -0.04], [cx + s * 0.56, 1.5, -0.08], 0.08, 0, 5, thorn, mix(thorn, light, 0.4), c.chest, M));
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + 0.4;
            out.push(rod([cx + Math.cos(a) * 0.2, 1.1, Math.sin(a) * 0.2], [cx + Math.cos(a) * 0.5, 0.96, Math.sin(a) * 0.5], 0.1, 0, 4, i % 2 ? leaf : moss, light, c.chest, M));
          }
          return out;
        }),
      );
      parts.push(capeOf(c.w, moss, leaf, 'leaf', 1.05));
      return parts;
    },
  },
  // the Gloam: smoke-dark plate under a dusk-colored breast, a great helm crowned like the sun going down, a cape
  // worn to rags
  gloamknight: {
    head(c) {
      const steel = rgb('#4a4658');
      const violet = rgb('#7a52b0');
      const glow = rgb('#c8a8ff');
      const ember = rgb('#ffb070');
      const bone = rgb('#24202c');
      const parts: MeshData[] = [];
      const helm = c.w.hero.meshes.Paladin_Helmet!;
      parts.push(painted(helm, { skin: c.skin, metal: tup(steel), cloth: tup(mul(violet, 0.55)), plated: true, white: tup(rgb('#9a94b4')) }));
      // a band of light across the brow, and the crown of the helm in dusk enamel
      const ahead: Inside = (_x, _y, z) => z - 0.2;
      parts.push(shell(helm, [within(0.42), ahead, above(1.84), below(1.9)], 0.014, glow));
      parts.push(shell(helm, [within(0.4), above(2.08)], 0.012, (_x, y) => mix(rgb('#8a3a5e'), mul(violet, 0.62), Math.min(1, (y - 2.08) / 0.3))));
      // horns swept back off the temples, their tips lit
      const sweep = [[0.46, 1.98, 0.02], [0.66, 2.16, -0.24], [0.7, 2.2, -0.6], [0.6, 2.06, -0.92], [0.46, 1.86, -1.08]];
      parts.push(...horn(c, sweep, [0.14, 0.12, 0.09, 0.05, 0], bone, glow));
      parts.push(...horn(c, sweep.map(mirror), [0.14, 0.12, 0.09, 0.05, 0], bone, glow));
      // three rays over the brow, the middle one the last of the sun
      for (let i = 0; i < 3; i++) {
        const a = Math.PI * (0.25 + i * 0.25);
        const tall = 0.3 + 0.2 * Math.sin(a);
        const x = Math.cos(a) * 0.44;
        const z = Math.sin(a) * 0.2 - 0.02;
        parts.push(rod([x, 2.14, z], [x * 1.3, 2.14 + tall, z - 0.08], 0.055, 0, 5, steel, i === 1 ? ember : glow, c.head, M));
      }
      // the visor burns violet
      const slit = new Build();
      slit.box(-0.3, 0.68, 0.3, 0.76, 1.64, 1.71, glow, glow, glow);
      parts.push(tied(slit, c.head, 1, [0, 0, 0], M));
      parts.push(blade(0.06, 2.24, 0.42, 0.62, 0.045, mul(violet, 0.6), glow, c.head, M));
      return parts;
    },
    chest(c) {
      const steel = rgb('#4a4658');
      const dark = rgb('#1e1a26');
      const violet = rgb('#7a52b0');
      const rose = rgb('#8a3a5e');
      const glow = rgb('#c8a8ff');
      const ember = rgb('#ffb070');
      const parts = setBody(c, 'Paladin', 'Paladin', { metal: tup(steel), cloth: tup(mul(violet, 0.5)), plated: true, white: tup(rgb('#9a94b4')) });
      const body = c.w.hero.meshes.Paladin_Body!;
      const front: Inside = (_x, _y, z) => z;
      // the breast is enamel the colors of a dusk sky, rose low and violet high, with a seam of light down the middle
      parts.push(shell(body, [above(0.68), below(1.14)], 0.012, (_x, y) => mix(rose, mul(violet, 0.62), (y - 0.68) / 0.46)));
      parts.push(shell(body, [above(0.68), below(0.72)], 0.018, glow));
      parts.push(shell(body, [above(1.1), below(1.15)], 0.018, glow));
      parts.push(shell(body, [within(0.03), front, above(0.72), below(1.1)], 0.02, glow));
      parts.push(shell(body, [above(0.6), below(0.68)], 0.018, mul(steel, 0.8)));
      parts.push(tabard(c, dark, violet));
      parts.push(gemAt(c.chest, 0, 0.98, frontAt(body, 0.98) + 0.03, 0.11, ember));
      // great pauldrons, each with three blades swept back like folded wings
      parts.push(
        ...both((s) => {
          const out: MeshData[] = [pauldron(c.w, s, 1.46, steel, glow)];
          for (let i = 0; i < 3; i++) {
            const up = 0.5 + i * 0.36;
            const len = 0.5 - i * 0.08;
            out.push(rod([s * 0.46, 1.3, -0.06 - i * 0.05], [s * (0.56 + Math.cos(up) * len), 1.3 + Math.sin(up) * len, -0.3 - i * 0.1], 0.08, 0, 5, steel, i === 0 ? ember : glow, c.chest, M));
          }
          return out;
        }),
      );
      parts.push(capeOf(c.w, rgb('#2a2236'), violet, 'jag', 1.14));
      return parts;
    },
  },
};

/* ------------------------------------------------------------------ the shop's sets */

/** A flat shape (a feather, a star, a wing's skin), seen from both sides, tied to a joint. */
function flat(points: readonly (readonly number[])[], colors: readonly C[], joint: number): MeshData {
  const out = new Part();
  const a = points[0]!;
  const b = points[1]!;
  const c = points[2]!;
  const n = new THREE.Vector3(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!).cross(new THREE.Vector3(c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!)).normalize();
  for (const flip of [1, -1]) {
    const ids = points.map((p, i) => out.corner([p[0]!, p[1]!, p[2]!, n.x * flip, n.y * flip, n.z * flip, n.x * flip, n.y * flip, n.z * flip, joint, joint, 255], colors[i % colors.length]!));
    for (let i = 1; i + 1 < ids.length; i++) {
      if (flip > 0) out.idx.push(ids[0]!, ids[i]!, ids[i + 1]!);
      else out.idx.push(ids[0]!, ids[i + 1]!, ids[i]!);
    }
  }
  return out.data(M);
}

/** A four-pointed star facing `face` (a unit vector), glowing. */
function star(at: readonly number[], r: number, face: THREE.Vector3, color: C, joint: number, turn = 0): MeshData {
  const u = new THREE.Vector3(0, 1, 0).cross(face);
  if (u.lengthSq() < 0.01) u.set(1, 0, 0);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(face, u).normalize();
  const pt = (a: number, k: number): number[] => {
    const x = Math.cos(a + turn) * r * k;
    const y = Math.sin(a + turn) * r * k;
    return [at[0]! + u.x * x + v.x * y, at[1]! + u.y * x + v.y * y, at[2]! + u.z * x + v.z * y];
  };
  const pts: number[][] = [];
  for (let i = 0; i < 8; i++) pts.push(pt((i * Math.PI) / 4, i % 2 ? 0.32 : 1));
  const centre = [at[0]!, at[1]!, at[2]!];
  const core = mix(color, [1, 1, 1], 0.6);
  const parts: MeshData[] = [];
  for (let i = 0; i < 8; i++) parts.push(flat([centre, pts[i]!, pts[(i + 1) % 8]!], [core, color, color], joint));
  return glowing(mergeAll(parts));
}

const mergeAll = (parts: MeshData[]): MeshData => mergeMeshes(parts);

/** A long feather: a flat blade from its root to its tip, its vane widest a third of the way along. */
function feather(root: readonly number[], tip: readonly number[], w: number, side: THREE.Vector3, c0: C, c1: C, joint: number): MeshData {
  const at = (t: number, k: number): number[] => [root[0]! + (tip[0]! - root[0]!) * t + side.x * w * k, root[1]! + (tip[1]! - root[1]!) * t + side.y * w * k, root[2]! + (tip[2]! - root[2]!) * t + side.z * w * k];
  const mid = mix(c0, c1, 0.4);
  return flat([[...root], at(0.35, 1), at(0.8, 0.55), [...tip], at(0.8, -0.55), at(0.35, -1)], [c0, mid, c1, c1, c1, mid], joint);
}

/** Where on the cape (capeOf, its full length) a point a height `y` down it is, and the joints that carry it there. */
function capeAt(w: Wardrobe, x: number, y: number): { p: number[]; j: number } {
  const z = y > 0.98 ? -0.2 - (1.24 - y) * 0.38 : y > 0.72 ? -0.3 - (0.98 - y) * 0.19 : -0.35 - (0.72 - y) * 0.14;
  const j = y > 0.98 ? w.medium.joints.indexOf('chest') : y > 0.6 ? w.medium.joints.indexOf('cape1') : w.medium.joints.indexOf('cape2');
  return { p: [x, y, z - 0.03], j };
}

type Pal = { main: C; trim: C; cloth: C; glow: C };
const palOf = (p: Piece | null | undefined, set: string): Pal => {
  const [main, trim, cloth, glow] = (p?.colors ?? sigilSetOf(set)?.colors ?? ['#888888', '#cccccc', '#444444', '#ffffff']).map(rgb);
  return { main: main!, trim: trim!, cloth: cloth!, glow: glow! };
};

/** The shop's armor sets (src/catalog/sigilItems.ts): any class wears them, in their own colors or an admin's. */
const SHOP_SETS: Record<string, { head(c: Ctx, p: Pal): MeshData[]; chest(c: Ctx, p: Pal): MeshData[] }> = {
  // black plate and gold: a king's crown fixed to a war helm, a drake's horns, and a visor with a fire behind it
  crownforged: {
    head(c, { main, trim, cloth, glow }) {
      const parts: MeshData[] = [];
      parts.push(painted(c.w.hero.meshes.Paladin_Helmet!, { skin: c.skin, metal: tup(main), cloth: tup(cloth), plated: true, white: tup(mix(main, trim, 0.35)) }));
      // the crown: a band, and points round it, the front ones tallest
      const band = new Build();
      band.post(0, -0.02, 0.6, 0.62, 2.0, 2.13, 14, mul(trim, 0.8), trim);
      parts.push(tied(band, c.head, 1, [0, 0, 0], M));
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        const front = Math.max(0, Math.sin(a));
        const tall = (i % 2 ? 0.2 : 0.34) + 0.16 * front;
        const x = Math.cos(a) * 0.6;
        const z = Math.sin(a) * 0.6 - 0.02;
        parts.push(rod([x, 2.1, z], [x * 1.12, 2.1 + tall, z * 1.12], 0.085, 0, 4, trim, mix(trim, [1, 1, 1], 0.45), c.head, M));
      }
      parts.push(glowing(gemAt(c.head, 0, 2.06, 0.64, 0.07, glow)));
      // a drake's horns, sweeping back
      const root = [0.5, 1.9, -0.12];
      const curve = [root, [0.74, 2.06, -0.42], [0.86, 2.3, -0.78], [0.8, 2.6, -1.06]];
      parts.push(...horn(c, curve, [0.15, 0.115, 0.07, 0], mul(main, 1.1), trim));
      parts.push(...horn(c, curve.map(mirror), [0.15, 0.115, 0.07, 0], mul(main, 1.1), trim));
      // the visor burns
      const slit = new Build();
      slit.box(-0.26, 0.62, 0.26, 0.7, 1.645, 1.7, glow, glow, glow);
      parts.push(glowing(tied(slit, c.head, 1, [0, 0, 0], M)));
      return parts;
    },
    chest(c, { main, trim, cloth, glow }) {
      const parts = setBody(c, 'Paladin', 'Paladin', { metal: tup(main), cloth: tup(cloth), plated: true, white: tup(mix(main, trim, 0.3)) });
      const body = c.w.hero.meshes.Paladin_Body!;
      const front: Inside = (_x, _y, z) => z;
      // seams of molten gold between the plates, and gold at the edges
      parts.push(glowing(shell(body, [within(0.022), front, above(0.66), below(1.1)], 0.016, glow)));
      parts.push(glowing(shell(body, [above(0.88), below(0.905)], 0.015, glow)));
      parts.push(shell(body, [above(0.6), below(0.68)], 0.018, trim));
      parts.push(shell(body, [above(1.08), below(1.13)], 0.018, trim));
      parts.push(tabard(c, cloth, trim));
      // a burning heart on the breast, in a crown of gold
      const f = frontAt(body, 0.98);
      parts.push(glowing(gemAt(c.chest, 0, 0.98, f + 0.025, 0.11, glow)));
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.1 + (0.8 * i) / 5);
        parts.push(rod([Math.cos(a) * 0.12, 1.02 + Math.sin(a) * 0.08, f + 0.02], [Math.cos(a) * 0.2, 1.04 + Math.sin(a) * 0.2, f + 0.01], 0.03, 0, 4, trim, mix(trim, [1, 1, 1], 0.4), c.chest, M));
      }
      // pauldrons, and on each a drake's wing, its skin veined with fire
      parts.push(
        ...both((s) => {
          const out: MeshData[] = [pauldron(c.w, s, 1.5, main, trim)];
          const R0 = [s * 0.46, 1.32, -0.1];
          const tips = [
            [s * 0.66, 2.08, -0.3],
            [s * 0.98, 1.86, -0.36],
            [s * 1.14, 1.48, -0.3],
          ];
          for (const t of tips) out.push(rod(R0, t, 0.05, 0.012, 5, mul(main, 1.2), trim, c.chest, M));
          const sc = (a: number[], b: number[], k: number): number[] => [(a[0]! + b[0]!) / 2 - s * k * 0.1, (a[1]! + b[1]!) / 2 - k * 0.12, (a[2]! + b[2]!) / 2];
          const skinC = mul(cloth, 0.9);
          out.push(flat([R0, tips[0]!, sc(tips[0]!, tips[1]!, 1), tips[1]!], [skinC, mul(cloth, 1.15), skinC, mul(cloth, 1.15)], c.chest));
          out.push(flat([R0, tips[1]!, sc(tips[1]!, tips[2]!, 1), tips[2]!], [skinC, mul(cloth, 1.15), skinC, mul(cloth, 1.15)], c.chest));
          out.push(glowing(flat([R0, [R0[0]! + s * 0.36, R0[1]! + 0.5, R0[2]! - 0.21], [R0[0]! + s * 0.38, R0[1]! + 0.46, R0[2]! - 0.215]], [glow], c.chest)));
          out.push(glowing(flat([R0, [R0[0]! + s * 0.58, R0[1]! + 0.26, R0[2]! - 0.23], [R0[0]! + s * 0.6, R0[1]! + 0.22, R0[2]! - 0.23]], [glow], c.chest)));
          // and a spike at the front
          out.push(rod([s * 0.48, 1.34, 0.12], [s * 0.66, 1.66, 0.22], 0.07, 0, 5, main, trim, c.chest, M));
          return out;
        }),
      );
      parts.push(capeOf(c.w, cloth, trim, 'jag', 1.12));
      return parts;
    },
  },
  // white and silver: a circlet with a crescent moon, a ring of stars over it, a cape of night full of stars
  celestine: {
    head(c, { main, trim, cloth, glow }) {
      const parts: MeshData[] = [];
      const face = plainHead(c.w, c.look, null, c.skin, c.hair);
      if (face) parts.push(face);
      const band = new Build();
      band.post(0, 0.02, 0.56, 0.57, 1.95, 2.04, 14, mul(trim, 0.85), trim);
      parts.push(tied(band, c.head, 1, [0, 0, 0], M));
      // the crescent on the brow, glowing
      const moon: number[][] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (0.15 + (0.7 * i) / 8);
        moon.push([Math.cos(a) * 0.17, 2.1 - Math.sin(a) * 0.17 + 0.17, 0.62]);
      }
      for (let i = 8; i >= 0; i--) {
        const a = Math.PI * (0.15 + (0.7 * i) / 8);
        moon.push([Math.cos(a) * 0.12, 2.1 - Math.sin(a) * 0.1 + 0.17, 0.625]);
      }
      const strip: MeshData[] = [];
      for (let i = 0; i < 8; i++) strip.push(flat([moon[i]!, moon[i + 1]!, moon[17 - i - 1]!, moon[17 - i]!], [glow, mix(glow, [1, 1, 1], 0.4)], c.head));
      parts.push(glowing(mergeAll(strip)));
      // little silver wings at the temples
      parts.push(...both((s) => wing(c, s, [s * 0.55, 1.92, 0.02], trim, mix(main, [1, 1, 1], 0.4), 0.55)));
      // the ring of stars, tilted, over and behind the head
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const x = Math.cos(a) * 0.82;
        const z = Math.sin(a) * 0.62 - 0.12;
        const y = 2.42 - Math.sin(a) * 0.12;
        const big = i % 3 === 0;
        parts.push(star([x, y, z], big ? 0.17 : 0.11, new THREE.Vector3(0, 0, 1), big ? glow : mix(glow, cloth, 0.2), c.head, a));
      }
      return parts;
    },
    chest(c, { main, trim, cloth, glow }) {
      const parts = setBody(c, 'Cleric', 'Mage', { cloth: tup(main), metal: tup(trim), white: tup(mix(main, trim, 0.2)) });
      const body = c.w.hero.meshes.Cleric_Body!;
      const low = body.min[1];
      const front: Inside = (_x, _y, z) => z;
      // a panel of night down the front, edged in silver, with stars in it
      parts.push(shell(body, [within(0.13), front, above(low), below(1.0)], 0.014, cloth));
      parts.push(shell(body, [within(0.155), (x) => Math.abs(x) - 0.13, front, above(low), below(1.0)], 0.016, trim));
      parts.push(shell(body, [above(low), below(low + 0.08)], 0.016, trim));
      parts.push(shell(body, [above(0.62), below(0.68)], 0.016, trim));
      for (const [x, y, r] of [[0.03, 0.88, 0.05], [-0.05, 0.72, 0.035], [0.05, 0.56, 0.04], [-0.02, 0.42, 0.03]] as const) parts.push(star([x, y, frontAt(body, y) + 0.03], r, new THREE.Vector3(0, 0, 1), glow, c.chest));
      parts.push(glowing(gemAt(c.chest, 0, 1.02, frontAt(body, 1.02) + 0.03, 0.09, glow)));
      // crescent pauldrons, arching over the shoulders
      parts.push(
        ...both((s) => {
          const out: MeshData[] = [pauldron(c.w, s, 1.15, trim, mix(main, [1, 1, 1], 0.4))];
          const arc: number[][] = [];
          for (let i = 0; i < 6; i++) {
            const a = Math.PI * (0.1 + (0.8 * i) / 5);
            arc.push([s * (0.5 + Math.sin(a) * 0.12), 1.24 + Math.sin(a) * 0.42, Math.cos(a) * 0.34]);
          }
          out.push(...horn(c, arc, [0.02, 0.07, 0.095, 0.095, 0.07, 0.02], trim, mix(trim, [1, 1, 1], 0.5), c.chest));
          return out;
        }),
      );
      // a constellation in an arch behind the shoulders: stars, and lines of light between them
      const sky: number[][] = [];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.08 + (0.84 * i) / 6);
        sky.push([Math.cos(a) * 0.78, 1.25 + Math.sin(a) * 0.62 + (i % 2 ? 0.06 : -0.04), -0.46 - Math.sin(a) * 0.08]);
      }
      sky.forEach((p, i) => {
        parts.push(star(p, i % 3 === 0 ? 0.1 : 0.065, new THREE.Vector3(0, 0, 1), glow, c.chest, i));
        const q = sky[i + 1];
        if (!q) return;
        const d = new THREE.Vector3(q[0]! - p[0]!, q[1]! - p[1]!, 0).normalize().multiplyScalar(0.011);
        parts.push(glowing(flat([[p[0]! - d.y, p[1]! + d.x, p[2]!], [q[0]! - d.y, q[1]! + d.x, q[2]!], [q[0]! + d.y, q[1]! - d.x, q[2]!], [p[0]! + d.y, p[1]! - d.x, p[2]!]], [mix(glow, cloth, 0.3)], c.chest)));
      });
      // the cape of night, and its stars
      parts.push(capeOf(c.w, cloth, trim, 'wave', 1.12));
      const spots = [[0.12, 1.08, 0.06], [-0.2, 0.96, 0.045], [0.3, 0.78, 0.05], [-0.06, 0.7, 0.07], [-0.34, 0.56, 0.045], [0.18, 0.46, 0.04], [0.02, 0.3, 0.055], [-0.22, 0.22, 0.04], [0.36, 0.22, 0.045]];
      for (const [x, y, r] of spots) {
        const at = capeAt(c.w, x!, y!);
        parts.push(star(at.p, r!, new THREE.Vector3(0, 0, -1), mix(glow, [1, 1, 1], 0.2), at.j));
      }
      return parts;
    },
  },
  // black feathers: a hood with a beaked mask and a crest, eyes that glow, a mantle and a cape of feathers
  gloamquill: {
    head(c, { main, trim, glow }) {
      const parts: MeshData[] = [];
      const face = c.w.hero.meshes.Knight_Head;
      if (face) parts.push(painted(face, { skin: tup(mul(main, 0.6)), cloth: tup(mul(main, 0.6)), metal: tup(mul(main, 0.6)) }));
      parts.push(painted(c.w.hero.meshes.Skeleton_Rogue_Hood!, { cloth: tup(mul(main, 1.15)), metal: tup(trim) }));
      // the beaked mask: a brow over the eyes, and a long hooked beak
      const beak = mix(main, trim, 0.45);
      parts.push(rod([0, 1.76, 0.5], [0, 1.58, 0.96], 0.16, 0.05, 4, mix(beak, [1, 1, 1], 0.15), beak, c.head, M));
      parts.push(rod([0, 1.58, 0.96], [0, 1.42, 1.06], 0.05, 0, 4, beak, mix(trim, [1, 1, 1], 0.45), c.head, M));
      parts.push(rod([0, 1.5, 0.52], [0, 1.46, 0.8], 0.1, 0.03, 4, mul(beak, 0.75), beak, c.head, M));
      // eyes like slits of light, slanting up and out
      for (const s of [1, -1]) parts.push(glowing(flat([[s * 0.1, 1.68, 0.6], [s * 0.3, 1.74, 0.55], [s * 0.31, 1.78, 0.55], [s * 0.1, 1.73, 0.6]], [glow, mix(glow, [1, 1, 1], 0.5)], c.head)));
      // a crest of feathers, swept back, and tufts at the sides
      const side = new THREE.Vector3(1, 0, 0);
      for (const [z, t, k] of [[0.3, 0.5, 0.11], [0.1, 0.68, 0.13], [-0.12, 0.78, 0.14], [-0.34, 0.7, 0.13], [-0.52, 0.52, 0.11]] as const) parts.push(feather([0, 2.08, z], [0, 2.08 + t * 0.62, z - t * 0.8], k, side, mul(main, 1.3), trim, c.head));
      parts.push(
        ...both((s) => [
          feather([s * 0.48, 1.86, -0.08], [s * 0.94, 2.16, -0.42], 0.09, new THREE.Vector3(0, 1, 0), mul(main, 1.2), trim, c.head),
          feather([s * 0.46, 1.72, -0.12], [s * 0.92, 1.84, -0.52], 0.08, new THREE.Vector3(0, 1, 0), mul(main, 1.2), trim, c.head),
        ]),
      );
      return parts;
    },
    chest(c, { main, trim, cloth, glow }) {
      const parts = setBody(c, 'RogueHooded', 'Rogue', { cloth: tup(cloth), metal: tup(trim) });
      const body = c.w.hero.meshes.RogueHooded_Body!;
      const low = body.min[1];
      // leather straps crossing the chest, and a belt with a clasp that glows
      const front: Inside = (_x, _y, z) => z;
      parts.push(shell(body, [front, (x, y) => 0.045 - Math.abs(y - 0.68 - x * 0.9), above(0.66), below(1.12)], 0.016, mul(main, 1.4)));
      parts.push(shell(body, [front, (x, y) => 0.045 - Math.abs(y - 0.68 + x * 0.9), above(0.66), below(1.12)], 0.016, mul(main, 1.4)));
      parts.push(shell(body, [above(0.6), below(0.68)], 0.018, mul(main, 1.3)));
      parts.push(shell(body, [above(low), below(low + 0.07)], 0.014, trim));
      parts.push(glowing(gemAt(c.chest, 0, 0.64, frontAt(body, 0.64) + 0.03, 0.08, glow)));
      // the mantle: two rows of feathers round the shoulders, falling outward
      for (const row of [0, 1]) {
        const n = 13;
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (-0.05 + (1.1 * i) / (n - 1));
          const out = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a) * 0.9 + 0.12);
          const r = 0.34 + row * 0.08;
          const root = [out.x * r * 1.05, 1.32 - row * 0.12, out.z * r];
          const len = 0.4 + row * 0.14 + (i % 2) * 0.06;
          const tip = [root[0]! + out.x * len * 0.62, root[1]! - len * 0.78, root[2]! + out.z * len * 0.62];
          const sideV = new THREE.Vector3(-out.z, 0, out.x).normalize();
          parts.push(feather(root, tip, 0.075 + row * 0.01, sideV, row ? mul(main, 1.1) : mul(main, 1.4), row ? trim : mix(main, trim, 0.5), c.chest));
        }
      }
      // the cape, and feathers along its hem
      parts.push(capeOf(c.w, main, null, 'jag', 1.18));
      for (let i = 0; i < 9; i++) {
        const x = -0.48 + (i / 8) * 0.96;
        const top = capeAt(c.w, x, 0.32 + (i % 2) * 0.05);
        const tip = [top.p[0]! * 1.05, top.p[1]! - 0.34 - (i % 2) * 0.08, top.p[2]! - 0.06];
        parts.push(feather(top.p, tip, 0.07, new THREE.Vector3(1, 0, 0), mul(main, 1.2), trim, top.j));
      }
      return parts;
    },
  },
};

/* ------------------------------------------------------------------ all of it */

/** Everything a hero wears, down to what's in their hands. */
export function heroParts(w: Wardrobe, look: HeroLook): MeshData[] {
  const skin = hex(look.skin);
  const hair = hex(look.hair);
  const J = (n: string): number => w.medium.joints.indexOf(n);
  const parts: MeshData[] = [];
  const ctx: Ctx = { w, skin, hair, look, head: J('head'), chest: J('chest'), hips: J('hips') };
  const headSet = look.head?.set;
  const shopHead = headSet ? SHOP_SETS[headSet] : undefined;
  const wardenHead = headSet ? SETS[headSet as ClassId] : undefined;
  parts.push(...(shopHead ? shopHead.head(ctx, palOf(look.head, headSet!)) : wardenHead ? wardenHead.head(ctx) : ladderHead(w, look, skin, hair)));
  const chestSet = look.chest.set;
  const shopChest = chestSet ? SHOP_SETS[chestSet] : undefined;
  const wardenChest = chestSet ? SETS[chestSet as ClassId] : undefined;
  if (shopChest) parts.push(...shopChest.chest(ctx, palOf(look.chest, chestSet!)));
  else if (wardenChest) parts.push(...wardenChest.chest(ctx));
  else {
    parts.push(...ladderChest(w, look, skin).parts);
    parts.push(...ladderLegs(w, look, skin));
  }
  // what hangs on the back
  if (look.quiver) {
    const m = w.hero.meshes.Ranger_Quiver;
    if (m) parts.push(painted(m, { cloth: hex(look.quiver) }));
  }
  return parts;
}

/** Every model named here (a test holds them to the built files). */
export const armorParts = (): string[] => {
  const out = new Set<string>([...BEARDS, 'Ranger_Quiver', 'Knight_Head', 'Mage_Head', 'Rogue_Head', 'Ranger_Head', 'Skeleton_Rogue_Hood', 'Paladin_Helmet', 'RogueHooded_Head', 'RogueHooded_Mask', 'Druid_Head', 'Necromancer_Body', 'Cleric_Body', 'Druid_Body', 'RogueHooded_Body', 'Paladin_Body']);
  for (const table of Object.values(HEAD_LADDER)) for (const c of Object.values(table)) for (const p of c.parts) out.add(p);
  for (const table of Object.values(CHEST_LADDER)) {
    for (const kind of Object.values(table)) {
      out.add(`${kind}_Body`);
      const sleeve = SLEEVES[kind] ?? kind;
      out.add(`${sleeve}_ArmLeft`);
      out.add(`${sleeve}_ArmRight`);
    }
  }
  for (const table of Object.values(LEG_LADDER)) {
    for (const kind of Object.values(table)) {
      out.add(`${kind}_LegLeft`);
      out.add(`${kind}_LegRight`);
    }
  }
  return [...out];
};


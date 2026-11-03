import * as THREE from 'three';
import type { HeroLook, Piece } from '../render/art/hero';
import { hexRgb } from './kits';
import { loadPack, mergeMeshes, type MeshData, type Pack } from './pack';
import { rigAnimOf, type RigAnim } from './toon';

/**
 * A person from a look: every piece of gear picks a model from the wardrobe (all share one skeleton), gets its
 * dye, and all of it merges into one model, so a fully dressed hero costs one draw call.
 *
 * Which model a piece wears comes from the item's own look (kind, color, rarity), so two different helmets look
 * different, and the same one always looks the same.
 */

export interface Wardrobe {
  hero: Pack;
  rigs: Pack;
  medium: RigAnim;
  large: RigAnim;
}

let wardrobe: Promise<Wardrobe> | null = null;
export function loadWardrobe(): Promise<Wardrobe> {
  if (!wardrobe) {
    wardrobe = Promise.all([loadPack('hero'), loadPack('rigs')]).then(([hero, rigs]) => ({ hero, rigs, medium: rigAnimOf(rigs, 'medium'), large: rigAnimOf(rigs, 'large') }));
    wardrobe.catch(() => (wardrobe = null));
  }
  return wardrobe;
}

/* ------------------------------------------------------------------ colors */

function rgbHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}
function hslRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

/** What a swatch is, by eye. */
const isSkin = (h: number, s: number, l: number): boolean => h >= 12 && h <= 36 && s > 0.45 && l > 0.62;
const isDark = (l: number): boolean => l < 0.14;
const isWhite = (s: number, l: number): boolean => l > 0.88 && s < 0.5;
const isMetal = (s: number, l: number): boolean => s < 0.16 && l >= 0.14;

/** Moves a color onto `to`, keeping how light or dark it was next to its neighbours (the swatch's own shading). */
function repaint(col: Uint8Array, i: number, to: [number, number, number], l: number, baseL: number): void {
  const [h, s, tl] = rgbHsl(to[0], to[1], to[2]);
  const nl = Math.max(0.03, Math.min(0.97, tl + (l - baseL) * 0.75));
  const [r, g, b] = hslRgb(h, s, nl);
  col[i] = r * 255;
  col[i + 1] = g * 255;
  col[i + 2] = b * 255;
}

interface Paint {
  /** Skin swatches. */
  skin?: [number, number, number];
  /** Cloth and leather swatches. */
  cloth?: [number, number, number];
  /** Grey metal swatches. */
  metal?: [number, number, number];
  /** Anything else colored (a head's hair). */
  hair?: [number, number, number];
}

function painted(m: MeshData, paint: Paint): MeshData {
  const col = new Uint8Array(m.col);
  // the middle lightness of each swatch family, so a dye lands on its own color rather than a shade of it
  let clothL = 0;
  let clothN = 0;
  for (let v = 0; v < m.n; v++) {
    const [h, s, l] = rgbHsl(col[v * 3]! / 255, col[v * 3 + 1]! / 255, col[v * 3 + 2]! / 255);
    if (!isSkin(h, s, l) && !isDark(l) && !isMetal(s, l) && !isWhite(s, l)) {
      clothL += l;
      clothN++;
    }
  }
  const midCloth = clothN ? clothL / clothN : 0.5;
  for (let v = 0; v < m.n; v++) {
    const i = v * 3;
    const [h, s, l] = rgbHsl(col[i]! / 255, col[i + 1]! / 255, col[i + 2]! / 255);
    if (isSkin(h, s, l)) {
      if (paint.skin) repaint(col, i, paint.skin, l, 0.75);
    } else if (isDark(l) || isWhite(s, l)) continue;
    else if (isMetal(s, l)) {
      if (paint.metal) repaint(col, i, paint.metal, l, 0.5);
    } else if (paint.cloth) repaint(col, i, paint.cloth, l, midCloth);
    else if (paint.hair) repaint(col, i, paint.hair, l, midCloth);
  }
  return { ...m, col };
}

/** Paints only the vertices tied to these joints (a pair of gloves on an arm, boots on a leg). */
function paintJoints(m: MeshData, joints: Set<number>, to: [number, number, number]): MeshData {
  const col = new Uint8Array(m.col);
  for (let v = 0; v < m.n; v++) {
    if (!joints.has(m.skin![v * 3]!)) continue;
    const i = v * 3;
    const [h, s, l] = rgbHsl(col[i]! / 255, col[i + 1]! / 255, col[i + 2]! / 255);
    if (isDark(l) || isWhite(s, l)) continue;
    void h;
    repaint(col, i, to, l, 0.55);
  }
  return { ...m, col };
}

function pieceHash(p: { style: string; tint: string; mat: string; r: string }): number {
  let h = 2166136261;
  for (const c of `${p.style}|${p.tint}|${p.mat}|${p.r}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const pickOf = <T,>(list: readonly T[], p: Parameters<typeof pieceHash>[0]): T => list[pieceHash(p) % list.length]!;

/* ------------------------------------------------------------------ the wardrobe */

const CHESTS = {
  plate: ['Knight_Body', 'Paladin_Body'],
  tunic: ['Rogue_Body', 'Ranger_Body', 'Barbarian_Body', 'Engineer_Body', 'Survivalist_Body'],
  robe: ['Mage_Body', 'Cleric_Body', 'Witch_Body', 'Necromancer_Body', 'Druid_Body'],
} as const;

/** A head's covering, and whether hair stays out from under it. */
const HEADS: Record<string, { parts: string[]; bald?: boolean; own?: boolean }[]> = {
  helm: [
    { parts: ['Knight_Helmet', 'Knight_HelmetVisor'], bald: true },
    { parts: ['Paladin_Helmet'], own: true },
    { parts: ['Skeleton_Warrior_Helmet'], bald: true },
    { parts: ['Barbarian_BearHat'], bald: true },
  ],
  hood: [{ parts: ['Rogue_Hooded_Head'], own: true }, { parts: ['Skeleton_Rogue_Hood'], bald: true }, { parts: ['Ninja_Headband', 'Ninja_Mask'], bald: true }],
  cap: [{ parts: ['Farmer_A_Hat'], bald: true }, { parts: ['Hiker_Hat'], bald: true }, { parts: ['Helper_A_Hat'], bald: true }],
  crown: [{ parts: ['Necromancer_Crown'] }],
  wizard: [{ parts: ['Mage_Hat'], bald: true }, { parts: ['Witch_Hat'], bald: true }, { parts: ['Skeleton_Mage_Hat'], bald: true }],
};

const HAND_JOINTS = ['hand.l', 'hand.r', 'wrist.l', 'wrist.r', 'handslot.l', 'handslot.r'];
const FOOT_JOINTS = ['foot.l', 'foot.r', 'toes.l', 'toes.r'];

const WEAPONS: Record<string, readonly string[]> = {
  sword: ['w_sword_A', 'w_sword_B', 'w_sword_C', 'w_sword_D', 'w_sword_E', 'w_sword_F', 'w_sword_G'],
  axe: ['w_axe_A', 'w_axe_B', 'w_axe_C', 'w_axe_D'],
  hammer: ['w_hammer_A', 'w_hammer_B', 'w_hammer_C', 'w_hammer_D'],
  staff: ['w_staff_A', 'w_staff_B', 'w_staff_C', 'w_staff_D'],
  bow: ['w_bow_A_withString', 'w_bow_B_withString', 'w_bow_C_withString'],
  dagger: ['w_dagger_A', 'w_dagger_B', 'w_dagger_C'],
  wand: ['w_wand_A', 'w_wand_B'],
  spear: ['w_spear_A', 'w_halberd'],
};
const SHIELDS = ['w_shield_A', 'w_shield_B', 'w_shield_C', 'w_shield_D', 'w_shield_round', 'w_shield_square', 'w_shield_badge', 'w_shield_spikes'];

/** A rigid thing tied to one joint, placed where that joint is at rest. */
function tiedTo(m: MeshData, joint: number, anim: RigAnim, shift?: THREE.Matrix4): MeshData {
  const ibm = new THREE.Matrix4().fromArray(anim.ibm, joint * 16);
  const world = ibm.invert();
  if (shift) world.multiply(shift);
  const pos = new Float32Array(m.n * 3);
  const nor = new Int8Array(m.n * 3);
  const sn = new Int8Array(m.n * 3);
  const skin = new Uint8Array(m.n * 3);
  const v = new THREE.Vector3();
  const normal = new THREE.Matrix3().getNormalMatrix(world);
  for (let i = 0; i < m.n; i++) {
    v.set(m.pos[i * 3]!, m.pos[i * 3 + 1]!, m.pos[i * 3 + 2]!).applyMatrix4(world);
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
    v.set(m.nor[i * 3]!, m.nor[i * 3 + 1]!, m.nor[i * 3 + 2]!).applyMatrix3(normal).normalize();
    nor[i * 3] = v.x * 127;
    nor[i * 3 + 1] = v.y * 127;
    nor[i * 3 + 2] = v.z * 127;
    v.set(m.sn[i * 3]!, m.sn[i * 3 + 1]!, m.sn[i * 3 + 2]!).applyMatrix3(normal).normalize();
    sn[i * 3] = v.x * 127;
    sn[i * 3 + 1] = v.y * 127;
    sn[i * 3 + 2] = v.z * 127;
    skin[i * 3] = joint;
    skin[i * 3 + 1] = joint;
    skin[i * 3 + 2] = 255;
  }
  return { ...m, pos, nor, sn, skin, rig: 'medium', min: [-9, -9, -9], max: [9, 9, 9] };
}

const STEEL: [number, number, number] = [0.66, 0.7, 0.76];
const IRON: [number, number, number] = [0.47, 0.49, 0.55];
const GOLD: [number, number, number] = [0.98, 0.78, 0.3];

function metalOf(p: Piece): [number, number, number] {
  if (p.r === 'legendary' || p.r === 'epic') return GOLD;
  return p.mat === 'mail' ? IRON : STEEL;
}

export interface Held {
  kind: string;
  tint?: string;
}

/** The parts of a look, painted and merged into one model. */
export function dressedMesh(w: Wardrobe, look: HeroLook, held: Held | null, shield = false): MeshData {
  const part = (id: string): MeshData | null => {
    const m = w.hero.meshes[id];
    return m && m.rig !== 'large' ? m : null;
  };
  const parts: MeshData[] = [];
  const skin = hexRgb(look.skin);
  const hair = hexRgb(look.hair);
  const J = (names: string[]): Set<number> => new Set(names.map((n) => w.medium.joints.indexOf(n)).filter((j) => j >= 0));
  const hands = J(HAND_JOINTS);
  const feet = J(FOOT_JOINTS);
  const add = (m: MeshData | null): void => {
    if (m) parts.push(m);
  };

  // the head: a covering, and what is under it
  const headP = look.head;
  const covers = headP ? (HEADS[headP.style] ?? HEADS.cap!) : null;
  const cover = covers && headP ? pickOf(covers, headP) : null;
  const headTint = headP ? hexRgb(headP.tint) : [1, 1, 1] as [number, number, number];
  const metalHead = headP?.style === 'helm' || headP?.style === 'crown';
  if (!cover?.own) {
    const face = cover?.bald ? 'Knight_Head' : look.beard ? 'Survivalist_Head' : look.hairStyle === 'long' ? 'Mage_Head' : look.hairStyle === 'pony' ? 'Rogue_Head' : 'Ranger_Head';
    const m = part(face);
    if (m) add(painted(m, { skin, cloth: hair, metal: look.hairStyle === 'long' ? hair : undefined }));
  }
  for (const id of cover?.parts ?? []) {
    const m = part(id);
    if (!m) continue;
    if (cover?.own && m === part('Rogue_Hooded_Head')) add(painted(m, { skin, cloth: headTint }));
    else if (metalHead) add(painted(m, { metal: headP ? metalOf(headP) : undefined, cloth: headTint }));
    else add(painted(m, { cloth: headTint, metal: headTint }));
  }

  // the body
  const chestP = look.chest;
  const chestId = pickOf(CHESTS[chestP.style] ?? CHESTS.tunic, chestP);
  const chest = part(chestId) ?? part('Rogue_Body')!;
  add(painted(chest, { skin, cloth: hexRgb(chestP.tint), metal: chestP.style === 'plate' ? metalOf(chestP) : undefined }));

  // arms, with whatever is on the hands
  const robed = chestP.style === 'robe';
  const armOf = robed ? 'Mage' : chestP.style === 'plate' ? 'Knight' : look.hands?.style === 'gauntlets' ? 'Knight' : 'Rogue';
  for (const side of ['ArmLeft', 'ArmRight']) {
    const m = part(`${armOf}_${side}`);
    if (!m) continue;
    let dressed = painted(m, { skin, cloth: hexRgb(chestP.tint), metal: chestP.style === 'plate' ? metalOf(chestP) : undefined });
    if (look.hands) dressed = paintJoints(dressed, hands, look.hands.style === 'gauntlets' ? metalOf(look.hands) : hexRgb(look.hands.tint));
    add(dressed);
  }

  // legs and feet
  const legOf = robed ? 'Mage' : look.legs.style === 'greaves' ? 'Knight' : 'Rogue';
  for (const side of ['LegLeft', 'LegRight']) {
    const m = part(`${legOf}_${side}`);
    if (!m) continue;
    let dressed = painted(m, { skin, cloth: hexRgb(robed ? chestP.tint : look.legs.tint), metal: look.legs.style === 'greaves' ? metalOf(look.legs) : undefined });
    if (!robed) dressed = paintJoints(dressed, feet, look.feet.style === 'sabatons' ? metalOf(look.feet) : hexRgb(look.feet.tint));
    add(dressed);
  }

  // what hangs on the back
  if (look.cape) {
    const m = part('Knight_Cape');
    if (m) add(painted(m, { cloth: hexRgb(look.cape), metal: hexRgb(look.cape) }));
  }
  const chestJ = w.medium.joints.indexOf('chest');
  if (look.quiver && part('w_quiver') === null) {
    const m = w.hero.meshes.w_quiver;
    if (m) add(tiedTo(painted(m, { cloth: hexRgb(look.quiver) }), chestJ, w.medium, new THREE.Matrix4().makeTranslation(0, 0.3, -0.45)));
  }

  // what is in the hands
  const rightHand = w.medium.joints.indexOf('handslot.r');
  const leftHand = w.medium.joints.indexOf('handslot.l');
  if (held) {
    const list = WEAPONS[held.kind] ?? WEAPONS.sword!;
    const m = w.hero.meshes[pickOf(list, { style: held.kind, tint: held.tint ?? '', mat: '', r: '' })];
    if (m) add(tiedTo(held.tint ? painted(m, { cloth: hexRgb(held.tint) }) : m, held.kind === 'bow' ? leftHand : rightHand, w.medium));
  }
  if (shield) {
    const m = w.hero.meshes[pickOf(SHIELDS, { style: 'shield', tint: chestP.tint, mat: chestP.mat, r: chestP.r })];
    if (m) add(tiedTo(painted(m, { cloth: hexRgb(chestP.tint) }), leftHand, w.medium));
  }
  return mergeMeshes(parts);
}

const keyOf = (look: HeroLook, held: Held | null, shield: boolean): string => JSON.stringify([look, held, shield]);
const dressed = new Map<string, MeshData>();

/** A look's model, made once. */
export function dressedOf(w: Wardrobe, look: HeroLook, held: Held | null, shield = false): { key: string; mesh: MeshData } {
  const key = keyOf(look, held, shield);
  let mesh = dressed.get(key);
  if (!mesh) {
    mesh = dressedMesh(w, look, held, shield);
    if (dressed.size > 64) dressed.clear();
    dressed.set(key, mesh);
  }
  return { key, mesh };
}

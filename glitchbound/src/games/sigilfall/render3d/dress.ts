import * as THREE from 'three';
import type { HeroLook, Piece } from '../render/art/hero';
import { heroParts } from './armorKit';
import { hexRgb } from './kits';
import { loadPack, mergeMeshes, type MeshData, type Pack } from './pack';
import { headOf, hairIsMetal } from './heads';
import { blondHair, darkHair, painted, paintJoints, shaved } from './paint';
import { addRideClip, CAPE_JOINTS } from './ride';
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
    wardrobe = Promise.all([loadPack('hero'), loadPack('rigs')]).then(([hero, rigs]) => {
      addRideClip(rigs.rigs.medium!);
      return { hero, rigs, medium: rigAnimOf(rigs, 'medium', CAPE_JOINTS), large: rigAnimOf(rigs, 'large') };
    });
    wardrobe.catch(() => (wardrobe = null));
  }
  return wardrobe;
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
const HEADS: Record<string, { parts: string[]; bald?: boolean; own?: boolean; hide?: boolean }[]> = {
  helm: [
    { parts: ['Knight_Helmet', 'Knight_HelmetVisor'], bald: true },
    { parts: ['Paladin_Helmet'], own: true },
    { parts: ['Skeleton_Warrior_Helmet'], bald: true },
    // (a bear's head is a trophy, for gear of renown: not a captain's or a villager's everyday wear)
    { parts: ['Barbarian_BearHat'], bald: true, hide: true },
  ],
  hood: [{ parts: ['RogueHooded_Head'], own: true }],
  // (a medieval land: a cloth hood or a headband, never a modern hat or cap)
  cap: [{ parts: ['Skeleton_Rogue_Hood'], bald: true }, { parts: ['RogueHooded_Head'], own: true }, { parts: ['Ninja_Headband'] }],
  crown: [{ parts: ['Necromancer_Crown'] }],
  wizard: [{ parts: ['Mage_Hat'], bald: true }, { parts: ['Witch_Hat'], bald: true }, { parts: ['Skeleton_Mage_Hat'], bald: true }],
};

/** Every face a hero or a townsperson may wear (render3d/heads.ts picks among them), loaded with the rest. */
const BEARDS = ['Hiker_Head', 'Farmer_A_Head', 'Engineer_Head', 'Barbarian_Head', 'Witch_Head', 'Helper_A_Head'];

const HAND_JOINTS = ['hand.l', 'hand.r', 'wrist.l', 'wrist.r', 'handslot.l', 'handslot.r'];
const FOOT_JOINTS = ['foot.l', 'foot.r', 'toes.l', 'toes.r'];

const WEAPONS: Record<string, readonly string[]> = {
  sword: ['w_sword_A', 'w_sword_B', 'w_sword_C', 'w_sword_D', 'w_sword_E', 'w_sword_F', 'w_sword_G'],
  // two hands on the hilt: only the long blades
  greatsword: ['w_sword_E', 'w_sword_F'],
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

/** What is in the hands. */
function addHeld(w: Wardrobe, parts: MeshData[], look: HeroLook, held: Held | null, shield: boolean, _part: (id: string) => MeshData | null): void {
  const add = (m: MeshData | null): void => {
    if (m) parts.push(m);
  };
  const chestP = look.chest;
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
}

/** The parts of a look, painted and merged into one model. */
export function dressedMesh(w: Wardrobe, look: HeroLook, held: Held | null, shield = false): MeshData {
  const part = (id: string): MeshData | null => {
    const m = w.hero.meshes[id];
    return m && m.rig !== 'large' ? m : null;
  };
  const parts: MeshData[] = look.ladder ? heroParts(w, look) : [];
  const skin = hexRgb(look.skin);
  const hair = hexRgb(look.hair);
  const J = (names: string[]): Set<number> => new Set(names.map((n) => w.medium.joints.indexOf(n)).filter((j) => j >= 0));
  const hands = J(HAND_JOINTS);
  const feet = J(FOOT_JOINTS);
  const add = (m: MeshData | null): void => {
    if (m) parts.push(m);
  };

  if (look.ladder) {
    addHeld(w, parts, look, held, shield, part);
    return mergeMeshes(parts);
  }

  // the head: a covering, and what is under it
  const headP = look.head;
  const covers = headP ? (HEADS[headP.style] ?? HEADS.cap!).filter((c) => !c.hide || headP.r === 'epic' || headP.r === 'legendary') : null;
  const cover = covers && headP ? pickOf(covers, headP) : null;
  const headTint = headP ? hexRgb(headP.tint) : [1, 1, 1] as [number, number, number];
  const metalHead = headP?.style === 'helm' || headP?.style === 'crown';
  if (!cover?.own || !cover.parts.some((id) => part(id))) {
    const face = headOf(look, !!cover?.bald);
    const m = part(face);
    const painted1 = m && painted(face === 'Ranger_Head' ? shaved(m) : m, { skin, cloth: hair, metal: hairIsMetal(look) ? hair : undefined });
    if (painted1) add(face === 'Helper_A_Head' ? blondHair(painted1, hair) : face === 'Mage_Head' ? darkHair(painted1, hair) : painted1);
  }
  for (const id of cover?.parts ?? []) {
    const m = part(id);
    if (!m) continue;
    if (cover?.own && id === 'RogueHooded_Head') add(painted(m, { skin, cloth: headTint }));
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

  addHeld(w, parts, look, held, shield, part);
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

/** Every part named in this file (a test holds them to the built models: a wrong name once drew a body with no head). */
export const wardrobeParts = (): string[] => [
  ...Object.values(CHESTS).flat(),
  ...Object.values(HEADS).flatMap((list) => list.flatMap((c) => c.parts)),
  ...BEARDS,
  'Knight_Head',
  'Mage_Head',
  'Rogue_Head',
  'Ranger_Head',
  'Knight_Cape',
  ...['Mage', 'Knight', 'Rogue'].flatMap((k) => [`${k}_ArmLeft`, `${k}_ArmRight`, `${k}_LegLeft`, `${k}_LegRight`]),
  ...Object.values(WEAPONS).flat(),
  ...SHIELDS,
  'w_quiver',
];

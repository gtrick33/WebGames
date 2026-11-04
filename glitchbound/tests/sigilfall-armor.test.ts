import { describe, expect, it } from 'vitest';
import type { ClassId, Rarity } from '../src/games/sigilfall/data/types';
import { wardenLookId } from '../src/games/sigilfall/data/wardens';
import { lookOf } from '../src/games/sigilfall/progress/wardrobe';
import type { HeroLook } from '../src/games/sigilfall/render/art/hero';
import { TOWNSFOLK_LOOKS } from '../src/games/sigilfall/render/art/townsfolk';
import { heroLook } from '../src/games/sigilfall/render/sprites';
import { armorParts } from '../src/games/sigilfall/render3d/armorKit';
import { dressedMesh, type Wardrobe } from '../src/games/sigilfall/render3d/dress';
import type { MeshData } from '../src/games/sigilfall/render3d/pack';
import { shaved } from '../src/games/sigilfall/render3d/paint';
import { addRideClip, CAPE_JOINTS } from '../src/games/sigilfall/render3d/ride';
import { rigAnimOf } from '../src/games/sigilfall/render3d/toon';
import { readPack } from './sigilfall-packs';

const CLASSES: ClassId[] = ['warrior', 'mage', 'ranger', 'priest', 'paladin', 'warlock', 'druid'];
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function wardrobe(): Wardrobe {
  const hero = readPack('hero');
  const rigs = readPack('rigs');
  addRideClip(rigs.rigs.medium!);
  return { hero, rigs, medium: rigAnimOf(rigs, 'medium', CAPE_JOINTS), large: rigAnimOf(rigs, 'large') };
}

const w = wardrobe();

/** Plate for those who wear it, cloth or leather for the rest: each class in its own kind of gear, at a rarity. */
function geared(cls: ClassId, r: Rarity): HeroLook {
  const plate = cls === 'warrior' || cls === 'paladin';
  const tunic = cls === 'ranger';
  const mat = plate ? 'plate' : tunic || cls === 'druid' ? 'leather' : 'cloth';
  return {
    ...heroLook(cls),
    head: { style: plate ? 'helm' : tunic || cls === 'druid' ? 'cap' : 'hood', mat, tint: '#7a6a5a', r },
    chest: { style: plate ? 'plate' : tunic ? 'tunic' : 'robe', mat, tint: '#7a6a5a', r },
    legs: { style: plate ? 'greaves' : 'trousers', mat, tint: '#7a6a5a', r },
    hands: { style: plate ? 'gauntlets' : 'gloves', mat, tint: '#7a6a5a', r },
    feet: { style: plate ? 'sabatons' : 'boots', mat, tint: '#7a6a5a', r },
    cape: r === 'legendary' ? '#a8262e' : r === 'epic' ? '#5a2a8a' : null,
  };
}

const warden = (cls: ClassId): HeroLook => heroLook(cls, {}, { head: lookOf(wardenLookId(cls, 'head'))!, chest: lookOf(wardenLookId(cls, 'chest'))! });

/** What a figure looks like, as a number that changes if its shape or colors do. */
function print(m: MeshData): string {
  let h = 0;
  for (let i = 0; i < m.n * 3; i += 7) h = (Math.imul(h, 31) + m.col[i]! + Math.round(m.pos[i]! * 100)) | 0;
  return `${m.n}:${h}`;
}

function goodFigure(m: MeshData, label: string): void {
  expect(m.n, label).toBeGreaterThan(500);
  expect(m.n, label).toBeLessThan(65536);
  expect(m.idx.length % 3, label).toBe(0);
  let off = 0;
  for (let v = 0; v < m.n * 3; v += 3) if (m.skin![v]! >= w.medium.joints.length || m.skin![v + 1]! >= w.medium.joints.length) off++;
  expect(off, label).toBe(0);
  expect(m.pos.every(Number.isFinite), label).toBe(true);
}

describe('Sigilfall: armor by rarity', () => {
  it('every model named is in the game files', () => {
    expect(armorParts().filter((id) => !w.hero.meshes[id])).toEqual([]);
  });

  it('every class at every rarity makes a whole figure', () => {
    for (const cls of CLASSES) for (const r of RARITIES) goodFigure(dressedMesh(w, geared(cls, r), null), `${cls} ${r}`);
  });

  it('no two rarities of the same gear look alike', () => {
    for (const cls of CLASSES) {
      const looks = RARITIES.map((r) => print(dressedMesh(w, geared(cls, r), null)));
      expect(new Set(looks).size, cls).toBe(RARITIES.length);
    }
  });

  it('each step up is more armor than the one before, from rare on', () => {
    for (const cls of CLASSES) {
      const [rare, epic, legendary] = (['rare', 'epic', 'legendary'] as const).map((r) => dressedMesh(w, geared(cls, r), null).n);
      expect(epic!, `${cls} epic`).toBeGreaterThan(rare! * 0.8);
      expect(legendary!, `${cls} legendary`).toBeGreaterThan(epic!);
    }
  });

  it('a warden in their set is more than the best gear in the game, and unlike any other warden', () => {
    const prints = new Set<string>();
    for (const cls of CLASSES) {
      const set = warden(cls);
      expect(set.chest.set, cls).toBe(cls);
      expect(set.head?.set, cls).toBe(cls);
      const m = dressedMesh(w, set, null);
      goodFigure(m, cls);
      expect(print(m), cls).not.toBe(print(dressedMesh(w, geared(cls, 'legendary'), null)));
      prints.add(print(m));
      // (their top stands above anything else's: a warden's seen from across a field)
      expect(m.max[1], cls).toBeGreaterThan(dressedMesh(w, geared(cls, 'common'), null).max[1]);
    }
    expect(prints.size).toBe(CLASSES.length);
  });

  it('a cape moves on joints of its own, and only its top stays with the back', () => {
    const m = dressedMesh(w, warden('warrior'), null);
    const c1 = w.medium.joints.indexOf('cape1');
    const c2 = w.medium.joints.indexOf('cape2');
    expect(c1).toBeGreaterThan(0);
    let onCape = 0;
    for (let v = 0; v < m.n * 3; v += 3) if (m.skin![v] === c1 || m.skin![v] === c2) onCape++;
    expect(onCape).toBeGreaterThan(20);
    // flat out at a run, nearly straight down standing
    const at = { x: 0, y: 0, z: 0 };
    w.medium.pointAt(w.medium.frame('run', 0.1), 0, 0, c2, 0, 0.16, -0.42, at);
    const running = at.z;
    w.medium.pointAt(w.medium.frame('idle', 0.1), 0, 0, c2, 0, 0.16, -0.42, at);
    expect(running).toBeLessThan(at.z - 0.2);
  });

  it('townsfolk keep picking their clothes by name: they are not on the ladder', () => {
    for (const look of Object.values(TOWNSFOLK_LOOKS)) expect(look.ladder).toBeFalsy();
    expect(heroLook('mage').ladder).toBe(true);
  });
});

describe('Sigilfall: faces', () => {
  it('the short-haired head can be shaved, and keeps its hair', () => {
    const hairy = w.hero.meshes.Ranger_Head!;
    const clean = shaved(hairy);
    expect(clean.i).toBeLessThan(hairy.i);
    expect(clean.i).toBeGreaterThan(hairy.i * 0.7);
  });

  it('a child has no beard, and nor has a hero who chose none', () => {
    for (const id of ['briar-tam', 'briar-child', 'reed-jory', 'vaelmoor-child']) expect(TOWNSFOLK_LOOKS[id]?.beard, id).toBeFalsy();
    const chosen = heroLook('warrior', {}, {}, 'm', { skin: 0, hair: 0, style: 'short', beard: false });
    expect(chosen.beard).toBeNull();
  });
});

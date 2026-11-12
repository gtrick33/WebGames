import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { ENEMIES } from '../src/games/sigilfall/data/enemies';
import { beastOf, type Beast } from '../src/games/sigilfall/render3d/beast';
import { kitOf } from '../src/games/sigilfall/render3d/kits';
import type { MeshData } from '../src/games/sigilfall/render3d/pack';
import { readPack } from './sigilfall-packs';

/** The animal a kit draws, painted and dressed as the game does it. */
function dressed(file: string, spec: Beast): { before: MeshData; after: MeshData } {
  const pack = readPack(`k/${file}`);
  const before = pack.meshes.body!;
  return { before, after: beastOf(before, pack.rigs[before.rig!]!.joints, spec) };
}

/** Every animal the game paints: its model and its description, once each. */
function painted(): Array<{ sprite: string; file: string; beast: Beast }> {
  const seen = new Set<string>();
  const out: Array<{ sprite: string; file: string; beast: Beast }> = [];
  for (const e of Object.values(ENEMIES)) {
    const kit = kitOf(e.sprite, e.id);
    if (!kit.beast || seen.has(`${kit.k}/${JSON.stringify(kit.beast)}`)) continue;
    seen.add(`${kit.k}/${JSON.stringify(kit.beast)}`);
    out.push({ sprite: e.sprite, file: kit.k, beast: kit.beast });
  }
  return out;
}

describe('Sigilfall: animals that look like animals', () => {
  it('the wild animals of the story are painted: a coat, and eyes', () => {
    const all = painted();
    expect(all.length).toBeGreaterThanOrEqual(12);
    for (const sprite of ['wolf', 'boar', 'plains-lion', 'jungle-panther', 'frost-ram', 'canyon-raptor', 'cistern-rat', 'magma-hound']) {
      expect(kitOf(sprite).beast, sprite).toBeDefined();
      expect(kitOf(sprite).beast!.eyes, sprite).toBeDefined();
    }
  });

  it('a boar is a boar, not a wolf in another color', () => {
    expect(kitOf('boar').k).toBe('fbx_pig');
    expect(kitOf('boar').beast!.tusks).toBeGreaterThan(0);
  });

  it('every painted animal comes out a whole model: more of it than went in, nothing broken', () => {
    for (const { sprite, file, beast } of painted()) {
      const { before, after } = dressed(file, beast);
      expect(after.n, sprite).toBeGreaterThan(before.n);
      expect(after.i % 3, sprite).toBe(0);
      expect(after.pos.length, sprite).toBe(after.n * 3);
      expect(after.col.length, sprite).toBe(after.n * 3);
      expect(after.skin!.length, sprite).toBe(after.n * 3);
      for (let i = 0; i < after.pos.length; i++) if (!Number.isFinite(after.pos[i]!)) throw new Error(`${sprite}: a point is nowhere`);
      for (let t = 0; t < after.i; t++) if (after.idx[t]! >= after.n) throw new Error(`${sprite}: a face names a point that isn't there`);
      // what is built on hangs from a bone the animal has
      const joints = readPack(`k/${file}`).rigs[before.rig!]!.joints.length;
      for (let v = before.n; v < after.n; v++) expect(after.skin![v * 3]!, sprite).toBeLessThan(joints);
    }
  });

  it('the coat is more than one color (a paler belly, a darker back, a nose)', () => {
    for (const { sprite, file, beast } of painted()) {
      const { before, after } = dressed(file, beast);
      const shades = new Set<number>();
      for (let v = 0; v < before.n; v++) shades.add(((after.col[v * 3]! >> 4) << 8) | ((after.col[v * 3 + 1]! >> 4) << 4) | (after.col[v * 3 + 2]! >> 4));
      expect(shades.size, sprite).toBeGreaterThan(6);
    }
  });

  it('what glows does so a whole face at a time (a face half alight drags its ink line off to nowhere)', () => {
    for (const { sprite, file, beast } of painted()) {
      const { after } = dressed(file, beast);
      const lit = (v: number): boolean => after.nor[v * 3] === 0 && after.nor[v * 3 + 1] === 0 && after.nor[v * 3 + 2] === 0;
      let half = 0;
      for (let t = 0; t < after.i; t += 3) {
        const n = Number(lit(after.idx[t]!)) + Number(lit(after.idx[t + 1]!)) + Number(lit(after.idx[t + 2]!));
        if (n === 1 || n === 2) half++;
      }
      expect(half, sprite).toBe(0);
    }
  });
});

describe('Sigilfall: the creatures built from nothing', () => {
  const size = (m: MeshData): [number, number, number] => [m.max[0] - m.min[0], m.max[1] - m.min[1], m.max[2] - m.min[2]];

  it('a serpent is long: its body runs out behind its head (it was every segment heaped on one spot)', () => {
    for (const id of ['viper', 'serpent', 'wurm', 'wyrm']) {
      const [, tall, long] = size(readPack(`k/${id}`).meshes.body!);
      expect(long, id).toBeGreaterThan(tall * 1.4);
      expect(long, id).toBeGreaterThan(2);
    }
  });

  it('a crawler stands on its feet: legs to the ground on both sides, spread along the body', () => {
    for (const id of ['spider', 'crab', 'scorpion', 'beetle', 'scarab', 'strider']) {
      const pack = readPack(`k/${id}`);
      const m = pack.meshes.body!;
      const rig = pack.rigs[m.rig!]!;
      expect(m.min[1], id).toBeGreaterThan(-0.05);
      expect(m.min[1], id).toBeLessThan(0.06);
      // each leg's own points: where they are, fore and aft
      const at: number[] = [];
      rig.joints.forEach((name, j) => {
        if (!name.startsWith('leg')) return;
        let z = 0;
        let n = 0;
        for (let v = 0; v < m.n; v++) {
          if (m.skin![v * 3] !== j) continue;
          z += m.pos[v * 3 + 2]!;
          n++;
        }
        expect(n, `${id} ${name}`).toBeGreaterThan(0);
        at.push(z / n);
      });
      expect(at.length, id).toBeGreaterThanOrEqual(6);
      expect(Math.max(...at) - Math.min(...at), id).toBeGreaterThan(0.3);
    }
  });

  it('each has every move the game asks of it', () => {
    for (const id of ['spider', 'crab', 'scorpion', 'beetle', 'scarab', 'strider', 'viper', 'serpent', 'wurm', 'wyrm', 'naga_coil', 'bird', 'moth']) {
      const pack = readPack(`k/${id}`);
      const rig = pack.rigs[pack.meshes.body!.rig!]!;
      for (const clip of ['idle', 'walk', 'run', 'chop', 'hit', 'die']) expect(rig.clips[clip], `${id} ${clip}`).toBeDefined();
      for (let t = 0; t < pack.meshes.body!.i; t++) expect(pack.meshes.body!.idx[t]!).toBeLessThan(pack.meshes.body!.n);
    }
  });

  it("a naga's coil is wide and low, with a waist standing in the middle for the body to rise from", () => {
    const [wide, tall, deep] = size(readPack('k/naga_coil').meshes.body!);
    expect(wide).toBeGreaterThan(tall * 1.5);
    expect(deep).toBeGreaterThan(tall * 1.5);
  });
});

describe('Sigilfall: Gnasher', () => {
  it('bites from his jaws, in a cone wide enough to see past his own body', () => {
    const bites = BOSSES.gnasher!.phases.flatMap((ph) => ph.patterns).filter((p) => p.id === 'cleave');
    expect(bites.length).toBe(2);
    for (const b of bites) {
      expect(b.p!.ahead).toBeGreaterThanOrEqual(24);
      expect(b.p!.r).toBeGreaterThanOrEqual(48);
    }
  });

  it("is a great hound, not eight tiles of one, and his banner shows from behind", () => {
    const kit = kitOf('gnasher');
    expect(kit.size).toBeLessThanOrEqual(1.6);
    expect(kit.beast).toBeDefined();
    expect(kit.gear!.find((g) => g.m.startsWith('banner'))!.both).toBe(true);
  });
});

describe('Sigilfall: what the great beasts carry', () => {
  it("is on their backs, not hung in the air behind them (the Runewarden's hammer, Ossa's anvil, Sluicegut's wheel)", () => {
    for (const [boss, piece] of [['the-runewarden', 'w_hammer_D'], ['ossa-the-founder', 'anvil'], ['old-sluicegut', 'w_shield_round']] as const) {
      const g = kitOf(boss).gear!.find((x) => x.m === piece)!;
      expect(g.z!, boss).toBeLessThan(0);
      expect(g.z!, boss).toBeGreaterThanOrEqual(-0.2);
    }
  });

  it('Clatterclaw is no wider than a boss room can show', () => {
    expect(kitOf('clatterclaw').size).toBeLessThanOrEqual(1.7);
  });
});

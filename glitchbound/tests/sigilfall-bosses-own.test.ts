import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { BOSS_FORMS, bossForm, bossRig } from '../src/games/sigilfall/render3d/bossKit';
import { heightFromRadius } from '../src/games/sigilfall/render3d/cast';
import { kitOf } from '../src/games/sigilfall/render3d/kits';
import { repaint } from '../src/games/sigilfall/render3d/repaint';
import type { MeshData } from '../src/games/sigilfall/render3d/pack';
import { readPack } from './sigilfall-packs';

/**
 * Bosses of their own (NINE_PLAN.md, piece 2). A boss that has been given a figure of its own (a `form` on its kit:
 * render3d/kits.ts, render3d/bossKit.ts) is held to what the plan asks of each one: a file of its own, a move for
 * everything the rules have it do, a cost no greater than the heaviest creature drawn before the pass began, a
 * footprint that is its radius in the rules, and light of its own only where there is magic.
 */

const DIR = 'public/games/sigilfall/3d/k';
const rigs = readPack('rigs');

/** The bosses given a figure of their own so far. */
const OWN = Object.values(BOSSES)
  .map((b) => ({ boss: b, kit: kitOf(b.sprite, b.id) }))
  .filter((x) => !!x.kit.form);

/** The figure as it is drawn: its file's model, painted, with what is built onto it. */
function drawn(kit: ReturnType<typeof kitOf>): { mesh: MeshData; joints: string[] } {
  const pack = readPack(`k/${kit.k}`);
  let mesh = pack.meshes.body!;
  const joints = rigs.rigs[mesh.rig!]!.joints;
  if (kit.paint) mesh = repaint(mesh, joints, kit.paint);
  const form = bossForm(kit.form)!;
  if (form.build) mesh = form.build(mesh, joints);
  return { mesh, joints };
}

/** The heaviest creature file the game drew before any boss had its own: the budget for one. */
function heaviest(): { file: string; tris: number } {
  let best = { file: '', tris: 0 };
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.pack') || f.startsWith('boss_')) continue;
    const m = readPack(`k/${f.replace('.pack', '')}`).meshes.body;
    if (m && m.i / 3 > best.tris) best = { file: f, tris: m.i / 3 };
  }
  return best;
}

describe('Sigilfall: bosses of their own', () => {
  it('the first boss a player meets, the Coffin Matron, has one', () => {
    expect(OWN.map((x) => x.boss.id)).toContain('coffin-matron');
  });

  it('each has a file of its own, shared with no other creature, on one of the shared skeletons', () => {
    const files = new Map<string, string>();
    for (const { boss, kit } of OWN) {
      expect(kit.k, boss.id).toMatch(/^boss_/);
      expect(files.get(kit.k), `${boss.id} shares ${kit.k}`).toBeUndefined();
      files.set(kit.k, boss.id);
      const mesh = readPack(`k/${kit.k}`).meshes.body!;
      expect(['medium', 'large'], boss.id).toContain(mesh.rig);
      expect(BOSS_FORMS[kit.form!], `${boss.id}: form ${kit.form}`).toBeTruthy();
    }
  });

  it('each has a move for every attack the rules give it, and for its entrance, a phase changing, a daze and its fall', () => {
    for (const { boss, kit } of OWN) {
      const form = bossForm(kit.form)!;
      const rig = rigs.rigs[readPack(`k/${kit.k}`).meshes.body!.rig!]!;
      const patterns = new Set(boss.phases.flatMap((p) => [...(p.enter ?? []), ...p.patterns].map((u) => u.id)));
      for (const id of patterns) expect(form.moves[id], `${boss.id} has no move for ${id}`).toBeTruthy();
      const named = [...Object.values(form.moves).map((m) => m.clip), form.enter.clip, form.enter.then, form.shift.clip, form.dazed, form.fall.clip, form.fall.end, 'idle', 'walk', 'run', 'hit', 'die'];
      for (const clip of named) {
        expect(form.clips, `${boss.id}: ${clip} is not among its clips`).toContain(clip);
        expect(rig.clips[clip], `${boss.id}: its skeleton has no ${clip}`).toBeTruthy();
      }
      // its fall is seen through: it is kept on the screen at least as long as the floor takes to have it
      expect(form.fall.kept).toBeGreaterThan(1);
    }
  });

  it('each one’s own copy of its skeleton is made of its clips alone, carried its own way', () => {
    for (const { boss, kit } of OWN) {
      const form = bossForm(kit.form)!;
      const rigName = readPack(`k/${kit.k}`).meshes.body!.rig!;
      const own = bossRig(kit.form!, form, rigs, rigName)!;
      expect(Object.keys(own.clips).sort(), boss.id).toEqual([...form.clips].sort());
      if (form.bend) {
        // (its carriage is laid over a joint or more, and never breaks a number)
        const joints = rigs.rigs[rigName]!.joints;
        const bent = joints.filter((j) => form.clips.some((c) => form.bend!(j, c, 0.3)));
        expect(bent.length, `${boss.id} bends nothing`).toBeGreaterThan(0);
        for (const j of joints) for (const c of [null, ...form.clips]) for (const v of form.bend(j, c, 0.3) ?? []) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('none costs more than the heaviest creature drawn before the pass began', () => {
    const budget = heaviest();
    expect(budget.tris).toBeGreaterThan(5000);
    for (const { boss, kit } of OWN) {
      const { mesh } = drawn(kit);
      expect(mesh.i / 3, `${boss.id}: ${Math.round(mesh.i / 3)} triangles against ${budget.tris} (${budget.file})`).toBeLessThanOrEqual(budget.tris);
      // one body, one draw call: nothing of it is drawn piece by piece
      expect(kit.gear ?? [], boss.id).toEqual([]);
      expect(kit.top, boss.id).toBeUndefined();
    }
  });

  it('each stands on the ground its radius gives it in the rules', () => {
    for (const { boss, kit } of OWN) {
      const { mesh } = drawn(kit);
      const tall = Math.max(0.05, mesh.max[1] - mesh.min[1], (mesh.max[0] - mesh.min[0]) * 0.72);
      // world pixels to one of the model's own units, as the game draws it (render3d/cast.ts creature)
      const px = (heightFromRadius(boss.radius) * (kit.size ?? 1)) / tall;
      // where it meets the ground: the lowest sixth of it
      const low = mesh.min[1] + (mesh.max[1] - mesh.min[1]) / 6;
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (let v = 0; v < mesh.n; v++) {
        if (mesh.pos[v * 3 + 1]! > low) continue;
        x0 = Math.min(x0, mesh.pos[v * 3]!);
        x1 = Math.max(x1, mesh.pos[v * 3]!);
        z0 = Math.min(z0, mesh.pos[v * 3 + 2]!);
        z1 = Math.max(z1, mesh.pos[v * 3 + 2]!);
      }
      const across = Math.max(x1 - x0, z1 - z0) * px;
      // (what it stands on is its circle in the rules, give or take a third: a blow that lands on the picture lands on the boss)
      expect(across / (boss.radius * 2), `${boss.id}: ${across.toFixed(1)} px across at the ground against a radius of ${boss.radius}`).toBeGreaterThan(0.66);
      expect(across / (boss.radius * 2), `${boss.id}: ${across.toFixed(1)} px across at the ground against a radius of ${boss.radius}`).toBeLessThan(1.34);
      // and it is a boss: taller than the hero by a quarter at least (the hero is 36 world px by the same measure)
      const stands = (mesh.max[1] - mesh.min[1]) * px;
      expect(stands, boss.id).toBeGreaterThan(heightFromRadius(4) * 1.25);
    }
  });

  it('light of its own only where there is magic: a small part of it glows', () => {
    for (const { boss, kit } of OWN) {
      const { mesh } = drawn(kit);
      let lit = 0;
      for (let v = 0; v < mesh.n; v++) if (!mesh.nor[v * 3] && !mesh.nor[v * 3 + 1] && !mesh.nor[v * 3 + 2]) lit++;
      expect(lit, `${boss.id} has nothing alight`).toBeGreaterThan(0);
      expect(lit / mesh.n, `${boss.id}: ${Math.round((lit / mesh.n) * 100)}% of it glows`).toBeLessThan(0.06);
    }
  });
});

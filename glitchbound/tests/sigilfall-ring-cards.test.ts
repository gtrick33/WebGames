/**
 * An ability can be read (the owner: "whenever i click on spell, please add a pop up with info about it, best uses,
 * best combos"; it had "2 buttons - equip or cancel" until a playstyle's abilities became its own, 2026-11-16, and
 * lines of advice on when to press it until the owner the same day: "i really dislike the fact that ui is 90% texts
 * ... remove the redundant text and make it similar to wow's description of the spells"), what a
 * fighter wears is shown as its spell's own
 * picture with the seconds left ("make the square with the spells icon image and add a 7s 6s timer on it"), the
 * Gloamknight has pictures of his own, and nothing set against a wall is bricked over ("the jittering of the pillar").
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ABILITIES, barCombos, combosOf, kitOf, PRESETS, SUPERS, SUPERS2 } from '../src/games/sigilfall/arena/abilities';
import type { Aura } from '../src/games/sigilfall/arena/sim';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { overhead, OVERHEAD_MAX, worn } from '../src/games/sigilfall/render/ring';
import { Build } from '../src/games/sigilfall/render3d/build';
import { ringMasonry } from '../src/games/sigilfall/render3d/ringDress';
import { ARENA_H, ARENA_W, MAP_IDS, MAPS } from '../src/games/sigilfall/arena/maps';
import { TILE } from '../src/games/sigilfall/sim/map';
import * as THREE from 'three';

describe('Sigilfall: an ability can be read', () => {
  it('what a card says of combos agrees both ways, and with what a bar shows', () => {
    let pairs = 0;
    for (const cls of CLASS_IDS) {
      for (const p of PRESETS[cls]) {
        // (a playstyle's own: its four and its super. What an ability shared by both makes is read within each)
        const all = [...p.bar.map((id) => ABILITIES[id]!), ABILITIES[p.ult]!];
        for (const ab of all) {
          const c = combosOf(cls, ab, p.bar);
          if (ab.combo) expect(c.lands, ab.id).not.toBeNull();
          for (const from of c.lands?.after ?? []) {
            pairs++;
            expect(all, `${from.id} is the ${p.name}'s own`).toContain(from);
            expect(combosOf(cls, from, p.bar).setsUp.map((s) => s.then), `${from.id} → ${ab.id}`).toContain(ab);
          }
          for (const s of c.setsUp) expect(combosOf(cls, s.then, p.bar).lands?.after, `${ab.id} → ${s.then.id}`).toContain(ab);
          // (what lands on the bar is what the setup page lists for it)
          if (c.lands?.after.length) expect(barCombos(cls, p.bar, p.ult).some((b) => b.to === ab && b.name === c.lands!.name), `${p.name}: ${ab.id} on its bar`).toBe(true);
        }
        // every playstyle has a combo to read about
        expect(all.some((ab) => (combosOf(cls, ab, p.bar).lands?.after.length ?? 0) > 0), p.name).toBe(true);
      }
    }
    expect(pairs).toBeGreaterThan(CLASS_IDS.length * 2);
    // points and boons are combos too: the Nightblade's Nicks, the Rime's globe
    expect(combosOf('gloamknight', ABILITIES['g-cut']!).lands).toMatchObject({ name: 'Nicks', kind: 'points' });
    expect(combosOf('gloamknight', ABILITIES['g-cut']!).lands!.after.map((a) => a.id)).toEqual(['g-knife', 'g-ambush']);
    expect(combosOf('mage', ABILITIES['m-spear']!).lands).toMatchObject({ name: 'Rimeglobe', kind: 'boon' });
  });
});

describe('Sigilfall: what a fighter wears is drawn as its spell', () => {
  const aura = (ab: string, t: number, more: Partial<Aura> = {}): Aura => ({ ab, kind: 'dot', src: 0, t, dur: 9, harmful: true, magic: true, n: 1, ...more });

  it('one picture to an ability, with its longest part, and nothing for what never runs out', () => {
    const shown = worn({ auras: [aura('w-gash', 4.2), aura('w-gash', 7.9, { kind: 'antiheal' }), aura('k-dart', 3), aura('p-dusk', 5, { harmful: false, kind: 'guard' }), aura('p-ward', 0), aura('g-veil', 990, { dur: 0, kind: 'veil', harmful: false }), aura('not-an-ability', 3)] });
    expect(shown.map((a) => [a.ab, a.t])).toEqual([
      ['w-gash', 7.9],
      ['k-dart', 3],
      ['p-dusk', 5],
    ]);
  });

  it('over the head: holds, whoever’s, then what the player put on them, three at most; the rest on the nameplate', () => {
    const on = [aura('k-dart', 3, { src: 5 }), aura('p-curse', 6, { src: 0 }), aura('m-toad', 2, { src: 5, kind: 'cc', cc: 'incap' }), aura('r-hobble', 4, { src: 0, kind: 'slow' }), aura('w-bleed', 9, { src: 0 }), aura('l-regrow', 8, { src: 7, harmful: false, kind: 'hot' })];
    const shown = overhead({ auras: on }, 0);
    expect(shown.length).toBe(OVERHEAD_MAX);
    expect(shown[0]!.ab).toBe('m-toad');
    expect(shown.slice(1).every((a) => a.src === 0)).toBe(true);
    // (someone else's curse and someone else's heal: on the nameplate only)
    expect(shown.some((a) => a.ab === 'k-dart' || a.ab === 'l-regrow')).toBe(false);
    expect(overhead({ auras: on }, null).map((a) => a.ab)).toEqual(['m-toad']);
  });

  it('the Gloamknight’s pictures are his alone, and each ability has its own', () => {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/games/sigilfall/icons/icons.json'), 'utf8')) as { names: string[] };
    const his = [...kitOf('gloamknight'), SUPERS.gloamknight, SUPERS2.gloamknight];
    expect(new Set(his.map((a) => a.icon)).size).toBe(his.length);
    const others = new Set(Object.values(ABILITIES).filter((a) => a.cls !== 'gloamknight').map((a) => a.icon));
    for (const a of his) {
      expect(index.names, a.id).toContain(a.icon);
      expect(others.has(a.icon), `${a.id}: ${a.icon}`).toBe(false);
    }
  });
});

describe('Sigilfall: a wall’s stones stay behind what is set against it', () => {
  it('courses of cut stone stand nearer the wall than a furnace’s mouth, on every face', () => {
    // (a furnace's mouth is set 0.02 off its wall, its fire 0.03, its bars 0.04; a pillar's band 0.025)
    const SET = 0.02;
    const palette = [[0.5, 0.3, 0.2]];
    for (const dir of ['s', 'e', 'w'] as const) {
      const b = new Build();
      let seed = 7;
      b.courses(dir, 0, 3, 5, 0, 1.5, 0.2, 0.34, palette, [0.1, 0.05, 0.05], () => (seed = (seed * 16807) % 2147483647) / 2147483647);
      const axis = dir === 's' ? 2 : 0;
      const sign = dir === 'w' ? -1 : 1;
      let far = 0;
      for (let i = axis; i < b.m.pos.length; i += 3) far = Math.max(far, (b.m.pos[i]! - 5) * sign);
      expect(b.m.pos.length, dir).toBeGreaterThan(12 * 8);
      expect(far, dir).toBeGreaterThan(0);
      expect(far, dir).toBeLessThan(SET - 0.004);
    }
  });
});

describe('Sigilfall: nothing in a ring is laid in the same plane as something else', () => {
  /**
   * Two faces in one plane are drawn through each other in stripes that crawl as the camera moves. That is what the
   * owner saw on the Cinder Forge's furnaces ("in the fire arena the jitter of the pillars is still happening"): the
   * brick's own top lay in the plane of the iron band's. Every face the camera can see (tops, and the sides that
   * look south, east and west) inside the ring is read here, on every ground.
   */
  it('no two faces of different colors share a plane where the fight is', () => {
    const AW = ARENA_W / TILE;
    const AH = ARENA_H / TILE;
    for (const id of MAP_IDS) {
      const { b } = ringMasonry(MAPS[id]!, new THREE.Object3D());
      const { pos, nor, col } = b.m;
      const planes = new Map<string, { u0: number; u1: number; w0: number; w1: number; c: number[] }[]>();
      const quads = pos.length / 12;
      expect(quads, id).toBeGreaterThan(1000);
      for (let q = 0; q < quads; q++) {
        const n = [nor[q * 12]!, nor[q * 12 + 1]!, nor[q * 12 + 2]!];
        const ax = n.findIndex((x) => Math.abs(x) > 0.999);
        // (not what faces north or down: the camera never sees it)
        if (ax < 0 || (ax !== 0 && n[ax]! < 0)) continue;
        const v = [0, 1, 2, 3].map((k) => [pos[q * 12 + k * 3]!, pos[q * 12 + k * 3 + 1]!, pos[q * 12 + k * 3 + 2]!]);
        if (v.some((p) => Math.abs(p[ax]! - v[0]![ax]!) > 1e-6)) continue;
        if (!v.some((p) => p[0]! > 0 && p[0]! < AW && p[2]! > 0 && p[2]! < AH)) continue;
        const [u, w] = [0, 1, 2].filter((k) => k !== ax) as [number, number];
        const face = { u0: Math.min(...v.map((p) => p[u]!)), u1: Math.max(...v.map((p) => p[u]!)), w0: Math.min(...v.map((p) => p[w]!)), w1: Math.max(...v.map((p) => p[w]!)), c: [0, 1, 2].map((k) => col[q * 12 + k]!) };
        const key = `${ax}${Math.sign(n[ax]!)}@${v[0]![ax]!.toFixed(4)}`;
        planes.set(key, [...(planes.get(key) ?? []), face]);
      }
      const clashes: string[] = [];
      for (const [key, list] of planes) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const A = list[i]!;
            const B = list[j]!;
            const over = Math.min(Math.min(A.u1, B.u1) - Math.max(A.u0, B.u0), Math.min(A.w1, B.w1) - Math.max(A.w0, B.w0));
            const apart = Math.max(...A.c.map((x, k) => Math.abs(x - B.c[k]!)));
            if (over > 0.015 && apart > 0.05) clashes.push(`${id} ${key}: ${A.u0.toFixed(2)},${A.w0.toFixed(2)} and ${B.u0.toFixed(2)},${B.w0.toFixed(2)}`);
          }
        }
      }
      expect(clashes, id).toEqual([]);
    }
  });
});

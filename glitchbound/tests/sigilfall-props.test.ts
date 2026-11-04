import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODEL_FOOT, yardProps } from '../src/games/sigilfall/data/buildingArt';
import { FEET, PROPS, propBody } from '../src/games/sigilfall/data/props';
import { REGIONS, REGION_IDS } from '../src/games/sigilfall/data/regions';
import { DOOR_GROUND } from '../src/games/sigilfall/data/greatworks';
import { DOORWAYS } from '../src/games/sigilfall/render3d/doorways';
import { builtProp } from '../src/games/sigilfall/render3d/propsBuilt';
import { K, parseRegion, TILE } from '../src/games/sigilfall/sim/map';

/** A model's extents, from the files the game ships. */
const PACKS = ['hero', 'nature', 'town', 'indoor'].map((name) => {
  const bytes = gunzipSync(readFileSync(`public/games/sigilfall/3d/${name}.pack`));
  const len = bytes.readUInt32LE(0);
  return JSON.parse(bytes.subarray(4, 4 + len).toString('utf8')) as { meshes: Record<string, { min: number[]; max: number[] }> };
});
function boundsOf(id: string): { min: number[]; max: number[] } | null {
  const built = builtProp(id);
  if (built) return { min: built.min, max: built.max };
  for (const p of PACKS) if (p.meshes[id]) return p.meshes[id]!;
  return null;
}

/** What a prop's model takes up on the ground when it's sized to its line, in world pixels. */
function footOf(name: string): { w: number; d: number } | null {
  const def = PROPS[name]!;
  const b = boundsOf(def.m);
  if (!b) return null;
  if (def.box || def.flat) return { w: def.w ?? TILE, d: def.d ?? TILE };
  let xw = Math.max(0.01, b.max[0]! - b.min[0]!);
  let zw = Math.max(0.01, b.max[2]! - b.min[2]!);
  const tall = Math.max(0.01, b.max[1]! - b.min[1]!);
  if (def.across && zw > xw) [xw, zw] = [zw, xw];
  const k = Math.min((def.w ?? TILE) / TILE / xw, (def.d ?? TILE) / TILE / zw, (def.h ?? 9999) / TILE / tall);
  return { w: xw * k * TILE, d: zw * k * TILE };
}

describe('Sigilfall: nothing to bump into but what can be seen', () => {
  it('every prop with a model has one in the game files', () => {
    const missing = Object.entries(PROPS)
      .filter(([, def]) => def.m && !boundsOf(def.m))
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it("a prop's body is no bigger than its model", () => {
    const over: string[] = [];
    for (const name of Object.keys(PROPS)) {
      const body = propBody(name);
      const foot = footOf(name);
      if (!body || !foot || FEET[name]) continue;
      if (body.w > foot.w + 1.5 || body.d > foot.d + 1.5) over.push(`${name}: body ${body.w.toFixed(0)}x${body.d.toFixed(0)}, model ${foot.w.toFixed(0)}x${foot.d.toFixed(0)}`);
    }
    expect(over).toEqual([]);
  });

  it('what a building yard is given is a real prop', () => {
    const wrong = new Set<string>();
    for (const style of ['house', 'tavern', 'inn', 'shop', 'smithy', 'temple', 'keep', 'tower', 'hall', 'lighthouse'] as const) {
      for (let tx = 0; tx < 40; tx++) {
        for (const prop of yardProps(style, { tx, ty: tx * 3, w: 6, h: 4 }, 3)) if (!PROPS[prop]?.m) wrong.add(prop);
      }
    }
    expect([...wrong]).toEqual([]);
  });

  it("the buildings' footprints match their models", () => {
    for (const [m, f] of Object.entries(MODEL_FOOT)) {
      const b = boundsOf(m)!;
      expect(f[0], m).toBeCloseTo(b.min[0]!, 2);
      expect(f[1], m).toBeCloseTo(b.min[2]!, 2);
      expect(f[2], m).toBeCloseTo(b.max[0]!, 2);
      expect(f[3], m).toBeCloseTo(b.max[2]!, 2);
    }
  });

  it('no land has a whole tile of wall with nothing on it', () => {
    const bad: string[] = [];
    for (const id of REGION_IDS) {
      const m = parseRegion(REGIONS[id]);
      for (let i = 0; i < m.w * m.h; i++) {
        if (!m.solid[i] || m.soft[i] || m.kind[i] !== K.Prop) continue;
        const here = m.markers.filter((p) => p.ty * m.w + p.tx === i);
        // (a thing with a model, or a plain block laid on purpose where nothing stands near it)
        if (!here.some((p) => p.marker.kind !== 'prop' || p.marker.prop === 'block' || propBody(p.marker.prop))) bad.push(`${id} ${i % m.w},${Math.floor(i / m.w)}: ${here.map((p) => (p.marker.kind === 'prop' ? p.marker.prop : p.marker.kind)).join(',') || 'nothing'}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("Sigilfall: a dungeon's built door stands on its own ground", () => {
  it('every built door has its tiles, right at the door', () => {
    const lost: string[] = [];
    const all = [...Object.entries(DOOR_GROUND), ['briarhollow', [{ id: 'block', door: 'crypt' }]], ['emberwick', [{ id: 'block', door: 'crown-catacombs' }]]] as [string, { id: string; door?: string }[]][];
    for (const [land, places] of all) {
      const m = parseRegion(REGIONS[land as keyof typeof REGIONS]);
      for (const p of places) {
        if (!p.door) continue;
        expect(DOORWAYS[p.door], p.door).toBeTruthy();
        const door = m.markers.find((q) => q.marker.kind === 'exit' && q.marker.to === p.door);
        if (!door) {
          lost.push(`${p.door}: no door in ${land}`);
          continue;
        }
        // (the tile north of the door: the hill, the stair or the wall has it, or its marker does)
        const i = (door.ty - 1) * m.w + door.tx;
        const here = m.markers.filter((q) => q.tx === door.tx && q.ty === door.ty - 1).map((q) => (q.marker.kind === 'prop' ? q.marker.prop : q.marker.kind));
        if (m.kind[i] !== K.House && !here.some((n) => n === 'block' || n === `great:${p.id}`)) lost.push(`${p.door} in ${land}: ${here.join(',') || 'nothing'}, kind ${m.kind[i]}`);
      }
    }
    expect(lost).toEqual([]);
  });
});

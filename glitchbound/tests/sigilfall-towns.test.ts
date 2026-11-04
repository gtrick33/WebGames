import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { GREAT, GREAT_IN } from '../src/games/sigilfall/data/greatworks';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { TOWN_FORMS } from '../src/games/sigilfall/data/townforms';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { flowField, K, parseRegion } from '../src/games/sigilfall/sim/map';

/**
 * The owner: "most of the towns look the same ... the whole vibe of towns need to change" and, of the first try at
 * grandeur: "they could be present only in meaningful to the story zones, not literally everywhere".
 */

const wilds = (Object.keys(REGIONS) as RegionId[]).filter((id) => REGIONS[id].kind === 'wild' && parseRegion(REGIONS[id]).buildings.length > 0 && existsSync(`src/games/sigilfall/data/zones/${id}.ts`));

const modelsOf = (pack: string): Record<string, unknown> => {
  const bytes = gunzipSync(readFileSync(`public/games/sigilfall/3d/${pack}.pack`));
  return (JSON.parse(bytes.subarray(4, 4 + bytes.readUInt32LE(0)).toString()) as { meshes: Record<string, unknown> }).meshes;
};

describe('Sigilfall towns', () => {
  it('no two lands lay their town out alike: what stands where around the square is different everywhere', () => {
    const layouts = new Set<string>();
    for (const id of wilds) {
      const m = parseRegion(REGIONS[id]);
      const square = m.markers.find((pm) => pm.marker.kind === 'waystone')!;
      layouts.add(m.buildings.map((b) => `${b.style}${b.lot.tx - square.tx},${b.lot.ty - square.ty}`).sort().join(' '));
    }
    expect(layouts.size).toBe(wilds.length);
  });

  it('a town of real size, in every form', () => {
    for (const id of wilds) {
      const m = parseRegion(REGIONS[id]);
      const square = m.markers.find((pm) => pm.marker.kind === 'waystone')!;
      const near = m.buildings.filter((b) => Math.hypot(b.lot.tx + b.lot.w / 2 - square.tx, b.lot.ty + b.lot.h / 2 - square.ty) < 32);
      // (a war camp's people live under canvas)
      const tents = m.markers.filter((pm) => pm.marker.kind === 'prop' && /tent/.test(pm.marker.prop) && Math.hypot(pm.tx - square.tx, pm.ty - square.ty) < 32);
      expect(near.length + tents.length, id).toBeGreaterThanOrEqual(8);
    }
  });

  it('many forms in use, none of them everywhere', () => {
    const count = new Map<string, number>();
    for (const id of wilds) {
      const source = readFileSync(`src/games/sigilfall/data/zones/${id}.ts`, 'utf8');
      const plan = /plan: '([a-z]+)'/.exec(source)?.[1] ?? 'none';
      count.set(plan, (count.get(plan) ?? 0) + 1);
    }
    expect(count.size).toBeGreaterThanOrEqual(10);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(4);
    for (const plan of count.keys()) if (!['cross', 'street', 'green', 'court', 'none'].includes(plan)) expect(TOWN_FORMS[plan], plan).toBeTruthy();
  });
});

describe('Sigilfall great works', () => {
  it('only some lands have one (the story names them), and each land that does really shows it', () => {
    const lands = Object.keys(GREAT_IN);
    expect(lands.length).toBeLessThanOrEqual(13);
    for (const id of lands) {
      const m = parseRegion(REGIONS[id as RegionId]);
      for (const g of GREAT_IN[id]!) expect(m.markers.some((pm) => pm.marker.kind === 'prop' && pm.marker.prop === `great:${g.id}`), `${id}: ${g.id}`).toBe(true);
    }
  });

  it('are built of models that exist, and figures that exist', () => {
    const meshes = { ...modelsOf('nature'), ...modelsOf('town'), ...modelsOf('indoor'), ...modelsOf('hero') };
    for (const [id, work] of Object.entries(GREAT)) {
      for (const p of work.parts) {
        if (p.m) expect(meshes[p.m.split('#')[0]!], `${id}: ${p.m}`).toBeTruthy();
        if (p.kit) expect(existsSync(`public/games/sigilfall/3d/k/${p.kit}.pack`), `${id}: ${p.kit}`).toBe(true);
      }
    }
  });

  it('cut nobody off: the land round one can still be walked, and its middle is not in anybody’s way', () => {
    for (const id of Object.keys(GREAT_IN)) {
      const m = parseRegion(REGIONS[id as RegionId]);
      const start = m.markers.find((x) => x.marker.kind === 'start')!;
      const f = flowField(m, start.tx, start.ty, 30000);
      for (const pm of m.markers) {
        if (pm.marker.kind !== 'exit' && pm.marker.kind !== 'npc') continue;
        const near = [0, 1, -1, m.w, -m.w].map((d) => f[pm.ty * m.w + pm.tx + d] ?? -1);
        expect(Math.max(...near), `${id}: ${pm.marker.kind} at ${pm.tx},${pm.ty}`).toBeGreaterThanOrEqual(0);
      }
      expect(m.kind.some((k) => k === K.House)).toBe(true);
    }
  });
});

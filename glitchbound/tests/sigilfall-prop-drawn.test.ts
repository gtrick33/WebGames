/**
 * What each prop's model covers on the ground as it is drawn (data/propDrawn.ts) is measured off the packs, not
 * guessed: the map keeps one thing from standing in another by it (sim/map.ts `apart`), so a number that drifts from
 * its model would move things that don't touch, or leave ones that do. This measures every prop again and holds the
 * table to it. After changing a prop's size or model: `WRITE_PROP_DRAWN=1 npx vitest run tests/sigilfall-prop-drawn.test.ts`.
 */
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROPS } from '../src/games/sigilfall/data/props';
import { DRAWN } from '../src/games/sigilfall/data/propDrawn';
import { builtProp } from '../src/games/sigilfall/render3d/propsBuilt';
import { TILE } from '../src/games/sigilfall/sim/map';

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

/** As render3d/land.ts fits a prop: into its box of w by d by h, true to its own shape. */
function measure(name: string): [number, number, number] | null {
  const def = PROPS[name];
  if (!def || !def.m) return null;
  const b = boundsOf(def.m);
  if (!b) return null;
  if (def.box || def.flat) return [Math.round(def.w ?? TILE), Math.round(def.d ?? TILE), def.flat ? 0 : Math.round(def.h ?? 0)];
  let xw = Math.max(0.01, b.max[0]! - b.min[0]!);
  let zw = Math.max(0.01, b.max[2]! - b.min[2]!);
  const tall = Math.max(0.01, b.max[1]! - b.min[1]!);
  if (def.across && zw > xw) [xw, zw] = [zw, xw];
  const k = Math.min((def.w ?? TILE) / TILE / xw, (def.d ?? TILE) / TILE / zw, (def.h ?? 9999) / TILE / tall);
  return [Math.round(xw * k * TILE), Math.round(zw * k * TILE), Math.round(tall * k * TILE)];
}

describe('Sigilfall: what a prop covers as drawn', () => {
  it('is measured off its model, every prop', () => {
    const now: Record<string, [number, number, number]> = {};
    for (const name of Object.keys(PROPS)) {
      const m = measure(name);
      if (m) now[name] = m;
    }
    if (process.env.WRITE_PROP_DRAWN) {
      const rows = Object.entries(now).map(([k, v]) => `  ${/^[a-z]+$/.test(k) ? k : `'${k}'`}: [${v.join(', ')}],`);
      writeFileSync(
        'src/games/sigilfall/data/propDrawn.ts',
        `/**\n * What each prop's model covers on the ground as it is drawn, and how tall it stands: [wide, deep, tall] in world\n * pixels. Measured off the packs by tests/sigilfall-prop-drawn.test.ts, which rewrites this file when asked\n * (WRITE_PROP_DRAWN=1) and holds it to the models otherwise. The map uses it to keep one thing from standing in\n * another (sim/map.ts \`apart\`).\n */\nexport const DRAWN: Readonly<Record<string, readonly [number, number, number]>> = {\n${rows.join('\n')}\n};\n`,
      );
      return;
    }
    expect(Object.keys(DRAWN).sort()).toEqual(Object.keys(now).sort());
    for (const [name, m] of Object.entries(now)) expect([...DRAWN[name]!], name).toEqual(m);
    expect(Object.keys(now).length).toBeGreaterThan(150);
  });
});

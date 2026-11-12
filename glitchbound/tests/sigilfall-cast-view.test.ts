/**
 * Who goes to the graphics card. A land's whole bestiary used to, every frame, wherever it stood: Highwall March's
 * 173 creatures were 2.7 million triangles a frame with none of them on the screen, and the land ran at a quarter
 * the pace of the rest. Only those the picture can show are drawn now, within the same margins the land keeps
 * standing, so nobody is missing from ground that is there.
 */
import { describe, expect, it } from 'vitest';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import { isRetired } from '../src/games/sigilfall/data/retired';
import type { Cast } from '../src/games/sigilfall/render3d/cast';
import { WorldCast, type CastView } from '../src/games/sigilfall/render3d/worldCast';
import { TILE } from '../src/games/sigilfall/sim/map';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/** Stands in for the 3D cast: takes every call, and keeps where each creature and person was drawn. */
function fakeCast(): { cast: Cast; drawn: { x: number; y: number }[] } {
  const drawn: { x: number; y: number }[] = [];
  const own: Record<string, unknown> = {
    wardrobe: { medium: { clips: {} } },
    strike: () => ({ lift: 0.1, from: 0.5, hit: 0.6, to: 1 }),
    rigOf: () => null,
    mountReady: () => false,
    person: (_look: unknown, _held: unknown, _shield: unknown, x: number, y: number) => {
      drawn.push({ x, y });
    },
    creature: (_sprite: string, x: number, y: number) => {
      drawn.push({ x, y });
      return {};
    },
  };
  return { cast: new Proxy(own, { get: (o, k: string) => (k in o ? o[k] : () => undefined) }) as unknown as Cast, drawn };
}

const draw = { look: {} as never, weapon: { kind: 'sword' } as never, folk: 1, landOnly: false };
// a phone on its side (render3d/stage.ts): about eight tiles either side of the middle, five up and down
const PHONE = { spanX: 8.16, spanZ: 4.92 };
const viewAt = (w: World): CastView => ({ x: w.player.x / TILE, z: w.player.y / TILE, ...PHONE });
/** Is a spot inside the picture's reach over the ground, with nothing to spare? */
const inPicture = (v: CastView, x: number, y: number): boolean => Math.abs(x / TILE - v.x) <= v.spanX && Math.abs(y / TILE - v.z) <= v.spanZ;

describe('Sigilfall: only who the picture can show is drawn', () => {
  it('Highwall March draws a handful of its 173 creatures, not all of them', () => {
    const w = newWorld('highwall', readyHero('warrior', 44, 'rare'));
    const live = w.enemies.filter((e) => !e.dead && !e.dummy && !e.def.prop);
    expect(live.length).toBeGreaterThan(150);
    const all = fakeCast();
    new WorldCast().sync(all.cast, w, 1 / 60, 0, draw);
    const some = fakeCast();
    new WorldCast().sync(some.cast, w, 1 / 60, 0, { ...draw, view: viewAt(w) });
    // (everyone, as it was: the hero and the camp's people too)
    expect(all.drawn.length).toBeGreaterThan(live.length);
    expect(some.drawn.length).toBeLessThan(all.drawn.length / 4);
  });

  it('never leaves out a creature that stands inside the picture, anywhere in any land', () => {
    let lands = 0;
    for (const id of REGION_IDS) {
      if (isRetired(id) || REGIONS[id].kind !== 'wild') continue;
      lands++;
      const w = newWorld(id, readyHero('warrior', REGIONS[id].levels[0], 'uncommon'));
      const live = w.enemies.filter((e) => !e.dead && !e.dummy && !e.def.prop);
      const wc = new WorldCast();
      // the hero beside every tenth creature, and a step off to each side of it
      for (let i = 0; i < live.length; i += 10) {
        for (const [dx, dy] of [[0, 0], [7 * TILE, 0], [-7 * TILE, 4 * TILE], [0, -4 * TILE]] as const) {
          w.player.x = live[i]!.x + dx;
          w.player.y = live[i]!.y + dy;
          const v = viewAt(w);
          const f = fakeCast();
          wc.sync(f.cast, w, 1 / 60, 0, { ...draw, view: v });
          for (const e of live) {
            if (!inPicture(v, e.x, e.y)) continue;
            expect(f.drawn.some((d) => Math.hypot(d.x - e.x, d.y - e.y) < TILE * 2), `${e.def.id} in ${id}`).toBe(true);
          }
        }
      }
    }
    expect(lands).toBeGreaterThan(10);
  });

  it('always draws a boss: the camera leans to one from far off', () => {
    const w = newWorld('crypt', readyHero('warrior', 5, 'uncommon'));
    const enc = w.encounters.find((e) => e.def.boss)!;
    for (const e of w.encounters) if (e.index < enc.index) e.state = 'cleared';
    const tiles = w.map.roomTiles[enc.index]!.filter((i) => !w.map.solid[i]);
    const i = tiles[Math.floor(tiles.length / 2)]!;
    w.player.x = ((i % w.map.w) + 0.5) * TILE;
    w.player.y = (Math.floor(i / w.map.w) + 0.5) * TILE + 40;
    for (let k = 0; k < 5; k++) w.step(1 / 60);
    const boss = w.boss()!;
    expect(boss).toBeTruthy();
    // the picture a long way from the boss
    const far: CastView = { x: boss.x / TILE + 60, z: boss.y / TILE + 60, ...PHONE };
    const f = fakeCast();
    new WorldCast().sync(f.cast, w, 1 / 60, 0, { ...draw, view: far });
    expect(f.drawn.some((d) => Math.hypot(d.x - boss.x, d.y - boss.y) < TILE * 2)).toBe(true);
  });
});

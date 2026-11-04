import { describe, expect, it } from 'vitest';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import { propBody } from '../src/games/sigilfall/data/props';
import { circleHitsWall, flowField, flowStep, K, moveCircle, parseRegion, TILE, type TileMap } from '../src/games/sigilfall/sim/map';
import { aimAlong, clearLine, findRoute, turnToward } from '../src/games/sigilfall/sim/nav';
import { spawnFolk, updateFolk } from '../src/games/sigilfall/sim/folk';
import { updateEnemy } from '../src/games/sigilfall/sim/ai';
import { placePet } from '../src/games/sigilfall/sim/pets';
import { emptyInput } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * Nobody bumps into what stands (the owner: "the npcs bump into various objects on their trajectory path, can we redo
 * the math"): what you see is what blocks, people plan a way round it and walk it, and no plan or body walls anyone in.
 */

const DT = 1 / 60;
const ZONES = REGION_IDS.filter((id) => !REGIONS[id].interior);

/** A little map: open ground, walled round, with whatever a test stands on it. */
function field(w: number, h: number, put?: (i: number, x: number, y: number) => number): TileMap {
  const kind = new Uint8Array(w * h);
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      const k = edge ? K.Wall : (put?.(i, x, y) ?? K.Floor);
      kind[i] = k;
      solid[i] = k === K.Wall ? 1 : 0;
    }
  }
  return { w, h, kind, room: new Uint8Array(w * h), solid, block: solid.slice(), markers: [], doors: [], roomTiles: [], buildings: [], bodies: new Array(w * h), soft: new Uint8Array(w * h), clogged: new Uint8Array(w * h) };
}

describe('Sigilfall: what stands has a body', () => {
  it('a small thing doesn’t fill its tile, and a big one runs over into the next ones', () => {
    expect(propBody('bucket')!.w).toBeLessThan(TILE / 2);
    expect(propBody('lamp')!.w).toBeLessThan(10);
    expect(propBody('wagon')!.w).toBeGreaterThan(TILE);
    expect(propBody('flowers')).toBeNull();
    expect(propBody('rug')).toBeNull();
  });

  it('a body blocks what’s there to see: past a lamp post a walker keeps walking, into a wagon it doesn’t', () => {
    const REGION = REGIONS.briarhollow;
    const m = parseRegion({
      ...REGION,
      map: ['#########', '#.......#', '#.......#', '#.......#', '#########'],
      markers: { '#': { kind: 'none' } as never },
      placed: [
        { tx: 2, ty: 2, marker: { kind: 'prop', prop: 'lamp', solid: true } },
        { tx: 6, ty: 2, marker: { kind: 'prop', prop: 'wagon', solid: true } },
      ],
      encounters: [],
      when: undefined,
    } as never);
    // beside the lamp, on its own tile, there's room
    expect(circleHitsWall(m, 2.5 * TILE - 11, 2.5 * TILE, 6)).toBe(false);
    expect(circleHitsWall(m, 2.5 * TILE, 2.5 * TILE, 6)).toBe(true);
    // the wagon's end, on the next tile over
    expect(circleHitsWall(m, 7.5 * TILE - 2, 2.5 * TILE, 6)).toBe(true);
  });
});

describe('Sigilfall: a planned way', () => {
  it('finds its way round a wall, and every stretch of it is clear for the body it was planned for', () => {
    const m = field(30, 20, (_i, x, y) => (x === 15 && y < 15 ? K.Wall : K.Floor));
    const r = findRoute(m, 5 * TILE, 5 * TILE, 25 * TILE, 5 * TILE, { r: 8 })!;
    expect(r).not.toBeNull();
    let x = 5 * TILE;
    let y = 5 * TILE;
    for (const p of r.pts) {
      expect(clearLine(m, x, y, p.x, p.y, 8)).toBe(true);
      x = p.x;
      y = p.y;
    }
    expect(x).toBeCloseTo(25 * TILE, 0);
    // pulled tight: a corner or two, not a staircase
    expect(r.pts.length).toBeLessThan(6);
  });

  it('there’s no way through a wall that has no gap', () => {
    const m = field(30, 20, (_i, x) => (x === 15 ? K.Wall : K.Floor));
    expect(findRoute(m, 5 * TILE, 5 * TILE, 25 * TILE, 5 * TILE, { r: 8 })).toBeNull();
  });

  it('prefers the road when it’s asked to', () => {
    const m = field(40, 24, (_i, _x, y) => (y === 18 ? K.Path : K.Floor));
    const off = findRoute(m, 3 * TILE, 18.5 * TILE, 36 * TILE, 18.5 * TILE, { r: 6, roads: true })!;
    for (const p of off.pts) expect(Math.abs(p.y - 18.5 * TILE)).toBeLessThan(TILE);
  });

  it('a walker following a route turns smoothly and never touches anything', () => {
    const m = field(30, 20, (_i, x, y) => ((x === 15 && y < 15) || (x === 8 && y > 6) ? K.Wall : K.Floor));
    const r = findRoute(m, 3 * TILE, 15 * TILE, 25 * TILE, 5 * TILE, { r: 9 })!;
    let x = 3 * TILE;
    let y = 15 * TILE;
    let a = 0;
    let biggest = 0;
    for (let t = 0; t < 60; t += DT) {
      const aim = aimAlong(r, x, y);
      if (!aim) break;
      const next = turnToward(a, Math.atan2(aim.y, aim.x), 5.5, DT);
      biggest = Math.max(biggest, Math.abs(Math.atan2(Math.sin(next - a), Math.cos(next - a))));
      a = next;
      const res = moveCircle(m, x, y, 5, Math.cos(a) * 24 * DT, Math.sin(a) * 24 * DT);
      expect(res.bx || res.by).toBe(false);
      x = res.x;
      y = res.y;
    }
    expect(Math.hypot(x - 25 * TILE, y - 5 * TILE)).toBeLessThan(5);
    expect(biggest).toBeLessThanOrEqual(5.5 * DT + 1e-6);
  });
});

describe('Sigilfall: following a route', () => {
  /** Walks a follower along a flow field to the tile (1, 3); how far along they get, in tiles from there. */
  const follow = (m: TileMap): number => {
    const f = flowField(m, 1, 3, 4000);
    let x = (m.w - 2 + 0.5) * TILE;
    let y = 3.5 * TILE;
    for (let i = 0; i < 1200; i++) {
      const step = flowStep(m, f, x, y);
      if (!step) break;
      const to = moveCircle(m, x, y, 5, step.x * 1.5, step.y * 1.5);
      x = to.x;
      y = to.y;
    }
    return Math.hypot(x - 1.5 * TILE, y - 3.5 * TILE) / TILE;
  };
  const brazier = (w: number): { x0: number; y0: number; x1: number; y1: number } => ({ x0: 6.5 * TILE - w / 2, y0: 3.5 * TILE - w / 2, x1: 6.5 * TILE + w / 2, y1: 3.5 * TILE + w / 2 });

  it('steps round a brazier standing right on the line, rather than walking into it for ever', () => {
    const m = field(12, 7);
    m.bodies[3 * 12 + 6] = [brazier(15)];
    expect(follow(m)).toBeLessThan(1);
  });

  it('a route goes round a tile with something in its middle, and past a thin post', () => {
    const m = parseRegion({
      ...REGIONS.briarhollow,
      map: ['###########', '#.........#', '#.........#', '#.........#', '###########'],
      markers: { '#': { kind: 'none' } as never },
      placed: [
        { tx: 3, ty: 2, marker: { kind: 'prop', prop: 'brazier', solid: false } },
        { tx: 7, ty: 2, marker: { kind: 'prop', prop: 'lantern', solid: false } },
      ],
      encounters: [],
      when: undefined,
    } as never);
    expect(m.clogged[2 * m.w + 3]).toBe(1);
    expect(m.clogged[2 * m.w + 7]).toBe(0);
    // (neither is a wall: someone can stand beside either)
    expect(m.solid[2 * m.w + 3]).toBe(0);
    expect(m.solid[2 * m.w + 7]).toBe(0);
    expect(flowField(m, 1, 2, 4000)[2 * m.w + 3]).toBe(-1);
    expect(flowField(m, 1, 2, 4000)[2 * m.w + 7]).toBeGreaterThan(0);
  });

  it('what a generator sets down keeps off a place the story needs', () => {
    const m = parseRegion({
      ...REGIONS.briarhollow,
      map: ['###########', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'],
      markers: { '#': { kind: 'none' } as never },
      placed: [
        { tx: 5, ty: 3, marker: { kind: 'place', id: 'test-spot' } },
        { tx: 5, ty: 3, marker: { kind: 'prop', prop: 'market-stall', solid: true } },
      ],
      encounters: [],
      when: undefined,
    } as never);
    expect(circleHitsWall(m, 5.5 * TILE, 3.5 * TILE, 5)).toBe(false);
  });
});

describe('Sigilfall: people going about their day', () => {
  it('in every place people live, nobody bumps into anything, or gets stuck', { timeout: 120_000 }, () => {
    const faults: string[] = [];
    for (const id of ZONES) {
      const w = newWorld(id, readyHero('warrior', 40));
      const m = w.map;
      const squares = m.markers.filter((pm) => pm.marker.kind === 'waystone').map((pm) => ({ x: (pm.tx + 0.5) * TILE, y: (pm.ty + 2.5) * TILE }));
      const { folk, rand } = spawnFolk(m, 7, true, squares.length ? squares : null);
      if (!folk.length) continue;
      let moving = 0;
      let bumps = 0;
      let touching = 0;
      const arrived = new Array(folk.length).fill(0);
      for (let t = 0; t < 90; t += DT) {
        const before = folk.map((f) => ({ x: f.x, y: f.y, r: f.route }));
        updateFolk(folk, m, rand, DT, []);
        folk.forEach((f, i) => {
          if (before[i]!.r && !f.route) arrived[i] += 1;
          // (someone on their way: a moment after they stop they still count as walking, for the look of it)
          if (!before[i]!.r || !f.route) return;
          moving++;
          const went = Math.hypot(f.x - before[i]!.x, f.y - before[i]!.y);
          if (went < f.speed * DT * 0.2) bumps++;
          if (circleHitsWall(m, f.x, f.y, 4)) touching++;
        });
      }
      if (bumps > moving * 0.01) faults.push(`${id}: ${bumps} bumps in ${moving} steps`);
      if (touching) faults.push(`${id}: ${touching} steps into something`);
      if (arrived.every((n) => n === 0)) faults.push(`${id}: nobody ever got anywhere`);
    }
    expect(faults).toEqual([]);
  });

  it('they step round someone standing in their way', () => {
    const m = field(40, 12);
    const { folk, rand } = { folk: [{ x: 5 * TILE, y: 6 * TILE, hx: 20 * TILE, hy: 6 * TILE, route: findRoute(m, 5 * TILE, 6 * TILE, 30 * TILE, 6 * TILE, { r: 9 }), a: 0, wait: 0, stuck: 0, speed: 24, walkT: 0, moving: false, still: 1, look: 0 }], rand: () => 0.5 };
    const stander = { x: 15 * TILE, y: 6 * TILE };
    let closest = Infinity;
    for (let t = 0; t < 40; t += DT) {
      updateFolk(folk, m, rand, DT, [stander]);
      closest = Math.min(closest, Math.hypot(folk[0]!.x - stander.x, folk[0]!.y - stander.y));
    }
    expect(closest).toBeGreaterThan(10);
    expect(folk[0]!.x).toBeGreaterThan(20 * TILE);
  });
});

describe('Sigilfall: nobody is walled in', () => {
  it('every person, door and way out can be walked to, at a hero’s width, with what stands having its real size', { timeout: 120_000 }, () => {
    const faults: string[] = [];
    const HERO = 7;
    for (const id of ZONES) {
      const w = newWorld(id, readyHero('warrior', 60));
      const m = w.map;
      const CELL = TILE / 2;
      const gw = m.w * 2 + 1;
      const gh = m.h * 2 + 1;
      const seen = new Uint8Array(gw * gh);
      const doors = new Set(m.doors.flat());
      const free = (c: number): boolean => {
        const cx = c % gw;
        return !circleHitsWall(m, cx * CELL, Math.floor(c / gw) * CELL, HERO);
      };
      /** A point on or beside what opens: a room's door, or a cracked wall or an illusion (a secret, not a fault). */
      const opens = (c: number): boolean => {
        const cx = c % gw;
        const cy = Math.floor(c / gw);
        for (const ty of [(cy - 1) >> 1, cy >> 1]) {
          for (const tx of [(cx - 1) >> 1, cx >> 1]) {
            if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
            const ti = ty * m.w + tx;
            const t = m.kind[ti];
            if (t === K.Door || t === K.Cracked || t === K.Illusion || doors.has(ti)) return true;
          }
        }
        return false;
      };
      const start = Math.round(w.player.y / CELL) * gw + Math.round(w.player.x / CELL);
      const q = [start];
      seen[start] = 1;
      while (q.length) {
        const c = q.pop()!;
        const cx = c % gw;
        for (const k of [cx > 0 ? c - 1 : -1, cx < gw - 1 ? c + 1 : -1, c - gw, c + gw]) {
          if (k < 0 || k >= gw * gh || seen[k]) continue;
          seen[k] = 1;
          if (free(k) || opens(k)) q.push(k);
          else seen[k] = 2;
        }
      }
      const reachable = (tx: number, ty: number): boolean => {
        const cx = tx * 2 + 1;
        const cy = ty * 2 + 1;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (seen[(cy + dy) * gw + cx + dx] === 1) return true;
        return false;
      };
      // (what a plain walk by tiles can't get to is the story's or a secret's business, not a body's)
      const tiles = new Uint8Array(m.w * m.h);
      const startTile = Math.floor(w.player.y / TILE) * m.w + Math.floor(w.player.x / TILE);
      const open = [startTile];
      tiles[startTile] = 1;
      while (open.length) {
        const i = open.pop()!;
        for (const j of [i - 1, i + 1, i - m.w, i + m.w]) {
          if (j < 0 || j >= tiles.length || tiles[j]) continue;
          const t = m.kind[j];
          if (m.solid[j] && !m.soft[j] && t !== K.Door && t !== K.Cracked && t !== K.Illusion && !doors.has(j)) continue;
          tiles[j] = 1;
          open.push(j);
        }
      }
      for (const pm of m.markers) {
        const k = pm.marker.kind;
        if (k !== 'npc' && k !== 'exit' && k !== 'spot' && k !== 'place' && k !== 'waystone' && k !== 'chest') continue;
        if (pm.when) continue;
        const i = pm.ty * m.w + pm.tx;
        const byTile = [i, i - 1, i + 1, i - m.w, i + m.w].some((j) => tiles[j]);
        if (byTile && !reachable(pm.tx, pm.ty)) faults.push(`${id}: ${k} at ${pm.tx},${pm.ty}`);
      }
    }
    expect(faults).toEqual([]);
  });
});

describe('Sigilfall: foes at their ease, companions at heel', () => {
  it('a foe at its ease doesn’t pace against what’s in its way', { timeout: 120_000 }, () => {
    const faults: string[] = [];
    for (const id of ['thornvale', 'duskfen', 'ironpeak', 'glimmerwood', 'rimeheld'] as const) {
      const w = newWorld(id, readyHero('warrior', 60));
      // (the hero well out of it)
      w.player.x = 2 * TILE;
      w.player.y = 2 * TILE;
      let steps = 0;
      let bumps = 0;
      for (let t = 0; t < 30; t += DT) {
        for (const e of w.enemies) {
          if (e.dead || e.state !== 'idle') continue;
          const x = e.x;
          const y = e.y;
          updateEnemy(w, e, DT);
          if (e.t > 1.2 && e.strolls) {
            steps++;
            if (Math.hypot(e.x - x, e.y - y) < 0.02) bumps++;
          }
        }
      }
      if (bumps > steps * 0.05) faults.push(`${id}: ${bumps} of ${steps}`);
    }
    expect(faults).toEqual([]);
  });

  it('a companion walks round what’s between them and the hero, rather than into it', () => {
    const w = newWorld('briarhollow', readyHero('warrior', 40));
    w.enemies = [];
    const pet = placePet(w, 'fern-ranger', w.player.x, w.player.y)!;
    // the hero has gone round a building: the pet goes after them
    const b = w.map.buildings.find((x) => x.lot.w >= 4 && x.lot.h >= 3)!;
    pet.x = (b.lot.tx + b.lot.w / 2) * TILE;
    pet.y = (b.lot.ty - 2) * TILE;
    w.player.x = (b.lot.tx + b.lot.w / 2) * TILE;
    w.player.y = (b.lot.ty + b.lot.h + 2) * TILE;
    const hero = { x: w.player.x, y: w.player.y };
    let closest = Infinity;
    for (let t = 0; t < 12; t += DT) {
      w.input = emptyInput();
      w.player.x = hero.x;
      w.player.y = hero.y;
      w.step(DT);
      closest = Math.min(closest, Math.hypot(pet.x - hero.x, pet.y - hero.y));
    }
    expect(closest).toBeLessThan(5 * TILE);
  });
});

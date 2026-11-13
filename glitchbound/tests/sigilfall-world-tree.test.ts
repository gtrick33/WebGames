import { describe, expect, it } from 'vitest';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import { isRetired } from '../src/games/sigilfall/data/retired';
import type { Marker, RegionId } from '../src/games/sigilfall/data/types';
import { parseRegion } from '../src/games/sigilfall/sim/map';
import { regionLinks } from '../src/games/sigilfall/sim/routes';
import { nameLines, planWorld } from '../src/games/sigilfall/ui/worldLayout';

/** The world map's lands and roads, as the map panel takes them (ui/Panels.tsx): the lands of the story, the roads between them. */
const links = regionLinks().filter(([a, b]) => REGION_IDS.includes(a) && REGION_IDS.includes(b));
const joined = new Set(links.flat());
const lands = REGION_IDS.filter((id) => joined.has(id));
const plan = planWorld(lands, links, (id) => REGIONS[id].levels[0], 'briarhollow');

describe('Sigilfall: the world map is a tree', () => {
  it('every land of the story stands on it once, a row above the land its road comes from', () => {
    expect(plan.apart).toEqual([]);
    expect(new Set(plan.ids).size).toBe(lands.length);
    const cells = new Set([...plan.cell.values()].map(([c, r]) => `${c},${r}`));
    expect(cells.size).toBe(lands.length);
    expect(plan.cell.get('briarhollow')).toEqual([0, 0]);
    for (const [from, to] of plan.roads) expect(plan.cell.get(to)![1], `${from} to ${to}`).toBe(plan.cell.get(from)![1] + 1);
    // a tree: one road into every land but the first
    expect(plan.roads).toHaveLength(lands.length - 1);
    expect(new Set(plan.roads.map(([, to]) => to)).size).toBe(lands.length - 1);
  });

  it('no branch crosses another, and none runs through a land', () => {
    type Seg = [number, number, number, number];
    const segs: { of: RegionId; s: Seg }[] = [];
    for (const [a, b] of plan.roads) {
      const [x0, y0] = plan.cell.get(a)!;
      const [x1, y1] = plan.cell.get(b)!;
      // up half a row from its land, along, and up into the next (ui/Panels.tsx `branch`)
      if (x0 === x1) segs.push({ of: a, s: [x0, y0, x1, y1] });
      else segs.push({ of: a, s: [x0, y0, x0, y0 + 0.5] }, { of: a, s: [x0, y0 + 0.5, x1, y0 + 0.5] }, { of: a, s: [x1, y0 + 0.5, x1, y1] });
    }
    const crosses = (p: Seg, q: Seg): boolean => {
      const [h, v] = p[1] === p[3] ? [p, q] : [q, p];
      if (h[1] !== h[3] || v[0] !== v[2]) return false;
      return v[0] > Math.min(h[0], h[2]) && v[0] < Math.max(h[0], h[2]) && h[1] > Math.min(v[1], v[3]) && h[1] < Math.max(v[1], v[3]);
    };
    for (const a of segs) for (const b of segs) if (a.of !== b.of) expect(crosses(a.s, b.s), `${a.of} over ${b.of}`).toBe(false);
    for (const { s } of segs) {
      for (const [id, [c, r]] of plan.cell) {
        const on = s[0] === s[2] ? c === s[0] && r > Math.min(s[1], s[3]) && r < Math.max(s[1], s[3]) : false;
        expect(on, `a branch through ${id}`).toBe(false);
      }
    }
  });

  it('draws no road to a land out of the story or into a building, and keeps the roads the tree leaves out', () => {
    for (const [a, b] of [...plan.roads, ...plan.ties]) {
      for (const id of [a, b]) {
        expect(isRetired(id), id).toBe(false);
        expect(REGIONS[id].interior, id).toBeFalsy();
      }
    }
    expect(plan.roads.length + plan.ties.length).toBe(new Set(links.map(([a, b]) => [a, b].sort().join('|'))).size);
  });

  it('keeps the map narrow enough to read whole: the story straight up the middle, a land or two to each side', () => {
    expect(plan.cols[1] - plan.cols[0]).toBeLessThanOrEqual(4);
    // the road the story takes is the trunk
    for (const id of ['thornvale', 'amberfield', 'ashen-barrows', 'sunscorch', 'pale-reach'] as const) expect(plan.cell.get(id)![0], id).toBe(0);
  });

  it('a land no road reaches stands apart, beside the start', () => {
    const p = planWorld(['a', 'b', 'c'], [['a', 'b']], () => 1, 'a');
    expect(p.apart).toEqual(['c']);
    expect(p.cell.get('c')![1]).toBe(0);
    expect(p.cell.get('c')![0]).not.toBe(0);
  });

  it('breaks a long name in two at the space nearest its middle', () => {
    expect(nameLines('Thornvale')).toEqual(['Thornvale']);
    expect(nameLines('Tomb of the Sun King')).toEqual(['Tomb of the', 'Sun King']);
    for (const id of lands) for (const line of nameLines(REGIONS[id].name.replace(/^The /, ''))) expect(line.length, line).toBeLessThanOrEqual(13);
  });
});

/* ------------------------------------------------------------------ the towns' markets and camps */

const WALK = new Set(['.', ',', '=', ':', 'b', 's']);
const FRONT = { s: [0, 1], e: [1, 0], w: [-1, 0], n: [0, -1] } as const;

describe('Sigilfall: what stands in a town or a camp stands there for a reason', () => {
  it('every market stall of every land looks out over open ground, never at a wall or the back of a house', () => {
    let stalls = 0;
    for (const id of lands) {
      const r = REGIONS[id];
      if (r.kind === 'dungeon') continue;
      for (const pm of r.placed ?? []) {
        const m = pm.marker as Marker;
        if (m.kind !== 'prop' || (m.prop !== 'market-stall' && m.prop !== 'armory')) continue;
        stalls++;
        const [fx, fy] = FRONT[m.face ?? 's'];
        // the two tiles before its counter
        for (const d of [1, 2]) expect(WALK.has(r.map[pm.ty + fy * d]?.[pm.tx + fx * d] ?? '#'), `${id}: the stall at ${pm.tx},${pm.ty} facing ${m.face ?? 's'}`).toBe(true);
      }
    }
    expect(stalls).toBeGreaterThan(10);
  });

  it('a tent stands on clear ground: no tree, bush, rock, pillar, wall or house against it', () => {
    const BAD = new Set(['T', 't', 'r', 'j', '|', 'h', 'H', '#', '~']);
    let tents = 0;
    for (const id of lands) {
      const r = REGIONS[id];
      if (r.kind === 'dungeon' || !r.holds) continue;
      for (const pm of r.placed ?? []) {
        const m = pm.marker as Marker;
        if (m.kind !== 'prop' || (m.prop.split(':')[0] !== 'camp-tent' && m.prop !== 'tent') || pm.when) continue;
        tents++;
        for (const dx of [-1, 0, 1]) expect(BAD.has(r.map[pm.ty]?.[pm.tx + dx] ?? '#'), `${id}: the tent at ${pm.tx},${pm.ty} has '${r.map[pm.ty]?.[pm.tx + dx]}' beside it`).toBe(false);
      }
    }
    expect(tents).toBeGreaterThan(40);
  });

  it('the people at their posts stand on ground they could have walked to, and the animals are let out on open ground', () => {
    let posts = 0;
    let herds = 0;
    for (const id of lands) {
      const r = REGIONS[id];
      if (r.kind === 'dungeon') continue;
      const map = parseRegion(r);
      for (const pm of map.markers) {
        const m = pm.marker;
        if (m.kind !== 'prop') continue;
        const post = m.prop.startsWith('post-');
        const herd = ['chickens', 'sheep', 'pigs', 'dog', 'cat', 'horse', 'deer'].includes(m.prop);
        // (the capital's old flock is let out under a tree of its park, as it always was)
        if ((!post && !herd) || (herd && !r.holds)) continue;
        if (post) posts++;
        else herds++;
        expect(WALK.has(r.map[pm.ty]?.[pm.tx] ?? '#'), `${id}: ${m.prop} at ${pm.tx},${pm.ty} on '${r.map[pm.ty]?.[pm.tx]}'`).toBe(true);
      }
    }
    expect(posts).toBeGreaterThan(40);
    expect(herds).toBeGreaterThan(30);
  });
});

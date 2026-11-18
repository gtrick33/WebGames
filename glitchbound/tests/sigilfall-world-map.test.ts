import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/games/sigilfall/data/quests';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import { isRetired } from '../src/games/sigilfall/data/retired';
import type { Marker, RegionId } from '../src/games/sigilfall/data/types';
import { newCharacter, questRegion } from '../src/games/sigilfall/progress/character';
import { parseRegion } from '../src/games/sigilfall/sim/map';
import { questOnMap } from '../src/games/sigilfall/sim/objective';
import { headingWord, regionLinks, roadHeading, signHeading, wayHeading } from '../src/games/sigilfall/sim/routes';
import { nameLines, placeNames, planWorld } from '../src/games/sigilfall/ui/worldLayout';

/** The world map's lands and roads, as the map panel takes them (ui/Panels.tsx): the lands of the story, the roads between them. */
const links = regionLinks().filter(([a, b]) => REGION_IDS.includes(a) && REGION_IDS.includes(b));
const joined = new Set(links.flat());
const lands = REGION_IDS.filter((id) => joined.has(id));
/** A cell as the map draws it (ui/Panels.tsx COL, ROW). */
const CELL: [number, number] = [34, 26];
const plan = planWorld(lands, links, (id) => REGIONS[id].levels[0], 'briarhollow', { heading: roadHeading, cell: CELL });

/** How far off the way a road runs (from `a` to `b`) the map draws it, in degrees. */
const offBy = (a: RegionId, b: RegionId): number => {
  const h = roadHeading(a, b)!;
  const [x0, y0] = plan.cell.get(a)!;
  const [x1, y1] = plan.cell.get(b)!;
  const [vx, vy] = [(x1 - x0) * CELL[0], (y1 - y0) * CELL[1]];
  return (Math.acos((vx * h[0] + vy * h[1]) / Math.hypot(vx, vy)) * 180) / Math.PI;
};
const has = (list: [RegionId, RegionId][], a: RegionId, b: RegionId): boolean => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

describe('Sigilfall: which way each road runs', () => {
  it('reads a compass word off a sign', () => {
    const near = (v: [number, number] | undefined, x: number, y: number): boolean => !!v && Math.abs(v[0] - x) < 1e-6 && Math.abs(v[1] - y) < 1e-6;
    expect(near(signHeading('North road: the Whisperwood'), 0, -1)).toBe(true);
    expect(near(signHeading('West gate: the long road to the Sunscorch'), -1, 0)).toBe(true);
    expect(near(signHeading('The long road south-east: the Sunscorch'), Math.SQRT1_2, Math.SQRT1_2)).toBe(true);
    expect(signHeading('The refugee road to the Crown City')).toBeUndefined();
    // (a name that starts like a compass word is no compass word)
    expect(signHeading('The Westmarch')).toBeUndefined();
  });

  it('knows which way a road leaves a land, from its spec, without building the land', () => {
    expect(wayHeading('briarhollow', 'brackenridge')).toEqual([-1, 0]);
    expect(wayHeading('thornvale', 'amberfield')).toEqual([1, 0]);
    expect(wayHeading('amberfield', 'ashen-barrows')).toEqual([0, -1]);
    // a door into a dungeon: where it stands in the land
    const d = wayHeading('rimeheld', 'rimeheld-vault')!;
    expect(d[0]).toBeLessThan(0);
    expect(d[1]).toBeLessThan(0);
    expect(headingWord([0, -1])).toBe('north');
    expect(headingWord([-1, 1])).toBe('south-west');
  });
});

describe('Sigilfall: the world map lays the lands out the way their roads run', () => {
  it('every land of the story stands on it once, the start at 0,0', () => {
    expect(plan.apart).toEqual([]);
    expect(new Set(plan.ids).size).toBe(lands.length);
    const cells = new Set([...plan.cell.values()].map(([c, r]) => `${c},${r}`));
    expect(cells.size).toBe(lands.length);
    expect(plan.cell.get('briarhollow')).toEqual([0, 0]);
  });

  it('a land reached by the west road stands to the left of the land before it, by the north road above it', () => {
    // the owner: "if the next zone is to the west, then the node should be left to the current one"
    const [bx, by] = plan.cell.get('briarhollow')!;
    expect(plan.cell.get('whisperwood')![1]).toBeLessThan(by);
    expect(plan.cell.get('brackenridge')![0]).toBeLessThan(bx);
    expect(plan.cell.get('thornvale')![1]).toBeGreaterThan(by);
    expect(plan.cell.get('amberfield')![0]).toBeGreaterThan(plan.cell.get('thornvale')![0]);
    expect(plan.cell.get('ashen-barrows')![1]).toBeLessThan(plan.cell.get('amberfield')![1]);
    expect(plan.cell.get('emberwick')![0]).toBeLessThan(plan.cell.get('ashen-barrows')![0]);
    expect(plan.cell.get('rimeheld')![0]).toBeLessThan(plan.cell.get('glimmerwood')![0]);
    expect(plan.cell.get('highwall')![0]).toBeGreaterThan(plan.cell.get('shattered-vale')![0]);
    expect(plan.cell.get('pale-reach')![1]).toBeLessThan(plan.cell.get('hollowmere')![1]);
  });

  it('draws every road the story takes, and every other road it draws, within an eighth of a turn of the way it runs', () => {
    for (const [a, b] of plan.roads) expect(offBy(a, b), `${a} to ${b}`).toBeLessThanOrEqual(45.5);
    // the road the story first comes into each land by is always drawn
    for (const id of lands) if (id !== 'briarhollow') expect(plan.roads.some(([, to]) => to === id) || plan.roads.some(([from, to]) => from === id && plan.cell.has(to)), id).toBe(true);
  });

  it('no road drawn crosses another, and none runs through a land', () => {
    const seg = ([a, b]: [RegionId, RegionId]) => [...plan.cell.get(a)!, ...plan.cell.get(b)!] as [number, number, number, number];
    const side = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    for (const p of plan.roads) {
      for (const q of plan.roads) {
        if (p === q || p.some((x) => q.includes(x))) continue;
        const [a, b] = [seg(p), seg(q)];
        const crosses = side(a[0], a[1], a[2], a[3], b[0], b[1]) * side(a[0], a[1], a[2], a[3], b[2], b[3]) < 0 && side(b[0], b[1], b[2], b[3], a[0], a[1]) * side(b[0], b[1], b[2], b[3], a[2], a[3]) < 0;
        expect(crosses, `${p.join('-')} over ${q.join('-')}`).toBe(false);
      }
      const [x0, y0, x1, y1] = seg(p).map((v, i) => v * CELL[i % 2]!);
      for (const [id, [c, r]] of plan.cell) {
        if (p.includes(id)) continue;
        const [wx, wy] = [c * CELL[0] - x0!, r * CELL[1] - y0!];
        const [vx, vy] = [x1! - x0!, y1! - y0!];
        const t = (wx * vx + wy * vy) / (vx * vx + vy * vy);
        const d = Math.hypot(wx - t * vx, wy - t * vy);
        expect(t > 0 && t < 1 && d < 8, `${p.join('-')} through ${id}`).toBe(false);
      }
    }
  });

  it('draws no road to a land out of the story or into a building, and keeps every road (the ones not drawn show for the land picked)', () => {
    for (const [a, b] of [...plan.roads, ...plan.ties]) {
      for (const id of [a, b]) {
        expect(isRetired(id), id).toBe(false);
        expect(REGIONS[id].interior, id).toBeFalsy();
      }
    }
    expect(plan.roads.length + plan.ties.length).toBe(new Set(links.map(([a, b]) => [a, b].sort().join('|'))).size);
    // the short roads round a corner of the world are drawn, not only the one the story first takes
    expect(has(plan.roads, 'brackenridge', 'thornvale')).toBe(true);
    expect(has(plan.roads, 'emberwick', 'ashen-barrows')).toBe(true);
    // the road from the Crown City's west gate loops round the world the long way: it can't be drawn as it runs
    expect(has(plan.ties, 'emberwick', 'sunscorch')).toBe(true);
  });

  it('keeps the world small enough to read, and lays it out the same way every time', () => {
    expect(plan.cols[1] - plan.cols[0]).toBeLessThanOrEqual(7);
    expect(plan.rows[1] - plan.rows[0]).toBeLessThanOrEqual(14);
    const again = planWorld(lands, links, (id) => REGIONS[id].levels[0], 'briarhollow', { heading: roadHeading, cell: CELL });
    expect([...again.cell]).toEqual([...plan.cell]);
  });

  it('a land no road reaches stands apart, beside the start', () => {
    const p = planWorld(['a', 'b', 'c'], [['a', 'b']], () => 1, 'a');
    expect(p.apart).toEqual(['c']);
    expect(p.cell.get('c')![1]).toBe(0);
    expect(p.cell.get('c')![0]).not.toBe(0);
  });

  it('writes each name where it runs over no other name and no mark', () => {
    const size = (id: RegionId): [number, number] => {
      const lines = nameLines(REGIONS[id].name.replace(/^The /, ''));
      return [Math.max(...lines.map((l) => l.length * 3.1 * 0.6 + 0.6), 'levels 56-59'.length * 2.7 * 0.6 + 0.6), lines.length * 3.1 * 1.12 + 2.7 * 1.15];
    };
    const names = placeNames(plan, CELL, size, 5, 4.2);
    const boxes = [...names.values()].map((n) => n.box);
    const overlap = (p: number[], q: number[]): boolean => Math.min(p[2]!, q[2]!) > Math.max(p[0]!, q[0]!) && Math.min(p[3]!, q[3]!) > Math.max(p[1]!, q[1]!);
    for (const [id, { box }] of names) {
      for (const [other, b] of boxes.entries()) if (b !== box) expect(overlap(box, b), `${id} and ${[...names.keys()][other]}`).toBe(false);
      for (const [o, [c, r]] of plan.cell) if (o !== id) expect(overlap(box, [c * CELL[0] - 4.2, r * CELL[1] - 4.2, c * CELL[0] + 4.2, r * CELL[1] + 4.2]), `${id} over ${o}`).toBe(false);
    }
  });

  it('breaks a long name in two at the space nearest its middle', () => {
    expect(nameLines('Thornvale')).toEqual(['Thornvale']);
    expect(nameLines('Tomb of the Sun King')).toEqual(['Tomb of the', 'Sun King']);
    for (const id of lands) for (const line of nameLines(REGIONS[id].name.replace(/^The /, ''))) expect(line.length, line).toBeLessThanOrEqual(13);
  });
});

describe('Sigilfall: a quest shown on the world map', () => {
  const onMap = (id: RegionId): boolean => plan.cell.has(id);

  it('every quest of the story shows on a land of the map, in a land the hero knows or past the nearest one they do', () => {
    // the owner: "make sure every quest, when clicked on map, shows the respective zone of its location ... if the zone
    // isnt unlocked, point and highlight the closest unlocked zone"
    let shown = 0;
    for (const q of QUESTS) {
      if (q.objective.kind === 'tutorial') continue;
      for (const known of [lands, ['briarhollow'] as RegionId[]]) {
        const h = newCharacter('warrior', 'Map', 'map', 0);
        h.unlocked = [...known];
        h.quests[q.id] = { state: 'active', n: 0 };
        const at = questOnMap(h, q, onMap, 'briarhollow');
        expect(at, q.id).toBeDefined();
        expect(onMap(at!.land), `${q.id}: ${at!.land}`).toBe(true);
        if (h.unlocked.includes(at!.land)) expect(at!.from, q.id).toBeUndefined();
        else {
          expect(h.unlocked.includes(at!.from!), `${q.id}: from ${at!.from}`).toBe(true);
          // the arrow runs along the roads, from there to it
          expect(at!.path![0], q.id).toBe(at!.from);
          expect(at!.path!.at(-1), q.id).toBe(at!.land);
          for (let i = 1; i < at!.path!.length; i++) expect(has(links, at!.path![i - 1]!, at!.path![i]!), `${q.id}: ${at!.path![i - 1]} to ${at!.path![i]}`).toBe(true);
          expect(at!.heading, q.id).toBeDefined();
        }
        shown++;
      }
    }
    expect(shown).toBeGreaterThan(200);
  });

  it('points from the nearest land the hero has been to, by road', () => {
    const q = QUESTS.find((d) => d.id === 'the-withered-ring')!;
    const h = newCharacter('warrior', 'Map', 'map', 0);
    h.unlocked = ['briarhollow', 'whisperwood', 'thornvale', 'amberfield', 'ashen-barrows'];
    h.quests[q.id] = { state: 'active', n: 0 };
    const at = questOnMap(h, q, onMap, 'briarhollow')!;
    expect(at.land).toBe('glimmerwood');
    // the Glimmerwood is two roads on from the Ashen Barrows, by the Sunscorch
    expect(at.from).toBe('ashen-barrows');
    expect(at.path).toEqual(['ashen-barrows', 'sunscorch', 'glimmerwood']);
    // and once the hero has found it, it is shown itself
    h.unlocked.push('sunscorch', 'glimmerwood');
    expect(questOnMap(h, q, onMap, 'briarhollow')).toEqual({ land: 'glimmerwood' });
  });

  it('shows a quest in a place the map does not draw on the land beside it', () => {
    const q = QUESTS.find((d) => questRegion(d) === 'crypt')!;
    const h = newCharacter('warrior', 'Map', 'map', 0);
    h.unlocked = ['briarhollow', 'crypt'];
    h.quests[q.id] = { state: 'active', n: 0 };
    expect(questOnMap(h, q, (id) => onMap(id) && id !== 'crypt')).toEqual({ land: 'briarhollow' });
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

import { describe, expect, it } from 'vitest';
import { picBody } from '../src/games/sigilfall/data/buildingArt';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { K, parseRegion, TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput, type World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The Ember Keep, the Regent's seat in the Crown City (the owner: "scale up the castle, make it more majestic,
 * big and terrifying, inside also seems empty, make it feel glorious"): twice the size of any keep in the land,
 * in dark stone between its towers, over the city's north wall; the camera climbs it the first time the hero
 * comes up the avenue; inside, the Great Hall's runner from the door to the dais, the throne between its fires.
 */

const DT = 1 / 60;
const run = (w: World, s: number): void => {
  for (let t = 0; t < s; t += DT) {
    w.input = emptyInput();
    w.step(DT);
  }
};

/** A hero in the Crown City for the first time, sent to the Regent. */
function hero() {
  const c = readyHero('warrior', 20);
  const done = (id: string): void => {
    if (c.quests[id]) return;
    c.quests[id] = { state: 'done', n: 1 };
    for (const a of QUEST_DEFS[id]?.after ?? []) done(a);
  };
  for (const a of QUEST_DEFS['the-kings-design']!.after ?? []) done(a);
  c.quests['the-kings-design'] = { state: 'active', n: 0 };
  if (!c.unlocked.includes('emberwick')) c.unlocked.push('emberwick');
  return c;
}

describe('Sigilfall: the Ember Keep', () => {
  it('is a fortress twice the size of any keep in the land, in dark stone, its towers over the north wall', () => {
    const m = parseRegion(REGIONS.emberwick);
    const keep = m.buildings.find((b) => b.name === 'The Ember Keep')!;
    expect(keep).toBeDefined();
    expect(keep.pics.map((p) => p.id)).toEqual(['keep', 'tower_round_slate', 'tower_square_roof', 'tower_round_slate', 'tower_square_roof']);
    expect(keep.pics[0]!.scale).toBe(2);
    for (const p of keep.pics) expect(p.grim, p.id).toBe(true);
    // twice as tall as the land's other keeps, rising over the wall (its rows 7 and 8)
    const [, top, , ground] = picBody(keep.pics[0]!);
    expect(ground - top).toBeGreaterThan(12 * TILE);
    expect(top).toBeLessThan(7 * TILE);
    for (const other of Object.values(REGIONS).filter((r) => r.id !== 'emberwick' && r.kind !== 'dungeon')) {
      for (const b of parseRegion(other).buildings.filter((x) => x.style === 'keep')) {
        const [, t, , g] = picBody(b.pics[0]!);
        expect(g - t, other.id).toBeLessThan((ground - top) / 1.5);
      }
    }
    // its towers stand either side of it, and the way in is still under its door
    const [x0, , x1] = picBody(keep.pics[0]!);
    expect(keep.pics.filter((p) => picBody(p)[2] <= x0 + 8)).toHaveLength(2);
    expect(keep.pics.filter((p) => picBody(p)[0] >= x1 - 8)).toHaveLength(2);
    expect(keep.door).toEqual([52, 18]);
  });

  it('the first time up the avenue, the camera climbs the keep, and then the Regent meets the hero', () => {
    const w = newWorld('emberwick', hero());
    w.enemies = [];
    w.player.x = 52.5 * TILE;
    w.player.y = 27.5 * TILE;
    run(w, 0.5);
    expect(w.scene?.def.id).toBe('ember-the-keep');
    run(w, 1);
    expect(w.scene?.focus?.y ?? Infinity).toBeLessThan(14 * TILE);
    expect(w.scene?.title?.text).toBe('The Ember Keep');
    for (let t = 0; t < 20 && w.scene?.def.id === 'ember-the-keep'; t += 0.25) run(w, 0.25);
    expect(w.hero.opened).toContain('scene:ember-the-keep');
    // and her own scene follows it
    for (let t = 0; t < 6 && !w.scene; t += 0.25) run(w, 0.25);
    expect(w.scene?.def.id).toBe('ember-the-regent');
  });

  it('inside, a runner from the door to the dais, the high throne on it between burning braziers', () => {
    const m = parseRegion(REGIONS['great-hall']);
    const props = (name: string) => m.markers.filter((pm) => pm.marker.kind === 'prop' && pm.marker.prop.split(':')[0] === name);
    const runner = props('runner').map((pm) => pm.ty);
    const door = m.markers.find((pm) => pm.marker.kind === 'exit')!;
    // unbroken, the door's width, from the foot of the dais to the door, and walked on
    expect(runner.length).toBe(door.ty - 6);
    for (let y = 6; y < door.ty; y++) {
      expect(runner, `row ${y}`).toContain(y);
      expect(m.solid[y * m.w + door.tx], `row ${y}`).toBe(0);
    }
    const throne = props('high-throne')[0]!;
    expect(props('dais')[0]!.tx).toBe(throne.tx);
    expect(m.kind[(throne.ty + 1) * m.w + throne.tx - 5]).toBe(K.Brazier);
    expect(m.kind[(throne.ty + 1) * m.w + throne.tx + 5]).toBe(K.Brazier);
    // glorious, not empty: colonnades, windows, a floor wall to wall
    expect(props('column').length).toBeGreaterThanOrEqual(10);
    expect(props('window').length).toBeGreaterThanOrEqual(4);
    expect(props('hall-floor')).toHaveLength(1);
  });

  it('the realm’s great in stone line the runner either side, a path of them to the throne, gilt lions at the steps', () => {
    const m = parseRegion(REGIONS['great-hall']);
    const at = (name: string) => m.markers.filter((pm) => pm.marker.kind === 'prop' && pm.marker.prop.split(':')[0] === name);
    const runner = at('runner')[0]!.tx;
    const path = at('statue').filter((pm) => Math.abs(pm.tx - runner) === 3);
    const rows = [...new Set(path.map((pm) => pm.ty))];
    expect(rows.length).toBeGreaterThanOrEqual(5);
    // a pair on every row, the same figure either side, and no two rows alike all the way up
    for (const y of rows) {
      const pair = path.filter((pm) => pm.ty === y).map((pm) => (pm.marker.kind === 'prop' ? pm.marker.prop : ''));
      expect(pair, `row ${y}`).toHaveLength(2);
      expect(pair[0], `row ${y}`).toBe(pair[1]);
    }
    expect(new Set(path.map((pm) => (pm.marker.kind === 'prop' ? pm.marker.prop : ''))).size).toBeGreaterThanOrEqual(4);
    const lions = at('lion');
    expect(lions.map((pm) => pm.tx - runner).sort()).toEqual([-3, 3]);
    expect(Math.min(...rows)).toBeGreaterThan(lions[0]!.ty);
  });
});

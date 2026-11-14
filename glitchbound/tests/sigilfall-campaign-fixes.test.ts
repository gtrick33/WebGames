import { describe, expect, it } from 'vitest';
import { abandonQuest, cantAbandon, newCharacter, questState } from '../src/games/sigilfall/progress/character';
import { letOut, updateCritters } from '../src/games/sigilfall/sim/critters';
import { K, TILE, type TileMap } from '../src/games/sigilfall/sim/map';
import { PETS } from '../src/games/sigilfall/data/pets';
import { AMBERFIELD_EVENTS } from '../src/games/sigilfall/data/zones/amberfield-quests';
import { MOUNT_DEFS } from '../src/games/sigilfall/data/mounts';

/**
 * The owner's campaign notes of 2026-11-14: side quests can be given up, Hearthstead's animals run from the attack,
 * and Dunmore's riders come to the camp on horseback.
 */

const hero = () => newCharacter('mage', 'QAfix', 'hero0', 1_800_000_000_000);

/** Open ground, walled round. */
function field(w: number, h: number): TileMap {
  const kind = new Uint8Array(w * h);
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      kind[i] = edge ? K.Wall : K.Floor;
      solid[i] = edge ? 1 : 0;
    }
  }
  return { w, h, kind, room: new Uint8Array(w * h), solid, block: solid.slice(), markers: [], doors: [], roomTiles: [], buildings: [], bodies: new Array(w * h), soft: new Uint8Array(w * h), clogged: new Uint8Array(w * h), thicket: new Uint8Array(w * h) };
}

describe('Sigilfall: abandoning a quest', () => {
  it('gives a side quest back to its giver, offered again with nothing done', () => {
    const h = hero();
    h.quests['the-pride'] = { state: 'active', n: 5 };
    h.tracked = 'the-pride';
    expect(cantAbandon(h, 'the-pride')).toBeNull();
    expect(abandonQuest(h, 'the-pride')?.id).toBe('the-pride');
    expect(h.quests['the-pride']).toEqual({ state: 'offered', n: 0 });
    expect(h.tracked).toBeUndefined();
    // (and nothing to give up twice)
    expect(abandonQuest(h, 'the-pride')).toBeNull();
  });

  it('keeps the main story, beats that start by themselves and story events', () => {
    const h = hero();
    h.quests['hearth-the-riders-come'] = { state: 'active', n: 0 };
    expect(cantAbandon(h, 'hearth-the-riders-come')).not.toBeNull();
    expect(abandonQuest(h, 'hearth-the-riders-come')).toBeNull();
    expect(questState(h, 'hearth-the-riders-come')).toBe('active');
    h.quests['silvaines-song'] = { state: 'active', n: 0 };
    expect(cantAbandon(h, 'silvaines-song')).not.toBeNull();
    // (and only what is under way)
    expect(cantAbandon(h, 'ashby-farm')).not.toBeNull();
  });

  it('keeps an answer to a choice: taking it closed the others for good', () => {
    const h = hero();
    h.quests['the-thorn-court'] = { state: 'active', n: 0 };
    h.quests['silvaines-song'] = { state: 'done', n: -1 };
    expect(abandonQuest(h, 'the-thorn-court')).toBeNull();
    expect(questState(h, 'the-thorn-court')).toBe('active');
  });
});

describe('Sigilfall: the animals of a place under attack', () => {
  const map = field(60, 60);
  const home = { x: 30 * TILE, y: 30 * TILE };
  const far = { x: 2000, y: 2000 };
  const rand = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();

  it('a horse wanders its yard and trots now and then, rather than standing in one spot', () => {
    const [horse] = letOut('horse', home.x, home.y, rand);
    let top = 0;
    let most = 0;
    for (let i = 0; i < 60 * 60; i++) {
      updateCritters([horse!], map, far, rand, 1 / 60);
      top = Math.max(top, Math.hypot(horse!.vx, horse!.vy));
      most = Math.max(most, Math.hypot(horse!.x - home.x, horse!.y - home.y));
    }
    expect(top).toBeGreaterThan(30);
    expect(most).toBeGreaterThan(TILE);
    expect(horse!.alpha).toBe(1);
  });

  it('bolts away from the trouble and is gone, then is back at home once it is over', () => {
    const [horse] = letOut('horse', home.x, home.y, rand);
    const fire = { x: home.x - 3 * TILE, y: home.y };
    updateCritters([horse!], map, far, rand, 1 / 60, [fire]);
    // (away from the fire, at a gallop)
    expect(horse!.vx).toBeGreaterThan(0);
    expect(Math.hypot(horse!.vx, horse!.vy)).toBeGreaterThan(100);
    for (let i = 0; i < 60 * 4; i++) updateCritters([horse!], map, far, rand, 1 / 60, [fire]);
    expect(horse!.alpha).toBe(0);
    // trouble far from its home doesn't move it
    const [calm] = letOut('horse', home.x, home.y, rand);
    updateCritters([calm!], map, far, rand, 1 / 60, [{ x: home.x + 40 * TILE, y: home.y }]);
    expect(calm!.fled).toBe(0);
    // over: home, fading back in
    updateCritters([horse!], map, far, rand, 1 / 60, []);
    expect(Math.hypot(horse!.x - home.x, horse!.y - home.y)).toBeLessThan(1);
    for (let i = 0; i < 60 * 2; i++) updateCritters([horse!], map, far, rand, 1 / 60, []);
    expect(horse!.alpha).toBe(1);
  });
});

describe('Sigilfall: Dunmore’s riders come on horseback', () => {
  it('ride a real mount, and come as followers who don’t fight', () => {
    const rider = PETS['hearth-horseman']!;
    expect(MOUNT_DEFS[rider.rides!]).toBeDefined();
    expect(rider.role).toBe('follower');
    expect(AMBERFIELD_EVENTS['camp-riders']!.arrive!.pets.every((p) => PETS[p]?.rides)).toBe(true);
  });
});

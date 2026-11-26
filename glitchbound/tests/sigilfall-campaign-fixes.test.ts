import { describe, expect, it } from 'vitest';
import { abandonQuest, cantAbandon, newCharacter, questState, storyOffer, trackedQuest } from '../src/games/sigilfall/progress/character';
import { offerStep } from '../src/games/sigilfall/progress/waiting';
import { questWhere } from '../src/games/sigilfall/sim/objective';
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

describe('Sigilfall: the tracker follows the story', () => {
  it('shows the main quest, not a side quest the same marshal gave in the same breath', () => {
    const h = hero();
    h.quests = {};
    // Stormhoof (Dunmore's side quest) comes before the story's next beat in the list
    h.quests.stormhoof = { state: 'active', n: 0 };
    h.quests['hearth-the-riders-come'] = { state: 'active', n: 0 };
    expect(trackedQuest(h, 'amberfield')?.id).toBe('hearth-the-riders-come');
    // the story's, even done elsewhere, before a side quest here
    expect(trackedQuest(h, 'briarhollow')?.id).toBe('hearth-the-riders-come');
    // ...unless the hero chose to follow the side quest
    h.tracked = 'stormhoof';
    expect(trackedQuest(h, 'amberfield')?.id).toBe('stormhoof');
  });

  // the owner, 2026-11-26: after Rangers for Briarhollow "i get lost ... what to do and couldnt see it"
  it('follows the story’s next quest to whoever gives it while it waits to be taken', () => {
    const h = hero();
    h.quests = { 'camp-scouts': { state: 'done', n: 1 }, 'south-road': { state: 'offered', n: 0 }, 'russet-hides': { state: 'active', n: 0 } };
    expect(storyOffer(h)?.id).toBe('south-road');
    // before a side quest under way, wherever the hero is
    expect(trackedQuest(h, 'brackenridge')?.id).toBe('south-road');
    // its place is its giver's: Maren, in Briarhollow
    expect(questWhere(h, storyOffer(h)!)).toBe('briarhollow');
    expect(offerStep(h, storyOffer(h)!, 'briarhollow')).toBe('Talk to Elder Maren');
    expect(offerStep(h, storyOffer(h)!, 'brackenridge')).toBe('Talk to Elder Maren in Briarhollow');
    // a side quest the hero chose still comes first
    h.tracked = 'russet-hides';
    expect(trackedQuest(h, 'brackenridge')?.id).toBe('russet-hides');
    // and once taken, the quest's own steps lead
    delete h.tracked;
    h.quests['south-road'] = { state: 'active', n: 0 };
    expect(storyOffer(h)).toBeUndefined();
    expect(trackedQuest(h, 'briarhollow')?.id).toBe('south-road');
    expect(questWhere(h, storyOffer(h) ?? trackedQuest(h)!)).toBe('thornvale');
  });
});

/**
 * The Rift Trials (data/wardens.ts, data/keystones.ts): a young hero can take the stones at their own strength
 * from their first cleared dungeon, up to +10 until they've finished the story. The story alone makes a warden.
 */
import { describe, expect, it } from 'vitest';
import { keyLevelFor, keyLoot, keyPar, keyScale, KEY_LEVEL, riftDungeons, SYNC_BELOW } from '../src/games/sigilfall/data/keystones';
import { MOUNT_DEFS, MOUNTS } from '../src/games/sigilfall/data/mounts';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId, RegionId } from '../src/games/sigilfall/data/types';
import { CAMPAIGN_END, ECHOES, RIFT_CAP_UNFINISHED, WARDEN_ITEMS, WARDENS, wardenLookId } from '../src/games/sigilfall/data/wardens';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import { HAIRS, newCharacter, SKINS } from '../src/games/sigilfall/progress/character';
import { DEFAULT_SETTINGS, validateCharacter } from '../src/games/sigilfall/progress/save';
import { campaignDone, grantMounts, grantWarden, heroTitle, lookFits, lookOf, lookSource, setShelfPoints, syncRift } from '../src/games/sigilfall/progress/wardrobe';
import { MOUNT_FRAMES, MOUNT_WALK_FRAMES, paintMount } from '../src/games/sigilfall/render/art/mount';
import { heroLook } from '../src/games/sigilfall/render/sprites';
import { TILE } from '../src/games/sigilfall/sim/map';
import { World } from '../src/games/sigilfall/sim/world';
import { play, readyHero } from './sigilfall-bot';

function trial(region: RegionId, key: number, cls: ClassId, level: number, seed = 1): World {
  const hero = readyHero(cls, level, 'uncommon', seed);
  hero.keystone = key;
  hero.potions = 5;
  return new World({ region, tier: 2, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed, key, affixes: [], handIns: false });
}

function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

describe('the stones meet a young hero at their own strength', () => {
  it('leaves the endgame exactly as it was at level 60', () => {
    expect(keyLevelFor(60)).toBe(KEY_LEVEL);
    expect(keyScale(5, 60)).toEqual(keyScale(5));
    expect(keyLoot(5, 60)).toBe(keyLoot(5));
    expect(trial('crypt', 3, 'warrior', 60).level).toBe(KEY_LEVEL);
  });

  it('sets enemies just above the hero and keeps loot near their level', () => {
    const w = trial('crypt', 1, 'warrior', 15);
    expect(w.level).toBe(16);
    expect(keyLoot(1, 15)).toBe(16);
    expect(keyLoot(10, 40)).toBe(46);
    expect(keyScale(1, 15).hp).toBeLessThan(keyScale(1, 60).hp);
  });

  // The bot is a poor player, so "the bot gets through" means a person can.
  it.each(['warrior', 'mage', 'ranger', 'priest', 'paladin', 'warlock', 'druid'] as ClassId[])('a level-15 %s clears the first dungeon at +1, in a fair time', (cls) => {
    let cleared = false;
    let best = Infinity;
    for (const seed of [1, 2, 3]) {
      const w = trial('crypt', 1, cls, 15, seed);
      const r = play(w, { seconds: keyPar(REGIONS.crypt) * 3, done: (x) => !!x.keyRun?.end, goal: nextRoom, maxDeaths: 6 });
      if (w.keyRun?.end) {
        cleared = true;
        best = Math.min(best, w.keyRun.end.time);
        expect(r).toBeTruthy();
        break;
      }
    }
    expect(cleared, `${cls} never cleared`).toBe(true);
    expect(best).toBeLessThan(keyPar(REGIONS.crypt) * 3);
  }, 120_000);

  it('a young hero’s trial earns no Mythic clear and moves no quest on', () => {
    const w = trial('crypt', 1, 'warrior', 15);
    play(w, { seconds: keyPar(REGIONS.crypt) * 3, done: (x) => !!x.keyRun?.end, goal: nextRoom, maxDeaths: 6 });
    expect(Object.keys(w.hero.clears).filter((k) => k.endsWith(':2'))).toEqual([]);
  }, 120_000);
});

describe('who holds a stone, and how far it goes', () => {
  it('the first cleared dungeon wins the first stone, once', () => {
    const c = newCharacter('mage', 'Test', 'h');
    expect(syncRift(c)).toBe(false);
    expect(c.keystone).toBe(0);
    c.clears['crypt:0'] = 1;
    expect(syncRift(c)).toBe(true);
    expect(c.keystone).toBe(1);
    expect(syncRift(c)).toBe(false);
  });

  it('reaching level 20 opens the stones as well, for a hero who hasn’t cleared a dungeon', () => {
    const young = readyHero('mage', 19);
    young.keystone = 0;
    young.clears = {};
    expect(syncRift(young)).toBe(false);
    const grown = readyHero('mage', 20);
    grown.keystone = 0;
    grown.clears = {};
    expect(syncRift(grown)).toBe(true);
    expect(grown.keystone).toBe(1);
  });

  it('stops at the cap until the hero has finished the story', () => {
    const w = trial('crypt', RIFT_CAP_UNFINISHED, 'warrior', 30);
    (w as unknown as { finishKeyRun(t: number, up: number, x: number, y: number): void }).finishKeyRun(10, 3, 0, 0);
    expect(w.hero.keystone).toBe(RIFT_CAP_UNFINISHED);

    const done = trial('crypt', RIFT_CAP_UNFINISHED, 'warrior', 30);
    done.hero.quests[CAMPAIGN_END] = { state: 'done', n: 0 };
    (done as unknown as { finishKeyRun(t: number, up: number, x: number, y: number): void }).finishKeyRun(10, 3, 0, 0);
    expect(done.hero.keystone).toBe(RIFT_CAP_UNFINISHED + 3);
  });

  it('opens more dungeons as the stones climb, gentlest first', () => {
    const three = riftDungeons(1);
    expect(three).toHaveLength(3);
    expect(three.every((r) => r.kind === 'dungeon')).toBe(true);
    expect(three[0]!.levels[0]).toBeLessThanOrEqual(three[2]!.levels[0]);
    expect(riftDungeons(10).length).toBeGreaterThan(three.length);
    expect(SYNC_BELOW).toBe(60);
  });

  it('tells a story that climbs in order', () => {
    const at = ECHOES.map((e) => e.at);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(at).toContain(RIFT_CAP_UNFINISHED);
    expect(Math.max(...at)).toBeGreaterThan(RIFT_CAP_UNFINISHED);
  });
});

describe('only the story makes a warden', () => {
  it('every class has its own title, armor and drake', () => {
    expect(Object.keys(WARDENS).sort()).toEqual([...CLASS_IDS].sort());
    expect(new Set(Object.values(WARDENS).map((w) => w.title)).size).toBe(CLASS_IDS.length);
    for (const cls of CLASS_IDS) expect(MOUNT_DEFS[`drake-${cls}`]?.body).toBe('drake');
    expect(WARDEN_ITEMS).toHaveLength(CLASS_IDS.length * 2);
    expect(WARDEN_ITEMS.every((i) => i.special)).toBe(true);
  });

  it('a Riftstone gives none of it; finishing the story gives all of it, to that class alone', () => {
    const c = newCharacter('warlock', 'Test', 'h');
    c.keystone = 10;
    expect(campaignDone(c)).toBe(false);
    expect(grantWarden(c)).toBe(false);
    expect(heroTitle(c)).toBeNull();
    expect(grantMounts(c).map((m) => m.id)).not.toContain('drake-warlock');

    c.quests[CAMPAIGN_END] = { state: 'done', n: 0 };
    expect(grantWarden(c)).toBe(true);
    expect(grantWarden(c)).toBe(false);
    expect(c.looks).toContain(wardenLookId('warlock', 'chest'));
    expect(heroTitle(c)).toBe('Sigil-warden of the Veil');
    const got = grantMounts(c).map((m) => m.id);
    expect(got).toContain('drake-warlock');
    expect(got).not.toContain('drake-mage');
  });

  it('the armor is a real look, for its own class', () => {
    const look = lookOf(wardenLookId('paladin', 'chest'))!;
    expect(look.r).toBe('legendary');
    expect(lookFits(look, 'paladin')).toBe(true);
    expect(lookFits(look, 'mage')).toBe(false);
    expect(lookSource(newCharacter('paladin', 'T', 'h'), look.id)).toMatch(/Finish the story/);
  });

  it('the Trophy Shelf earns its mount at 100 points, once the story has horses in it', () => {
    const c = newCharacter('mage', 'T', 'h');
    setShelfPoints(100);
    expect(grantMounts(c)).toEqual([]);
    c.quests['camp-riders'] = { state: 'done', n: 1 };
    setShelfPoints(99);
    expect(grantMounts(c).map((m) => m.id)).not.toContain('cabinet-courser');
    setShelfPoints(100);
    expect(grantMounts(c).map((m) => m.id)).toContain('cabinet-courser');
    setShelfPoints(0);
  });

  it('every drake paints inside its frames, in every view and step', () => {
    for (const m of MOUNTS.filter((x) => x.body === 'drake')) {
      for (const view of ['side', 'down', 'up'] as const) {
        for (let f = 0; f <= MOUNT_WALK_FRAMES; f++) {
          const { back, front } = paintMount(m, view, f, true);
          expect(back.w).toBe(MOUNT_FRAMES[view].w);
          expect(front.h).toBe(MOUNT_FRAMES[view].h);
        }
      }
    }
  });
});

describe('how a hero looks', () => {
  it('a hero’s skin, hair and beard are drawn', () => {
    const look = heroLook('warrior', {}, {}, 'm', { skin: 5, hair: 7, style: 'long', beard: true });
    expect(look.skin).toBe(SKINS[5]);
    expect(look.hair).toBe(HAIRS[7]);
    expect(look.hairStyle).toBe('long');
    expect(look.beard).toBe(HAIRS[7]);
    // a hero made before the choice keeps their class's look
    expect(heroLook('warrior').skin).toBe(heroLook('warrior', {}, {}, 'm', undefined).skin);
    // no beards on the women's faces
    expect(heroLook('warrior', {}, {}, 'f', { skin: 0, hair: 0, style: 'short', beard: true }).beard).toBeFalsy();
  });

  it('survives a save, and a broken one is no choice at all', () => {
    const c = newCharacter('mage', 'T', 'h');
    c.face = { skin: 2, hair: 3, style: 'pony', beard: false };
    expect(validateCharacter(JSON.parse(JSON.stringify(c)), 0)?.face).toEqual(c.face);
    expect(validateCharacter({ ...JSON.parse(JSON.stringify(c)), face: { skin: 99, hair: 0 } }, 0)?.face).toBeUndefined();
    const old = JSON.parse(JSON.stringify(newCharacter('mage', 'T', 'h')));
    expect(validateCharacter(old, 0)?.face).toBeUndefined();
  });
});

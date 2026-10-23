/**
 * Riftstones, the endgame (data/keystones.ts): any dungeon at level 60, tougher with every level of the stone,
 * with the week's affixes, against the clock. The stone grows when the run beats the clock and shrinks when
 * it doesn't; the affixes do what they say; a level-60 hero in good gear beats the clock on a +2 stone.
 */
import { describe, expect, it } from 'vitest';
import { KEY_DEATH, KEY_LEVEL, KEY_MIN, keyAffixes, keyPar, keyScale, keyUpgrade, weekAffixes, type KeyAffix } from '../src/games/sigilfall/data/keystones';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { RegionId } from '../src/games/sigilfall/data/types';
import { SIGILS } from '../src/games/sigilfall/progress/character';
import { DEFAULT_SETTINGS, validateCharacter } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import { World } from '../src/games/sigilfall/sim/world';
import { play, readyHero } from './sigilfall-bot';

function stoneRun(region: RegionId, key: number, affixes: KeyAffix[] = [], cls: 'warrior' | 'mage' = 'warrior'): World {
  const hero = readyHero(cls, 60, 'epic');
  for (const s of SIGILS) if (!hero.perks.includes(s)) hero.perks.push(s);
  hero.keystone = key;
  hero.potions = 5;
  return new World({ region, tier: 2, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed: 1, key, affixes });
}

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/** Into a room by its floor id: the hero stands in it, its fight begins. */
function enterRoom(w: World, id: string): number {
  const enc = w.encounters.findIndex((e) => e.def.id === id);
  const tile = w.map.roomTiles[enc]!.find((i) => !w.map.solid[i])!;
  w.player.x = ((tile % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(tile / w.map.w) + 0.5) * TILE;
  w.step(1 / 60);
  return enc;
}

/** Straight to the last boss and down it goes: the run ends at the clock's reading. */
function finish(w: World, at: number, deaths = 0): void {
  const last = [...w.encounters].reverse().find((e) => !!e.def.boss)!;
  enterRoom(w, last.def.id);
  w.keyRun!.t = at;
  w.keyRun!.deaths = deaths;
  const boss = w.boss()!;
  hitEnemy(w, boss, boss.hp * 1000, 'physical', { depth: 1 });
  for (let i = 0; i < 180 && !w.cleared; i++) {
    w.player.iframe = 99;
    w.step(1 / 60);
  }
  expect(w.cleared).toBe(true);
}

describe('sigilfall: Riftstones', () => {
  it('a stone grows tougher without end; affixes join at +2, +4, +7 and +10 and change with the week', () => {
    for (let k = KEY_MIN; k < 30; k++) {
      expect(keyScale(k + 1).hp).toBeGreaterThan(keyScale(k).hp);
      expect(keyScale(k + 1).dmg).toBeGreaterThan(keyScale(k).dmg);
    }
    expect(keyAffixes(2, 0)).toHaveLength(1);
    expect(keyAffixes(4, 0)).toHaveLength(2);
    expect(keyAffixes(7, 0)).toHaveLength(3);
    expect(keyAffixes(10, 0)).toEqual(expect.arrayContaining(['fortified', 'tyrannical']));
    expect(keyAffixes(10, 0)).toHaveLength(4);
    // the +4 affix is different every week for four weeks
    expect(new Set([0, 1, 2, 3].map((wk) => weekAffixes(wk).find((a) => a.at === 4)!.affix)).size).toBe(4);
    // in time by how much: up to three levels; late: one down
    expect(keyUpgrade(50, 100)).toBe(3);
    expect(keyUpgrade(75, 100)).toBe(2);
    expect(keyUpgrade(99, 100)).toBe(1);
    expect(keyUpgrade(101, 100)).toBe(-1);
  });

  it('a stone run is fought at level 60, tougher than Mythic levels play at, and harder with the stone', () => {
    const lo = stoneRun('deepforge-halls', 2);
    const hi = stoneRun('deepforge-halls', 8);
    expect(lo.level).toBe(KEY_LEVEL);
    expect(lo.keyRun!.par).toBe(keyPar(REGIONS['deepforge-halls']));
    const a = lo.addEnemy('skeleton', 100, 100, KEY_LEVEL, { room: -1, pack: -1 });
    const b = hi.addEnemy('skeleton', 100, 100, KEY_LEVEL, { room: -1, pack: -1 });
    expect(b.maxHp / a.maxHp).toBeCloseTo(keyScale(8).hp / keyScale(2).hp, 2);
    expect(b.dmg / a.dmg).toBeCloseTo(keyScale(8).dmg / keyScale(2).dmg, 2);
    // Fortified toughens all but bosses; Tyrannical only bosses
    const fort = stoneRun('deepforge-halls', 2, ['fortified']);
    expect(fort.addEnemy('skeleton', 100, 100, KEY_LEVEL, { room: -1, pack: -1 }).maxHp / a.maxHp).toBeCloseTo(1.3, 1);
    const tyr = stoneRun('deepforge-halls', 2, ['tyrannical']);
    expect(tyr.addEnemy('skeleton', 100, 100, KEY_LEVEL, { room: -1, pack: -1 }).maxHp).toBe(a.maxHp);
    // not a dungeon: no stone
    expect(stoneRun('grimward', 5).keyRun).toBeNull();
  });

  it('in time the stone grows (and the best is kept); late it shrinks, never below +2; deaths cost time', () => {
    const fast = stoneRun('siege-of-highwall', 5);
    const par = fast.keyRun!.par;
    finish(fast, par * 0.5);
    expect(fast.keyRun!.end!.up).toBe(3);
    expect(fast.hero.keystone).toBe(8);
    expect(fast.hero.bestKeys['siege-of-highwall']).toBe(5);
    // the deaths push a run that was just in time out of it
    const slow = stoneRun('siege-of-highwall', 5);
    finish(slow, par - 25, 3);
    // (the clock runs on through the boss's last two seconds)
    expect(slow.keyRun!.end!.time - (par - 25 + 3 * KEY_DEATH)).toBeGreaterThanOrEqual(0);
    expect(slow.keyRun!.end!.time - (par - 25 + 3 * KEY_DEATH)).toBeLessThan(3);
    expect(slow.keyRun!.end!.up).toBe(-1);
    expect(slow.hero.keystone).toBe(4);
    expect(slow.hero.bestKeys['siege-of-highwall']).toBeUndefined();
    const floor = stoneRun('siege-of-highwall', KEY_MIN);
    finish(floor, par * 2);
    expect(floor.hero.keystone).toBe(KEY_MIN);
    // Sigil Marks either way, more in time
    expect(fast.keyRun!.end!.marks).toBeGreaterThan(slow.keyRun!.end!.marks);
  });

  it('a falling hero costs the clock ten seconds', () => {
    const w = stoneRun('crypt', 3);
    w.playerDies();
    expect(w.keyRun!.deaths).toBe(1);
  });

  it('the affixes: Bolstering, Bursting, Sanguine and Raging', () => {
    const w = stoneRun('deepforge-halls', 6, ['bolstering', 'bursting', 'sanguine', 'raging']);
    const room = 5;
    const [a, b, c] = [0, 1, 2].map((i) => w.addEnemy('skeleton', w.player.x + 40 + i * 12, w.player.y, KEY_LEVEL, { room, pack: -1 }));
    for (const e of [a!, b!, c!]) e.room = room;
    const before = b!.maxHp;
    hitEnemy(w, a!, a!.hp * 10, 'physical', { depth: 1 });
    w.step(1 / 60);
    // Bolstering: the others grow stronger
    expect(b!.maxHp).toBeGreaterThan(before * 1.1);
    // Bursting: the hero bleeds
    expect(w.player.statuses.some((s) => s.id === 'bleed')).toBe(true);
    // Sanguine: a hurt enemy in the blood is healed
    c!.x = a!.x;
    c!.y = a!.y;
    c!.hp = c!.maxHp * 0.5;
    for (let i = 0; i < 60; i++) {
      w.player.iframe = 99;
      w.step(1 / 60);
    }
    expect(c!.hp).toBeGreaterThan(c!.maxHp * 0.5);
    // Raging: below 30% an enemy rages
    const dmg = b!.dmg;
    b!.hp = b!.maxHp * 0.2;
    w.step(1 / 60);
    expect(b!.dmg).toBeCloseTo(dmg * 1.5, 3);
  });

  it('a Riftstone and the best stones survive a save', () => {
    const hero = readyHero('mage', 60, 'rare');
    hero.keystone = 9;
    hero.bestKeys = { 'tomb-of-the-sun-king': 8 };
    const back = validateCharacter(JSON.parse(JSON.stringify(hero)), 0)!;
    expect(back.keystone).toBe(9);
    expect(back.bestKeys).toEqual({ 'tomb-of-the-sun-king': 8 });
  });

  for (const region of ['barrow-of-kings', 'rimeheld-vault'] as const) {
    it(`a level-60 hero in good gear beats the clock on a +2 stone of ${region}`, { timeout: 60_000 }, () => {
      const w = stoneRun(region, 2, keyAffixes(2, 0));
      const r = play(w, { seconds: 2400, done: (x) => x.cleared, goal: nextRoom, maxDeaths: 3 });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(w.keyRun!.end!.up).toBeGreaterThan(0);
      expect(w.hero.keystone).toBeGreaterThan(2);
    });
  }
});

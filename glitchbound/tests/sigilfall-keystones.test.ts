/**
 * Riftstone (data/keystones.ts) and Paragon levels (progress/paragon.ts), the endgame: any dungeon at Mythic's
 * top level, tougher with every level, with the week's affixes, against the clock. Beaten in time, the next
 * levels open (as in Diablo's rifts; nothing is lost by being late). Experience past 60 earns Paragon points.
 */
import { describe, expect, it } from 'vitest';
import { heroDamage, MAX_LEVEL } from '../src/games/sigilfall/data/classes';
import { KEY_DEATH, KEY_LEVEL, KEY_MIN, keyAffixes, keyLoot, keyPar, keyScale, keyUpgrade, MAX_IL, weekAffixes, type KeyAffix } from '../src/games/sigilfall/data/keystones';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import { SLOTS, type ClassId, type RegionId } from '../src/games/sigilfall/data/types';
import { rng } from '../src/games/sigilfall/core/math';
import { buildHero } from '../src/games/sigilfall/progress/build';
import { SIGILS } from '../src/games/sigilfall/progress/character';
import { rollGear } from '../src/games/sigilfall/progress/items';
import { addParagonXp, PARA_CAP, paragonFree, paragonXp, resetParagon, spendParagon, validateParagon } from '../src/games/sigilfall/progress/paragon';
import { DEFAULT_SETTINGS, validateCharacter, validateItem } from '../src/games/sigilfall/progress/save';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { TILE } from '../src/games/sigilfall/sim/map';
import { emptyInput, World } from '../src/games/sigilfall/sim/world';
import { newWorld, play, readyHero } from './sigilfall-bot';

const DUNGEONS = (Object.keys(REGIONS) as RegionId[]).filter((id) => REGIONS[id].kind === 'dungeon' && !REGIONS[id].interior);

/** A level-60 hero after the story, in Mythic gear (item level 72), holding a stone up to `top`. */
function endgameHero(cls: ClassId = 'warrior', top = 1) {
  const hero = readyHero(cls, 60, 'epic');
  const r = rng(11);
  for (const s of SLOTS) hero.equip[s] = rollGear(cls, KEY_LEVEL, 'epic', r, s);
  for (const s of SIGILS) if (!hero.perks.includes(s)) hero.perks.push(s);
  for (const id of Object.keys(QUEST_DEFS)) hero.quests[id] = { state: 'done', n: 0 };
  hero.keystone = top;
  hero.potions = 5;
  return hero;
}

function keyRun(region: RegionId, key: number, affixes: KeyAffix[] = [], top = key, cls: ClassId = 'warrior'): World {
  return new World({ region, tier: 2, mods: [], hero: endgameHero(cls, top), settings: { ...DEFAULT_SETTINGS }, seed: 1, key, affixes, handIns: false });
}

/** The middle of the first room not fought yet (the bot's route through a dungeon). */
function nextRoom(w: World): { x: number; y: number } | null {
  const enc = w.encounters.find((e) => e.state === 'idle');
  if (!enc) return null;
  const tiles = (w.map.roomTiles[enc.index] ?? []).filter((i) => !w.map.solid[i]);
  const i = tiles[Math.floor(tiles.length / 2)];
  return i === undefined ? null : { x: ((i % w.map.w) + 0.5) * TILE, y: (Math.floor(i / w.map.w) + 0.5) * TILE };
}

/** Straight to the last boss and down it goes: the run ends at the clock's reading. */
function finish(w: World, at: number, deaths = 0): void {
  const last = [...w.encounters].reverse().find((e) => !!e.def.boss)!;
  const tile = w.map.roomTiles[last.index]!.find((i) => !w.map.solid[i])!;
  w.player.x = ((tile % w.map.w) + 0.5) * TILE;
  w.player.y = (Math.floor(tile / w.map.w) + 0.5) * TILE;
  w.step(1 / 60);
  w.keyRun!.t = at;
  w.keyRun!.deaths = deaths;
  for (let i = 0; i < 240 && !w.cleared; i++) {
    const boss = w.boss();
    if (boss) hitEnemy(w, boss, boss.hp * 1000, 'physical', { depth: 1 });
    w.player.iframe = 99;
    w.step(1 / 60);
  }
  expect(w.cleared).toBe(true);
}

describe('sigilfall: Riftstone', () => {
  it('every level is tougher, without end; affixes join at +2, +4, +7 and +10 and change with the week', () => {
    for (let k = KEY_MIN; k < 40; k++) {
      expect(keyScale(k + 1).hp).toBeGreaterThan(keyScale(k).hp);
      expect(keyScale(k + 1).dmg).toBeGreaterThan(keyScale(k).dmg);
    }
    // +1 is already past Mythic
    expect(keyScale(1).hp).toBeGreaterThan(4);
    expect(keyAffixes(1, 0)).toHaveLength(0);
    expect(keyAffixes(2, 0)).toHaveLength(1);
    expect(keyAffixes(4, 0)).toHaveLength(2);
    expect(keyAffixes(7, 0)).toHaveLength(3);
    expect(keyAffixes(10, 0)).toEqual(expect.arrayContaining(['fortified', 'tyrannical']));
    expect(keyAffixes(10, 0)).toHaveLength(4);
    expect(new Set([0, 1, 2, 3].map((wk) => weekAffixes(wk).find((a) => a.at === 4)!.affix)).size).toBe(4);
    expect(keyUpgrade(50, 100)).toBe(3);
    expect(keyUpgrade(75, 100)).toBe(2);
    expect(keyUpgrade(99, 100)).toBe(1);
    expect(keyUpgrade(101, 100)).toBe(-1);
    // loot climbs a level a level, to the most an item can be
    expect(keyLoot(1)).toBe(KEY_LEVEL + 1);
    expect(keyLoot(500)).toBe(MAX_IL);
    // every dungeon has a clock
    for (const id of DUNGEONS) expect(keyPar(REGIONS[id]), id).toBeGreaterThanOrEqual(180);
  });

  it('a run is fought at Mythic’s top level, harder with the level; Hardened and Crowned do as they say', () => {
    const lo = keyRun('deepforge-halls', 1);
    const hi = keyRun('deepforge-halls', 8);
    expect(lo.level).toBe(KEY_LEVEL);
    expect(lo.tier).toBe(2);
    expect(lo.keyRun!.par).toBe(keyPar(REGIONS['deepforge-halls']));
    const a = lo.addEnemy('skeleton', 100, 100, KEY_LEVEL, { room: -1, pack: -1 });
    const b = hi.addEnemy('skeleton', 100, 100, KEY_LEVEL, { room: -1, pack: -1 });
    expect(b.maxHp / a.maxHp).toBeCloseTo(keyScale(8).hp / keyScale(1).hp, 2);
    expect(b.dmg / a.dmg).toBeCloseTo(keyScale(8).dmg / keyScale(1).dmg, 2);
    // harder than the same dungeon on Mythic, in the measure its clock was set in: a Riftstone run matches its foes'
    // health to the hero's halved blows (data/classes.ts HERO_DAMAGE, sim/world.ts ownMeasure), the campaign does not
    const mythic = newWorld('deepforge-halls', endgameHero(), 1, 2);
    expect(a.maxHp / heroDamage(60)).toBeGreaterThan(mythic.addEnemy('skeleton', 100, 100, KEY_LEVEL, { room: -1, pack: -1 }).maxHp);
    const fort = keyRun('deepforge-halls', 2, ['fortified']);
    expect(fort.addEnemy('skeleton', 100, 100, KEY_LEVEL, { room: -1, pack: -1 }).maxHp / (a.maxHp * (keyScale(2).hp / keyScale(1).hp))).toBeCloseTo(1.3, 1);
    const tyr = keyRun('deepforge-halls', 1, ['tyrannical']);
    expect(tyr.addEnemy('skeleton', 100, 100, KEY_LEVEL, { room: -1, pack: -1 }).maxHp).toBe(a.maxHp);
    // only dungeons
    expect(keyRun('whisperwood', 5).keyRun).toBeNull();
  });

  it('beaten in time the next levels open and the best is kept; late, nothing is lost; falls cost the clock', () => {
    const fast = keyRun('siege-of-highwall', 5);
    const par = fast.keyRun!.par;
    finish(fast, par * 0.5);
    expect(fast.keyRun!.end!.up).toBe(3);
    expect(fast.hero.keystone).toBe(8);
    expect(fast.hero.bestKeys['siege-of-highwall']).toBe(5);
    expect(fast.keyRun!.end!.best).toBe(true);
    // falls push a run that was just in time out of it, and a late run takes nothing away
    const slow = keyRun('siege-of-highwall', 5);
    finish(slow, par - 25, 3);
    expect(slow.keyRun!.end!.time - (par - 25 + 3 * KEY_DEATH)).toBeGreaterThanOrEqual(0);
    expect(slow.keyRun!.end!.time - (par - 25 + 3 * KEY_DEATH)).toBeLessThan(4);
    expect(slow.keyRun!.end!.up).toBe(-1);
    expect(slow.hero.keystone).toBe(5);
    expect(slow.hero.bestKeys['siege-of-highwall']).toBeUndefined();
    // a lower level run in time for practice never lowers the highest one open
    const low = keyRun('siege-of-highwall', 2, [], 9);
    finish(low, par * 0.9);
    expect(low.hero.keystone).toBe(9);
    // Sigil Marks either way, more in time
    expect(fast.keyRun!.end!.marks).toBeGreaterThan(slow.keyRun!.end!.marks);
    // a fall during the run
    const w = keyRun('crypt', 3);
    w.playerDies();
    expect(w.keyRun!.deaths).toBe(1);
  });

  it('the clock waits for the hero to set off: not while the land loads and the run is read', () => {
    const w = keyRun('crypt', 1);
    for (let i = 0; i < 300; i++) w.step(1 / 60);
    expect(w.keyRun!.t).toBe(0);
    w.input = { ...emptyInput(), mx: 1 };
    w.step(1 / 60);
    w.input = emptyInput();
    for (let i = 0; i < 59; i++) w.step(1 / 60);
    expect(w.keyRun!.t).toBeCloseTo(1, 1);
  });

  it('the Riftstone comes from the Riftward\'s quest after the story; a hero who already had is given one on load', () => {
    expect(QUEST_DEFS['postgame-the-riftward']!.reward.keystone).toBe(1);
    expect(QUEST_DEFS['postgame-the-riftward']!.opens).toBe('riftward');
    const hero = readyHero('mage', 60, 'rare');
    expect(hero.keystone).toBe(0);
    hero.quests['postgame-crownfall-mythic'] = { state: 'done', n: 1 };
    const back = validateCharacter(JSON.parse(JSON.stringify(hero)), 0)!;
    expect(back.keystone).toBe(KEY_MIN);
  });

  it('the affixes: Grieving, Splintering, Festering and Cornered', () => {
    const w = keyRun('deepforge-halls', 6, ['bolstering', 'bursting', 'sanguine', 'raging']);
    const room = 5;
    const [a, b, c] = [0, 1, 2].map((i) => w.addEnemy('skeleton', w.player.x + 40 + i * 12, w.player.y, KEY_LEVEL, { room, pack: -1 }));
    for (const e of [a!, b!, c!]) e.room = room;
    const before = b!.maxHp;
    hitEnemy(w, a!, a!.hp * 10, 'physical', { depth: 1 });
    w.step(1 / 60);
    expect(b!.maxHp).toBeGreaterThan(before * 1.1);
    expect(w.player.statuses.some((s) => s.id === 'bleed')).toBe(true);
    c!.x = a!.x;
    c!.y = a!.y;
    c!.hp = c!.maxHp * 0.5;
    for (let i = 0; i < 60; i++) {
      w.player.iframe = 99;
      w.step(1 / 60);
    }
    expect(c!.hp).toBeGreaterThan(c!.maxHp * 0.5);
    const dmg = b!.dmg;
    b!.hp = b!.maxHp * 0.2;
    w.step(1 / 60);
    expect(b!.dmg).toBeCloseTo(dmg * 1.5, 3);
  });

  it('the stone, the best levels, Paragon and item levels past 70 survive a save', () => {
    const hero = endgameHero('mage', 9);
    hero.bestKeys = { 'tomb-of-the-sun-king': 8 };
    hero.para = { l: 12, x: 400, p: { might: 6, vigor: 4, precision: 0, toughness: 1 } };
    hero.bag.push(rollGear('mage', 84, 'rare', rng(3), 'weapon'));
    const back = validateCharacter(JSON.parse(JSON.stringify(hero)), 0)!;
    expect(back.keystone).toBe(9);
    expect(back.bestKeys).toEqual({ 'tomb-of-the-sun-king': 8 });
    expect(back.para).toEqual(hero.para);
    expect(back.bag.at(-1)!.il).toBe(84);
    expect(validateItem({ ...hero.bag.at(-1)!, il: 400 })!.il).toBe(MAX_IL);
  });

  for (const region of ['crypt', 'deepforge-halls'] as const) {
    it(`a level-60 hero in Mythic gear beats the clock on Riftstone +1 of ${region}`, { timeout: 90_000 }, () => {
      const w = keyRun(region, 1);
      const r = play(w, { seconds: 1500, done: (x) => x.cleared, goal: nextRoom, maxDeaths: 3 });
      expect(r.stuck).toBe(false);
      expect(w.cleared).toBe(true);
      expect(w.keyRun!.end!.up).toBeGreaterThan(0);
      expect(w.hero.keystone).toBeGreaterThan(1);
      // the cache and the boss pay at the level's item level
      expect([...w.run.items, ...w.drops.flatMap((d) => (d.item ? [d.item] : []))].some((it) => it.il === KEY_LEVEL + 1)).toBe(true);
    });
  }
});

describe('sigilfall: Paragon', () => {
  it('experience past 60 earns Paragon levels; points go into four lines, two of them capped, and come back free', () => {
    const p = validateParagon(null);
    expect(addParagonXp(p, paragonXp(0) - 1)).toEqual([]);
    expect(addParagonXp(p, 1 + paragonXp(1) + paragonXp(2))).toEqual([1, 2, 3]);
    expect(paragonFree(p)).toBe(3);
    expect(spendParagon(p, 'might', 2)).toBe(true);
    expect(spendParagon(p, 'vigor', 5)).toBe(true);
    expect(p.p.vigor).toBe(1);
    expect(spendParagon(p, 'might')).toBe(false);
    p.l = 200;
    spendParagon(p, 'precision', 999);
    expect(p.p.precision).toBe(PARA_CAP);
    resetParagon(p);
    expect(paragonFree(p)).toBe(200);
    // a save never holds more points than earned
    expect(validateParagon({ l: 3, x: 0, p: { might: 9 } }).p.might).toBe(0);
  });

  it('the world sends a level-60 hero’s experience to Paragon, and spent points make the hero stronger', () => {
    const hero = endgameHero();
    expect(hero.level).toBe(MAX_LEVEL);
    const w = newWorld('crypt', hero, 1, 2);
    const events: string[] = [];
    w.giveXp(paragonXp(0) * 1.5);
    for (const e of w.events) events.push(e.t);
    expect(hero.para.l).toBe(1);
    expect(events).toContain('paragon');
    const before = buildHero(hero);
    hero.para.l = 40;
    spendParagon(hero.para, 'might', 20);
    spendParagon(hero.para, 'vigor', 20);
    const after = buildHero(hero);
    expect(after.stats.power - before.stats.power).toBeCloseTo(20, 5);
    expect(after.maxHp).toBeGreaterThan(before.maxHp);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { CLASSES } from '../src/games/sigilfall/data/classes';
import { ITEM_DEFS } from '../src/games/sigilfall/data/items';
import { SETS } from '../src/games/sigilfall/data/riftgear';
import { BLESSINGS, BOONS, ECHO_EVERY, HUNT_MAX, HUNTER_HP, KINSHIP_EXTRA, SEASON_LOOP, seasonDef, SHRINE_IDS, SHRINES_PER_RUN, STREAK_DMG, STREAK_MAX, STREAK_TIME, STREAK_TIME_EVERY, STREAK_WINDOW, type SeasonMechanic } from '../src/games/sigilfall/data/seasons';
import type { Item } from '../src/games/sigilfall/data/types';
import { collectMods } from '../src/games/sigilfall/progress/build';
import type { Character } from '../src/games/sigilfall/progress/character';
import { itemMods, itemSlot, makeItem } from '../src/games/sigilfall/progress/items';
import { DEFAULT_SETTINGS, emptySave, migrate } from '../src/games/sigilfall/progress/save';
import { blessingsLit, chooseBorrowed, chooseTwin, ensureSeason, journeyOf, lendable, offerAltar, seasonMods, seasonOf, seasonRunEnd, twinSkills } from '../src/games/sigilfall/progress/season';
import { hitEnemy } from '../src/games/sigilfall/sim/combat';
import { boonRunEnd, seasonBossDown, seasonCast, seasonKill, takeBoon } from '../src/games/sigilfall/sim/season';
import type { Enemy } from '../src/games/sigilfall/sim/types';
import { World } from '../src/games/sigilfall/sim/world';
import { readyHero } from './sigilfall-bot';

/**
 * The Rift seasons' powers, Season 2 to 10 (the owner, 2026-11-23: "lets implement every single season and we can just
 * swap them every month"): each works in a Riftstone run of its own month and nowhere else, does what its keeper says,
 * and counts for the Journey's first chapter. (The Season of Hearts is sigilfall-seasons.test.ts's.)
 */

const DT = 1 / 60;
/** The season number of a mechanic in the first turn of the loop. */
const N = (m: SeasonMechanic): number => SEASON_LOOP.findIndex((d) => d.mechanic === m) + 1;
const run = (c: Character, season: number, key = 5) =>
  new World({ region: 'crypt', tier: 2, mods: [], hero: c, settings: { ...DEFAULT_SETTINGS }, seed: 3, ...(key ? { key, affixes: [] } : {}), handIns: false, ...(season ? { season } : {}) });
/** A run, its season started (the first step). */
const started = (c: Character, season: number) => {
  const w = run(c, season);
  w.step(DT);
  return w;
};
const plain = { hunter: false } as unknown as Enemy;
const firstGoal = (c: Character, n: number) => journeyOf(c, n)[0]!.goals.find((g) => g.id === 'mechanic')!;

/** Gear from a set, put on the hero: the first `count` pieces. */
function wearSet(c: Character, set: string, count: number): void {
  for (const id of SETS[set]!.pieces.slice(0, count)) {
    const it = makeItem(id, 60)!;
    c.equip[itemSlot(it)] = it;
  }
}

describe('Sigilfall: every Rift season is built', () => {
  it('builds all ten, each with a first Journey goal of its own', () => {
    expect(SEASON_LOOP.every((d) => d.built)).toBe(true);
    expect(new Set(SEASON_LOOP.map((d) => d.goal)).size).toBe(10);
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    for (let n = 1; n <= 10; n++) expect(firstGoal(c, n).text).toBe(seasonDef(n).goal);
  });
});

describe('Sigilfall: the Season of Shrines', () => {
  const n = N('shrines');

  it('raises two shrines of different powers in a run, one early and one late', () => {
    const w = started(readyHero('warrior', 60, 'epic', 5, 0), n);
    const sh = w.seasonRun!.shrines;
    expect(sh).toHaveLength(SHRINES_PER_RUN);
    expect(new Set(sh.map((s) => s.kind)).size).toBe(SHRINES_PER_RUN);
    for (const s of sh) expect(SHRINE_IDS).toContain(s.kind);
    // not in another season's run, nor out of a run
    expect(started(readyHero('warrior', 60, 'epic', 5, 0), N('boons')).seasonRun!.shrines).toEqual([]);
    expect(run(readyHero('warrior', 60, 'epic', 5, 0), n, 0).seasonRun).toBeNull();
  });

  it('gives its power to a hero who walks through it, once, and counts it for the Journey', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    const w = started(c, n);
    const s = w.seasonRun!.shrines[0]!;
    expect(firstGoal(c, n).done).toBe(false);
    w.player.x = s.x;
    w.player.y = s.y;
    w.step(DT);
    expect(s.taken).toBe(true);
    expect(w.player.buffs.some((b) => b.def.id === `shrine-${s.kind}`)).toBe(true);
    expect(seasonOf(c, n).shrines).toBe(1);
    expect(firstGoal(c, n).done).toBe(true);
    w.step(DT);
    expect(seasonOf(c, n).shrines).toBe(1);
  });

  it('makes the Shrine of Might double every blow', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    const blow = (might: boolean) => {
      const w = started(c, n);
      if (might) {
        const s = w.seasonRun!.shrines[0]!;
        s.kind = 'might';
        w.player.x = s.x;
        w.player.y = s.y;
        w.step(DT);
      }
      const e = w.addEnemy('skeleton', w.player.x + 30, w.player.y, 60, { elite: false, room: -1, pack: 0, spawn: false });
      e.hp = e.maxHp = 1e9;
      // (no crit, for a blow the same both times)
      w.rand = () => 0.999;
      return hitEnemy(w, e, 100, 'physical', { depth: 1 });
    };
    const base = blow(false);
    expect(Math.abs(blow(true) - base * 2)).toBeLessThanOrEqual(2);
  });
});

describe('Sigilfall: the Season of Kinship', () => {
  const n = N('kinship');
  const set = Object.values(SETS).find((x) => x.cls === 'warrior' && x.bonuses.some((b) => b.need === 6))!;
  const six = set.bonuses.find((b) => b.need === 6)!;

  it('counts four pieces of a set as six, and two as four, in a run of its month', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    wearSet(c, set.id, 4);
    const has = (mods: ReturnType<typeof collectMods>) => six.mods.every((m) => mods.some((e) => e.mod === m));
    expect(has(collectMods(c))).toBe(false);
    expect(has(collectMods(c, KINSHIP_EXTRA))).toBe(true);
    expect(run(c, n).seasonShape.sets).toBe(KINSHIP_EXTRA);
    expect(run(c, N('boons')).seasonShape.sets ?? 0).toBe(0);
    expect(run(c, n, 0).seasonShape.sets ?? 0).toBe(0);
    // one piece alone is no set, and six stay six
    const one = readyHero('warrior', 60, 'epic', 5, 0);
    wearSet(one, set.id, 1);
    const four = set.bonuses.find((b) => b.need === 4)!;
    expect(four.mods.every((m) => collectMods(one, KINSHIP_EXTRA).some((e) => e.mod === m))).toBe(false);
  });

  it('is felt the moment a run starts with a set it makes bigger', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    started(c, n);
    expect(firstGoal(c, n).done).toBe(false);
    wearSet(c, set.id, 2);
    started(c, n);
    expect(firstGoal(c, n).done).toBe(true);
  });
});

describe('Sigilfall: the Season of Borrowed Legends', () => {
  const n = N('borrowed');
  const legend = (c: Character): Item => {
    const def = Object.values(ITEM_DEFS).find((d) => d.rarity === 'legendary' && d.cls === c.cls && d.mods.length > 0 && !d.set)!;
    return makeItem(def.id, 60)!;
  };

  it('lends a carried legendary’s power to the runs of its month, as if worn', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    const it = legend(c);
    c.bag.push(it);
    expect(lendable(c).map((x) => x.uid)).toContain(it.uid);
    expect(chooseBorrowed(c, n, it.uid)).toBe(true);
    expect(firstGoal(c, n).done).toBe(true);
    expect(seasonMods(c, n)).toEqual(itemMods(it));
    expect(seasonMods(c, N('shrines'))).toEqual([]);
    expect(chooseBorrowed(c, N('shrines'), it.uid)).toBe(false);
  });

  it('lends nothing twice: a legend worn gives its power once, and another calling’s is not lent', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    const it = legend(c);
    c.equip[itemSlot(it)] = it;
    expect(chooseBorrowed(c, n, it.uid)).toBe(true);
    expect(seasonMods(c, n)).toEqual([]);
    const other = legend(readyHero('mage', 60, 'epic', 5, 0));
    c.bag.push(other);
    expect(chooseBorrowed(c, n, other.uid)).toBe(false);
    expect(chooseBorrowed(c, n, 'no-such-piece')).toBe(false);
  });
});

describe('Sigilfall: the Season of Boons', () => {
  const n = N('boons');

  it('offers three different boons after a boss, and the run waits for the choice', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    const w = started(c, n);
    w.keyRun!.going = true;
    seasonBossDown(w);
    const offer = w.seasonRun!.offer!;
    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    const t = w.keyRun!.t;
    for (let i = 0; i < 60; i++) w.step(DT);
    expect(w.keyRun!.t).toBe(t);
    expect(takeBoon(w, 1)).toBe(true);
    expect(w.seasonRun!.boons).toEqual([offer[1]]);
    expect(w.seasonRun!.offer).toBeNull();
    expect(seasonOf(c, n).boons).toBe(1);
    expect(firstGoal(c, n).done).toBe(true);
    w.step(DT);
    expect(w.keyRun!.t).toBeGreaterThan(t);
    // a boon taken is never offered again in the run
    seasonBossDown(w);
    expect(w.seasonRun!.offer).not.toContain(offer[1]);
  });

  it('makes each boon do what it says: harder blows, a second wind, a richer cache', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    const w = started(c, n);
    const dmg = w.build.skills['heavy-strike']!.spec.damage;
    w.seasonRun!.offer = ['wrath', 'second-wind', 'fortune'];
    takeBoon(w, 0);
    expect(w.build.skills['heavy-strike']!.spec.damage).toBeGreaterThan(dmg * 1.35);
    w.seasonRun!.offer = ['second-wind', 'fortune', 'keen-edge'];
    takeBoon(w, 0);
    w.player.hp = 0;
    w.playerDies();
    expect(w.player.dead).toBeFalsy();
    expect(w.player.hp).toBe(Math.round(w.player.maxHp / 2));
    expect(w.seasonRun!.revive).toBe(false);
    w.seasonRun!.offer = ['fortune', 'keen-edge', 'overcharge'];
    takeBoon(w, 0);
    expect(boonRunEnd(w)).toEqual({ cache: 2, marks: 25 });
    for (const b of BOONS) expect(b.mods?.length || b.special, b.id).toBeTruthy();
  });

  it('lets a run with no one to choose take the first', () => {
    const w = started(readyHero('warrior', 60, 'epic', 5, 0), n);
    w.autoBoons = true;
    seasonBossDown(w);
    expect(w.seasonRun!.offer).toBeNull();
    expect(w.seasonRun!.boons).toHaveLength(1);
  });
});

describe('Sigilfall: the Season of Offerings', () => {
  const n = N('altar');

  it('lights the blessings in order for their Sigil Marks', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    c.marks = 85;
    expect(offerAltar(c, n)).toBe(true);
    expect(offerAltar(c, n)).toBe(true);
    expect(c.marks).toBe(85 - BLESSINGS[0]!.cost - BLESSINGS[1]!.cost);
    // forty are needed for the third, and there are thirty-five
    expect(offerAltar(c, n)).toBe(false);
    expect(seasonOf(c, n).altar).toBe(2);
    expect(firstGoal(c, n).done).toBe(true);
    expect(offerAltar(c, N('shrines'))).toBe(false);
    expect(blessingsLit(c, n)).toHaveLength(2);
    expect(seasonMods(c, n).length).toBe(2);
  });

  it('with all ten lit: harder blows, more health, a fuller cache, more marks, a longer clock and a stone more', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    c.marks = 10_000;
    for (let i = 0; i < 12; i++) offerAltar(c, n);
    expect(seasonOf(c, n).altar).toBe(10);
    expect(c.marks).toBe(10_000 - BLESSINGS.reduce((a, b) => a + b.cost, 0));
    expect(seasonRunEnd(c, n)).toEqual({ marks: 25, cache: 2, up: 1, clock: 5 });
    const par = started(readyHero('warrior', 60, 'epic', 5, 0), n).keyRun!.par;
    expect(started(c, n).keyRun!.par).toBe(Math.round(par * 1.05));
    expect(run(c, n).build.maxHp).toBeGreaterThan(run(c, n, 0).build.maxHp);
  });
});

describe('Sigilfall: the Season of Bloodlust', () => {
  const n = N('bloodlust');

  it('stacks with every kill in a streak, and the streak ends when the kills do', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    const w = started(c, n);
    for (let i = 0; i < 12; i++) {
      w.time += 0.5;
      seasonKill(w, plain);
    }
    const b = w.player.buffs.find((x) => x.def.id === 'bloodlust')!;
    expect(b.n).toBe(12);
    expect(b.def.dmg).toBe(STREAK_DMG);
    expect(seasonOf(c, n).streak).toBe(12);
    expect(firstGoal(c, n).done).toBe(true);
    for (let i = 0; i < 20; i++) seasonKill(w, plain);
    expect(w.player.buffs.find((x) => x.def.id === 'bloodlust')!.n).toBe(STREAK_MAX);
    w.time += STREAK_WINDOW + 0.5;
    w.step(DT);
    expect(w.seasonRun!.streak.n).toBe(0);
    seasonKill(w, plain);
    expect(w.seasonRun!.streak.n).toBe(1);
  });

  it('buys back the clock with every fiftieth kill in a streak', () => {
    const w = started(readyHero('warrior', 60, 'epic', 5, 0), n);
    w.keyRun!.t = 100;
    for (let i = 0; i < STREAK_TIME_EVERY; i++) seasonKill(w, plain);
    expect(w.keyRun!.t).toBe(100 - STREAK_TIME);
    expect(w.seasonRun!.streak.bought).toBe(STREAK_TIME);
  });
});

describe('Sigilfall: the Season of Twin Paths', () => {
  const n = N('twin');

  it('puts another specialization’s skill on the bar in the runs of its month, and only there', () => {
    const c = readyHero('mage', 60, 'epic', 5, 0);
    const skills = twinSkills(c);
    expect(skills).toHaveLength(2);
    expect(skills).not.toContain(CLASSES.mage.trees[0]!.skill);
    expect(chooseTwin(c, n, skills[0]!, 3)).toBe(true);
    expect(firstGoal(c, n).done).toBe(true);
    const w = run(c, n);
    expect(w.build.bar.s4).toBe(skills[0]);
    expect(w.build.skills[skills[0]!]).toBeTruthy();
    expect(run(c, n, 0).build.bar.s4).toBe(c.skills[3]);
    expect(run(c, N('boons')).build.bar.s4).toBe(c.skills[3]);
  });

  it('takes only another path’s skill, into a slot that is open', () => {
    const c = readyHero('mage', 60, 'epic', 5, 0);
    expect(chooseTwin(c, n, CLASSES.mage.trees[0]!.skill, 0)).toBe(false);
    expect(chooseTwin(c, n, twinSkills(c)[0]!, 4)).toBe(false);
    expect(chooseTwin(c, N('boons'), twinSkills(c)[0]!, 0)).toBe(false);
    // a druid's shapes are not a skill to lend
    const d = readyHero('druid', 60, 'epic', 5, 0);
    for (const id of twinSkills(d)) expect(CLASSES.druid.trees.find((t) => t.skill === id)!.formOnly).toBeFalsy();
    // before a specialization, nothing
    expect(twinSkills(readyHero('mage', 8, 'epic', 5, 0))).toEqual([]);
  });
});

describe('Sigilfall: the Season of the Hunter', () => {
  const n = N('nemesis');

  it('sends the hunter into a run, many times as hard, and beating it is a trophy for the season', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    const w = started(c, n);
    expect(w.seasonRun!.hunter!.state).toBe('waiting');
    w.keyRun!.t = 60;
    for (const e of w.enemies) if (e.boss) e.dead = true;
    w.step(DT);
    expect(w.seasonRun!.hunter!.state).toBe('out');
    const e = w.enemies.find((x) => x.hunter)!;
    expect(e.name).toBe('The Hunter');
    expect(e.elite.length).toBeGreaterThan(0);
    expect(e.maxHp).toBeGreaterThan(HUNTER_HP * 100);
    const drops = w.drops.length;
    seasonKill(w, e);
    expect(w.seasonRun!.hunter!.state).toBe('down');
    expect(seasonOf(c, n).hunted).toBe(1);
    expect(firstGoal(c, n).done).toBe(true);
    expect(w.drops.length).toBe(drops + 2);
    expect(seasonMods(c, n)).toEqual([{ t: 'skill', skill: '*', op: { op: 'damage', pct: 1 } }]);
    ensureSeason(c, n).hunted = 99;
    expect(seasonMods(c, n)).toEqual([{ t: 'skill', skill: '*', op: { op: 'damage', pct: HUNT_MAX } }]);
    expect(seasonMods(c, N('echoes'))).toEqual([]);
  });
});

describe('Sigilfall: the Season of Echoes', () => {
  const n = N('echoes');

  it('sends every fifth skill cast again by itself', () => {
    const c = readyHero('mage', 60, 'epic', 5, 0);
    const w = started(c, n);
    const echo = vi.spyOn(w, 'echo');
    for (let i = 1; i < ECHO_EVERY; i++) seasonCast(w, 's1');
    for (let i = 0; i < 30; i++) w.step(DT);
    expect(echo).not.toHaveBeenCalled();
    seasonCast(w, 's1');
    for (let i = 0; i < 30; i++) w.step(DT);
    expect(echo).toHaveBeenCalledWith(w.build.bar.s1, 1);
    expect(seasonOf(c, n).echoes).toBe(1);
    expect(firstGoal(c, n).done).toBe(true);
    // not in another season's run
    const other = started(readyHero('mage', 60, 'epic', 5, 0), N('boons'));
    for (let i = 0; i < ECHO_EVERY; i++) seasonCast(other, 's1');
    expect(other.seasonRun!.casts).toBe(0);
  });
});

describe('Sigilfall: a season’s choices survive a save', () => {
  it('keeps a borrowed legend, a twin path, the altar and the counts, and drops what makes no sense', () => {
    const save = emptySave();
    const c = readyHero('mage', 60, 'epic', 5, 0);
    const s = ensureSeason(c, N('twin'));
    s.twin = { skill: twinSkills(c)[0]!, slot: 2 };
    s.altar = 4;
    s.hunted = 3;
    s.streak = 21;
    s.shrines = 2;
    s.echoes = 9;
    s.boons = 5;
    s.used = true;
    s.borrowed = 'some-uid';
    save.heroes[0] = c;
    const back = migrate(JSON.parse(JSON.stringify(save)))!.heroes[0]!;
    expect(back.rseason).toMatchObject({ twin: { skill: twinSkills(c)[0], slot: 2 }, altar: 4, hunted: 3, streak: 21, shrines: 2, echoes: 9, boons: 5, used: true, borrowed: 'some-uid' });
    save.heroes[0] = { ...c, rseason: { ...s, twin: { skill: 'no-such-skill', slot: 9 }, altar: 99, hunted: -4 } };
    const bad = migrate(JSON.parse(JSON.stringify(save)))!.heroes[0]!.rseason!;
    expect(bad.twin ?? null).toBeNull();
    expect(bad.altar ?? 0).toBeLessThanOrEqual(BLESSINGS.length);
    expect(bad.hunted ?? 0).toBeGreaterThanOrEqual(0);
  });
});

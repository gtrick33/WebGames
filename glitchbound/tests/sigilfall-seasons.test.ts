import { describe, expect, it } from 'vitest';
import { boardOf } from '../functions/api/sigilfall/ranks';
import { MOUNT_DEFS } from '../src/games/sigilfall/data/mounts';
import { SETS } from '../src/games/sigilfall/data/riftgear';
import { greedCache, heartRank, HEART_IDS, HEARTS, JOURNEY, nextSeasonAt, SEASON_EPOCH, SEASON_LOOP, seasonAt, seasonDef } from '../src/games/sigilfall/data/seasons';
import { dressSeasonKeeper, RIFTWARD, RIFTWARD_NPCS } from '../src/games/sigilfall/data/zones/riftward';
import { ITEM_DEFS } from '../src/games/sigilfall/data/items';
import { bagSize } from '../src/games/sigilfall/progress/character';
import { rankEntries } from '../src/games/sigilfall/progress/ranks';
import { emptySave, migrate } from '../src/games/sigilfall/progress/save';
import { chooseHeart, claimChapter, ensureSeason, greedOf, heartOf, journeyOf, journeySets, recordRun, seasonMods, seasonOf } from '../src/games/sigilfall/progress/season';
import { TITLES } from '../src/games/sigilfall/progress/titles';
import { FIRST_RIDE, mountEarned } from '../src/games/sigilfall/progress/wardrobe';
import { DEFAULT_SETTINGS } from '../src/games/sigilfall/progress/save';
import { World } from '../src/games/sigilfall/sim/world';
import { readyHero } from './sigilfall-bot';

/**
 * The Rift's seasons (the owner, 2026-11-23: "a content for 10 seasons that rotates each season ... just for the
 * endgame ... similar to diablo we want mechanics per season that are unique and can boost rift progression", made
 * simple for a phone, Season 1 the Season of Hearts, turning on the first of each month): the calendar, the heart and
 * where it works, the Journey and what it gives, the ladder's boards, and the keeper in the Riftward.
 */

const DEC_2026 = Date.UTC(2026, 11, 15);

describe('Sigilfall: the Rift season calendar', () => {
  it('has ten seasons that take turns, a month each, from 1 December 2026', () => {
    expect(SEASON_LOOP).toHaveLength(10);
    expect(new Set(SEASON_LOOP.map((d) => d.mechanic)).size).toBe(10);
    expect(seasonAt(SEASON_EPOCH - 1)).toBeNull();
    const first = seasonAt(SEASON_EPOCH)!;
    expect(first.n).toBe(1);
    expect(first.def.mechanic).toBe('heart');
    expect(seasonAt(DEC_2026)!.end).toBe(Date.UTC(2027, 0, 1));
    expect(seasonAt(Date.UTC(2027, 0, 1))!.n).toBe(2);
    expect(seasonAt(Date.UTC(2027, 0, 31, 23))!.n).toBe(2);
    // the eleventh month is the first season's mechanic again
    expect(seasonAt(Date.UTC(2027, 9, 3))!.n).toBe(11);
    expect(seasonDef(11)).toBe(seasonDef(1));
    expect(nextSeasonAt(Date.UTC(2026, 10, 23))).toBe(SEASON_EPOCH);
  });

  it('gives each season a keeper, a title and words of its own, and only the first is built yet', () => {
    expect(new Set(SEASON_LOOP.map((d) => d.keeper.name)).size).toBe(10);
    expect(new Set(SEASON_LOOP.map((d) => d.title.id)).size).toBe(10);
    expect(SEASON_LOOP.filter((d) => d.built).map((d) => d.mechanic)).toEqual(['heart']);
    for (const d of SEASON_LOOP) expect(TITLES.some((t) => t.id === d.title.id), d.title.id).toBe(true);
  });
});

describe('Sigilfall: the Season Heart', () => {
  const hero = () => readyHero('warrior', 60, 'epic', 5, 0);
  const run = (c: ReturnType<typeof hero>, season?: number, key = 5) => new World({ region: 'crypt', tier: 2, mods: [], hero: c, settings: { ...DEFAULT_SETTINGS }, seed: 1, ...(key ? { key, affixes: [] } : {}), handIns: false, ...(season ? { season } : {}) });

  it('grows a rank for every five stones of the season’s best, from 1 to 8', () => {
    expect([0, 4, 5, 14, 15, 34, 35, 90].map(heartRank)).toEqual([1, 1, 2, 3, 4, 7, 8, 8]);
  });

  it('works in a Riftstone run of the Season of Hearts, and nowhere else', () => {
    const c = hero();
    expect(chooseHeart(c, 1, 'storm')).toBe(true);
    expect(heartOf(c, 1)).toBe('storm');
    expect(run(c, 1).build.procs.some((p) => p.id === 'heart-storm')).toBe(true);
    // not out of a run, not without the season, not in another season's month
    expect(run(c, 1, 0).build.procs.some((p) => p.id === 'heart-storm')).toBe(false);
    expect(run(c).build.procs.some((p) => p.id === 'heart-storm')).toBe(false);
    expect(chooseHeart(c, 2, 'storm')).toBe(false);
    expect(seasonMods(c, 2)).toEqual([]);
    // the Season of Hearts again, ten months on: a new season, a heart to choose again
    expect(seasonMods(c, 11)).toEqual([]);
    expect(chooseHeart(c, 11, 'ward')).toBe(true);
    expect(seasonMods(c, 11).length).toBeGreaterThan(0);
  });

  it('makes every heart worth having: more damage, a ward, a storm or a richer cache', () => {
    for (const id of HEART_IDS) {
      expect(HEARTS[id].mods(4).length, id).toBeGreaterThan(0);
      expect(HEARTS[id].text(4), id).toMatch(/\d/);
    }
    const c = hero();
    chooseHeart(c, 1, 'fury');
    const plain = run(readyHero('warrior', 60, 'epic', 5, 0), 1).build.skills['heavy-strike']!.spec.damage;
    expect(run(c, 1).build.skills['heavy-strike']!.spec.damage).toBeGreaterThan(plain * 1.4);
    chooseHeart(c, 1, 'greed');
    ensureSeason(c, 1).best = 30;
    expect(greedOf(c, 1)).toEqual({ marks: 70, cache: greedCache(7) });
    expect(greedOf(c, 2)).toEqual({ marks: 0, cache: 0 });
  });
});

describe('Sigilfall: the season’s Journey', () => {
  it('counts only Riftstone runs beaten in time, and starts again with a new season', () => {
    const c = readyHero('mage', 60, 'epic', 5, 2);
    recordRun(c, 1, 'crypt', 7, -1, 0);
    expect(seasonOf(c, 1).runs).toBe(0);
    recordRun(c, 1, 'crypt', 7, 2, 1);
    recordRun(c, 1, 'crypt', 9, 1, 0);
    recordRun(c, 1, 'gallows-keep', 4, 3, 0);
    expect(seasonOf(c, 1)).toMatchObject({ runs: 3, best: 9, dungeons: ['crypt', 'gallows-keep'], flawless: 2 });
    recordRun(c, 2, 'crypt', 3, 1, 0);
    expect(seasonOf(c, 2)).toMatchObject({ n: 2, runs: 1, best: 3 });
    expect(seasonOf(c, 1).runs).toBe(0);
  });

  it('gives Sigil Marks, a whole Rift set of the hero’s choosing two pieces at a time, then the title and its mount', () => {
    const c = readyHero('mage', 60, 'epic', 5, 2);
    c.bag = [];
    const marks = c.marks;
    // the first chapter: a run in time and the heart chosen
    expect(claimChapter(c, 1, 0).ok).toBe(false);
    recordRun(c, 1, 'crypt', 3, 1, 0);
    expect(journeyOf(c, 1)[0]!.ready).toBe(false);
    chooseHeart(c, 1, 'ward');
    expect(journeyOf(c, 1)[0]!.ready).toBe(true);
    expect(claimChapter(c, 1, 0)).toMatchObject({ ok: true, marks: 25 });
    expect(c.marks).toBe(marks + 25);
    // the chapters after it, each in its turn
    for (const r of ['gallows-keep', 'smugglers-grotto', 'rotmother-cistern', 'deepforge-halls', 'barrow-of-kings', 'tomb-of-the-sun-king', 'rimeheld-vault', 'siege-of-highwall', 'blightheart', 'molten-throne', 'spire-of-the-rift', 'duskspire', 'crown-catacombs']) recordRun(c, 1, r, 20, 1, 0);
    expect(journeyOf(c, 1).map((x) => x.ready)).toEqual([false, true, false, false, false]);
    // a set first: the calling's own sets only
    expect(claimChapter(c, 1, 1).why).toBe('Choose a set first');
    expect(claimChapter(c, 1, 1, 'noonfire').ok).toBe(false);
    const set = 'long-winter';
    expect(journeySets(c)).toContain(set);
    expect(claimChapter(c, 1, 1, set).ok).toBe(true);
    expect(claimChapter(c, 1, 2).ok).toBe(true);
    expect(claimChapter(c, 1, 3).ok).toBe(true);
    expect(c.bag.map((it) => it.base)).toEqual(SETS[set]!.pieces);
    expect(c.bag.every((it) => ITEM_DEFS[it.base]!.set === set)).toBe(true);
    // the last: the title, its mount, more marks
    expect(claimChapter(c, 1, 4)).toMatchObject({ ok: true, title: 'Heartsworn', marks: 100 });
    expect(c.rtitles).toEqual(['season-hearts']);
    expect(TITLES.find((t) => t.id === 'season-hearts')!.earned(c)).toBe(true);
    // (once riding is open, as it is long before the Rift)
    c.quests[FIRST_RIDE] = { state: 'done', n: 0 };
    expect(mountEarned(c, MOUNT_DEFS['season-hearts-drake']!)).toBe(true);
    expect(mountEarned({ ...c, rtitles: [] }, MOUNT_DEFS['season-hearts-drake']!)).toBe(false);
    expect(claimChapter(c, 1, 4).ok).toBe(false);
    // a new season: a new Journey, and what was earned stays
    expect(journeyOf(c, 2).every((x) => !x.claimed)).toBe(true);
    expect(c.rtitles).toEqual(['season-hearts']);
  });

  it('keeps the pieces back when the bag has no room for them', () => {
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    chooseHeart(c, 1, 'fury');
    for (const r of ['crypt', 'gallows-keep', 'smugglers-grotto']) recordRun(c, 1, r, 6, 1, 0);
    claimChapter(c, 1, 0);
    while (c.bag.length < bagSize(c)) c.bag.push({ ...c.equip.weapon! });
    expect(claimChapter(c, 1, 1, journeySets(c)[0]).why).toBe('Your bag is full');
    expect(seasonOf(c, 1).claimed).toBe(1);
  });

  it('survives a save and a load, and what makes no sense is dropped', () => {
    const save = emptySave();
    const c = readyHero('priest', 60, 'epic', 5, 1);
    chooseHeart(c, 1, 'storm');
    recordRun(c, 1, 'crypt', 12, 2, 0);
    ensureSeason(c, 1).set = 'noonfire';
    c.rtitles = ['season-hearts', 'made-up'];
    save.heroes[0] = c;
    const back = migrate(JSON.parse(JSON.stringify(save)))!.heroes[0]!;
    expect(back.rseason).toMatchObject({ n: 1, heart: 'storm', best: 12, runs: 1, dungeons: ['crypt'], set: 'noonfire' });
    expect(back.rtitles).toEqual(['season-hearts']);
    // a heart that isn't one, and another calling's set
    save.heroes[0] = { ...c, rseason: { ...c.rseason!, heart: 'nonsense', set: 'long-winter' } };
    expect(migrate(JSON.parse(JSON.stringify(save)))!.heroes[0]!.rseason).toMatchObject({ heart: null, set: null });
  });
});

describe('Sigilfall: the season’s ladder', () => {
  it('sends each calling’s best stone of the season and the highest, on boards of that season’s own', () => {
    const save = emptySave();
    const a = readyHero('mage', 60, 'epic', 5, 2);
    const b = readyHero('mage', 60, 'epic', 5, 0);
    const c = readyHero('warrior', 60, 'epic', 5, 0);
    recordRun(a, 1, 'crypt', 14, 1, 0);
    recordRun(b, 1, 'crypt', 9, 1, 0);
    recordRun(c, 1, 'crypt', 6, 1, 0);
    save.heroes[0] = a;
    save.heroes[1] = b;
    save.heroes[2] = c;
    const boards = Object.fromEntries(rankEntries(save, {}, 0, {}, 1).map((e) => [e.board, e.score]));
    expect(boards).toMatchObject({ 'season:s1': 14, 'season:s1-mage': 14, 'season:s1-warrior': 6 });
    // next month: nothing yet on its boards
    expect(rankEntries(save, {}, 0, {}, 2).some((e) => e.board.startsWith('season'))).toBe(false);
  });

  it('is a board the server keeps, and nothing that looks like one gets in', () => {
    for (const ok of ['season:s1', 'season:s12-gloamknight', 'season:s1-mage']) expect(boardOf(ok), ok).not.toBeNull();
    for (const no of ['season', 'season:1', 'season:s0', 'season:s1-', 'season:winter', 'vigil:land1', 'ring:solo2']) expect(boardOf(no), no).toBeNull();
    // (the boards that were already there still are)
    for (const ok of ['trial', 'trial:mage', 'stone', 'vigil:whisperwood', 'ring:duo', 'level']) expect(boardOf(ok), ok).not.toBeNull();
  });
});

describe('Sigilfall: the season’s keeper in the Riftward', () => {
  it('stands in the square, and dresses as the season running', () => {
    expect(JSON.stringify(RIFTWARD.placed ?? [])).toContain('rw-season');
    const npc = RIFTWARD_NPCS['rw-season']!;
    expect(npc.service).toBe('season');
    dressSeasonKeeper(null);
    expect(npc.talk[0]!.lines.join(' ')).toContain('first of December');
    dressSeasonKeeper(seasonAt(Date.UTC(2027, 0, 5)));
    expect(npc.name).toBe(seasonDef(2).keeper.name);
    expect(npc.talk[0]!.lines).toEqual(seasonDef(2).keeper.lines);
    dressSeasonKeeper(seasonAt(DEC_2026));
    expect(npc.title).toBe('Keeper of Hearts');
  });

  it('asks five chapters of the Journey, the last at Riftstone +20 in every dungeon', () => {
    expect(JOURNEY).toHaveLength(5);
    expect(JOURNEY.reduce((a, c) => a + (c.reward.pieces ?? 0), 0)).toBe(6);
    expect(JOURNEY[4]!.reward.title).toBe(true);
  });
});

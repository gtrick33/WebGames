import { describe, expect, it } from 'vitest';
import { rng } from '../src/games/sigilfall/core/math';
import { ACTS } from '../src/games/sigilfall/data/acts';
import { BOSSES } from '../src/games/sigilfall/data/bosses';
import { ITEMS } from '../src/games/sigilfall/data/items';
import { MOUNTS } from '../src/games/sigilfall/data/mounts';
import { QUESTS } from '../src/games/sigilfall/data/quests';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import { SCENES } from '../src/games/sigilfall/data/scenes';
import type { ClassId, RegionId } from '../src/games/sigilfall/data/types';
import { fogSize, storeFog } from '../src/games/sigilfall/progress/fog';
import { makeItem, rollGear } from '../src/games/sigilfall/progress/items';
import { emptySave, migrate, SAVE_VERSION, saveText } from '../src/games/sigilfall/progress/save';
import { OPENED_TABLE, QUEST_TABLE } from '../src/games/sigilfall/progress/saveTables';
import { learnLooks } from '../src/games/sigilfall/progress/wardrobe';
import { parseRegion } from '../src/games/sigilfall/sim/map';
import { readyHero } from './sigilfall-bot';

/** Every key a hero can collect in Character.opened from the maps and the story (sim/world.ts, sim/scene.ts, engine.ts). */
function allOpenedKeys(): string[] {
  const keys = new Set<string>();
  for (const a of ACTS) keys.add(`act:${a.id}`);
  for (const h of ['equip', 'ult', 'potion', 'spec']) keys.add(`hint:${h}`);
  for (const s of SCENES) keys.add(`scene:${s.id}`);
  for (const b of Object.keys(BOSSES)) keys.add(`scene:boss-${b}`);
  for (const id of REGION_IDS) {
    const r = REGIONS[id];
    if (!r.interior) keys.add(`land:${id}`);
    for (const pm of parseRegion(r).markers) {
      const mk = pm.marker;
      if (mk.kind === 'spot') keys.add(`spot:${id}:${mk.id}`);
      if (mk.kind === 'shrine') keys.add(`found:${mk.id}`);
      if (mk.kind === 'chest' && mk.once) keys.add(`${id}:${mk.id}:${pm.tx}:${pm.ty}`);
    }
  }
  return [...keys];
}

/** A hero who has done everything: every quest, land, sight, chest and look, a full bag and overflow. */
function completionist(cls: ClassId, slot: number, opened: string[]) {
  const c = readyHero(cls, 60, 'rare', 11 + slot);
  c.id = `hero${slot}`;
  c.name = 'Completionist';
  for (const q of QUESTS) c.quests[q.id] = { state: 'done', n: 1 };
  for (const r of REGION_IDS) if (!c.unlocked.includes(r)) c.unlocked.push(r);
  c.opened = [...opened];
  const rand = rng(5 + slot);
  const own = ITEMS.filter((d) => !d.cls || d.cls === cls);
  c.bag = [];
  for (let i = 0; i < 40; i++) c.bag.push((i % 4 === 0 ? makeItem(own[i % 20]!.id, 60, rand) : null) ?? rollGear(cls, 60, 'rare', rand));
  for (let i = 0; i < 3000; i++) learnLooks(c, [rollGear(cls, 60, i % 2 ? 'rare' : 'common', rand, (['head', 'chest', 'weapon'] as const)[i % 3])]);
  learnLooks(c, own.map((d) => makeItem(d.id, 60, rand)).filter((x) => !!x));
  // every land explored: most of them all but the corners, a few only partly
  REGION_IDS.forEach((id, i) => {
    const m = parseRegion(REGIONS[id]);
    const f = fogSize(m.w, m.h);
    const cells = new Uint8Array(f.w * f.h);
    const share = i % 5 === 0 ? 0.7 : 0.97;
    for (let k = 0; k < cells.length; k++) cells[k] = rand() < share ? 1 : 0;
    storeFog(c, id as RegionId, { ...f, cells, count: cells.reduce((a, b) => a + b, 0), all: false });
  });
  for (const b of Object.keys(BOSSES)) c.bosses[b] = 12;
  for (const r of REGION_IDS)
    if (REGIONS[r].kind === 'dungeon') {
      for (const t of [0, 1, 2]) c.clears[`${r}:${t}`] = 5;
      c.bestKeys[r] = 9;
    }
  c.mounts = MOUNTS.map((m) => m.id);
  c.mount = c.mounts[0] ?? null;
  c.para = { l: 140, x: 1234, p: { might: 60, vigor: 30, precision: 25, toughness: 25 } };
  c.stats = { kills: 48211, deaths: 133, time: 302400, runs: 1022, bestRun: 41830 };
  c.marks = 1234;
  c.gold = 2345678;
  c.keystone = 14;
  c.tier = 2;
  return c;
}

describe('Sigilfall save size (SFS-01)', () => {
  it('the id tables hold every quest and every key of the maps', { timeout: 60_000 }, () => {
    // append new ids at the end of progress/saveTables.ts (never reorder: the places are the save format)
    expect(QUESTS.map((q) => q.id).filter((id) => !QUEST_TABLE.includes(id))).toEqual([]);
    expect(allOpenedKeys().filter((k) => !OPENED_TABLE.includes(k))).toEqual([]);
    expect(new Set(QUEST_TABLE).size).toBe(QUEST_TABLE.length);
    expect(new Set(OPENED_TABLE).size).toBe(OPENED_TABLE.length);
  });

  it('three completionist heroes stay under 60 KB and load back whole', { timeout: 60_000 }, () => {
    const opened = [...allOpenedKeys(), 'hint:some-new-hint'];
    const save = emptySave();
    save.heroes = [completionist('warrior', 0, opened), completionist('mage', 1, opened), completionist('druid', 2, opened)];
    // one quest still under way and one path not taken are kept by name
    save.heroes[1]!.quests[QUESTS[3]!.id] = { state: 'active', n: 2 };
    save.heroes[2]!.quests[QUESTS[4]!.id] = { state: 'done', n: -1 };
    const text = saveText(save);
    console.log(`three completionist heroes: ${text.length} chars`);
    expect(text.length).toBeLessThan(60_000);
    const back = migrate(JSON.parse(text))!;
    expect(back.v).toBe(SAVE_VERSION);
    save.heroes.forEach((h, i) => {
      const b = back.heroes[i]!;
      expect(b.quests).toEqual(h!.quests);
      expect([...b.opened].sort()).toEqual([...h!.opened].sort());
      expect(b.bag.length).toBe(h!.bag.length);
      expect(b.looks.length).toBe(h!.looks.length);
      expect(Object.keys(b.seen).sort()).toEqual(Object.keys(h!.seen).sort());
    });
    // a land explored almost whole is stored whole; a partly explored one keeps its fog
    const stored = (JSON.parse(text) as { heroes: { seen: Record<string, string> }[] }).heroes[0]!.seen;
    expect(stored[REGION_IDS[1]!]).toBe('*');
    expect(stored[REGION_IDS[0]!]).not.toBe('*');
  });

  it('a version 11 save (quests packed by name, opened keys by name) loads the same', () => {
    const c = readyHero('mage', 30, 'rare', 4);
    for (const q of QUESTS.slice(0, 40)) c.quests[q.id] = { state: 'done', n: 1 };
    c.opened = OPENED_TABLE.slice(0, 30).concat('hint:not-in-the-table');
    const v11 = { ...c, quests: Object.fromEntries(Object.keys(c.quests).map((id) => [id, 'd'])) };
    const back = migrate(JSON.parse(JSON.stringify({ v: 11, heroes: [v11], last: 0, settings: {}, saved: 0 })))!.heroes[0]!;
    expect(Object.keys(back.quests).filter((id) => back.quests[id]!.state === 'done').length).toBeGreaterThanOrEqual(40);
    expect([...back.opened].sort()).toEqual([...c.opened].sort());
    // and saved again in the new form, the same
    const again = migrate(JSON.parse(saveText({ ...emptySave(), heroes: [back, null, null] })))!.heroes[0]!;
    expect(again.quests).toEqual(back.quests);
    expect([...again.opened].sort()).toEqual([...back.opened].sort());
  });
});

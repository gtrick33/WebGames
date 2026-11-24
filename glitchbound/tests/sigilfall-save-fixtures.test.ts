import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ITEM_DEFS } from '../src/games/sigilfall/data/items';
import { QUEST_DEFS } from '../src/games/sigilfall/data/quests';
import { REGIONS } from '../src/games/sigilfall/data/regions';
import type { ClassId, RegionId } from '../src/games/sigilfall/data/types';
import { activeQuests, HOME, questState, readyQuests, sigilCount, startQuests, type Character } from '../src/games/sigilfall/progress/character';
import { isMainQuest } from '../src/games/sigilfall/progress/handin';
import { itemDef, itemName } from '../src/games/sigilfall/progress/items';
import { DEFAULT_SETTINGS, migrate, SAVE_VERSION, saveText } from '../src/games/sigilfall/progress/save';
import { objectiveTarget } from '../src/games/sigilfall/sim/objective';
import { World } from '../src/games/sigilfall/sim/world';

/**
 * Old saves keep loading (NINE_PLAN.md, the regression bar). Three saves written by the game as it stood before the
 * pass to 9/10 began (tests/sigilfall-saves/, made by scripts/sigilfall-save-fixtures.mjs on the commit named in
 * about.json): a hero in the middle of the Prologue, one in the middle of Act III, and one who has finished the story
 * and stands in the Riftward in Rift gear. Every later piece runs this: whatever it changed in quests, items or save
 * fields, these three come back with nothing a player would miss.
 *
 * The files are never made again on a later commit, and never edited: they are the old game.
 */

const DIR = join(__dirname, 'sigilfall-saves');

interface About {
  commit: string;
  saveVersion: number;
  saves: Record<string, { cls: ClassId; name: string; level: number; region: string; sigils: number; keystone: number }>;
}
const ABOUT = JSON.parse(readFileSync(join(DIR, 'about.json'), 'utf8')) as About;

/** What the file itself says, before the game reads it: the worn pieces and the bag, as written. */
interface RawHero {
  equip: Record<string, { uid: string; base: string }>;
  bag: { uid: string; base: string }[];
  gold: number;
  marks: number;
  mounts: string[];
}

function load(file: string): { raw: RawHero; hero: Character; text: string } {
  const text = readFileSync(join(DIR, file), 'utf8');
  const parsed = JSON.parse(text) as { v: number; heroes: (RawHero | null)[] };
  const save = migrate(parsed);
  expect(save, `${file} is read as a Sigilfall save`).not.toBeNull();
  const hero = save!.heroes[0];
  expect(hero, `${file} keeps its hero`).not.toBeNull();
  return { raw: (JSON.parse(text) as { heroes: RawHero[] }).heroes[0]!, hero: hero!, text };
}

/** The world the hero comes back into: where they stood when the save was written. */
function comeBack(hero: Character): World {
  startQuests(hero);
  const region = (hero.at?.region ?? HOME) as RegionId;
  const w = new World({ region, tier: 0, mods: [], hero, settings: { ...DEFAULT_SETTINGS }, seed: 3 });
  for (let i = 0; i < 120; i++) w.step(1 / 60);
  return w;
}

describe('Sigilfall: saves from before the pass to 9/10 still load', () => {
  it('the fixtures are the three saves of the plan, written by an older or equal version of the save', () => {
    expect(Object.keys(ABOUT.saves).sort()).toEqual(['finished-riftward.json', 'mid-act-3.json', 'mid-prologue.json']);
    expect(ABOUT.saveVersion).toBeLessThanOrEqual(SAVE_VERSION);
    expect(ABOUT.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  for (const [file, about] of Object.entries(ABOUT.saves)) {
    describe(file, () => {
      it('comes back as the same hero: name, class, level, sigils, stone and place', () => {
        const { hero } = load(file);
        expect(hero.name).toBe(about.name);
        expect(hero.cls).toBe(about.cls);
        expect(hero.level).toBe(about.level);
        expect(sigilCount(hero)).toBe(about.sigils);
        // (the loader gives every hero the first stone: a save with none comes back with it)
        expect(hero.keystone).toBeGreaterThanOrEqual(about.keystone);
        expect(hero.at?.region ?? HOME).toBe(about.region);
        expect(REGIONS[(hero.at?.region ?? HOME) as RegionId], 'the land the hero stands in is still a land').toBeTruthy();
      });

      it('keeps every piece worn and carried, each still a thing the game knows', () => {
        const { raw, hero } = load(file);
        const wornBefore = Object.values(raw.equip).map((i) => i.uid).sort();
        const wornAfter = Object.values(hero.equip).flatMap((i) => (i ? [i.uid] : [])).sort();
        expect(wornAfter).toEqual(wornBefore);
        expect(hero.bag.map((i) => i.uid).sort()).toEqual(raw.bag.map((i) => i.uid).sort());
        for (const it of [...Object.values(hero.equip), ...hero.bag]) {
          if (!it) continue;
          expect(itemName(it), `${it.base} has a name`).toBeTruthy();
          // a hand-made piece is still the hand-made piece it was
          if (ITEM_DEFS[it.base]) expect(itemDef(it)?.id).toBe(it.base);
        }
        expect(hero.gold).toBe(raw.gold);
        expect(hero.marks).toBe(raw.marks);
        // (mounts the story gave are made good by the loader, so the list may only grow)
        expect(hero.mounts).toEqual(expect.arrayContaining(raw.mounts));
      });

      it('keeps its story: no quest left that the game doesn’t know, and none of its acts forgotten', () => {
        const { hero } = load(file);
        for (const id of Object.keys(hero.quests)) expect(QUEST_DEFS[id], `quest ${id}`).toBeTruthy();
        expect(hero.opened.includes('act:prologue')).toBe(true);
        expect(Object.values(hero.quests).some((e) => e.state === 'done')).toBe(true);
      });

      it('is written back and read again without a change', () => {
        const { hero } = load(file);
        const again = migrate(JSON.parse(saveText({ v: SAVE_VERSION, heroes: [hero, null, null, null, null], last: 0, settings: { ...DEFAULT_SETTINGS }, saved: 1, rift: {}, riftBy: {} })) as unknown);
        expect(again?.heroes[0]).toEqual(hero);
      });

      it('walks back into the world where it stood', () => {
        const { hero } = load(file);
        const w = comeBack(hero);
        expect(w.region.id).toBe(about.region);
        expect(Number.isFinite(w.player.x) && Number.isFinite(w.player.y)).toBe(true);
        expect(w.player.hp).toBeGreaterThan(0);
      });
    });
  }

  it('the hero in the Prologue is still holding the chapel door, and the quest arrow points at it', () => {
    const { hero } = load('mid-prologue.json');
    expect(questState(hero, 'briar-hold-the-door')).toBe('active');
    const w = comeBack(hero);
    expect(objectiveTarget(w), 'the arrow has somewhere to point').toBeTruthy();
  });

  it('the hero in Act III still has the main story under way, with somewhere for the arrow to point', () => {
    const { hero } = load('mid-act-3.json');
    expect(hero.perks).toContain('sigil-embers');
    expect(hero.perks).toContain('sigil-sun');
    expect(hero.opened.includes('act:act-3')).toBe(true);
    startQuests(hero);
    const main = [...activeQuests(hero), ...readyQuests(hero)].filter((q) => isMainQuest(q.id));
    expect(main.length, 'a main quest is under way').toBeGreaterThan(0);
    const w = comeBack(hero);
    expect(objectiveTarget(w), 'the arrow has somewhere to point').toBeTruthy();
    expect(hero.spec).not.toBeNull();
  });

  it('the finished hero has no main quest left, all seven sigils, the Riftward open and Rift gear on', () => {
    const { hero } = load('finished-riftward.json');
    startQuests(hero);
    const left = Object.keys(QUEST_DEFS).filter((id) => isMainQuest(id) && questState(hero, id) !== 'done');
    expect(left, 'main quests not done').toEqual([]);
    expect(questState(hero, 'postgame-the-riftward')).toBe('done');
    expect(sigilCount(hero)).toBe(7);
    expect(hero.unlocked).toContain('riftward');
    expect(hero.at?.region).toBe('riftward');
    // Rift gear: pieces at the Rift's item levels (past 72), legendary or of a set, worn and carried
    const rift = [...Object.values(hero.equip), ...hero.bag].filter((i) => !!i && i.il > 72 && (i.r === 'legendary' || i.r === 'set'));
    expect(rift.length).toBeGreaterThanOrEqual(10);
    expect(Object.values(hero.equip).filter((i) => !!i && i.il > 72).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(hero.stones).length).toBeGreaterThan(0);
    expect(hero.para.l).toBeGreaterThan(0);
  });
});

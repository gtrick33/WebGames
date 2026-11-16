import { describe, expect, it } from 'vitest';
import { CLASS_IDS, CLASSES, xpToNext } from '../src/games/sigilfall/data/classes';
import { ITEM_DEFS } from '../src/games/sigilfall/data/items';
import { keyLoot } from '../src/games/sigilfall/data/keystones';
import { PETS } from '../src/games/sigilfall/data/pets';
import { RIFT_ITEMS, RIFT_TIERS, riftPool, SETS } from '../src/games/sigilfall/data/riftgear';
import { SKILLS } from '../src/games/sigilfall/data/skills';
import type { ClassId, Effect, Mod, SlotId } from '../src/games/sigilfall/data/types';
import { buildHero, collectMods, setsWorn } from '../src/games/sigilfall/progress/build';
import { addXp, chooseSpec, newCharacter, seatSpecSkill, slotOpen } from '../src/games/sigilfall/progress/character';
import { modLines } from '../src/games/sigilfall/progress/describe';
import { droppable, makeItem } from '../src/games/sigilfall/progress/items';
import { cantWager, riftFirsts, stoneRows, wager, WAGER_PRICE, wagerOdds } from '../src/games/sigilfall/progress/rift';
import { stockFor } from '../src/games/sigilfall/progress/shop';
import { tipDue, tipSteps } from '../src/games/sigilfall/progress/tips';
import { rng } from '../src/games/sigilfall/core/math';
import type { World } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

/**
 * The endgame's own gear: a set for every class and a piece for every specialization, found only in the Rift. These
 * hold what a player is told about it: what each piece changes is real, the Rift is the only place it comes from,
 * every new stone gives one, and the Riftbroker's odds are what the table says.
 */

const effectsOf = (mods: Mod[]): Effect[] => mods.flatMap((m) => (m.t === 'proc' ? [m.proc.effect] : m.t === 'skill' && 'effect' in m.op ? [m.op.effect] : []));
const classSkill = (cls: ClassId, id: string): boolean => id === '*' || id === 'basic' || id === 'dodge' || id === 'ult' || SKILLS[id]?.cls === cls;

describe('Sigilfall: Rift-forged gear', () => {
  it('has a three-piece set and three specialization pieces for every class', () => {
    for (const cls of CLASS_IDS) {
      const mine = RIFT_ITEMS.filter((d) => d.cls === cls);
      const set = Object.values(SETS).filter((s) => s.cls === cls);
      expect(set.length, cls).toBe(1);
      expect(set[0]!.pieces.length).toBe(3);
      expect(new Set(set[0]!.pieces.map((id) => ITEM_DEFS[id]!.slot)).size, `${cls}: one piece a slot`).toBe(3);
      expect(mine.filter((d) => d.forSpec !== undefined).map((d) => d.forSpec).sort(), cls).toEqual([0, 1, 2]);
    }
    expect(new Set(RIFT_ITEMS.map((d) => d.id)).size).toBe(RIFT_ITEMS.length);
    expect(new Set(RIFT_ITEMS.map((d) => d.name)).size).toBe(RIFT_ITEMS.length);
  });

  it('changes only its own class’s skills, with effects the game has', () => {
    // (a set's pieces carry nothing by themselves: what they do is the set's)
    const all: { who: string; cls: ClassId; mods: Mod[] }[] = [...RIFT_ITEMS.filter((d) => !d.set).map((d) => ({ who: d.name, cls: d.cls!, mods: d.mods })), ...Object.values(SETS).flatMap((s) => s.bonuses.map((b) => ({ who: `${s.name} (${b.need})`, cls: s.cls, mods: b.mods })))];
    for (const { who, cls, mods } of all) {
      expect(mods.length, who).toBeGreaterThan(0);
      for (const m of mods) {
        if (m.t === 'skill') expect(classSkill(cls, m.skill), `${who}: ${m.skill}`).toBe(true);
        if (m.t === 'proc' && m.proc.skill) expect(classSkill(cls, m.proc.skill), `${who}: ${m.proc.skill}`).toBe(true);
      }
      for (const e of effectsOf(mods)) {
        if (e.kind === 'summon') expect(PETS[e.pet], `${who}: ${e.pet}`).toBeTruthy();
        if (e.kind === 'buff' && e.buff.empower) expect(classSkill(cls, e.buff.empower.skill), `${who}: ${e.buff.empower.skill}`).toBe(true);
      }
    }
  });

  it('makes a piece for a specialization out of that specialization’s own ability', () => {
    for (const d of RIFT_ITEMS.filter((x) => x.forSpec !== undefined)) {
      const own = CLASSES[d.cls!].trees[d.forSpec!]!.skill;
      expect(d.mods.some((m) => m.t === 'skill' && m.skill === own), `${d.name} changes ${own}`).toBe(true);
    }
  });

  it('says what every piece and every set bonus does, in words', () => {
    for (const d of RIFT_ITEMS.filter((x) => x.forSpec !== undefined)) {
      const lines = modLines(d.mods);
      expect(lines.length, d.name).toBeGreaterThan(0);
      for (const l of lines) expect(l, d.name).not.toMatch(/undefined|NaN| 0%/);
    }
    for (const s of Object.values(SETS)) for (const b of s.bonuses) expect(b.text.length, s.name).toBeGreaterThan(20);
  });

  it('builds into a hero: every piece worn changes a skill or adds a trigger', () => {
    for (const cls of CLASS_IDS) {
      for (const d of RIFT_ITEMS.filter((x) => x.cls === cls && x.forSpec !== undefined)) {
        const c = readyHero(cls, 60, 'epic', 5, d.forSpec!);
        const before = JSON.stringify(buildHero(c).skills) + buildHero(c).procs.length;
        c.equip[d.slot] = makeItem(d.id, 80)!;
        const after = JSON.stringify(buildHero(c).skills) + buildHero(c).procs.length;
        expect(after, d.name).not.toBe(before);
      }
    }
  });
});

describe('Sigilfall: sets', () => {
  const wearing = (cls: ClassId, n: number) => {
    const c = readyHero(cls, 60, 'epic', 5);
    const set = Object.values(SETS).find((s) => s.cls === cls)!;
    for (const id of set.pieces.slice(0, n)) c.equip[ITEM_DEFS[id]!.slot] = makeItem(id, 80)!;
    return { c, set };
  };

  it('counts the pieces worn and gives each bonus only from its count', () => {
    for (const cls of CLASS_IDS) {
      for (const n of [0, 1, 2, 3]) {
        const { c, set } = wearing(cls, n);
        expect(setsWorn(c.equip)[0]?.worn ?? 0, `${cls} ${n}`).toBe(n);
        const from = collectMods(c).filter((e) => e.source.name === set.name).length;
        const want = set.bonuses.filter((b) => n >= b.need).reduce((a, b) => a + b.mods.length, 0);
        expect(from, `${cls} wearing ${n}`).toBe(want);
      }
    }
  });

  it('gives a warrior in two pieces a bleeding Cleave, and in three a second Heavy Strike', () => {
    const two = buildHero(wearing('warrior', 2).c);
    expect(two.skills.cleave!.spec.onHit.some((e) => e.kind === 'status' && e.status === 'bleed')).toBe(true);
    expect(two.skills['heavy-strike']!.spec.charges).toBe(1);
    const three = buildHero(wearing('warrior', 3).c);
    expect(three.skills['heavy-strike']!.spec.charges).toBe(2);
    expect(three.skills['heavy-strike']!.spec.onCast.some((e) => e.kind === 'shockwave')).toBe(true);
  });
});

describe('Sigilfall: only the Rift gives it', () => {
  it('never drops outside the Rift, and never before its stone', () => {
    for (const cls of CLASS_IDS) {
      expect(droppable(cls, 100, 'legendary').some((d) => d.rift !== undefined), cls).toBe(false);
      const atOne = droppable(cls, 100, 'legendary', 1).filter((d) => d.rift !== undefined);
      expect(atOne.length, `${cls} at +1`).toBe(2);
      expect(droppable(cls, 100, 'legendary', RIFT_TIERS.legs).filter((d) => d.rift !== undefined).length).toBe(3);
      expect(droppable(cls, 100, 'legendary', RIFT_TIERS.unique).filter((d) => d.rift !== undefined).length).toBe(6);
    }
  });

  it('is not on the quartermaster’s shelf', () => {
    for (const cls of CLASS_IDS) {
      const c = readyHero(cls, 60, 'epic', 5);
      expect(stockFor(c, 'quartermaster').some((s) => ITEM_DEFS[s.item.base]?.rift !== undefined), cls).toBe(false);
    }
  });

  it('gives a piece the hero lacks for every new stone, the set first and their own specialization’s before the others', () => {
    const c = readyHero('mage', 60, 'epic', 5, 1);
    const first = riftFirsts(c, 1, 1);
    expect(first.map((d) => d.set)).toEqual(['rimeglass']);
    // three stones opened at once: three pieces, and never the one already in the bag
    c.bag.push(makeItem(first[0]!.id, 73)!);
    const next = riftFirsts(c, 5, 3);
    expect(next.length).toBe(3);
    expect(next.some((d) => d.id === first[0]!.id)).toBe(false);
    expect(next.filter((d) => d.set).length).toBe(2);
    expect(next[2]!.forSpec).toBe(1);
    // nothing for a hero below the top level, or with no new stone
    expect(riftFirsts(readyHero('mage', 40, 'rare', 5), 5, 2)).toEqual([]);
    expect(riftFirsts(c, 5, 0)).toEqual([]);
    expect(riftPool('mage', 99).length).toBe(6);
  });

  it('drops the new stone’s piece when a run in time opens one', () => {
    const c = readyHero('warrior', 60, 'epic', 5);
    c.keystone = 1;
    const w = newWorld('crypt', c, 3, 2);
    const run = (): NonNullable<World['keyRun']> => ({ key: 1, heroLevel: 60, par: 600, t: 100, deaths: 0, affixes: [], end: null }) as unknown as NonNullable<World['keyRun']>;
    w.keyRun = run();
    const before = w.drops.length;
    (w as unknown as { finishKeyRun: (t: number, up: number, x: number, y: number) => void }).finishKeyRun(100, 1, w.player.x, w.player.y);
    expect(c.keystone).toBe(2);
    const forged = w.keyRun!.end!.forged!;
    expect(forged.length).toBe(1);
    expect(w.drops.slice(before).some((d) => d.item && ITEM_DEFS[d.item.base]?.rift !== undefined)).toBe(true);
    // (a second run at the same stone opens nothing new: no piece)
    w.keyRun = run();
    c.keystone = 4;
    (w as unknown as { finishKeyRun: (t: number, up: number, x: number, y: number) => void }).finishKeyRun(100, 1, w.player.x, w.player.y);
    expect(w.keyRun!.end!.forged).toEqual([]);
  });
});

describe('Sigilfall: the Riftbroker', () => {
  it('refuses a hero below the top level, without a stone, without the marks or with a full bag', () => {
    const low = readyHero('ranger', 40, 'rare', 5);
    low.marks = 99;
    low.keystone = 3;
    expect(cantWager(low)).toMatch(/level/);
    const c = readyHero('ranger', 60, 'epic', 5);
    c.marks = 99;
    c.keystone = 0;
    expect(cantWager(c)).toMatch(/Riftstone/);
    c.keystone = 3;
    c.marks = WAGER_PRICE - 1;
    expect(cantWager(c)).toMatch(/Marks/);
    expect(wager(c, 'hands')).toBeNull();
    c.marks = WAGER_PRICE;
    expect(cantWager(c)).toBeNull();
  });

  it('takes the marks and gives one piece for the slot, at the stone’s item level', () => {
    const c = readyHero('ranger', 60, 'epic', 5);
    c.keystone = 6;
    c.marks = WAGER_PRICE * 400;
    const r = rng(11);
    const got: Record<string, number> = { rare: 0, epic: 0, legendary: 0 };
    let forged = 0;
    for (let i = 0; i < 400; i++) {
      c.bag.length = 0;
      const slot: SlotId = i % 2 ? 'hands' : 'weapon';
      const it = wager(c, slot, r)!;
      expect(it).toBeTruthy();
      expect(ITEM_DEFS[it.base]?.slot ?? slot).toBe(slot);
      expect(it.il).toBe(keyLoot(6));
      got[it.r] = (got[it.r] ?? 0) + 1;
      if (ITEM_DEFS[it.base]?.rift !== undefined) forged++;
    }
    expect(c.marks).toBe(0);
    // the table's odds, near enough over 400 turns (gloves have no epic of their own: those turn rare)
    const odds = wagerOdds(6);
    expect(got.legendary! / 400).toBeGreaterThan(odds.legendary * 0.6);
    expect(got.legendary! / 400).toBeLessThan(odds.legendary * 1.5);
    expect(forged).toBeGreaterThan(10);
  });

  it('never deals a Rift-forged piece the hero’s stone has not opened', () => {
    const c = readyHero('priest', 60, 'epic', 5);
    c.keystone = 1;
    c.marks = WAGER_PRICE * 300;
    const r = rng(4);
    for (let i = 0; i < 300; i++) {
      c.bag.length = 0;
      const it = wager(c, (['legs', 'weapon', 'relic', 'amulet'] as const)[i % 4]!, r)!;
      expect(ITEM_DEFS[it.base]?.rift ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it('has a row in the guide for each stone that opens something', () => {
    const rows = stoneRows('druid', false);
    expect(rows[0]!.stone).toBe(1);
    expect(rows.find((r) => r.stone === RIFT_TIERS.legs)!.opens.join(' ')).toMatch(/legwear/);
    expect(rows.find((r) => r.stone === RIFT_TIERS.unique)!.opens.join(' ')).toMatch(/specialization/);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.il).toBeGreaterThan(rows[i - 1]!.il);
    expect(rows[rows.length - 1]!.il).toBe(100);
  });
});

describe('Sigilfall: the Rift hint', () => {
  it('is for a hero at the endgame’s door, old or new, and not for one who has climbed already', () => {
    const fresh = readyHero('warrior', 60, 'epic', 5);
    fresh.keystone = 1;
    expect(tipDue(fresh, true, 'rift')).toBe(true);
    expect(tipDue(fresh, false, 'rift')).toBe(false);
    fresh.keystone = 7;
    expect(tipDue(fresh, true, 'rift')).toBe(false);
    const steps = tipSteps('rift', { touch: true, bar: {}, resource: null, specChosen: true });
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.map((s) => s.text).join(' ')).toMatch(/waystone/);
    expect(steps.map((s) => s.text).join(' ')).toMatch(/Quartermaster/);
  });
});

describe('Sigilfall: a specialization’s ability is on the bar from the moment it is chosen', () => {
  it('goes in a slot that is open at level 10, not the one that opens at 15', () => {
    for (const cls of CLASS_IDS) {
      const c = newCharacter(cls, 'P', 'p', 0);
      while (c.level < 10) addXp(c, xpToNext(c.level));
      chooseSpec(c, 0);
      const tree = CLASSES[cls].trees[0]!;
      if (tree.formOnly) continue;
      const at = c.skills.indexOf(tree.skill);
      expect(at, cls).toBeGreaterThanOrEqual(0);
      expect(slotOpen(c, at as 0), `${cls}: ${tree.skill} in slot ${at + 1}`).toBe(true);
      expect(buildHero(c).skills[tree.skill], cls).toBeTruthy();
      // what it took the place of comes back when the fourth slot opens
      const before = c.skills.filter(Boolean).length;
      while (c.level < 15) addXp(c, xpToNext(c.level));
      expect(c.skills.filter(Boolean).length, cls).toBeGreaterThanOrEqual(before);
      expect(c.skills.includes(tree.skill)).toBe(true);
    }
  });

  it('puts right a hero saved with it in a slot that was not open', () => {
    const c = newCharacter('warrior', 'P', 'p', 0);
    // (level 11: the fourth slot opens at 12)
    while (c.level < 11) addXp(c, xpToNext(c.level));
    c.spec = 0;
    c.skills = ['heavy-strike', 'whirlwind', 'shield-bash', 'bloodthirst'];
    expect(seatSpecSkill(c)).toBe(true);
    expect(c.skills[2]).toBe('bloodthirst');
    expect(c.skills[3]).toBe('shield-bash');
    expect(seatSpecSkill(c)).toBe(false);
  });
});

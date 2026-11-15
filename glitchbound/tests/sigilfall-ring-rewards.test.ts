/** The Ring without Momentum, its quicker gates against the computer, and what its ranks give. */
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ABILITIES, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { readRing, writeRing } from '../src/games/sigilfall/arena/ladder';
import { bestRating, forgetBest, RANKS, RING_KEY } from '../src/games/sigilfall/arena/ranks';
import { nextReward, ownedRingLooks, ownsRingLook, rewardsBetween, RING_LOOKS, RING_REWARDS, ringLookId } from '../src/games/sigilfall/arena/rewards';
import { GATES, GATES_SOLO, Match, type Aura, type FighterSetup } from '../src/games/sigilfall/arena/sim';
import { SAMPLES } from '../src/games/sigilfall/audio/samples';
import { SFX } from '../src/games/sigilfall/audio/sound';
import { CLASS_IDS } from '../src/games/sigilfall/data/classes';
import type { ClassId } from '../src/games/sigilfall/data/types';
import { newCharacter } from '../src/games/sigilfall/progress/character';
import { ownedShopLooks } from '../src/games/sigilfall/progress/shopGoods';
import { chooseTitle, earnedTitles, RING_TITLES, wornTitle } from '../src/games/sigilfall/progress/titles';
import { hasLook, lookSource, wearLook, wornLooks } from '../src/games/sigilfall/progress/wardrobe';
import { ringSchoolSounds } from '../src/games/sigilfall/render/ring';
import { plainTitle, plainWorn, ringTitle } from '../src/games/sigilfall/ui/RingRewards';

const read = (p: string): string => fs.readFileSync(path.join(path.resolve(__dirname, '..'), p), 'utf8');

const STEP = 1 / 30;
const fighter = (team: 0 | 1, cls: ClassId, bar?: string[]): FighterSetup => ({ team, cls, name: cls, bar: bar ?? PRESETS[cls][0]!.bar });

function duel(a: ClassId, abar: string[], b: ClassId): Match {
  const m = new Match({ seed: 5, map: 'sands', fighters: [fighter(0, a, abar), fighter(1, b)] });
  m.step(GATES + 0.01, {});
  const [x, y] = [m.fighters[0]!, m.fighters[1]!];
  x.x = 200;
  x.y = 125;
  y.x = 225;
  y.y = 125;
  x.target = y.id;
  y.target = x.id;
  y.hp = y.maxHp = 1e6;
  return m;
}
const wait = (m: Match, seconds: number): void => {
  for (let i = 0; i < seconds / STEP; i++) m.step(STEP, {});
};
/** As if this hero's ability had left its mark on the target. */
const mark = (m: Match, ab: string, extra: Partial<Aura> = {}): void => {
  m.fighters[1]!.auras.push({ ab, kind: 'dot', src: 0, t: 30, dur: 30, harmful: true, magic: false, n: 0, next: 99, ...extra });
};
const rate = (best: number): void => {
  localStorage.setItem(RING_KEY, JSON.stringify({ standings: { 1: { rating: best, best, wins: 0, losses: 0, streak: 0 } }, sets: {} }));
  forgetBest();
};

describe('The Ring: no Momentum (the owner: "i dont like the momentum idea, too much stuff on screen")', () => {
  it('a combo hits as hard the third time in a row as the first, and adds nothing to the super of its own', () => {
    const hit = (before: number): { dmg: number; charge: number } => {
      const m = duel('mage', ['m-burn'], 'warrior');
      const [me, foe] = [m.fighters[0]!, m.fighters[1]!];
      // (as if other combos had come just before this one)
      for (let i = 0; i < before; i++) me.score.combos = (me.score.combos ?? 0) + 1;
      mark(m, 'm-lash');
      const hp = foe.hp;
      m.press(0, 'm-burn');
      wait(m, 0.6);
      return { dmg: hp - foe.hp, charge: me.charge };
    };
    const first = hit(0);
    const third = hit(2);
    expect(third.dmg).toBe(first.dmg);
    expect(third.charge).toBe(first.charge);
  });

  it('is gone from the rules, from the words over a target and from a snapshot', () => {
    const m = duel('warrior', ['w-hew', 'w-gash'], 'paladin');
    mark(m, 'w-bleed');
    m.events.length = 0;
    m.press(0, 'w-hew');
    wait(m, 0.1);
    m.fighters[1]!.auras.push({ ab: 'w-hurl', kind: 'cc', cc: 'stun', src: 0, t: 5, dur: 5, harmful: true, magic: false, n: 0 });
    wait(m, 1);
    m.press(0, 'w-gash');
    wait(m, 0.1);
    const words = m.events.filter((e) => e.k === 'word' && e.combo).map((e) => (e as { word: string }).word);
    expect(words.every((w) => !/×/.test(w))).toBe(true);
    expect('streak' in m.fighters[0]!).toBe(false);
    expect(JSON.stringify(m.snapshot())).not.toMatch(/"stt?":/);
    expect(read('src/games/sigilfall/arena/sim.ts')).not.toMatch(/MOMENTUM_/);
  });

  it('every class can chain: each has at least three different combos to weave', () => {
    for (const cls of CLASS_IDS) {
      const names = new Set(Object.values(ABILITIES).filter((a) => a.cls === cls && a.combo).map((a) => a.combo!.name));
      expect(names.size, cls).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('The Ring: the gates', () => {
  it('lift sooner against the computer, and at their usual time when nothing says otherwise', () => {
    const solo = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, 'warrior'), fighter(1, 'mage')], gates: GATES_SOLO });
    solo.step(GATES_SOLO - 0.1, {});
    expect(solo.phase).toBe('gates');
    solo.step(0.2, {});
    expect(solo.phase).toBe('fight');
    expect(GATES_SOLO).toBeLessThan(GATES);
    const room = new Match({ seed: 1, map: 'sands', fighters: [fighter(0, 'warrior'), fighter(1, 'mage')] });
    room.step(GATES - 0.1, {});
    expect(room.phase).toBe('gates');
  });
});

describe('The Ring: what its ranks give', () => {
  beforeEach(() => {
    localStorage.clear();
    forgetBest();
  });

  it('every rank above the first gives a title and a suit of armor, each with a name and colors of its own', () => {
    const ranks = RANKS.filter((r) => r.at > 0);
    expect(RING_REWARDS.map((r) => r.at)).toEqual(ranks.map((r) => r.at));
    expect(RING_TITLES.map((t) => t.rating)).toEqual(ranks.map((r) => r.at));
    expect(RING_LOOKS).toHaveLength(ranks.length * 2);
    expect(new Set(RING_LOOKS.map((l) => l.name)).size).toBe(RING_LOOKS.length);
    expect(new Set(RING_REWARDS.map((r) => r.colors.join())).size).toBe(RING_REWARDS.length);
    for (const l of RING_LOOKS) {
      expect(l.set).toBe('ringforged');
      expect(l.colors).toHaveLength(4);
      for (const c of l.colors!) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      // (kept in a save beside a shop look: the same shape of id)
      expect(l.id).toMatch(/^[a-z0-9][a-z0-9-]{1,39}$/);
      expect(l.cls).toBeUndefined();
    }
  });

  it('is earned by the best rating reached, in any format, and kept when the rating falls', () => {
    expect(bestRating()).toBe(1000);
    expect(ownedRingLooks()).toEqual([]);
    expect(nextReward(bestRating())?.at).toBe(1150);
    rate(1320);
    expect(ownsRingLook(ringLookId(1150, 'head'))).toBe(true);
    expect(ownsRingLook(ringLookId(1300, 'chest'))).toBe(true);
    expect(ownsRingLook(ringLookId(1500, 'head'))).toBe(false);
    expect(ownedRingLooks()).toHaveLength(4);
    // the rating falls, the best stays: writing the standings asks afresh
    const s = readRing();
    writeRing({ ...s, standings: { 1: { rating: 1100, best: 1320, wins: 0, losses: 3, streak: 0 }, 2: { rating: 1510, best: 1510, wins: 9, losses: 0, streak: 9 } } });
    expect(bestRating()).toBe(1510);
    expect(ownsRingLook(ringLookId(1500, 'head'))).toBe(true);
    expect(rewardsBetween(1320, 1510).map((r) => r.rank)).toEqual(['Pit Veteran']);
    expect(rewardsBetween(1510, 1512)).toEqual([]);
    expect(rewardsBetween(1000, 2200)).toHaveLength(RING_REWARDS.length);
  });

  it('goes into any hero’s Wardrobe, whatever their class, and comes off if it was never earned', () => {
    const mage = newCharacter('mage', 'Ilse', 'f');
    const helm = ringLookId(1150, 'head');
    const suit = ringLookId(1150, 'chest');
    expect(hasLook(mage, helm)).toBe(false);
    expect(wearLook(mage, 'head', helm)).toBe(false);
    rate(1150);
    expect(hasLook(mage, helm)).toBe(true);
    expect(ownedShopLooks().map((l) => l.id)).toEqual(expect.arrayContaining([helm, suit]));
    expect(wearLook(mage, 'head', helm)).toBe(true);
    expect(wearLook(mage, 'chest', suit)).toBe(true);
    // (a helm isn't a chest piece)
    expect(wearLook(mage, 'chest', helm)).toBe(false);
    const worn = wornLooks(mage);
    expect(worn.head).toMatchObject({ id: helm, set: 'ringforged' });
    expect(worn.chest).toMatchObject({ id: suit });
    expect(lookSource(mage, helm)).toContain('1150');
    expect(lookSource(mage, helm)).toContain('Blooded');
    // a save carried to a device whose player never earned it: the hero's own look shows instead
    rate(1000);
    expect(wornLooks(mage).head).toBeUndefined();
  });

  it('its titles are worn by a hero or in plain clothes, only while earned', () => {
    const hero = newCharacter('warrior', 'Brann', 'm');
    expect(chooseTitle(hero, 'ring-1150')).toBe(false);
    expect(plainTitle({ title: 'ring-1150' })).toBeNull();
    rate(1700);
    expect(earnedTitles(hero).map((t) => t.id)).toEqual(expect.arrayContaining(['ring-1150', 'ring-1300', 'ring-1500', 'ring-1700']));
    expect(earnedTitles(hero).some((t) => t.id === 'ring-1900')).toBe(false);
    expect(chooseTitle(hero, 'ring-1700')).toBe(true);
    expect(wornTitle(hero)).toBe('Bladeward');
    expect(ringTitle(hero, undefined)).toEqual({ text: 'Bladeward', fx: 'arcane', before: true });
    // in plain clothes: the Ring's own title and armor, kept with the standing
    expect(plainTitle({ title: 'ring-1500' })?.text).toBe('Pit Veteran');
    expect(ringTitle(null, { title: 'ring-1500' })?.text).toBe('Pit Veteran');
    expect(plainTitle({ title: 'ring-1900' })).toBeNull();
    expect(plainWorn({ head: ringLookId(1700, 'head'), chest: ringLookId(1900, 'chest') })).toMatchObject({ head: { id: ringLookId(1700, 'head') } });
    expect(plainWorn({ chest: ringLookId(1900, 'chest') }).chest).toBeUndefined();
    // (and the choice is kept)
    writeRing({ ...readRing(), plain: { head: ringLookId(1700, 'head'), title: 'ring-1700' } });
    expect(readRing().plain).toEqual({ head: ringLookId(1700, 'head'), title: 'ring-1700' });
  });
});

describe('The Ring: its sounds', () => {
  it('every school has a sound for leaving the hand, for landing and for a super, and each is a real one', () => {
    for (const id of ringSchoolSounds()) expect(!!SAMPLES[id] || !!SFX[id], id).toBe(true);
  });
});

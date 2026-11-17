/**
 * The Ring after players' word of 2026-11-17, which the owner took up whole ("i dont think ur balancing test is very
 * relevant here as this is player feedback"): warriors "have the best dps, most amount of cc, same mobility as everyone
 * and are the tankiest spec … not to mention mortal wounds on top of that"; "fire mage ult is a bit too strong" (its
 * patch a quarter smaller); "warlock drain is bugged i think, thinks its only healing on the first dot and stops";
 * "healers i think could use some help with the castable heals", and the owner: "lower the damage of healers a lot".
 */
import { describe, expect, it } from 'vitest';
import { ABILITIES, BODY, CLASS_DMG, PRESETS } from '../src/games/sigilfall/arena/abilities';
import { TALENTS } from '../src/games/sigilfall/arena/talents';
import { DOUBLE_TAP, GATES, Match, steadyCast, type Fighter, type FighterSetup } from '../src/games/sigilfall/arena/sim';
import type { ClassId } from '../src/games/sigilfall/data/types';

const STEP = 1 / 30;
const AB = (id: string) => ABILITIES[id]!;
const talent = (cls: ClassId, name: string) => TALENTS[cls].find((t) => t.name === name)!;
type Inside = { damage: (src: Fighter, t: Fighter, n: number, direct: boolean, ab?: unknown) => number; rand: () => number };
const inside = (m: Match): Inside => m as unknown as Inside;

/** Two fighters face to face, past the gates, the first with `bar`. */
function duel(cls: ClassId, bar: string[], foe: ClassId = 'warrior', gap = 130): { m: Match; me: Fighter; foe: Fighter } {
  const side = (c: ClassId, team: 0 | 1, b: string[]): FighterSetup => ({ team, cls: c, name: c, bar: b, talents: [] });
  const m = new Match({ seed: 6, map: 'sands', fighters: [side(cls, 0, bar), side(foe, 1, ['w-hew'])] });
  m.step(GATES + 0.01, {});
  const [me, other] = m.fighters as [Fighter, Fighter];
  Object.assign(me, { x: 200, y: 125, dirX: 1, dirY: 0, target: 1 });
  Object.assign(other, { x: 200 + gap, y: 125, dirX: -1, dirY: 0, target: 0 });
  inside(m).rand = () => 0.99;
  return { m, me, foe: other };
}

describe('The Ring’s warrior, brought down on every count', () => {
  it('less damage and less health, the least of those at arm’s length', () => {
    expect(CLASS_DMG.warrior).toBe(0.82);
    expect(CLASS_DMG.warrior).toBeLessThanOrEqual(CLASS_DMG.paladin);
    expect(CLASS_DMG.warrior).toBeLessThan(CLASS_DMG.gloamknight);
    expect(BODY.warrior.hp).toBe(1240);
    // (the most there was until now: it is behind the paladin, the druid and the ranger)
    for (const c of ['paladin', 'druid', 'ranger', 'gloamknight'] as const) expect(BODY.warrior.hp, c).toBeLessThan(BODY[c].hp);
  });

  it('shorter stuns, weaker slows, a longer wait for the charge, and a lighter cut to healing', () => {
    const hold = (id: string) => AB(id).effects.find((e) => e.k === 'cc') as { dur: number };
    const slow = (id: string) => AB(id).effects.find((e) => e.k === 'slow') as { pct: number; dur: number };
    expect(hold('w-hurl').dur).toBe(1);
    expect(hold('w-crack').dur).toBe(1);
    expect(slow('w-hamstring').pct).toBe(30);
    expect(AB('w-rush').cd).toBe(15);
    expect((AB('w-gash').effects.find((e) => e.k === 'antiheal') as { pct: number }).pct).toBe(20);
    // (and their words say so)
    expect(AB('w-hurl').text).toMatch(/stuns the target for 1 sec\./);
    expect(AB('w-crack').text).toMatch(/stuns the target for 1 sec\./);
    expect(AB('w-hamstring').text).toMatch(/slows the target by 30% for 3 sec\./);
    expect(AB('w-gash').text).toMatch(/reduced by 20% while it bleeds/);
  });

  it('the talents that made it more: each says what it does now, and does it', () => {
    const t = (name: string) => talent('warrior', name);
    expect(t('Thunderous Rush').tune!['w-rush']!.extra).toEqual([{ k: 'cc', cc: 'stun', dur: 0.5 }]);
    expect(t('Thunderous Rush').text).toBe('Bull Rush also stuns for 0.5 sec.');
    expect(t('Ricochet').tune!['w-hurl']!.cd).toBeUndefined();
    expect(t('Ricochet').text).not.toMatch(/Cooldown/);
    expect(t('Crippling Blows').tune!['w-hamstring']!.extra).toEqual([{ k: 'slow', pct: 45, dur: 3 }]);
    // (Warpath and Run Down keep their seconds off the longer charge)
    expect(AB('w-rush').cd * t('Warpath').tune!['w-rush']!.cd!).toBeCloseTo(12, 6);
    expect(t('Warpath').text).toMatch(/reduced by 3 sec/);
    expect(AB('w-rush').cd * t('Run Down').tune!['w-rush']!.cd!).toBeCloseTo(11, 6);
    expect(t('Run Down').text).toMatch(/reduced by 4 sec/);
    expect(t('Scar Tissue').does).toMatchObject({ k: 'scar', max: 0.06 });
    expect(t('Scar Tissue').text).toMatch(/up to 6%/);
    expect(t('Second Wind').rally).toMatchObject({ pct: 0.08 });
    expect(t('Second Wind').text).toMatch(/8% of your health/);
  });
});

describe('The Pyre’s Cinder Comet: a quarter smaller', () => {
  it('39 across where it was 52, its circle and its fire drawn from the same number', () => {
    expect(AB('m-super').area).toBe(39);
    expect(AB('m-super').area! / 52).toBeCloseTo(0.75, 2);
  });
});

describe('The Hexer’s Soul Drink drinks to its end', () => {
  const drink = (presses: number[], label = '') => {
    const { m, me } = duel('warlock', PRESETS.warlock[0]!.bar);
    me.hp = 300;
    expect(m.press(0, 'k-drain'), label).toBeNull();
    let heals = 0;
    let dartAt: number | null = null;
    for (let i = 0; i < 4.5 / STEP; i++) {
      const t = i * STEP;
      for (const p of presses) if (Math.abs(p - t) < STEP / 2) expect(m.press(0, 'k-dart'), label).toBeNull();
      m.step(STEP, {});
      for (const e of m.events) if (e.k === 'num' && e.id === me.id && e.kind === 'heal') heals++;
      m.events.length = 0;
      if (dartAt === null && me.cast?.ab === 'k-dart') dartAt = t;
    }
    return { heals, dartAt };
  };

  it('left alone, every one of its six ticks heals', () => {
    expect(drink([]).heals).toBe(6);
  });

  it('Blight Dart pressed once while it drinks waits for its end, and goes off then', () => {
    const once = drink([0.7]);
    expect(once.heals).toBe(6);
    expect(once.dartAt).not.toBeNull();
    expect(once.dartAt!).toBeGreaterThanOrEqual(2.9);
    // (pressed again, but not at once: it still waits)
    const slow = drink([0.7, 0.7 + DOUBLE_TAP + 0.3]);
    expect(slow.heals).toBe(6);
  });

  it('pressed twice in quick succession, it breaks the drink off and goes off at once', () => {
    const twice = drink([1.2, 1.4]);
    expect(twice.heals).toBeLessThan(6);
    expect(twice.heals).toBeGreaterThanOrEqual(2);
    expect(twice.dartAt!).toBeLessThan(1.6);
  });
});

describe('The healers: help for their heals, and much less harm', () => {
  it('their damage, down by about two fifths', () => {
    const dmg = (id: string) => AB(id).effects.filter((e) => e.k === 'dmg' || e.k === 'dot').map((e) => (e as { n: number }).n);
    expect(dmg('p-smite')).toEqual([83]);
    expect(dmg('d-judge')).toEqual([39]);
    expect(dmg('l-petal')).toEqual([36, 86]);
    expect(AB('p-smite').text).toBe(`Deals ${Math.round(83 * CLASS_DMG.priest)} damage. Usable while moving.`);
    expect(AB('l-petal').text).toMatch(new RegExp(`^Deals ${Math.round(36 * CLASS_DMG.druid)} damage and ${Math.round(86 * CLASS_DMG.druid)} more over 8 sec`));
    // (the hammer is the Zealot's as well, and stays)
    expect(PRESETS.paladin.filter((p) => p.bar.includes('d-hammer'))).toHaveLength(2);
  });

  it('the heals they cast, 15% more', () => {
    const heal = (id: string) => AB(id).effects.filter((e) => e.k === 'heal' || e.k === 'hot').map((e) => (e as { n: number }).n);
    expect(heal('p-mend')).toEqual([61]);
    expect(heal('d-flash')).toEqual([62]);
    expect(heal('l-regrow')).toEqual([58, 51]);
    expect(AB('p-mend').text).toBe('Heals a friend for 61.');
    expect(AB('d-flash').text).toBe('Heals a friend for 62.');
    expect(AB('l-regrow').text).toBe('Heals a friend for 58 and 51 more over 6 sec.');
  });

  it('no blow knocks a heal back while it is cast; a spell that harms is knocked back as before', () => {
    for (const [cls, id] of [['priest', 'p-mend'], ['paladin', 'd-flash'], ['druid', 'l-regrow']] as const) {
      expect(steadyCast(AB(id)), id).toBe(true);
      const { m, me, foe } = duel(cls, [id], 'warrior', 20);
      expect(m.press(0, id), id).toBeNull();
      m.step(STEP * 6, {});
      const t = me.cast!.t;
      inside(m).damage(foe, me, 40, true, AB('w-hew'));
      inside(m).damage(foe, me, 40, true, AB('w-hew'));
      expect(me.cast!.t, id).toBeCloseTo(t, 6);
    }
    const { m, me, foe } = duel('mage', ['m-lash'], 'warrior', 20);
    expect(steadyCast(AB('m-lash'))).toBe(false);
    expect(m.press(0, 'm-lash')).toBeNull();
    m.step(STEP * 9, {});
    const t = me.cast!.t;
    inside(m).damage(foe, me, 40, true, AB('w-hew'));
    expect(me.cast!.t).toBeCloseTo(t - 0.25, 6);
  });
});

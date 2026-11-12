/** The campaign is hard: foes grow tougher than their level from level 4, the opening night stays as it was. */
import { describe, expect, it } from 'vitest';
import { REGION_IDS, REGIONS } from '../src/games/sigilfall/data/regions';
import { challenge, depth, FIRST_DUNGEON } from '../src/games/sigilfall/sim/world';
import { newWorld, readyHero } from './sigilfall-bot';

describe('sigilfall: a hard campaign', () => {
  it('leaves the first levels as they were, and is at full strength by level 7', () => {
    for (const l of [1, 2, 3]) expect(challenge(l, false)).toEqual({ hp: 1, dmg: 1 });
    expect(challenge(7, false)).toEqual({ hp: 1.3, dmg: 1.4 });
    expect(challenge(40, true)).toEqual({ hp: 1.4, dmg: 1.45 });
    const mid = challenge(5, false);
    expect(mid.hp).toBeGreaterThan(1);
    expect(mid.hp).toBeLessThan(1.3);
  });

  it('a foe in the campaign is tougher than the same foe on Heroic would be without it (Heroic keeps its own measure)', () => {
    const w = newWorld('thornvale', readyHero('warrior', 12));
    const heroic = newWorld('thornvale', readyHero('warrior', 12), 1, 1);
    const a = w.addEnemy('tusk-boar', 0, 0, 12, { room: -1, pack: -1 });
    const b = heroic.addEnemy('tusk-boar', 0, 0, 12, { room: -1, pack: -1 });
    expect(a.maxHp).toBeGreaterThan(Math.round(b.maxHp / 1.9) * 1.25);
    expect(a.dmg).toBeGreaterThan((b.dmg / 1.4) * 1.35);
  });

  it('a dungeon asks a little more than the road to it, and more the deeper it lies; the first one a little less', () => {
    // the open lands and the towns keep the road's own measure
    for (const id of REGION_IDS) if (REGIONS[id].kind !== 'dungeon') expect(depth(REGIONS[id]), id).toEqual({ hp: 1, dmg: 1 });
    // the Chapel Crypt: its blows land 5% lighter, nothing else changed
    expect(FIRST_DUNGEON).toBe('crypt');
    expect(depth(REGIONS.crypt)).toEqual({ hp: 1, dmg: 0.95 });
    // every other dungeon is harder than the road, never by more than 15% and 12%
    const deep = REGION_IDS.filter((id) => REGIONS[id].kind === 'dungeon' && id !== FIRST_DUNGEON);
    expect(deep.length).toBeGreaterThan(10);
    for (const id of deep) {
      const d = depth(REGIONS[id]);
      expect(d.dmg, id).toBeGreaterThanOrEqual(1.03);
      expect(d.dmg, id).toBeLessThanOrEqual(1.15 + 1e-9);
      expect(d.hp, id).toBeGreaterThanOrEqual(1.02);
      expect(d.hp, id).toBeLessThanOrEqual(1.12 + 1e-9);
    }
    // the early ones by a little (they already cost the play-bot falls), the last ones by the most
    expect(depth(REGIONS['gallows-keep'])).toEqual({ hp: 1.02, dmg: 1.03 });
    expect(depth(REGIONS.duskspire).dmg).toBeCloseTo(1.15, 6);
    expect(depth(REGIONS.duskspire).hp).toBeCloseTo(1.12, 6);
    // and it only ever grows with the dungeon's level
    const byLevel = [...deep].sort((a, b) => REGIONS[a].level - REGIONS[b].level);
    for (let i = 1; i < byLevel.length; i++) expect(depth(REGIONS[byLevel[i]!]).dmg, byLevel[i]).toBeGreaterThanOrEqual(depth(REGIONS[byLevel[i - 1]!]).dmg);
  });

  it('what stands in a dungeon carries that measure, and a harder run by choice does not', () => {
    const hero = (): ReturnType<typeof readyHero> => readyHero('warrior', 60, 'epic');
    // the same skeleton at the same level, in the last dungeon and on the road outside it
    const inside = newWorld('duskspire', hero()).addEnemy('skeleton', 0, 0, 60, { room: -1, pack: -1 });
    const outside = newWorld('pale-reach', hero()).addEnemy('skeleton', 0, 0, 60, { room: -1, pack: -1 });
    expect(inside.maxHp / outside.maxHp).toBeCloseTo(1.12, 2);
    expect(inside.dmg / outside.dmg).toBeCloseTo(1.15, 2);
    // the crypt's own: as tough as ever, hitting 5% lighter
    const crypt = newWorld('crypt', readyHero('warrior', 5)).addEnemy('skeleton', 0, 0, 5, { room: -1, pack: -1 });
    const wood = newWorld('whisperwood', readyHero('warrior', 5)).addEnemy('skeleton', 0, 0, 5, { room: -1, pack: -1 });
    expect(crypt.maxHp).toBe(wood.maxHp);
    expect(crypt.dmg / wood.dmg).toBeCloseTo(0.95, 6);
    // Heroic keeps its own measure: Duskspire on Heroic is exactly Heroic's numbers over the plain ones
    const heroic = newWorld('duskspire', hero(), 1, 1).addEnemy('skeleton', 0, 0, 60, { room: -1, pack: -1 });
    const heroicRoad = newWorld('pale-reach', hero(), 1, 1).addEnemy('skeleton', 0, 0, 60, { room: -1, pack: -1 });
    expect(heroic.maxHp).toBe(heroicRoad.maxHp);
    expect(heroic.dmg).toBeCloseTo(heroicRoad.dmg, 6);
  });
});

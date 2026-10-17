import { describe, expect, it } from 'vitest';
import { createProfile } from '../src/progression/profile';
import { buySkin, equipSkin, syncSkinUnlocks, unequipSkin } from '../src/cosmetics/shop';
import { DEFAULT_SKIN_ID, SKINS } from '../src/cosmetics/skins';

describe('skins catalogue', () => {
  it('has 50+ unique cars across many body types, with gameplay unlocks', () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(SKINS.map((s) => s.shape)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    expect(SKINS.filter((s) => s.unlock.type === 'level' || s.unlock.type === 'achievement').length).toBeGreaterThanOrEqual(3);
  });

  it('skins are visually distinct', () => {
    const looks = new Set(SKINS.map((s) => `${s.shape}|${s.body.join()}|${s.stripe}`));
    expect(looks.size).toBe(SKINS.length);
  });
});

describe('shop', () => {
  it('buys with enough coins, deducts the price and persists ownership', () => {
    const p = createProfile();
    p.coins = 1000;
    expect(buySkin(p, 'crimson')).toBe('ok');
    expect(p.coins).toBe(700);
    expect(p.ownedSkins).toContain('crimson');
    expect(buySkin(p, 'crimson')).toBe('owned');
    expect(p.coins).toBe(700);
  });

  it('refuses when short of coins, locked or unknown', () => {
    const p = createProfile();
    p.coins = 10;
    expect(buySkin(p, 'gold')).toBe('insufficient');
    expect(buySkin(p, 'aurora')).toBe('not_for_sale');
    expect(buySkin(p, 'nope')).toBe('unknown');
    expect(p.coins).toBe(10);
  });

  it('equips only owned skins; unequip returns to the starter', () => {
    const p = createProfile();
    expect(equipSkin(p, 'gold')).toBe(false);
    p.coins = 5000;
    buySkin(p, 'gold');
    expect(equipSkin(p, 'gold')).toBe(true);
    expect(p.equippedSkin).toBe('gold');
    unequipSkin(p);
    expect(p.equippedSkin).toBe(DEFAULT_SKIN_ID);
  });

  it('grants level and achievement skins once conditions are met', () => {
    const p = createProfile();
    expect(syncSkinUnlocks(p)).toEqual([]);
    p.level = 8;
    p.achievements.near_100_total = 1;
    const got = syncSkinUnlocks(p).map((s) => s.id).sort();
    expect(got).toEqual(['aurora', 'lime_circuit', 'phantom']);
    expect(syncSkinUnlocks(p)).toEqual([]);
  });
});

describe('catalogue integrity', () => {
  it('every unlock references something real and prices scale with rarity', async () => {
    const { ACHIEVEMENTS } = await import('../src/progression/achievements');
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    const maxPrice: Record<string, number> = { common: 600, rare: 1600, epic: 3500, legendary: 8000, mythic: 20000 };
    for (const s of SKINS) {
      if (s.unlock.type === 'achievement') expect(ids.has(s.unlock.achievementId), s.id).toBe(true);
      if (s.unlock.type === 'coins') expect(s.unlock.price, s.id).toBeLessThanOrEqual(maxPrice[s.rarity]!);
    }
    expect(SKINS.filter((s) => s.shader !== 'none').length).toBeGreaterThanOrEqual(15);
    expect(new Set(SKINS.map((s) => s.trailStyle)).size).toBe(9);
  });
});

import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, STARTING_COINS, createProfile, markOnce, migrate, sanitizeProfile } from '../src/progression/profile';
import { CORRUPT_KEY, MemoryStore, SAVE_KEY, SaveManager } from '../src/progression/storage';
import { DEFAULT_SKIN_ID } from '../src/cosmetics/skins';

describe('profile schema', () => {
  it('creates a sensible new profile', () => {
    const p = createProfile(123);
    expect(p.version).toBe(SAVE_VERSION);
    expect(p.coins).toBe(STARTING_COINS);
    expect(p.ownedSkins).toEqual([DEFAULT_SKIN_ID]);
    expect(p.equippedSkin).toBe(DEFAULT_SKIN_ID);
  });

  it('migrates a v1 save', () => {
    const migrated = migrate({ version: 1, best: 500, skins: ['neon_cyan', 'crimson'], skin: 'crimson', coins: 40 });
    const p = sanitizeProfile(migrated);
    expect(p.version).toBe(SAVE_VERSION);
    expect(p.bestScore).toBe(500);
    expect(p.ownedSkins).toContain('crimson');
    expect(p.equippedSkin).toBe('crimson');
    expect(p.coins).toBe(40);
  });

  it('sanitizes garbage and tampered values', () => {
    expect(sanitizeProfile(null).coins).toBe(STARTING_COINS);
    expect(sanitizeProfile('nope').ownedSkins).toEqual([DEFAULT_SKIN_ID]);
    const p = sanitizeProfile({
      coins: -5, bestScore: Number.NaN, level: 0, ownedSkins: ['bogus', 'gold', 'gold', 7], equippedSkin: 'midnight',
      achievements: { a: 'x', b: 5 }, settings: { sfxVolume: 3, vibration: 'yes' }, daily: { streak: -1 },
    });
    expect(p.coins).toBe(0);
    expect(p.bestScore).toBe(0);
    expect(p.level).toBe(1);
    expect(p.ownedSkins).toEqual([DEFAULT_SKIN_ID, 'gold']);
    expect(p.equippedSkin).toBe(DEFAULT_SKIN_ID); // not owned -> default
    expect(p.achievements).toEqual({ b: 5 });
    expect(p.settings.sfxVolume).toBe(1);
    expect(p.settings.vibration).toBe(true);
    expect(p.daily.streak).toBe(0);
  });

  it('markOnce is idempotent and bounded', () => {
    const list: string[] = [];
    expect(markOnce(list, 'a', 2)).toBe(true);
    expect(markOnce(list, 'a', 2)).toBe(false);
    markOnce(list, 'b', 2);
    markOnce(list, 'c', 2);
    expect(list).toEqual(['b', 'c']);
  });
});

describe('SaveManager', () => {
  it('round-trips a profile', () => {
    const store = new MemoryStore();
    const saves = new SaveManager(store);
    const first = saves.load(1);
    expect(first.status).toBe('new');
    first.profile.coins = 777;
    first.profile.ownedSkins.push('crimson');
    saves.save(first.profile);
    const again = saves.load(2);
    expect(again.status).toBe('loaded');
    expect(again.profile.coins).toBe(777);
    expect(again.profile.ownedSkins).toContain('crimson');
  });

  it('recovers from corrupted JSON and keeps a backup', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{oops');
    const r = new SaveManager(store).load();
    expect(r.status).toBe('recovered');
    expect(r.profile.coins).toBe(STARTING_COINS);
    expect(store.getItem(CORRUPT_KEY)).toBe('{oops');
  });

  it('survives a store that throws', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    const saves = new SaveManager(broken);
    expect(saves.load().status).toBe('new');
    expect(saves.save(createProfile())).toBe(false);
  });
});

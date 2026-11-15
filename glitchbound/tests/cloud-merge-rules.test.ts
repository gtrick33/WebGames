import { describe, expect, it } from 'vitest';
import { mergeSaveText } from '../src/platform/cloudMerge';
import type { Side } from '../src/platform/mergeRules';
import { isSyncedKey, slugOfKey } from '../src/platform/syncKeys';
import { emptySave as emptyGarage, KEY as GARAGE_KEY, newCar, sanitize as sanitizeGarage, type Save as Garage } from '../src/games/launch-control/storage';

const TODAY = '2026-10-29';
const merge = <T>(key: string, local: unknown, remote: unknown, newer: Side): T => JSON.parse(mergeSaveText(key, JSON.stringify(local), JSON.stringify(remote), TODAY, newer)) as T;

describe('Launch Control merge (LC-04)', () => {
  // From a common base ($50,000, 40 parts, best ET 12.0 s): the desktop buys an engine level and runs
  // 11.8 s; the phone buys a Breadbox, wears the tyres to 58 % and plays its last two showdown runs.
  const base = (): Garage => ({ ...emptyGarage(), cash: 50_000, mats: { ...emptyGarage().mats, parts: 40 }, bestEt: 12_000, daily: { [TODAY]: { best: 7000, tries: 1, et: 12_900 } } });
  const desktop = base();
  desktop.cash = 47_000;
  desktop.mats.parts = 32;
  desktop.cars.bumble!.levels.engine = 1;
  desktop.bestEt = 11_800;
  const phone = base();
  phone.cash = 10_000;
  phone.cars.breadbox = newCar();
  phone.car = 'breadbox';
  phone.cars.bumble!.cond.tyres = 58;
  phone.bestEt = 11_900;
  phone.daily[TODAY] = { best: 7400, tries: 3, et: 12_500 };

  it('takes the balance and wear from the copy changed last, joins cars and keeps the best of the rest', () => {
    for (const [local, remote] of [
      [phone, desktop],
      [desktop, phone],
    ] as const) {
      const newer: Side = local === phone ? 'local' : 'remote';
      const m = sanitizeGarage(merge(GARAGE_KEY, local, remote, newer));
      // the phone changed last: its balance stands (no purchase is paid back)
      expect(m.cash).toBe(10_000);
      expect(m.mats.parts).toBe(40);
      expect(m.cars.bumble!.cond.tyres).toBe(58);
      expect(m.car).toBe('breadbox');
      // cars join, levels keep the higher, the faster ET, the day's most runs and best result
      expect(Object.keys(m.cars).sort()).toEqual(['breadbox', 'bumble']);
      expect(m.cars.bumble!.levels.engine).toBe(1);
      expect(m.bestEt).toBe(11_800);
      expect(m.daily[TODAY]).toMatchObject({ best: 7400, tries: 3, et: 12_500 });
    }
  });

  it('the desktop changed last: its balance, and an unset best ET never wins', () => {
    const fresh = { ...desktop, bestEt: 0 };
    const m = sanitizeGarage(merge(GARAGE_KEY, fresh, phone, 'local'));
    expect(m.cash).toBe(47_000);
    expect(m.mats.parts).toBe(32);
    expect(m.cars.bumble!.cond.tyres).toBe(100);
    expect(m.bestEt).toBe(11_900);
  });
});

describe('Sigilfall merge (SFS-01, SFS-10)', () => {
  const KEY = 'glitchbound.sigilfall';
  const hero = (level: number, quests: number, updated: number, para = 0) => ({
    id: 'h1',
    name: 'Ash',
    level,
    para: { l: para, x: 0, p: {} },
    quests: Object.fromEntries(Array.from({ length: quests }, (_, i) => [`q${i}`, 'd'])),
    updated,
  });
  const save = (h: unknown, saved: number, music: number, joystick: number) => ({ v: 11, heroes: [h, null, null], last: 0, settings: { music, sfx: 0.8, joystick }, saved });

  it('keeps the hero that got further, even when a stale copy was opened later', () => {
    // device A played a level-60 hero; device B only opened its old level-38 copy (a newer stamp)
    const a = save(hero(60, 514, 1000), 1000, 0.5, 58);
    const b = save(hero(38, 253, 2000), 2000, 0.5, 58);
    for (const [l, r] of [
      [a, b],
      [b, a],
    ])
      expect(merge<{ heroes: { level: number }[] }>(KEY, l, r, 'local').heroes[0]!.level).toBe(60);
  });

  it('breaks ties by paragon, then quests done, then the copy played last; another hero in the slot goes by the stamp', () => {
    const top = <T>(l: unknown, r: unknown) => merge<{ heroes: T[] }>(KEY, save(l, 1, 0.5, 58), save(r, 1, 0.5, 58), 'local').heroes[0]!;
    expect(top<{ para: { l: number } }>(hero(60, 10, 5, 2), hero(60, 99, 9, 3)).para.l).toBe(3);
    expect(top<{ updated: number }>(hero(60, 12, 5), hero(60, 11, 9)).updated).toBe(5);
    expect(top<{ updated: number }>(hero(60, 12, 5), hero(60, 12, 9)).updated).toBe(9);
    expect(top<{ id: string }>({ ...hero(60, 12, 5), id: 'old' }, { ...hero(2, 0, 9), id: 'new' }).id).toBe('new');
  });

  it('takes the settings whole from the copy saved last, never the larger number', () => {
    const a = save(hero(10, 1, 1), 3000, 0.1, 44); // lowered here, last
    const b = save(hero(10, 1, 1), 2000, 0.55, 58);
    for (const [l, r] of [
      [a, b],
      [b, a],
    ])
      expect(merge<{ settings: unknown }>(KEY, l, r, 'remote').settings).toEqual({ music: 0.1, sfx: 0.8, joystick: 44 });
  });

  it('settings of any game follow the copy changed last', () => {
    const m = merge<{ best: number; settings: { volume: number } }>('glitchbound.fussbox', { best: 5, settings: { volume: 0.2 } }, { best: 9, settings: { volume: 0.9 } }, 'local');
    expect(m).toEqual({ best: 9, settings: { volume: 0.2 } });
    expect(merge<{ settings: { volume: number } }>('glitchbound.fussbox', { settings: { volume: 0.2 } }, { settings: { volume: 0.9 } }, 'remote').settings.volume).toBe(0.9);
  });
});

describe('Sigilfall Ring merge (sigilfall.ring.v1)', () => {
  const RING = 'sigilfall.ring.v1';
  const set = (bar: string[]) => ({ bar, oath: 'iron', talents: [] as string[] });
  type Ring = { sets: Record<string, { active: number; list: { bar: string[] }[]; at?: number }>; standings: Record<string, { rating: number; best: number; wins: number; losses: number }>; learn?: { asked: boolean; done: boolean; hints: string[] } };

  it('syncs with the account', () => {
    expect(isSyncedKey(RING)).toBe(true);
  });

  it('takes a class’s setups whole from the copy changed last, the setup in hand with them, never the larger number', () => {
    const phone = { standings: {}, sets: { warrior: { active: 2, list: [set(['a']), set(['b']), set(['c'])], at: 1000 }, mage: { active: 1, list: [set(['m1']), set(['m2']), set(['m3'])], at: 5000 } } };
    // the computer changed the warrior's later (back to Setup 1, a new bar), the phone the mage's
    const desk = { standings: {}, sets: { warrior: { active: 0, list: [set(['x']), set(['b']), set(['c'])], at: 3000 }, mage: { active: 0, list: [set(['old']), set(['m2']), set(['m3'])], at: 2000 } } };
    for (const newer of ['local', 'remote'] as const) {
      const m = merge<Ring>(RING, phone, desk, newer);
      expect(m.sets.warrior!.active).toBe(0);
      expect(m.sets.warrior!.list[0]!.bar).toEqual(['x']);
      expect(m.sets.mage!.active).toBe(1);
      expect(m.sets.mage!.list[0]!.bar).toEqual(['m1']);
    }
  });

  it('a setup kept before the stamps follows the copy changed last; a class only one copy has is kept', () => {
    const a = { standings: {}, sets: { priest: { active: 1, list: [set(['p'])] } } };
    const b = { standings: {}, sets: { priest: { active: 0, list: [set(['q'])] }, druid: { active: 2, list: [set(['d'])], at: 9 } } };
    expect(merge<Ring>(RING, a, b, 'local').sets.priest!.list[0]!.bar).toEqual(['p']);
    expect(merge<Ring>(RING, a, b, 'remote').sets.priest!.list[0]!.bar).toEqual(['q']);
    expect(merge<Ring>(RING, a, b, 'local').sets.druid!.active).toBe(2);
  });

  it('takes a format’s standing whole from the copy that fought more, keeping the best either reached', () => {
    const a = { sets: {}, standings: { 1: { rating: 1180, best: 1260, wins: 6, losses: 4 }, 2: { rating: 1050, best: 1050, wins: 1, losses: 0 } } };
    const b = { sets: {}, standings: { 1: { rating: 1300, best: 1300, wins: 4, losses: 1 }, 2: { rating: 990, best: 1030, wins: 2, losses: 3 } } };
    const m = merge<Ring>(RING, a, b, 'remote');
    expect(m.standings[1]).toEqual({ rating: 1180, best: 1300, wins: 6, losses: 4 });
    expect(m.standings[2]).toEqual({ rating: 990, best: 1050, wins: 2, losses: 3 });
  });

  it('joins what the Ring has taught', () => {
    const m = merge<Ring>(RING, { sets: {}, standings: {}, learn: { asked: true, done: false, hints: ['circle'] } }, { sets: {}, standings: {}, learn: { asked: false, done: true, hints: ['super', 'circle'] } }, 'local');
    expect(m.learn).toEqual({ asked: true, done: true, hints: ['circle', 'super'] });
  });
});

describe('NEON RUSH merge (NR-02)', () => {
  it('syncs neonrush.save as the neon-rush game', () => {
    expect(isSyncedKey('neonrush.save')).toBe(true);
    expect(slugOfKey('neonrush.save')).toBe('neon-rush');
    expect(isSyncedKey('neonrush.save.corrupt')).toBe(false);
  });

  it('keeps the larger coins, xp and bests and joins cars, achievements and processed ids', () => {
    const a = { coins: 500, xp: 900, level: 4, bestScore: 1200, bestDistance: 800, ownedSkins: ['default', 'red'], equippedSkin: 'red', achievements: { first: 100, ten: 300 }, processedRunIds: ['r1', 'r3'], grantedRewardIds: ['g1'], playerId: 'pa', playerName: '', settings: { sfxVolume: 0.2 }, daily: { lastClaimDay: '2026-10-29', streak: 2 } };
    const b = { coins: 300, xp: 1500, level: 5, bestScore: 1500, bestDistance: 600, ownedSkins: ['default', 'blue'], equippedSkin: 'blue', achievements: { first: 50, far: 200 }, processedRunIds: ['r1', 'r2'], grantedRewardIds: ['g2'], playerId: 'pb', playerName: 'Zed', settings: { sfxVolume: 0.9 }, daily: { lastClaimDay: '2026-10-27', streak: 7 } };
    const m = merge<typeof a>('neonrush.save', a, b, 'local');
    expect(m).toMatchObject({ coins: 500, xp: 1500, level: 5, bestScore: 1500, bestDistance: 800, equippedSkin: 'red', playerId: 'pb', playerName: 'Zed', settings: { sfxVolume: 0.2 }, daily: { lastClaimDay: '2026-10-29', streak: 2 } });
    expect(m.ownedSkins.sort()).toEqual(['blue', 'default', 'red']);
    expect(m.achievements).toEqual({ first: 50, ten: 300, far: 200 });
    // the account's ids first, then the ones this device just added (a capped list keeps the newest)
    expect(m.processedRunIds).toEqual(['r1', 'r2', 'r3']);
    expect(m.grantedRewardIds).toEqual(['g2', 'g1']);
  });
});

describe('games without a rule', () => {
  it('keep the shared merge', () => {
    expect(merge('glitchbound.gloop', { best: 3, rounds: 9 }, { best: 7, rounds: 2 }, 'remote')).toEqual({ best: 7, rounds: 9 });
  });
});

import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { CARS, getCar } from '../src/games/launch-control/cars';
import { COSMETICS, DEFAULTS, getCosmetic } from '../src/games/launch-control/cosmetics';
import { addMats, forecast, idleIncome, idleRate, LADDER, LADDER_SIZE, loanerFor, materialsFor, opponentSpec, purseAt, settle } from '../src/games/launch-control/economy';
import { applyWear, effectsOf, failChance, freshCondition, MAX_LEVEL, PARTS, raceWear, repairCost, RISKY, stockLevels, upgradeCost, type Levels } from '../src/games/launch-control/parts';
import { decodeScript, encodeScript, forecastEt, idealLaunchRpm, launchWindow, Race, scoreOf, simulate, specOf, tractionLimit, engineForce, type CarSpec } from '../src/games/launch-control/sim';
import { emptySave, sanitize } from '../src/games/launch-control/storage';
import { rng } from '../src/games/launch-control/util';

const fresh = freshCondition();
const maxed: Levels = { engine: 8, transmission: 8, suspension: 8, tyres: 8, aero: 8, looks: 8 };
const stock = (id: string): CarSpec => specOf(getCar(id), stockLevels(), fresh, false);

describe('roster', () => {
  it('has at least 30 cars with unique ids and names, and no real makes', () => {
    expect(CARS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CARS.map((c) => c.id)).size).toBe(CARS.length);
    expect(new Set(CARS.map((c) => c.name)).size).toBe(CARS.length);
    const banned = /\b(ford|toyota|honda|nissan|ferrari|lamborghini|porsche|bugatti|tesla|dodge|chevrolet|bmw|mercedes|audi|volkswagen|mustang|supra|skyline|corvette|camaro|viper|chiron|mazda|subaru|mitsubishi|koenigsegg)\b/i;
    for (const c of CARS) {
      expect(`${c.name} ${c.maker} ${c.blurb}`).not.toMatch(banned);
      expect(c.hp).toBeGreaterThan(0);
      expect(c.mass).toBeGreaterThan(500);
      expect(c.gears).toBeGreaterThanOrEqual(1);
      expect(c.reliability).toBeGreaterThan(0);
      expect(c.reliability).toBeLessThanOrEqual(1);
    }
    expect(CARS.filter((c) => c.price === 0)).toHaveLength(1);
  });

  it('faster tiers run quicker quarter miles, and every car finishes between 3 and 20 s', () => {
    const byTier = new Map<number, number[]>();
    for (const c of CARS) {
      const et = forecastEt(stock(c.id), 1);
      expect(et, c.id).toBeGreaterThan(3);
      expect(et, c.id).toBeLessThan(20);
      byTier.set(c.tier, [...(byTier.get(c.tier) ?? []), et]);
    }
    const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    for (let t = 1; t < 6; t++) expect(avg(byTier.get(t)!)).toBeGreaterThan(avg(byTier.get(t + 1)!));
  });

  it('every upgrade level makes the car quicker, and maxed is at least 20 % quicker than stock', () => {
    for (const c of [getCar('bumble'), getCar('tsubasa'), getCar('veyr')]) {
      let prev = forecastEt(specOf(c, stockLevels(), fresh, false), 1);
      for (let l = 1; l <= MAX_LEVEL; l++) {
        const lv: Levels = { engine: l, transmission: l, suspension: l, tyres: l, aero: l, looks: l };
        const et = forecastEt(specOf(c, lv, fresh, false), 1);
        expect(et, `${c.id} level ${l}`).toBeLessThan(prev);
        prev = et;
      }
      expect(prev).toBeLessThan(forecastEt(specOf(c, stockLevels(), fresh, false), 1) * 0.8);
    }
  });
});

describe('the race', () => {
  it('is deterministic: same cars, drivers and seed give the same result', () => {
    const a = stock('stallion');
    const b = stock('tsubasa');
    const drivers = [{ kind: 'policy', skill: 0.7, seed: 4 }, { kind: 'policy', skill: 0.5, seed: 9 }] as const;
    const r1 = simulate([a, b], [drivers[0], drivers[1]], 77);
    const r2 = simulate([a, b], [drivers[0], drivers[1]], 77);
    expect(r1).toEqual(r2);
    expect(r1.racers[0].et).not.toBeNull();
    expect(r1.winner).not.toBeNull();
  });

  it('a clean launch beats wheelspin, which beats a bogged launch', () => {
    const spec = stock('lazzaro');
    const ref = simulate([spec, spec], [{ kind: 'policy', skill: 1, seed: 1 }, { kind: 'policy', skill: 1, seed: 1 }], 3).racers[0].script;
    const run = (launchRpm: number): number => {
      const d = { kind: 'script', script: { ...ref, launchRpm } } as const;
      return simulate([spec, spec], [d, d], 3).racers[0].et!;
    };
    const ideal = idealLaunchRpm(spec);
    const [lo, hi] = launchWindow(spec);
    expect(ideal).toBeGreaterThanOrEqual(lo);
    expect(ideal).toBeLessThanOrEqual(hi);
    expect(run(ideal)).toBeLessThan(run(spec.redline));
    expect(run(spec.redline)).toBeLessThan(run(1200));
    expect(engineForce(spec, ideal, 1)).toBeLessThanOrEqual(tractionLimit(spec, true));
  });

  it('a live driver who lets go before green gets a red light and scores 0', () => {
    const spec = stock('kestrel');
    const race = new Race([spec, spec], [{ kind: 'live' }, { kind: 'policy', skill: 0.5, seed: 1 }], 5);
    race.pedal(0, true);
    for (let i = 0; i < 60; i++) race.step();
    race.pedal(0, false);
    while (!race.done) race.step();
    const r = race.result();
    expect(r.racers[0].fault).toBe('red');
    expect(scoreOf(r.racers[0])).toBe(0);
    expect(r.winner).toBe(1);
  });

  it('a live driver can race: hold, release at green, shift near the redline', () => {
    const spec = stock('comet-ss');
    const race = new Race([spec, spec], [{ kind: 'live' }, { kind: 'policy', skill: 0.6, seed: 2 }], 11);
    race.pedal(0, true);
    let released = false;
    let perfectTaps = 0;
    while (!race.done) {
      race.step();
      const me = race.racers[0];
      if (!released && race.green) {
        // hold the revs near the sweet spot before letting go
        me.rpm = idealLaunchRpm(spec);
        race.pedal(0, false);
        released = true;
      }
      if (me.phase === 'running' && me.gear < spec.gears && me.slip <= 0 && me.rpm >= spec.redline * 0.95) {
        race.tap(0);
        perfectTaps++;
      }
    }
    const r = race.result();
    expect(r.racers[0].fault).toBeNull();
    expect(r.racers[0].et).toBeGreaterThan(5);
    // The line can come before top gear: every tap taken was a perfect one.
    expect(r.racers[0].shifts).toBeLessThanOrEqual(spec.gears - 1);
    expect(r.racers[0].shifts).toBeGreaterThanOrEqual(3);
    expect(r.racers[0].perfect).toBe(perfectTaps);
    expect(scoreOf(r.racers[0])).toBeGreaterThan(5000);
    expect(r.racers[0].reaction).toBeGreaterThanOrEqual(0);
  });

  it('skill shows: a perfect driver beats a poor one in the same car, mostly by reaction and launch', () => {
    const spec = stock('vortex');
    let wins = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = simulate([spec, spec], [{ kind: 'policy', skill: 1, seed }, { kind: 'policy', skill: 0.2, seed: seed + 100 }], seed);
      if (r.winner === 0) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(18);
  });

  it('a worn engine can let go, a fresh one never does', () => {
    const def = getCar('rotary-rebel');
    const worn = specOf(def, stockLevels(), { ...fresh, engine: 5 }, true);
    const ok = specOf(def, stockLevels(), fresh, true);
    expect(ok.risky).toHaveLength(0);
    expect(worn.risky[0]!.chance).toBeGreaterThan(0.3);
    let fails = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = simulate([worn, ok], [{ kind: 'policy', skill: 0.8, seed }, { kind: 'policy', skill: 0.8, seed }], seed);
      if (r.racers[0].failure === 'engine') fails++;
      expect(r.racers[1].failure).toBeNull();
    }
    expect(fails).toBeGreaterThan(5);
    expect(failChance(RISKY, 0.5)).toBe(0);
    expect(failChance(0, 0.5)).toBeGreaterThan(failChance(15, 0.5));
  });

  it('replays round-trip and a ghost drives the same race again', () => {
    const spec = stock('falkon');
    const r = simulate([spec, spec], [{ kind: 'policy', skill: 0.9, seed: 3 }, { kind: 'policy', skill: 0.4, seed: 4 }], 21);
    const enc = encodeScript(r.racers[0].script);
    expect(enc.length).toBeLessThan(200);
    const dec = decodeScript(enc)!;
    expect(dec.shifts).toEqual(r.racers[0].script.shifts);
    const again = simulate([spec, spec], [{ kind: 'script', script: dec }, { kind: 'policy', skill: 0.4, seed: 4 }], 21);
    expect(Math.abs(again.racers[0].et! - r.racers[0].et!)).toBeLessThan(0.02);
    expect(decodeScript('nope')).toBeNull();
    expect(decodeScript('lc1,3000,100,2000,1000')).toBeNull();
  });

  it('scores stay within the registry limits', () => {
    const g = getGame('launch-control')!;
    const best = simulate([specOf(getCar('rail'), maxed, fresh, false), stock('rail')], [{ kind: 'policy', skill: 1, seed: 1 }, { kind: 'policy', skill: 1, seed: 1 }], 1);
    const score = scoreOf(best.racers[0]);
    expect(score).toBeGreaterThan(14000);
    expect(score).toBeLessThan(g.limits!.scorePerSecond * g.limits!.minSeconds!);
  });
});

describe('parts and economy', () => {
  it('upgrade costs rise with level and need materials by division', () => {
    const car = getCar('kurogane-gt');
    let prev = 0;
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const c = upgradeCost(car, 'engine', l);
      expect(c.cash).toBeGreaterThan(prev);
      prev = c.cash;
      expect(Object.values(c.mats).some((n) => n! > 0)).toBe(true);
    }
    expect(upgradeCost(car, 'engine', 8).mats.chips).toBeGreaterThan(0);
    expect(upgradeCost(car, 'tyres', 1).mats.rubber).toBeGreaterThan(0);
  });

  it('effects grow with levels and shrink with wear', () => {
    const a = effectsOf(stockLevels(), fresh);
    const b = effectsOf(maxed, fresh);
    expect(b.torqueMul).toBeGreaterThan(a.torqueMul);
    expect(b.shiftTime).toBeLessThan(a.shiftTime);
    expect(b.gripMul).toBeGreaterThan(a.gripMul);
    expect(b.dragMul).toBeLessThan(a.dragMul);
    expect(b.fansMul).toBeGreaterThan(1);
    const worn = effectsOf(maxed, { ...fresh, tyres: 0, engine: 0 });
    expect(worn.gripMul).toBeLessThan(b.gripMul);
    expect(worn.torqueMul).toBeLessThan(b.torqueMul);
  });

  it('wear never pushes a condition out of range and spinning costs tyres most', () => {
    const w = raceWear({ spinTime: 1.5, limiterTime: 0.5, missedShifts: 2, dnf: false });
    expect(w.tyres).toBeGreaterThan(w.engine);
    const c = applyWear({ ...fresh, tyres: 3 }, w);
    expect(c.tyres).toBe(0);
    for (const p of PARTS) {
      expect(c[p]).toBeGreaterThanOrEqual(0);
      expect(c[p]).toBeLessThanOrEqual(100);
    }
    expect(repairCost(getCar('veyr'), 'engine', 0)).toBeGreaterThan(repairCost(getCar('bumble'), 'engine', 0));
    expect(repairCost(getCar('veyr'), 'engine', 100)).toBe(0);
  });

  it('the ladder has 40 rivals, climbing in purse and pace, with champions every eighth rung', () => {
    expect(LADDER).toHaveLength(LADDER_SIZE);
    expect(LADDER).toHaveLength(40);
    expect(new Set(LADDER.map((o) => o.name)).size).toBe(40);
    for (let i = 2; i <= LADDER.length; i++) expect(purseAt(i, false)).toBeGreaterThan(purseAt(i - 1, false));
    expect(LADDER[7]!.purse).toBeGreaterThan(LADDER[8]!.purse);
    expect(LADDER.filter((o) => o.boss)).toHaveLength(5);
    expect(purseAt(16, true)).toBe(purseAt(16, false) * 2);
    const ets = LADDER.map((o) => forecastEt(opponentSpec(o), o.skill));
    const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    for (let d = 0; d < 4; d++) expect(avg(ets.slice(d * 8, d * 8 + 8))).toBeGreaterThan(avg(ets.slice(d * 8 + 8, d * 8 + 16)));
    // The first rival is beatable in the starter car.
    const start = specOf(getCar('bumble'), stockLevels(), fresh, false);
    expect(forecast(start, opponentSpec(LADDER[0]!), LADDER[0]!.skill).pWin).toBeGreaterThan(0.35);
  });

  it('forecast odds and payouts: underdogs pay more, settlements add up', () => {
    const weak = stock('bumble');
    const strong = stock('falkon');
    const f1 = forecast(weak, strong, 0.8);
    const f2 = forecast(strong, weak, 0.8);
    expect(f1.pWin).toBeLessThan(0.2);
    expect(f2.pWin).toBeGreaterThan(0.8);
    expect(f1.mult).toBeGreaterThan(f2.mult);
    const win = settle({ won: true, purse: 1000, fansMul: 1.2, stake: 500, mult: 2.5, firstWin: true });
    expect(win).toEqual({ purse: 1200, wager: 750, bonus: 2000 });
    const loss = settle({ won: false, purse: 1000, fansMul: 1.2, stake: 500, mult: 2.5, firstWin: false });
    expect(loss).toEqual({ purse: 100, wager: -500, bonus: 0 });
  });

  it('materials come by division, doubled on a first win, and add up', () => {
    const a = materialsFor(LADDER[0]!, false, 1);
    const b = materialsFor(LADDER[0]!, true, 1);
    expect(b.scrap).toBe(a.scrap! * 2);
    expect(a.chips).toBeUndefined();
    expect(materialsFor(LADDER[30]!, false, 1).chips).toBeGreaterThan(0);
    const have = addMats({ scrap: 1, alloy: 0, carbon: 0, chips: 0, rubber: 0 }, b);
    expect(have.scrap).toBe(1 + b.scrap!);
    expect(addMats(have, { scrap: 999 }, -1).scrap).toBe(0);
  });

  it('sponsor income grows with rank and caps at eight hours', () => {
    expect(idleRate(0)).toBeLessThan(idleRate(20));
    expect(idleIncome(10, 3600_000 * 2)).toBe(Math.floor(idleRate(10) * 2));
    expect(idleIncome(10, 3600_000 * 30)).toBe(idleIncome(10, 3600_000 * 8));
    expect(idleIncome(10, -5)).toBe(0);
  });

  it('the daily loaner is the same for a seed and fair between the two cars', () => {
    const a = loanerFor(123);
    const b = loanerFor(123);
    expect(a).toEqual(b);
    const seen = new Set<string>();
    for (let s = 1; s <= 60; s++) {
      const l = loanerFor(s);
      seen.add(l.car.id);
      expect(Math.abs(l.car.tier - l.opponent.car.tier)).toBeLessThanOrEqual(1);
      expect(getCosmetic(l.env)?.kind).toBe('env');
    }
    expect(seen.size).toBeGreaterThan(15);
  });
});

describe('cosmetics and the save', () => {
  it('every kind has a free default and unique ids', () => {
    const ids = new Set<string>();
    for (const [kind, list] of Object.entries(COSMETICS)) {
      expect(list.some((c) => c.price === 0)).toBe(true);
      expect(getCosmetic(DEFAULTS[kind as keyof typeof DEFAULTS])?.kind).toBe(kind);
      for (const c of list) {
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
        expect(c.kind).toBe(kind);
      }
    }
  });

  it('sanitizes a damaged save and keeps the starter car', () => {
    const s = sanitize({ cash: -5, cars: { nope: {}, veyr: { levels: { engine: 99 }, cond: { tyres: -4 }, paint: 'h-red' } }, car: 'veyr', rank: 99, owned: ['h-red', 'zzz'], helmet: 'p-red', daily: { '2026-10-21': { best: 12, tries: 2, open: true }, bad: {} } });
    expect(s.cash).toBe(0);
    expect(s.cars.bumble).toBeDefined();
    expect(s.cars.nope).toBeUndefined();
    expect(s.cars.veyr!.levels.engine).toBe(MAX_LEVEL);
    expect(s.cars.veyr!.cond.tyres).toBe(0);
    expect(s.cars.veyr!.paint).toBe(DEFAULTS.paint);
    expect(s.car).toBe('veyr');
    expect(s.rank).toBe(40);
    expect(s.owned).toEqual(['h-red']);
    expect(s.helmet).toBe(DEFAULTS.helmet);
    expect(s.daily['2026-10-21']).toEqual({ best: 12, tries: 2, et: 0, open: true });
    expect(s.daily.bad).toBeUndefined();
    expect(sanitize(null)).toEqual(emptySave());
  });

  it('the seeded rng is deterministic and uniform-ish', () => {
    const a = rng(42);
    const b = rng(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.reduce((p, q) => p + q, 0) / 1000).toBeGreaterThan(0.45);
    expect(xs.reduce((p, q) => p + q, 0) / 1000).toBeLessThan(0.55);
  });
});

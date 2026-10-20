import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { CARS, getCar } from '../src/games/launch-control/cars';
import { COSMETICS, DEFAULTS, getCosmetic } from '../src/games/launch-control/cosmetics';
import { addMats, botsFor, botSpec, crateFor, forecast, idleIncome, idleRate, LADDER, LADDER_SIZE, loanerFor, materialsFor, opponentSpec, purseAt, RACE_SIZE, settle, typicalEt } from '../src/games/launch-control/economy';
import { ENV_DEFS } from '../src/games/launch-control/envs';
import { applyWear, effectsOf, failChance, freshCondition, levelGains, MAX_LEVEL, PARTS, raceWear, repairCost, RISKY, stockLevels, upgradeCost, type Levels } from '../src/games/launch-control/parts';
import { decodeScript, encodeScript, engineForce, forecastEt, forecastRun, idealLaunchRpm, PLAYER_REACTION, Race, scoreOf, simulate, specOf, tractionLimit, type CarSpec, type Driver } from '../src/games/launch-control/sim';
import { emptySave, sanitize } from '../src/games/launch-control/storage';
import { rng } from '../src/games/launch-control/util';

const fresh = freshCondition();
const maxed: Levels = { engine: 8, transmission: 8, suspension: 8, tyres: 8, aero: 8, looks: 8 };
const stock = (id: string): CarSpec => specOf(getCar(id), stockLevels(), fresh, false);
const policy = (skill: number, seed: number): Driver => ({ kind: 'policy', skill, seed });

describe('roster', () => {
  it('has at least 40 cars with unique ids and names, shapes that make sense, and no real makes', () => {
    expect(CARS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(CARS.map((c) => c.id)).size).toBe(CARS.length);
    expect(new Set(CARS.map((c) => c.name)).size).toBe(CARS.length);
    const banned = /\b(ford|toyota|honda|nissan|ferrari|lamborghini|porsche|bugatti|tesla|dodge|chevrolet|bmw|mercedes|audi|volkswagen|mustang|supra|skyline|corvette|camaro|viper|chiron|mazda|subaru|mitsubishi|koenigsegg|pagani|renault|opel|peugeot|mclaren|rimac|volvo|mini|fiat|jaguar|aston)\b/i;
    for (const c of CARS) {
      expect(`${c.name} ${c.maker} ${c.blurb} ${c.kind}`).not.toMatch(banned);
      expect(c.hp).toBeGreaterThan(0);
      expect(c.mass).toBeGreaterThan(500);
      expect(c.gears).toBeGreaterThanOrEqual(1);
      const sh = c.shape;
      expect(sh.len).toBeGreaterThan(3);
      expect(sh.width).toBeGreaterThan(0.7);
      expect(sh.cabin.roof).toBeGreaterThan(sh.belt);
      expect(sh.cabin.to).toBeGreaterThan(sh.cabin.from);
      expect(sh.wheels.front).toBeGreaterThan(sh.wheels.rear);
      expect(sh.clear).toBeLessThan(sh.wheels.r + 0.2);
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
    const specs = [stock('stallion'), stock('tsubasa'), stock('kaiser'), stock('astro'), stock('lazzaro')];
    const drivers = [policy(0.7, 4), policy(0.5, 9), policy(0.6, 2), policy(0.4, 3), policy(0.8, 5)];
    const r1 = simulate(specs, drivers, 77);
    const r2 = simulate(specs, drivers, 77);
    expect(r1).toEqual(r2);
    expect(r1.racers.every((r) => r.et !== null)).toBe(true);
    expect(r1.order).toHaveLength(5);
    expect(new Set(r1.order).size).toBe(5);
    for (let i = 1; i < 5; i++) expect(r1.racers[r1.order[i]!]!.crossed!).toBeGreaterThanOrEqual(r1.racers[r1.order[i - 1]!]!.crossed!);
    expect(r1.winner).toBe(r1.order[0]);
  });

  it('launch control leaves at green at the sweet spot, so a live driver never spins or bogs', () => {
    const spec = stock('lazzaro');
    const race = new Race([spec], [{ kind: 'live' }], 3);
    while (!race.done) race.step();
    const r = race.result().racers[0]!;
    expect(r.reaction).toBeCloseTo(PLAYER_REACTION, 2);
    expect(r.script.launchRpm).toBe(idealLaunchRpm(spec));
    expect(r.spinTime).toBe(0);
    expect(engineForce(spec, idealLaunchRpm(spec), 1)).toBeLessThanOrEqual(tractionLimit(spec, true));
  });

  it('a scripted launch below the sweet spot bogs and above it spins; both lose time', () => {
    const spec = stock('lazzaro');
    const ref = simulate([spec], [policy(1, 1)], 3).racers[0]!.script;
    const run = (launchRpm: number): number => simulate([spec], [{ kind: 'script', script: { ...ref, launchRpm } }], 3).racers[0]!.et!;
    const ideal = idealLaunchRpm(spec);
    expect(run(ideal)).toBeLessThan(run(spec.redline));
    expect(run(ideal)).toBeLessThan(run(1200));
  });

  it('a live driver races by shifting only: perfect taps count, no tap means the limiter', () => {
    const spec = stock('comet-ss');
    const race = new Race([spec, stock('kaiser')], [{ kind: 'live' }, policy(0.6, 2)], 11);
    let taps = 0;
    while (!race.done) {
      race.step();
      const me = race.racers[0]!;
      if (me.phase === 'running' && me.gear < spec.gears && me.slip <= 0 && me.rpm >= spec.redline * 0.95) {
        race.tap(0);
        taps++;
      }
    }
    const r = race.result().racers[0]!;
    expect(r.dnf).toBe(false);
    expect(r.perfect).toBe(taps);
    expect(r.perfect).toBeGreaterThanOrEqual(3);
    expect(scoreOf(r)).toBeGreaterThan(5000);
    // the same car with no taps at all bounces off the limiter in first and is far slower
    const lazy = simulate([spec], [{ kind: 'live' }], 11).racers[0]!;
    expect(lazy.limiterTime).toBeGreaterThan(1);
    expect(lazy.et === null || lazy.et > r.et! + 2).toBe(true);
  });

  it('skill shows: a perfect driver beats a poor one in the same car', () => {
    const spec = stock('vortex');
    let wins = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = simulate([spec, spec], [policy(1, seed), policy(0.2, seed + 100)], seed);
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
      const r = simulate([worn, ok], [policy(0.8, seed), policy(0.8, seed)], seed);
      if (r.racers[0]!.failure === 'engine') fails++;
      expect(r.racers[1]!.failure).toBeNull();
    }
    expect(fails).toBeGreaterThan(5);
    expect(failChance(RISKY, 0.5)).toBe(0);
    expect(failChance(0, 0.5)).toBeGreaterThan(failChance(15, 0.5));
  });

  it('replays round-trip and a ghost drives the same race again', () => {
    const spec = stock('falkon');
    const r = simulate([spec, spec], [policy(0.9, 3), policy(0.4, 4)], 21);
    const enc = encodeScript(r.racers[0]!.script);
    expect(enc.length).toBeLessThan(200);
    const dec = decodeScript(enc)!;
    expect(dec.shifts).toEqual(r.racers[0]!.script.shifts);
    const again = simulate([spec, spec], [{ kind: 'script', script: dec }, policy(0.4, 4)], 21);
    expect(Math.abs(again.racers[0]!.et! - r.racers[0]!.et!)).toBeLessThan(0.02);
    expect(decodeScript('nope')).toBeNull();
    expect(decodeScript('lc1,3000,100,2000,1000')).toBeNull();
  });

  it('scores stay within the registry limits and the forecast reports 0-100 and trap speed', () => {
    const g = getGame('launch-control')!;
    const best = simulate([specOf(getCar('rail'), maxed, fresh, false)], [policy(1, 1)], 1);
    const score = scoreOf(best.racers[0]!);
    expect(score).toBeGreaterThan(14000);
    expect(score).toBeLessThan(g.limits!.scorePerSecond * g.limits!.minSeconds!);
    const run = forecastRun(stock('falkon'), 0.9);
    expect(run.t100).toBeGreaterThan(1);
    expect(run.t100).toBeLessThan(run.et);
    expect(run.trap).toBeGreaterThan(150);
    expect(() => new Race([], [], 1)).toThrow();
  });
});

describe('parts and economy', () => {
  it('upgrade costs rise with level, need materials by division, and each part moves several stats', () => {
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
    for (const p of PARTS) expect(levelGains(p).length).toBeGreaterThanOrEqual(2);
    const a = effectsOf(stockLevels(), fresh);
    const eng = effectsOf({ ...stockLevels(), engine: 4 }, fresh);
    expect(eng.torqueMul).toBeGreaterThan(a.torqueMul);
    expect(eng.massAdd).toBeGreaterThan(a.massAdd);
    expect(eng.reliabilityAdd).toBeLessThan(a.reliabilityAdd);
    const sus = effectsOf({ ...stockLevels(), suspension: 4 }, fresh);
    expect(sus.launchGrip).toBeGreaterThan(a.launchGrip);
    expect(sus.massAdd).toBeLessThan(a.massAdd);
    const aero = effectsOf({ ...stockLevels(), aero: 4 }, fresh);
    expect(aero.dragMul).toBeLessThan(a.dragMul);
    expect(aero.downforce).toBeGreaterThan(0);
    const looks = effectsOf({ ...stockLevels(), looks: 4 }, fresh);
    expect(looks.fansMul).toBeGreaterThan(1);
    expect(looks.sponsorMul).toBeGreaterThan(1);
  });

  it('effects grow with levels and shrink with wear', () => {
    const a = effectsOf(stockLevels(), fresh);
    const b = effectsOf(maxed, fresh);
    expect(b.torqueMul).toBeGreaterThan(a.torqueMul);
    expect(b.shiftTime).toBeLessThan(a.shiftTime);
    expect(b.gripMul).toBeGreaterThan(a.gripMul);
    expect(b.dragMul).toBeLessThan(a.dragMul);
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
    for (const o of LADDER) expect(getCar(o.car).id).toBe(o.car);
    const ets = LADDER.map((o) => forecastEt(opponentSpec(o), o.skill));
    const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    for (let d = 0; d < 4; d++) expect(avg(ets.slice(d * 8, d * 8 + 8))).toBeGreaterThan(avg(ets.slice(d * 8 + 8, d * 8 + 16)));
  });

  it('bots fill a race with cars like yours, the rival among them, and the first rung is winnable', () => {
    const start = specOf(getCar('bumble'), stockLevels(), fresh, false);
    const bots = botsFor(start, RACE_SIZE - 1, 42, LADDER[0]!);
    expect(bots).toHaveLength(4);
    expect(bots[0]!.rival).toBe(LADDER[0]);
    const myBest = forecastEt(start, 1, 3);
    for (const b of bots.slice(1)) {
      expect(Math.abs(b.car.tier - 1)).toBeLessThanOrEqual(1);
      // their perfect run is a little behind yours; their driver only loses time from there
      expect(forecastEt(botSpec(b), 1, 3)).toBeGreaterThan(myBest - 0.15);
      expect(forecastEt(botSpec(b), 1, 3)).toBeLessThan(myBest + 1.2);
      expect(typicalEt(botSpec(b), b.skill)).toBeGreaterThanOrEqual(forecastEt(botSpec(b), 1, 3) - 0.05);
    }
    expect(botsFor(start, 4, 42, LADDER[0]!)).toEqual(bots);
    expect(forecast(start, bots).pWin).toBeGreaterThan(0.12);
    const tuned = specOf(getCar('falkon'), { ...stockLevels(), engine: 5, tyres: 5 }, fresh, false);
    const b2 = botsFor(tuned, 4, 7);
    for (const b of b2) expect(Math.abs(b.car.tier - 4)).toBeLessThanOrEqual(1);
  });

  it('forecast odds and payouts: underdogs pay more, places pay less, settlements add up', () => {
    const weak = stock('bumble');
    const strong = stock('falkon');
    const f1 = forecast(weak, botsFor(strong, 4, 1));
    const f2 = forecast(strong, botsFor(weak, 4, 1));
    expect(f1.pWin).toBeLessThan(f2.pWin);
    expect(f1.mult).toBeGreaterThan(f2.mult);
    const win = settle({ position: 1, purse: 1000, fansMul: 1.2, stake: 500, mult: 2.5, firstWin: true });
    expect(win).toEqual({ purse: 1200, wager: 750, bonus: 2000 });
    const second = settle({ position: 2, purse: 1000, fansMul: 1.2, stake: 500, mult: 2.5, firstWin: false });
    expect(second).toEqual({ purse: 400, wager: -500, bonus: 0 });
    const last = settle({ position: 5, purse: 1000, fansMul: 1.2, stake: 500, mult: 2.5, firstWin: false });
    expect(last.purse).toBe(100);
  });

  it('materials come by division, doubled on a first win; the crate grows with rank', () => {
    const a = materialsFor(LADDER[0]!, false, 1);
    const b = materialsFor(LADDER[0]!, true, 1);
    expect(b.scrap).toBe(a.scrap! * 2);
    expect(a.chips).toBeUndefined();
    expect(materialsFor(LADDER[30]!, false, 1).chips).toBeGreaterThan(0);
    const have = addMats({ scrap: 1, alloy: 0, carbon: 0, chips: 0, rubber: 0 }, b);
    expect(have.scrap).toBe(1 + b.scrap!);
    expect(addMats(have, { scrap: 999 }, -1).scrap).toBe(0);
    expect(crateFor(0, 1).cash).toBeLessThan(crateFor(20, 1).cash);
    expect(crateFor(30, 1).mats.chips).toBeDefined();
    expect(crateFor(0, 1)).toEqual(crateFor(0, 1));
  });

  it('sponsor income grows with rank and looks, and caps at eight hours', () => {
    expect(idleRate(0)).toBeLessThan(idleRate(20));
    expect(idleRate(10, 1.24)).toBeGreaterThan(idleRate(10));
    expect(idleIncome(10, 3600_000 * 2)).toBe(Math.floor(idleRate(10) * 2));
    expect(idleIncome(10, 3600_000 * 30)).toBe(idleIncome(10, 3600_000 * 8));
    expect(idleIncome(10, -5)).toBe(0);
  });

  it('the daily loaner is the same for a seed, with four rivals in cars like it', () => {
    const a = loanerFor(123);
    expect(a).toEqual(loanerFor(123));
    expect(a.bots).toHaveLength(RACE_SIZE - 1);
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const l = loanerFor(s);
      seen.add(l.car.id);
      for (const b of l.bots) expect(Math.abs(b.car.tier - l.car.tier)).toBeLessThanOrEqual(1);
      expect(getCosmetic(l.env)?.kind).toBe('env');
      expect(ENV_DEFS[l.env]).toBeDefined();
    }
    expect(seen.size).toBeGreaterThan(12);
  });
});

describe('cosmetics and the save', () => {
  it('every kind has a free default and unique ids, and every strip has a world', () => {
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
    for (const e of COSMETICS.env) expect(ENV_DEFS[e.id]!.sky[0]).toMatch(/^#/);
  });

  it('sanitizes a damaged save and keeps the starter car', () => {
    const s = sanitize({ cash: -5, cars: { nope: {}, veyr: { levels: { engine: 99 }, cond: { tyres: -4 }, paint: 'h-red' } }, car: 'veyr', rank: 99, owned: ['h-red', 'zzz'], helmet: 'p-red', env: 'e-desert', crateDay: 'yesterday', daily: { '2026-10-21': { best: 12, tries: 2, open: true }, bad: {} } });
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
    expect(s.env).toBe(DEFAULTS.env);
    expect(s.crateDay).toBe('');
    expect(s.daily['2026-10-21']).toEqual({ best: 12, tries: 2, et: 0, open: true });
    expect(s.daily.bad).toBeUndefined();
    expect(sanitize(null)).toEqual(emptySave());
    expect(emptySave().mats.scrap).toBeGreaterThan(0);
    expect(LADDER[0]!.levels.engine).toBe(0);
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

import { describe, expect, it } from 'vitest';
import { getGame } from '../src/catalog/catalog';
import { CARS, getCar, TRAIT_INFO } from '../src/games/launch-control/cars';
import { MODEL_FILE } from '../src/games/launch-control/models';
import { COSMETICS, DEFAULTS, getCosmetic } from '../src/games/launch-control/cosmetics';
import { addMats, botsFor, botSpec, crateFor, forecast, GAUNTLET_UNLOCK, gauntletPrize, gauntletRival, idleIncome, idleRate, LADDER, LADDER_SIZE, loanerFor, materialsFor, opponentSpec, purseAt, RACE_SIZE, settle, typicalEt } from '../src/games/launch-control/economy';
import { ENV_DEFS } from '../src/games/launch-control/envs';
import { applyWear, effectsOf, failChance, freshCondition, levelGains, MAX_LEVEL, PARTS, raceWear, repairCost, RISKY, stockLevels, upgradeCost, type Levels } from '../src/games/launch-control/parts';
import { AUTO_LAUNCH, FIRST_LIGHT, LIGHT_GAP, LIGHTS, OUT_HOLD_MAX, decodeScript, DT, encodeScript, runOut, SHUTDOWN, engineForce, forecastEt, forecastRun, GREEN_SECONDS, idealLaunchRpm, JUMP_PENALTY, Race, scoreOf, shiftRpm, shiftWindows, simulate, specOf, tractionLimit, type CarSpec, type Driver } from '../src/games/launch-control/sim';
import { voiceOf } from '../src/games/launch-control/sound';
import { emptySave, sanitize } from '../src/games/launch-control/storage';
import { rng } from '../src/games/launch-control/util';

const fresh = freshCondition();
const maxed: Levels = { engine: 8, transmission: 8, suspension: 8, tyres: 8, aero: 8, looks: 8 };
const stock = (id: string): CarSpec => specOf(getCar(id), stockLevels(), fresh, false);
const policy = (skill: number, seed: number): Driver => ({ kind: 'policy', skill, seed });

describe('roster', () => {
  it('has 28 cars with unique ids and names, shapes that make sense, and no real makes', () => {
    expect(CARS.length).toBe(28);
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
    for (const c of [getCar('bumble'), getCar('tsubasa'), getCar('elektra'), getCar('toro')]) {
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

describe('the dealer', () => {
  it('lists cars cheapest first, and the tier tags climb with the price (tier price ranges never overlap)', () => {
    const byPrice = [...CARS].sort((a, b) => a.price - b.price);
    for (let i = 1; i < byPrice.length; i++) expect(byPrice[i]!.tier, `${byPrice[i - 1]!.name} → ${byPrice[i]!.name}`).toBeGreaterThanOrEqual(byPrice[i - 1]!.tier);
    for (let t = 1; t < 6; t++) {
      const top = Math.max(...CARS.filter((c) => c.tier === t).map((c) => c.price));
      const next = Math.min(...CARS.filter((c) => c.tier === t + 1).map((c) => c.price));
      expect(top, `tier ${t} tops out below tier ${t + 1}`).toBeLessThan(next);
    }
  });

  it('gives every car an engine voice: electric cars whine, supercars scream, city cars rasp', () => {
    expect(voiceOf(getCar('elektra')).kind).toBe('ev');
    expect(voiceOf(getCar('toro')).kind).toBe('v12');
    expect(voiceOf(getCar('pico-pop')).kind).toBe('i4');
    expect(voiceOf(getCar('hellion')).kind).toBe('v8');
    for (const c of CARS) expect(['i4', 'v8', 'v12', 'ev']).toContain(voiceOf(c).kind);
  });
});

describe('the race', () => {
  it('past the line every car runs out to a stop in the shutdown area, slowing all the way, short of the sand trap', () => {
    for (let trap = 15; trap <= 130; trap += 5)
      for (const chute of [false, true]) {
        const r = runOut(trap, chute);
        expect(r.v[0]).toBeCloseTo(trap, 3);
        expect(r.v[r.v.length - 1]).toBe(0);
        expect(r.stopX).toBeLessThan(SHUTDOWN - 40);
        expect(r.stopT).toBeLessThan(7);
        for (let i = 1; i < r.v.length; i++) {
          expect(r.v[i]!).toBeLessThanOrEqual(r.v[i - 1]!);
          expect(r.x[i]!).toBeGreaterThanOrEqual(r.x[i - 1]!);
        }
      }
    // a parachute stops a car sooner from the same speed
    expect(runOut(80, true).stopX).toBeLessThan(runOut(80, false).stopX);
  });

  it('is deterministic: same cars, drivers and seed give the same result', () => {
    const specs = [stock('stallion'), stock('tsubasa'), stock('griffon'), stock('astro'), stock('kestrel')];
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

  it('the launch is a tap at lights out: quick is perfect, none goes late, a jump start is punished', () => {
    const spec = stock('astro');
    const launchWith = (tapAfterGreen: number | null, earlyTapAt?: number | 'lights') => {
      const race = new Race([spec], [{ kind: 'live' }], 3);
      let tapped = false;
      let early = false;
      while (!race.done) {
        if (earlyTapAt !== undefined && !early && (earlyTapAt === 'lights' ? race.lightsOn >= 3 : race.t >= earlyTapAt)) {
          race.tap(0);
          early = true;
        }
        if (tapAfterGreen !== null && !tapped && race.out && race.t >= race.outAt + tapAfterGreen) {
          race.tap(0);
          tapped = true;
        }
        race.step();
      }
      return race.result().racers[0]!;
    };
    const quick = launchWith(0.2);
    expect(quick.reaction).toBeCloseTo(0.2, 1);
    expect(quick.launch).toBe('perfect');
    // launch control still holds the sweet-spot revs: no wheelspin
    expect(quick.script.launchRpm).toBe(idealLaunchRpm(spec));
    expect(quick.spinTime).toBe(0);
    expect(engineForce(spec, idealLaunchRpm(spec), 1)).toBeLessThanOrEqual(tractionLimit(spec, true));
    expect(launchWith(0.4).launch).toBe('good');
    const none = launchWith(null);
    // the launch lands on the first step after the moment (the hold is not step-aligned)
    expect(none.reaction).toBeGreaterThanOrEqual(AUTO_LAUNCH - 1e-9);
    expect(none.reaction).toBeLessThan(AUTO_LAUNCH + DT + 1e-9);
    expect(none.launch).toBe('slow');
    // a tap while the lights are on is a jump start (and a second tap at lights out can't undo it)
    const jump = launchWith(0.2, 'lights');
    expect(jump.launch).toBe('jump');
    expect(jump.reaction).toBeGreaterThanOrEqual(JUMP_PENALTY - 1e-9);
    expect(jump.reaction).toBeLessThan(JUMP_PENALTY + DT + 1e-9);
    // a tap before the first light is ignored
    expect(launchWith(0.2, 0.5).launch).toBe('perfect');
    // Formula 1 lights: five reds one a second, then out after a random 0 to 3 s with all five lit
    const seeds = Array.from({ length: 40 }, (_, sd) => new Race([spec], [{ kind: 'live' }], sd + 1));
    for (const r of seeds) {
      expect(r.lightAt).toHaveLength(LIGHTS);
      expect(r.lightAt[0]).toBeCloseTo(FIRST_LIGHT, 9);
      for (let k = 1; k < LIGHTS; k++) expect(r.lightAt[k]! - r.lightAt[k - 1]!).toBeCloseTo(LIGHT_GAP, 9);
      const hold = r.outAt - r.lightAt[LIGHTS - 1]!;
      expect(hold).toBeGreaterThanOrEqual(0);
      expect(hold).toBeLessThanOrEqual(OUT_HOLD_MAX);
    }
    const holds = seeds.map((r) => r.outAt - r.lightAt[LIGHTS - 1]!);
    expect(Math.min(...holds)).toBeLessThan(0.6);
    expect(Math.max(...holds)).toBeGreaterThan(2.4);
    expect(quick.crossed!).toBeLessThan(none.crossed!);
    expect(quick.crossed!).toBeLessThan(jump.crossed!);
    expect(scoreOf(quick)).toBeGreaterThan(scoreOf(none));
  });

  it('shift windows sit anywhere from 70 to 92 % of the revs, change spot and size every gear and race, and the same for every car', () => {
    const cars = ['bumble', 'astro', 'falkon', 'rail'].map(stock);
    const mids = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const per = cars.map((c) => shiftWindows(seed, c));
      // same race, same spots for everyone (widths follow each car)
      for (const ws of per) expect((ws[0]!.lo + ws[0]!.hi) / 2).toBeCloseTo((per[0]![0]!.lo + per[0]![0]!.hi) / 2, 6);
      for (const ws of per)
        for (const w of ws) {
          expect(w.okLo).toBeLessThan(w.lo);
          expect(w.lo).toBeGreaterThanOrEqual(0.6);
          expect(w.hi).toBeLessThanOrEqual(0.985);
          expect(w.okHi).toBeLessThanOrEqual(0.992);
        }
      mids.add(((per[0]![0]!.lo + per[0]![0]!.hi) / 2).toFixed(3));
    }
    expect(mids.size).toBeGreaterThan(8);
    // the spots spread over the range, and the greens are not all the same size
    const all = Array.from({ length: 60 }, (_, sd) => shiftWindows(sd + 1, cars[0]!)).flat();
    const centres = all.map((w) => (w.lo + w.hi) / 2);
    expect(Math.min(...centres)).toBeLessThan(0.74);
    expect(Math.max(...centres)).toBeGreaterThan(0.88);
    const greens = all.map((w) => w.hi - w.lo);
    expect(Math.max(...greens) / Math.min(...greens)).toBeGreaterThan(1.35);
    const yellows = all.map((w) => w.lo - w.okLo);
    expect(new Set(yellows.map((y) => y.toFixed(3))).size).toBeGreaterThan(20);
    // the needle crosses first gear's green in GREEN_SECONDS (a random size within the range) in any car
    for (const spec of cars) {
      const race = new Race([spec], [{ kind: 'live' }], 5);
      const me = race.racers[0]!;
      let enter = -1;
      let crossed = -1;
      while (!race.done && crossed < 0) {
        if (me.phase === 'staging' && race.out) race.tap(0);
        const w = race.windowOf(0)!;
        const f = shiftRpm(me) / spec.redline;
        if (me.phase === 'running' && enter < 0 && f >= w.lo) enter = race.t;
        if (enter >= 0 && f >= w.hi) crossed = race.t - enter;
        race.step();
      }
      expect(crossed, spec.id).toBeGreaterThan(GREEN_SECONDS.min * 0.6);
      expect(crossed, spec.id).toBeLessThan(GREEN_SECONDS.max * 1.5);
    }
  });

  it('shifting in the green beats yellow, red and early shifts', () => {
    for (const id of ['bumble', 'stallion', 'falkon']) {
      const spec = stock(id);
      const avg = (aim: (w: { lo: number; hi: number; okLo: number; okHi: number }) => number): number => {
        let sum = 0;
        for (let seed = 1; seed <= 8; seed++) {
          const race = new Race([spec], [{ kind: 'live' }], seed);
          const me = race.racers[0]!;
          while (!race.done) {
            if (me.phase === 'staging' && race.out && race.t >= race.outAt + 0.25) race.tap(0);
            const w = race.windowOf(0);
            if (w && me.phase === 'running' && shiftRpm(me) / spec.redline >= aim(w)) race.tap(0);
            race.step();
          }
          sum += race.result().racers[0]!.et!;
        }
        return sum / 8;
      };
      const green = avg((w) => (w.lo + w.hi) / 2);
      expect(green, id).toBeLessThan(avg((w) => (w.hi + w.okHi) / 2));
      expect(green, id).toBeLessThan(avg(() => 0.99));
      expect(green, id).toBeLessThan(avg((w) => w.okLo - 0.04) - 0.3);
    }
  });

  it('a scripted launch below the sweet spot bogs and above it spins; both lose time', () => {
    const spec = stock('kestrel');
    const ref = simulate([spec], [policy(1, 1)], 3).racers[0]!.script;
    const run = (launchRpm: number): number => simulate([spec], [{ kind: 'script', script: { ...ref, launchRpm } }], 3).racers[0]!.et!;
    const ideal = idealLaunchRpm(spec);
    expect(run(ideal)).toBeLessThan(run(spec.redline));
    expect(run(ideal)).toBeLessThan(run(1200));
  });

  it('a live driver races by shifting only: perfect taps count, no tap means the limiter', () => {
    const spec = stock('comet-ss');
    const race = new Race([spec, stock('astro')], [{ kind: 'live' }, policy(0.6, 2)], 11);
    let taps = 0;
    while (!race.done) {
      race.step();
      const me = race.racers[0]!;
      if (me.phase === 'staging' && race.out) race.tap(0);
      const w = race.windowOf(0);
      if (w && me.phase === 'running' && shiftRpm(me) >= spec.redline * (w.lo + w.hi) / 2) {
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

  it('worn tyres can blow, fresh ones never do, and no other part ever fails', () => {
    const def = getCar('rail');
    const worn = specOf(def, stockLevels(), { ...fresh, tyres: 5 }, true);
    const ok = specOf(def, stockLevels(), fresh, true);
    expect(ok.risky).toHaveLength(0);
    expect(specOf(def, stockLevels(), { ...fresh, engine: 0, transmission: 0, aero: 0 }, true).risky).toHaveLength(0);
    expect(worn.risky[0]!.chance).toBeGreaterThan(0.3);
    let fails = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = simulate([worn, ok], [policy(0.8, seed), policy(0.8, seed)], seed);
      if (r.racers[0]!.failure === 'tyres') fails++;
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
    const car = getCar('vossberg-gti');
    let prev = 0;
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const c = upgradeCost(car, 'engine', l);
      expect(c.cash).toBeGreaterThan(prev);
      prev = c.cash;
      expect(Object.values(c.mats).some((n) => n! > 0)).toBe(true);
    }
    expect(upgradeCost(car, 'engine', 8).mats.parts).toBeGreaterThan(upgradeCost(car, 'engine', 1).mats.parts!);
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

  it('only tyres wear (more when they spin), wear stays in range, and only tyres cost anything to replace', () => {
    const w = raceWear({ spinTime: 1.5 });
    expect(w.tyres).toBeGreaterThan(raceWear({ spinTime: 0 }).tyres);
    for (const p of PARTS) if (p !== 'tyres') expect(w[p]).toBe(0);
    const c = applyWear({ ...fresh, tyres: 3 }, w);
    expect(c.tyres).toBe(0);
    for (const p of PARTS) {
      expect(c[p]).toBeGreaterThanOrEqual(0);
      expect(c[p]).toBeLessThanOrEqual(100);
    }
    expect(repairCost(getCar('toro'), 'tyres', 0)).toBeGreaterThan(repairCost(getCar('bumble'), 'tyres', 0));
    expect(repairCost(getCar('toro'), 'tyres', 100)).toBe(0);
    expect(repairCost(getCar('toro'), 'engine', 0)).toBe(0);
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

  it('races are head to head: the ladder rival alone; tuned bots are cars like yours; the first rung is winnable', () => {
    const start = specOf(getCar('bumble'), stockLevels(), fresh, false);
    expect(RACE_SIZE).toBe(2);
    const field = botsFor(start, RACE_SIZE - 1, 42, LADDER[0]!);
    expect(field).toHaveLength(1);
    expect(field[0]!.rival).toBe(LADDER[0]);
    const bots = botsFor(start, 4, 42);
    const myBest = forecastEt(start, 1, 3);
    for (const b of bots) {
      expect(Math.abs(b.car.tier - 1)).toBeLessThanOrEqual(1);
      // their perfect run is a little behind yours; their driver only loses time from there
      expect(forecastEt(botSpec(b), 1, 3)).toBeGreaterThan(myBest - 0.15);
      expect(forecastEt(botSpec(b), 1, 3)).toBeLessThan(myBest + 1.2);
      expect(typicalEt(botSpec(b), b.skill)).toBeGreaterThanOrEqual(forecastEt(botSpec(b), 1, 3) - 0.05);
    }
    expect(botsFor(start, 4, 42)).toEqual(bots);
    expect(forecast(start, field).pWin).toBeGreaterThan(0.12);
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
    expect(second).toEqual({ purse: 300, wager: -500, bonus: 0 });
  });

  it('the gauntlet: opponents get quicker every round, prizes grow, materials every third win', () => {
    expect(GAUNTLET_UNLOCK).toBe(8);
    const me = specOf(getCar('astro'), { ...stockLevels(), engine: 2, tyres: 2 }, fresh, false);
    const mine = forecastEt(me, 1, 3);
    const ets = [1, 3, 6, 9, 12].map((round) => forecastEt(botSpec(gauntletRival(me, round, 99)), 1, 3));
    // early rounds are a little behind your best, later ones are quicker than it
    expect(ets[0]!).toBeGreaterThan(mine);
    expect(ets[4]!).toBeLessThan(mine);
    expect(ets[4]!).toBeLessThan(ets[0]! - 0.3);
    expect(gauntletRival(me, 12, 99).skill).toBeGreaterThan(gauntletRival(me, 1, 99).skill);
    expect(gauntletRival(me, 3, 5)).toEqual(gauntletRival(me, 3, 5));
    expect(gauntletPrize(5, 10, 1).cash).toBeGreaterThan(gauntletPrize(1, 10, 1).cash);
    expect(Object.keys(gauntletPrize(2, 10, 1).mats)).toHaveLength(0);
    expect(gauntletPrize(3, 10, 1).mats.parts).toBeGreaterThan(0);
  });

  it('materials come by division, doubled on a first win; the crate grows with rank', () => {
    const a = materialsFor(LADDER[0]!, false, 1);
    const b = materialsFor(LADDER[0]!, true, 1);
    expect(b.parts).toBe(a.parts! * 2);
    expect(materialsFor(LADDER[30]!, false, 1).parts).toBeGreaterThan(a.parts!);
    const have = addMats({ parts: 1, rubber: 0 }, b);
    expect(have.parts).toBe(1 + b.parts!);
    expect(addMats(have, { parts: 999 }, -1).parts).toBe(0);
    expect(crateFor(0, 1).cash).toBeLessThan(crateFor(20, 1).cash);
    expect(crateFor(30, 1).mats.parts).toBeGreaterThan(crateFor(0, 1).mats.parts!);
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
    const s = sanitize({ cash: -5, cars: { nope: {}, toro: { levels: { engine: 99 }, cond: { tyres: -4 }, paint: 'h-red' } }, car: 'toro', rank: 99, owned: ['h-red', 'zzz'], helmet: 'p-red', env: 'e-desert', crateDay: 'yesterday', daily: { '2026-10-21': { best: 12, tries: 2, open: true }, bad: {} } });
    expect(s.cash).toBe(0);
    expect(s.cars.bumble).toBeDefined();
    expect(s.cars.nope).toBeUndefined();
    expect(s.cars.toro!.levels.engine).toBe(MAX_LEVEL);
    expect(s.cars.toro!.cond.tyres).toBe(0);
    expect(s.cars.toro!.paint).toBe(DEFAULTS.paint);
    expect(s.car).toBe('toro');
    expect(s.rank).toBe(40);
    expect(s.owned).toEqual(['h-red']);
    expect(s.helmet).toBe(DEFAULTS.helmet);
    expect(s.env).toBe(DEFAULTS.env);
    expect(s.crateDay).toBe('');
    expect(s.daily['2026-10-21']).toEqual({ best: 12, tries: 2, et: 0, open: true });
    expect(s.daily.bad).toBeUndefined();
    expect(s.musicOff).toBe(false);
    expect(sanitize({ ...emptySave(), musicOff: true, muted: 'yes' }).musicOff).toBe(true);
    expect(sanitize(null)).toEqual(emptySave());
    expect(emptySave().mats.parts).toBeGreaterThan(0);
    // saves from before the materials merged: the old four become parts, worth what they cost; only tyres stay worn
    const old = sanitize({ ...emptySave(), mats: { scrap: 3, alloy: 2, carbon: 1, chips: 1, rubber: 4 }, cars: { bumble: { ...emptySave().cars.bumble, cond: { ...fresh, engine: 20, tyres: 40 } } } });
    expect(old.mats).toEqual({ parts: 3 + 4 + 3 + 4, rubber: 4 });
    expect(old.cars.bumble!.cond.engine).toBe(100);
    expect(old.cars.bumble!.cond.tyres).toBe(40);
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

describe('traits and the roster', () => {
  /** A live run that taps each window's middle, launches at `reaction` and optionally holds for the nitrous. */
  const drive = (spec: CarSpec, seed: number, o: { reaction?: number; nitro?: boolean; tap?: boolean } = {}) => {
    const race = new Race([spec], [{ kind: 'live' }], seed);
    const me = race.racers[0]!;
    let launched = false;
    while (!race.done) {
      if (!launched && race.out && race.t >= race.outAt + (o.reaction ?? 0.2)) {
        race.tap(0);
        launched = true;
      }
      const w = race.windowOf(0);
      if (o.tap !== false && w && me.phase === 'running' && shiftRpm(me) / spec.redline >= (w.lo + w.hi) / 2) race.tap(0);
      if (o.nitro) race.nitro(0);
      race.step();
    }
    return race.result().racers[0]!;
  };

  it('gives every car one trait and a body of its own', () => {
    expect(new Set(Object.values(MODEL_FILE)).size).toBe(CARS.length);
    for (const c of CARS) {
      expect(MODEL_FILE[c.id], c.id).toBeDefined();
      expect(TRAIT_INFO[c.trait].name.length).toBeGreaterThan(2);
    }
    // every trait is on the roster, and nitrous only on the top half
    for (const t of Object.keys(TRAIT_INFO)) expect(CARS.some((c) => c.trait === t), t).toBe(true);
    for (const c of CARS.filter((x) => x.trait === 'nitro')) expect(c.tier).toBeGreaterThanOrEqual(4);
  });

  it('within a tier a dearer car is quicker, so every purchase is a step up', () => {
    for (let t = 1; t <= 6; t++) {
      const tier = CARS.filter((c) => c.tier === t).sort((a, b) => a.price - b.price);
      const et = (id: string): number => Array.from({ length: 9 }, (_, k) => forecastEt(stock(id), 1, k + 1)).reduce((x, y) => x + y) / 9;
      for (let i = 1; i < tier.length; i++) expect(et(tier[i]!.id), `${tier[i - 1]!.id} → ${tier[i]!.id}`).toBeLessThan(et(tier[i - 1]!.id));
    }
  });

  it('nitrous fires once, never in first gear, and is worth a good chunk of the run', () => {
    const spec = stock('monarch');
    const race = new Race([spec], [{ kind: 'live' }], 5);
    let early = false;
    while (!race.done) {
      if (race.out && race.racers[0]!.phase === 'staging') race.tap(0);
      const me = race.racers[0]!;
      if (me.phase === 'running' && me.gear === 1) {
        race.nitro(0);
        early ||= me.nitroUsed;
      }
      race.step();
    }
    expect(early).toBe(false);
    const withN = drive(spec, 5, { nitro: true });
    const without = drive(spec, 5);
    expect(withN.script.nitro).toBeGreaterThan(0);
    expect(without.script.nitro).toBeUndefined();
    expect(withN.et!).toBeLessThan(without.et! - 0.15);
    // a car without the bottle ignores the hold
    expect(drive(stock('falkon'), 5, { nitro: true }).script.nitro).toBeUndefined();
  });

  it('an electric taps overdrive five times as its charge peaks; a charge left alone vents as a late shift', () => {
    const spec = stock('elektra');
    expect(spec.stages).toBe(5);
    const tapped = drive(spec, 9);
    expect(tapped.shifts).toBe(5);
    expect(tapped.perfect).toBe(5);
    const ignored = drive(spec, 9, { tap: false });
    expect(ignored.late).toBe(5);
    expect(tapped.et!).toBeLessThan(ignored.et! - 0.2);
  });

  it('police cars forgive a slow launch, all-wheel drive never spins, and policy bots use their nitrous', () => {
    expect(drive(stock('interceptor'), 3, { reaction: 0.34 }).launch).toBe('perfect');
    expect(drive(stock('breadbox'), 3, { reaction: 0.34 }).launch).toBe('good');
    for (const id of CARS.filter((c) => c.trait === 'awd').map((c) => c.id)) {
      const r = simulate([specOf(getCar(id), maxed, fresh, false)], [policy(0.3, 4)], 4).racers[0]!;
      expect(r.spinTime, id).toBe(0);
    }
    const bot = simulate([stock('rail')], [policy(0.9, 2)], 2).racers[0]!;
    expect(bot.script.nitro).toBeGreaterThan(0);
  });

  it('ghosts keep their nitrous, and older replays still load', () => {
    const spec = stock('rail');
    const r = simulate([spec], [policy(0.9, 6)], 6).racers[0]!;
    const dec = decodeScript(encodeScript(r.script))!;
    expect(dec.nitro).toBeCloseTo(r.script.nitro!, 3);
    const again = simulate([spec], [{ kind: 'script', script: dec }], 6).racers[0]!;
    expect(Math.abs(again.et! - r.et!)).toBeLessThan(0.02);
    expect(decodeScript('lc2,3000,250,1200,2400')).toEqual({ launchRpm: 3000, reaction: 0.25, shifts: [1.2, 2.4] });
  });

  it('a retired car becomes the one that took its place, or its price in cash when that car is owned', () => {
    const s = sanitize({ cash: 100, cars: { bumble: {}, veyr: { levels: { engine: 5 } }, nova: {}, kaiser: { paint: 'p-stock' } }, car: 'veyr' });
    expect(s.cars.veyr).toBeUndefined();
    expect(s.cars.toro!.levels.engine).toBe(5);
    expect(s.car).toBe('toro');
    expect(s.cars.astro).toBeDefined();
    // nova also became a toro: that one is paid back
    expect(s.cash).toBe(100 + 2100000);
  });

  it('a race is never against your own car, and every boss drives a car from the next tier', () => {
    for (const id of ['bumble', 'tsubasa', 'elektra']) {
      const bots = botsFor(stock(id), 1, 33);
      expect(bots[0]!.car.id).not.toBe(id);
    }
    for (const o of LADDER.filter((x) => x.boss)) expect(getCar(o.car).tier).toBe(o.division + 2);
    for (let seed = 1; seed < 40; seed++) expect(loanerFor(seed).car.trait).not.toBe('nitro');
  });
});

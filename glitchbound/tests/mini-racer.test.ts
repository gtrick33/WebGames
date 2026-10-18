import { describe, expect, it } from 'vitest';
import { dailyTrack, hashDay, todayKey } from '../src/games/mini-racer/daily';
import { leftOf, pointAt } from '../src/games/mini-racer/geometry';
import { decodeGhost, encodeGhost, GhostRecorder, ghostPose } from '../src/games/mini-racer/ghost';
import { advanceLaps, bestLap, crossGate, newLapState } from '../src/games/mini-racer/laps';
import { newCar, onLoose, speedOf, stepCar } from '../src/games/mini-racer/physics';
import { autopilot, DT, RaceSim, scoreFor } from '../src/games/mini-racer/sim';
import { buildTrack, bypassed, groundAt, SURFACES, validateTrack, type Checkpoint, type Gate } from '../src/games/mini-racer/track';
import { TRACKS } from '../src/games/mini-racer/tracks';
import { CARS, raceCoins, specFor, statBars } from '../src/games/mini-racer/cars';
import { getGame } from '../src/catalog/catalog';

/** A gate across the x axis at x = gx, driven in +x. */
const gateX = (gx: number): Gate => ({ a: { x: gx, y: -100 }, b: { x: gx, y: 100 }, dir: { x: 1, y: 0 } });
/** A straight "track" with four checkpoints at x = 0, 100, 200, 300 (0 is the line). */
const STRAIGHT: Checkpoint[] = [0, 100, 200, 300].map((x) => ({ gates: [gateX(x)] }));

/** Drives along a list of x positions, one per tick of 0.1 s, starting at time 0. */
function drive(xs: number[], cps = STRAIGHT, y = 0) {
  const state = newLapState();
  const events = [];
  for (let i = 1; i < xs.length; i++) {
    events.push(...advanceLaps(state, cps, { x: xs[i - 1]!, y }, { x: xs[i]!, y }, (i - 1) * 0.1, i * 0.1));
  }
  return { state, events };
}

describe('lap timing and checkpoints', () => {
  it('only counts gates crossed in the driving direction', () => {
    expect(crossGate(gateX(0), { x: -1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0.5);
    expect(crossGate(gateX(0), { x: 1, y: 0 }, { x: -1, y: 0 })).toBeNull();
    expect(crossGate(gateX(0), { x: -1, y: 500 }, { x: 1, y: 500 })).toBeNull();
  });

  it('the first crossing of the line starts the race, the next completes a lap', () => {
    // Loop: start at -10, cross 0, 100, 200, 300, then "wrap" back to -10 and cross 0 again.
    const xs = [-10, 5, 105, 205, 305, 350];
    const { state } = drive(xs);
    expect(state.started).toBe(true);
    expect(state.next).toBe(4);
    const lap = advanceLaps(state, STRAIGHT, { x: -5, y: 0 }, { x: 5, y: 0 }, 1.0, 1.1);
    expect(lap).toEqual([{ type: 'lap', number: 1, lap: { time: expect.closeTo(1.05, 5), valid: true, clean: true } }]);
  });

  it('interpolates the crossing time inside a step (frame-rate independent)', () => {
    const state = newLapState();
    state.started = true;
    state.next = 4;
    const [e] = advanceLaps(state, STRAIGHT, { x: -30, y: 0 }, { x: 10, y: 0 }, 10, 10.4);
    expect(e?.type).toBe('lap');
    if (e?.type === 'lap') expect(e.lap.time).toBeCloseTo(10.3);
  });

  it('a lap that skips a checkpoint does not count', () => {
    const state = newLapState();
    advanceLaps(state, STRAIGHT, { x: -5, y: 0 }, { x: 5, y: 0 }, 0, 0.1); // start
    advanceLaps(state, STRAIGHT, { x: 95, y: 0 }, { x: 105, y: 0 }, 1, 1.1); // cp 1
    // Cut across the infield: miss cp 2 (pass beside its gate), then hit cp 3.
    advanceLaps(state, STRAIGHT, { x: 195, y: 400 }, { x: 205, y: 400 }, 2, 2.1);
    const missed = advanceLaps(state, STRAIGHT, { x: 295, y: 0 }, { x: 305, y: 0 }, 3, 3.1);
    expect(missed).toEqual([{ type: 'missed', index: 2 }]);
    const [lap] = advanceLaps(state, STRAIGHT, { x: -5, y: 0 }, { x: 5, y: 0 }, 4, 4.1);
    expect(lap?.type === 'lap' && lap.lap.valid).toBe(false);
    // The next lap starts fresh and can be valid again.
    expect(state.missed).toBe(false);
    expect(state.next).toBe(1);
  });

  it('wiggling back and forth over the line does not create laps', () => {
    const { events } = drive([-10, 5, -5, 5, -5, 5]);
    expect(events.filter((e) => e.type === 'lap')).toHaveLength(0);
  });

  it('bumps make a valid lap not clean, and best lap ignores invalid laps', () => {
    const state = newLapState();
    advanceLaps(state, STRAIGHT, { x: -5, y: 0 }, { x: 5, y: 0 }, 0, 0.1);
    for (const x of [100, 200, 300]) advanceLaps(state, STRAIGHT, { x: x - 5, y: 0 }, { x: x + 5, y: 0 }, x / 100, x / 100 + 0.1);
    state.bumped = true;
    const [e] = advanceLaps(state, STRAIGHT, { x: -5, y: 0 }, { x: 5, y: 0 }, 5, 5.1);
    expect(e?.type === 'lap' && e.lap).toMatchObject({ valid: true, clean: false });
    expect(bestLap([{ time: 3, valid: false, clean: false }, { time: 5, valid: true, clean: true }])).toBe(5);
    expect(bestLap([])).toBeNull();
  });
});

describe('tracks', () => {
  for (const def of TRACKS) {
    const track = buildTrack(def);

    it(`${def.name}: road never overlaps itself`, () => {
      expect(validateTrack(track)).toEqual([]);
      if (track.shortcutRange) expect(bypassed(def.checkpoints, track.shortcutRange).length).toBeGreaterThan(0);
    });

    it(`${def.name}: the autopilot completes valid laps near the gold time`, () => {
      const sim = new RaceSim(track);
      for (let i = 0; i < 120 * 60 && sim.lap.laps.length < 2; i++) sim.step(autopilot(sim));
      expect(sim.lap.laps).toHaveLength(2);
      expect(sim.lap.laps.every((l) => l.valid)).toBe(true);
      const t = sim.lap.laps[1]!.time * 1000;
      // Gold should be reachable but demanding: within 15% of a tidy autopilot lap.
      expect(t).toBeGreaterThan(def.par * 0.85);
      expect(t).toBeLessThan(def.par * 1.15);
    });

    it.runIf(!!def.shortcut)(`${def.name}: driving the shortcut counts as a valid lap`, () => {
      // Drive the main road up to the shortcut, follow the shortcut, then the road again.
      const sc = track.shortcut!;
      const L = track.path.length;
      const { from, to } = track.shortcutRange!;
      const pts = [];
      for (let s = 0; s <= from * L; s += 8) pts.push(pointAt(track.path, s).p);
      for (let s = 0; s <= sc.path.length; s += 8) pts.push(pointAt(sc.path, s).p);
      for (let s = to * L; s <= L + 8; s += 8) pts.push(pointAt(track.path, s).p);
      const state = newLapState();
      state.started = true;
      state.next = 1;
      const events = [];
      for (let i = 1; i < pts.length; i++) events.push(...advanceLaps(state, track.checkpoints, pts[i - 1]!, pts[i]!, i, i + 1));
      expect(events.filter((e) => e.type === 'missed')).toEqual([]);
      const lap = events.find((e) => e.type === 'lap');
      expect(lap?.type === 'lap' && lap.lap.valid).toBe(true);
    });

    it(`${def.name}: cutting straight across the infield is not a valid lap`, () => {
      // From the start line straight to the point halfway round the lap, then back along the road.
      const L = track.path.length;
      const pts = [pointAt(track.path, 0).p];
      const half = pointAt(track.path, L / 2).p;
      for (let k = 1; k <= 40; k++) pts.push({ x: pts[0]!.x + ((half.x - pts[0]!.x) * k) / 40, y: pts[0]!.y + ((half.y - pts[0]!.y) * k) / 40 });
      for (let s = L / 2; s <= L + 8; s += 8) pts.push(pointAt(track.path, s).p);
      const state = newLapState();
      state.started = true;
      state.next = 1;
      const events = [];
      for (let i = 1; i < pts.length; i++) events.push(...advanceLaps(state, track.checkpoints, pts[i - 1]!, pts[i]!, i, i + 1));
      const lap = events.find((e) => e.type === 'lap');
      expect(lap?.type === 'lap' && lap.lap.valid).toBe(false);
    });
  }

  it('reports the surface under the car: road, zones, patches and off-road', () => {
    const frost = buildTrack(TRACKS[1]!);
    const start = pointAt(frost.path, 0);
    expect(groundAt(frost, start.p)).toMatchObject({ surface: 'asphalt', onRoad: true });
    const n = leftOf(start.t);
    const far = { x: start.p.x + n.x * 400, y: start.p.y + n.y * 400 };
    expect(groundAt(frost, far)).toMatchObject({ surface: 'snow', onRoad: false });
    const zone = frost.zones[0]!;
    const inZone = pointAt(frost.path, ((zone.from + zone.to) / 2) * frost.path.length).p;
    expect(groundAt(frost, inZone).surface).toBe('ice');
    const boost = frost.patches.find((p) => p.surface === 'boost')!;
    expect(groundAt(frost, boost.c).surface).toBe('boost');
  });
});

describe('physics', () => {
  it('accelerates towards top speed and grass is slower than asphalt', () => {
    const run = (surface: keyof typeof SURFACES): number => {
      const car = newCar(0, 0, 0);
      for (let i = 0; i < 120 * 6; i++) stepCar(car, { steer: 0, throttle: 1, brake: 0 }, SURFACES[surface], DT);
      return car.vx;
    };
    expect(run('asphalt')).toBeGreaterThan(380);
    expect(run('grass')).toBeLessThan(run('asphalt') * 0.65);
  });

  it('holding a hard turn at speed lets the tail out; a gentle turn or low speed does not', () => {
    const slide = (steer: number, speed: number, throttle = 1): { slide: number; side: number } => {
      const car = newCar(0, 0, 0);
      car.vx = speed;
      let max = 0;
      for (let i = 0; i < 60; i++) {
        stepCar(car, { steer, throttle, brake: 0 }, SURFACES.asphalt, DT);
        const side = -car.vx * Math.sin(car.a) + car.vy * Math.cos(car.a);
        max = Math.max(max, Math.abs(side));
      }
      return { slide: car.slide, side: max };
    };
    const hard = slide(1, 380);
    expect(hard.slide).toBeGreaterThan(0.9);
    expect(slide(0.4, 380).slide).toBe(0);
    expect(slide(1, 120, 0).slide).toBe(0);
    expect(hard.side).toBeGreaterThan(slide(0.4, 380).side * 2);
  });

  it('loose-ground tyres lose less on dirt but change nothing on tarmac', () => {
    expect(onLoose(SURFACES.asphalt, 1.2)).toEqual({ speed: 1, accel: 1, grip: 1, drag: 0 });
    const dirt = onLoose(SURFACES.gravel, 1.15);
    expect(dirt.speed).toBeGreaterThan(SURFACES.gravel.speed);
    expect(dirt.grip).toBeGreaterThan(SURFACES.gravel.grip);
    expect(onLoose(SURFACES.gravel, 1)).toBe(SURFACES.gravel);
  });
});

describe('daily track', () => {
  it('is the same for everyone on a day and different across days', () => {
    expect(dailyTrack('2026-10-18')).toEqual(dailyTrack('2026-10-18'));
    expect(dailyTrack('2026-10-18').points).not.toEqual(dailyTrack('2026-10-19').points);
    expect(hashDay('2026-10-18')).not.toBe(hashDay('2026-10-19'));
  });

  it('formats the local day', () => {
    expect(todayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('always generates a valid, drivable track with a sensible gold time', () => {
    for (let d = 1; d <= 40; d++) {
      const day = `2026-${String(1 + (d % 12)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}`;
      const def = dailyTrack(day);
      const track = buildTrack(def);
      expect(validateTrack(track), day).toEqual([]);
      expect(def.par, day).toBeGreaterThan(8000);
      expect(def.par, day).toBeLessThan(40000);
    }
  });
});

describe('ghost', () => {
  it('records at a fixed rate and replays interpolated poses', () => {
    const rec = new GhostRecorder();
    rec.begin(2);
    for (let t = 2; t <= 4; t += DT) rec.sample(t, 2, { x: (t - 2) * 100, y: 0, a: 0 });
    const g = rec.finish(2);
    expect(g.frames.length / 3).toBeGreaterThan(38);
    expect(ghostPose(g, 1)!.x).toBeCloseTo(100, 0);
    expect(ghostPose(g, -1)).toBeNull();
    expect(ghostPose(g, 99)).toBeNull();
  });

  it('round-trips through storage text and rejects junk', () => {
    const g = { time: 12.3, t0: 0.01, frames: [0, 0, 0, 1, 2, 0.5] };
    expect(decodeGhost(encodeGhost(g))).toEqual(g);
    expect(decodeGhost(null)).toBeNull();
    expect(decodeGhost('{oops')).toBeNull();
    expect(decodeGhost(JSON.stringify({ v: 1, time: 5, t0: 0, f: [1, 2] }))).toBeNull();
    expect(decodeGhost(JSON.stringify({ v: 1, time: -5, t0: 0, f: [1, 2, 3, 4, 5, 6] }))).toBeNull();
  });

  it('a race saves the best valid lap as the new ghost', () => {
    const sim = new RaceSim(buildTrack(TRACKS[0]!));
    for (let i = 0; i < 120 * 90 && !sim.finished; i++) sim.step(autopilot(sim));
    expect(sim.finished).toBe(true);
    const r = sim.result();
    expect(r.laps).toHaveLength(3);
    expect(sim.newGhost?.time).toBeCloseTo(r.best!, 5);
    expect(r.raceTime).toBeCloseTo(r.laps.reduce((s, l) => s + l.time, 0), 5);
    expect(r.score).toBe(scoreFor(TRACKS[0]!.par, r.laps));
  });
});

describe('cars', () => {
  // Race time for each car relative to the starter, per track (autopilot driving, same line).
  const results = TRACKS.map((def) => {
    const track = buildTrack(def);
    const time = (spec = specFor(CARS[0]!)): number => {
      const sim = new RaceSim(track, null, spec);
      for (let i = 0; i < 120 * 120 && !sim.finished; i++) sim.step(autopilot(sim));
      return sim.result().raceTime ?? Infinity;
    };
    const base = time();
    return { def, rel: CARS.map((c) => time(specFor(c)) / base - 1) };
  });

  it('every car finishes every track within 6% of the starter car', () => {
    for (const { def, rel } of results) {
      rel.forEach((r, i) => expect(Math.abs(r), `${CARS[i]!.id} on ${def.id}`).toBeLessThan(0.06));
    }
  });

  it('no car is faster than the starter on average by more than 2.5% (fair leaderboard)', () => {
    CARS.forEach((c, i) => {
      const mean = results.reduce((s, r) => s + r.rel[i]!, 0) / results.length;
      expect(Math.abs(mean), c.id).toBeLessThan(0.025);
    });
  });

  it('has unique ids, a free starter and sensible stat bars', () => {
    expect(new Set(CARS.map((c) => c.id)).size).toBe(CARS.length);
    expect(CARS[0]!.unlock.type).toBe('starter');
    for (const c of CARS) for (const b of statBars(c)) expect(b.value).toBeGreaterThanOrEqual(1);
  });

  it('pays more coins for medals, records and the first daily finish', () => {
    const base = raceCoins({ validLaps: 3, medal: null, newBest: false, firstDaily: false });
    expect(raceCoins({ validLaps: 3, medal: 'gold', newBest: false, firstDaily: false })).toBeGreaterThan(raceCoins({ validLaps: 3, medal: 'bronze', newBest: false, firstDaily: false }));
    expect(raceCoins({ validLaps: 3, medal: null, newBest: true, firstDaily: true })).toBeGreaterThan(base);
    expect(raceCoins({ validLaps: 0, medal: null, newBest: false, firstDaily: false })).toBeGreaterThan(0);
  });
});

describe('leaderboard score', () => {
  it('is higher for faster races and zero for laps that missed a checkpoint', () => {
    const par = 15000;
    expect(scoreFor(par, [{ time: 15, valid: true }])).toBe(1000);
    expect(scoreFor(par, [{ time: 12, valid: true }])).toBeGreaterThan(scoreFor(par, [{ time: 15, valid: true }]));
    expect(scoreFor(par, [{ time: 10, valid: false }])).toBe(0);
  });

  it('a very fast real race stays under the registry limits, while a forged score does not', () => {
    const limits = getGame('mini-racer')!.limits!;
    for (const def of [...TRACKS, dailyTrack('2026-10-18')]) {
      // 25% faster than gold on every lap is beyond any human run.
      const lap = (def.par / 1000) * 0.75;
      const score = scoreFor(def.par, [lap, lap, lap].map((time) => ({ time, valid: true })));
      // Real elapsed time also includes the countdown and the finish pause.
      const seconds = lap * 3 + 3;
      expect(score, def.id).toBeLessThanOrEqual(limits.scorePerSecond * seconds + 50);
      expect(seconds).toBeGreaterThanOrEqual(limits.minSeconds ?? 1);
    }
    expect(100000).toBeGreaterThan(limits.scorePerSecond * 30 + 50);
  });
});

describe('race start (regression: car stuck at the start)', () => {
  const defs = [...TRACKS, ...['2026-10-18', '2026-11-04', '2026-11-22', '2027-02-14'].map(dailyTrack)];

  for (const def of defs) {
    it(`${def.id}: with zero input the car leaves the grid on the road and gets up to speed`, () => {
      const sim = new RaceSim(buildTrack(def));
      expect(sim.ground.onRoad).toBe(true);
      let fastOnRoad = false;
      for (let i = 0; i < 120 * 4 && !fastOnRoad; i++) {
        sim.step(0);
        expect(sim.ground.onRoad, `left the road at t=${sim.time.toFixed(2)}`).toBe(sim.time < 1.5 ? true : sim.ground.onRoad);
        if (sim.time > 0 && sim.ground.onRoad && speedOf(sim.car) > 250) fastOnRoad = true;
      }
      // 250 units/s is about 90 km/h on the speedometer, reached well within 2 s of GO.
      expect(fastOnRoad).toBe(true);
      expect(sim.time).toBeLessThan(2);
    });
  }

  it('a car pinned nose-first against the world edge can steer away and is put back on track', () => {
    const track = buildTrack(TRACKS[0]!);
    const sim = new RaceSim(track);
    for (let i = 0; i < 120 * 2.5; i++) sim.step(0); // past GO
    // Park it at the top fence, facing straight into it, stopped.
    sim.car.x = (track.bounds.minX + track.bounds.maxX) / 2;
    sim.car.y = track.bounds.minY + 20;
    sim.car.a = -Math.PI / 2;
    sim.car.vx = sim.car.vy = 0;
    const a0 = sim.car.a;
    for (let i = 0; i < 60; i++) sim.step(1);
    expect(Math.abs(sim.car.a - a0)).toBeGreaterThan(0.3);
    let rescued = false;
    for (let i = 0; i < 120 * 4 && !rescued; i++) rescued = sim.step(0).some((e) => e.type === 'rescue');
    expect(rescued).toBe(true);
    expect(sim.ground.onRoad).toBe(true);
  });
});

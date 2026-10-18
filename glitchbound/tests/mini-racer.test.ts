import { describe, expect, it } from 'vitest';
import { PolyCull } from '../src/games/mini-racer/cull';
import { dailyTrack, hashDay, todayKey } from '../src/games/mini-racer/daily';
import { leftOf, nearest, pointAt } from '../src/games/mini-racer/geometry';
import { decodeGhost, encodeGhost, GhostRecorder, ghostPose } from '../src/games/mini-racer/ghost';
import { advanceLaps, bestLap, crossGate, newLapState } from '../src/games/mini-racer/laps';
import { BODY_OFFSET, BODY_RADIUS, CAR, CAR_RADIUS, collideCarPair, collideCircle, collideSegment, localVelocity, newCar, onLoose, speedOf, stepCar, type Handling } from '../src/games/mini-racer/physics';
import { aiStyle, autopilot, DT, RaceSim, scoreFor } from '../src/games/mini-racer/sim';
import { bestSectors, chooseReference, SECTORS, SectorTimer, sectorGates, sectorTimes } from '../src/games/mini-racer/sectors';
import { buildTrack, bypassed, cellAt, decorRadius, groundAt, KERB, SURFACES, TRACK_TYPES, validateTrack, WALL_HALF, wallOffset, type Checkpoint, type Gate } from '../src/games/mini-racer/track';
import { TRACKS } from '../src/games/mini-racer/tracks';
import { CARS, raceCoins, specFor, statBars } from '../src/games/mini-racer/cars';
import { lapLine, raceMedal, shareText } from '../src/games/mini-racer/medals';
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
    // Park it at the top fence, facing straight into it, stopped (at a spot clear of scenery).
    let x = (track.bounds.minX + track.bounds.maxX) / 2;
    const clear = (px: number): boolean => track.solids.every((s) => Math.hypot(s.x - px, s.y - (track.bounds.minY + 20)) > s.r + 60);
    while (!clear(x)) x += 40;
    sim.car.x = x;
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

describe('barriers and solid scenery', () => {
  const tracks = [...TRACKS, dailyTrack('2026-10-18')].map(buildTrack);

  it('tyre walls stay off the road and leave every shortcut open', () => {
    for (const t of tracks) {
      expect(t.walls.length, t.def.id).toBeGreaterThan(0);
      for (const run of t.walls) {
        for (const q of run) {
          expect(nearest(t.path, q).d, t.def.id).toBeGreaterThan(t.half + KERB + 20);
          if (t.shortcut) expect(nearest(t.shortcut.path, q).d, t.def.id).toBeGreaterThan(t.shortcut.half + WALL_HALF);
        }
      }
    }
  });

  it('a car driven straight at the wall slides along it and never passes through', () => {
    for (const t of tracks) {
      const { p, t: tan } = pointAt(t.path, t.path.length * 0.3);
      const n = leftOf(tan);
      for (const side of [1, -1]) {
        const car = newCar(p.x, p.y, Math.atan2(n.y * side + tan.y * 0.3, n.x * side + tan.x * 0.3));
        car.vx = Math.cos(car.a) * 420;
        car.vy = Math.sin(car.a) * 420;
        let maxD = 0;
        for (let i = 0; i < 120; i++) {
          stepCar(car, { steer: 0, throttle: 1, brake: 0 }, SURFACES.asphalt, DT);
          const cell = cellAt(t, car.x, car.y);
          for (const k of cell.segs) {
            const s = t.segs[k]!;
            collideSegment(car, s.ax, s.ay, s.bx, s.by, WALL_HALF);
          }
          maxD = Math.max(maxD, nearest(t.path, car).d);
        }
        expect(maxD, `${t.def.id} side ${side}`).toBeLessThan(wallOffset(t.half) - WALL_HALF + 2);
      }
    }
  });

  it('cutting straight across the infield is stopped by the barrier, and the lap would not count anyway', () => {
    const t = tracks[0]!;
    const sim = new RaceSim(t);
    for (let i = 0; i < 120 * 2.3; i++) sim.step(0); // just after GO
    const target = pointAt(t.path, t.path.length / 2).p;
    let maxD = 0;
    for (let i = 0; i < 120 * 3; i++) {
      // Always aim straight at the far side of the lap.
      let want = Math.atan2(target.y - sim.car.y, target.x - sim.car.x) - sim.car.a;
      while (want > Math.PI) want -= Math.PI * 2;
      while (want < -Math.PI) want += Math.PI * 2;
      sim.step(Math.max(-1, Math.min(1, want * 3)));
      maxD = Math.max(maxD, sim.ground.d);
    }
    expect(maxD).toBeLessThan(wallOffset(t.half));
    expect(sim.lap.laps.filter((l) => l.valid)).toHaveLength(0);
  });

  it('scenery props are solid: a car driven into one bounces off and loses speed', () => {
    const t = tracks[0]!;
    const prop = t.decor[Math.floor(t.decor.length / 2)]!;
    const r = decorRadius(prop);
    expect(t.solids.some((s) => s.x === prop.x && s.y === prop.y)).toBe(true);
    const car = newCar(prop.x - 120, prop.y, 0);
    car.vx = 380;
    let minDist = Infinity;
    for (let i = 0; i < 90; i++) {
      stepCar(car, { steer: 0, throttle: 1, brake: 0 }, SURFACES.sand, DT);
      for (const k of cellAt(t, car.x, car.y).solids) {
        const s = t.solids[k]!;
        collideCircle(car, s.x, s.y, s.r);
      }
      minDist = Math.min(minDist, Math.hypot(car.x - prop.x, car.y - prop.y));
    }
    expect(minDist).toBeGreaterThan(r + CAR_RADIUS - 0.5);
    expect(car.x).toBeLessThan(prop.x);
  });

  it('a car stopped against a prop can steer away (no getting stuck with automatic gas)', () => {
    const t = tracks[0]!;
    const sim = new RaceSim(t);
    for (let i = 0; i < 120 * 2.5; i++) sim.step(0);
    const prop = t.decor[3]!;
    sim.car.x = prop.x - decorRadius(prop) - CAR_RADIUS - 1;
    sim.car.y = prop.y;
    sim.car.a = 0;
    sim.car.vx = sim.car.vy = 0;
    let rescued = false;
    for (let i = 0; i < 120 * 4 && !rescued; i++) rescued = sim.step(1).some((e) => e.type === 'rescue');
    // Either it turned away and drove off, or it was put back on track: never pinned for good.
    expect(rescued || Math.hypot(sim.car.x - prop.x, sim.car.y - prop.y) > 60).toBe(true);
  });
});

describe('AI race', () => {
  const runRace = (def: (typeof TRACKS)[number], aiLevel: number, playerSpeed = 1) => {
    const sim = new RaceSim(buildTrack(def), null, { ...CAR, maxSpeed: CAR.maxSpeed * playerSpeed }, { mode: 'race', aiLevel });
    for (let i = 0; i < 120 * 200 && !sim.finished; i++) sim.step(autopilot(sim));
    return sim;
  };

  it('starts four cars on a grid, all on the road, with the player at the back', () => {
    const sim = new RaceSim(buildTrack(TRACKS[0]!), null, CAR, { mode: 'race' });
    expect(sim.racers).toHaveLength(4);
    for (const r of sim.racers) expect(r.ground.onRoad).toBe(true);
    expect(sim.position).toBe(4);
  });

  it('reports a finishing position that matches the results order', () => {
    const sim = runRace(TRACKS[0]!, 50);
    const r = sim.result();
    expect(r.position).toBeGreaterThanOrEqual(1);
    expect(r.standings).toHaveLength(4);
    expect(r.standings[r.position! - 1]!.player).toBe(true);
    // Finished cars come first, in finish-time order.
    const times = r.standings.map((s) => s.time).filter((x): x is number => x !== null);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(r.standings.map((s) => s.name)).size).toBe(4);
  });

  it('every AI quality rises smoothly with the level (0-100)', () => {
    for (let l = 1; l <= 100; l++) {
      const a = aiStyle(l - 1);
      const b = aiStyle(l);
      expect(b.pace).toBeGreaterThanOrEqual(a.pace);
      expect(b.inside).toBeGreaterThanOrEqual(a.inside);
      expect(b.steerRate).toBeGreaterThanOrEqual(a.steerRate);
      expect(b.lift).toBeGreaterThanOrEqual(a.lift);
      expect(b.wobble).toBeLessThanOrEqual(a.wobble);
      expect(b.band).toBeLessThanOrEqual(a.band);
    }
    // Catch-up only at low levels.
    expect(aiStyle(60).band).toBe(0);
  });

  it('measured pace is monotonic in the AI level', () => {
    const avg = (level: number): number => {
      let sum = 0;
      let n = 0;
      for (const def of [TRACKS[0]!, TRACKS[2]!]) {
        // A slow player so every rival finishes and the result reflects the AI's own pace.
        const sim = runRace(def, level, 0.5);
        for (const rv of sim.rivals) {
          expect(rv.finishTime, `level ${level} ${def.id}`).not.toBeNull();
          sum += rv.finishTime!;
          n++;
        }
      }
      return sum / n;
    };
    const times = [0, 25, 50, 75, 100].map(avg);
    for (let i = 1; i < times.length; i++) expect(times[i]!, `level step ${i}`).toBeLessThan(times[i - 1]!);
  });

  it('level 100 laps within a few percent of the optimal autopilot lap on every track', () => {
    for (const def of TRACKS) {
      const track = buildTrack(def);
      const ap = new RaceSim(track);
      for (let i = 0; i < 120 * 120 && !ap.finished; i++) ap.step(autopilot(ap));
      const optimal = bestLap(ap.lap.laps)!;
      const sim = runRace(def, 100, 0.5);
      const ai = Math.min(...sim.rivals.map((r) => bestLap(r.lap.laps) ?? Infinity));
      expect(Math.abs(ai / optimal - 1), def.id).toBeLessThan(0.07);
    }
  });

  it('AI rivals lap cleanly (no missed checkpoints)', () => {
    const sim = runRace(TRACKS[1]!, 90, 0.6);
    for (const rv of sim.rivals) expect(rv.lap.laps.every((l) => l.valid), rv.name).toBe(true);
  });

  /** Smallest gap between two cars' bodies (negative = overlapping). */
  const bodyGap = (a: { x: number; y: number; a: number }, b: { x: number; y: number; a: number }): number => {
    const ends = (c: { x: number; y: number; a: number }) => [-1, 1].map((k) => ({ x: c.x + Math.cos(c.a) * BODY_OFFSET * k, y: c.y + Math.sin(c.a) * BODY_OFFSET * k }));
    let min = Infinity;
    for (const p of ends(a)) for (const q of ends(b)) min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y) - BODY_RADIUS * 2);
    return min;
  };

  it('a faster car hitting another from behind stops at the bumper and pushes it, nose to tail', () => {
    const behind = newCar(0, 0, 0);
    const ahead = newCar(60, 0, 0);
    behind.vx = 300;
    ahead.vx = 100;
    let minGap = Infinity;
    for (let i = 0; i < 120; i++) {
      for (const c of [behind, ahead]) {
        c.x += c.vx * DT;
        c.y += c.vy * DT;
      }
      collideCarPair(behind, ahead);
      minGap = Math.min(minGap, bodyGap(behind, ahead));
    }
    // The bodies (about 50 long) never sink into each other: the old single small circle let them overlap by ~13 units.
    expect(minGap).toBeGreaterThan(-0.5);
    expect(ahead.x - behind.x).toBeGreaterThan((BODY_OFFSET + BODY_RADIUS) * 2 - 1);
    expect(ahead.vx).toBeGreaterThan(100);
    expect(behind.vx).toBeLessThan(300);
  });

  it('cars side by side touch at their doors, not their centres', () => {
    const a = newCar(0, 0, 0);
    const b = newCar(0, 20, 0);
    collideCarPair(a, b);
    expect(Math.abs(b.y - a.y)).toBeGreaterThan(BODY_RADIUS * 2 - 0.5);
    expect(Math.abs(b.y - a.y)).toBeLessThan(BODY_RADIUS * 2 + 1);
  });

  it('cars bump apart instead of overlapping in the sim', () => {
    const sim = new RaceSim(buildTrack(TRACKS[0]!), null, CAR, { mode: 'race' });
    for (let i = 0; i < 120 * 2.3; i++) sim.step(0);
    const [me, rival] = [sim.racers[0]!, sim.racers[1]!];
    // Park the rival right on the player's nose.
    rival.car.x = me.car.x + Math.cos(me.car.a) * 30;
    rival.car.y = me.car.y + Math.sin(me.car.a) * 30;
    rival.car.a = me.car.a;
    rival.car.vx = rival.car.vy = 0;
    me.car.vx = Math.cos(me.car.a) * 300;
    me.car.vy = Math.sin(me.car.a) * 300;
    sim.step(0);
    expect(bodyGap(me.car, rival.car)).toBeGreaterThan(-0.5);
    expect(rival.car.vx * Math.cos(me.car.a) + rival.car.vy * Math.sin(me.car.a)).toBeGreaterThan(0);
  });

  it('no two cars ever overlap during a full AI race', () => {
    const sim = new RaceSim(buildTrack(TRACKS[2]!), null, CAR, { mode: 'race', aiLevel: 60 });
    let worst = Infinity;
    for (let i = 0; i < 120 * 90 && !sim.finished; i++) {
      sim.step(autopilot(sim));
      for (let a = 0; a < sim.racers.length; a++) {
        for (let b = a + 1; b < sim.racers.length; b++) worst = Math.min(worst, bodyGap(sim.racers[a]!.car, sim.racers[b]!.car));
      }
    }
    expect(worst).toBeGreaterThan(-2);
  });
});

describe('sectors', () => {
  it('splits the lap into three sectors at checkpoint gates', () => {
    expect(sectorGates(9)).toEqual([3, 6]);
    expect(sectorGates(8)).toEqual([3, 5]);
    expect(SECTORS).toBe(3);
  });

  it('times sectors and compares them with a reference', () => {
    const t = new SectorTimer(9);
    t.begin();
    expect(t.checkpoint(1, 2, null)).toBeNull();
    expect(t.checkpoint(3, 5, [6, 12, 18])).toMatchObject({ sector: 0, time: 5, delta: -1, sectorTime: 5, refSector: 6 });
    expect(t.checkpoint(6, 13, [6, 12, 18])).toMatchObject({ sector: 1, delta: 1, sectorTime: 8, refSector: 6 });
    expect(t.lap(17.5, true, [6, 12, 18])).toMatchObject({ sector: 2, delta: -0.5, sectorTime: 4.5 });
    expect(t.previous).toEqual([5, 13, 17.5]);
    expect(sectorTimes([5, 13, 17.5])).toEqual([5, 8, 4.5]);
  });

  it('gives no splits for a lap that missed a checkpoint', () => {
    const t = new SectorTimer(9);
    t.begin();
    t.checkpoint(3, 5, null);
    t.miss();
    expect(t.lap(20, true, null)).toBeNull();
    expect(t.laps).toHaveLength(0);
  });

  it('uses your best-ever lap in Time Trial and your previous lap in a race', () => {
    const best = [5, 10, 15];
    const prev = [6, 12, 18];
    expect(chooseReference('trial', best, prev)).toEqual({ kind: 'best', splits: best });
    expect(chooseReference('race', best, prev)).toEqual({ kind: 'previous', splits: prev });
    expect(bestSectors([[5, 13, 17.5], [6, 11, 17]])).toEqual([5, 5, 4.5]);
  });

  it('a Time Trial compares against the stored best; a race against the previous lap', () => {
    const track = buildTrack(TRACKS[0]!);
    const ref = [4, 8, 12];
    const trial = new RaceSim(track, null, CAR, { mode: 'trial', bestSplits: ref });
    for (let i = 0; i < 120 * 60 && !trial.finished; i++) trial.step(autopilot(trial));
    const firstLap = trial.result().splitLog.filter((e) => e.lap === 1);
    expect(firstLap).toHaveLength(3);
    // The stored reference is impossibly fast, so every split of lap 1 is slower (red).
    for (const e of firstLap) expect(e.delta!).toBeGreaterThan(0);

    const race = new RaceSim(track, null, CAR, { mode: 'race', aiLevel: 20 });
    for (let i = 0; i < 120 * 90 && !race.finished; i++) race.step(autopilot(race));
    const r = race.result();
    expect(r.splitLog.filter((e) => e.lap === 1).every((e) => e.delta === null)).toBe(true);
    const lap2 = r.splitLog.filter((e) => e.lap === 2);
    const [l1, l2] = [r.splits[0]!, r.splits[1]!];
    lap2.forEach((e) => expect(e.delta!).toBeCloseTo(l2[e.sector]! - l1[e.sector]!, 5));
  });
});

describe('track types and drift', () => {
  /** Forward and total speed after a typical drift (60% steering at speed for 0.5 s) with a type's handling. */
  const afterSlide = (h: Handling): { fwd: number; speed: number } => {
    const car = newCar(0, 0, 0);
    car.vx = 400;
    for (let i = 0; i < 60; i++) stepCar(car, { steer: 0.6, throttle: 1, brake: 0 }, SURFACES.asphalt, DT, CAR, h);
    return { fwd: localVelocity(car).fwd, speed: speedOf(car) };
  };

  it('every track has a type, and the set covers circuit, rally, snow and oval', () => {
    const types = new Set(TRACKS.map((t) => t.type));
    expect([...types].sort()).toEqual(['circuit', 'oval', 'rally', 'snow']);
  });

  it('a slide costs most on ovals, then circuits, little on snow, and rally keeps the most speed', () => {
    const v = Object.fromEntries((Object.keys(TRACK_TYPES) as (keyof typeof TRACK_TYPES)[]).map((k) => [k, afterSlide(TRACK_TYPES[k])]));
    expect(v.oval!.fwd).toBeLessThan(v.circuit!.fwd);
    expect(v.circuit!.fwd).toBeLessThan(v.snow!.fwd);
    expect(v.rally!.speed).toBeGreaterThan(v.circuit!.speed);
    expect(v.rally!.speed).toBeGreaterThan(v.oval!.speed);
  });

  it('rally lets the tail out more readily, with a sharper turn-in', () => {
    const r = TRACK_TYPES.rally;
    const c = TRACK_TYPES.circuit;
    expect(r.slideSteer).toBeLessThan(c.slideSteer);
    expect(r.slideRate).toBeGreaterThan(c.slideRate);
    expect(r.turnIn).toBeGreaterThan(c.turnIn);
    // A moderate turn at speed: the rally car slides, the circuit car grips.
    const slideOf = (h: Handling): number => {
      const car = newCar(0, 0, 0);
      car.vx = 380;
      for (let i = 0; i < 40; i++) stepCar(car, { steer: 0.45, throttle: 1, brake: 0 }, SURFACES.asphalt, DT, CAR, h);
      return car.slide;
    };
    expect(slideOf(r)).toBeGreaterThan(0.5);
    expect(slideOf(c)).toBe(0);
  });

  it('a banked drift pays a turbo only on rally tracks', () => {
    expect(TRACK_TYPES.rally.turbo).toBeGreaterThan(0);
    for (const k of ['circuit', 'oval', 'snow'] as const) expect(TRACK_TYPES[k].turbo).toBe(0);
    const turboOn = (def: (typeof TRACKS)[number]): boolean => {
      const sim = new RaceSim(buildTrack(def));
      for (let i = 0; i < 120 * 60 && !sim.finished; i++) {
        // Weave hard to force long slides.
        const s = autopilot(sim);
        for (const e of sim.step(Math.sign(s || 1))) if (e.type === 'driftBank' && e.boost) return true;
      }
      return false;
    };
    expect(turboOn(TRACKS.find((t) => t.type === 'rally')!)).toBe(true);
    expect(turboOn(TRACKS.find((t) => t.type === 'circuit')!)).toBe(false);
  });

  it('AI rivals keep it tidy on circuits and ovals (no sliding at speed)', () => {
    for (const def of TRACKS.filter((t) => TRACK_TYPES[t.type].noDrift)) {
      const sim = new RaceSim(buildTrack(def), null, { ...CAR, maxSpeed: CAR.maxSpeed * 0.5 }, { mode: 'race', aiLevel: 80 });
      let slideSteps = 0;
      let steps = 0;
      for (let i = 0; i < 120 * 40 && !sim.finished; i++) {
        sim.step(autopilot(sim));
        for (const r of sim.rivals) {
          steps++;
          if (r.car.slide > 0.5) slideSteps++;
        }
      }
      expect(slideSteps / steps, def.id).toBeLessThan(0.02);
    }
  });

  it('the AI-level bonus rewards beating higher levels and stays inside the leaderboard limits', () => {
    const track = buildTrack(TRACKS[0]!);
    const low = new RaceSim(track, null, CAR, { mode: 'race', aiLevel: 10 });
    const high = new RaceSim(track, null, CAR, { mode: 'race', aiLevel: 90 });
    low.position = 1;
    high.position = 1;
    expect(high.levelBonus(true)).toBeGreaterThan(low.levelBonus(true));
    expect(high.levelBonus(true)).toBeLessThanOrEqual(300);
    expect(high.levelBonus(false)).toBe(0);
    const limits = getGame('mini-racer')!.limits!;
    for (const def of TRACKS) {
      const lap = (def.par / 1000) * 0.75;
      const score = scoreFor(def.par, [lap, lap, lap].map((time) => ({ time, valid: true }))) + 300;
      expect(score, def.id).toBeLessThanOrEqual(limits.scorePerSecond * (lap * 3 + 3) + 50);
    }
  });
});

describe('full-speed tracks', () => {
  it('on every circuit, rally and oval track an autopilot lap averages a high fraction of top speed', () => {
    for (const def of TRACKS.filter((t) => t.type !== 'snow')) {
      const sim = new RaceSim(buildTrack(def));
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 120 * 120 && !sim.finished; i++) {
        sim.step(autopilot(sim));
        // Flying laps only; boost above top speed doesn't count extra.
        if (sim.lap.laps.length >= 1) {
          sum += Math.min(speedOf(sim.car), sim.spec.maxSpeed) / sim.spec.maxSpeed;
          n++;
        }
      }
      expect(sum / n, def.id).toBeGreaterThan(0.88);
    }
  });

  it('no slow surface sits across the racing line: sand and mud only as edge strips', () => {
    for (const def of TRACKS.filter((t) => t.type !== 'snow')) {
      for (const z of def.zones ?? []) expect(['sand', 'mud', 'snow', 'grass'], def.id).not.toContain(z.surface);
      for (const p of def.patches ?? []) {
        if (p.surface === 'boost') continue;
        // A slow patch must hug one edge (the centre of the road stays clear).
        expect(Math.abs(p.off) - p.wide / 2, `${def.id} ${p.surface}`).toBeGreaterThan(20);
      }
    }
  });

  it('AI at levels 20 and 100 completes clean laps on every track', () => {
    for (const def of TRACKS) {
      for (const level of [20, 100]) {
        const sim = new RaceSim(buildTrack(def), null, { ...CAR, maxSpeed: CAR.maxSpeed * 0.5 }, { mode: 'race', aiLevel: level });
        for (let i = 0; i < 120 * 220 && !sim.finished; i++) sim.step(autopilot(sim));
        for (const r of sim.rivals) {
          expect(r.finishTime, `${def.id} L${level} ${r.name}`).not.toBeNull();
          expect(r.lap.laps.every((l) => l.valid), `${def.id} L${level} ${r.name}`).toBe(true);
        }
      }
    }
  });
});

describe('view culling', () => {
  // A 100-point circle of radius 1000 around the origin.
  const ring = Array.from({ length: 100 }, (_, i) => ({ x: Math.cos((i / 100) * Math.PI * 2) * 1000, y: Math.sin((i / 100) * Math.PI * 2) * 1000 }));
  const cull = new PolyCull(ring, true, 10);

  it('draws everything when the whole line is on screen', () => {
    expect(cull.ranges({ minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 }, 10)).toEqual([[0, 100]]);
  });

  it('keeps only the stretch near the camera, wrapping past the start of a closed line', () => {
    // Around point 0 (x = 1000, y = 0): the visible stretch runs from the end of the loop into its start.
    const rs = cull.ranges({ minX: 900, maxX: 1100, minY: -150, maxY: 150 }, 10);
    expect(rs).toHaveLength(1);
    const [from, to] = rs[0]!;
    expect(from).toBeGreaterThan(50);
    expect(to).toBeGreaterThan(100);
    expect(cull.offsetOf(from)).toBeGreaterThan(0);
  });

  it('finds nothing far away from the line', () => {
    expect(cull.ranges({ minX: -100, maxX: 100, minY: -100, maxY: 100 }, 10)).toEqual([]);
  });

  it('measures dash offsets along the line', () => {
    const line = new PolyCull([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }], false, 1);
    expect(line.offsetOf(2)).toBeCloseTo(30);
    expect(line.ranges({ minX: 25, maxX: 40, minY: -5, maxY: 5 }, 0)).toEqual([[1, 2]]);
  });
});

describe('mini racer share line', () => {
  const lap = (time: number, valid = true) => ({ time, valid, clean: valid });
  it('gives each lap a medal against par (the first lap allows for the standing start)', () => {
    // par 20 s: gold ≤ 20, silver ≤ 22, bronze ≤ 25; lap 1 gets 0.9 s more.
    expect(lapLine(20_000, [lap(20.8), lap(21.5), lap(24.9), lap(30), lap(19, false)])).toBe('🥇🥈🥉🟩🟥');
    expect(raceMedal(20_000, 60.8)).toBe('gold');
    expect(raceMedal(20_000, null)).toBeNull();
  });
  it('shares the lap medals, time and place without the track layout', () => {
    const text = shareText({
      result: { laps: [lap(20), lap(20), lap(20)], raceTime: 60, position: 1, standings: [{}, {}, {}, {}] as never, score: 2950 },
      par: 20_000,
      trackName: 'Lagoon Loop',
      day: '2026-10-20',
      time: (s) => `${s}s`,
      url: 'https://x.test/games/mini-racer',
    });
    expect(text.split('\n')).toEqual(['Mini Racer #3 🏎️ Lagoon Loop', '🥇🥇🥇', '60s · 🏆 1st of 4', '2,950 race points', 'https://x.test/games/mini-racer']);
  });
});

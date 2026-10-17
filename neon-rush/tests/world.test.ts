import { describe, expect, it } from 'vitest';
import { World, reachMask, popcount } from '../src/game/world';
import { Autopilot } from '../src/game/autopilot';
import { LANES, PLAYER, SIM_DT, difficultyAt, laneCenter, HAZARD_SIZES } from '../src/game/config';

function makeWorld(seed = 1): World {
  return new World({ seed, viewHeight: 800 });
}

function placeHazard(world: World, lane: number, y: number) {
  // Use a real spawned hazard object as a template by forcing a row through the public pool.
  const h = {
    active: true, kind: 'car' as const, lane, x: laneCenter(lane), y, ...HAZARD_SIZES.car, variant: 0,
    danger: false, passed: false, row: null, changeTo: -1, changeT: 0, telegraph: 0, phase: 0,
  };
  world.hazards.push(h);
  return h;
}

function step(world: World, seconds: number, each?: (w: World) => void) {
  const n = Math.round(seconds / SIM_DT);
  for (let i = 0; i < n && !world.crashed; i++) {
    each?.(world);
    world.update(SIM_DT);
  }
}

describe('difficulty', () => {
  it('ramps monotonically and stays bounded', () => {
    let prev = difficultyAt(0);
    for (let m = 100; m <= 20000; m += 100) {
      const d = difficultyAt(m);
      expect(d.speed).toBeGreaterThanOrEqual(prev.speed);
      expect(d.rowGapTime).toBeLessThanOrEqual(prev.rowGapTime);
      prev = d;
    }
    expect(prev.speed).toBeLessThan(1200);
    expect(prev.rowGapTime).toBeGreaterThan(0.55);
  });
});

describe('player movement', () => {
  it('changes lanes smoothly and clamps at the road edges', () => {
    const w = makeWorld();
    w.hazards.length = 0;
    expect(w.player.lane).toBe(1);
    w.steer(-1);
    w.update(SIM_DT);
    expect(w.player.x).toBeLessThan(laneCenter(1));
    expect(w.player.x).toBeGreaterThan(laneCenter(0));
    for (let i = 0; i < 40; i++) w.update(SIM_DT);
    expect(w.player.x).toBe(laneCenter(0));
    w.steer(-1);
    expect(w.player.lane).toBe(0);
  });

  it('queues a quick second tap', () => {
    const w = makeWorld();
    w.steer(1);
    w.update(SIM_DT);
    w.steer(1);
    for (let i = 0; i < 60; i++) w.update(SIM_DT);
    expect(w.player.lane).toBe(3);
  });
});

describe('collision and scoring', () => {
  it('crashes when hitting a hazard in the same lane', () => {
    const w = makeWorld();
    placeHazard(w, w.player.lane, w.player.y - 200);
    step(w, 2);
    expect(w.crashed).toBe(true);
    expect(w.events.some((e) => e.type === 'crash')).toBe(true);
  });

  it('shield absorbs one hit', () => {
    const w = makeWorld();
    w.active.shield = 5;
    placeHazard(w, w.player.lane, w.player.y - 200);
    step(w, 1);
    expect(w.crashed).toBe(false);
    expect(w.stats.shieldSaves).toBe(1);
    expect(w.active.shield).toBe(0);
  });

  it('collects coins and scores them', () => {
    const w = makeWorld();
    const before = w.score;
    w.coins.push({ active: true, x: w.player.x, y: w.player.y - 30, phase: 0, magnetized: false });
    w.update(SIM_DT);
    expect(w.stats.coins).toBe(1);
    expect(w.score).toBeGreaterThanOrEqual(before + 10);
  });

  it('awards a near miss for a late dodge, but not for a car in another lane', () => {
    const w = makeWorld();
    const lane = w.player.lane;
    const h = placeHazard(w, lane, w.player.y - 260);
    // Dodge late: wait until the car is close, then move over.
    step(w, 0.5, (world) => {
      if (h.danger && world.player.lane === lane) world.steer(1);
    });
    step(w, 1);
    expect(w.crashed).toBe(false);
    expect(w.stats.nearMisses).toBeGreaterThanOrEqual(1);

    const w2 = makeWorld();
    placeHazard(w2, 3, w2.player.y - 260);
    step(w2, 1.5);
    expect(w2.stats.nearMisses).toBe(0);
  });

  it('distance and score increase over time', () => {
    const w = makeWorld();
    const pilot = new Autopilot();
    step(w, 5, (world) => pilot.update(world, SIM_DT));
    expect(w.meters).toBeGreaterThan(100);
    expect(w.score).toBeGreaterThanOrEqual(Math.floor(w.meters));
  });
});

describe('spawner fairness', () => {
  it('never produces a row that blocks all lanes', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const w = makeWorld(seed);
      w.distanceUnits = 4000 * 20; // late game
      const pilot = new Autopilot();
      step(w, 20, (world) => pilot.update(world, SIM_DT));
      for (const r of w.rows) {
        expect(popcount(r.mask)).toBeLessThan(LANES);
        expect(r.reach).not.toBe(0);
      }
    }
  });

  it('a perfect driver survives a long, hard run on many seeds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const w = makeWorld(seed * 7919);
      w.distanceUnits = 3000 * 20;
      const pilot = new Autopilot();
      step(w, 90, (world) => pilot.update(world, SIM_DT));
      expect(w.crashed, `seed ${seed} crashed at ${Math.round(w.meters)}m`).toBe(false);
    }
  });

  it('a driver with human-like reaction delay and 60 Hz input also survives', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const w = makeWorld(seed * 104729);
      const pilot = new Autopilot(0.1);
      let t = 0;
      for (let i = 0; i < 120 / SIM_DT && !w.crashed; i++) {
        t += SIM_DT;
        if (t >= 1 / 60) {
          pilot.update(w, t);
          t = 0;
        }
        w.update(SIM_DT);
      }
      expect(w.crashed, `seed ${seed} crashed at ${Math.round(w.meters)}m`).toBe(false);
    }
  });

  it('reachMask respects lane change time', () => {
    // From lane 0 only, the free lane is 3: needs 3 lane shifts.
    expect(reachMask(0b0001, 0b0111, 0.1)).toBe(0);
    expect(reachMask(0b0001, 0b0111, 2)).toBe(0b1000);
    expect(reachMask(0b0010, 0b1101, 0)).toBe(0b0010);
    // Every possible position needs an escape: lane 0 and lane 3 cannot both reach lane 1 with one shift.
    expect(reachMask(0b1001, 0b1101, 0.3)).toBe(0);
    expect(reachMask(0b0011, 0b1101, 0.3)).toBe(0b0010);
  });

  it('is deterministic for a seed', () => {
    const a = makeWorld(42);
    const b = makeWorld(42);
    const pa = new Autopilot();
    const pb = new Autopilot();
    step(a, 10, (w) => pa.update(w, SIM_DT));
    step(b, 10, (w) => pb.update(w, SIM_DT));
    expect(a.score).toBe(b.score);
    expect(a.stats.coins).toBe(b.stats.coins);
  });

  it('keeps the player position consistent on resize', () => {
    const w = makeWorld();
    w.setViewHeight(1000);
    expect(w.player.y).toBe(1000 - PLAYER.bottomOffset);
  });
});
